import { describe, expect, it } from 'vitest'
import { labelComponents } from './components'

function adjacencyOf(edges: [number, number][]): (i: number, cb: (j: number) => void) => void {
  const map = new Map<number, number[]>()
  for (const [a, b] of edges) {
    if (!map.has(a)) map.set(a, [])
    if (!map.has(b)) map.set(b, [])
    map.get(a)!.push(b)
    map.get(b)!.push(a)
  }
  return (i, cb) => {
    for (const j of map.get(i) ?? []) cb(j)
  }
}

describe('labelComponents', () => {
  it('sépare deux amas et un isolé', () => {
    const n = 7
    const labels = new Int32Array(n)
    const stack = new Int32Array(n)
    // amas {0,1,2}, amas {3,4,5}, isolé {6}
    const count = labelComponents(
      n,
      labels,
      adjacencyOf([
        [0, 1],
        [1, 2],
        [3, 4],
        [4, 5],
      ]),
      stack,
    )
    expect(count).toBe(3)
    expect(labels[0]).toBe(labels[1])
    expect(labels[1]).toBe(labels[2])
    expect(labels[3]).toBe(labels[4])
    expect(labels[0]).not.toBe(labels[3])
    expect(labels[6]).not.toBe(labels[0])
    expect(labels[6]).not.toBe(labels[3])
  })

  it('fusionne deux amas reliés par un pont', () => {
    const n = 6
    const labels = new Int32Array(n)
    const stack = new Int32Array(n)
    const count = labelComponents(
      n,
      labels,
      adjacencyOf([
        [0, 1],
        [1, 2],
        [2, 3], // le pont
        [3, 4],
        [4, 5],
      ]),
      stack,
    )
    expect(count).toBe(1)
  })
})
