// LE VAISSEAU EN PERSPECTIVE : ce qui doit tenir — un seul point de fuite
// au-dessus de la salle, les arêtes qui y filent, la mini-carte rangée en
// profondeur (voies → gauche–droite, rangs → profondeur), et l'ordre du
// peintre.

import { describe, expect, it } from 'vitest'
import {
  FLOTTANTS_SOMMET,
  MAT_COULOIR,
  MAT_FEU,
  MAT_MODULE,
  MAT_MODULE_PAROI,
  MAT_TOIT,
  MAT_ZONE,
  composeVaisseau,
  zoneDuBiome,
  geometrieVaisseau,
  pointDeFuite,
  projette,
  type SceneVaisseau,
} from './vaisseau'

const salle = { minX: -500, minY: -300, maxX: 500, maxY: 300 }
const joignables = new Set(['3:0', '3:1', '4:0', '4:1', '4:2', '5:1'])
const scene: SceneVaisseau = {
  salle,
  biome: 'cryo',
  carte: { rangs: 6, voies: 3, rang: 2, voie: 1, joignables },
  modules: [
    { biome: 'chaud', distance: 1, cote: -1 },
    { biome: 'tempere', distance: 2, cote: 1 },
  ],
}

describe('vaisseau — le point de fuite et la projection', () => {
  const f = pointDeFuite(salle)

  it('le point de fuite est au centre, au-dessus de la salle et de sa zone', () => {
    expect(f.x).toBe(0)
    const zone = composeVaisseau(scene).find((b) => b.sorte === 'zone')!
    expect(f.y).toBeGreaterThan(zone.rect.maxY)
  })

  it('au plan avant, rien ne bouge ; au loin, tout converge vers le point de fuite', () => {
    expect(projette(f, 123, -45, 0)).toEqual([123, -45])
    const [x, y] = projette(f, 4000, -3000, 1e6)
    expect(x).toBeCloseTo(f.x, 1)
    expect(y).toBeCloseTo(f.y, 1)
  })

  it('une arête qui s’enfonce reste une droite qui file EXACTEMENT vers le point de fuite', () => {
    const a = projette(f, 700, -200, 0.1)
    const b = projette(f, 700, -200, 0.9)
    // F, a et b alignés : produit vectoriel nul
    const cross = (a[0] - f.x) * (b[1] - f.y) - (a[1] - f.y) * (b[0] - f.x)
    expect(Math.abs(cross)).toBeLessThan(1e-6)
  })
})

describe('vaisseau — la mini-carte rangée en profondeur', () => {
  const boites = composeVaisseau(scene)
  const salles = boites.filter((b) => b.sorte === 'salle')

  it('tout est DERRIÈRE la salle (z > 0)', () => {
    for (const b of boites) expect(b.z0).toBeGreaterThan(0)
  })

  it('les salles jouées et la salle courante ne se dessinent pas : seuls les rangs à venir', () => {
    // rangs 3, 4, 5 × 3 voies
    expect(salles).toHaveLength(9)
  })

  it('la voie où l’on joue est dans l’axe de la salle ; les rangs s’enfoncent', () => {
    const axe = salles.filter((s) => Math.abs((s.rect.minX + s.rect.maxX) / 2) < 1).sort((a, b) => a.z0 - b.z0)
    expect(axe).toHaveLength(3)
    expect(axe[1].z0).toBeGreaterThan(axe[0].z0)
    expect(axe[2].z0).toBeGreaterThan(axe[1].z0)
  })

  it('les salles joignables du rang suivant ont leurs feux allumés ; les fermées sont éteintes', () => {
    const rang3 = salles.filter((s) => s.z0 === Math.min(...salles.map((x) => x.z0)))
    const etats = rang3.sort((a, b) => a.rect.minX - b.rect.minX).map((s) => s.etat)
    expect(etats).toEqual([2, 2, 0]) // 3:0 et 3:1 joignables, 3:2 fermée
  })

  it('un couloir part vers chaque salle joignable, aucun vers une salle fermée', () => {
    const couloirs = boites.filter((b) => b.sorte === 'couloir')
    expect(couloirs).toHaveLength(joignables.size)
  })

  it('les autres modules sont au-delà du dernier rang, et d’autant plus loin qu’ils le sont sur la carte', () => {
    const mods = boites.filter((b) => b.sorte === 'module')
    const zSalles = Math.max(...salles.map((s) => s.z0 + s.dz))
    for (const m of mods) expect(m.z0).toBeGreaterThan(zSalles)
    expect(mods[1].z0).toBeGreaterThan(mods[0].z0)
  })

  it('hors d’une run (pas de mini-carte) : un module générique, toutes salles en veille', () => {
    const b = composeVaisseau({ ...scene, carte: null })
    const s = b.filter((x) => x.sorte === 'salle')
    expect(s.length).toBeGreaterThan(0)
    for (const x of s) expect(x.etat).toBe(1)
  })
})

describe('vaisseau — la géométrie, du plus loin au plus près', () => {
  const boites = composeVaisseau(scene)
  const g = geometrieVaisseau(boites, pointDeFuite(salle))

  it('des triangles entiers, neuf flottants par sommet', () => {
    expect(g.length % (FLOTTANTS_SOMMET * 3)).toBe(0)
    expect(g.length).toBeGreaterThan(0)
  })

  it('l’ordre du peintre : la face avant de la zone (la plus proche) est tracée en dernier parmi les faces', () => {
    // z de la face avant de chaque face tracée : non croissant en moyenne
    // par boîte — on vérifie au moins que la première face est la plus loin
    let zMax = 0
    for (let i = 2; i < g.length; i += FLOTTANTS_SOMMET) zMax = Math.max(zMax, g[i])
    expect(g[2]).toBeGreaterThan(zMax * 0.5)
    // et que la dernière face opaque (émission 0) est à la profondeur de la zone
    let dernier = -1
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) if (g[i + 8] !== MAT_FEU) dernier = i
    expect(g[dernier + 2]).toBeLessThan(0.1)
  })
})

describe('vaisseau — chaque face prend son image', () => {
  const boites = composeVaisseau(scene)
  const g = geometrieVaisseau(boites, pointDeFuite(salle))
  const mats = new Set<number>()
  for (let i = 8; i < g.length; i += FLOTTANTS_SOMMET) mats.add(g[i])

  it('la zone est pavée de son biome, les salles portent leur toit', () => {
    expect(mats.has(MAT_ZONE)).toBe(true)
    expect(mats.has(MAT_TOIT)).toBe(true)
  })

  it('les modules portent leur toit et leurs flancs à hublots, les couloirs leur tube', () => {
    expect(mats.has(MAT_MODULE)).toBe(true)
    expect(mats.has(MAT_MODULE_PAROI)).toBe(true)
    expect(mats.has(MAT_COULOIR)).toBe(true)
  })

  it('le tube d’un couloir est étiré, jamais répété : uv de 0 à 1, sa longueur dans la profondeur', () => {
    let vus = 0
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) {
      if (g[i + 8] !== MAT_COULOIR) continue
      vus++
      for (const k of [3, 4]) {
        expect(g[i + k]).toBeGreaterThanOrEqual(0)
        expect(g[i + k]).toBeLessThanOrEqual(1)
      }
    }
    expect(vus).toBeGreaterThan(0)
    // sur une face qui s'enfonce, u suit z : 0 au bord proche, 1 au bord lointain
    const couloirs = boites.filter((b) => b.sorte === 'couloir')
    const zs = new Set(couloirs.flatMap((b) => [b.z0, b.z0 + b.dz]).map((z) => z.toFixed(5)))
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) {
      if (g[i + 8] !== MAT_COULOIR || !zs.has(g[i + 2].toFixed(5))) continue
      const b = couloirs.find((c) => Math.abs(c.z0 - g[i + 2]) < 1e-5 || Math.abs(c.z0 + c.dz - g[i + 2]) < 1e-5)!
      if (Math.abs(b.z0 + b.dz - g[i + 2]) < 1e-5) expect(g[i + 3]).toBe(1)
    }
  })

  it('le toit d’une salle est étiré sur sa face avant (uv de 0 à 1)', () => {
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) {
      if (g[i + 8] !== MAT_TOIT) continue
      expect(g[i + 3]).toBeGreaterThanOrEqual(0)
      expect(g[i + 3]).toBeLessThanOrEqual(1)
      expect(g[i + 4]).toBeGreaterThanOrEqual(0)
      expect(g[i + 4]).toBeLessThanOrEqual(1)
    }
  })
})

describe('vaisseau — la zone de chaque biome', () => {
  it('les trois zones livrées, et la tempérée pour les biomes qui attendent la leur', () => {
    expect(zoneDuBiome('cryo')).toBe('cryo')
    expect(zoneDuBiome('chaud')).toBe('chaud')
    expect(zoneDuBiome('antichambre')).toBe('tempere')
    expect(zoneDuBiome('')).toBe('tempere')
  })
})
