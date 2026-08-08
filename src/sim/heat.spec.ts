import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { MAT_CHAUD, MAT_FROID } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

// Radiateur horizontal centré en y = 0, la particule posée juste au-dessus
const RADIATOR = { minX: -200, minY: -40, maxX: 200, maxY: 0, material: MAT_CHAUD }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([RADIATOR], [])
  return sim
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) sim.step(dt)
}

describe('FluidSim — le radiateur : la chaleur vaporise, dégèle, évapore', () => {
  it("l'eau dans l'aura se change en vapeur sans intention (danger ou ressource)", () => {
    const sim = makeSim({ heatLossRate: 0 }) // pas de perte : on isole la vaporisation
    const i = sim.addParticle(0, 8, KIND_PLAYER)
    expect(sim.gaseous[i]).toBe(0)
    run(sim, DEFAULT_PARAMS.boilTime * 2.5)
    expect(sim.gaseous[i]).toBe(1)
  })

  it("l'eau loin de l'aura reste liquide", () => {
    const sim = makeSim()
    const i = sim.addParticle(0, 800, KIND_PLAYER)
    run(sim, 3)
    expect(sim.gaseous[i]).toBe(0)
  })

  it('la glace exposée à la chaleur dégèle, et bien plus vite qu’à l’air libre', () => {
    const sim = makeSim({ heatLossRate: 0, boilTime: 50 }) // on isole le dégel
    const i = sim.addParticle(0, 8, KIND_PLAYER)
    sim.frost[i] = 1
    sim.frozen[i] = 1
    run(sim, DEFAULT_PARAMS.heatThawTime * 4)
    expect(sim.frozen[i]).toBe(0)
  })

  it('la vapeur qui s’attarde dans l’aura s’évapore — perte définitive', () => {
    // expansion et turbulence coupées : le nuage reste dans l'aura, on isole
    // la perte par évaporation
    const sim = makeSim({ heatLossRate: 12, gasExpand: 0, gasTurb: 0, gasDrag: 12 })
    // gouttes espacées (hors portée du noyau) au-dessus du radiateur,
    // plus deux gouttes à l'abri
    for (let k = 0; k < 8; k++) sim.addParticle(-105 + k * 30, 10, KIND_PLAYER)
    sim.addParticle(0, 1200, KIND_PLAYER)
    sim.addParticle(20, 1200, KIND_PLAYER)
    const before = sim.count
    run(sim, 4)
    expect(sim.count).toBeLessThan(before)
    // le garde-fou laisse toujours un reste d'échantillon
    expect(sim.playerCount).toBeGreaterThanOrEqual(2)
  })

  it('le froid garde la priorité : plaque froide contre radiateur, l’eau ne bout pas', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS, heatLossRate: 0 }, OPEN, 2048)
    // radiateur et plaque froide superposés : cas limite, le froid condense
    sim.setLevel(
      [RADIATOR, { minX: -200, minY: 0, maxX: 200, maxY: 40, material: MAT_FROID }],
      [],
    )
    const i = sim.addParticle(0, 8, KIND_PLAYER)
    run(sim, 2)
    expect(sim.gaseous[i]).toBe(0)
  })
})
