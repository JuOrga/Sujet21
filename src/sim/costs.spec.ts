import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
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

  it('bloquée par un mur au départ : rendue au corps à l’échéance — un PRÊT, pas une perte', () => {
    // L'éjection part désormais TOUJOURS de la surface : la goutte qui « ne
    // sort pas » est celle qu'un mur tout proche renvoie dans la flaque.
    const sim = arme(500)
    sim.setLevel([{ minX: 48, minY: -500, maxX: 100, maxY: 500, material: 0 }], [])
    for (let s = 0; s < 30; s++) sim.step(DEFAULT_PARAMS.dt)
    const avant = sim.playerCount
    sim.eject(sim.stats.centroidX + 400, sim.stats.centroidY, DEFAULT_PARAMS.dt * 4)
    expect(sim.playerCount).toBe(avant - 1)
    // pendant le délai : renvoyée par le mur, elle compte EN RETOUR
    for (let s = 0; s < Math.round(0.6 / DEFAULT_PARAMS.dt); s++) pas(sim)
    expect(sim.returningCount()).toBe(1)
    // à l'échéance : le rappel la ramène, bilan intact
    for (let s = 0; s < Math.round(2.5 / DEFAULT_PARAMS.dt); s++) pas(sim)
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

describe('Le retour des égarées — la vie ne baisse pas pour une goutte encore là', () => {
  it('le remous d’un tir détache des voisines : elles reviennent d’elles-mêmes', () => {
    // La scène du rapport de test : un tir vers un mur proche. La goutte
    // s'écrase au mur (vraiment partie), mais le remous détache des voisines
    // qui gisent À DEUX DOIGTS du corps. Avant le rappel : 7 perdues pour un
    // seul tir. Après : seule la goutte réellement partie manque.
    const sim = new FluidSim(
      { ...DEFAULT_PARAMS },
      { minX: -900, minY: -500, maxX: 900, maxY: 500 },
    )
    sim.setLevel([{ minX: 100, minY: -500, maxX: 160, maxY: 500, material: 0 }], [])
    sim.spawnDisc(0, 0, 90, KIND_PLAYER)
    for (let s = 0; s < 60; s++) sim.step(DEFAULT_PARAMS.dt)
    const avant = sim.playerCount
    sim.eject(90, 0, DEFAULT_PARAMS.dt * 4)
    for (let s = 0; s < Math.round(5 / DEFAULT_PARAMS.dt); s++) sim.step(DEFAULT_PARAMS.dt)
    // les fragments détachés par le remous sont revenus ; au plus la goutte
    // écrasée au mur (hors rayon de capture) manque à l'appel
    expect(sim.playerCount).toBeGreaterThanOrEqual(avant - 2)
  })

  it('les gouttes SEMÉES par le tableau ne sont pas aspirées : contact obligatoire', () => {
    const sim = new FluidSim(
      { ...DEFAULT_PARAMS },
      { minX: -900, minY: -500, maxX: 900, maxY: 500 },
    )
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 90, KIND_PLAYER)
    for (let s = 0; s < 60; s++) sim.step(DEFAULT_PARAMS.dt)
    // une collectable posée dans le rayon de capture mais SANS contact
    const g = sim.addParticle(sim.stats.centroidX + 70, sim.stats.centroidY, KIND_FREE)
    const avant = sim.playerCount
    for (let s = 0; s < Math.round(2 / DEFAULT_PARAMS.dt); s++) sim.step(DEFAULT_PARAMS.dt)
    const d = Math.hypot(sim.posX[g] - sim.stats.centroidX, sim.posY[g] - sim.stats.centroidY)
    expect(sim.playerCount).toBe(avant) // pas gobée à distance
    expect(d).toBeGreaterThan(45) // et pas non plus attirée vers le corps
  })
})
