// LE MODULE EN 2D DE FACE — la coque du module autour de la salle, la
// mini-carte posée dedans (le croquis du concepteur, 01/10).
//
// Pourquoi de face : le décor bâti en perspective (claude/vaisseau-
// perspective) puis peint en perspective (claude/decor-peint) mêlait deux
// projections — la salle vue de face dans un décor qui fuyait — et figeait la
// mini-carte dans une image. Ici tout est dans le plan de la salle : le
// module est une grande coque, la salle jouée y est ENCASTRÉE à taille réelle,
// à sa place dans la grille, et les autres salles de la mini-carte sont de
// petites cellules autour d'elle :
//   · les RANGS avancent de gauche à droite, les VOIES sont les lignes (la
//     voie 0 en haut) — sur la ligne du haut, on voit le bord supérieur du
//     module au-dessus de la salle ; sur celle du bas, sa quille dessous ;
//   · une cellule dit son état : jouée (grise), joignable maintenant (ambre),
//     joignable plus loin (bleue), fermée par les choix (éteinte, croix) ;
//   · des tubes les relient comme les liens de la mini-carte, allumés sur le
//     chemin encore praticable.
// La silhouette n'est pas un rectangle : un pont surélevé au milieu, une
// salle des machines sous la fin du module (la forme « étagée »).
//
// Ce fichier est la MISE EN PAGE, pure et testée (module2d.spec.ts) : tout y
// est en pixels d'une toile, que render/module2dCanvas.ts peint avec les
// pièces de tools/images/coque2d.py, et que le moteur pose dans le monde.

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Ce que la mini-carte dit du module, réduit à ce que la coque montre. */
export interface VueModule2d {
  rangs: number
  voies: number
  /** la salle où l'on joue */
  rang: number
  voie: number
  /** les voies joignables au rang suivant, depuis (r, v) */
  suivants: (r: number, v: number) => readonly number[]
  /** la voie jouée à chaque rang déjà franchi (rangs 0 … rang − 1) */
  joues: readonly number[]
}

export type EtatCellule = 'joue' | 'ambre' | 'bleu' | 'ferme'
export type EtatTube = 'joue' | 'ambre' | 'bleu' | 'eteint'

/** Un sommet de la silhouette, et la pièce qui l'habille. */
export interface Sommet {
  x: number
  y: number
  /** coin saillant (coin-*) ou angle rentrant (rentrant-*, miroir : retourné) */
  piece: string
  miroir: boolean
}

export interface MiseEnPage {
  largeur: number
  hauteur: number
  /** pixels de toile par largeur de salle */
  densite: number
  /** la toile, dans le monde (y vers le HAUT) */
  monde: Rect
  /** la silhouette, dans le sens horaire À L'ÉCRAN (y vers le bas) */
  silhouette: Sommet[]
  /** le trou de la salle jouée, en pixels de toile */
  salle: Rect
  cellules: { x: number; y: number; l: number; h: number; etat: EtatCellule }[]
  tubes: { ax: number; ay: number; bx: number; by: number; etat: EtatTube }[]
  /** les éléments uniques posés sur la tôle : centre, largeur */
  elements: { nom: string; x: number; y: number; l: number }[]
  /** les équipements extérieurs posés sur un bord haut : pied, largeur relative */
  equipements: { nom: string; x: number; y: number }[]
  /** les deux colliers : l'entrée (bord gauche) et la sortie (bord droit) */
  colliers: { gauche: { x: number; y: number }; droite: { x: number; y: number } }
}

// LA GRILLE, en largeurs de salle (la maquette v2 du 01/10)
export const PAS_RANG = 1.35 // d'un rang à l'autre
export const PAS_VOIE = 1.3 // d'une voie à l'autre, en HAUTEURS de salle
export const CELLULE_L = 0.3 // une cellule : 30 % de la largeur de la salle jouée
export const TUBE = 0.05 // l'épaisseur d'un tube
// la coque autour de la grille
const MARGE_X = 0.15
const MARGE_Y = 0.35 // en hauteurs de salle
// la silhouette étagée, en fractions de la longueur / hauteur de la coque
const PONT = { de: 0.23, a: 0.71, haut: 0.23 }
const MACHINES = { de: 0.36, a: 0.82, bas: 0.21 }
// autour de la coque : les équipements dessus, les tuyères et colliers
const BORD_HAUT = 0.75
const BORD_BAS = 0.3
const BORD_COTES = 0.45

/** La densité de la toile : 360 px par largeur de salle — le zoom de jeu
 *  montre la salle à ~320 px —, ramenée pour que la toile tienne dans une
 *  texture de 4 000 px de côté. */
export const DENSITE = 360
export const TOILE_MAX = 4000

/** LA MINI-CARTE, en états : ce qu'on peut encore joindre depuis la salle
 *  jouée, de proche en proche, et le chemin déjà joué. */
export function etats(vue: VueModule2d): {
  cellule: (r: number, v: number) => EtatCellule | 'ici'
  tube: (r: number, v: number, w: number) => EtatTube
} {
  const joignable = new Set<string>([`${vue.rang}:${vue.voie}`])
  for (let r = vue.rang; r < vue.rangs - 1; r++)
    for (let v = 0; v < vue.voies; v++)
      if (joignable.has(`${r}:${v}`)) for (const w of vue.suivants(r, v)) joignable.add(`${r + 1}:${w}`)
  const chemin = [...vue.joues.slice(0, vue.rang), vue.voie]
  const joue = (r: number, v: number) => r <= vue.rang && chemin[r] === v
  return {
    cellule: (r, v) => {
      if (r === vue.rang && v === vue.voie) return 'ici'
      if (joue(r, v)) return 'joue'
      if (r > vue.rang && joignable.has(`${r}:${v}`)) return r === vue.rang + 1 ? 'ambre' : 'bleu'
      return 'ferme'
    },
    tube: (r, v, w) => {
      if (joue(r, v) && joue(r + 1, w)) return 'joue'
      if (r >= vue.rang && joignable.has(`${r}:${v}`) && joignable.has(`${r + 1}:${w}`))
        return r === vue.rang ? 'ambre' : 'bleu'
      return 'eteint'
    },
  }
}

const EQUIPEMENTS = ['mat', 'grand-solaire', 'reservoir', 'antenne', 'radiateur', 'petit-solaire']

/** METTRE EN PAGE le module autour de la salle (coque comprise). */
export function miseEnPage(salle: Rect, vue: VueModule2d): MiseEnPage {
  const R = salle.maxX - salle.minX
  const hr = (salle.maxY - salle.minY) / R
  const px = PAS_RANG
  const py = PAS_VOIE * hr
  // tout en largeurs de salle, l'origine au centre de la salle, y vers le bas
  const cel = (r: number, v: number) => [(r - vue.rang) * px, (v - vue.voie) * py] as const
  const xL = cel(0, 0)[0] - px / 2 - MARGE_X
  const xR = cel(vue.rangs - 1, 0)[0] + px / 2 + MARGE_X
  const yT = cel(0, 0)[1] - py / 2 - MARGE_Y * hr
  const yB = cel(0, vue.voies - 1)[1] + py / 2 + MARGE_Y * hr
  const Lm = xR - xL
  const Hm = yB - yT
  const d0 = xL + PONT.de * Lm
  const d1 = xL + PONT.a * Lm
  const dh = PONT.haut * Hm
  const e0 = xL + MACHINES.de * Lm
  const e1 = xL + MACHINES.a * Lm
  const eh = MACHINES.bas * Hm
  // la silhouette, sens horaire à l'écran — chaque sommet et sa pièce
  const s = (x: number, y: number, piece: string, miroir = false) => ({ x, y, piece, miroir })
  const poly = [
    s(xL, yT, 'coin-haut-gauche'),
    s(d0, yT, 'rentrant-haut'),
    s(d0, yT - dh, 'coin-haut-gauche'),
    s(d1, yT - dh, 'coin-haut-droit'),
    s(d1, yT, 'rentrant-haut', true),
    s(xR, yT, 'coin-haut-droit'),
    s(xR, yB, 'coin-bas-droit'),
    s(e1, yB, 'rentrant-bas', true),
    s(e1, yB + eh, 'coin-bas-droit'),
    s(e0, yB + eh, 'coin-bas-gauche'),
    s(e0, yB, 'rentrant-bas'),
    s(xL, yB, 'coin-bas-gauche'),
  ]
  // la toile : la silhouette et ses abords
  const bx0 = xL - BORD_COTES
  const bx1 = xR + BORD_COTES
  const by0 = yT - dh - BORD_HAUT
  const by1 = yB + eh + BORD_BAS
  const densite = Math.min(DENSITE, TOILE_MAX / (bx1 - bx0), TOILE_MAX / (by1 - by0))
  const X = (u: number) => (u - bx0) * densite
  const Y = (v: number) => (v - by0) * densite
  const cx = (salle.minX + salle.maxX) / 2
  const cy = (salle.minY + salle.maxY) / 2
  const e = etats(vue)
  const cellules: MiseEnPage['cellules'] = []
  const tubes: MiseEnPage['tubes'] = []
  for (let r = 0; r < vue.rangs; r++)
    for (let v = 0; v < vue.voies; v++) {
      const [u, w] = cel(r, v)
      const etat = e.cellule(r, v)
      if (etat !== 'ici')
        cellules.push({ x: X(u), y: Y(w), l: CELLULE_L * densite, h: (CELLULE_L / 1.5) * densite, etat })
      if (r === vue.rangs - 1) continue
      // le tube vers chaque suivant : à l'horizontale jusqu'à mi-chemin, à
      // la verticale jusqu'à sa voie, à l'horizontale jusqu'à lui
      for (const s2 of vue.suivants(r, v)) {
        const [u2, w2] = cel(r + 1, s2)
        const um = (u + u2) / 2
        const et = e.tube(r, v, s2)
        // à la salle jouée, le tube s'arrête à son bord : elle est à taille
        // réelle, pas une cellule
        const ua = etat === 'ici' ? 0.5 : u
        const ub = e.cellule(r + 1, s2) === 'ici' ? -0.5 : u2
        tubes.push({ ax: X(ua), ay: Y(w), bx: X(um), by: Y(w), etat: et })
        if (s2 !== v) tubes.push({ ax: X(um), ay: Y(w), bx: X(um), by: Y(w2), etat: et })
        tubes.push({ ax: X(um), ay: Y(w2), bx: X(ub), by: Y(w2), etat: et })
      }
    }
  // les éléments uniques : dans les vides ENTRE deux voies, sous un rang —
  // aucun tube n'y passe (ils courent sur les voies et à mi-chemin des
  // rangs) ; la machinerie aux deux bouts du module ; la grande baie sur le pont
  const elements: MiseEnPage['elements'] = []
  for (let r = 0; r < vue.rangs; r++)
    for (let v = 0; v + 1 < vue.voies; v++) {
      const [u, w] = cel(r, v + 0.5)
      const k = (r * 2 + v) % 5
      const bout = r === 0 || r === vue.rangs - 1
      const nom = bout && k % 2 === 1 ? 'machinerie' : k === 0 ? 'baie' : k === 3 ? 'trappe' : null
      if (nom) elements.push({ nom, x: X(u), y: Y(w), l: (nom === 'baie' ? 0.95 : nom === 'trappe' ? 0.5 : 0.8) * densite })
    }
  const lBaie = Math.min(2.4, (d1 - d0) * 0.8)
  elements.push({ nom: 'baie', x: X((d0 + d1) / 2), y: Y(yT - dh + 0.22 + (lBaie / 2.52) / 2 + 0.05), l: lBaie * densite })
  // les équipements, sur chaque bord haut, d'un bout à l'autre
  const equipements: MiseEnPage['equipements'] = []
  let n = 0
  for (const [a0, a1, y] of [[xL, d0, yT], [d0, d1, yT - dh], [d1, xR, yT]] as const) {
    const nb = Math.max(1, Math.floor((a1 - a0 - 0.6) / 1.3))
    for (let i = 0; i < nb; i++) equipements.push({ nom: EQUIPEMENTS[n++ % EQUIPEMENTS.length], x: X(a0 + ((i + 0.5) * (a1 - a0)) / nb), y: Y(y) })
  }
  const largeur = Math.ceil((bx1 - bx0) * densite)
  const hauteur = Math.ceil((by1 - by0) * densite)
  return {
    largeur,
    hauteur,
    densite,
    monde: { minX: cx + bx0 * R, maxX: cx + bx0 * R + (largeur / densite) * R, maxY: cy - by0 * R, minY: cy - by0 * R - (hauteur / densite) * R },
    silhouette: poly.map((p) => ({ ...p, x: X(p.x), y: Y(p.y) })),
    salle: { minX: X(-0.5), maxX: X(0.5), minY: Y(-hr / 2), maxY: Y(hr / 2) },
    cellules,
    tubes,
    elements,
    equipements,
    colliers: { gauche: { x: X(xL), y: Y((yT + yB) / 2) }, droite: { x: X(xR), y: Y((yT + yB) / 2) } },
  }
}

/** Une mini-carte d'attente, hors d'une run : six rangs, trois voies, chaque
 *  salle ouvrant sur ses voisines. */
export function vueGenerique(): VueModule2d {
  return { rangs: 6, voies: 3, rang: 1, voie: 1, joues: [1], suivants: (_r, v) => [v - 1, v, v + 1].filter((w) => w >= 0 && w < 3) }
}

/** Le centre d'une salle de la mini-carte, DANS LE MONDE, la salle jouée
 *  (coque comprise) posée à sa place — le jumeau de miseEnPage. */
export function centreCellule(salle: Rect, vue: VueModule2d, r: number, v: number): { x: number; y: number } {
  const R = salle.maxX - salle.minX
  const hr = (salle.maxY - salle.minY) / R
  return {
    x: (salle.minX + salle.maxX) / 2 + (r - vue.rang) * PAS_RANG * R,
    // la voie 0 en HAUT : y monde décroît quand la voie croît
    y: (salle.minY + salle.maxY) / 2 - (v - vue.voie) * PAS_VOIE * hr * R,
  }
}

// LA TRANSITION ENTRE DEUX SALLES (le croquis du concepteur) : la salle
// quittée rétrécit jusqu'à sa cellule, la vue glisse vers la droite, la
// cellule choisie grossit jusqu'à la taille de la salle, puis la salle
// apparaît — le plan d'ouverture habituel prend la suite.
export const TRANSITION = { retrecit: 0.55, glisse: 0.7, grossit: 0.8, revele: 0.35 }
export const DUREE_TRANSITION = TRANSITION.retrecit + TRANSITION.glisse + TRANSITION.grossit + TRANSITION.revele
// le module vu pendant la glissade : la salle y tient 20 % du plan large
// (à 30 %, le module ne se voyait presque pas autour des deux cellules)
const ZOOM_MODULE = 0.2

export interface ParamsTransition {
  /** la cellule de la salle quittée, dans le monde */
  de: { x: number; y: number }
  /** la nouvelle salle, coque comprise */
  salle: Rect
  /** le zoom du plan large sur la nouvelle salle (celui du plan d'ouverture) */
  zoomSalle: number
}

export interface EtatTransition {
  camera: { x: number; y: number; zoom: number }
  /** la cellule qui couvre la nouvelle salle : où, et à quel point elle la cache */
  couvre: Rect
  opacite: number
}

const doux = (t: number) => {
  const u = Math.min(1, Math.max(0, t))
  return u * u * (3 - 2 * u)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixLog = (a: number, b: number, t: number) => Math.exp(mix(Math.log(a), Math.log(b), t))

/** L'état de la transition à l'instant t (secondes depuis son début). */
export function etatTransition(t: number, p: ParamsTransition): EtatTransition {
  const { retrecit, glisse, grossit, revele } = TRANSITION
  const R = p.salle.maxX - p.salle.minX
  const a = { x: (p.salle.minX + p.salle.maxX) / 2, y: (p.salle.minY + p.salle.maxY) / 2 }
  // la cellule quittée remplit d'abord l'écran comme une salle
  const zDepart = p.zoomSalle / CELLULE_L
  const zModule = p.zoomSalle * ZOOM_MODULE
  const cl = CELLULE_L * R
  const cellule = { minX: a.x - cl / 2, maxX: a.x + cl / 2, minY: a.y - cl / 3, maxY: a.y + cl / 3 }
  const t1 = retrecit
  const t2 = t1 + glisse
  const t3 = t2 + grossit
  let camera: EtatTransition['camera']
  let couvre = cellule
  let opacite = 1
  if (t < t1) camera = { ...p.de, zoom: mixLog(zDepart, zModule, doux(t / retrecit)) }
  else if (t < t2) {
    const e = doux((t - t1) / glisse)
    camera = { x: mix(p.de.x, a.x, e), y: mix(p.de.y, a.y, e), zoom: zModule }
  } else if (t < t3) {
    const e = doux((t - t2) / grossit)
    camera = { ...a, zoom: mixLog(zModule, p.zoomSalle, e) }
    couvre = {
      minX: mix(cellule.minX, p.salle.minX, e),
      maxX: mix(cellule.maxX, p.salle.maxX, e),
      minY: mix(cellule.minY, p.salle.minY, e),
      maxY: mix(cellule.maxY, p.salle.maxY, e),
    }
  } else {
    camera = { ...a, zoom: p.zoomSalle }
    couvre = p.salle
    opacite = 1 - doux((t - t3) / revele)
  }
  return { camera, couvre, opacite }
}

/** Où se trouve une salle chargée : son module, son rang dans le module. */
export interface PositionSalle {
  module: string
  niveau: number
}

/** LA TRANSITION NE JOUE que vers la salle SUIVANTE du même module : pas à un
 *  nouvel essai (même rang), ni à l'entrée d'un module, ni après une halte
 *  (deux rangs d'un coup). Les deux positions sont celles des salles AU
 *  CHARGEMENT — le jeu compte la salle franchie dès le sas, avant la
 *  cérémonie : une position relevée pendant la cérémonie avait déjà avancé,
 *  et la transition ne jouait jamais (aperçu du 02/10). */
export function transitionPermise(avant: PositionSalle | null, apres: PositionSalle): boolean {
  return avant !== null && avant.module === apres.module && apres.niveau === avant.niveau + 1
}
