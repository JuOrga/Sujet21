import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { VIDE_PORTEE } from '../game/vide'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(): FluidSim {
  return new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
}

// Le vide pris en (0, 0), à pleine force, pendant `seconds` — comme en jeu.
function aspire(sim: FluidSim, seconds: number, force = 1, debit = Infinity): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) {
    sim.applyAspirationVide(0, 0, dt, force, debit)
    sim.step(dt)
  }
}

describe('FluidSim.applyAspirationVide — le vide avale le corps', () => {
  it('le corps pris est englouti : PERDU, pas bu, et la dispersion conclut', () => {
    const sim = makeSim()
    sim.spawnDisc(150, 0, 60, KIND_PLAYER)
    aspire(sim, 5)
    expect(sim.perdusVide).toBeGreaterThan(55)
    expect(sim.swallowed).toBe(0) // rien n'ira en bonbonne
    expect(sim.perdusVide + sim.count).toBe(60)
    // sans relabel : quand TOUT est avalé, relabel sort d'emblée (count
    // nul) — c'est le courant lui-même qui doit constater la perte
    expect(sim.dispersed).toBe(true) // c'est le game over
  })

  it('le CORPS est emporté même hors de portée — une matière libre, non', () => {
    const sim = makeSim()
    const loin = VIDE_PORTEE + 600
    sim.spawnDisc(loin, 0, 30, KIND_PLAYER)
    const libre = sim.addParticle(-loin, 0, KIND_FREE)
    const avant = sim.posX[libre]
    aspire(sim, 1)
    // le corps a fondu vers l'œil ; la goutte libre de l'autre côté n'a pas bougé
    let cx = 0
    let n = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      cx += sim.posX[i]
      n++
    }
    expect(n === 0 || cx / n < loin - 200).toBe(true)
    let trouvee = false
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] === KIND_FREE && sim.posX[i] < 0) {
        expect(sim.posX[i]).toBeCloseTo(avant, 0)
        trouvee = true
      }
    }
    expect(trouvee).toBe(true)
  })

  it('le débit borne l’engloutissement : on voit le corps partir', () => {
    // posé SUR l'œil, sans débit, 900 particules partaient en 0,86 s
    const sim = makeSim()
    sim.spawnDisc(0, 0, 200, KIND_PLAYER)
    aspire(sim, 1, 1, 50)
    expect(sim.perdusVide).toBeGreaterThan(40)
    expect(sim.perdusVide).toBeLessThanOrEqual(51)
    expect(sim.dispersed).toBe(false)
  })

  it('à force nulle, rien ne bouge (avant la prise)', () => {
    const sim = makeSim()
    const i = sim.addParticle(120, 0, KIND_FREE)
    aspire(sim, 1, 0)
    expect(sim.posX[i]).toBeCloseTo(120, 0)
    expect(sim.perdusVide).toBe(0)
  })
})
