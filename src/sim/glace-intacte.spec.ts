import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { MAT_HYDROPHOBE, MAT_WALL, type SpongeDef } from '../game/level'
import { INSTRUMENTS } from '../game/instruments'

// LA RÈGLE : LA GLACE NE PERD JAMAIS DE VOLUME AU CONTACT.
// Un bloc gelé glisse, bute, rebondit — il ne se fait grignoter par rien.
// C'est une règle de conception, pas un détail d'implémentation : elle
// tient la lisibilité de l'état (geler, c'est parier sur une trajectoire,
// pas se sacrifier), et elle doit survivre à toutes les récompenses à
// venir. D'où ce garde-fou : la mécanique d'un côté, le catalogue de
// l'autre.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

// Une éponge large, posée en travers de la route du palet
const EPONGE: SpongeDef = {
  minX: -200,
  minY: -400,
  cols: 20,
  rows: 40,
  cellSize: 20,
  capacityPerCell: 2,
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  for (let s = 0; s < Math.round(seconds / dt); s++) sim.step(dt)
}

describe('La glace ne perd jamais de volume au contact', () => {
  it('un palet lancé dans une éponge en ressort entier', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sim.setLevel([], [EPONGE])
    sim.spawnDisc(-700, 0, 120, KIND_PLAYER)
    // on gèle, puis on pousse le bloc à travers le feutre
    sim.freezeIntent = true
    run(sim, 2)
    const gele = sim.count
    for (let i = 0; i < sim.count; i++) sim.velX[i] = 320
    run(sim, 4)
    // il a bien traversé la zone de l'éponge, et il est entier
    expect(sim.count).toBe(gele)
    expect(sim.spongeBites).toBe(0)
  })

  it('le même corps LIQUIDE, lui, se fait boire — la règle n’est pas un hasard', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sim.setLevel([], [EPONGE])
    sim.spawnDisc(-700, 0, 120, KIND_PLAYER)
    run(sim, 0.5)
    for (let i = 0; i < sim.count; i++) sim.velX[i] = 320
    const avant = sim.count
    run(sim, 4)
    expect(sim.count).toBeLessThan(avant)
    expect(sim.spongeBites).toBeGreaterThan(0)
  })

  it('aucune récompense ne prétend le contraire', () => {
    // Un levier qui ferait fondre la glace au contact n'existe pas : les
    // pertes du jeu sont toutes VAPEUR (nuage au repos, mailles d'évent,
    // aura de chaleur) ou LIQUIDE (éponge). Si une carte venait à parler
    // de perte de glace, c'est ce test qui le dirait.
    for (const d of INSTRUMENTS) {
      const texte = `${d.nom} ${d.desc}`.toLowerCase()
      const parleDePerteDeGlace =
        /(glace|palet|gel)/.test(texte) &&
        /(perd|perte|fond|grignot|absorb|boit|évapor)/.test(texte)
      expect(parleDePerteDeGlace).toBe(false)
    }
  })
})

// LA RÈGLE, SUITE : LA GLACE NE PERD JAMAIS SA FORME NON PLUS.
// Un bloc gelé est rigide — en vitesse ET en position. Vécu : après une
// dizaine de rebonds sur des parois hydrophobes, un palet enflait, se
// disloquait en dizaines d'éclats, et les éclats détachés du corps
// dégelaient en gouttelettes éparses (la « salle qui éclate »). Deux
// causes : la rotation intégrée en tangente (le rayon grandit de
// √(1 + (ω·dt)²) par pas), et les poussées de contact, appliquées particule
// par particule, qui tassaient le premier rang sur le reste à chaque choc.
describe('La glace ne perd jamais sa forme', () => {
  const E = DEFAULT_PARAMS.particleSpacing

  // Un palet 8 × 8 du joueur, gelé pour de bon (intention tenue), lancé à
  // (vx, vy) et tournant à omega (rad/s)
  const palet = (
    sim: FluidSim,
    cx: number,
    cy: number,
    vx: number,
    vy: number,
    omega = 0,
  ): void => {
    sim.freezeIntent = true
    const mx = cx + 3.5 * E
    const my = cy + 3.5 * E
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        const x = cx + gx * E
        const y = cy + gy * E
        const i = sim.addParticle(x, y, KIND_PLAYER)
        sim.frost[i] = 1
        sim.frozen[i] = 1
        sim.velX[i] = vx - omega * (y - my)
        sim.velY[i] = vy + omega * (x - mx)
      }
    }
  }

  // La forme du bloc : rayon quadratique moyen autour du centre, distance
  // moyenne au plus proche voisin, nombre d'amas (liaison ≤ rayon de lien)
  const forme = (sim: FluidSim): { rms: number; voisin: number; amas: number; geles: number } => {
    const n = sim.count
    const linkR = DEFAULT_PARAMS.linkRadiusFactor * DEFAULT_PARAMS.kernelRadius
    const parent = Array.from({ length: n }, (_, i) => i)
    const find = (a: number): number =>
      parent[a] === a ? a : (parent[a] = find(parent[a]))
    let cx = 0
    let cy = 0
    let geles = 0
    for (let i = 0; i < n; i++) {
      if (sim.frozen[i] !== 1) continue
      cx += sim.posX[i]
      cy += sim.posY[i]
      geles++
    }
    cx /= geles
    cy /= geles
    let r2 = 0
    let voisin = 0
    for (let i = 0; i < n; i++) {
      if (sim.frozen[i] !== 1) continue
      r2 += (sim.posX[i] - cx) ** 2 + (sim.posY[i] - cy) ** 2
      let plusProche = Infinity
      for (let j = 0; j < n; j++) {
        if (j === i || sim.frozen[j] !== 1) continue
        const d = Math.hypot(sim.posX[i] - sim.posX[j], sim.posY[i] - sim.posY[j])
        if (d < plusProche) plusProche = d
        if (d <= linkR) parent[find(i)] = find(j)
      }
      voisin += plusProche
    }
    const amas = new Set<number>()
    for (let i = 0; i < n; i++) if (sim.frozen[i] === 1) amas.add(find(i))
    return { rms: Math.sqrt(r2 / geles), voisin: voisin / geles, amas: amas.size, geles }
  }

  it('un palet qui tourne garde son rayon (la rotation est exacte, pas tangente)', () => {
    // Avant : à 8 rad/s, +50 % de rayon en 4 s ; à 14 rad/s (le plafond),
    // le plus proche voisin passait de 6,6 à 12,8 u — au bord du rayon de
    // lien (13,2), le bloc éclatait.
    for (const omega of [8, 14]) {
      const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
      sim.setLevel([], [])
      palet(sim, 0, 0, 0, 0, omega)
      const avant = forme(sim)
      run(sim, 4)
      const apres = forme(sim)
      expect(apres.rms, `ω = ${omega}`).toBeCloseTo(avant.rms, 0)
      expect(apres.voisin, `ω = ${omega}`).toBeCloseTo(avant.voisin, 0)
      expect(apres.amas).toBe(1)
    }
  })

  it('un palet ne se tasse pas en butant : le premier rang ressort avec les autres', () => {
    // Avant : à 600 u/s, le premier rang s'enfonçait de 5 u par pas et se
    // faisait pousser seul hors du mur — 14 % de tassement après un choc
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sim.setLevel([{ minX: 200, minY: -500, maxX: 240, maxY: 500, material: MAT_WALL }], [])
    palet(sim, -60, 0, 600, 0)
    run(sim, 1)
    const { voisin, amas } = forme(sim)
    expect(voisin).toBeGreaterThan(E * 0.98)
    expect(voisin).toBeLessThan(E * 1.02)
    expect(amas).toBe(1)
  })

  it('après une dizaine de rebonds entre deux bumpers, le palet est toujours d’un seul tenant', () => {
    // La salle qui éclatait : deux parois hydrophobes face à face, le palet
    // relancé sans fin. Avant : 47 amas au 9e rebond, puis 4 particules
    // encore gelées — le reste, détaché du corps, avait dégelé.
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sim.setLevel(
      [
        { minX: 200, minY: -500, maxX: 240, maxY: 500, material: MAT_HYDROPHOBE },
        { minX: -440, minY: -500, maxX: -400, maxY: 500, material: MAT_HYDROPHOBE },
      ],
      [],
    )
    palet(sim, -60, 0, 320, 0)
    const avant = forme(sim)
    let chocs = 0
    for (let s = 0; s < 1800; s++) {
      sim.iceImpact = 0
      sim.step(sim.params.dt)
      if (sim.iceImpact > 60) chocs++
    }
    const apres = forme(sim)
    expect(chocs).toBeGreaterThanOrEqual(10)
    expect(apres.geles).toBe(64)
    expect(apres.amas).toBe(1)
    expect(apres.rms).toBeCloseTo(avant.rms, 0)
  })
})
