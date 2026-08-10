import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  return new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
}

function distToOrigin(sim: FluidSim, i: number): number {
  return Math.hypot(sim.posX[i], sim.posY[i])
}

// Applique l'aspiration du sas en (0, 0) pendant `seconds`, comme en jeu.
function runSuction(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) {
    sim.applyExitSuction(0, 0, dt)
    sim.step(dt)
  }
}

describe('FluidSim.applyExitSuction — le sas avale l’eau en entonnoir', () => {
  it('engouffre une goutte entrée dans le rayon d’aspiration', () => {
    const sim = makeSim()
    const i = sim.addParticle(180, 0, KIND_FREE)
    runSuction(sim, 2)
    expect(distToOrigin(sim, i)).toBeLessThan(60)
  })

  it('n’affecte pas l’eau hors du rayon d’aspiration', () => {
    const sim = makeSim({ exitRadius: 240 })
    const i = sim.addParticle(400, 0, KIND_FREE)
    runSuction(sim, 2)
    expect(distToOrigin(sim, i)).toBeCloseTo(400, 0)
  })

  it('à rayon nul, le sas n’aspire plus', () => {
    const sim = makeSim({ exitRadius: 0 })
    const i = sim.addParticle(120, 0, KIND_FREE)
    runSuction(sim, 1)
    expect(distToOrigin(sim, i)).toBeCloseTo(120, 0)
  })

  it('la rotation fait spiraler sans empêcher d’entrer (cœur de Rankine)', () => {
    const sim = makeSim({ exitSwirl: 2.5 })
    const i = sim.addParticle(200, 0, KIND_FREE)
    runSuction(sim, 3)
    expect(distToOrigin(sim, i)).toBeLessThan(70)
  })

  it('avale le corps : les particules qui atteignent l’œil sont retirées et comptées', () => {
    const sim = makeSim()
    sim.spawnDisc(80, 0, 50, KIND_PLAYER)
    runSuction(sim, 4)
    expect(sim.swallowed).toBeGreaterThan(45)
    expect(sim.swallowed + sim.count).toBe(50) // rien n'est perdu, tout est bu ou encore là
    expect(sim.dispersed).toBe(false) // boire n'est pas disperser
  })

  it('dans l’emprise du sas, la perte de cohésion ne déclenche pas la dispersion', () => {
    const sim = makeSim()
    sim.spawnDisc(120, 0, 60, KIND_PLAYER) // dans le rayon d'aspiration (240)
    sim.applyExitSuction(0, 0, sim.params.dt)
    while (sim.playerCount > 15) sim.removeParticle(0) // sous le seuil critique (35 %)
    sim.relabel()
    expect(sim.dispersed).toBe(false)
  })

  it('hors de l’emprise du sas, la perte de cohésion reste une dispersion', () => {
    const sim = makeSim({ dispersalGrace: 0.1 })
    sim.spawnDisc(2000, 0, 60, KIND_PLAYER) // loin de la bouche
    sim.applyExitSuction(0, 0, sim.params.dt)
    // Le volume seul ne tue plus (refonte 2026) : il faut vraiment qu'il ne
    // reste plus de corps du tout.
    while (sim.playerCount > 15) sim.removeParticle(0)
    for (let s = 0; s < 30; s++) sim.step(sim.params.dt)
    expect(sim.dispersed).toBe(false)
    while (sim.count > 1) sim.removeParticle(0)
    sim.relabel() // il ne reste plus de corps : là, c'est bien une dispersion
    expect(sim.dispersed).toBe(true)
  })

  it('le sas avale aussi la glace, et la compte à part', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 40, KIND_PLAYER)
    for (let i = 0; i < sim.count; i++) sim.frozen[i] = 1
    sim.relabel()
    const before = sim.count
    for (let s = 0; s < 60; s++) {
      sim.applyExitSuction(0, 0, sim.params.dt)
      sim.step(sim.params.dt)
    }
    expect(sim.swallowed).toBeGreaterThan(0)
    expect(sim.swallowedIce).toBeGreaterThan(0) // la prime de glace a de quoi s'appliquer
    expect(sim.count).toBeLessThan(before)
  })
})
