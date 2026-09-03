import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_CHAUD, MAT_FROID, MAT_WALL } from '../game/level'

// LES CAPACITÉS : des gestes qu'une carte ouvre (leviers de capacité). Le
// contrat commun, testé pour chacune : à zéro, RIEN ne change — le solveur
// se comporte exactement comme avant la carte. C'est ce qui permet de les
// livrer sans toucher aux 788 tests qui décrivent le jeu d'avant.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([], [])
  return sim
}

function run(sim: FluidSim, seconds: number, chaque?: () => void): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) {
    chaque?.()
    sim.step(dt)
  }
}

/** Un palet : le corps gelé de bout en bout, à l'arrêt ou lancé. */
function palet(sim: FluidSim, n: number, vx = 0, vy = 0): void {
  sim.spawnDisc(0, 0, n, KIND_PLAYER)
  sim.freezeIntent = true
  run(sim, 1.5)
  for (let i = 0; i < sim.count; i++) {
    sim.velX[i] = vx
    sim.velY[i] = vy
  }
  sim.updatePlayerStats()
}

function compte(sim: FluidSim, ok: (i: number) => boolean): number {
  let n = 0
  for (let i = 0; i < sim.count; i++) if (ok(i)) n++
  return n
}

function vitesseBloc(sim: FluidSim): { vx: number; vy: number; v: number } {
  let n = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER || sim.frozen[i] !== 1) continue
    n++
    vx += sim.velX[i]
    vy += sim.velY[i]
  }
  vx /= Math.max(1, n)
  vy /= Math.max(1, n)
  return { vx, vy, v: Math.hypot(vx, vy) }
}

describe('ESQUILLE — en glace, toucher détache un éclat, le palet part à l’opposé', () => {
  it('sans la carte, toucher en glace ne détache rien', () => {
    const sim = makeSim()
    palet(sim, 60)
    const avant = sim.playerCount
    expect(sim.esquille(500, 0)).toBe(0)
    expect(sim.playerCount).toBe(avant)
  })

  it('détache un éclat vers le point visé : réaction exacte, le bloc recule', () => {
    const sim = makeSim()
    palet(sim, 60)
    sim.esquilleFrac = 0.15
    const p0 = sim.totalMomentum()
    const n = sim.esquille(500, 0)
    expect(n).toBeGreaterThanOrEqual(3)
    expect(n).toBeLessThanOrEqual(12)
    // l'éclat : des particules libres, encore gelées, qui filent vers +x
    const eclat = compte(
      sim,
      (i) => sim.kind[i] === KIND_FREE && sim.frozen[i] === 1 && sim.velX[i] > 500,
    )
    expect(eclat).toBe(n)
    // le bloc part à l'opposé, et la quantité de mouvement totale n'a pas bougé
    expect(vitesseBloc(sim).vx).toBeLessThan(-20)
    const p1 = sim.totalMomentum()
    expect(Math.abs(p1.px - p0.px)).toBeLessThan(1e-3 * Math.max(1, Math.abs(p0.px)) + 1)
    expect(Math.abs(p1.py - p0.py)).toBeLessThan(1)
  })

  it('l’éclat est un petit palet qui s’éloigne, puis fond en gouttes à récupérer', () => {
    const sim = makeSim()
    palet(sim, 60)
    sim.esquilleFrac = 0.15
    const n = sim.esquille(500, 0)
    expect(n).toBeGreaterThan(0)
    run(sim, 0.5)
    // il s'est bel et bien détaché : les particules libres sont loin du bloc
    const cx = sim.stats.centroidX
    let loin = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] === KIND_FREE && sim.posX[i] - cx > 150) loin++
    }
    expect(loin).toBe(n)
    // hors du corps, la glace fond comme toujours : plus une esquille gelée
    run(sim, 3)
    expect(compte(sim, (i) => sim.kind[i] === KIND_FREE && sim.frozen[i] === 1)).toBe(0)
  })

  it('garde toujours un cœur de palet : un petit bloc ne se dissout pas en esquilles', () => {
    const sim = makeSim()
    palet(sim, 10)
    sim.esquilleFrac = 0.3
    const n = sim.esquille(500, 0)
    expect(n).toBeGreaterThan(0)
    expect(sim.playerCount).toBeGreaterThanOrEqual(6)
    // et sous huit particules gelées, rien ne part du tout
    const petit = makeSim()
    palet(petit, 6)
    petit.esquilleFrac = 0.3
    expect(petit.esquille(500, 0)).toBe(0)
  })
})

describe('GOUVERNAIL — en glace, maintenir infléchit la course sans rien dépenser', () => {
  it('sans la carte, la course du palet ne dévie pas', () => {
    const sim = makeSim()
    palet(sim, 60, 200, 0)
    run(sim, 0.5, () => sim.gouverneGlace(0, 2000, sim.params.dt))
    expect(Math.abs(vitesseBloc(sim).vy)).toBeLessThan(1)
  })

  it('tourne la vitesse vers le pointeur, à la norme près : l’élan reste le même', () => {
    const sim = makeSim()
    palet(sim, 60, 200, 0)
    sim.gouvernail = 1.5
    const v0 = vitesseBloc(sim).v
    run(sim, 0.5, () => sim.gouverneGlace(0, 2000, sim.params.dt))
    const v = vitesseBloc(sim)
    expect(v.vy).toBeGreaterThan(60) // 0,75 rad en 0,5 s : un franc virage
    expect(Math.abs(v.v - v0)).toBeLessThan(v0 * 0.03) // rien n'est dépensé
    expect(sim.playerCount).toBe(60)
  })

  it('à 3 rad/s, viser derrière soi fait faire demi-tour en une seconde', () => {
    const sim = makeSim()
    palet(sim, 60, 200, 0)
    sim.gouvernail = 3
    run(sim, 1.5, () =>
      sim.gouverneGlace(sim.stats.centroidX - 2000, sim.stats.centroidY, sim.params.dt),
    )
    const v = vitesseBloc(sim)
    expect(v.vx).toBeLessThan(-150)
    expect(Math.abs(v.v - 200)).toBeLessThan(10)
  })
})

describe('SURFUSION — le gel volontaire s’arme, et prend d’un coup au choc', () => {
  it('sans la carte, le bouton GLACE fige sur place comme toujours', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.freezeIntent = true
    run(sim, 1.5)
    expect(compte(sim, (i) => sim.frozen[i] === 1)).toBe(sim.count)
  })

  it('armé, le corps reste liquide — pilotable — le givre juste sous le gel', () => {
    const sim = makeSim()
    sim.surfusion = true
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.freezeIntent = true
    run(sim, 2)
    expect(compte(sim, (i) => sim.frozen[i] === 1)).toBe(0)
    expect(compte(sim, (i) => sim.frost[i] >= 0.9)).toBe(sim.count)
    expect(sim.surfusionPrise).toBe(false)
    // et l'éjection marche encore : c'est de l'eau
    const avant = sim.playerCount
    sim.eject(400, 0, 0.2)
    expect(sim.playerCount).toBeLessThan(avant)
  })

  it('cristallise tout le corps au premier choc, dans son élan — puis rebondit en palet', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: 300, minY: -400, maxX: 360, maxY: 400, material: MAT_WALL }], [])
    sim.surfusion = true
    sim.spawnDisc(0, 0, 80, KIND_PLAYER)
    for (let i = 0; i < sim.count; i++) sim.velX[i] = 250
    sim.freezeIntent = true
    run(sim, 0.8) // armé en route, encore loin du mur
    expect(compte(sim, (i) => sim.frozen[i] === 1)).toBe(0)
    run(sim, 1.2) // le choc a eu lieu
    expect(sim.surfusionPrise).toBe(true)
    expect(compte(sim, (i) => sim.kind[i] === KIND_PLAYER && sim.frozen[i] === 0)).toBe(0)
    expect(sim.dispersed).toBe(false)
    // c'est un palet désormais : il a rebondi sur le mur
    expect(vitesseBloc(sim).vx).toBeLessThan(-20)
  })

  it('une glace IMPOSÉE (zone, dernière impulsion) fige sur place : surfusionLibre le dit', () => {
    const sim = makeSim()
    sim.surfusion = true
    sim.surfusionLibre = false
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.freezeIntent = true
    run(sim, 1.5)
    expect(compte(sim, (i) => sim.frozen[i] === 1)).toBe(sim.count)
  })

  it('une plaque froide gèle comme toujours, surfusion ou pas', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: -200, minY: 40, maxX: 200, maxY: 80, material: MAT_FROID }], [])
    sim.surfusion = true
    sim.spawnDisc(0, 0, 40, KIND_PLAYER)
    sim.freezeIntent = true
    run(sim, 3)
    expect(compte(sim, (i) => sim.frozen[i] === 1)).toBeGreaterThan(sim.count * 0.8)
  })
})

describe('LEIDENFROST — le liquide danse sur sa vapeur, la chaudière le repousse', () => {
  const CHAUDIERE = { minX: 300, minY: -260, maxX: 360, maxY: 260, material: MAT_CHAUD }

  function glisseVersLaChaudiere(leidenfrost: number): FluidSim {
    const sim = makeSim({ heatLossRate: 0 })
    sim.setLevel([CHAUDIERE], [])
    sim.leidenfrost = leidenfrost
    sim.spawnDisc(60, 0, 300, KIND_PLAYER)
    for (let i = 0; i < sim.count; i++) sim.velX[i] = 150
    run(sim, 3)
    return sim
  }

  it('sans la carte, le corps qui glisse vers la chaudière y arrive et y baigne', () => {
    const sim = glisseVersLaChaudiere(0)
    expect(sim.chauffeFrac).toBeGreaterThan(0.9)
  })

  it('avec le coussin, le même élan est REFOULÉ : le corps ne baigne pas, il n’a pas basculé', () => {
    const sim = glisseVersLaChaudiere(0.5)
    expect(sim.chauffeFrac).toBeLessThan(0.5)
    expect(sim.stats.centroidX).toBeLessThan(220)
    expect(compte(sim, (i) => sim.gaseous[i] === 1)).toBe(0)
    expect(sim.dispersed).toBe(false)
  })

  it('le coussin ne porte que le LIQUIDE : la glace dégèle et la vapeur s’évapore comme avant', () => {
    // un bloc soudé contre la chaudière : il dégèle (le coussin n'isole pas la glace)
    const sim = makeSim({ heatLossRate: 0 })
    sim.setLevel([CHAUDIERE], [])
    sim.leidenfrost = 0.8
    palet(sim, 40)
    for (let i = 0; i < sim.count; i++) sim.posX[i] += 240
    sim.freezeIntent = false
    run(sim, 1)
    expect(compte(sim, (i) => sim.frozen[i] === 1)).toBe(0)
  })
})

describe('RICOCHET — un dash contre une paroi rebondit', () => {
  function nuageLance(ricochet: number): FluidSim {
    const sim = makeSim({ gasIdleLossRate: 0, gasDashExhaust: 0 })
    sim.setLevel([{ minX: 400, minY: -600, maxX: 460, maxY: 600, material: MAT_WALL }], [])
    sim.ricochet = ricochet
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 2) // vaporisé
    sim.dashBudget = 3
    expect(sim.gasDash(1000, 0)).toBe(1)
    run(sim, 0.9) // 400 u à 820 u/s : le mur est touché vers 0,5 s
    sim.updatePlayerStats()
    return sim
  }

  it('sans la carte, le nuage s’écrase sur la paroi et y reste', () => {
    const sim = nuageLance(0)
    expect(sim.stats.velX).toBeGreaterThan(-40)
  })

  it('avec la carte, le nuage repart de la paroi avec une bonne part de son élan', () => {
    const sim = nuageLance(0.65)
    expect(sim.stats.velX).toBeLessThan(-120)
    expect(sim.dispersed).toBe(false)
    expect(compte(sim, (i) => sim.kind[i] === KIND_PLAYER && sim.gaseous[i] === 1)).toBeGreaterThan(40)
  })

  it('un nuage qui DÉRIVE contre la paroi, sans dash, ne rebondit pas : la fenêtre est celle du dash', () => {
    const sim = makeSim({ gasIdleLossRate: 0 })
    sim.setLevel([{ minX: 400, minY: -600, maxX: 460, maxY: 600, material: MAT_WALL }], [])
    sim.ricochet = 1
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 2)
    for (let i = 0; i < sim.count; i++) sim.velX[i] = 600
    run(sim, 1.2)
    sim.updatePlayerStats()
    expect(sim.stats.velX).toBeGreaterThan(-40)
  })
})
