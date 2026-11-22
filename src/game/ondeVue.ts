// LA RIVE D'UNE CARTE, À L'ÉCRAN — la toile, le pointeur, la boucle.
//
// La physique est dans onde.ts. Ici :
//   — LA TOILE : posée dans le PLI, par-dessus la face et un peu au-delà
//     (MARGE px de chaque côté) — le filet d'eau peut déborder du bord de la
//     carte, ce que la face, taillée au chanfrein, rognerait. Elle ne dessine
//     QUE le contour : le texte de la carte n'est jamais touché. Tant qu'elle
//     dessine, le filet de la feuille de style s'efface (`.mb-liquide`) ;
//     au départ du focus il revient pendant que l'eau s'éteint ;
//   — LE PLI : inclinaison, flottaison et gonflement suivent des ressorts
//     amortis, posés en `transform` inline — l'animation du retournement et
//     celle de l'élue l'emportent sur lui (une animation passe devant le
//     style inline) : il ne les gêne pas. Au repos, le transform inline
//     s'efface et la feuille de style reprend la main, à la même valeur ;
//   — LA BOUCLE : une seule pour toutes les cartes qui bougent ; elle tourne
//     tant qu'une carte a le focus (la houle) ou qu'une rive tremble encore,
//     et s'arrête dès que tout s'est tu.
// Le pli reste un pli : rien ici ne pose d'opacité, de filtre ni de
// clip-path sur lui (index.html, « LE PLI porte la 3D ») ; la toile est un
// enfant de plus, tourné vers l'avant, dos caché.
//
// LES AUTRES CHOIX DE LA CÉRÉMONIE (« applique cela au choix du surplus et
// au choix de la salle », le concepteur, 22/11) : une cuve du versement, une
// porte de salle. Ce sont des boutons taillés au chanfrein, sans pli : leur
// clip-path rognerait une toile qui déborde. La toile vit alors DANS le
// bouton, et le contour d'eau court à `retrait` px en dedans du bord (voir
// OptionsOnde) ; le bouton porte lui-même l'inclinaison, avec sa propre
// perspective.

import {
  AMORTI,
  AMORTI_QUITTE,
  ECART_MAX,
  GOUTTE_PX,
  PAS_RIVE,
  Ressort,
  Rive,
  SEUIL_CALME,
  SILLAGE_PX,
  SOUS_PAS,
  contourCarte,
  houle,
  longueurContour,
} from './onde'
import type { Noeud } from './onde'

/** La place que la toile prend au-delà de la carte, de chaque côté (px) :
 *  plus que le plus grand écart de la rive (ECART_MAX) et que son trait. */
export const MARGE = 10

/** Le chanfrein de la carte (index.html, --mb-chanfrein) : le contour d'eau
 *  suit le coin coupé du verbe de l'accueil. */
const CHANFREIN = 14

/** L'inclinaison au bord de la carte, en degrés : la moitié de l'ancienne
 *  (9°), qui faisait plonger le coin opposé — la carte ne se tient plus à
 *  bout de bras, elle flotte. */
export const INCLINAISON = 5

/** La flottaison de la carte visée, en pixels (la feuille de style tient la
 *  même au repos : `.mb-pli.mb-vise`). */
export const FLOTTE = -6

const PAS_S = 1 / 60

/** Les paliers d'intensité des reflets : un tracé chacun. */
const PALIERS = 4

export interface OptionsOnde {
  /** Le contour court à `retrait` px EN DEDANS du bord, et la toile vit
   *  dans l'élément même (pli = face) : pour un bouton taillé au chanfrein,
   *  dont le clip-path rognerait la moitié extérieure des vagues. 0 (le
   *  tirage) : le contour suit le bord, la toile déborde dans le pli. */
  retrait?: number
  /** La flottaison de l'élément visé, en px (FLOTTE par défaut). */
  flotte?: number
  /** La feuille de style tient-elle cette flottaison au repos ? Oui pour
   *  le tirage (`.mb-pli.mb-vise`) : le transform inline s'efface dès que
   *  tout est posé. Non ailleurs : il reste tant que l'élément est visé. */
  flotteTenue?: boolean
  /** Une perspective propre (px), quand le parent n'en donne pas : sans
   *  elle, une inclinaison ne se lit que comme un écrasement. */
  perspective?: number
  /** La part de la hauteur des vagues qu'on dessine (1 par défaut). Une
   *  porte de salle n'a que 10 px de marge intérieure : à pleine hauteur,
   *  un contour en retrait venait frôler son texte (banc, 22/11). */
  amplitude?: number
  /** « filet » (défaut) : un ruban d'eau court le long du contour. « bord » :
   *  pour un APLAT (le verbe PASSER / CONTINUER, plein au bleu du
   *  spécimen) — un ruban du même bleu y serait invisible : c'est le bord
   *  de l'aplat lui-même qui ondule, une bande de la couleur du fond le
   *  mordant en vagues (au plus `retrait` px), un reflet pâle sur sa
   *  nouvelle lisière. */
  mode?: 'filet' | 'bord'
  /** Un nœud de rive tous les `pas` px (PAS_RIVE par défaut) : un cran
   *  d'avis de 36 px n'aurait que 18 nœuds à 8 px — une onde en escalier. */
  pas?: number
  /** Le coin coupé de l'élément, en px (celui des cartes par défaut). */
  chanfrein?: number
  /** L'inclinaison au bord, en degrés (INCLINAISON par défaut). */
  inclinaison?: number
}

export interface OndeCarte {
  /** La carte est visée — au clavier, à la manette, ou au pointeur qui
   *  entre. Sans point d'entrée, la goutte tombe au milieu du bord haut. */
  vise(clientX?: number, clientY?: number): void
  /** Plus visée : elle se repose, l'eau du contour s'éteint. */
  quitte(): void
  /** Tout s'arrête et s'efface, sans un pas de plus (la carte élue, le
   *  tirage qui se referme). */
  arrete(): void
}

interface Etat {
  face: HTMLElement
  pli: HTMLElement
  toile: HTMLCanvasElement
  ctx: CanvasRenderingContext2D | null
  /** le contour au repos, taillé à la face au premier regard */
  noeuds: Noeud[]
  longueur: number
  l: number
  h: number
  dpr: number
  rive: Rive | null
  rx: Ressort
  ry: Ressort
  lev: Ressort
  gonfle: Ressort
  /** la présence de l'eau : 1 sous le focus, 0 au repos — la houle et le
   *  trait s'y mesurent, l'eau paraît et s'éteint sans claquer */
  presence: Ressort
  vise: boolean
  dernier: { x: number; y: number } | null
  /** LE CADRE de la face, relevé à la visée. Le relire à chaque
   *  pointermove forçait une mise en page (le pli venait de changer de
   *  transform) */
  cadre: DOMRect | null
  /** l'inclinaison au pas d'avant : sa variation chasse l'eau */
  avant: { rx: number; ry: number }
  /** l'écart et la largeur du ruban, nœud par nœud (les tampons du dessin) */
  ds: Float32Array
  larg: Float32Array
  /** le palier de reflet de chaque segment (0 : aucun) */
  lum: Uint8Array
  /** l'horloge de la houle, en secondes */
  temps: number
  arretee: boolean
  /** voir OptionsOnde ; `marge` : la toile au-delà de l'élément */
  retrait: number
  marge: number
  flotte: number
  flotteTenue: boolean
  perspective: number
  amplitude: number
  mode: 'filet' | 'bord'
  pas: number
  chanfrein: number
  inclinaison: number
  /** la couleur du fond derrière un aplat (mode « bord ») */
  fond: string
}

const actives = new Set<Etat>()
let boucle = 0
let horloge = 0
let reste = 0

function demarre(e: Etat): void {
  if (e.arretee) return
  actives.add(e)
  if (boucle) return
  horloge = performance.now()
  reste = 0
  boucle = requestAnimationFrame(image)
}

function image(t: number): void {
  // un onglet revenu au premier plan : on ne rattrape pas dix secondes
  reste = Math.min(reste + (t - horloge) / 1000, PAS_S * 3)
  horloge = t
  let pas = 0
  while (reste >= PAS_S) {
    reste -= PAS_S
    pas++
  }
  for (const e of [...actives]) {
    if (!e.pli.isConnected || e.arretee) {
      actives.delete(e)
      continue
    }
    // CACHÉ SOUS LA VISÉE : le verbe pressé disparaît sous le pointeur
    // (hidden), sans pointerleave — la houle aurait tourné à vide, image
    // après image, sur une toile que personne ne voit
    if (e.pli.getClientRects().length === 0) {
      e.vise = false
      repos(e)
      actives.delete(e)
      continue
    }
    if (avance(e, pas)) actives.delete(e)
  }
  boucle = actives.size ? requestAnimationFrame(image) : 0
}

/** Avance une carte de `n` pas et la dessine ; vrai quand elle s'est tue. */
function avance(e: Etat, n: number): boolean {
  // un écran à 120 Hz : une image sur deux n'avance aucun pas — rien n'a
  // bougé, on ne redessine pas
  if (n === 0) return false
  let crete = 0
  for (let i = 0; i < n; i++) {
    for (const r of [e.rx, e.ry, e.lev, e.gonfle, e.presence]) r.pas(PAS_S)
    e.temps += PAS_S
    if (e.rive) {
      // L'EAU SUIT LA CARTE : ce que l'inclinaison gagne en un pas, le
      // contour le prend en pente — l'eau s'amasse au bord qui descend et
      // reflue. C'est ce qui fait d'une carte qui penche un volume d'eau.
      const drx = e.rx.valeur - e.avant.rx
      const dry = e.ry.valeur - e.avant.ry
      if (drx || dry) e.rive.penche(e.noeuds, e.l, e.h, dry * 0.9, -drx * 0.9)
      const amorti = e.vise ? AMORTI : AMORTI_QUITTE
      for (let k = 0; k < SOUS_PAS; k++) crete = e.rive.pas(amorti)
    }
    e.avant.rx = e.rx.valeur
    e.avant.ry = e.ry.valeur
  }
  posePli(e)
  dessine(e)
  if (e.vise || !posee(e) || crete >= SEUIL_CALME) return false
  // tout s'est tu, et plus rien n'a le focus : la boucle lâche la carte
  repos(e)
  return true
}

/** Les ressorts ont rejoint leur cible et s'y tiennent. */
function posee(e: Etat): boolean {
  return (
    e.rx.pose() && e.ry.pose() && e.lev.pose(0.05) && e.gonfle.pose(0.0005) && e.presence.pose(0.01)
  )
}

/** Posée, et à plat : exactement l'état que la feuille de style dessine
 *  (`.mb-pli`, et `.mb-pli.mb-vise` pour la flottaison). */
function auRepos(e: Etat): boolean {
  return (
    posee(e) &&
    e.rx.cible === 0 &&
    e.ry.cible === 0 &&
    e.gonfle.cible === 0 &&
    (e.flotteTenue || e.lev.cible === 0)
  )
}

/** Le pli, à la valeur de ses ressorts — sauf au repos, où la feuille de
 *  style dit la même chose. */
function posePli(e: Etat): void {
  if (auRepos(e)) {
    e.pli.style.removeProperty('transform')
    return
  }
  const g = e.gonfle.valeur
  e.pli.style.transform =
    (e.perspective ? `perspective(${e.perspective}px) ` : '') +
    `translateY(${e.lev.valeur.toFixed(2)}px) rotateX(${e.rx.valeur.toFixed(2)}deg) ` +
    `rotateY(${e.ry.valeur.toFixed(2)}deg) scale(${(1 + g).toFixed(4)}, ${(1 - g * 0.6).toFixed(4)})`
}

/**
 * LE FILET D'EAU. Le contour, déplacé nœud par nœud par la rive et la
 * houle, se dessine en RUBAN : un trait d'eau au bleu du spécimen (le bleu
 * de l'eau, celui de tout choix qu'on prend), plus épais là où la vague
 * bombe — l'eau s'y amasse — et plus fin dans les creux. Par-dessus, des
 * REFLETS pâles, là où la pente de la vague fait face à la lumière (en haut
 * à gauche, comme le jeu) : ce sont eux qui font lire de l'eau plutôt qu'un
 * fil qui tremble. Un premier essai traçait un trait fin à la teinte de la
 * famille : au banc, un fil doré tremblé, rien qui rappelle l'eau. Aucun
 * halo : la charte ne fait rien luire.
 */
function dessine(e: Etat): void {
  const { ctx, rive, noeuds } = e
  if (!ctx || !rive) return
  const p = Math.max(0, Math.min(1, e.presence.valeur))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // n'efface que la BANDE du contour : l'intérieur de la toile reste vide
  // (rien ne s'y dessine), et l'effacer à chaque image coûtait sa surface
  const W = e.toile.width
  const Hh = e.toile.height
  const b = Math.min(Math.ceil((e.marge + e.retrait + ECART_MAX + 4) * e.dpr), Math.floor(Math.min(W, Hh) / 2))
  ctx.clearRect(0, 0, W, b)
  ctx.clearRect(0, Hh - b, W, b)
  ctx.clearRect(0, b, b, Hh - 2 * b)
  ctx.clearRect(W - b, b, b, Hh - 2 * b)
  if (p < 0.01) return
  const o = (e.marge + (e.mode === 'filet' ? e.retrait : 0)) * e.dpr
  ctx.setTransform(e.dpr, 0, 0, e.dpr, o, o)
  const n = noeuds.length
  // les tampons de l'image, gardés d'une image à l'autre
  if (e.ds.length !== n) {
    e.ds = new Float32Array(n)
    e.larg = new Float32Array(n)
    e.lum = new Uint8Array(n)
  }
  const ds = e.ds
  for (let i = 0; i < n; i++) ds[i] = (rive.ecart(i) + houle(noeuds[i].s, e.longueur, e.temps) * p) * e.amplitude
  if (e.mode === 'bord') {
    dessineBord(e, ctx, p)
    return
  }
  // LE RUBAN, tracé le long de sa ligne médiane — au repos il couvre les
  // deux premiers pixels de la carte, là où était le filet. Il était
  // REMPLI (deux bords décalés, pair-impair) : un rastériseur logiciel
  // balayait alors tout le rectangle de la carte pour un ruban de 2 px.
  // Des traits ne coûtent que le long du chemin
  const ext = (i: number, w: number): [number, number] => {
    const q = noeuds[i]
    const c = ds[i] - 1 + w / 2
    return [q.x + q.nx * c, q.y + q.ny * c]
  }
  const larg = e.larg
  for (let i = 0; i < n; i++) larg[i] = (1.3 + 1.1 * p + 0.8 * Math.max(0, ds[i])) * p
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = `rgba(99, 183, 230, ${(0.85 * p).toFixed(3)})`
  // le corps : tout le contour, d'un trait
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const [x, y] = ext(i, 0)
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.closePath()
  ctx.lineWidth = (1.3 + 1.1 * p) * p
  ctx.stroke()
  // les RENFLEMENTS : là où la vague bombe, l'eau s'amasse — deux paliers
  // d'épaisseur de plus, un trait chacun, sur les seuls segments concernés
  for (const [seuil, plus] of [[0.6, 0.8], [1.4, 1.6]] as const) {
    let trace = false
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const j = i === n - 1 ? 0 : i + 1
      if (ds[i] < seuil && ds[j] < seuil) continue
      const [x0, y0] = ext(i, 0)
      const [x1, y1] = ext(j, 0)
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      trace = true
    }
    if (!trace) continue
    ctx.lineWidth = (1.3 + 1.1 * p + plus) * p
    ctx.stroke()
  }
  // LES REFLETS, sur la crête du ruban, rangés en quatre paliers
  // d'intensité : un tracé par palier. Tracés segment par segment (un
  // stroke() chacun, ~375 par carte et par image), ils coûtaient le double
  // de l'ancien effet au banc, processeur bridé ×6 — le dessin, pas le calcul
  // la lumière de chaque segment, une fois : la pente de la vague le long
  // du contour, et le côté qu'elle tend à la lumière — sur le bord haut, la
  // vague qui monte vers la droite s'éclaire ; sur le bord bas, l'inverse.
  // Une pente se compte en dixièmes de pixel par nœud : le gain est fort
  const lum = e.lum
  for (let i = 0; i < n; i++) {
    const q = noeuds[i]
    const pente = ds[i === n - 1 ? 0 : i + 1] - ds[i === 0 ? n - 1 : i - 1]
    const face = q.nx * 0.78 - q.ny * 0.62
    const l = Math.max(0, Math.min(1, pente * Math.sign(face || 1) * 5 + Math.max(0, ds[i] - 0.4) * 0.5))
    lum[i] = Math.min(PALIERS, Math.ceil(l * PALIERS - 0.2))
  }
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  for (let palier = 1; palier <= PALIERS; palier++) {
    let trace = false
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      if (lum[i] !== palier) continue
      const j = i === n - 1 ? 0 : i + 1
      const [x0, y0] = ext(i, larg[i] * 0.5)
      const [x1, y1] = ext(j, larg[j] * 0.5)
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      trace = true
    }
    if (!trace) continue
    ctx.strokeStyle = `rgba(233, 246, 255, ${((palier / PALIERS) * 0.9 * p).toFixed(3)})`
    ctx.stroke()
  }
}

/**
 * LE BORD D'UN APLAT QUI ONDULE (mode « bord »). Une bande de la couleur
 * du fond mord l'aplat depuis son bord, d'une profondeur qui suit la vague
 * (de 0 à `retrait` px) : c'est la lisière de l'aplat qui se déplace, comme
 * le bord d'une flaque. Un reflet pâle court sur cette lisière là où la
 * vague fait face à la lumière.
 */
function dessineBord(e: Etat, ctx: CanvasRenderingContext2D, p: number): void {
  const { noeuds, ds, lum } = e
  const n = noeuds.length
  const r = e.retrait
  // la profondeur de la morsure, nœud par nœud : à mi-course au repos,
  // la vague la creuse ou la comble, jamais au-delà du retrait
  const pt = (i: number): [number, number] => {
    const q = noeuds[i]
    const c = -Math.max(0, Math.min(r, (r * 0.5 + ds[i]) * p))
    return [q.x + q.nx * c, q.y + q.ny * c]
  }
  ctx.beginPath()
  ctx.rect(-1, -1, e.l + 2, e.h + 2)
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i)
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = e.fond
  ctx.fill('evenodd')
  for (let i = 0; i < n; i++) {
    const q = noeuds[i]
    const pente = ds[i === n - 1 ? 0 : i + 1] - ds[i === 0 ? n - 1 : i - 1]
    const face = q.nx * 0.78 - q.ny * 0.62
    const l = Math.max(0, Math.min(1, -pente * Math.sign(face || 1) * 5 + 0.25))
    lum[i] = Math.min(PALIERS, Math.ceil(l * PALIERS - 0.2))
  }
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  for (let palier = 1; palier <= PALIERS; palier++) {
    let trace = false
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      if (lum[i] !== palier) continue
      const [x0, y0] = pt(i)
      const [x1, y1] = pt(i === n - 1 ? 0 : i + 1)
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      trace = true
    }
    if (!trace) continue
    ctx.strokeStyle = `rgba(233, 246, 255, ${((palier / PALIERS) * 0.85 * p).toFixed(3)})`
    ctx.stroke()
  }
}

/** Tout est posé : le pli rend la main à la feuille de style, la toile
 *  s'efface — la carte calme est exactement la carte d'avant l'effet. */
function repos(e: Etat): void {
  for (const r of [e.rx, e.ry, e.lev, e.gonfle, e.presence]) r.fige()
  e.pli.style.removeProperty('transform')
  e.pli.classList.remove('mb-liquide')
  e.ctx?.setTransform(1, 0, 0, 1, 0, 0)
  e.ctx?.clearRect(0, 0, e.toile.width, e.toile.height)
  e.rive?.aplanit()
}

/** Le contour et la toile, taillés à la face (au premier regard : la carte
 *  est posée). Mesurés en offsetWidth / offsetHeight (la mise en page), pas
 *  au rectangle de l'écran : la carte peut déjà pencher. */
function taille(e: Etat): void {
  const l = e.face.offsetWidth
  const h = e.face.offsetHeight
  if (!l || !h) return
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  if (e.rive && e.l === l && e.h === h && e.dpr === dpr) return
  e.l = l
  e.h = h
  e.dpr = dpr
  // en retrait, le coin coupé rétrécit avec le reste : un bord à 45°
  // reculé de r raccourcit chaque côté du coin de r·(√2 − 1)
  // (le mode « bord » suit le bord même de l'aplat : sa morsure est
  // dessinée vers l'intérieur)
  const r = e.mode === 'filet' ? e.retrait : 0
  e.noeuds = contourCarte(l - 2 * r, h - 2 * r, Math.max(0, e.chanfrein - r * (Math.SQRT2 - 1)), e.pas)
  e.longueur = longueurContour(e.noeuds)
  e.rive = new Rive(e.noeuds.length)
  e.toile.width = Math.round((l + e.marge * 2) * dpr)
  e.toile.height = Math.round((h + e.marge * 2) * dpr)
  e.ctx = e.toile.getContext('2d')
  // le fond derrière un aplat : l'encre de l'aplat, qui est celle du vide
  // (index.html, --mb-coque-noire : var(--void))
  if (e.mode === 'bord') e.fond = getComputedStyle(e.face).getPropertyValue('--mb-coque-noire').trim() || '#03070f'
}

/** Le nœud du contour le plus proche d'un point de l'écran, et sa distance
 *  (px de carte). */
function plusProche(e: Etat, x: number, y: number): { i: number; dist: number; u: number; v: number } {
  const r = e.cadre ?? e.face.getBoundingClientRect()
  const u = (x - r.left) / Math.max(1, r.width)
  const v = (y - r.top) / Math.max(1, r.height)
  const dedans = e.mode === 'filet' ? e.retrait : 0
  const px = u * e.l - dedans
  const py = v * e.h - dedans
  let i = 0
  let dist = Infinity
  for (let k = 0; k < e.noeuds.length; k++) {
    const d = Math.hypot(e.noeuds[k].x - px, e.noeuds[k].y - py)
    if (d < dist) {
      dist = d
      i = k
    }
  }
  return { i, dist, u, v }
}

/**
 * Donne à une carte son contour d'eau : `pli` reçoit la toile et les
 * ressorts, `face` est écoutée (un bouton sans pli : le même élément deux
 * fois, avec un `retrait`). `sansAnimation` est relu à chaque geste :
 * « moins d'animations » coupe tout, même en cours de partie.
 */
export function ondeCarte(
  face: HTMLElement,
  pli: HTMLElement,
  sansAnimation: () => boolean,
  options: OptionsOnde = {},
): OndeCarte {
  const retrait = Math.max(0, options.retrait ?? 0)
  const toile = document.createElement('canvas')
  // une toile sans taille : le contour ne la taille qu'au premier regard,
  // une carte jamais visée ne garde pas un tampon pour rien
  toile.width = 0
  toile.height = 0
  toile.className = retrait ? 'mb-rive mb-rive-dedans' : 'mb-rive'
  toile.setAttribute('aria-hidden', 'true')
  pli.append(toile)
  const e: Etat = {
    face,
    pli,
    toile,
    ctx: null,
    noeuds: [],
    longueur: 0,
    l: 0,
    h: 0,
    dpr: 1,
    rive: null,
    rx: new Ressort(0, 150, 13),
    ry: new Ressort(0, 150, 13),
    lev: new Ressort(0, 210, 16),
    // le gonflement est plus vif et moins amorti : la carte tremble deux
    // ou trois fois, comme une goutte posée, puis se tient
    gonfle: new Ressort(0, 420, 11),
    presence: new Ressort(0, 90, 19),
    vise: false,
    dernier: null,
    cadre: null,
    avant: { rx: 0, ry: 0 },
    ds: new Float32Array(0),
    larg: new Float32Array(0),
    lum: new Uint8Array(0),
    temps: 0,
    arretee: false,
    retrait,
    marge: retrait ? 0 : MARGE,
    flotte: options.flotte ?? FLOTTE,
    flotteTenue: options.flotteTenue ?? !retrait,
    perspective: options.perspective ?? 0,
    amplitude: options.amplitude ?? 1,
    mode: options.mode ?? 'filet',
    pas: options.pas ?? PAS_RIVE,
    chanfrein: options.chanfrein ?? CHANFREIN,
    inclinaison: options.inclinaison ?? INCLINAISON,
    fond: '#03070f',
  }

  const vise = (cx?: number, cy?: number): void => {
    // un bouton désactivé (une offre trop chère, la réserve pleine) se voit,
    // il ne se vise pas
    if (e.arretee || sansAnimation() || (face as HTMLButtonElement).disabled) return
    // un textContent posé sur l'élément (le verbe qui passe de PASSER à
    // CONTINUER) en retire la toile : elle revient à la visée
    if (toile.parentNode !== pli) pli.append(toile)
    taille(e)
    if (!e.rive) return
    const deja = e.vise
    e.vise = true
    e.lev.cible = e.flotte
    e.presence.cible = 1
    if (!deja) {
      // relevé carte encore au repos (ou presque) : le pointeur se lit
      // contre la carte posée, pas contre son ombre penchée
      e.cadre = e.face.getBoundingClientRect()
      // L'ENTRÉE : une goutte tombe sur le contour — là où le pointeur le
      // franchit, au milieu du bord haut sinon (le clavier, la manette) ;
      // elle part dans les deux sens et fait le tour de la carte. Et la
      // carte gonfle d'un coup, puis se tient
      const i =
        cx !== undefined && cy !== undefined
          ? plusProche(e, cx, cy).i
          : Math.round((e.l - 2 * (e.mode === 'filet' ? e.retrait : 0) - e.chanfrein) / 2 / e.pas)
      // la goutte garde sa largeur en PIXELS, bornée au quart du tour (sur
      // un cran de 36 px, 48 px de demi-largeur noyaient tout le contour)
      e.rive.goutte(i, Math.min(GOUTTE_PX, e.longueur / 8) / e.pas, -3.2)
      e.gonfle.vitesse += 0.32
      e.dernier = cx !== undefined && cy !== undefined ? { x: cx, y: cy } : null
      // le filet de la feuille s'efface : c'est l'eau qui le tient
      e.pli.classList.add('mb-liquide')
    }
    // le pli prend la main TOUT DE SUITE : la feuille de style pose déjà la
    // flottaison de `.mb-vise`, une image sans lui la montrerait sautée
    posePli(e)
    demarre(e)
  }

  const quitte = (): void => {
    if (!e.vise) return
    e.vise = false
    e.dernier = null
    e.cadre = null
    e.rx.cible = 0
    e.ry.cible = 0
    e.lev.cible = 0
    e.presence.cible = 0
    // le filet de la feuille revient (il transite) pendant que l'eau s'éteint
    e.pli.classList.remove('mb-liquide')
    posePli(e)
    demarre(e)
  }

  // LE POINTEUR : il incline la carte (une cible, que les ressorts
  // rejoignent — plus aucune valeur ne saute d'un événement à l'autre) ;
  // près d'un bord, il entraîne l'eau du contour à sa vitesse
  face.addEventListener('pointerenter', (ev) => vise(ev.clientX, ev.clientY))
  face.addEventListener('pointermove', (ev) => {
    if (e.arretee || sansAnimation()) return
    if (!e.vise) vise(ev.clientX, ev.clientY)
    if (!e.rive) return
    const p = plusProche(e, ev.clientX, ev.clientY)
    e.ry.cible = (Math.max(0, Math.min(1, p.u)) - 0.5) * 2 * e.inclinaison
    e.rx.cible = -(Math.max(0, Math.min(1, p.v)) - 0.5) * 2 * e.inclinaison
    const d = e.dernier
    e.dernier = { x: ev.clientX, y: ev.clientY }
    // à moins de 28 px d'un bord, le geste soulève l'eau : vers le bord, il
    // la pousse au-dehors ; en s'en éloignant, il la tire au-dedans. Borné :
    // un geste rageur ne fait pas déborder la rive
    if (d && p.dist < 28) {
      const q = e.noeuds[p.i]
      const vn = (ev.clientX - d.x) * q.nx + (ev.clientY - d.y) * q.ny
      const f = Math.max(-1.2, Math.min(1.2, vn * 0.12)) * (1 - p.dist / 28)
      if (f) e.rive.goutte(p.i, Math.min(SILLAGE_PX, e.longueur / 12) / e.pas, f)
    }
    demarre(e)
  })
  face.addEventListener('pointerleave', quitte)

  return {
    vise: (x, y) => vise(x, y),
    quitte,
    arrete: () => {
      e.arretee = true
      e.vise = false
      actives.delete(e)
      repos(e)
    },
  }
}
