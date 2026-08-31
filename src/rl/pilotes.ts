// ---------------------------------------------------------------------------
// LES PILOTES DE RÉFÉRENCE — des politiques ÉCRITES À LA MAIN, pas apprises.
//
// Sans elles, une courbe d'apprentissage ne veut rien dire : « 1,8 L livrés »
// est un bon ou un mauvais score selon ce qu'obtient déjà un pilotage naïf.
// Ces deux-là fixent le plancher — le hasard — et le premier palier — viser
// le sas et réguler sa vitesse. Une politique apprise qui ne les bat pas n'a
// rien appris.
// ---------------------------------------------------------------------------

import {
  ACTION_CONCLURE,
  ACTION_POUSSE_0,
  ACTION_RASSEMBLE,
  DIRECTIONS,
  NB_ACTIONS,
  type EnvSujet21,
} from './env'
import { alea } from './politique'

export type Pilote = (env: EnvSujet21) => number

/** Le plancher : n'importe quoi, à chaque décision. */
export function piloteHasard(graine = 1): Pilote {
  const rnd = alea(graine)
  return () => Math.floor(rnd() * NB_ACTIONS)
}

/**
 * Le cap : pousser vers le sas tant qu'on ne l'atteint pas à la vitesse
 * voulue, se rassembler le reste du temps, conclure dès que le sas a bu
 * assez. Attention au sens du geste : on VISE à l'opposé du sas, puisque le
 * corps part dans le dos de ce qu'il éjecte (§3.3).
 */
export function piloteCap(vitesse = 40): Pilote {
  return (env) => {
    if (env.aspireAssez()) return ACTION_CONCLURE
    const s = env.sim.stats
    const dx = env.sortie.x - s.centroidX
    const dy = env.sortie.y - s.centroidY
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d
    if (s.velX * ux + s.velY * uy >= vitesse) return ACTION_RASSEMBLE
    let a = Math.atan2(-uy, -ux)
    if (a < 0) a += Math.PI * 2
    const k = Math.round((a / (Math.PI * 2)) * DIRECTIONS) % DIRECTIONS
    return ACTION_POUSSE_0 + k
  }
}
