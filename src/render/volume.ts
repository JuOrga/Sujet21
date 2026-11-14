// LE CONTRAT DES HAUTEURS — chaque solide du tableau a une hauteur, vue de
// dessus comme un volume. Le module est pur : le shader, les ombres et le
// cuiseur de lumière le consomment par une table de hauteurs par boîte.
//
// POURQUOI des rangs et pas une saisie : le format des tableaux ne change
// pas et l'éditeur n'a rien de plus à demander. La matière dit ce qu'est
// l'élément (un mur se dresse, un rideau arrête le fluide sans se dresser),
// et la hauteur suit.
import { HAUTEUR_BLOCS } from './hauteurs'
import {
  FORME_COQUE,
  FORME_RECT,
  formeContact,
  formeOutline,
  type Coupe,
  type FormeBox,
  type FormeContact,
} from '../game/formes'
import {
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_MIROIR,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
} from '../game/level'

export type RangHauteur = 'haut' | 'moyen' | 'bas'

// Les codes `mat` du shader (renderer.ts : `solide = (mat < 2.5 || mat > 3.5)
// && mat < 10.5`). Le sas (3), le vide (11) et la baie (12) n'y figurent pas :
// ils ne sont pas solides, donc pas de hauteur.
//  - hauts : le mur neutre (et ses habillages, qui sont des murs) et le
//    surchauffeur, qui est un mur pour l'eau et la glace ;
//  - moyens : ce qui se dresse sans barrer le jeu comme une cloison —
//    hydrophile, hydrophobe, membrane, miroir, évent (la conception range
//    aussi les « grilles » en bas ; ce sont les évents : on suit la liste
//    nommée des moyens) et la chaudière, que la conception ne classe pas
//    (son relief est composé par pièces, elle ne se lit pas comme un sol) ;
//  - bas, jamais nuls : rideau et plaque froide. Un élément qui arrête le
//    fluide ne doit pas se lire comme un sol : il garde flanc, chanfrein et
//    ombre de contact.
export const RANG_DE_MATIERE: Record<number, RangHauteur> = {
  [MAT_WALL]: 'haut',
  [MAT_SURCHAUFFEUR]: 'haut',
  [MAT_HYDROPHILE]: 'moyen',
  [MAT_HYDROPHOBE]: 'moyen',
  [MAT_MEMBRANE]: 'moyen',
  [MAT_MIROIR]: 'moyen',
  [MAT_GRILLE]: 'moyen',
  [MAT_CHAUD]: 'moyen',
  [MAT_RIDEAU]: 'bas',
  [MAT_FROID]: 'bas',
}

// Unités du monde, comme HAUTEUR_BLOCS. Le haut vaut EXACTEMENT
// HAUTEUR_BLOCS (140, renderer.ts) : le cuiseur de lumière et les ombres de
// tous les tableaux sont réglés dessus, et un mur plus haut changerait
// l'éclairage de chaque salle existante. Moyen et bas en sont déduits, tous
// deux sous le haut pour que l'ombre d'un voisin plus haut tombe sur eux ;
// le bas reste franchement non nul (flanc lisible à l'écran).
export const HAUTEUR_DE_RANG: Record<RangHauteur, number> = {
  haut: HAUTEUR_BLOCS,
  moyen: 90,
  bas: 40,
}

const SKIN_VITRE = 9

const solide = (mat: number): boolean => RANG_DE_MATIERE[mat] !== undefined

/** La hauteur d'un solide isolé. 0 pour ce qui n'est pas solide (sas, vide,
 *  baie). Une coque est bornée à celle d'un mur haut : elle garde sa
 *  `HAUTEUR_COQUE` pour la lumière cuite, mais pour l'image son ombre
 *  noierait la salle. */
export function hauteurPropre(mat: number, forme: number, skin = 0): number {
  const rang = RANG_DE_MATIERE[mat]
  if (rang === undefined) return 0
  // la VITRE est un mur d'habillage 9 (level.ts) : la conception la veut
  // basse, elle arrête le fluide sans se dresser comme une cloison
  if (mat === MAT_WALL && skin === SKIN_VITRE) return HAUTEUR_DE_RANG.bas
  // la CONDUITE (plaque froide rectangulaire) et la CHAUDIÈRE rectangulaire
  // sont composées par pièces (aPieces, renderer.ts) : leur rendu ne change
  // pas, leur ombre cuite non plus — celle d'avant la table, à la hauteur
  // d'un mur, qu'elles touchent un mur ou non (décision de l'orchestrateur,
  // relecture R2). À forme, ce sont des solides comme les autres.
  if ((mat === MAT_FROID || mat === MAT_CHAUD) && forme === FORME_RECT) return HAUTEUR_DE_RANG.haut
  const h = HAUTEUR_DE_RANG[rang]
  return forme === FORME_COQUE ? Math.min(h, HAUTEUR_DE_RANG.haut) : h
}

export interface BoiteVolume {
  x0: number
  y0: number
  x1: number
  y1: number
  mat: number
  forme: number
  angle: number
  skin?: number // habillage d'une paroi neutre : 9 = vitre
  coupe?: Coupe // un demi-plan qui tronque la forme (formes.ts)
  // réglages de forme (coin, arc, coque) : sans eux, on lit la forme par
  // défaut — le contrat minimal reste celui de la fiche
  p0?: number
  p1?: number
  p2?: number
}

// Un pixel de jeu : deux solides posés bout à bout n'ont jamais un jour
// exact, à l'arrondi de la grille près.
const TOLERANCE = 1

const enForme = (b: BoiteVolume): FormeBox => ({
  minX: b.x0,
  minY: b.y0,
  maxX: b.x1,
  maxY: b.y1,
  angle: b.angle,
  forme: b.forme,
  p0: b.p0,
  p1: b.p1,
  p2: b.p2,
  coupe: b.coupe,
})

// Le rectangle orienté, en quatre sommets monde : sert au tri rapide (SAT).
function sommets(b: BoiteVolume): number[] {
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  const hx = (b.x1 - b.x0) / 2
  const hy = (b.y1 - b.y0) / 2
  const rad = ((b.angle || 0) * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const out: number[] = []
  for (const [lx, ly] of [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]) {
    out.push(cx + lx * c - ly * s, cy + lx * s + ly * c)
  }
  return out
}

// Deux rectangles orientés, élargis de la tolérance, se rencontrent-ils ?
// (séparation d'axes : les quatre normales de côté)
function rectanglesSeTouchent(a: number[], b: number[]): boolean {
  for (const p of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const ax = p[((i + 1) % 4) * 2 + 1] - p[i * 2 + 1]
      const ay = p[i * 2] - p[((i + 1) % 4) * 2]
      const n = Math.hypot(ax, ay) || 1
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity
      for (let k = 0; k < 4; k++) {
        const pa = (a[k * 2] * ax + a[k * 2 + 1] * ay) / n
        const pb = (b[k * 2] * ax + b[k * 2 + 1] * ay) / n
        minA = Math.min(minA, pa); maxA = Math.max(maxA, pa)
        minB = Math.min(minB, pb); maxB = Math.max(maxB, pb)
      }
      if (maxA < minB - TOLERANCE || maxB < minA - TOLERANCE) return false
    }
  }
  return true
}

const scratch: FormeContact = { dist: 0, nx: 0, ny: 1 }

// Le contour de `a`, rendu dense : un point tous les 2 unités au plus (le
// double de la tolérance), arêtes comprises. Les sommets seuls manquaient une
// barre qui traverse la paroi d'une coque (sommets dans le creux d'un côté,
// dehors de l'autre) ; et une grande ellipse à 64 points flèche de près d'une
// unité. Pour une forme coupée, on ne garde que ce qui reste de la forme.
const PAS_CONTOUR = 2 * TOLERANCE

// Calculé une fois par boîte (et non par paire) : c'est lui qui coûtait cher.
const contours = new WeakMap<FormeBox, { x: number; y: number }[]>()

function contourDense(a: FormeBox): { x: number; y: number }[] {
  const connu = contours.get(a)
  if (connu) return connu
  const perim = 2 * ((a.maxX - a.minX) + (a.maxY - a.minY))
  const brut = formeOutline(a, Math.min(8192, Math.max(48, Math.ceil(perim / PAS_CONTOUR))))
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < brut.length; i++) {
    const p = brut[i]
    const q = brut[(i + 1) % brut.length]
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / PAS_CONTOUR))
    for (let k = 0; k < n; k++) {
      out.push({ x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n })
    }
  }
  contours.set(a, out)
  return out
}

// Un point du contour de `a` est-il à moins de la tolérance de `b` ? (dedans,
// ou au bord) — la distance signée de formes.ts, pas une recodée.
// Toute forme est inscrite dans son rectangle (orienté) : un point hors de
// ce rectangle élargi de la tolérance ne peut pas toucher `b`, et ce tri, de
// quatre opérations, épargne la distance signée — chère pour une coque — à
// presque tout le contour. Mesuré sur le hub déployé (38 boîtes dont 17
// coques, le tableau réel le plus chargé en formes) : sans lui, 36 ms au
// premier appel puis 14 à 19 ms ; avec lui, 17 ms puis 3 à 11 ms — et
// l'appel se refait à chaque boîte déplacée dans l'éditeur. Exact : le pas
// d'échantillonnage, lui, ne bouge pas.
function contourProche(a: FormeBox, b: FormeBox): boolean {
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const hx = (b.maxX - b.minX) / 2 + TOLERANCE
  const hy = (b.maxY - b.minY) / 2 + TOLERANCE
  const rad = ((b.angle || 0) * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  for (const p of contourDense(a)) {
    const rx = p.x - cx
    const ry = p.y - cy
    if (Math.abs(rx * c + ry * s) > hx || Math.abs(-rx * s + ry * c) > hy) continue
    if (a.coupe) {
      formeContact(p.x, p.y, a, scratch)
      if (scratch.dist > TOLERANCE) continue
    }
    formeContact(p.x, p.y, b, scratch)
    if (scratch.dist <= TOLERANCE) return true
  }
  return false
}

function seTouchent(a: BoiteVolume, fa: FormeBox, b: BoiteVolume, fb: FormeBox): boolean {
  if (!rectanglesSeTouchent(sommets(a), sommets(b))) return false
  // deux rectangles (même tournés) : le tri rapide est exact
  if (!a.forme && !b.forme && !fa.coupe && !fb.coupe) return true
  // Une forme courbe ou une coque creuse : le rectangle englobant mentirait
  // (un bloc DANS une chambre n'est pas collé à sa coque). Le contour d'une
  // forme contre la distance signée de l'autre, dans les deux sens.
  return contourProche(fa, fb) || contourProche(fb, fa)
}

/** Les hauteurs de toutes les boîtes, une fois, au chargement du tableau :
 *  les solides qui se touchent ou se recouvrent forment un groupe, et le
 *  groupe prend la plus grande des hauteurs propres (une marche ne doit pas
 *  s'effondrer à mi-mur). Ce qui n'est pas solide vaut 0 et ne relie rien. */
export function hauteursPartagees(boites: ReadonlyArray<BoiteVolume>): Float32Array {
  const n = boites.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const racine = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const formes = boites.map(enForme)
  for (let i = 0; i < n; i++) {
    if (!solide(boites[i].mat)) continue
    for (let j = i + 1; j < n; j++) {
      if (!solide(boites[j].mat)) continue
      if (racine(i) === racine(j)) continue
      if (seTouchent(boites[i], formes[i], boites[j], formes[j])) {
        parent[racine(i)] = racine(j)
      }
    }
  }
  const maxi = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = racine(i)
    maxi[r] = Math.max(maxi[r], hauteurPropre(boites[i].mat, boites[i].forme, boites[i].skin))
  }
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = solide(boites[i].mat) ? maxi[racine(i)] : 0
  return out
}

/** La direction VERS la lumière quand le réglage « Lumière » est éteint
 *  (`lampeDir` du shader de composition) : du haut de l'écran, comme le soleil
 *  de l'atelier peint dans les surfaces. Sans elle le volume s'éteindrait en
 *  noir avec la lumière. Unitaire.
 *  Le repère est celui du SHADER, y vers le HAUT (`world` y est tiré de
 *  gl_FragCoord) : [0, -1], écrit d'abord pour un repère y vers le bas,
 *  faisait tomber la lumière du bas de l'écran — à rebours des rivets et des
 *  tôles déjà éclairés d'en haut dans les images. */
export const LUMIERE_PAR_DEFAUT: readonly [number, number] = [0, 1]

/** L'ombre courte de lisibilité : la longueur au sol par unité de hauteur.
 *  Courte devant l'ombre LONGUE des lampes (la carte cuite), mais assez pour
 *  se lire au cadrage normal : à 0,25 (35 u pour un mur haut), la relecture
 *  du 14/11 ne distinguait plus l'avant de l'après en 1280 × 720. Un mur
 *  haut (140) jette 56 u ; le rejet grossier de la composition est élargi à
 *  OMBRE_COURTE + OMBRE_COURTE_FLOU, sinon elle serait coupée net. */
export const OMBRE_COURTE_PAR_HAUTEUR = 0.4

/** Le fondu du bout de l'ombre courte, en unités monde. */
export const FLOU_OMBRE_COURTE = 12

/** La longueur de l'ombre courte d'un solide de hauteur `h`. */
export function longueurOmbreCourte(h: number): number {
  return Math.max(0, h) * OMBRE_COURTE_PAR_HAUTEUR
}

/** L'ombre courte d'un solide de hauteur `hSource` sur la surface qui la
 *  reçoit, à la hauteur `hRecoit` : le sol (0), ou le TOIT d'un voisin plus
 *  bas. Le rayon rasant qui frôle l'arête du haut touche ce toit plus tôt
 *  que le sol : l'ombre ne s'y couche que sur ce qui le dépasse. Elle ne
 *  monte pas : un toit aussi haut ou plus haut que la source n'en reçoit
 *  rien. C'est la règle que la composition suit, boîte par boîte, pour
 *  qu'un dessus bas reçoive l'ombre d'un voisin plus haut — lumière
 *  éteinte comme allumée. */
export function longueurOmbreSur(hSource: number, hRecoit: number): number {
  return longueurOmbreCourte(hSource - hRecoit)
}

/** La direction VERS la lumière vue du centre de la cuve : la moyenne des
 *  lampes (x, y, z, rayon par lampe dans `lampes`), pondérée par leur
 *  intensité. Le shader de la coque ne lit pas les lampes une à une : sa
 *  paroi entoure toute la salle, une direction pour toute la salle suffit
 *  à mettre son chanfrein clair du côté où la lumière est. Sans lampe (ou
 *  des lampes qui s'annulent), la direction par défaut. Unitaire. */
export function directionLumiereMoyenne(
  cx: number,
  cy: number,
  lampes: ArrayLike<number>,
  intensites: ArrayLike<number>,
  n: number,
): readonly [number, number] {
  let ax = 0
  let ay = 0
  for (let i = 0; i < n; i++) {
    const dx = lampes[i * 4] - cx
    const dy = lampes[i * 4 + 1] - cy
    const l = Math.hypot(dx, dy)
    if (l < 1e-3) continue // une lampe au centre n'a pas de côté
    ax += (dx / l) * intensites[i]
    ay += (dy / l) * intensites[i]
  }
  const a = Math.hypot(ax, ay)
  return a > 1e-5 ? [ax / a, ay / a] : LUMIERE_PAR_DEFAUT
}
