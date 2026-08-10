import { describe, expect, it } from 'vitest'
import { boxContact, Sponge, type ClosestPoint } from './obstacles'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
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

  it('l’impact sur un mur neutre s’étale au lieu d’éclater (amorti)', () => {
    // Deux gouttes lancées en biais sur le mur : avec l'amorti, la vitesse
    // s'aligne sur la paroi (glissement) au lieu de repartir en jaillissant.
    const sim = makeSim()
    sim.setLevel([{ minX: 100, minY: -200, maxX: 140, maxY: 200, material: MAT_WALL }], [])
    const i = sim.addParticle(60, 0, KIND_PLAYER)
    sim.velX[i] = 500
    sim.velY[i] = 200
    sim.baseVolume = 1
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    // pas de jaillissement : la composante qui fuit la paroi reste faible…
    expect(sim.velX[0]).toBeLessThan(40)
    // …et le glissement tangentiel a continué le long du mur
    expect(sim.posY[0]).toBeGreaterThan(30)
  })

  it('un mur neutre ne retient pas à distance : on s’en éloigne librement', () => {
    // Régression : l'amorti d'éclaboussure partageait la portée de la chimie
    // (hydroBand, 80 u). Une goutte lancée EN S'ÉLOIGNANT du mur, mais encore
    // dans cette bande, se faisait freiner — les parois semblaient coller.
    const sim = makeSim()
    sim.setLevel([{ minX: 100, minY: -200, maxX: 140, maxY: 200, material: MAT_WALL }], [])
    const i = sim.addParticle(60, 0, KIND_PLAYER) // à 40 u du mur : hors contact, dans l'ancienne bande
    sim.velX[i] = -300 // elle part à l'opposé du mur
    sim.baseVolume = 1
    for (let s = 0; s < 30; s++) sim.step(sim.params.dt)
    // la vitesse de fuite est conservée pour l'essentiel (gravité nulle ici)
    expect(sim.velX[0]).toBeLessThan(-250)
  })

  it('l’amorti d’éclaboussure ne dépend pas du nombre de sous-pas', () => {
    // Régression : l'amorti n'était pas normalisé par dt, donc il se cumulait
    // à chaque sous-pas — deux fois plus de pas, deux fois plus collant.
    const run = (dt: number, steps: number): number => {
      const sim = makeSim({ dt })
      sim.setLevel([{ minX: 100, minY: -200, maxX: 140, maxY: 200, material: MAT_WALL }], [])
      const i = sim.addParticle(96, 0, KIND_PLAYER) // au contact
      sim.velX[i] = -200 // repart du mur
      sim.baseVolume = 1
      for (let s = 0; s < steps; s++) sim.step(dt)
      return sim.velX[0]
    }
    const coarse = run(1 / 120, 12) // 0,1 s
    const fine = run(1 / 240, 24) // 0,1 s, deux fois plus de pas
    expect(Math.abs(fine - coarse)).toBeLessThan(Math.abs(coarse) * 0.25)
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

describe('Éponge gorgée — un mur pour le liquide seulement', () => {
  // Une cellule saturée devient solide, mais une éponge détrempée est molle :
  // la glace passe au travers, la vapeur entre ses fibres. Seule l'eau bute.
  function murEponge(): FluidSim {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 512)
    sim.setLevel([], [{ minX: 0, minY: -300, cols: 2, rows: 20, cellSize: 30, capacityPerCell: 2 }])
    // saturer toutes les cellules : le mur est « mouillé » sur toute sa hauteur
    const sp = sim.sponges[0]
    for (let c = 0; c < 2 * 20; c++) {
      sp.absorb(c)
      sp.absorb(c)
    }
    return sim
  }

  it('la glace traverse une éponge saturée', () => {
    const sim = murEponge()
    const i = sim.addParticle(-80, 0, KIND_FREE)
    sim.frost[i] = 1
    sim.frozen[i] = 1
    sim.velX[i] = 300
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.posX[i]).toBeGreaterThan(70) // de l'autre côté du mur
  })

  it('la vapeur traverse une éponge saturée', () => {
    const sim = murEponge()
    const i = sim.addParticle(-80, 0, KIND_FREE)
    sim.vapor[i] = 1
    sim.gaseous[i] = 1
    sim.velX[i] = 300
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.posX[i]).toBeGreaterThan(70)
  })

  it('le liquide, lui, bute toujours dessus', () => {
    const sim = murEponge()
    const i = sim.addParticle(-80, 0, KIND_FREE)
    sim.velX[i] = 300
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.posX[i]).toBeLessThan(5) // arrêté devant les cellules pleines
  })
})
