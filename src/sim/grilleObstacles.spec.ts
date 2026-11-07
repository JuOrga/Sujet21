import { describe, expect, it } from 'vitest'
import { GrilleObstacles, horsBoite, type BoiteBornee } from './grilleObstacles'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER } from './solver'
import { TABLEAUX, MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_WALL, type LevelDef } from '../game/level'
import { genereNiveau, OPTIONS_DEFAUT } from '../game/generateur'

// Un tirage reproductible : les échecs doivent se rejouer à l'identique.
function alea(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('La grille des parois — une liste de candidats conservatrice et ordonnée', () => {
  const bornes: BoiteBornee = { minX: -1000, minY: -600, maxX: 1400, maxY: 900 }

  function boitesAuHasard(r: () => number, n: number): BoiteBornee[] {
    const out: BoiteBornee[] = []
    for (let k = 0; k < n; k++) {
      // certaines débordent des bornes, certaines sont tournées
      const x = -1300 + r() * 3000
      const y = -900 + r() * 2100
      const w = 4 + r() * 600
      const h = 4 + r() * 300
      out.push({
        minX: x,
        minY: y,
        maxX: x + w,
        maxY: y + h,
        ...(r() < 0.3 ? { angle: r() * Math.PI } : {}),
      })
    }
    return out
  }

  it('aucune paroi à portée ne manque à la case du point, et l’ordre est croissant', () => {
    const r = alea(21)
    for (let essai = 0; essai < 20; essai++) {
      const boites = boitesAuHasard(r, 25)
      const marge = 3 + r() * 120
      const g = new GrilleObstacles()
      g.construit(boites, bornes, marge)
      for (let k = 0; k < 2000; k++) {
        // des points dedans, sur les bords et loin hors des bornes
        const x = -2000 + r() * 4500
        const y = -1500 + r() * 3300
        const c = g.caseDe(x, y)
        const candidats = Array.from(g.liste.subarray(g.debut[c], g.debut[c + 1]))
        for (let q = 1; q < candidats.length; q++)
          expect(candidats[q]).toBeGreaterThan(candidats[q - 1])
        // toute marge jusqu'à celle de construction est couverte
        const m = r() * marge
        for (let bi = 0; bi < boites.length; bi++) {
          if (!horsBoite(boites[bi], x, y, m)) expect(candidats).toContain(bi)
        }
      }
    }
  })

  it('se sait périmée : liste remplacée, paroi ajoutée sur place, marge changée', () => {
    const boites: BoiteBornee[] = [{ minX: 0, minY: 0, maxX: 10, maxY: 10 }]
    const g = new GrilleObstacles()
    g.construit(boites, bornes, 5)
    expect(g.aJour(boites, 5)).toBe(true)
    expect(g.aJour(boites, 6)).toBe(false)
    expect(g.aJour([...boites], 5)).toBe(false)
    // le banc d'essai de la glace pousse sa paroi dans sim.boxes
    boites.push({ minX: 50, minY: 0, maxX: 60, maxY: 10 })
    expect(g.aJour(boites, 5)).toBe(false)
  })

  it('un champ immense élargit ses cases plutôt que d’enfler', () => {
    const g = new GrilleObstacles()
    g.construit([], { minX: 0, minY: 0, maxX: 60000, maxY: 60000 }, 5)
    expect(g.nx * g.ny).toBeLessThanOrEqual((1 << 16) + 2 * 1300)
    expect(g.cote).toBeGreaterThan(48)
  })
})

// L'étalon : la même salle, les mêmes gestes, une fois avec la grille, une
// fois en balayant toutes les parois comme avant. Rien ne doit différer —
// pas une position, pas une vitesse, pas un contact, au bit près.
describe('La grille des parois ne change rien à la physique', () => {
  function rejoue(lv: LevelDef, grille: boolean, pas: number): FluidSim {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
    sim.grilleParois = grille
    sim.setLevel(lv.boxes, lv.sponges)
    sim.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n, KIND_PLAYER)
    sim.relabel()
    // un corps qui se brasse, pour toucher des parois dès les premiers pas
    for (let i = 0; i < sim.count; i++) {
      sim.velX[i] = 260 * Math.cos(i)
      sim.velY[i] = 260 * Math.sin(i * 1.7)
    }
    // de la vapeur libre : elle sent les bandes de loin (hydroGasReach) et
    // passe les grilles — les deux portées de la chimie sont exercées
    for (let k = 0; k < 40; k++) {
      const i = sim.addParticle(lv.spawn.x + 30 * Math.cos(k), lv.spawn.y + 30 * Math.sin(k), KIND_FREE)
      sim.vapor[i] = 1
      sim.gaseous[i] = 1
      sim.velX[i] = 300 * Math.cos(k * 2.3)
      sim.velY[i] = 300 * Math.sin(k * 2.3)
    }
    const dt = sim.params.dt
    for (let s = 0; s < pas; s++) {
      if (s % 60 === 0) sim.eject(lv.spawn.x + 300, lv.spawn.y + 200, dt)
      // une porte qui se ferme en pleine course : la grille doit suivre
      if (s === pas / 2) {
        sim.setDoors([
          { minX: lv.spawn.x + 60, minY: lv.spawn.y - 200, maxX: lv.spawn.x + 90, maxY: lv.spawn.y + 200 },
        ])
      }
      sim.step(dt)
    }
    return sim
  }

  // LE CAS DE LA REPRISE, construit exprès : les salles ne le produisent
  // presque jamais (le sabotage de la reprise passait leurs 6 parités). Une
  // particule enfoncée dans la paroi A, à 1 de son bord droit, en ressort
  // dans la case VOISINE — contre la paroi B, que sa case de départ ne
  // listait pas. Sans la reprise du balayage complet, B serait ignorée.
  it('une particule repoussée dans une autre case bute encore sur la paroi d’à côté', () => {
    const fin = (grille: boolean): FluidSim => {
      const sim = new FluidSim({ ...DEFAULT_PARAMS }, { minX: 0, minY: 0, maxX: 400, maxY: 200 }, 64)
      sim.grilleParois = grille
      sim.setLevel(
        [
          { minX: 0, minY: 0, maxX: 96, maxY: 100, material: MAT_WALL }, // A : cases 0 et 1
          { minX: 101, minY: 0, maxX: 200, maxY: 100, material: MAT_WALL }, // B : à partir de la case 2
        ],
        [],
      )
      sim.addParticle(95, 50, KIND_FREE) // case 1 (48–96), dans A
      sim.step(sim.params.dt)
      return sim
    }
    const sans = fin(false)
    // le décor a bien parlé deux fois : sortie de A (vers x ≈ 99,3), puis B
    // la renvoie vers la gauche — sinon le cas ne prouverait rien
    expect(sans.posX[0]).toBeLessThan(99)
    identiques(sans, fin(true))
  })

  function identiques(a: FluidSim, b: FluidSim): void {
    expect(b.count).toBe(a.count)
    const n = a.count
    for (const champ of ['posX', 'posY', 'velX', 'velY', 'contactMat'] as const) {
      const ta = Array.from(a[champ].subarray(0, n))
      const tb = Array.from(b[champ].subarray(0, n))
      expect(tb).toEqual(ta)
    }
  }

  // les salles générées : celles qui ont le plus de parois (10 à 20)
  const generees = [5, 6, 7].map((g) => genereNiveau(g))
  // une salle FIGURE : un champ immense, des formes (disques, arcs)
  const figure = genereNiveau(3, null, { ...OPTIONS_DEFAUT, figure: 1 })
  // les tableaux faits main : chimie (hydrophile, hydrophobe) et le plus de parois
  const chimie = TABLEAUX.filter((lv) =>
    lv.boxes.some((b) => b.material === MAT_HYDROPHILE || b.material === MAT_HYDROPHOBE),
  )
    .sort((a, b) => b.boxes.length - a.boxes.length)
    .slice(0, 2)

  for (const lv of [...generees, figure, ...chimie]) {
    it(`${lv.name} : mêmes trajectoires avec et sans grille`, () => {
      identiques(rejoue(lv, false, 240), rejoue(lv, true, 240))
    })
  }
})
