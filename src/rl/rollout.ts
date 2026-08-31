// ---------------------------------------------------------------------------
// LA COLLECTE — faire jouer la politique et rapporter ce qui s'est passé.
//
// Plusieurs tableaux tournent en parallèle dans un même processus : on ne
// joue pas des parties entières, on avance de T décisions sur chacun, on
// rapporte, on apprend, on repart. Un épisode coupé au milieu n'est pas
// « fini » — c'est une TRONCATURE, et il faut le dire au calcul des
// avantages, sinon la politique apprend que le monde s'arrête toutes les
// 256 décisions.
// ---------------------------------------------------------------------------

import { EnvSujet21, reussie, type Fin } from './env'
import type { Reseau } from './reseau'
import { probabilites, tire } from './reseau'
import type { Transition } from './ppo'

export interface OptionsCollecte {
  codes: string[]
  particules: number
  duree: number
  pasParDecision: number
  /** Tableaux menés de front dans ce processus. */
  envs: number
}

export interface BilanEpisode {
  retour: number
  litres: number
  fin: Fin
  pas: number
}

export class Collecteur {
  readonly envs: EnvSujet21[] = []
  readonly finis: BilanEpisode[] = []
  private readonly enCours: { retour: number; pas: number }[] = []

  constructor(o: OptionsCollecte) {
    for (let i = 0; i < o.envs; i++) {
      this.envs.push(
        new EnvSujet21({
          code: o.codes[i % o.codes.length],
          particules: o.particules,
          dureeMax: o.duree,
          pasParDecision: o.pasParDecision,
        }),
      )
      this.enCours.push({ retour: 0, pas: 0 })
    }
  }

  get tailleObs(): number {
    return this.envs[0].tailleObs
  }

  /**
   * T décisions par tableau. `valeurFinale` sert au bootstrap de GAE : ce que
   * le critique pense de l'état où la collecte s'arrête.
   */
  collecte(
    politique: Reseau,
    valeur: Reseau,
    T: number,
    rnd: () => number,
    gamma: number,
  ): { transitions: Transition[]; valeurFinale: number[] } {
    const nbActions = politique.tailles[politique.tailles.length - 1]
    const probs = new Float64Array(nbActions)
    const transitions: Transition[] = []
    const valeurFinale: number[] = []
    for (let e = 0; e < this.envs.length; e++) {
      const env = this.envs[e]
      const suivi = this.enCours[e]
      for (let t = 0; t < T; t++) {
        const obs = Float32Array.from(env.observe())
        const logits = politique.avant(obs)
        probabilites(logits, probs)
        const action = tire(probs, rnd())
        const logp = Math.log(Math.max(probs[action], 1e-12))
        const v = valeur.avant(obs)[0]
        const pas = env.step(action)
        let recompense = pas.recompense
        let fini = pas.fini
        if (fini) {
          // TRONCATURE : le chrono de l'entraînement n'existe pas dans le jeu.
          // On créditre donc la suite au lieu de la nier — sans quoi la
          // politique apprendrait à redouter la 450e décision.
          if (pas.fin === 'temps') {
            recompense += gamma * valeur.avant(pas.obs)[0]
          }
          suivi.retour += recompense
          suivi.pas++
          this.finis.push({
            retour: suivi.retour,
            litres: env.score(),
            fin: pas.fin,
            pas: suivi.pas,
          })
          suivi.retour = 0
          suivi.pas = 0
          env.reset()
        } else {
          suivi.retour += recompense
          suivi.pas++
        }
        transitions.push({ obs, action, logp, valeur: v, recompense, fini })
      }
      valeurFinale.push(valeur.avant(env.observe())[0])
    }
    return { transitions, valeurFinale }
  }

  /** Les épisodes achevés depuis le dernier appel, puis remise à zéro. */
  ramasseBilans(): BilanEpisode[] {
    const out = this.finis.slice()
    this.finis.length = 0
    return out
  }
}

/** Résumé lisible d'une fournée d'épisodes. */
export function resume(bilans: BilanEpisode[]): {
  episodes: number
  retourMoyen: number
  litresMoyens: number
  litresMax: number
  traversees: number
  dispersions: number
} {
  if (bilans.length === 0) {
    return {
      episodes: 0,
      retourMoyen: 0,
      litresMoyens: 0,
      litresMax: 0,
      traversees: 0,
      dispersions: 0,
    }
  }
  let retour = 0
  let litres = 0
  let max = 0
  let traversees = 0
  let dispersions = 0
  for (const b of bilans) {
    retour += b.retour
    litres += b.litres
    if (b.litres > max) max = b.litres
    if (reussie(b.fin)) traversees++
    if (b.fin === 'disperse' || b.fin === 'perdu') dispersions++
  }
  return {
    episodes: bilans.length,
    retourMoyen: retour / bilans.length,
    litresMoyens: litres / bilans.length,
    litresMax: max,
    traversees,
    dispersions,
  }
}
