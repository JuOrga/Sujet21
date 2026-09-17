import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER, type Bounds } from '../sim/solver'
import { MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_WALL, type ObstacleBox, type PuitsDef } from './level'
import { periodeCoeur, vitesseCirculaire } from './puits'
import { traceTrajectoire, TRAJ_RESTITUTION_HYDROPHOBE, TRAJ_RESTITUTION_MUR } from './trajectoire'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const PUITS: PuitsDef = { x: 0, y: 0, force: 540, rayon: 300 }

describe('traceTrajectoire — le point qui suit la même intégration que le corps', () => {
  it('une orbite circulaire dans le cœur tient son rayon à ±1 % sur trois périodes, et le passage note la plus courte approche', () => {
    const r = 200
    const tr = traceTrajectoire({ x: r, y: 0, vx: 0, vy: vitesseCirculaire(PUITS, r) }, { bounds: OPEN, boxes: [], puits: [PUITS], duree: 3 * periodeCoeur(PUITS) })
    for (const p of tr.points) {
      const d = Math.hypot(p.x, p.y)
      expect(d).toBeGreaterThan(r * 0.99)
      expect(d).toBeLessThan(r * 1.01)
    }
    expect(tr.passages[0].distance).toBeGreaterThan(r * 0.99)
    expect(tr.evenements).toEqual([])
    expect(tr.fin).toBe('duree')
    // trois périodes : de retour au point de départ
    const dernier = tr.points[tr.points.length - 1]
    expect(Math.hypot(dernier.x - r, dernier.y)).toBeLessThan(r * 0.05)
  })

  it('sans puits ni paroi, une ligne droite ; un point tous les `sous` pas, le premier et le dernier compris', () => {
    const tr = traceTrajectoire({ x: 0, y: 0, vx: 120, vy: -60 }, { bounds: OPEN, boxes: [], puits: [], duree: 2, sous: 12 })
    const dernier = tr.points[tr.points.length - 1]
    expect(dernier.t).toBeCloseTo(2)
    expect(dernier.x).toBeCloseTo(240)
    expect(dernier.y).toBeCloseTo(-120)
    expect(tr.points).toHaveLength(1 + 240 / 12)
    expect(tr.points[1].t).toBeCloseTo(0.1)
  })

  it('un mur neutre arrête (restitution mesurée ≈ 0), l’hydrophobe renvoie, l’hydrophile colle et finit la ligne — un contact qui dure n’est qu’un événement', () => {
    const mur: ObstacleBox = { minX: 500, minY: -400, maxX: 600, maxY: 400, material: MAT_WALL }
    const neutre = traceTrajectoire({ x: 0, y: 0, vx: 400, vy: 0 }, { bounds: OPEN, boxes: [mur], puits: [], duree: 3, rayonCorps: 40 })
    expect(neutre.evenements.filter((e) => e.type === 'rebond')).toHaveLength(1)
    expect(neutre.evenements[0].x).toBeCloseTo(460, 0)
    const finNeutre = neutre.points[neutre.points.length - 1]
    expect(finNeutre.x).toBeLessThan(470) // il n'est pas revenu : le mur arrête
    expect(finNeutre.x).toBeGreaterThan(400)
    const phobe = traceTrajectoire({ x: 0, y: 0, vx: 400, vy: 0 }, { bounds: OPEN, boxes: [{ ...mur, material: MAT_HYDROPHOBE }], puits: [], duree: 3 })
    expect(phobe.evenements).toHaveLength(1)
    const finPhobe = phobe.points[phobe.points.length - 1]
    // touché à t = 1,25 s, renvoyé à 0,7 × 400 = 280 u/s pendant 1,75 s : de retour vers x ≈ 10
    expect(finPhobe.x).toBeCloseTo(500 - 400 * TRAJ_RESTITUTION_HYDROPHOBE * (3 - 1.25), -2)
    expect(finPhobe.x).toBeLessThan(100)
    const phile = traceTrajectoire({ x: 0, y: 0, vx: 400, vy: 0 }, { bounds: OPEN, boxes: [{ ...mur, material: MAT_HYDROPHILE }], puits: [], duree: 3 })
    expect(phile.fin).toBe('colle')
    expect(phile.evenements[0].type).toBe('colle')
    expect(phile.points[phile.points.length - 1].t).toBeLessThan(1.3)
  })

  it('les bords de la cuve renvoient comme un mur neutre, et le frottement essouffle', () => {
    const tr = traceTrajectoire({ x: 0, y: 0, vx: 500, vy: 0 }, { bounds: { minX: -400, minY: -400, maxX: 400, maxY: 400 }, boxes: [], puits: [], duree: 2, rayonCorps: 20 })
    expect(tr.evenements[0]).toMatchObject({ type: 'bord', x: 380 })
    expect(tr.points[tr.points.length - 1].x).toBeGreaterThan(300) // arrêté contre le bord
    const freine = traceTrajectoire({ x: 0, y: 0, vx: 500, vy: 0 }, { bounds: OPEN, boxes: [], puits: [], duree: 2, frottement: 1.3 })
    // v(t) = 500·e^(−1,3 t) : parcouru 500/1,3·(1 − e^(−2,6)) ≈ 356
    expect(freine.points[freine.points.length - 1].x).toBeCloseTo(356, -1)
  })

  it('LA CALIBRATION : le vrai solveur ne rebondit pas sur un mur neutre et renvoie sur l’hydrophobe — la ligne dit la même chose, à ±40 %', () => {
    const mesure = (material: number): number => {
      const s = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
      s.setLevel([{ minX: 600, minY: -1000, maxX: 700, maxY: 1000, material }], [])
      s.spawnDisc(0, 0, 400, KIND_PLAYER)
      s.lanceCorps(400, 0)
      const dt = s.params.dt
      let vMin = Infinity
      for (let k = 0; k < Math.round(3.5 / dt); k++) {
        s.step(dt)
        s.updatePlayerStats()
        vMin = Math.min(vMin, s.stats.velX)
      }
      return -vMin / 400 // la restitution vue par le centre
    }
    const eNeutre = mesure(MAT_WALL)
    expect(eNeutre).toBeLessThan(0.1)
    expect(TRAJ_RESTITUTION_MUR).toBeLessThan(0.1)
    const ePhobe = mesure(MAT_HYDROPHOBE)
    expect(Math.abs(TRAJ_RESTITUTION_HYDROPHOBE - ePhobe)).toBeLessThan(0.4 * ePhobe)
  })
})
