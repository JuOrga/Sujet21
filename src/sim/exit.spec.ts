import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, type Bounds } from './solver'

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
})
