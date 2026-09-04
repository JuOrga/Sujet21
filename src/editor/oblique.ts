// LES POIGNÉES D'UNE BOÎTE OBLIQUE — la géométrie, pure, sans canvas.
//
// Une boîte tournée se redimensionne dans SON repère : on tient une
// poignée, la poignée OPPOSÉE reste clouée au monde, et la boîte s'étire
// le long de ses propres axes. Quatre coins (les deux dimensions bougent)
// et, depuis la demande du concepteur (03/09), quatre MILIEUX DE CÔTÉ :
// tirer un côté n'étire qu'un axe — on allonge un mur incliné sans
// toucher à son épaisseur, comme pour une paroi droite.
//
// Ce fichier ne connaît ni l'éditeur ni l'écran : des points, des offsets,
// des degrés. C'est ce qui le rend testable au millimètre. La rotation
// elle-même vient de level.ts (versMondeBoite) : la convention d'angle
// n'est écrite qu'une fois, la même que la physique.

import { versMondeBoite } from '../game/level'

export interface BoiteOblique {
  minX: number
  minY: number
  maxX: number
  maxY: number
  angle?: number
}

/** Une poignée : son code, et sa position dans le repère local en
 *  fractions de demi-dimensions — x vers +x local (E), y vers +y local
 *  (N). Un coin a ses deux composantes ; un côté n'en a qu'une. */
export interface Poignee {
  code: string
  ux: number
  uy: number
}

export const COINS_OBLIQUES: readonly Poignee[] = [
  { code: 'NW', ux: -1, uy: 1 },
  { code: 'NE', ux: 1, uy: 1 },
  { code: 'SW', ux: -1, uy: -1 },
  { code: 'SE', ux: 1, uy: -1 },
]
export const COTES_OBLIQUES: readonly Poignee[] = [
  { code: 'N', ux: 0, uy: 1 },
  { code: 'S', ux: 0, uy: -1 },
  { code: 'W', ux: -1, uy: 0 },
  { code: 'E', ux: 1, uy: 0 },
]
export const POIGNEES_OBLIQUES: readonly Poignee[] = [...COINS_OBLIQUES, ...COTES_OBLIQUES]

export function estCote(p: Poignee): boolean {
  return p.ux === 0 || p.uy === 0
}

/** Un point du repère LOCAL (offsets depuis le centre, en unités monde)
 *  ramené dans le monde. */
export function pointOblique(b: BoiteOblique, ox: number, oy: number): { x: number; y: number } {
  return versMondeBoite(b, ox, oy)
}

/** Le point MONDE d'une poignée sur la boîte. */
export function pointPoignee(b: BoiteOblique, p: Poignee): { x: number; y: number } {
  const hx = (b.maxX - b.minX) / 2
  const hy = (b.maxY - b.minY) / 2
  return pointOblique(b, p.ux * hx, p.uy * hy)
}

/** Le PIVOT d'une poignée : le point opposé, celui qui ne bougera pas —
 *  le coin opposé pour un coin, le milieu du côté opposé pour un côté. */
export function pivotPoignee(b: BoiteOblique, p: Poignee): { x: number; y: number } {
  const hx = (b.maxX - b.minX) / 2
  const hy = (b.maxY - b.minY) / 2
  return pointOblique(b, -p.ux * hx, -p.uy * hy)
}

/** LA BOÎTE REDIMENSIONNÉE. `pivot` est cloué ; `pointeur` est où l'on
 *  tire ; `depart` donne les dimensions d'origine (celles que l'axe non
 *  tiré conserve) ; `minS` est la dimension minimale. Le résultat est la
 *  boîte axis-aligned centrée (min/max autour du centre), l'angle inchangé.
 *  Sur un coin, tirer au-delà du pivot RETOURNE la boîte (le signe suit le
 *  pointeur) ; sur un côté, seul l'axe tiré suit — l'autre garde sa mesure,
 *  centrée sur le pivot. */
export function redimensionneOblique(
  pivot: { x: number; y: number },
  angle: number,
  pointeur: { x: number; y: number },
  poignee: Poignee,
  depart: { w: number; h: number },
  minS: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const rad = (angle * Math.PI) / 180
  const co = Math.cos(rad)
  const si = Math.sin(rad)
  const dx = pointeur.x - pivot.x
  const dy = pointeur.y - pivot.y
  let du = dx * co + dy * si // le long de l'axe local x
  let dv = -dx * si + dy * co // le long de l'axe local y
  // un CÔTÉ ne tire qu'un axe : seul l'axe tiré se borne au minimum, l'autre
  // garde sa mesure, centré sur le pivot
  const tireU = poignee.ux !== 0
  const tireV = poignee.uy !== 0
  if (tireU && Math.abs(du) < minS) du = (du < 0 ? -1 : 1) * minS
  if (tireV && Math.abs(dv) < minS) dv = (dv < 0 ? -1 : 1) * minS
  const etendU = tireU ? du : depart.w
  const etendV = tireV ? dv : depart.h
  const decU = tireU ? du / 2 : 0
  const decV = tireV ? dv / 2 : 0
  const cx = pivot.x + co * decU - si * decV
  const cy = pivot.y + si * decU + co * decV
  const hx = Math.abs(etendU) / 2
  const hy = Math.abs(etendV) / 2
  return { minX: cx - hx, maxX: cx + hx, minY: cy - hy, maxY: cy + hy }
}
