import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_FROID, MAT_GRILLE } from '../game/level'

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

describe('FluidSim — la vapeur : se déplacer en gaz (tableau 3)', () => {
  it('vaporisation volontaire (G) : le corps entier passe en vapeur', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 40, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2)
    for (let i = 0; i < sim.count; i++) {
      expect(sim.gaseous[i]).toBe(1)
    }
    expect(sim.dispersed).toBe(false)
  })

  it('le nuage distendu reste un seul corps (pas de fausse dispersion)', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 3) // vaporisation puis expansion
    expect(sim.dispersed).toBe(false)
    expect(sim.playerCount).toBeGreaterThanOrEqual(59) // au pire une égarée du bord
  })

  it('le pilotage déplace le nuage vers la visée, au prix d’une évaporation', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2)
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(3 / dt); s++) {
      sim.applyGasSteer(600, 0, dt)
      sim.step(dt)
    }
    sim.updatePlayerStats()
    expect(sim.stats.centroidX).toBeGreaterThan(150) // le nuage a dérivé vers la cible
    expect(sim.playerCount).toBeLessThan(60) // ~15 particules évaporées (5/s × 3 s)
    expect(sim.playerCount).toBeGreaterThan(35)
  })

  it('la vapeur traverse la grille, le liquide s’y écrase', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: 0, minY: -500, maxX: 40, maxY: 500, material: MAT_GRILLE }], [])
    const liq = sim.addParticle(-30, 100, KIND_FREE)
    sim.velX[liq] = 250
    const gas = sim.addParticle(-30, -100, KIND_FREE)
    sim.vapor[gas] = 1
    sim.gaseous[gas] = 1
    sim.velX[gas] = 250
    run(sim, 1)
    expect(sim.posX[liq]).toBeLessThan(5) // bloqué devant la grille
    expect(sim.posX[gas]).toBeGreaterThan(45) // passé au travers
  })

  it('le froid condense la vapeur (pas de gel direct du gaz)', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: -60, minY: -300, maxX: 0, maxY: 300, material: MAT_FROID }], [])
    const i = sim.addParticle(10, 0, KIND_FREE) // en pleine aura
    sim.vapor[i] = 1
    sim.gaseous[i] = 1
    run(sim, 0.8)
    expect(sim.gaseous[i]).toBe(0) // condensée
    run(sim, 2)
    expect(sim.frozen[i]).toBe(1) // puis, restée dans l'aura : gelée
  })

  it('en vapeur, l’éjection ne trouve rien à expulser', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 20, KIND_PLAYER)
    gasify(sim)
    sim.updatePlayerStats()
    sim.eject(200, 0, 1 / sim.params.ejectRate)
    expect(sim.playerCount).toBe(20) // rien n'est parti
  })
})
