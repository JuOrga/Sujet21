// LE BANC DU TABLEAU — le vrai jeu, un tableau chargé, capturé sans tête.
//
//   ./node_modules/.bin/vite build --outDir /chemin/dist
//   ./node_modules/.bin/vite preview --outDir /chemin/dist --port 5301 --strictPort
//   node tools/banc-tableau/banc-tableau.cjs http://127.0.0.1:5301 sortie/ 1,4,9
//
// (sortie : tools/banc-tableau/captures/ par défaut, ignoré par git). Pour un
// AVANT / APRÈS, construire chaque version dans son dossier (--outDir) et
// servir les deux sur deux ports : les captures se comparent nom à nom.
// Chaque prise coûte ~40 s (chargement et compilation des shaders en rendu
// logiciel) : quelques tableaux, pas toute la liste. Lancer les bancs L'UN
// APRÈS L'AUTRE : deux à la fois se disputent le processeur, et la moitié
// des prises échouaient (le jeu ne se montait pas dans le délai).
//
// Pour chaque tableau (?tableau=N, la navigation directe de main.ts, sans le
// hub ; `hub` dans la liste ouvre le hub, seul tableau bâti en modules — des
// coques), deux captures : lumière allumée (`-lum`) et éteinte (`-nolum`). Les
// réglages passent par le localStorage AVANT le chargement, comme un joueur
// qui les aurait posés.
//
// Variables :
//   BANC_TAILLE=640x400   la taille de la page (le rendu logiciel paie au pixel :
//                         320 × 200 tient ~2 images/s, 640 × 400 reste lisible) ;
//   BANC_ATTENTE=6000     ms entre le chargement et la capture (la caméra pilote
//                         son entrée, la composition doit avoir tourné) ;
//   BANC_GL=angle         Chromium rend par ANGLE + SwiftShader au lieu du
//                         choix par défaut ;
//   BANC_RELIEF=fort      allume le relief 2.5D (off par défaut, comme le jeu) ;
//   BANC_LUMIERE=on|off   une seule des deux prises (les deux par défaut) ;
//   BANC_MONTAGE=120000  ms laissées au jeu pour se monter (le hub, bâti en
//                         coques, dépassait souvent 120 s en rendu logiciel :
//                         420000 l'a monté le 14/11) ;
//   BANC_ZOOM=2.5         rapproche la caméra (la molette du joueur : manualZoom)
//                         — au cadrage d'entrée, une paroi fait 10-20 pixels et
//                         un chanfrein n'en fait que deux ou trois.
//
// POURQUOI la recopie du canvas et pas `page.screenshot` : sur ce poste (WSL),
// la composition GPU sans tête rendait des captures BLANCHES. Le tampon WebGL,
// lui, est juste — mais le jeu ne le conserve pas d'une image à l'autre (pas
// de `preserveDrawingBuffer`, voir le constructeur du renderer : sur un GPU à
// tuiles il coûte cher). Le banc le force par un script injecté avant le jeu,
// sans toucher au code livré, puis recopie le canvas dans un canvas 2D et en
// tire un PNG. Une capture d'écran Playwright est aussi tentée, à côté, pour
// comparer (`-ecran.png`).
//
// Le dépôt n'a pas Playwright : le banc emprunte celui d'un autre projet de la
// machine (même chemin que les autres bancs).
const { chromium } = require('/home/julian/projets/PasMoi/node_modules/playwright-core')
const fs = require('fs')
const path = require('path')

const [base = 'http://127.0.0.1:5301', sortie = path.join(__dirname, 'captures'), liste = '1'] = process.argv.slice(2)
const dims = /^(\d+)x(\d+)$/.exec(process.env.BANC_TAILLE || '640x400')
if (!dims) {
  console.log('BANC_TAILLE : attendu LARGEURxHAUTEUR, par exemple 640x400')
  process.exit(1)
}
const VUE = { width: Number(dims[1]), height: Number(dims[2]) }
const ATTENTE = Number(process.env.BANC_ATTENTE || 6000)
const RELIEF = process.env.BANC_RELIEF || 'off'
const ZOOM = Number(process.env.BANC_ZOOM || 1)
const MONTAGE = Number(process.env.BANC_MONTAGE || 120000)
const LUMIERES = process.env.BANC_LUMIERE === 'on' ? [true] : process.env.BANC_LUMIERE === 'off' ? [false] : [true, false]
const ARGS = process.env.BANC_GL === 'angle'
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--enable-unsafe-swiftshader']
fs.mkdirSync(sortie, { recursive: true })

// injecté avant tout script de la page
function prepare({ lumiere, relief }) {
  try {
    localStorage.setItem('sujet21-lumiere', lumiere ? 'on' : 'off')
    localStorage.setItem('sujet21-relief', relief)
  } catch {}
  const brut = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type === 'webgl2' || type === 'webgl') {
      opts = Object.assign({}, opts, { preserveDrawingBuffer: true })
    }
    return brut.call(this, type, opts)
  }
}

// la plus grande toile WebGL de la page, recopiée en PNG
function recopie() {
  const toiles = [...document.querySelectorAll('canvas')]
    .filter((c) => c.width > 0 && c.height > 0)
    .sort((a, b) => b.width * b.height - a.width * a.height)
  const c = toiles[0]
  if (!c) return null
  const t = document.createElement('canvas')
  t.width = c.width
  t.height = c.height
  t.getContext('2d').drawImage(c, 0, 0)
  return t.toDataURL('image/png')
}

;(async () => {
  const b = await chromium.launch({ args: ARGS })
  for (const n of liste.split(',')) {
    for (const lumiere of LUMIERES) {
      const nom = `${n === 'hub' ? 'hub' : 't' + n.padStart(2, '0')}-${lumiere ? 'lum' : 'nolum'}`
      const ctx = await b.newContext({ viewport: VUE })
      await ctx.addInitScript(prepare, { lumiere, relief: RELIEF })
      const p = await ctx.newPage()
      const erreurs = []
      p.on('pageerror', (e) => erreurs.push((e.stack || e.message).slice(0, 400)))
      p.on('console', (m) => m.type() === 'error' && erreurs.push(m.text().slice(0, 300)))
      await p.goto(`${base}/?${n === 'hub' ? '' : `tableau=${n}&`}dev=0`, { waitUntil: 'domcontentloaded' })
      try {
        await p.waitForFunction(() => typeof window.__cam === 'object' && window.__sim, null, {
          timeout: MONTAGE,
          polling: 500,
        })
      } catch {
        console.log(nom, 'le jeu ne s’est pas monté', erreurs.join(' | '))
        await ctx.close()
        continue
      }
      // l'interface couvrirait la toile sur la capture d'écran
      await p.addStyleTag({
        content: 'body > *:not(canvas) { visibility: hidden !important } canvas { visibility: visible !important }',
      })
      if (ZOOM !== 1) {
        await p.evaluate((z) => {
          window.__cam.cancelIntro()
          window.__cam.manualZoom = window.__cam.zoom * z
        }, ZOOM)
      }
      await p.waitForTimeout(ATTENTE)
      // la sonde lit la MÊME toile que la recopie (la plus grande) : la
      // première du document peut être une toile 2D de l'interface
      const gl = await p.evaluate(() => {
        const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]
        const g = c && c.getContext('webgl2')
        return g ? g.getParameter(g.RENDERER) : 'pas une toile WebGL2'
      })
      const url = await p.evaluate(recopie)
      if (url) fs.writeFileSync(path.join(sortie, `${nom}.png`), Buffer.from(url.split(',')[1], 'base64'))
      try {
        await p.screenshot({ path: path.join(sortie, `${nom}-ecran.png`), timeout: 30000 })
      } catch {}
      console.log(nom, url ? 'ok' : 'pas de toile', '·', gl, erreurs.length ? '· ' + erreurs.join(' | ') : '')
      await ctx.close()
    }
  }
  await b.close()
})()
