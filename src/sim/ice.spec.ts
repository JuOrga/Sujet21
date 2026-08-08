import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_FROID } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

// Plaque froide verticale : x ∈ [-60, 0], y ∈ [-300, 300]
const PLAQUE = { minX: -60, minY: -300, maxX: 0, maxY: 300, material: MAT_FROID }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([PLAQUE], [])
  return sim
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) sim.step(dt)
}

describe('FluidSim — le froid gèle, ancre, puis rend l’eau (tableau 2)', () => {
  it('l’eau qui s’attarde dans l’aura givre, gèle et s’immobilise', () => {
    const sim = makeSim()
    const i = sim.addParticle(15, 0, KIND_FREE) // à 15 u de la plaque, aura de 40
    sim.velY[i] = 30 // dérive le long de la plaque : reste dans l'aura
    run(sim, 4)
    expect(sim.frozen[i]).toBe(1)
    const x = sim.posX[i]
    const y = sim.posY[i]
    run(sim, 1)
    expect(Math.hypot(sim.posX[i] - x, sim.posY[i] - y)).toBeLessThan(0.5)
  })

  it('à l’écart du froid, la glace fond et l’eau redevient mobile', () => {
    const sim = makeSim()
    const i = sim.addParticle(500, 0, KIND_FREE) // loin de la plaque
    sim.frost[i] = 1
    sim.frozen[i] = 1
    run(sim, sim.params.thawTime * 0.6) // hystérésis : dégel sous 0,55
    expect(sim.frozen[i]).toBe(0)
    sim.velX[i] = 50
    run(sim, 0.5)
    expect(sim.posX[i]).toBeGreaterThan(510)
  })

  it('l’éjection n’expulse jamais une particule gelée', () => {
    const sim = makeSim()
    sim.spawnDisc(500, 0, 12, KIND_PLAYER)
    // la particule la plus proche du point visé est gelée
    let best = -1
    let bestD2 = Infinity
    for (let i = 0; i < sim.count; i++) {
      const dx = sim.posX[i] - 600
      const d2 = dx * dx + sim.posY[i] * sim.posY[i]
      if (d2 < bestD2) {
        bestD2 = d2
        best = i
      }
    }
    sim.frost[best] = 1
    sim.frozen[best] = 1
    sim.eject(600, 0, 1 / sim.params.ejectRate) // exactement une éjection
    expect(sim.kind[best]).toBe(KIND_PLAYER) // la glace est restée
    expect(sim.playerCount).toBe(11) // une voisine liquide est partie à sa place
  })

  it('l’aspiration du sas n’emporte pas la glace', () => {
    const sim = makeSim()
    const i = sim.addParticle(600, 0, KIND_FREE)
    sim.frost[i] = 1
    sim.frozen[i] = 1
    // 1 s : loin de la plaque le dégel court (3,5 s), la glace tient encore
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(1 / dt); s++) {
      sim.applyExitSuction(600, 40, dt) // bouche à 40 u : dans le rayon d'aspiration
      sim.step(dt)
    }
    expect(sim.frozen[i]).toBe(1)
    expect(sim.swallowed).toBe(0)
    expect(sim.posX[i]).toBeCloseTo(600, 0)
  })

  it('la glace fait obstacle : le liquide ne la traverse pas', () => {
    const sim = makeSim()
    // un mur de glace vertical en x = 500
    for (let k = -4; k <= 4; k++) {
      const i = sim.addParticle(500, k * 6, KIND_FREE)
      sim.frost[i] = 1
      sim.frozen[i] = 1
    }
    const j = sim.addParticle(470, 1, KIND_FREE)
    sim.velX[j] = 120
    run(sim, 1)
    // arrêté au mur (à un espacement près), pas projeté de l'autre côté
    expect(sim.posX[j]).toBeLessThan(506)
  })
})
