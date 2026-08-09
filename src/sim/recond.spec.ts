import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_FROID } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const PLATE = { minX: 800, minY: -300, maxX: 860, maxY: 300, material: MAT_FROID }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([PLATE], [])
  return sim
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) sim.step(dt)
}

function freeCount(sim: FluidSim): number {
  let n = 0
  for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_FREE) n++
  return n
}

// Le corps gazeux perd des particules loin de la plaque ; la rosée doit
// perler près d'elle, à hauteur du rendement.
function loseVapor(sim: FluidSim, seconds: number): void {
  sim.spawnDisc(-2000, 0, 60, KIND_PLAYER)
  for (let i = 0; i < sim.count; i++) {
    sim.vapor[i] = 1
    sim.gaseous[i] = 1
  }
  sim.gasIntent = true
  sim.updatePlayerStats()
  run(sim, seconds)
}

describe('Recondensation (§7.3) — la vapeur perdue perle sur le froid', () => {
  it('les pertes de vapeur reviennent en rosée près de la plaque, avec perte', () => {
    const sim = makeSim({ gasIdleLossRate: 10, recondRate: 20, gasExpand: 0, gasTurb: 0 })
    loseVapor(sim, 3)
    const lost = 60 - sim.playerCount
    const dew = freeCount(sim)
    expect(lost).toBeGreaterThan(10)
    expect(dew).toBeGreaterThan(lost * 0.3) // une bonne part revient…
    expect(dew).toBeLessThan(lost * 0.75) // …jamais tout (rendement 0,5)
    // …et la rosée perle bien près de la plaque
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_FREE) continue
      expect(Math.abs(sim.posX[i] - 830)).toBeLessThan(400)
    }
  })

  it('à vaisseau glacial, la condensation rend davantage (§7.3)', () => {
    const warm = makeSim({ gasIdleLossRate: 10, recondRate: 20, gasExpand: 0, gasTurb: 0 })
    loseVapor(warm, 3)
    const cold = makeSim({ gasIdleLossRate: 10, recondRate: 20, gasExpand: 0, gasTurb: 0 })
    cold.chill = 1
    loseVapor(cold, 3)
    expect(freeCount(cold)).toBeGreaterThan(freeCount(warm))
  })

  it('sans plaque froide, les pertes restent en réserve — rien ne perle', () => {
    const sim = new FluidSim(
      { ...DEFAULT_PARAMS, gasIdleLossRate: 10, recondRate: 20, gasExpand: 0, gasTurb: 0 },
      OPEN,
      2048,
    )
    sim.setLevel([], [])
    loseVapor(sim, 2)
    expect(freeCount(sim)).toBe(0)
    expect(sim.vaporBank).toBeGreaterThan(5)
  })
})
