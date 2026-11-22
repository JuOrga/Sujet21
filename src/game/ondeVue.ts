// L'ONDE D'UNE CARTE, À L'ÉCRAN — la toile, le pointeur, la boucle.
//
// La physique est dans onde.ts. Ici :
//   — LA TOILE : une petite toile (une maille de ~6 px de carte par pixel),
//     posée SOUS le contenu de la face, étirée à sa taille par le
//     navigateur — le lissage bilinéaire fait l'eau douce, et le texte, au-
//     dessus, ne bouge pas d'un pixel : il reste lisible pendant tout
//     l'effet. Une déformation du texte (filtre feDisplacementMap) a été
//     écartée pour ça, et parce qu'un filtre SVG sur du HTML se repeint au
//     processeur à chaque image ;
//   — LE PLI : inclinaison, flottaison et gonflement suivent des ressorts
//     amortis, posés en `transform` inline — l'animation du retournement et
//     celle de l'élue l'emportent sur lui (une animation passe devant le
//     style inline) : il ne les gêne pas. Au repos, le transform inline
//     s'efface et la feuille de style reprend la main, à la même valeur ;
//   — LA BOUCLE : une seule pour toutes les cartes qui bougent, coupée dès
//     que tout s'est tu — aucune image n'est calculée pour une carte calme.
// Le pli reste un pli : rien ici ne pose d'opacité, de filtre ni de
// clip-path sur lui (index.html, « LE PLI porte la 3D ») ; la toile vit
// dans la FACE.

import { AMORTI, AMORTI_QUITTE, Nappe, Ressort, SEUIL_CALME, SOUS_PAS, SOUS_TEXTE } from './onde'

/** La taille d'une maille, en pixels de carte. À 6 px, une goutte fraîche
 *  sortait en escalier (trois mailles de rayon) ; à 4 px elle est ronde dès
 *  sa première image, pour ~9 000 mailles sur la plus grande carte
 *  (360 × 390) — onde.spec.ts mesure le coût d'une image. */
export const MAILLE_PX = 4

/** Le rayon de la goutte d'entrée et celui du sillage, en pixels de carte. */
const GOUTTE_PX = 22
const SILLAGE_PX = 14

/** L'inclinaison au bord de la carte, en degrés : la moitié de l'ancienne
 *  (9°), qui faisait plonger le coin opposé — la carte ne se tient plus à
 *  bout de bras, elle flotte. */
export const INCLINAISON = 5

/** La flottaison de la carte visée, en pixels (la feuille de style tient la
 *  même au repos : `.mb-pli.mb-vise`). */
export const FLOTTE = -6

const PAS_S = 1 / 60

export interface OndeCarte {
  /** La carte est visée — au clavier, à la manette, ou au pointeur qui
   *  entre. Sans point d'entrée, la goutte tombe au tiers haut. */
  vise(clientX?: number, clientY?: number): void
  /** Plus visée : elle se repose, la nappe s'éteint d'elle-même. */
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
  image: ImageData | null
  nappe: Nappe | null
  rx: Ressort
  ry: Ressort
  lev: Ressort
  gonfle: Ressort
  vise: boolean
  dernier: { x: number; y: number } | null
  /** LE CADRE de la face, relevé à la visée. Le relire à chaque
   *  pointermove forçait une mise en page (le pli venait de changer de
   *  transform) : la moitié du temps d'une image, processeur bridé ×6 */
  cadre: DOMRect | null
  /** l'inclinaison au pas d'avant : sa variation chasse l'eau */
  avant: { rx: number; ry: number }
  arretee: boolean
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
    if (avance(e, pas)) actives.delete(e)
  }
  boucle = actives.size ? requestAnimationFrame(image) : 0
}

/** Avance une carte de `n` pas et la peint ; vrai quand elle s'est tue. */
function avance(e: Etat, n: number): boolean {
  let crete = 0
  for (let i = 0; i < n; i++) {
    for (const r of [e.rx, e.ry, e.lev, e.gonfle]) r.pas(PAS_S)
    if (e.nappe) {
      // L'EAU SUIT LA CARTE : ce que l'inclinaison gagne en un pas, la
      // nappe le prend en pente — elle s'amasse au bord qui descend et
      // reflue. C'est ce qui fait d'une carte qui penche un volume d'eau.
      const drx = e.rx.valeur - e.avant.rx
      const dry = e.ry.valeur - e.avant.ry
      if (drx || dry) e.nappe.penche(dry * 0.05, -drx * 0.05)
      const amorti = e.vise ? AMORTI : AMORTI_QUITTE
      for (let k = 0; k < SOUS_PAS; k++) crete = e.nappe.pas(amorti)
    }
    e.avant.rx = e.rx.valeur
    e.avant.ry = e.ry.valeur
  }
  // un écran à 120 Hz : une image sur deux n'avance aucun pas — rien n'a
  // bougé, on ne repeint pas la même nappe
  if (n === 0) return false
  posePli(e)
  peinsEau(e, crete >= SEUIL_CALME)
  if (!posee(e) || crete >= SEUIL_CALME) return false
  // tout s'est tu : la boucle lâche la carte. Au repos (ni visée penchée, ni
  // élan), le pli rend la main à la feuille de style ; une carte qui reste
  // penchée sous un pointeur immobile garde son inclinaison, sans calcul
  if (auRepos(e)) repos(e)
  return true
}

/** Les ressorts ont rejoint leur cible et s'y tiennent. */
function posee(e: Etat): boolean {
  return e.rx.pose() && e.ry.pose() && e.lev.pose(0.05) && e.gonfle.pose(0.0005)
}

/** Posée, et à plat : exactement l'état que la feuille de style dessine
 *  (`.mb-pli`, et `.mb-pli.mb-vise` pour la flottaison). */
function auRepos(e: Etat): boolean {
  return posee(e) && e.rx.cible === 0 && e.ry.cible === 0 && e.gonfle.cible === 0
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
    `translateY(${e.lev.valeur.toFixed(2)}px) rotateX(${e.rx.valeur.toFixed(2)}deg) ` +
    `rotateY(${e.ry.valeur.toFixed(2)}deg) scale(${(1 + g).toFixed(4)}, ${(1 - g * 0.6).toFixed(4)})`
}

function peinsEau(e: Etat, eau: boolean): void {
  if (!e.ctx || !e.image || !e.nappe) return
  if (!eau) {
    e.ctx.clearRect(0, 0, e.toile.width, e.toile.height)
    return
  }
  e.nappe.ombre(e.image.data)
  e.ctx.putImageData(e.image, 0, 0)
}

/** Tout est posé : le pli rend la main à la feuille de style, la toile
 *  s'efface — la carte calme est exactement la carte d'avant l'effet. */
function repos(e: Etat): void {
  for (const r of [e.rx, e.ry, e.lev, e.gonfle]) r.fige()
  e.pli.style.removeProperty('transform')
  e.ctx?.clearRect(0, 0, e.toile.width, e.toile.height)
  e.nappe?.aplanit()
}

/** La nappe, taillée à la face (au premier regard : la carte est posée). */
function taille(e: Etat): void {
  const w = Math.max(3, Math.round(e.face.offsetWidth / MAILLE_PX))
  const h = Math.max(3, Math.round(e.face.offsetHeight / MAILLE_PX))
  if (e.nappe && e.nappe.w === w && e.nappe.h === h) return
  e.nappe = new Nappe(w, h)
  e.nappe.masque = masqueTexte(e.face, w, h)
  e.toile.width = w
  e.toile.height = h
  e.ctx = e.toile.getContext('2d')
  e.image = e.ctx ? e.ctx.createImageData(w, h) : null
}

/** Ce qui porte du TEXTE sur la face : le nom, la famille, la phrase, les
 *  leviers, la contrepartie, le prix. */
const TEXTES = '.crt-nom, .crt-rang, .crt-txt, .eff, .crt-ctr, .crt-perso, .crt-prix'

/** LE MASQUE DU TEXTE : sous chaque bloc de texte (élargi d'une marge), la
 *  nappe ne garde que SOUS_TEXTE de son éclat ; un flou d'une maille adoucit
 *  la lisière, que la marge absorbe — sous les lettres, le plafond tient.
 *  Les positions se lisent en offsetLeft / offsetTop (la mise en page), pas
 *  au rectangle de l'écran : la carte peut déjà pencher quand on la mesure. */
function masqueTexte(face: HTMLElement, w: number, h: number): Float32Array {
  const m = new Float32Array(w * h).fill(1)
  const marge = MAILLE_PX * 1.5
  for (const el of face.querySelectorAll<HTMLElement>(TEXTES)) {
    let x = 0
    let y = 0
    let n: HTMLElement | null = el
    while (n && n !== face) {
      x += n.offsetLeft
      y += n.offsetTop
      n = n.offsetParent as HTMLElement | null
    }
    if (n !== face || !el.offsetWidth) continue
    const i0 = Math.max(0, Math.floor((x - marge) / MAILLE_PX))
    const i1 = Math.min(w - 1, Math.ceil((x + el.offsetWidth + marge) / MAILLE_PX))
    const j0 = Math.max(0, Math.floor((y - marge) / MAILLE_PX))
    const j1 = Math.min(h - 1, Math.ceil((y + el.offsetHeight + marge) / MAILLE_PX))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) m[j * w + i] = SOUS_TEXTE
  }
  // le flou d'une maille : la lisière du masque ne se dessine pas en marche
  const f = new Float32Array(m)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let s = 0
      let c = 0
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di
          const jj = j + dj
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue
          s += m[jj * w + ii]
          c++
        }
      }
      f[j * w + i] = s / c
    }
  }
  return f
}

/** Un point de l'écran, en mailles de la nappe. */
function enMailles(e: Etat, x: number, y: number): { x: number; y: number; u: number; v: number } {
  const r = e.cadre ?? e.face.getBoundingClientRect()
  const u = (x - r.left) / Math.max(1, r.width)
  const v = (y - r.top) / Math.max(1, r.height)
  const n = e.nappe
  return { x: u * (n ? n.w - 1 : 0), y: v * (n ? n.h - 1 : 0), u, v }
}

/**
 * Donne à une carte son eau : `face` reçoit la toile (sous son contenu),
 * `pli` les ressorts. `sansAnimation` est relu à chaque geste : « moins
 * d'animations » coupe tout, même en cours de partie.
 */
export function ondeCarte(
  face: HTMLElement,
  pli: HTMLElement,
  sansAnimation: () => boolean,
): OndeCarte {
  const toile = document.createElement('canvas')
  // une toile sans taille : la nappe ne la taille qu'au premier regard,
  // une carte jamais visée ne garde pas un tampon de 300 × 150 pour rien
  toile.width = 0
  toile.height = 0
  toile.className = 'mb-onde'
  toile.setAttribute('aria-hidden', 'true')
  face.prepend(toile)
  const e: Etat = {
    face,
    pli,
    toile,
    ctx: null,
    image: null,
    nappe: null,
    rx: new Ressort(0, 150, 13),
    ry: new Ressort(0, 150, 13),
    lev: new Ressort(0, 210, 16),
    // le gonflement est plus vif et moins amorti : la carte tremble deux
    // ou trois fois, comme une goutte posée, puis se tient
    gonfle: new Ressort(0, 420, 11),
    vise: false,
    dernier: null,
    cadre: null,
    avant: { rx: 0, ry: 0 },
    arretee: false,
  }

  const vise = (cx?: number, cy?: number): void => {
    if (e.arretee || sansAnimation()) return
    taille(e)
    const deja = e.vise
    // relevé carte encore au repos (ou presque) : le pointeur se lit contre
    // la carte posée, pas contre son ombre penchée
    if (!deja) e.cadre = e.face.getBoundingClientRect()
    e.vise = true
    e.lev.cible = FLOTTE
    if (!deja) {
      // L'ENTRÉE : une goutte tombe dans la carte — là où le pointeur
      // entre, au tiers haut sinon (le clavier, la manette) — et la carte
      // gonfle d'un coup, puis se tient
      const p = cx !== undefined && cy !== undefined ? enMailles(e, cx, cy) : null
      const n = e.nappe!
      // le pointeur entre par un BORD : la goutte posée là n'y faisait qu'un
      // demi-anneau, aussitôt renvoyé. Elle tombe au tiers du chemin vers
      // le cœur de la carte — l'anneau se voit entier, et part du bon côté
      const cx0 = (n.w - 1) / 2
      const cy0 = (n.h - 1) * 0.36
      const x = p ? p.x + (cx0 - p.x) * 0.35 : cx0
      const y = p ? p.y + (cy0 - p.y) * 0.35 : cy0
      n.goutte(x, y, GOUTTE_PX / MAILLE_PX, p ? 1.1 : 1.4)
      e.gonfle.vitesse += 0.32
      e.dernier = p ? { x: cx!, y: cy! } : null
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
    posePli(e)
    demarre(e)
  }

  // LE POINTEUR : il incline la carte (une cible, que les ressorts
  // rejoignent — plus aucune valeur ne saute d'un événement à l'autre) et
  // laisse dans l'eau un sillage à sa vitesse
  face.addEventListener('pointerenter', (ev) => vise(ev.clientX, ev.clientY))
  face.addEventListener('pointermove', (ev) => {
    if (e.arretee || sansAnimation()) return
    if (!e.vise) vise(ev.clientX, ev.clientY)
    const n = e.nappe
    if (!n) return
    const p = enMailles(e, ev.clientX, ev.clientY)
    e.ry.cible = (Math.max(0, Math.min(1, p.u)) - 0.5) * 2 * INCLINAISON
    e.rx.cible = -(Math.max(0, Math.min(1, p.v)) - 0.5) * 2 * INCLINAISON
    const d = e.dernier
    e.dernier = { x: ev.clientX, y: ev.clientY }
    if (d) {
      const q = enMailles(e, d.x, d.y)
      const dist = Math.hypot(p.x - q.x, p.y - q.y)
      // une goutte par maille et demie parcourue ; la force suit la vitesse, bornée :
      // un geste rageur ne fait pas déborder la cuve
      const k = Math.min(10, Math.ceil(dist / 1.5))
      const f = Math.min(0.2, 0.04 + dist * 0.016)
      for (let i = 1; i <= k; i++) {
        const t = i / k
        n.goutte(q.x + (p.x - q.x) * t, q.y + (p.y - q.y) * t, SILLAGE_PX / MAILLE_PX, -f / Math.sqrt(k))
      }
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
