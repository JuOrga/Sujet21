// LE SUMO — le deuxième jeu de l'arène, et le plus nu : un anneau, deux
// corps, on gagne la manche en poussant l'autre dehors.
//
// Il ne demande rien de neuf au solveur : le rebond de deux corps fermés,
// leur écrasement, le jet et le dash font tout le jeu. La règle n'ajoute que
// l'anneau, qui RÉTRÉCIT pendant la manche — sans cela deux joueurs prudents
// se tourneraient autour sans fin — et le compte des manches.
//
// On ne s'ouvre pas au sumo : deux corps ouverts fusionneraient, et il n'y
// aurait plus personne à pousser.

import { type FluidSimMulti } from './solveurMulti'
import { MODE_SUMO, PHASE_BUT, PHASE_DECOMPTE, PHASE_FINI, PHASE_JEU, type Bornes, type Commande, type JeuTrame } from './trame'
import type { Evenement, Regle } from './regle'

/** L'arène : de la hauteur de la patinoire (le même cadrage à l'écran),
 *  moins longue — on ne s'y poursuit pas, on s'y affronte. */
export const ARENE: Bornes = { minX: 0, minY: 0, maxX: 2160, maxY: 1220 }
/** Le rayon de l'anneau au début de la manche, puis à la fin : un corps de
 *  900 particules fait ~105 u de rayon — au début il y a la place de
 *  s'élancer, à la fin à peine celle de se tenir à deux. */
export const RAYON_ANNEAU = 520
export const RAYON_FINAL = 240
/** Le temps que met l'anneau à se resserrer (s). */
export const DUREE_MANCHE = 30
/** Le premier à ce nombre de manches gagne. */
export const MANCHES_POUR_GAGNER = 3
/** Chacun part à cette distance du centre, de son côté. */
const RECUL = 230
/** Le décompte avant chaque manche, et la pause après (s). */
const DECOMPTE = 2.1
const PAUSE = 1.4
/** Le délai de retour de la matière tirée, en part de celui du jeu : comme
 *  au hockey, on pousse sans cesse (voir hockey.ts). */
const DELAI_RETOUR = 0.5

export class Sumo implements Regle {
  readonly scores: [number, number] = [0, 0]
  phase: number = PHASE_DECOMPTE
  /** Le vainqueur de la dernière manche (−1 : personne, les deux sont sortis). */
  buteur = -1
  decompte = DECOMPTE
  /** Ce qui reste de la manche avant que l'anneau ait fini de se resserrer. */
  chrono = DUREE_MANCHE
  anneau = RAYON_ANNEAU
  private pause = 0
  /** Au sumo on reste FERMÉ. */
  readonly sansOuverture = true

  get gele(): boolean {
    return this.phase === PHASE_DECOMPTE
  }

  private get centre(): { x: number; y: number } {
    return { x: (ARENE.minX + ARENE.maxX) / 2, y: (ARENE.minY + ARENE.maxY) / 2 }
  }

  depart(j: number): { x: number; y: number } {
    const c = this.centre
    return { x: c.x + (j % 2 === 0 ? -RECUL : RECUL), y: c.y }
  }

  /** Une manche neuve : l'anneau à sa pleine taille, et le décompte. */
  engage(sim: FluidSimMulti): void {
    sim.rappelSansLimite = true
    sim.reabsorbFactor = DELAI_RETOUR
    sim.palet.actif = false
    this.phase = PHASE_DECOMPTE
    this.decompte = DECOMPTE
    this.chrono = DUREE_MANCHE
    this.anneau = RAYON_ANNEAU
  }

  recommence(sim: FluidSimMulti): void {
    this.scores[0] = 0
    this.scores[1] = 0
    this.buteur = -1
    this.engage(sim)
  }

  avant(): void {
    // rien à dire au solveur : il n'y a pas de palet
  }

  apres(sim: FluidSimMulti, _commandes: readonly Commande[], dt: number): Evenement {
    if (this.phase === PHASE_FINI) return null
    if (this.phase === PHASE_BUT) {
      this.pause -= dt
      return this.pause > 0 ? null : 'engagement'
    }
    if (this.phase === PHASE_DECOMPTE) {
      this.decompte -= dt
      if (this.decompte <= 0) {
        this.decompte = 0
        this.phase = PHASE_JEU
      }
      return null
    }
    // l'anneau se resserre, d'un pas égal, jusqu'à sa taille finale
    this.chrono = Math.max(0, this.chrono - dt)
    this.anneau = RAYON_FINAL + ((RAYON_ANNEAU - RAYON_FINAL) * this.chrono) / DUREE_MANCHE
    // qui est dehors ? Le CŒUR du corps a passé l'anneau — ou le corps n'en
    // est plus un (dispersé, vidé)
    const c = this.centre
    const dehors = sim.corps.map((corps) => {
      if (corps.dispersed || corps.playerCount < 12) return true
      return Math.hypot(corps.stats.centroidX - c.x, corps.stats.centroidY - c.y) > this.anneau
    })
    if (!dehors[0] && !dehors[1]) return null
    this.phase = PHASE_BUT
    this.pause = PAUSE
    if (dehors[0] && dehors[1]) {
      // les deux d'un coup : la manche est à rejouer, personne ne marque
      this.buteur = -1
      return 'but'
    }
    const vainqueur = dehors[0] ? 1 : 0
    this.scores[vainqueur]++
    this.buteur = vainqueur
    if (this.scores[vainqueur] >= MANCHES_POUR_GAGNER) {
      this.phase = PHASE_FINI
      return 'fini'
    }
    return 'but'
  }

  etat(): JeuTrame {
    return {
      mode: MODE_SUMO,
      paletActif: false,
      paletX: 0,
      paletY: 0,
      paletVx: 0,
      paletVy: 0,
      tenuPar: -1,
      charge: 0,
      scores: [this.scores[0], this.scores[1]],
      phase: this.phase,
      buteur: this.buteur,
      chrono: this.chrono,
      decompte: this.phase === PHASE_DECOMPTE ? this.decompte : 0,
      enOr: false,
      anneau: this.anneau,
    }
  }
}
