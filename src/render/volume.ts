// LE CONTRAT DES HAUTEURS — chaque solide du tableau a une hauteur, vue de
// dessus comme un volume. Le module est pur : le shader, les ombres et le
// cuiseur de lumière le consomment par une table de hauteurs par boîte.
//
// POURQUOI des rangs et pas une saisie : le format des tableaux ne change
// pas et l'éditeur n'a rien de plus à demander. La matière dit ce qu'est
// l'élément (un mur se dresse, un rideau arrête le fluide sans se dresser),
// et la hauteur suit.
import {
  FORME_COQUE,
  formeContact,
  formeOutline,
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
  haut: 140,
  moyen: 90,
  bas: 40,
}

const solide = (mat: number): boolean => RANG_DE_MATIERE[mat] !== undefined

/** La hauteur d'un solide isolé. 0 pour ce qui n'est pas solide (sas, vide,
 *  baie). Une coque est bornée à celle d'un mur haut : elle garde sa
 *  `HAUTEUR_COQUE` pour la lumière cuite, mais pour l'image son ombre
 *  noierait la salle. */
export function hauteurPropre(mat: number, forme: number): number {
  const rang = RANG_DE_MATIERE[mat]
  if (rang === undefined) return 0
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

// Un point du contour de `a` est-il à moins de la tolérance de `b` ? (dedans,
// ou au bord) — la distance signée de formes.ts, pas une recodée.
function contourProche(a: FormeBox, b: FormeBox): boolean {
  for (const p of formeOutline(a, 64)) {
    formeContact(p.x, p.y, b, scratch)
    if (scratch.dist <= TOLERANCE) return true
  }
  return false
}

function seTouchent(a: BoiteVolume, fa: FormeBox, b: BoiteVolume, fb: FormeBox): boolean {
  if (!rectanglesSeTouchent(sommets(a), sommets(b))) return false
  // deux rectangles (même tournés) : le tri rapide est exact
  if (!a.forme && !b.forme) return true
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
    maxi[r] = Math.max(maxi[r], hauteurPropre(boites[i].mat, boites[i].forme))
  }
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = solide(boites[i].mat) ? maxi[racine(i)] : 0
  return out
}

/** La direction (monde, y vers le bas) d'où vient la lumière quand le réglage
 *  « Lumière » est éteint : du haut de l'écran. Sans elle le volume
 *  s'éteindrait en noir avec la lumière. Unitaire. */
export const LUMIERE_PAR_DEFAUT: readonly [number, number] = [0, -1]
