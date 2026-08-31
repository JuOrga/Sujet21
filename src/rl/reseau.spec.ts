// Le réseau est écrit à la main : ses gradients doivent être vérifiés à la
// main aussi. Un gradient faux n'échoue pas — il apprend lentement quelque
// chose de faux, et on met des jours à s'en apercevoir.

import { describe, expect, it } from 'vitest'
import {
  Adam,
  Reseau,
  argmax,
  entropie,
  probabilites,
  tire,
} from './reseau'
import { alea } from './politique'

describe('Reseau — la passe arrière dit la vérité', () => {
  it('ses gradients collent aux différences finies', () => {
    const rnd = alea(11)
    const net = new Reseau([4, 6, 5, 3], rnd, 1)
    const x = Float64Array.from([0.3, -0.7, 0.9, 0.1])
    // Une fonctionnelle linéaire quelconque de la sortie : dL/dsortie = poids
    const poidsSortie = [0.5, -1.25, 2]
    const perte = (): number => {
      const y = net.avant(x)
      let s = 0
      for (let i = 0; i < y.length; i++) s += poidsSortie[i] * y[i]
      return s
    }
    perte()
    const g = net.gradientsVides()
    net.arriere(poidsSortie, g.gW, g.gb)

    const eps = 1e-6
    // quelques poids pris au hasard dans chaque couche, plus tous les biais
    for (let l = 0; l < net.nbCouches; l++) {
      const indices = [0, 3 % net.W[l].length, net.W[l].length - 1]
      for (const i of indices) {
        const avant = net.W[l][i]
        net.W[l][i] = avant + eps
        const plus = perte()
        net.W[l][i] = avant - eps
        const moins = perte()
        net.W[l][i] = avant
        const numerique = (plus - moins) / (2 * eps)
        expect(g.gW[l][i]).toBeCloseTo(numerique, 6)
      }
      for (let j = 0; j < net.b[l].length; j++) {
        const avant = net.b[l][j]
        net.b[l][j] = avant + eps
        const plus = perte()
        net.b[l][j] = avant - eps
        const moins = perte()
        net.b[l][j] = avant
        expect(g.gb[l][j]).toBeCloseTo((plus - moins) / (2 * eps), 6)
      }
    }
  })

  it('naît sans conviction : toutes les actions à peu près équiprobables', () => {
    const net = new Reseau([8, 16, 5], alea(3))
    const p = probabilites(net.avant(new Float64Array(8).fill(0.4)), new Float64Array(5))
    for (const v of p) expect(v).toBeGreaterThan(0.15)
    expect(entropie(p)).toBeGreaterThan(Math.log(5) - 0.02)
  })

  it('s’exporte et se réimporte à l’identique', () => {
    const a = new Reseau([5, 7, 3], alea(4), 1)
    const b = new Reseau([5, 7, 3], alea(99), 1)
    b.importe(a.exporte())
    const x = Float64Array.from([1, -1, 0.5, 0.25, -0.75])
    expect(Array.from(b.avant(x))).toEqual(Array.from(a.avant(x)))
    expect(a.nbPoids).toBe(5 * 7 + 7 + 7 * 3 + 3)
  })

  it('Adam descend une parabole, et le plafond de norme la borne', () => {
    const p = Float64Array.from([10])
    const adam = new Adam([p], 0.5)
    for (let i = 0; i < 50; i++) adam.pas([Float64Array.from([2 * p[0]])], 1e9)
    expect(Math.abs(p[0])).toBeLessThan(9)
    const q = Float64Array.from([0])
    const borne = new Adam([q], 1)
    borne.pas([Float64Array.from([1000])], 0.5) // gradient énorme, pas borné
    expect(Math.abs(q[0])).toBeLessThanOrEqual(1.001)
  })

  it('le tirage suit la loi, argmax prend le plus probable', () => {
    const probs = Float64Array.from([0.1, 0.7, 0.2])
    expect(tire(probs, 0.05)).toBe(0)
    expect(tire(probs, 0.5)).toBe(1)
    expect(tire(probs, 0.95)).toBe(2)
    expect(argmax([1, 9, 4])).toBe(1)
  })
})
