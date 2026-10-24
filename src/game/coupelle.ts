// LA COUPELLE — le péage en volume, réglé au trait (docs/coupelle.md).
//
// La règle tient en une phrase : elle aspire le liquide et le boit, à débit
// borné, jusqu'à son trait. Le solveur fait aspirer et boire
// (processCoupelles, solver.ts) ; ici vivent les règles pures — le trait en
// particules, le champ d'aspiration, la lecture des canaux — pour qu'on les
// teste sans moteur.

import { COUPELLE_ASPIRATION_DEFAUT, COUPELLE_SEUIL_MAX, COUPELLE_SEUIL_MIN, type CoupelleDef } from './level'

// LE DÉBIT, en particules par seconde : ce qui rend l'aspiration VISIBLE.
// Sans borne, tout ce qui entrait dans la bouche disparaissait à l'image
// (la première version). Au-dessus du jet (ejectRate 32 /s) pour que le
// tir dans la coupelle ne déborde pas ; à 90, un trait de 10 % d'un corps
// de 900 particules se boit en une seconde — le temps de le voir couler.
export const COUPELLE_DEBIT = 90
// LE COURANT à pleine aspiration (u/s), du même ordre que celui du sas
// (exitPull 300, renforcé près de la bouche) : on le sent, sans être hâlé
// à travers la salle.
export const COUPELLE_COURANT = 420

/** L'aspiration bornée à 0..1 ; absente ou illisible : le défaut. */
export function bornerAspiration(a: number | undefined): number {
  if (a === undefined || !Number.isFinite(a)) return COUPELLE_ASPIRATION_DEFAUT
  return Math.min(1, Math.max(0, a))
}

/** LE CHAMP d'une coupelle : jusqu'où son courant porte et à quelle
 *  vitesse. À 0, il ne tire que dans la bouche, doucement — de quoi boire
 *  ce qui y entre ; à 1, il porte à trois rayons, à pleine vitesse. */
export function champCoupelle(r: number, aspiration: number | undefined): { portee: number; courant: number } {
  const a = bornerAspiration(aspiration)
  return { portee: r * (1 + 2 * a), courant: COUPELLE_COURANT * (0.25 + 0.75 * a) }
}
import type { SourceCanal } from './laser'

/** Le trait borné : un fichier écrit à la main ne fait ni une coupelle
 *  qu'une goutte remplit, ni une coupelle qui boit le corps entier. */
export function bornerSeuil(seuil: number): number {
  if (!Number.isFinite(seuil)) return COUPELLE_SEUIL_MIN
  return Math.min(COUPELLE_SEUIL_MAX, Math.max(COUPELLE_SEUIL_MIN, seuil))
}

/** Ce que la coupelle boit avant de se fermer, en PARTICULES : le trait
 *  appliqué à la masse de référence (le corps à l'entrée du tableau).
 *  Arrondi au-dessus et jamais nul — une coupelle doit coûter quelque
 *  chose, même au corps le plus maigre. */
export function capaciteCoupelle(seuil: number, reference: number): number {
  return Math.max(1, Math.ceil(bornerSeuil(seuil) * Math.max(0, reference)))
}

/** Les coupelles comme sources de canal : pleine, elle alimente son numéro
 *  pour de bon (une outre tendue ne se vide pas). */
export function sourcesCoupelles(
  coupelles: readonly CoupelleDef[],
  pleines: readonly boolean[],
): SourceCanal[] {
  return coupelles.map((c, i) => ({ canal: c.canal, active: pleines[i] === true }))
}
