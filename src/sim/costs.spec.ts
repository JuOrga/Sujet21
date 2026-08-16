import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { MAT_GRILLE } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  return new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) sim.step(dt)
}

function gasify(sim: FluidSim): void {
  for (let i = 0; i < sim.count; i++) {
    sim.vapor[i] = 1
    sim.gaseous[i] = 1
  }
}

describe('Les coûts de la vapeur — pas un passe-partout', () => {
  it('être vapeur s’évapore en continu, même immobile (coût d’état)', () => {
    const sim = makeSim({ gasIdleLossRate: 5, gasExpand: 0, gasTurb: 0 })
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    gasify(sim)
    sim.gasIntent = true // l'état est maintenu : c'est lui qu'on mesure
    sim.updatePlayerStats()
    run(sim, 3)
    expect(sim.playerCount).toBeLessThan(55) // ~15 perdues à 5/s
    expect(sim.playerCount).toBeGreaterThan(35)
  })

  it('coût d’état coupé : le nuage immobile ne perd rien', () => {
    const sim = makeSim({ gasIdleLossRate: 0, gasExpand: 0, gasTurb: 0, grilleGasLoss: 0 })
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    gasify(sim)
    sim.gasIntent = true
    sim.updatePlayerStats()
    run(sim, 2)
    expect(sim.playerCount).toBe(60)
  })

  it('la maille d’une grille essore le nuage qui la traverse (péage)', () => {
    const sim = makeSim({ gasIdleLossRate: 0, gasExpand: 0, gasTurb: 0, gasDrag: 0, grilleGasLoss: 1.5 })
    sim.setLevel([{ minX: 0, minY: -500, maxX: 60, maxY: 500, material: MAT_GRILLE }], [])
    // un rideau de vapeur lancé vers la grille, gouttes espacées
    for (let k = 0; k < 20; k++) {
      const i = sim.addParticle(-80, -290 + k * 30, KIND_PLAYER)
      sim.vapor[i] = 1
      sim.gaseous[i] = 1
      sim.velX[i] = 180
    }
    sim.gasIntent = true // la vapeur est maintenue le temps de la traversée
    sim.updatePlayerStats()
    const before = sim.count
    run(sim, 2) // traversée (~0,33 s dans la maille chacune)
    expect(sim.count).toBeLessThan(before) // le péage a prélevé
    expect(sim.count).toBeGreaterThan(4) // mais le nuage passe
  })

  it('le mordant global durcit l’éponge : absorption plus rapide', () => {
    const sponge = { minX: -50, minY: -50, cols: 4, rows: 4, cellSize: 25, capacityPerCell: 5 }
    const soft = makeSim({ surfaceBite: 1 })
    soft.setLevel([], [sponge])
    soft.addParticle(0, 0, KIND_PLAYER)
    run(soft, DEFAULT_PARAMS.spongeAbsorbTime * 0.7)
    expect(soft.count).toBe(1) // pas encore absorbée au mordant nominal

    const hard = makeSim({ surfaceBite: 2.5 })
    hard.setLevel([], [sponge])
    hard.addParticle(0, 0, KIND_PLAYER)
    run(hard, DEFAULT_PARAMS.spongeAbsorbTime * 0.7)
    expect(hard.count).toBe(0) // absorbée : le seuil est divisé par le mordant
  })
})

describe('La goutte d’éjection — perdue seulement si elle SORT vraiment', () => {
  const arme = (ejectSpeed: number): FluidSim => {
    const sim = new FluidSim(
      { ...DEFAULT_PARAMS, ejectSpeed },
      { minX: -5000, minY: -3000, maxX: 5000, maxY: 3000 },
    )
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 90, KIND_PLAYER)
    for (let s = 0; s < 60; s++) sim.step(DEFAULT_PARAMS.dt)
    return sim
  }
  // un pas amorti : on saigne l'élan global pour que le corps reste sur place
  const pas = (sim: FluidSim): void => {
    for (let i = 0; i < sim.count; i++) {
      sim.velX[i] *= 0.98
      sim.velY[i] *= 0.98
    }
    sim.step(DEFAULT_PARAMS.dt)
  }

  it('restée dans la flaque : rendue au corps à l’échéance du délai — un PRÊT, pas une perte', () => {
    const sim = arme(500) // tir mou, visé dans la masse : la goutte ne perce pas
    const avant = sim.playerCount
    sim.eject(sim.stats.centroidX + 10, sim.stats.centroidY, DEFAULT_PARAMS.dt * 4)
    expect(sim.playerCount).toBe(avant - 1)
    // pendant le délai : elle compte EN RETOUR (le HUD la montre à part)
    for (let s = 0; s < Math.round(0.5 / DEFAULT_PARAMS.dt); s++) pas(sim)
    expect(sim.returningCount()).toBe(1)
    // à l'échéance : le corps la reprend, bilan intact
    for (let s = 0; s < Math.round(1.5 / DEFAULT_PARAMS.dt); s++) pas(sim)
    expect(sim.playerCount).toBe(avant)
    expect(sim.returningCount()).toBe(0)
  })

  it('réellement partie : perdue — et jamais annoncée en retour', () => {
    const sim = arme(1400) // plein régime : la goutte transperce et s'échappe
    const avant = sim.playerCount
    sim.eject(sim.stats.centroidX + 10, sim.stats.centroidY, DEFAULT_PARAMS.dt * 4)
    for (let s = 0; s < Math.round(2 / DEFAULT_PARAMS.dt); s++) pas(sim)
    expect(sim.playerCount).toBe(avant - 1)
    expect(sim.returningCount()).toBe(0) // loin du corps : pas de faux espoir
  })
})
