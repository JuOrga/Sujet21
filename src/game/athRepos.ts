// LE REPOS DE L'ATH : ce dont on ne se sert pas s'estompe.
//
// Les commandes et la capsule d'état ne servent que par moments ; le reste
// du temps elles pèsent sur l'image. En DISCRET, elles s'estompent après
// quelques secondes sans geste vers elles, et reviennent d'un coup. Le
// module vital, lui, ne passe jamais par ici : « le coût est sur la jauge »
// (docs/sujet-vivant.md) — la jauge se lit en continu.

import type { Rect } from './athZones'

export type ReglageAth = 'discret' | 'complet'
export const CLE_REGLAGE_ATH = 'sujet21-ath'
export const DELAI_REPOS_MS = 4000
export const RAYON_EVEIL_PX = 140

/** Le réglage mémorisé. Tout ce qui n'est pas « complet » vaut DISCRET :
 *  c'est le défaut, et une valeur abîmée ne doit pas figer l'interface. */
export function litReglageAth(brut: string | null): ReglageAth {
  return brut === 'complet' ? 'complet' : 'discret'
}

export function athAuRepos(e: {
  maintenant: number
  dernierGeste: number
  reglage: ReglageAth
  /** tiroir ouvert, pause, alerte : l'ATH doit rester lisible */
  force: boolean
}): boolean {
  if (e.reglage === 'complet' || e.force) return false
  return e.maintenant - e.dernierGeste >= DELAI_REPOS_MS
}

/** Le pointeur est-il à moins de `rayon` d'un des postes ? */
export function pointeurPres(
  x: number,
  y: number,
  postes: Rect[],
  rayon = RAYON_EVEIL_PX,
): boolean {
  for (const p of postes) {
    const dx = Math.max(p.left - x, 0, x - p.right)
    const dy = Math.max(p.top - y, 0, y - p.bottom)
    if (Math.hypot(dx, dy) <= rayon) return true
  }
  return false
}
