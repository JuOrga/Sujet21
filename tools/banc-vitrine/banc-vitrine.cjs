// LE BANC DE LA VITRINE — la cuve de l'accueil, rendue par les DEUX variantes
// du shader de composition, et comparée pixel à pixel.
//
//   pnpm build
//   ./node_modules/.bin/vite preview --port 5301 --strictPort
//   node tools/banc-vitrine/banc-vitrine.cjs http://127.0.0.1:5301 sortie/
//
// POURQUOI. Le menu s'ouvre sur un rendu réduit (render/renderer.ts,
// sourceVitrine : la même source, `#define VITRINE` en tête, et tout ce que
// la cuve ne montre pas entouré de `#ifndef VITRINE`). Le rendu complet
// prend la suite quand il a fini de se compiler : si les deux variantes ne
// donnaient pas la même image, le joueur verrait la cuve « sauter » sous ses
// yeux. Ce banc le vérifie dans le vrai jeu : il attend que les deux soient
// liées, fige la boucle, puis rejoue LA MÊME image — mêmes arguments, même
// simulation — avec le rendu complet (A), la vitrine (B), puis encore le
// complet (A'). L'écart A/A' est le bruit de fond (zéro attendu) ; l'écart
// A/B est ce que la vitrine a perdu.
//
// Il dit aussi, en passant : la date de la première image (vitrine) et
// celle du rendu complet, et que le bouton principal était bloqué entre les
// deux. En rendu logiciel (SwiftShader), ces durées ne valent PAS celles du
// compilateur Direct3D d'un joueur sous Windows — seul leur rapport parle.
//
// LA COMPILATION PARALLÈLE EST SIMULÉE. Le Chromium sans tête (SwiftShader)
// n'expose pas KHR_parallel_shader_compile, et sans elle le jeu garde son
// ancien chargement, d'un bloc (voir Renderer.pretVitrine) : il n'y aurait
// rien à comparer. Le banc pose donc l'extension lui-même — le pilote, lui,
// compile toujours dans le fil — et retient BANC_RETARD ms le verdict des
// programmes complets, le temps de voir le menu ouvert sur la vitrine, son
// bouton bloqué.
//
// Variables : BANC_RETARD=3000 ; BANC_TAILLE=640x400 ; BANC_MONTAGE=240000 (ms pour le rendu
// complet) ; BANC_REGLAGES=defaut,sobre,net (les jeux de réglages rejoués).
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const [base = 'http://127.0.0.1:5301', sortie = path.join(__dirname, 'captures')] = process.argv.slice(2)
const dims = /^(\d+)x(\d+)$/.exec(process.env.BANC_TAILLE || '640x400')
const VUE = { width: Number(dims[1]), height: Number(dims[2]) }
const MONTAGE = Number(process.env.BANC_MONTAGE || 240000)
const REGLAGES = {
  defaut: {},
  sobre: {
    'sujet21-decor': 'sobre',
    'sujet21-eau': 'sobre',
    'sujet21-lumiere': 'off',
    'sujet21-lumiere-eau': 'off',
    'sujet21-relief': 'off',
    'sujet21-miroir': 'classique',
  },
  net: { 'sujet21-decor-net': 'on', 'sujet21-relief': 'leger', 'sujet21-miroir': 'miroir' },
}
const JEUX = (process.env.BANC_REGLAGES || 'defaut,sobre,net').split(',')
const RETARD = Number(process.env.BANC_RETARD || 3000)
fs.mkdirSync(sortie, { recursive: true })

function prepare({ reglages, retard }) {
  try {
    for (const k of Object.keys(reglages)) localStorage.setItem(k, reglages[k])
  } catch {}
  const brut = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type === 'webgl2' || type === 'webgl') opts = Object.assign({}, opts, { preserveDrawingBuffer: true })
    const gl = brut.call(this, type, opts)
    if (gl && type === 'webgl2' && !gl.__parallele) {
      // l'extension simulée : les sept premiers programmes (communs et
      // vitrine) sont « finis » aussitôt, les suivants après le retard
      gl.__parallele = true
      const FINI = 0x91b1
      const lies = new Map()
      const ext = gl.getExtension.bind(gl)
      const lie = gl.linkProgram.bind(gl)
      const param = gl.getProgramParameter.bind(gl)
      gl.getExtension = (nom) => (nom === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: FINI } : ext(nom))
      gl.linkProgram = (prog) => {
        lies.set(prog, performance.now() + (lies.size >= 7 ? retard : 0))
        return lie(prog)
      }
      gl.getProgramParameter = (prog, quoi) =>
        quoi === FINI ? performance.now() >= (lies.get(prog) ?? 0) : param(prog, quoi)
    }
    return gl
  }
  // la chronologie de l'amorçage, relevée à l'image
  window.__chrono = { vitrine: -1, complet: -1, bloque: null, mot: '' }
  const tic = () => {
    const r = window.__rendu
    const c = window.__chrono
    if (r) {
      if (c.vitrine < 0 && r.enVitrine && document.getElementById('amorce')?.classList.contains('fini')) {
        c.vitrine = performance.now()
        c.bloque = document.getElementById('start')?.disabled ?? null
        c.mot = document.getElementById('acc-verbe-detail')?.textContent ?? ''
      }
      if (c.complet < 0 && r.forceVariante(false)) {
        c.complet = performance.now()
        return
      }
    }
    requestAnimationFrame(tic)
  }
  requestAnimationFrame(tic)
}

// Dans la page : fige la boucle, rejoue la même image par chaque variante.
async function compare() {
  const r = window.__rendu
  let args = null
  const brut = r.render.bind(r)
  r.render = (...a) => {
    args = a
    return brut(...a)
  }
  await new Promise((ok) => {
    const attend = () => (args ? ok() : requestAnimationFrame(attend))
    attend()
  })
  window.requestAnimationFrame = () => 0 // plus aucune image du jeu
  await new Promise((ok) => setTimeout(ok, 200))
  const toile = [...document.querySelectorAll('canvas')]
    .filter((c) => c.width > 0)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0]
  const prise = (vitrine) => {
    if (!r.forceVariante(vitrine)) return null
    brut(...args)
    const t = document.createElement('canvas')
    t.width = toile.width
    t.height = toile.height
    const g = t.getContext('2d')
    g.drawImage(toile, 0, 0)
    return { url: t.toDataURL('image/png'), px: g.getImageData(0, 0, t.width, t.height).data }
  }
  const ecart = (a, b) => {
    let max = 0
    let plus8 = 0
    let somme = 0
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]))
      if (d > max) max = d
      if (d > 8) plus8++
      somme += d
    }
    return { max, plus8, moyen: +(somme / (a.length / 4)).toFixed(4) }
  }
  const A = prise(false)
  const B = prise(true)
  const A2 = prise(false)
  if (!A || !B || !A2) return { erreur: 'une variante manque (vitrine refusée, ou pas de compilation parallèle)' }
  return { bruit: ecart(A.px, A2.px), vitrine: ecart(A.px, B.px), complet: A.url, reduit: B.url, pixels: A.px.length / 4 }
}

;(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  let rouge = false
  for (const jeu of JEUX) {
    const ctx = await b.newContext({ viewport: VUE })
    await ctx.addInitScript(prepare, { reglages: REGLAGES[jeu] || {}, retard: RETARD })
    const p = await ctx.newPage()
    const erreurs = []
    p.on('pageerror', (e) => erreurs.push((e.stack || e.message).slice(0, 400)))
    p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && erreurs.push(m.text().slice(0, 300)))
    await p.goto(base + '/?dev=0', { waitUntil: 'domcontentloaded' })
    try {
      await p.waitForFunction(() => window.__chrono && window.__chrono.complet > 0, null, { timeout: MONTAGE, polling: 500 })
    } catch {
      console.log(jeu, '· le rendu complet n’est pas arrivé', await p.evaluate(() => window.__chrono), erreurs.join(' | '))
      rouge = true
      await ctx.close()
      continue
    }
    const chrono = await p.evaluate(() => window.__chrono)
    const res = await p.evaluate(compare)
    if (res.erreur) {
      console.log(jeu, '·', res.erreur, erreurs.join(' | '))
      rouge = true
    } else {
      fs.writeFileSync(path.join(sortie, `${jeu}-complet.png`), Buffer.from(res.complet.split(',')[1], 'base64'))
      fs.writeFileSync(path.join(sortie, `${jeu}-vitrine.png`), Buffer.from(res.reduit.split(',')[1], 'base64'))
      const ok = res.vitrine.max <= Math.max(2, res.bruit.max)
      if (!ok) rouge = true
      console.log(
        jeu,
        ok ? '· IDENTIQUES' : '· ÉCART',
        `· vitrine/complet : max ${res.vitrine.max}, ${res.vitrine.plus8} px > 8 sur ${res.pixels}, moyen ${res.vitrine.moyen}`,
        `· bruit complet/complet : max ${res.bruit.max}`,
        `· 1re image ${Math.round(chrono.vitrine)} ms, rendu complet ${Math.round(chrono.complet)} ms`,
        `· bouton bloqué : ${chrono.bloque} (« ${chrono.mot} »)`,
        erreurs.length ? '· ' + erreurs.join(' | ') : '',
      )
    }
    await ctx.close()
  }
  await b.close()
  process.exit(rouge ? 1 : 0)
})()
