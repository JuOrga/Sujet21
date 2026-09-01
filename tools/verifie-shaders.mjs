#!/usr/bin/env node
// VÉRIFIE LES VARIANTES DU SHADER DE COMPOSITION.
//
// Depuis que la composition se spécialise par tableau (src/render/
// variantes.ts), ce n'est plus UN shader qui part chez le joueur mais une
// famille : onze drapeaux, donc 2 048 sources possibles. Les tests de
// variantes.spec.ts disent que les drapeaux et le shader se répondent —
// c'est du texte, ça ne compile rien. Ici on demande à un VRAI compilateur
// GLSL, dans un vrai WebGL2 :
//
//   1. chaque variante éprouvée COMPILE (les deux extrêmes, chaque drapeau
//      seul, chaque drapeau retiré de la générique, et un tirage) ;
//   2. une variante rend EXACTEMENT la même image que la générique quand
//      elle ne retire que de l'inutilisé — au pixel près, sur toute
//      l'image. Deux contrôles négatifs retirent au contraire un drapeau
//      dont la scène a besoin : ceux-là DOIVENT diverger, sinon le test ne
//      prouverait rien.
//
// Ce contrôle ne tourne pas en intégration continue, et c'est voulu : il
// demande un navigateur, et le dépôt vise les paliers gratuits (cf.
// CLAUDE.md). Il se lance à la main, avant de pousser un changement du
// shader ou des drapeaux :
//
//     node tools/verifie-shaders.mjs
//
// Il lui faut playwright-core (déjà en devDependencies) et un Chromium.
// Sans navigateur il le dit et s'arrête sans échouer : il ne doit jamais
// bloquer quelqu'un qui ne touche pas au rendu.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------- le navigateur
async function trouveChromium() {
  let chromium
  try {
    ;({ chromium } = await import('playwright-core'))
  } catch {
    return { raison: 'playwright-core n’est pas installé (pnpm install).' }
  }
  const candidats = []
  if (process.env.PLAYWRIGHT_CHROMIUM) candidats.push(process.env.PLAYWRIGHT_CHROMIUM)
  try {
    candidats.push(chromium.executablePath())
  } catch {
    /* playwright n'a pas de chemin par défaut : les candidats suivants suffiront */
  }
  // Les navigateurs déposés à côté (PLAYWRIGHT_BROWSERS_PATH) ne portent pas
  // forcément la révision que cette version de playwright-core attend : on
  // prend ce qui est RÉELLEMENT là plutôt que ce qui est réclamé.
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (racine && existsSync(racine))
    for (const d of readdirSync(racine))
      if (d.startsWith('chromium'))
        for (const sous of ['chrome-linux/chrome', 'chrome-linux64/chrome'])
          candidats.push(join(racine, d, sous))
  const executablePath = candidats.find((c) => c && existsSync(c))
  if (!executablePath)
    return { raison: 'aucun Chromium trouvé (npx playwright install chromium).' }
  return { chromium, executablePath }
}

// ------------------------------------------------------------------ les sources
const racineSrc = new URL('../src/', import.meta.url)
const lis = (f) => readFileSync(new URL(f, racineSrc), 'utf8')
const renderer = lis('render/renderer.ts')

/** Le contenu d'un littéral de gabarit `const NOM = ` … ` `. Les shaders
 * n'en contiennent aucun autre : un accent grave dans un commentaire GLSL
 * fermerait le littéral, et TypeScript s'en plaindrait bien avant nous. */
function litteral(nom) {
  const i = renderer.indexOf(`const ${nom} = \``)
  if (i < 0) throw new Error(`littéral introuvable : ${nom}`)
  const debut = renderer.indexOf('`', i) + 1
  return renderer.slice(debut, renderer.indexOf('`', debut))
}
const FORMES_GLSL = litteral('FORMES_GLSL')
const developpe = (s) => s.replaceAll('${FORMES_GLSL}', FORMES_GLSL)
const COMPOSE_VS = developpe(litteral('COMPOSE_VS'))
const COMPOSE_FS = developpe(litteral('COMPOSE_FS'))

// Les drapeaux se relisent depuis variantes.ts : la liste de cet outil ne
// peut donc pas dériver de celle du jeu.
const varSrc = lis('render/variantes.ts')
const DRAPEAUX = [
  ...varSrc
    .slice(varSrc.indexOf('export const DRAPEAUX = ['), varSrc.indexOf('] as const'))
    .matchAll(/'(AVEC_[A-Z_]+)'/g),
].map((m) => m[1])
if (DRAPEAUX.length === 0) throw new Error('aucun drapeau relu dans variantes.ts')
const bit = (d) => {
  const i = DRAPEAUX.indexOf(d)
  if (i < 0) throw new Error(`drapeau inconnu : ${d}`)
  return 1 << i
}
const MASQUE_TOUT = (1 << DRAPEAUX.length) - 1

const prelude = (masque) =>
  DRAPEAUX.flatMap((d, b) => {
    const actif = (masque & (1 << b)) !== 0
    return [
      ...(actif ? [`#define ${d} 1`] : []),
      `const bool SI_${d.slice('AVEC_'.length)} = ${actif};`,
    ]
  }).join('\n') + '\n'

const source = (masque, arret = 0, boitesNu = false) => {
  const f = COMPOSE_FS.indexOf('\n')
  const marche =
    (arret > 0 ? `#define SONDE_ARRET ${arret}\n` : '') +
    (boitesNu ? '#define SONDE_BOITES_NU 1\n' : '')
  return COMPOSE_FS.slice(0, f + 1) + marche + prelude(masque) + COMPOSE_FS.slice(f + 1)
}

// --------------------------------------------------------------- les éprouvettes
const masques = new Set([0, MASQUE_TOUT])
for (let b = 0; b < DRAPEAUX.length; b++) {
  masques.add(1 << b) // le drapeau SEUL : la branche #else de tous les autres
  masques.add(MASQUE_TOUT & ~(1 << b)) // le drapeau RETIRÉ : sa branche isolée
}
for (let i = 0; i < 16; i++) masques.add(Math.floor(Math.random() * (MASQUE_TOUT + 1)))

// LES MARCHES DU PROFIL (?sonde=arret1..5). Une marche qui ne compilerait
// pas ne se découvrirait qu'au moment de mesurer, sur l'appareil, à l'autre
// bout d'un déploiement.
const MARCHES = [1, 2, 3, 4, 5, 6]

const MATS =
  bit('AVEC_TEX_PAROI') | bit('AVEC_TEX_PHILE') | bit('AVEC_TEX_PHOBE')

// La scène : trois solides (paroi, hydrophile, hydrophobe) et du fluide au
// centre. Toutes les images de matériau sont déclarées présentes — c'est le
// cas DÉFAVORABLE : si une variante retirait un prélèvement encore utile,
// l'image changerait.
const CAS = [
  {
    nom: 'les textures inutilisées retirées (ni plaque froide, ni chaudière, ni évent)',
    masque: MATS,
    uniformes: {},
  },
  { nom: 'relief éteint — le réglage par défaut', masque: MATS, uniformes: { uRelief: 0 } },
  {
    nom: 'relief allumé, variante qui le garde',
    masque: MATS | bit('AVEC_RELIEF'),
    uniformes: { uRelief: 0.035 },
  },
  { nom: 'aucune zone posée', masque: MATS, uniformes: { uZoneCount: 0 } },
  { nom: 'aucune brume', masque: MATS, uniformes: { uBrume: 0 } },
  { nom: 'pas de sol en modules', masque: MATS, uniformes: { uSolModules: 0 } },
  { nom: 'le volume ne porte pas d’ombre', masque: MATS, uniformes: { uLumiereEau: 0 } },
  {
    nom: 'tout allumé — la générique contre elle-même',
    masque: MASQUE_TOUT,
    uniformes: { uRelief: 0.035, uBrume: 0.4, uLumiereEau: 1, uLumiere: 1 },
  },
  // Les contrôles négatifs : ils retirent un drapeau dont la scène a besoin.
  {
    nom: 'CONTRÔLE — la paroi retirée alors qu’elle sert',
    masque: bit('AVEC_TEX_PHILE') | bit('AVEC_TEX_PHOBE'),
    uniformes: {},
    doitDiverger: true,
  },
  {
    nom: 'CONTRÔLE — le relief retiré alors qu’il est allumé',
    masque: MATS,
    uniformes: { uRelief: 0.035 },
    doitDiverger: true,
  },
]

// Les niveaux de détail des textures de matériau, comme le jeu les calcule
// (ECHELLES_MAT et la taille des images) : sans eux la comparaison opposerait
// un rendu doté de ses niveaux à un rendu qui n'en a pas.
const ECHELLES_MAT = [230, 520, 170, 210, 460, 380, 624]
const TAILLE_EPREUVE = 64 // le damier du banc
const LOD_MAT = ECHELLES_MAT.map((k) =>
  Math.max(0, Math.log2((TAILLE_EPREUVE * (1 / (0.22 * 1))) / k)),
)

const BASE = {
  uDpr: 1, uZoom: 0.22, uThreshold: 0.5, uSoftness: 0.25, uFieldScale: 1,
  uTime: 1.234, uDecor: 1, uEau: 1, uAmbiante: 0.52, uChill: 0.2,
  uExitRadius: 120, uColdBand: 90, uHeatBand: 90, uHydroBand: 60,
  uLumiere: 0, uLampeCount: 0, uWaveCount: 0, uZoneCount: 0,
  uSolModules: 0, uRelief: 0, uBrume: 0, uLumiereEau: 0, uMiroirEau: 1,
  uHasWall: 1, uHasPhobe: 1, uHasPhile: 1, uHasFroid: 1, uHasChaud: 1,
  uHasGrille: 1, uRayonCorps: 200, uCielMode: 0, uCielForce: 1, uCielSpan: 6000,
}

// ------------------------------------------------------------------ la vérité GPU
function dansLaPage({ vs, sources, cas, base, lodMat }) {
  const N = 192
  const cv = document.createElement('canvas')
  cv.width = N
  cv.height = N
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false })
  if (!gl) return { fatal: 'WebGL2 indisponible dans ce navigateur.' }
  gl.getExtension('EXT_color_buffer_float')

  const compile = (type, s) => {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, s)
    gl.compileShader(sh)
    const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS)
    const log = ok ? '' : gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    return { ok, log }
  }
  const lie = (fs) => {
    const p = gl.createProgram()
    for (const [t, s] of [
      [gl.VERTEX_SHADER, vs],
      [gl.FRAGMENT_SHADER, fs],
    ]) {
      const sh = gl.createShader(t)
      gl.shaderSource(sh, s)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(sh))
      gl.attachShader(p, sh)
    }
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p))
    return p
  }

  // 1 — la compilation de toutes les éprouvettes
  const refusees = []
  const v = compile(gl.VERTEX_SHADER, vs)
  if (!v.ok) refusees.push({ masque: 'sommets', log: v.log.slice(0, 500) })
  for (const { masque, s } of sources) {
    const r = compile(gl.FRAGMENT_SHADER, s)
    if (!r.ok) refusees.push({ masque, log: r.log.slice(0, 500) })
  }
  if (refusees.length) return { refusees, images: [] }

  // 2 — l'image, deux fois, avec les mêmes uniformes
  const damier = new Uint8Array(64 * 64 * 4)
  for (let i = 0; i < 64 * 64; i++) {
    const x = i % 64
    const y = (i / 64) | 0
    const t = ((x >> 3) + (y >> 3)) % 2 ? 200 : 60
    damier[i * 4] = t
    damier[i * 4 + 1] = 255 - t
    damier[i * 4 + 2] = (x * 4) & 255
    damier[i * 4 + 3] = 255
  }
  const tex2d = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex2d)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, damier)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  const texArr = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArr)
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, 64, 64, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  const champ = new Uint8Array(N * N * 4)
  for (let i = 0; i < N * N; i++) {
    const x = (i % N) / N - 0.5
    const y = ((i / N) | 0) / N - 0.5
    const f = Math.exp(-(x * x + y * y) * 26) * 255
    champ[i * 4] = f
    champ[i * 4 + 1] = f * 0.4
    champ[i * 4 + 2] = f * 0.8
    champ[i * 4 + 3] = 128
  }
  const texChamp = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texChamp)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, champ)
  for (const p of ['MIN', 'MAG'])
    gl.texParameteri(gl.TEXTURE_2D, gl[`TEXTURE_${p}_FILTER`], gl.LINEAR)
  for (const p of ['S', 'T'])
    gl.texParameteri(gl.TEXTURE_2D, gl[`TEXTURE_WRAP_${p}`], gl.CLAMP_TO_EDGE)

  const generique = lie(sources.find((s) => s.generique).s)
  const infos = (p) => {
    const m = {}
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) {
      const u = gl.getActiveUniform(p, i)
      m[u.name] = { loc: gl.getUniformLocation(p, u.name), type: u.type }
    }
    return m
  }
  // Les unités de texture sont attribuées PAR NOM depuis la générique : les
  // deux programmes reçoivent exactement la même affectation, quels que
  // soient les uniformes qu'une variante a cessé d'employer.
  const ref = infos(generique)
  const unites = {}
  let libre = 1
  for (const nom of Object.keys(ref).sort()) {
    if (ref[nom].type === gl.SAMPLER_2D) unites[nom] = nom === 'uField' ? 0 : libre++
    else if (ref[nom].type === gl.SAMPLER_2D_ARRAY) unites[nom] = 20
  }
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texChamp)
  for (const u of new Set(Object.values(unites))) {
    if (u === 0 || u === 20) continue
    gl.activeTexture(gl.TEXTURE0 + u)
    gl.bindTexture(gl.TEXTURE_2D, tex2d)
  }
  gl.activeTexture(gl.TEXTURE0 + 20)
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArr)

  const BOITES = new Float32Array(96 * 4)
  const AUX = new Float32Array(96 * 4)
  ;[
    [-700, -300, -200, 200, 0],
    [100, -400, 600, -100, 1],
    [150, 100, 700, 500, 2],
  ].forEach((b, i) => {
    BOITES.set(b.slice(0, 4), i * 4)
    AUX[i * 4] = b[4]
    AUX[i * 4 + 3] = 1
  })

  const rend = (prog, sup) => {
    gl.useProgram(prog)
    const inf = infos(prog)
    const met = (nom, val) => {
      const e = inf[nom]
      if (!e) return
      if (Array.isArray(val)) {
        if (val.length === 2) gl.uniform2f(e.loc, val[0], val[1])
        else if (val.length === 3) gl.uniform3f(e.loc, val[0], val[1], val[2])
        else gl.uniform4f(e.loc, val[0], val[1], val[2], val[3])
      } else if (e.type === gl.INT || e.type === gl.BOOL) gl.uniform1i(e.loc, val)
      else gl.uniform1f(e.loc, val)
    }
    for (const [n, u] of Object.entries(unites)) if (inf[n]) gl.uniform1i(inf[n].loc, u)
    met('uCanvasSize', [N, N])
    met('uViewport', [N, N])
    met('uCenter', [0, 0])
    met('uRoomCenter', [0, 0])
    met('uRoomHalf', [900, 900])
    met('uCentroide', [0, 0])
    met('uGelCentre', [0, 0])
    met('uRegardPos', [0, 0])
    met('uRespiration', [0, 1])
    met('uLightMapMin', [-1000, -1000])
    met('uLightMapInvSize', [1 / 2000, 1 / 2000])
    met('uParCiel', [0.38, 1])
    met('uParSemis', [1, 1])
    met('uParCuve', [0.9, 1])
    met('uOeilRegl', [1, 1, 1, 1])
    met('uHasZones', [0, 0, 0])
    if (inf['uLodMat[0]'])
      gl.uniform1fv(inf['uLodMat[0]'].loc, new Float32Array(lodMat))
    for (const [k, val] of Object.entries({ ...base, ...sup })) met(k, val)
    if (inf['uBoxCount']) gl.uniform1i(inf['uBoxCount'].loc, 3)
    if (inf['uBoxes[0]']) gl.uniform4fv(inf['uBoxes[0]'].loc, BOITES)
    if (inf['uBoxAux[0]']) gl.uniform4fv(inf['uBoxAux[0]'].loc, AUX)
    gl.viewport(0, 0, N, N)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const px = new Uint8Array(N * N * 4)
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, px)
    return px
  }

  const images = []
  for (const c of cas) {
    const attendu = rend(generique, c.uniformes)
    const obtenu = rend(lie(c.s), c.uniformes)
    let composantes = 0
    let pire = 0
    let peints = 0
    for (let i = 0; i < attendu.length; i += 4) {
      if (attendu[i] || attendu[i + 1] || attendu[i + 2]) peints++
      for (let k = 0; k < 3; k++) {
        const e = Math.abs(attendu[i + k] - obtenu[i + k])
        if (e) {
          composantes++
          if (e > pire) pire = e
        }
      }
    }
    images.push({ nom: c.nom, doitDiverger: !!c.doitDiverger, composantes, pire, peints })
  }
  return { refusees: [], images }
}

// ---------------------------------------------------------------------- le rapport
const trouve = await trouveChromium()
if (trouve.raison) {
  console.log(`Vérification des shaders NON EXÉCUTÉE : ${trouve.raison}`)
  console.log('Rien n’est cassé pour autant — mais le shader n’a pas été éprouvé.')
  process.exit(0)
}

const navigateur = await trouve.chromium.launch({
  executablePath: trouve.executablePath,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
let sortie = 0
try {
  const page = await navigateur.newPage()
  await page.goto('about:blank')
  const r = await page.evaluate(dansLaPage, {
    vs: COMPOSE_VS,
    base: BASE,
    lodMat: LOD_MAT,
    sources: [
      ...[...masques].map((masque) => ({
        masque,
        s: source(masque),
        generique: masque === MASQUE_TOUT,
      })),
      ...MARCHES.map((arret) => ({
        masque: `marche ${arret}`,
        s: source(MASQUE_TOUT, arret),
        generique: false,
      })),
      // la boucle entière, son habillage retiré
      { masque: 'boitesnu', s: source(MASQUE_TOUT, 0, true), generique: false },
    ],
    cas: CAS.map((c) => ({ ...c, s: source(c.masque) })),
  })
  if (r.fatal) {
    console.error(r.fatal)
    process.exit(1)
  }
  console.log(
    `Compilation — ${masques.size} variantes et ${MARCHES.length + 1} marches de sonde éprouvées`,
  )
  if (r.refusees.length) {
    sortie = 1
    for (const e of r.refusees) console.error(`  REFUSÉE (masque ${e.masque})\n${e.log}`)
  } else console.log('  toutes acceptées.')

  console.log(`\nImage — la variante contre la générique, ${CAS.length} cas`)
  for (const im of r.images) {
    const diverge = im.composantes > 0
    const bon = diverge === im.doitDiverger
    if (!bon) sortie = 1
    const etat = diverge ? 'DIVERGE  ' : 'identique'
    const detail = diverge ? ` (${im.composantes} composantes, écart max ${im.pire})` : ''
    console.log(`  ${bon ? ' ' : '✗'} ${etat} ${String(im.peints).padStart(5)} px  ${im.nom}${detail}`)
  }
} finally {
  await navigateur.close()
}
console.log(sortie === 0 ? '\nLes variantes rendent la même image que la générique.' : '\nÉCHEC.')
process.exit(sortie)
