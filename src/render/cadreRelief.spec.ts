import { describe, expect, it } from 'vitest'
import { cadreRelief } from './renderer'

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
