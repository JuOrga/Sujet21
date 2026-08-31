// L'agent qui joue à l'écran doit voir EXACTEMENT ce que voyait
// l'entraînement, et ne parler au jeu que par le geste du joueur.

import { describe, expect, it } from 'vitest'
import { TABLEAU_1 } from '../game/level'
import { AgentEnJeu, chargeAgent } from './agent'
import { Capteurs } from './capteurs'
import {
  ACTION_CONCLURE,
  ACTION_POUSSE_0,
  ACTION_RASSEMBLE,
  ACTION_RIEN,
  DIRECTIONS,
  EnvSujet21,
} from './env'
import { piloteCap } from './pilotes'

const PETIT = { particules: 200, dureeMax: 6, pasParDecision: 12 } as const

describe('Capteurs — le pont entre l’entraînement et l’écran', () => {
  it('rend la même observation à l’environnement et au jeu', () => {
    const env = new EnvSujet21({ code: '21-A', ...PETIT })
    for (let i = 0; i < 5; i++) env.step(ACTION_POUSSE_0 + 3)
    // Le jeu construit ses capteurs à part, depuis le même tableau étendu.
    const capteursDuJeu = new Capteurs(env.level, { dureeReference: env.dureeMax })
    const vuDuJeu = capteursDuJeu.lis(env.sim, env.temps)
    expect(Array.from(vuDuJeu)).toEqual(Array.from(env.observe()))
  })

  it('sent l’éponge comme un matériau à part (21-A en a un mur)', () => {
    const capteurs = new Capteurs(TABLEAU_1)
    // Un rayon tiré depuis la gauche du mur d'éponge doit finir par la voir.
    const materiaux = new Set<number>()
    const sonde = capteurs.lis(
      {
        params: { maxSpeed: 3000, kernelRadius: 30 },
        stats: { centroidX: 300, centroidY: -400, velX: 0, velY: 0, rmsRadius: 60 },
        baseVolume: 900,
        swallowed: 0,
        aliveCount: () => 900,
      } as unknown as Parameters<Capteurs['lis']>[0],
      0,
    )
    for (let i = 12; i < sonde.length; i += 2) materiaux.add(Math.round(sonde[i] * 10))
    expect(materiaux.has(11)).toBe(true) // MAT_EPONGE
  })
})

describe('chargeAgent — le suivi d’un entraînement en cours', () => {
  const fichier = {
    version: 2,
    type: 'mlp',
    enCours: true,
    tailleObs: 3,
    nbActions: 2,
    tailles: [3, 2],
    // Une seule couche 3→2 : W (2×3) puis b (2). L'écart de 30 rend le
    // tirage au sort certain en pratique — le test ne doit pas clignoter.
    poids: [30, 0, 0, 0, 0, 0, 0, 0], // « meilleure retenue » : l'action 0
    poidsCourants: [0, 0, 0, 30, 0, 0, 0, 0], // « à cet instant » : l'action 1
    journal: [{ generation: 12, litresMoyens: 0.4, traversees: 3 }],
  }
  const avecFetch = async <T>(f: () => Promise<T>): Promise<T> => {
    const vrai = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(fichier))) as typeof fetch
    try {
      return await f()
    } finally {
      globalThis.fetch = vrai
    }
  }

  it('prend la MEILLEURE politique par défaut', async () => {
    const charge = await avecFetch(() => chargeAgent('/agents/x.json'))
    expect(charge.decide!(Float32Array.from([1, 1, 1]))).toBe(0)
  })

  it('prend la politique DU MOMENT en suivi, et dit où en est l’entraînement', async () => {
    const charge = await avecFetch(() =>
      chargeAgent('/agents/x.json', { courant: true }),
    )
    expect(charge.decide!(Float32Array.from([1, 1, 1]))).toBe(1)
    expect(charge.progression).toEqual({
      iteration: 12,
      litresMoyens: 0.4,
      traversees: 3,
      enCours: true,
    })
  })
})

describe('AgentEnJeu — il ne parle au jeu que par le doigt', () => {
  function agentDe(action: number): AgentEnJeu {
    return new AgentEnJeu(
      { nom: 'essai', pilote: () => action },
      TABLEAU_1,
    )
  }
  const sim = (
    cx: number,
    cy: number,
    swallowed = 0,
  ): Parameters<AgentEnJeu['ordre']>[0] =>
    ({
      stats: { centroidX: cx, centroidY: cy },
      swallowed,
      baseVolume: 900,
    }) as unknown as Parameters<AgentEnJeu['ordre']>[0]

  it('« se rassembler » pose le doigt SUR le corps — le jeu y lit le rappel', () => {
    const o = agentDe(ACTION_RASSEMBLE).ordre(sim(120, -40), 0)
    expect(o.tient).toBe(true)
    expect(o.x).toBe(120)
    expect(o.y).toBe(-40)
    expect(o.conclure).toBe(false)
  })

  it('« pousser » vise à 900 unités dans la direction choisie', () => {
    const o = agentDe(ACTION_POUSSE_0 + DIRECTIONS / 2).ordre(sim(0, 0), 0)
    expect(o.tient).toBe(true)
    expect(o.x).toBeCloseTo(-900, 6) // demi-tour : plein ouest
    expect(o.y).toBeCloseTo(0, 6)
  })

  it('« attendre » lève le doigt, « conclure » appuie sur CONTINUER', () => {
    expect(agentDe(ACTION_RIEN).ordre(sim(0, 0), 0).tient).toBe(false)
    const c = agentDe(ACTION_CONCLURE).ordre(sim(0, 0, 300), 0)
    expect(c.conclure).toBe(true)
    expect(c.tient).toBe(false)
  })

  it('conclure trop tôt ne fait rien — le jeu ne doit pas retenir l’intention', () => {
    const o = agentDe(ACTION_CONCLURE).ordre(sim(0, 0, 0), 0)
    expect(o.conclure).toBe(false)
    expect(o.action).toBe(ACTION_RIEN)
  })

  it('ne décide qu’une fois par période : entre deux, le geste est TENU', () => {
    let appels = 0
    const agent = new AgentEnJeu(
      {
        nom: 'compteur',
        pilote: () => {
          appels++
          return ACTION_RASSEMBLE
        },
      },
      TABLEAU_1,
      0.1,
    )
    agent.ordre(sim(0, 0), 0)
    agent.ordre(sim(0, 0), 0.05)
    agent.ordre(sim(0, 0), 0.09)
    expect(appels).toBe(1)
    agent.ordre(sim(0, 0), 0.11)
    expect(appels).toBe(2)
    expect(agent.decisions).toBe(2)
  })

  it('remplace son cerveau à chaud sans perdre le fil', () => {
    const agent = agentDe(ACTION_RASSEMBLE)
    agent.ordre(sim(0, 0), 0)
    agent.remplace({ nom: 'suivant', pilote: () => ACTION_RIEN })
    const o = agent.ordre(sim(0, 0), 1)
    expect(o.tient).toBe(false)
    expect(agent.relectures).toBe(1)
    expect(agent.decisions).toBe(2) // le compteur de gestes ne repart pas de zéro
  })

  it('le pilote de référence tient dans le jeu comme à l’entraînement', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const pilote = piloteCap()
    const agent = new AgentEnJeu({ nom: 'cap', pilote }, env.level)
    const o = agent.ordre(env.sim, 0)
    // Au départ, loin du sas et à l'arrêt : il pousse (le doigt est posé).
    expect(o.tient).toBe(true)
    expect(o.action).toBeGreaterThanOrEqual(ACTION_POUSSE_0)
  })
})
