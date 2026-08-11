import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_CHAUD, MAT_FROID, MAT_GRILLE } from '../game/level'

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
    const sim = makeSim({ gasIdleLossRate: 0 }) // on mesure la connexité, pas le coût d'état
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 3) // vaporisation puis expansion
    expect(sim.dispersed).toBe(false)
    expect(sim.playerCount).toBeGreaterThanOrEqual(59) // au pire une égarée du bord
  })

  it('le dash propulse tout le nuage vers la visée, sans recul ni éjection', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2) // vaporisation complète
    const before = sim.playerCount
    const spent = sim.gasDash(600, 0)
    // le dash se COMPTE (budget d'écran), il n'évapore plus le volume
    expect(spent).toBe(1)
    expect(sim.playerCount).toBe(before)
    // l'impulsion : le nuage fuse — la traîne évaporée ne compte pas ici
    run(sim, 0.6)
    sim.updatePlayerStats()
    expect(sim.stats.centroidX).toBeGreaterThan(120) // parti vers la cible
    // pas d'éjection : aucune gouttelette liquide relâchée derrière
    let liquides = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.gaseous[i] === 0 && sim.frozen[i] === 0) liquides++
    }
    expect(liquides).toBe(0)
  })

  it('la puissance du dash suit la distance du pointeur : à mi-portée, mi-vitesse', () => {
    const faire = (dist: number): number => {
      const sim = makeSim()
      sim.setLevel([], [])
      sim.spawnDisc(0, 0, 60, KIND_PLAYER)
      sim.gasIntent = true
      run(sim, 1.2)
      sim.updatePlayerStats()
      sim.gasDash(sim.stats.centroidX + dist, sim.stats.centroidY)
      sim.updatePlayerStats()
      return Math.hypot(sim.stats.velX, sim.stats.velY)
    }
    const pleine = faire(sim0RangePlus())
    const moitie = faire(DEFAULT_PARAMS.gasDashRange / 2)
    expect(pleine).toBeGreaterThan(DEFAULT_PARAMS.gasDashSpeed * 0.85)
    expect(moitie).toBeGreaterThan(DEFAULT_PARAMS.gasDashSpeed * 0.35)
    expect(moitie).toBeLessThan(DEFAULT_PARAMS.gasDashSpeed * 0.65)
    // au-delà de la portée, rien de plus : viser à deux kilomètres est inutile
    const tresLoin = faire(DEFAULT_PARAMS.gasDashRange * 8)
    expect(Math.abs(tresLoin - pleine)).toBeLessThan(DEFAULT_PARAMS.gasDashSpeed * 0.1)

    function sim0RangePlus(): number {
      return DEFAULT_PARAMS.gasDashRange * 1.2
    }
  })

  it('les impulsions sont COMPTÉES par écran : le budget s’épuise, quel que soit le volume', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 90, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2)
    sim.dashBudget = 2
    expect(sim.gasDash(600, 0)).toBe(1)
    expect(sim.dashBudget).toBe(1)
    expect(sim.gasDash(600, 0)).toBe(1)
    expect(sim.dashBudget).toBe(0)
    expect(sim.gasDash(600, 0)).toBe(0) // à sec : plus d'impulsion
    expect(sim.playerCount).toBeGreaterThan(80) // et le volume n'a rien payé
  })

  it('un bain dans l’aura du radiateur RECHARGE UN DASH : le prochain est offert', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: -60, minY: -260, maxX: 60, maxY: -200, material: MAT_CHAUD }], [])
    sim.spawnDisc(0, -140, 60, KIND_PLAYER) // dans l'aura du radiateur
    gasify(sim)
    run(sim, 0.5)
    expect(sim.dashOffert).toBe(true)
    sim.dashBudget = 1
    sim.gasDash(400, -140)
    expect(sim.dashBudget).toBe(1) // l'offrande a payé : le budget est intact
    expect(sim.dashOffert).toBe(false) // et elle est consommée
    sim.gasDash(400, -140)
    expect(sim.dashBudget).toBe(0) // le suivant sort du budget de l'écran
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
