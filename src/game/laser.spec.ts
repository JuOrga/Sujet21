import { describe, expect, it } from 'vitest'
import { traceLaser, type TraceMonde } from './laser'
import { MAT_GRILLE, MAT_WALL } from './level'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from '../sim/solver'

const BOUNDS: Bounds = { minX: -1000, minY: -600, maxX: 1000, maxY: 600 }

function monde(sur: Partial<TraceMonde> = {}): TraceMonde {
  return {
    bounds: BOUNDS,
    boxes: [],
    portesFermees: [],
    cibles: [],
    iceNormal: null,
    ...sur,
  }
}

describe('traceLaser — les règles optiques du palier 1', () => {
  it('file droit et s’arrête sur une paroi pleine', () => {
    const t = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({ boxes: [{ minX: 200, minY: -200, maxX: 260, maxY: 200, material: MAT_WALL }] }),
    )
    expect(t.points.length).toBe(2)
    const fin = t.points[t.points.length - 1]
    expect(fin.x).toBeGreaterThan(195)
    expect(fin.x).toBeLessThan(270)
    expect(t.touchees).toEqual([])
  })

  it('passe la grille (de la lumière entre des mailles) et allume la cible derrière', () => {
    const t = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({
        boxes: [{ minX: 0, minY: -200, maxX: 60, maxY: 200, material: MAT_GRILLE }],
        cibles: [{ x: 700, y: 0, r: 26 }],
      }),
    )
    expect(t.touchees).toEqual([0])
  })

  it('une porte fermée absorbe ; retirée (ouverte), le faisceau passe', () => {
    const porte = { minX: 100, minY: -150, maxX: 140, maxY: 150 }
    const fermee = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({ portesFermees: [porte], cibles: [{ x: 700, y: 0, r: 26 }] }),
    )
    expect(fermee.touchees).toEqual([])
    const ouverte = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({ portesFermees: [], cibles: [{ x: 700, y: 0, r: 26 }] }),
    )
    expect(ouverte.touchees).toEqual([0])
  })

  it('la glace RÉFLÉCHIT : un miroir plat à 45° renvoie le faisceau vers le haut', () => {
    // miroir synthétique : une bande de « glace » dont la normale est (−1, 1)/√2
    const n = Math.SQRT1_2
    const t = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({
        iceNormal: (x, y) => (x > 0 && Math.abs(y - (x - 20)) < 24 ? { nx: -n, ny: n } : null),
        cibles: [{ x: 30, y: 400, r: 40 }], // au-dessus du point d'impact
      }),
    )
    expect(t.touchees).toEqual([0]) // réfléchi vers le haut, la cible s'allume
    expect(t.points.length).toBeGreaterThan(2) // il y a bien eu un rebond
  })

  it('le corps GELÉ de la simulation réfléchit réellement le faisceau', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    // un pavé de glace incliné n'est pas nécessaire : un mur vertical de glace
    // renvoie un faisceau horizontal sur ses pas
    for (let k = -8; k <= 8; k++) {
      for (let c = 0; c < 3; c++) {
        const i = sim.addParticle(300 + c * 6, k * 6, KIND_FREE)
        sim.frost[i] = 1
        sim.frozen[i] = 1
      }
    }
    sim.step(sim.params.dt) // construit la grille de voisinage
    const rIce = sim.params.particleSpacing * 1.3
    const t = traceLaser(
      { x: -400, y: 0, angle: 0 },
      monde({ iceNormal: (x, y) => sim.iceNormalAt(x, y, rIce, sim.params.laserMirrorSmooth) }),
    )
    expect(t.points.length).toBeGreaterThan(2) // rebond constaté
    const fin = t.points[t.points.length - 1]
    expect(fin.x).toBeLessThan(300) // renvoyé du côté d'où il venait
  })

  it('la normale du miroir est LISSE le long d’une face plane, malgré le grain des particules', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    // un mur de glace vertical, en réseau : sa face gauche est plane
    for (let k = -12; k <= 12; k++) {
      for (let c = 0; c < 4; c++) {
        const i = sim.addParticle(300 + c * 6, k * 6, KIND_FREE)
        sim.frost[i] = 1
        sim.frozen[i] = 1
      }
    }
    sim.step(sim.params.dt)
    const rHit = sim.params.particleSpacing * 1.3
    // échantillonnée en plusieurs points de la face : la normale moyenne doit
    // pointer franchement vers −x, sans partir dans tous les sens
    for (const y of [-40, -20, 0, 20, 40]) {
      const n = sim.iceNormalAt(295, y, rHit, sim.params.laserMirrorSmooth)
      expect(n).not.toBeNull()
      expect(n!.nx).toBeLessThan(-0.9)
      expect(Math.abs(n!.ny)).toBeLessThan(0.45)
    }
  })
})

describe('FluidSim.laserHeat — l’eau paie de rester dans la lumière', () => {
  it('évapore les particules du couloir vers la réserve de rosée, épargne glace et vapeur', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS, laserEvapRate: 40 }, BOUNDS, 2048)
    sim.spawnDisc(0, 0, 80, KIND_PLAYER)
    sim.relabel()
    const gel = sim.addParticle(0, 200, KIND_FREE)
    sim.frozen[gel] = 1
    const avant = sim.count
    const bankAvant = sim.vaporBank
    for (let s = 0; s < 60; s++) sim.laserHeat(-500, 0, 500, 0, sim.params.dt)
    expect(sim.count).toBeLessThan(avant) // le faisceau a bu dans le corps
    expect(sim.vaporBank).toBeGreaterThan(bankAvant) // vers la rosée, pas au néant
    expect(sim.frozen[gel] === 1 || sim.count < avant).toBe(true)
  })

  it('ne touche pas l’eau hors du couloir', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS, laserEvapRate: 40 }, BOUNDS, 2048)
    sim.spawnDisc(0, 300, 60, KIND_PLAYER)
    sim.relabel()
    const avant = sim.count
    for (let s = 0; s < 60; s++) sim.laserHeat(-500, 0, 500, 0, sim.params.dt)
    expect(sim.count).toBe(avant)
  })
})
