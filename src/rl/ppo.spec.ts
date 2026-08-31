// PPO tient en deux calculs : l'avantage (GAE) et le pas écrêté. Les deux
// sont vérifiables à la main sur des cas minuscules — c'est le seul moment
// où l'on peut encore les lire.

import { describe, expect, it } from 'vitest'
import { PPO_DEFAUT, avantagesGAE, majPPO, type Transition } from './ppo'
import { Adam, Reseau, parametres, probabilites } from './reseau'
import { alea } from './politique'

function tr(recompense: number, valeur = 0, fini = false): Transition {
  return {
    obs: Float32Array.from([1, 0]),
    action: 0,
    logp: Math.log(0.5),
    valeur,
    recompense,
    fini,
  }
}

describe('avantagesGAE', () => {
  it('sans escompte ni valeur, l’avantage est la somme des récompenses à venir', () => {
    const t = [tr(1), tr(2), tr(3)]
    const { avantages, retours } = avantagesGAE(t, 0, 1, 1)
    expect(Array.from(avantages)).toEqual([6, 5, 3])
    expect(Array.from(retours)).toEqual([6, 5, 3])
  })

  it('une fin coupe le futur : rien ne traverse la frontière', () => {
    const t = [tr(1), tr(2, 0, true), tr(3)]
    const { avantages } = avantagesGAE(t, 0, 1, 1)
    expect(Array.from(avantages)).toEqual([3, 2, 3])
  })

  it('la valeur finale sert de relais quand le lot coupe un épisode', () => {
    const { avantages } = avantagesGAE([tr(0)], 5, 1, 1)
    expect(avantages[0]).toBe(5) // 0 + V(s') − V(s)
  })

  it('le critique retranche ce qu’il attendait déjà', () => {
    const { avantages } = avantagesGAE([tr(1, 1)], 0, 1, 1)
    expect(avantages[0]).toBe(0) // récompense attendue : aucun mérite
  })
})

describe('majPPO — le pas d’apprentissage', () => {
  it('rend plus probable l’action qui valait mieux que la moyenne', () => {
    const rnd = alea(5)
    const politique = new Reseau([2, 8, 3], rnd)
    const valeur = new Reseau([2, 8, 1], rnd)
    const adamP = new Adam(parametres(politique), 0.02)
    const adamV = new Adam(parametres(valeur), 0.02)
    const obs = Float32Array.from([1, 0])
    const avant = probabilites(politique.avant(obs), new Float64Array(3))[0]

    // Un lot où l'action 0 est systématiquement la bonne, l'action 1 la mauvaise.
    const lot: Transition[] = []
    const av: number[] = []
    for (let i = 0; i < 64; i++) {
      const bonne = i % 2 === 0
      lot.push({
        obs,
        action: bonne ? 0 : 1,
        logp: Math.log(1 / 3),
        valeur: 0,
        recompense: bonne ? 1 : -1,
        fini: false,
      })
      av.push(bonne ? 1 : -1)
    }
    for (let passe = 0; passe < 20; passe++) {
      majPPO(
        politique,
        valeur,
        adamP,
        adamV,
        lot,
        Float64Array.from(av),
        Float64Array.from(av),
        { ...PPO_DEFAUT, epoques: 1, tailleLot: 64 },
        rnd,
      )
    }
    const apres = probabilites(politique.avant(obs), new Float64Array(3))[0]
    expect(apres).toBeGreaterThan(avant + 0.1)
  })

  it('le critique apprend la valeur qu’on lui montre', () => {
    const rnd = alea(6)
    const politique = new Reseau([2, 8, 3], rnd)
    const valeur = new Reseau([2, 8, 1], rnd)
    const adamP = new Adam(parametres(politique), 0.01)
    const adamV = new Adam(parametres(valeur), 0.05)
    const obs = Float32Array.from([1, 0])
    const lot = Array.from({ length: 32 }, () => tr(0))
    const cible = new Float64Array(32).fill(2.5)
    for (let i = 0; i < 200; i++) {
      majPPO(
        politique,
        valeur,
        adamP,
        adamV,
        lot,
        new Float64Array(32).fill(0.01),
        cible,
        { ...PPO_DEFAUT, epoques: 1, tailleLot: 32 },
        rnd,
      )
    }
    expect(valeur.avant(obs)[0]).toBeCloseTo(2.5, 1)
  })
})
