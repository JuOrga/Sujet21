import { describe, expect, it } from 'vitest'
import { cadreRelief, rectsDisjoints } from './renderer'

// Le jumeau du shader : au pixel w, la composition lit le sommet des parois
// au point w − (w − centre)·k (relDisp). La repasse nette de la conduite
// doit couvrir tous les pixels où ce point tombe dans la boîte.
const lu = (w: number, centre: number, k: number): number => w - (w - centre) * k

describe('le cadre de la repasse nette sous le relief', () => {
  it('sans relief, la boîte seule', () => {
    expect(cadreRelief(100, 300, 0, 0)).toEqual([100, 300])
  })

  it('couvre chaque pixel qui dessine le sommet de la boîte', () => {
    for (const [a, b, c] of [
      [400, 460, 0], // à droite du centre
      [-900, -800, 0], // à gauche
      [-50, 60, 0], // à cheval sur le centre
    ]) {
      const k = 0.07 // le relief « fort »
      const [x0, x1] = cadreRelief(a, b, c, k)
      for (let w = -2000; w <= 2000; w += 0.5) {
        const p = lu(w, c, k)
        if (p >= a && p <= b) {
          expect(w).toBeGreaterThanOrEqual(x0 - 1e-9)
          expect(w).toBeLessThanOrEqual(x1 + 1e-9)
        }
      }
    }
  })
})

describe('la passe nette ne fond jamais deux fois le même pixel', () => {
  type R = [number, number, number, number]
  const couvre = (rs: R[], x: number, y: number): number =>
    rs.filter(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1).length
  const aire = (rs: R[]): number => rs.reduce((s, [x0, y0, x1, y1]) => s + (x1 - x0) * (y1 - y0), 0)

  it('des rectangles disjoints restent tels quels', () => {
    const r: R[] = [[0, 0, 10, 10], [20, 0, 30, 10]]
    expect(rectsDisjoints(r)).toEqual(r)
  })

  it('chaque pixel couvert au départ l’est EXACTEMENT une fois, et nul autre', () => {
    const rects: R[] = [[0, 0, 12, 6], [10, 4, 18, 14], [30, 30, 40, 40], [16, 12, 22, 20], [2, 2, 8, 30]]
    const r = rectsDisjoints(rects)
    for (let x = -2; x < 45; x++)
      for (let y = -2; y < 45; y++) expect(couvre(r, x, y)).toBe(couvre(rects, x, y) > 0 ? 1 : 0)
  })

  it('deux conduites en L : la surface de leur RÉUNION, pas de leur enveloppe', () => {
    // 1800 × 60 et 60 × 1200, qui se touchent au coin : l'enveloppe ferait
    // 1800 × 1200 = 2,16 M px ; la réunion, 108 000 + 72 000 − 3 600
    const r = rectsDisjoints([[0, 0, 1800, 60], [0, 0, 60, 1200]])
    expect(aire(r)).toBe(1800 * 60 + 60 * 1200 - 60 * 60)
  })
})
