import { describe, expect, it } from 'vitest'
import { boxContact, Sponge, type ClosestPoint } from './obstacles'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_WALL, pointInBox } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  return new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
}

describe('boxContact', () => {
  const box = { minX: 0, minY: 0, maxX: 100, maxY: 50 }
  const cp: ClosestPoint = { dist: 0, nx: 0, ny: 0 }

  it('mesure la distance et la normale depuis l’extérieur', () => {
    boxContact(150, 25, box, cp)
    expect(cp.dist).toBeCloseTo(50)
    expect(cp.nx).toBeCloseTo(1)
    expect(cp.ny).toBeCloseTo(0)
  })

  it('renvoie la moindre pénétration depuis l’intérieur', () => {
    boxContact(95, 25, box, cp)
    expect(cp.dist).toBeCloseTo(-5)
    expect(cp.nx).toBeCloseTo(1)
  })
})

describe('Sponge', () => {
  it('se sature cellule par cellule et se solidifie', () => {
    const sp = new Sponge({ minX: 0, minY: 0, cols: 2, rows: 2, cellSize: 10, capacityPerCell: 2 })
    const cell = sp.cellIndexAt(5, 5)
    expect(cell).toBe(0)
    expect(sp.isSolid(cell)).toBe(false)
    sp.absorb(cell)
    expect(sp.isSolid(cell)).toBe(false)
    sp.absorb(cell)
    expect(sp.isSolid(cell)).toBe(true)
    // les cellules voisines restent absorbantes
    expect(sp.isSolid(sp.cellIndexAt(15, 5))).toBe(false)
  })
})

describe('FluidSim — matériaux (§6)', () => {
  it('l’éponge englue puis absorbe après un temps de contact continu', () => {
    const sim = makeSim()
    sim.setLevel([], [{ minX: 50, minY: -100, cols: 4, rows: 8, cellSize: 25, capacityPerCell: 3 }])
    // une goutte libre projetée dans l'éponge
    const i = sim.addParticle(30, 0, KIND_PLAYER)
    sim.velX[i] = 300
    sim.baseVolume = 1
    const before = sim.count
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.count).toBe(before - 1) // absorbée
    const totalSat = sim.sponges[0].saturation.reduce((a, b) => a + b, 0)
    expect(totalSat).toBe(1)
  })

  it('une cellule gorgée devient solide : la brèche payée est permanente', () => {
    const sim = makeSim({ spongeAbsorbTime: 0.05 })
    sim.setLevel([], [{ minX: 50, minY: -50, cols: 1, rows: 4, cellSize: 25, capacityPerCell: 2 }])
    // on gorge la cellule face à l'arrivée
    const sp = sim.sponges[0]
    const cell = sp.cellIndexAt(60, 10)
    sp.absorb(cell)
    sp.absorb(cell)
    expect(sp.isSolid(cell)).toBe(true)
    // une goutte lancée sur la cellule solidifiée n'est PAS absorbée : mur
    const i = sim.addParticle(20, 10, KIND_PLAYER)
    sim.velX[i] = 200
    sim.baseVolume = 1
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.count).toBe(1)
    expect(sim.posX[0]).toBeLessThan(50 + 1) // arrêtée devant la cellule
  })

  it('une paroi hydrophobe fait rebondir', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: 100, minY: -200, maxX: 140, maxY: 200, material: MAT_HYDROPHOBE }], [])
    const i = sim.addParticle(0, 0, KIND_PLAYER)
    sim.velX[i] = 400
    sim.baseVolume = 1
    for (let s = 0; s < 90; s++) sim.step(sim.params.dt)
    // repartie vers la gauche, loin de la paroi
    expect(sim.velX[0]).toBeLessThan(-50)
    expect(sim.posX[0]).toBeLessThan(100)
  })

  it('une paroi hydrophile retient : on y adhère (§6)', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: 100, minY: -200, maxX: 140, maxY: 200, material: MAT_HYDROPHILE }], [])
    const i = sim.addParticle(0, 0, KIND_PLAYER)
    sim.velX[i] = 400
    sim.baseVolume = 1
    for (let s = 0; s < 240; s++) sim.step(sim.params.dt)
    // collée contre la face gauche de la paroi, pas repartie
    expect(sim.posX[0]).toBeGreaterThan(80)
    expect(sim.posX[0]).toBeLessThan(100)
    expect(Math.abs(sim.velX[0])).toBeLessThan(30)
  })

  it('un mur neutre arrête sans rebond', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: 100, minY: -200, maxX: 140, maxY: 200, material: MAT_WALL }], [])
    const i = sim.addParticle(0, 0, KIND_PLAYER)
    sim.velX[i] = 400
    sim.baseVolume = 1
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.posX[0]).toBeLessThan(100)
    expect(sim.posX[0]).toBeGreaterThan(60)
  })

  it('removeParticle garde le corps cohérent', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 50, KIND_PLAYER)
    sim.removeParticle(10)
    expect(sim.count).toBe(49)
    expect(sim.playerCount).toBe(49)
    sim.relabel()
    expect(sim.playerCount).toBe(49)
  })
})

describe('pointInBox', () => {
  it('détecte le sas', () => {
    const exit = { minX: 10, minY: 10, maxX: 20, maxY: 20 }
    expect(pointInBox(15, 15, exit)).toBe(true)
    expect(pointInBox(5, 15, exit)).toBe(false)
  })
})
