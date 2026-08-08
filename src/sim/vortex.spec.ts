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

// Applique le vortex en (0, 0) pendant `seconds` (avec la vie restante,
// comme en jeu), puis laisse dériver librement jusqu'à `total` secondes.
function runVortex(sim: FluidSim, seconds: number, total = seconds): void {
  const dt = sim.params.dt
  const steps = Math.round(total / dt)
  const vortexSteps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) {
    if (s < vortexSteps) {
      const life = Math.min(1, ((vortexSteps - s) * dt) / sim.params.vortexDuration)
      sim.applyVortex(0, 0, dt, life)
    }
    sim.step(dt)
  }
}

describe('FluidSim.applyVortex — regroupement au clic droit', () => {
  it('ramène vers le centre une goutte détachée dans le rayon d’action', () => {
    const sim = makeSim({ vortexRadius: 300 })
    const i = sim.addParticle(200, 0, KIND_FREE)
    runVortex(sim, 2)
    expect(distToOrigin(sim, i)).toBeLessThan(60)
  })

  it('n’affecte pas l’eau hors du rayon d’action', () => {
    const sim = makeSim({ vortexRadius: 300 })
    const i = sim.addParticle(400, 0, KIND_FREE)
    runVortex(sim, 2)
    expect(distToOrigin(sim, i)).toBeCloseTo(400, 0)
  })

  it('dépose l’eau sans élan à la fin : pas d’éclatement centrifuge', () => {
    const sim = makeSim({ vortexRadius: 300 })
    const i = sim.addParticle(200, 0, KIND_FREE)
    // Vortex complet (1.6 s), puis 1 s de dérive libre : sans la retombée,
    // la goutte serait lâchée en pleine giration et filerait au loin. Ici
    // elle doit s'être nettement rapprochée ET être déposée quasi immobile
    // (la distance exacte du dépôt dépend des curseurs courant/durée).
    runVortex(sim, sim.params.vortexDuration, sim.params.vortexDuration + 1)
    expect(distToOrigin(sim, i)).toBeLessThan(140)
    expect(Math.hypot(sim.velX[i], sim.velY[i])).toBeLessThan(50)
  })

  it('plus de rotation = retour plus lent (spirale au lieu de ligne droite)', () => {
    const direct = makeSim({ vortexRadius: 300, vortexSwirl: 0 })
    const spiral = makeSim({ vortexRadius: 300, vortexSwirl: 2.5 })
    const iDirect = direct.addParticle(200, 0, KIND_FREE)
    const iSpiral = spiral.addParticle(200, 0, KIND_FREE)
    runVortex(direct, 0.5)
    runVortex(spiral, 0.5)
    expect(distToOrigin(spiral, iSpiral)).toBeGreaterThan(distToOrigin(direct, iDirect))
  })
})
