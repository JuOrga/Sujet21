import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER } from './solver'
import { REGLES_ORBITES, tableauOrbites } from '../game/minijeux'
import { traceTrajectoire } from '../game/trajectoire'

// LA GARDE DU VRAI SOLVEUR : le lancer gelé dans REGLES_ORBITES a été trouvé
// sur le point-masse ; ici le CORPS entier (900 particules) le rejoue, et
// son centre doit passer le premier anneau et s'approcher du deuxième — la
// marée du halo entre les cœurs peut le décaler de quelques unités, pas plus.
// Si ce test tombe, on touche la physique ou le lancer, jamais les anneaux.
describe('les orbites — le corps entier suit le lancer du point-masse', () => {
  it('le centre du corps passe le premier anneau et s’approche du deuxième, sans se disperser', () => {
    const lv = tableauOrbites()
    const r = REGLES_ORBITES
    const a = (r.depart.impulsion.angle * Math.PI) / 180
    const vx = Math.cos(a) * r.depart.impulsion.vitesse
    const vy = Math.sin(a) * r.depart.impulsion.vitesse
    const point = traceTrajectoire({ x: r.depart.x, y: r.depart.y, vx, vy }, { bounds: lv.bounds, boxes: lv.boxes, puits: r.puits, rayonCorps: 75, duree: 6 })
    const tAnneau = (i: number): number => {
      const p = point.points.find((q) => Math.hypot(q.x - r.anneaux[i].x, q.y - r.anneaux[i].y) <= r.anneaux[i].r)
      return p ? p.t : -1
    }
    const t1 = tAnneau(0)
    const t2 = tAnneau(1)
    expect(t1).toBeGreaterThan(0)
    expect(t2).toBeGreaterThan(t1)
    const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
    s.setLevel(lv.boxes, lv.sponges)
    s.spawnDisc(lv.spawn.x, lv.spawn.y, 900, KIND_PLAYER)
    s.lanceCorps(vx, vy)
    const dt = s.params.dt
    let d1 = Infinity
    let d2 = Infinity
    const fin = t2 + 0.5
    for (let t = 0; t < fin; t += dt) {
      s.applyPuits(r.puits, dt)
      s.step(dt)
      s.updatePlayerStats()
      d1 = Math.min(d1, Math.hypot(s.stats.centroidX - r.anneaux[0].x, s.stats.centroidY - r.anneaux[0].y))
      d2 = Math.min(d2, Math.hypot(s.stats.centroidX - r.anneaux[1].x, s.stats.centroidY - r.anneaux[1].y))
    }
    s.relabel()
    expect(s.dispersed).toBe(false)
    expect(s.playerCount).toBeGreaterThan(900 * 0.9)
    expect(d1).toBeLessThan(r.anneaux[0].r + 30)
    expect(d2).toBeLessThan(2 * r.anneaux[1].r)
  })
})
