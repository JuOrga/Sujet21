import { describe, expect, it } from 'vitest'
import {
  COINS_OBLIQUES,
  COTES_OBLIQUES,
  POIGNEES_OBLIQUES,
  estCote,
  pivotPoignee,
  pointPoignee,
  redimensionneOblique,
} from './oblique'

const pres = (o: { minX: number; minY: number; maxX: number; maxY: number }) => ({
  minX: Math.round(o.minX * 1000) / 1000,
  minY: Math.round(o.minY * 1000) / 1000,
  maxX: Math.round(o.maxX * 1000) / 1000,
  maxY: Math.round(o.maxY * 1000) / 1000,
})
const E = COTES_OBLIQUES.find((p) => p.code === 'E')!
const N = COTES_OBLIQUES.find((p) => p.code === 'N')!
const NE = COINS_OBLIQUES.find((p) => p.code === 'NE')!

describe('les poignées d’une boîte oblique', () => {
  it('huit poignées : quatre coins, quatre milieux de côté', () => {
    expect(POIGNEES_OBLIQUES.map((p) => p.code)).toEqual(['NW', 'NE', 'SW', 'SE', 'N', 'S', 'W', 'E'])
    expect(COTES_OBLIQUES.every(estCote)).toBe(true)
    expect(COINS_OBLIQUES.some(estCote)).toBe(false)
  })

  it('une boîte droite : les poignées tombent aux coins et aux milieux, le pivot en face', () => {
    const b = { minX: 0, minY: 0, maxX: 100, maxY: 40 }
    expect(pointPoignee(b, NE)).toEqual({ x: 100, y: 40 })
    expect(pointPoignee(b, E)).toEqual({ x: 100, y: 20 })
    expect(pivotPoignee(b, E)).toEqual({ x: 0, y: 20 })
    expect(pivotPoignee(b, NE)).toEqual({ x: 0, y: 0 })
  })

  it('une boîte tournée de 90° : le côté E se retrouve en haut', () => {
    const b = { minX: 0, minY: 0, maxX: 100, maxY: 40, angle: 90 }
    const e = pointPoignee(b, E)
    expect(Math.round(e.x)).toBe(50)
    expect(Math.round(e.y)).toBe(70) // centre (50, 20) + 50 vers +y
  })

  it('tirer un CÔTÉ n’étire qu’un axe : le mur s’allonge, son épaisseur ne bouge pas', () => {
    // un mur de 100 × 20 penché à 30°, on tire son bout E jusqu'à 160 de long
    const angle = 30
    const b = { minX: 0, minY: 0, maxX: 100, maxY: 20, angle }
    const pivot = pivotPoignee(b, E) // le milieu du côté W, cloué
    const rad = (angle * Math.PI) / 180
    const cible = { x: pivot.x + Math.cos(rad) * 160, y: pivot.y + Math.sin(rad) * 160 }
    const r = redimensionneOblique(pivot, angle, cible, E, { w: 100, h: 20 }, 4)
    expect(Math.round(r.maxX - r.minX)).toBe(160)
    expect(Math.round(r.maxY - r.minY)).toBe(20) // l'épaisseur est intacte
    // le côté W n'a pas bougé : le pivot est toujours le milieu du côté W
    const apres = pivotPoignee({ ...r, angle }, E)
    expect(Math.round(apres.x)).toBe(Math.round(pivot.x))
    expect(Math.round(apres.y)).toBe(Math.round(pivot.y))
  })

  it('tirer un côté en biais n’emporte pas l’autre axe : seule la projection compte', () => {
    const b = { minX: 0, minY: 0, maxX: 100, maxY: 20 }
    const pivot = pivotPoignee(b, N) // le milieu du côté S : (50, 0)
    // on tire vers le haut ET vers la droite : la hauteur suit, la largeur reste 100
    const r = redimensionneOblique(pivot, 0, { x: 90, y: 60 }, N, { w: 100, h: 20 }, 4)
    expect(pres(r)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 60 })
  })

  it('tirer un COIN étire les deux axes, le coin opposé cloué', () => {
    const b = { minX: 0, minY: 0, maxX: 100, maxY: 20 }
    const pivot = pivotPoignee(b, NE) // (0, 0)
    const r = redimensionneOblique(pivot, 0, { x: 130, y: 50 }, NE, { w: 100, h: 20 }, 4)
    expect(pres(r)).toEqual({ minX: 0, minY: 0, maxX: 130, maxY: 50 })
  })

  it('la dimension minimale tient, et un côté ne descend pas sous le pas', () => {
    const b = { minX: 0, minY: 0, maxX: 100, maxY: 20 }
    const pivot = pivotPoignee(b, E)
    const r = redimensionneOblique(pivot, 0, { x: 1, y: 10 }, E, { w: 100, h: 20 }, 8)
    expect(pres(r)).toEqual({ minX: 0, minY: 0, maxX: 8, maxY: 20 })
    // l'axe NON tiré n'est jamais borné : un mur de 2 d'épaisseur reste à 2
    const fin = redimensionneOblique(pivotPoignee({ ...b, maxY: 2 }, E), 0, { x: 50, y: 1 }, E, { w: 100, h: 2 }, 8)
    expect(pres(fin)).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 2 })
  })
})
