// LA RÈGLE D'UN JEU DE L'ARÈNE — ce que la partie attend d'un mode.
//
// L'hôte (partie.ts) simule de l'eau ; il ne sait rien du hockey ni du sumo.
// Un mode, c'est une règle branchée dessus : elle dit où chacun commence,
// regarde la simulation après chaque pas, tient le score, et rend l'état du
// jeu tel qu'il part dans la trame. Ajouter un mode à l'arène, c'est écrire
// une règle — et lui dessiner son terrain.

import type { FluidSimMulti } from './solveurMulti'
import type { Commande, JeuTrame } from './trame'

/** Ce que rend un pas de la règle : rien, ou ce qui vient d'arriver.
 *  « engagement » : la partie remet chacun à sa place (une simulation neuve). */
export type Evenement = null | 'but' | 'engagement' | 'fini'

export interface Regle {
  /** Personne ne bouge (le décompte d'un engagement). */
  readonly gele: boolean
  /** Dans ce jeu on ne s'ouvre pas : les corps restent fermés. */
  readonly sansOuverture: boolean
  /** Où se tient le joueur j à l'engagement. */
  depart(j: number): { x: number; y: number }
  /** Prépare une simulation neuve : ses parois, ses réglages, son décompte. */
  engage(sim: FluidSimMulti): void
  /** Un match neuf : le score à zéro, puis l'engagement. */
  recommence(sim: FluidSimMulti): void
  /** Avant le pas du solveur. */
  avant(sim: FluidSimMulti): void
  /** Après le pas du solveur. */
  apres(sim: FluidSimMulti, commandes: readonly Commande[], dt: number): Evenement
  /** L'état du jeu, tel qu'il part dans la trame. */
  etat(sim: FluidSimMulti): JeuTrame
}
