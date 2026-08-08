import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_FROID, MAT_WALL } from '../game/level'

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

describe('FluidSim — la glace : bloc balistique, soudure, dégel', () => {
  it('gel volontaire (F) : le corps gèle vite et garde son élan', () => {
    const sim = makeSim()
    sim.spawnDisc(800, 0, 30, KIND_PLAYER)
    for (let i = 0; i < sim.count; i++) {
      sim.velX[i] = 100
    }
    sim.freezeIntent = true
    run(sim, 1.5)
    let frozenCount = 0
    for (let i = 0; i < sim.count; i++) if (sim.frozen[i] === 1) frozenCount++
    expect(frozenCount).toBe(30)
    // le bloc glisse : ~100 u/s conservés
    const x0 = sim.stats.centroidX
    sim.updatePlayerStats()
    run(sim, 0.5)
    sim.updatePlayerStats()
    expect(sim.stats.centroidX - x0).toBeGreaterThan(35)
    expect(Math.abs(sim.velX[0] - 100)).toBeLessThan(15)
  })

  it('intention levée : la glace fond et l’eau reprend sa vie liquide', () => {
    const sim = makeSim()
    sim.spawnDisc(800, 0, 20, KIND_PLAYER)
    sim.freezeIntent = true
    run(sim, 1)
    sim.freezeIntent = false
    run(sim, sim.params.thawTime * 0.6) // hystérésis : libérée sous 0,55
    for (let i = 0; i < sim.count; i++) {
      expect(sim.frozen[i]).toBe(0)
    }
  })

  it('gelée par une plaque SANS la toucher : la glace dérive (pas d’ancre à distance)', () => {
    const sim = makeSim()
    const i = sim.addParticle(20, -200, KIND_FREE) // aura (40) sans contact
    sim.velY[i] = 30 // longe la plaque
    run(sim, 4)
    expect(sim.frozen[i]).toBe(1)
    const y = sim.posY[i]
    run(sim, 0.5)
    expect(sim.posY[i] - y).toBeGreaterThan(10) // glisse toujours (~30 u/s)
  })

  it('gelée AU CONTACT d’une plaque : soudée, le bloc s’arrête', () => {
    const sim = makeSim()
    const i = sim.addParticle(4, -200, KIND_FREE) // collée à la face x = 0
    sim.velY[i] = 40
    run(sim, 3) // pleine aura : gel en ~1,2 s, puis soudure
    expect(sim.frozen[i]).toBe(1)
    const y = sim.posY[i]
    run(sim, 0.5)
    expect(Math.abs(sim.posY[i] - y)).toBeLessThan(1)
  })

  it('un bloc de glace rebondit sur un mur au lieu d’éclabousser', () => {
    const sim = makeSim()
    sim.boxes.push({ minX: 500, minY: -400, maxX: 560, maxY: 400, material: MAT_WALL })
    for (let k = -2; k <= 2; k++) {
      const i = sim.addParticle(400, k * 6, KIND_FREE)
      sim.frost[i] = 1
      sim.frozen[i] = 1
      sim.velX[i] = 300
    }
    run(sim, 1)
    expect(sim.velX[0]).toBeLessThan(-50) // reparti en arrière (restitution 0,45)
    expect(sim.posX[0]).toBeLessThan(500)
  })

  it('l’éjection n’expulse jamais une particule gelée', () => {
    const sim = makeSim()
    sim.spawnDisc(500, 0, 12, KIND_PLAYER)
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

  it('l’aspiration du sas n’a pas de prise sur la glace', () => {
    const sim = makeSim()
    const i = sim.addParticle(600, 0, KIND_FREE)
    sim.frost[i] = 1
    sim.frozen[i] = 1
    // 1 s : loin de la plaque le dégel (2,5 s) n'a pas encore libéré
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
    for (let k = -4; k <= 4; k++) {
      const i = sim.addParticle(500, k * 6, KIND_FREE)
      sim.frost[i] = 1
      sim.frozen[i] = 1
    }
    const j = sim.addParticle(470, 1, KIND_FREE)
    sim.velX[j] = 120
    run(sim, 1)
    // arrêté au mur de glace (à un espacement près), pas projeté au travers
    expect(sim.posX[j]).toBeLessThan(506)
  })
})
