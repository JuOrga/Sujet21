// LA COQUE DE LA CUVE — sa géométrie et ce qui la perce, en clair et testable.
//
// La coque est une passe à part (drawHull, renderer.ts) : quatre bandes
// texturées posées PAR-DESSUS la composition. Deux conséquences qui ont
// motivé ce module :
//
// 1. LE VIDE NE LA PERÇAIT PAS. Un bloc « Vide (le dehors, à nu) » posé à
//    cheval sur la paroi se peignait dans la composition — donc DESSOUS la
//    coque, qui repassait intacte par-dessus : le trou s'arrêtait net au
//    bord de la cuve, et sa part au-dehors dessinait un cadre dans le vide.
//    La passe de coque reçoit donc désormais les vides qui la touchent, et
//    s'efface dedans (discard), tranche de la découpe comprise.
//
// 2. LE DEHORS ÉTAIT NU. Au-delà de la coque, rien que le ciel : une
//    station n'est pas un caisson lisse. Chaque bande s'étend donc d'une
//    FRANGE au-delà de la paroi, où le shader pose le matériel de coque
//    d'une station orbitale (antennes, paraboles, panneaux solaires,
//    radiateurs, feux de navigation, mains courantes d'EVA, blocs de
//    propulseurs, poutres en treillis) — du décor pur, sans physique.
//
// Le shader ne se teste pas ; ce qui décide de ce qu'il reçoit, si.

import type { Bounds } from '../sim/solver'
import { MAT_VIDE } from '../game/level'

/** Épaisseur de la coque, en unités monde. */
export const COQUE_EPAISSEUR = 90
/** La frange de décor extérieur, au-delà de la coque. Les plus hauts
 *  éléments (le mât d'antenne, feu compris) y tiennent avec de la marge. */
export const COQUE_FRANGE = 190
/** Longueur d'une répétition de la texture de coque (aspect 2,5:1). */
export const COQUE_REP = 225
/** Vides que la passe de coque sait découper — au-delà, les suivants ne
 *  percent plus la coque (ils restent peints dans la cuve). Un tableau en
 *  pose rarement plus de deux ou trois à cheval sur la paroi. */
export const MAX_VIDES_COQUE = 16

/** Flottants par sommet : position (2), le long / en travers (2), côté et
 *  longueur utile de la paroi (2). */
export const COQUE_FLOTTANTS = 6
/** 4 bandes × 2 triangles × 3 sommets. */
export const COQUE_SOMMETS = 24

// Les côtés, dans l'ordre où le shader les lit (vCote) : la normale
// sortante s'en déduit — 0 haut (+y), 1 bas (−y), 2 gauche (−x), 3 droite (+x).
export const COTE_HAUT = 0
export const COTE_BAS = 1
export const COTE_GAUCHE = 2
export const COTE_DROITE = 3

/** Remplit `out` avec les quatre bandes de coque ET leur frange extérieure.
 *  Chaque sommet porte (x, y, s, a, côté, longueur) : `s` court le long de
 *  la paroi depuis l'angle bas-gauche de la cuve, `a` monte du bord
 *  INTÉRIEUR (0, le tube lumineux) vers le dehors (épaisseur + frange).
 *  Les bandes horizontales débordent d'une épaisseur aux deux bouts et
 *  couvrent les angles, comme avant ; les verticales s'arrêtent à la cuve —
 *  les franges ne se chevauchent donc jamais. */
export function remplitBandesCoque(
  b: Bounds,
  out: Float32Array,
  epaisseur = COQUE_EPAISSEUR,
  frange = COQUE_FRANGE,
): number {
  const T = epaisseur
  const H = epaisseur + frange
  const lx = b.maxX - b.minX
  const ly = b.maxY - b.minY
  let o = 0
  const sommet = (x: number, y: number, s: number, a: number, cote: number, long: number) => {
    out[o++] = x
    out[o++] = y
    out[o++] = s
    out[o++] = a
    out[o++] = cote
    out[o++] = long
  }
  // deux triangles (p0 p1 p2) (p0 p2 p3) ; p0/p1 au bord intérieur
  const bande = (
    cote: number,
    long: number,
    s0: number,
    s1: number,
    pos: (s: number, a: number) => [number, number],
  ) => {
    const coins: [number, number][] = [
      [s0, 0],
      [s1, 0],
      [s1, H],
      [s0, 0],
      [s1, H],
      [s0, H],
    ]
    for (const [s, a] of coins) {
      const [x, y] = pos(s, a)
      sommet(x, y, s, a, cote, long)
    }
  }
  bande(COTE_HAUT, lx, -T, lx + T, (s, a) => [b.minX + s, b.maxY + a])
  bande(COTE_BAS, lx, -T, lx + T, (s, a) => [b.minX + s, b.minY - a])
  bande(COTE_GAUCHE, ly, 0, ly, (s, a) => [b.minX - a, b.minY + s])
  bande(COTE_DROITE, ly, 0, ly, (s, a) => [b.maxX + a, b.minY + s])
  return o / COQUE_FLOTTANTS
}

/** Retient, parmi les boîtes déjà empaquetées pour la composition
 *  (`boites` : minX, minY, maxX, maxY ; `aux` : code, angle, …, par pas de
 *  4), les VIDES qui touchent la coque ou sa frange — ceux qui doivent la
 *  percer. Un vide tout entier dans la cuve ne la touche pas : il n'occupe
 *  pas de case. Le test est conservateur (le cercle circonscrit, qui couvre
 *  toute rotation et toute forme) : un vide gardé à tort ne coûte qu'une
 *  itération, un vide oublié laisserait la coque intacte.
 *  Renvoie le nombre de vides écrits dans `outBoites` (4 par vide) et
 *  `outAux` (code, angle). */
export function videsPercantLaCoque(
  boites: ArrayLike<number>,
  aux: ArrayLike<number>,
  n: number,
  b: Bounds,
  outBoites: Float32Array,
  outAux: Float32Array,
  epaisseur = COQUE_EPAISSEUR,
  frange = COQUE_FRANGE,
): number {
  const ext = epaisseur + frange
  let k = 0
  for (let i = 0; i < n && k < MAX_VIDES_COQUE; i++) {
    const code = aux[i * 4]
    if (Math.round(code) % 16 !== MAT_VIDE) continue
    const x0 = boites[i * 4]
    const y0 = boites[i * 4 + 1]
    const x1 = boites[i * 4 + 2]
    const y1 = boites[i * 4 + 3]
    const cx = (x0 + x1) * 0.5
    const cy = (y0 + y1) * 0.5
    const r = Math.hypot(x1 - x0, y1 - y0) * 0.5
    // tout entier DANS la cuve : il ne touche pas la paroi
    const dedans =
      cx - r >= b.minX && cx + r <= b.maxX && cy - r >= b.minY && cy + r <= b.maxY
    // tout entier au-delà de la frange : rien à percer
    const loin =
      cx + r < b.minX - ext ||
      cx - r > b.maxX + ext ||
      cy + r < b.minY - ext ||
      cy - r > b.maxY + ext
    if (dedans || loin) continue
    outBoites[k * 4] = x0
    outBoites[k * 4 + 1] = y0
    outBoites[k * 4 + 2] = x1
    outBoites[k * 4 + 3] = y1
    outAux[k * 2] = code
    outAux[k * 2 + 1] = aux[i * 4 + 1]
    k++
  }
  return k
}
