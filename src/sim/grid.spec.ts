import { describe, expect, it } from 'vitest'
import { SpatialGrid } from './grid'

// Générateur déterministe pour des tests reproductibles
function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

describe('SpatialGrid', () => {
  it('trouve exactement les mêmes voisins que la recherche brute', () => {
    const rng = makeRng(42)
    const n = 300
    const posX = new Float32Array(n)
    const posY = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      posX[i] = rng() * 400 - 200
      posY[i] = rng() * 300 - 150
    }
    const radius = 25
    const grid = new SpatialGrid(-220, -170, 220, 170, radius, n)
    grid.build(posX, posY, n)

    for (const i of [0, 17, 123, 299]) {
      const found = new Set<number>()
      grid.forEachNeighbor(posX[i], posY[i], radius, (j) => {
        const dx = posX[i] - posX[j]
        const dy = posY[i] - posY[j]
        if (dx * dx + dy * dy <= radius * radius) found.add(j)
      })
      const expected = new Set<number>()
      for (let j = 0; j < n; j++) {
        const dx = posX[i] - posX[j]
        const dy = posY[i] - posY[j]
        if (dx * dx + dy * dy <= radius * radius) expected.add(j)
      }
      expect(found).toEqual(expected)
    }
  })

  it('gère les points hors bornes en les rattachant aux cellules de bord', () => {
    const posX = new Float32Array([-1000, 1000])
    const posY = new Float32Array([-1000, 1000])
    const grid = new SpatialGrid(-100, -100, 100, 100, 10, 2)
    grid.build(posX, posY, 2)
    const seen: number[] = []
    grid.forEachNeighbor(-1000, -1000, 20, (j) => seen.push(j))
    expect(seen).toContain(0)
  })
})
