// L'environnement d'apprentissage tient ses promesses : mêmes gestes, même
// traversée (sinon aucune courbe n'est comparable), fins conformes à
// main.ts, observation bornée.

import { describe, expect, it } from 'vitest'
import {
  ACTION_CONCLURE,
  ACTION_POUSSE_0,
  ACTION_RIEN,
  EnvSujet21,
  NB_ACTIONS,
  joue,
  reussie,
  tableauxRL,
} from './env'
import { piloteCap } from './pilotes'
import { alea } from './politique'

const PETIT = { particules: 200, dureeMax: 6, pasParDecision: 12 } as const

function suite(env: EnvSujet21, actions: number[]): number[] {
  env.reset()
  const trace: number[] = []
  for (const a of actions) {
    const p = env.step(a)
    trace.push(p.recompense)
    if (p.fini) break
  }
  return trace
}

describe('EnvSujet21 — le jeu sans écran', () => {
  it('est déterministe : deux essais identiques donnent le même récit', () => {
    const rnd = alea(7)
    const actions = Array.from({ length: 40 }, () =>
      Math.floor(rnd() * NB_ACTIONS),
    )
    const a = suite(new EnvSujet21({ code: '21-01', ...PETIT }), actions)
    const b = suite(new EnvSujet21({ code: '21-01', ...PETIT }), actions)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('reset remet vraiment le tableau à zéro', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const depart = env.etat()
    for (let i = 0; i < 10; i++) env.step(ACTION_POUSSE_0)
    env.reset()
    expect(env.etat()).toEqual(depart)
    expect(env.fin).toBe('en-cours')
  })

  it('observe : bonne taille, valeurs bornées, jamais NaN', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const o = env.observe()
    expect(o.length).toBe(env.tailleObs)
    for (const v of o) {
      expect(Number.isFinite(v)).toBe(true)
      expect(Math.abs(v)).toBeLessThanOrEqual(2)
    }
  })

  it('conclure ne s’offre qu’une fois le sas assez servi (bouton CONTINUER)', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    expect(env.aspireAssez()).toBe(false)
    const p = env.step(ACTION_CONCLURE)
    expect(p.fini).toBe(false) // refusé : le geste ne conclut rien
    expect(env.fin).toBe('en-cours')
  })

  it('le chrono épuisé finit l’essai sans rien créditer', () => {
    const env = new EnvSujet21({ code: '21-01', particules: 200, dureeMax: 1 })
    let p = env.step(ACTION_RIEN)
    while (!p.fini) p = env.step(ACTION_RIEN)
    expect(p.fin).toBe('temps')
    expect(env.score()).toBe(0)
  })

  it('un pilotage écrit à la main traverse Le berceau et livre son surplus', () => {
    const env = new EnvSujet21({ code: '21-01', particules: 450, dureeMax: 60 })
    const r = joue(env, () => piloteCap(40)(env))
    expect(reussie(r.fin)).toBe(true)
    expect(r.score).toBeGreaterThan(0.5)
  })

  it('ne propose que des tableaux jouables par l’environnement réduit', () => {
    const jouables = tableauxRL()
    expect(jouables.length).toBeGreaterThan(5)
    for (const l of jouables) {
      expect(l.lasers ?? []).toHaveLength(0)
      expect(l.zones ?? []).toHaveLength(0)
    }
  })
})
