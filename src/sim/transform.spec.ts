import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  return new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) sim.step(dt)
}

describe('Règles de transformation — changer d’état ne tue pas', () => {
  it('vapeur → eau : le nuage étalé condense et se regroupe, sans dispersion', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 3) // vaporisation puis expansion : le nuage est distendu
    expect(sim.dispersed).toBe(false)
    sim.gasIntent = false
    run(sim, 5) // condensation : le lien s'éteint doucement, le nuage retombe
    expect(sim.dispersed).toBe(false)
    for (let i = 0; i < sim.count; i++) expect(sim.gaseous[i]).toBe(0)
    // le corps se reforme ; quelques gouttes du bord peuvent rester égarées
    expect(sim.playerCount).toBeGreaterThanOrEqual(50)
  })

  it('glace → eau : geler puis dégeler ne disperse pas', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.freezeIntent = true
    run(sim, 1.5)
    let frozenCount = 0
    for (let i = 0; i < sim.count; i++) frozenCount += sim.frozen[i]
    expect(frozenCount).toBe(sim.count) // le bloc a pris
    sim.freezeIntent = false
    run(sim, 4)
    expect(sim.dispersed).toBe(false)
    expect(sim.playerCount).toBeGreaterThanOrEqual(55)
  })

  it('le délai de grâce : passer brièvement sous le seuil ne conclut pas', () => {
    const sim = makeSim({ dispersalGrace: 2 })
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 100, KIND_PLAYER)
    run(sim, 0.1)
    // perte brutale : 70 % du volume — sous le seuil critique (35 %)
    for (let k = 0; k < 70; k++) sim.removeParticle(0)
    run(sim, 1)
    expect(sim.dispersed).toBe(false) // constaté, pas encore tranché
    run(sim, 2)
    expect(sim.dispersed).toBe(true) // sous le seuil depuis > 2 s : dispersion
  })

  it('sans vapeur résiduelle, le lien d’amas reste le rayon liquide', () => {
    // deux gouttes à 2× le rayon de lien : deux composantes, la plus petite
    // est perdue — le comportement liquide historique ne change pas
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 40, KIND_PLAYER)
    sim.spawnDisc(400, 0, 3, KIND_PLAYER)
    run(sim, 0.5)
    expect(sim.playerCount).toBeLessThanOrEqual(40) // l'îlot lointain n'est pas relié
  })
})
