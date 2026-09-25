// LE VIDE ASPIRE. Un bloc « Vide (le dehors, à nu) » était un pur décor :
// le corps passait dessus comme sur le sol, « rien n'aspire ». Il devient
// un danger LENT : s'attarder au-dessus du dehors, c'est laisser la
// dépression s'installer. Au bout de VIDE_DELAI secondes, le vide PREND le
// corps — un courant en entonnoir l'emporte vers l'œil de la brèche et l'y
// avale goutte à goutte : la dispersion suit, et avec elle le game over.
//
// Ce module ne tient que la MINUTERIE (pure, testée) : combien de temps le
// corps s'est attardé, et à quel instant le vide le prend. Le courant
// lui-même est un champ du solveur (applyAspirationVide), comme le sas.

import { MAT_VIDE, type ObstacleBox } from './level'
import { dansForme } from './formes'

/** Secondes au-dessus du vide avant que la brèche ne prenne le corps. */
export const VIDE_DELAI = 3
/** Le compte redescend plus vite qu'il ne monte : ressortir à temps, c'est
 *  s'en tirer — repasser dessus aussitôt ne repart pas de zéro pour autant. */
export const VIDE_RECUP = 2
/** Durée de la montée du courant, une fois le corps pris : le liquide se
 *  sent tiré, puis emporté — pas escamoté d'un coup. */
export const VIDE_MONTEE = 1
/** Secondes pour que l'œil avale un corps plein (le débit s'en déduit). */
export const VIDE_ENGLOUTI = 2.2
/** Portée du courant autour de l'œil (unités monde) — le sas : 240. Le
 *  CORPS, lui, est emporté où qu'il soit (solveur). */
export const VIDE_PORTEE = 420
/** Vitesse du courant rentrant à pleine force (u/s) — le sas : 300. */
export const VIDE_COURANT = 420

export interface EtatVide {
  /** Secondes d'exposition accumulées (0 … VIDE_DELAI). */
  expo: number
  /** Le centre du corps est au-dessus du dehors, à ce pas. */
  dessus: boolean
  /** Le vide tient le corps : irréversible jusqu'à la remise à zéro. */
  prise: boolean
  /** Secondes écoulées depuis la prise (la montée du courant s'y lit). */
  depuis: number
  /** L'ŒIL de la brèche : là où était le corps quand il a été pris. Pas le
   *  centre du bloc — un ARC n'a pas son centre dedans, et une longue
   *  bande aspirerait le corps de travers sur toute sa longueur. */
  oeilX: number
  oeilY: number
}

export function nouvelEtatVide(): EtatVide {
  return { expo: 0, dessus: false, prise: false, depuis: 0, oeilX: 0, oeilY: 0 }
}

export function remiseVide(e: EtatVide): void {
  e.expo = 0
  e.dessus = false
  e.prise = false
  e.depuis = 0
  e.oeilX = 0
  e.oeilY = 0
}

/** Les blocs de vide d'un tableau — filtrés une fois par tableau, pas à
 *  chaque sous-pas. */
export function blocsVide(boxes: readonly ObstacleBox[]): ObstacleBox[] {
  return boxes.filter((b) => b.material === MAT_VIDE)
}

/** Le point (x, y) est-il au-dessus du dehors ? Toute forme, tout angle. */
export function audessusDuVide(vides: readonly ObstacleBox[], x: number, y: number): boolean {
  for (const b of vides) if (dansForme(b, x, y)) return true
  return false
}

/** Un pas de la minuterie. `dessus` : le centre du corps est au-dessus
 *  d'un vide. Rend vrai à l'instant PRÉCIS où le vide prend le corps. */
export function majVide(e: EtatVide, dessus: boolean, x: number, y: number, dt: number): boolean {
  e.dessus = dessus
  if (e.prise) {
    e.depuis += dt
    return false
  }
  if (!dessus) {
    e.expo = Math.max(0, e.expo - dt * VIDE_RECUP)
    return false
  }
  e.expo += dt
  if (e.expo < VIDE_DELAI) return false
  e.expo = VIDE_DELAI
  e.prise = true
  e.depuis = 0
  e.oeilX = x
  e.oeilY = y
  return true
}

/** Force du courant (0 … 1) : nulle avant la prise, montée en VIDE_MONTEE. */
export function forceVide(e: EtatVide): number {
  if (!e.prise) return 0
  return Math.min(1, e.depuis / VIDE_MONTEE)
}

/** La menace à l'écran (0 … 1) : combien la brèche est près de prendre.
 *  Nulle dès que le corps en est sorti — le compte qui redescend n'a plus
 *  rien à annoncer, une alerte qui s'attarde après la fuite ment. */
export function menaceVide(e: EtatVide): number {
  if (e.prise) return 1
  return e.dessus ? e.expo / VIDE_DELAI : 0
}
