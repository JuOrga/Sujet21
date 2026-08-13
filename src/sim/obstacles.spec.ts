import { describe, expect, it } from 'vitest'
import { boxContact, Sponge, type ClosestPoint } from './obstacles'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_MEMBRANE, MAT_RIDEAU, MAT_WALL, pointInBox } from '../game/level'

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

describe('Éponge — le feutre bloque la glace et la vapeur (tableau des règles)', () => {
  // L'eau s'infiltre dans les cellules vivantes (qui l'absorbent) et bute
  // sur les cellules saturées ; la glace et la vapeur butent PARTOUT.
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

  it('la glace bute sur l’éponge, saturée ou non', () => {
    const sim = murEponge()
    const i = sim.addParticle(-80, 0, KIND_FREE)
    sim.frost[i] = 1
    sim.frozen[i] = 1
    sim.velX[i] = 300
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.posX[i]).toBeLessThan(10) // arrêtée au feutre
  })

  it('la vapeur bute sur l’éponge, sans y être essorée', () => {
    const sim = murEponge()
    const i = sim.addParticle(-80, 0, KIND_FREE)
    sim.vapor[i] = 1
    sim.gaseous[i] = 1
    sim.velX[i] = 300
    const avant = sim.count
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.posX[i]).toBeLessThan(10)
    expect(sim.count).toBe(avant) // rien d'essoré : elle n'entre plus
  })

  it('le liquide, lui, bute toujours dessus', () => {
    const sim = murEponge()
    const i = sim.addParticle(-80, 0, KIND_FREE)
    sim.velX[i] = 300
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    expect(sim.posX[i]).toBeLessThan(5) // arrêté devant les cellules pleines
  })
})

describe('Membrane et rideau lamellaire — chaque état a sa porte', () => {
  function mur(mat: number): FluidSim {
    const sim = makeSim()
    sim.setLevel([{ minX: 0, minY: -500, maxX: 40, maxY: 500, material: mat }], [])
    return sim
  }
  const lance = (sim: FluidSim, etat: 'eau' | 'glace' | 'vapeur'): number => {
    const i = sim.addParticle(-80, 0, KIND_FREE)
    if (etat === 'glace') {
      sim.frost[i] = 1
      sim.frozen[i] = 1
    } else if (etat === 'vapeur') {
      sim.vapor[i] = 1
      sim.gaseous[i] = 1
    }
    sim.velX[i] = 300
    for (let s = 0; s < 120; s++) sim.step(sim.params.dt)
    return sim.posX[i]
  }

  it('la membrane laisse suinter l’eau, bloque glace et vapeur', () => {
    expect(lance(mur(MAT_MEMBRANE), 'eau')).toBeGreaterThan(60)
    expect(lance(mur(MAT_MEMBRANE), 'glace')).toBeLessThan(10)
    expect(lance(mur(MAT_MEMBRANE), 'vapeur')).toBeLessThan(10)
  })

  it('le rideau lamellaire s’écarte devant la glace, bloque eau et vapeur', () => {
    expect(lance(mur(MAT_RIDEAU), 'glace')).toBeGreaterThan(60)
    expect(lance(mur(MAT_RIDEAU), 'eau')).toBeLessThan(10)
    expect(lance(mur(MAT_RIDEAU), 'vapeur')).toBeLessThan(10)
  })

  // Un VRAI palet : la réponse chimique doit survivre au moyennage de l'amas
  // et à l'impulsion rigide d'icePass. (Régression : avec une réponse par
  // particule, un bloc multi-particules se comportait comme sur un mur
  // neutre — seule une particule isolée sentait la chimie.)
  const geleBloc = (sim: FluidSim, cx: number, cy: number, vx: number, vy: number): void => {
    const e = DEFAULT_PARAMS.particleSpacing
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const i = sim.addParticle(cx + gx * e, cy + gy * e, KIND_FREE)
        sim.frost[i] = 1
        sim.frozen[i] = 1
        sim.velX[i] = vx
        sim.velY[i] = vy
      }
    }
  }

  it('un PALET de glace rebondit sur l’hydrophobe comme un bumper', () => {
    const rebond = (mat: number): number => {
      const sim = makeSim()
      sim.setLevel([{ minX: 200, minY: -500, maxX: 240, maxY: 500, material: mat }], [])
      geleBloc(sim, -60, 0, 320, 0)
      for (let s = 0; s < 150; s++) sim.step(sim.params.dt)
      let vx = 0
      for (let i = 0; i < sim.count; i++) vx += sim.velX[i]
      return -vx / sim.count // vitesse de retour du bloc
    }
    const neutre = rebond(MAT_WALL)
    const bumper = rebond(MAT_HYDROPHOBE)
    // le bumper rend PLUS qu'un mur neutre, et au moins la pichenette plancher
    expect(bumper).toBeGreaterThan(neutre + 50)
    expect(bumper).toBeGreaterThan(DEFAULT_PARAMS.hydrophobeIceKick * 0.8)
  })

  it('un PALET de glace est retenu par l’hydrophile (« ralentis »)', () => {
    const glisse = (mat: number): number => {
      const sim = makeSim()
      sim.setLevel([{ minX: -500, minY: -540, maxX: 500, maxY: -500, material: mat }], [])
      geleBloc(sim, -400, -498, 300, 0)
      for (let s = 0; s < 90; s++) {
        for (let i = 0; i < sim.count; i++) sim.velY[i] = -60 // l'appui
        sim.step(sim.params.dt)
      }
      let vx = 0
      for (let i = 0; i < sim.count; i++) vx += sim.velX[i]
      return vx / sim.count
    }
    expect(glisse(MAT_HYDROPHILE)).toBeLessThan(glisse(MAT_WALL) * 0.8)
  })

  it('la VAPEUR sent les bandes de loin : attirée par l’hydrophile, repoussée par l’hydrophobe', () => {
    const derive = (mat: number): number => {
      const sim = makeSim()
      sim.setLevel([{ minX: 200, minY: -500, maxX: 240, maxY: 500, material: mat }], [])
      // dans la bande étendue (hydroBand × portée vapeur), hors bande liquide
      const i = sim.addParticle(60, 0, KIND_FREE)
      sim.gaseous[i] = 1
      sim.vapor[i] = 1
      for (let s = 0; s < 60; s++) sim.step(sim.params.dt)
      return sim.velX[i] // >0 : attirée vers la paroi ; <0 : repoussée
    }
    expect(derive(MAT_HYDROPHILE)).toBeGreaterThan(10)
    expect(derive(MAT_HYDROPHOBE)).toBeLessThan(-10)
    // un mur neutre ne fait rien à cette distance
    expect(Math.abs(derive(MAT_WALL))).toBeLessThan(5)
  })
})

describe('Boîtes obliques — la rotation traverse contact, simulation et optique', () => {
  it('boxContact sur une boîte à 45° : le coin pointe vers le haut', () => {
    const b = { minX: -50, minY: -50, maxX: 50, maxY: 50, angle: 45 }
    const cp: ClosestPoint = { dist: 0, nx: 0, ny: 0 }
    boxContact(0, 80, b, cp)
    // droite, la face serait à 30 u ; tournée, le COIN monte à 50·√2 ≈ 70,7
    expect(cp.dist).toBeCloseTo(80 - 50 * Math.SQRT2, 0)
    expect(cp.nx).toBeCloseTo(0, 5)
    expect(cp.ny).toBeCloseTo(1, 5)
  })

  it('une paroi oblique DÉVIE là où sa version droite laisserait passer', () => {
    const sim = makeSim()
    // barre fine tournée à 45° : sa diagonale occupe y ≈ x autour de l'origine
    sim.setLevel([{ minX: -150, minY: -20, maxX: 150, maxY: 20, material: MAT_WALL, angle: 45 }], [])
    const i = sim.addParticle(-200, 80, KIND_FREE)
    sim.velX[i] = 300 // file vers +x à y ≈ 80 : hors de la boîte DROITE
    let yMax = -Infinity
    for (let s = 0; s < 240; s++) {
      sim.step(sim.params.dt)
      yMax = Math.max(yMax, sim.posY[i])
    }
    // la rampe oblique la DÉVIE : elle glisse le long de la diagonale et
    // remonte nettement — la barre droite ne l'aurait pas touchée
    expect(yMax).toBeGreaterThan(110)
    const sim2 = makeSim()
    sim2.setLevel([{ minX: -150, minY: -20, maxX: 150, maxY: 20, material: MAT_WALL }], [])
    const j = sim2.addParticle(-200, 80, KIND_FREE)
    sim2.velX[j] = 300
    for (let s = 0; s < 240; s++) sim2.step(sim2.params.dt)
    expect(Math.abs(sim2.posY[j] - 80)).toBeLessThan(5)
  })
})
