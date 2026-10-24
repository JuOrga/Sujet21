// LA COUPELLE — le péage en volume, réglé au trait (docs/coupelle.md).
//
// La règle tient en une phrase : elle boit tout le liquide qui y entre,
// jusqu'à son trait, puis se ferme. Le solveur fait boire (processCoupelles,
// solver.ts) ; ici vivent les règles pures — la conversion du trait en
// particules et la lecture des canaux — pour qu'on les teste sans moteur.

import { COUPELLE_SEUIL_MAX, COUPELLE_SEUIL_MIN, type CoupelleDef } from './level'
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
 *  pour de bon (le couvercle ne se rouvre pas). */
export function sourcesCoupelles(
  coupelles: readonly CoupelleDef[],
  pleines: readonly boolean[],
): SourceCanal[] {
  return coupelles.map((c, i) => ({ canal: c.canal, active: pleines[i] === true }))
}
