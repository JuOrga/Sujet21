// LE VAISSEAU EN PERSPECTIVE : ce qui doit tenir — un seul point de fuite
// sur un horizon BAS au-dessus de la salle, les arêtes qui y filent, la
// mini-carte posée sur le pont (voies → gauche–droite, rangs → profondeur),
// les modules qui bordent l'allée, et l'ordre du peintre.

import { describe, expect, it } from 'vitest'
import {
  FLOTTANTS_SOMMET,
  MAT_COULOIR,
  MAT_FACADE,
  MAT_FEU,
  MAT_MODULE,
  MAT_MODULE_PAROI,
  MAT_PONT,
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

  it('l’horizon est BAS : à moins d’une hauteur de salle au-dessus de la zone (le premier jet : 1,8)', () => {
    const zone = composeVaisseau(scene).find((b) => b.sorte === 'zone')!
    expect(f.y - zone.rect.maxY).toBeLessThanOrEqual(salle.maxY - salle.minY)
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

  it('tout est POSÉ sur le pont, et reste sous l’horizon (on en voit le toit)', () => {
    const sol = boites.find((b) => b.sorte === 'zone')!.rect.maxY
    const f = pointDeFuite(salle)
    for (const b of boites.filter((x) => x.sorte === 'salle' || x.sorte === 'module')) {
      expect(b.rect.minY).toBe(sol)
      expect(b.rect.maxY).toBeLessThan(f.y)
    }
  })

  it('un tube part vers chaque salle joignable, aucun vers une salle fermée ; un tube couché relie deux voisines ouvertes', () => {
    const couloirs = boites.filter((b) => b.sorte === 'couloir')
    const vers = couloirs.filter((c) => c.rect.maxX - c.rect.minX < 1.5 * (c.rect.maxY - c.rect.minY))
    expect(vers).toHaveLength(joignables.size)
    // rang 3 : 3:0–3:1 ; rang 4 : 4:0–4:1 et 4:1–4:2 ; rang 5 : seule 5:1
    expect(couloirs.length - vers.length).toBe(3)
  })

  it('les autres modules BORDENT l’allée, chacun de son côté de la carte, d’autant plus loin qu’ils le sont', () => {
    const mods = boites.filter((b) => b.sorte === 'module')
    const gauche = Math.min(...salles.map((s) => s.rect.minX))
    const droite = Math.max(...salles.map((s) => s.rect.maxX))
    expect(mods[0].rect.maxX).toBeLessThan(gauche) // chaud, côté −1
    expect(mods[1].rect.minX).toBeGreaterThan(droite) // tempéré, côté +1
    expect(mods[1].z0).toBeGreaterThan(mods[0].z0)
  })

  it('deux modules du même côté se suivent à la file, sans se chevaucher', () => {
    const b = composeVaisseau({ ...scene, modules: [{ biome: 'chaud', distance: 1, cote: -1 }, { biome: 'cryo', distance: 1, cote: -0.4 }] })
    const [a, c] = b.filter((x) => x.sorte === 'module').sort((m, n) => m.z0 - n.z0)
    expect(c.z0).toBeGreaterThanOrEqual(a.z0 + a.dz)
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

  it('l’ordre du peintre : le pont d’abord, puis les modules, la face avant de la zone en dernier', () => {
    expect(g[8]).toBe(MAT_PONT)
    // les modules passent avant toute salle
    let premiereSalle = -1
    let dernierModule = -1
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) {
      if (g[i + 8] === MAT_TOIT && premiereSalle < 0) premiereSalle = i
      if (g[i + 8] === MAT_MODULE_PAROI || g[i + 8] === MAT_MODULE) dernierModule = i
    }
    expect(dernierModule).toBeLessThan(premiereSalle)
    // la dernière face opaque est la face avant de la zone
    let dernier = -1
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) if (g[i + 8] !== MAT_FEU) dernier = i
    expect(g[dernier + 8]).toBe(MAT_ZONE)
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

  it('chaque salle montre sa façade, étirée une fois (uv de 0 à 1)', () => {
    let n = 0
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) {
      if (g[i + 8] !== MAT_FACADE) continue
      n++
      for (const k of [3, 4]) expect([0, 1]).toContain(g[i + k])
    }
    expect(n).toBe(9 * 6) // neuf salles, deux triangles chacune
  })

  it('les feux d’une salle joignable sont dans ses deux hublots ; une salle fermée n’en a aucun', () => {
    const feux = (b: (typeof boites)[number]) => {
      const pts: number[][] = []
      for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET * 6) {
        if (g[i + 8] !== MAT_FEU || Math.abs(g[i + 2] - b.z0) > 1e-6) continue
        // centre du carré du feu : moyenne des sommets 0 et 2
        const cx = (g[i] + g[i + FLOTTANTS_SOMMET * 2]) / 2
        if (cx >= b.rect.minX && cx <= b.rect.maxX) pts.push([cx, (g[i + 1] + g[i + FLOTTANTS_SOMMET * 2 + 1]) / 2])
      }
      return pts
    }
    const rang = boites.filter((b) => b.sorte === 'salle').sort((a, b) => a.z0 - b.z0 || a.rect.minX - b.rect.minX).slice(0, 3)
    const ouverte = rang[0]
    const w = ouverte.rect.maxX - ouverte.rect.minX
    const xs = feux(ouverte).map((p) => (p[0] - ouverte.rect.minX) / w).sort()
    expect(xs[0]).toBeCloseTo(0.36, 3)
    expect(xs[1]).toBeCloseTo(0.64, 3)
    expect(feux(rang[2])).toHaveLength(0) // 3:2, fermée
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
    // le tube qui file vers le rang suivant : u suit z, 0 au bord proche,
    // 1 au bord lointain — les colliers aux deux bouts
    const vers = boites.filter((c) => c.sorte === 'couloir' && c.rect.maxX - c.rect.minX < 1.5 * (c.rect.maxY - c.rect.minY))
    let loin = 0
    for (let i = 0; i < g.length; i += FLOTTANTS_SOMMET) {
      if (g[i + 8] !== MAT_COULOIR) continue
      const c = vers.find((t) => g[i] >= t.rect.minX - 1e-6 && g[i] <= t.rect.maxX + 1e-6 && Math.abs(t.z0 + t.dz - g[i + 2]) < 1e-5)
      if (!c) continue
      expect(g[i + 3]).toBe(1)
      loin++
    }
    expect(loin).toBeGreaterThan(0)
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
