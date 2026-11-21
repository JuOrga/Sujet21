import { describe, expect, it } from 'vitest'
import { REGARD_PORTEE, coeursDe, tourneRegard } from './renduMulti'
import { attributs, particulesVides, type Particules } from './trame'

// Le rendu lui-même est un shader : il se juge à l'œil, dans un navigateur.
// Ce qui le NOURRIT se teste ici — le cœur de chaque corps, autour duquel le
// miroir est radial, et le regard, qui se tourne vers ce que le joueur vise.

/** Un disque plein de particules de corps du joueur `j`, de rayon `r`, plus
 *  des gouttes libres au loin (qui ne doivent pas compter). */
function disque(p: Particules, j: number, cx: number, cy: number, r: number, pas = 6): void {
  for (let y = -r; y <= r; y += pas) {
    for (let x = -r; x <= r; x += pas) {
      if (x * x + y * y > r * r) continue
      p.x[p.n] = cx + x
      p.y[p.n] = cy + y
      p.attr[p.n] = attributs(j, true, 0)
      p.n++
    }
  }
}
function goutte(p: Particules, j: number, x: number, y: number, orpheline = false): void {
  p.x[p.n] = x
  p.y[p.n] = y
  p.attr[p.n] = attributs(orpheline ? 4 : j, false, 0)
  p.n++
}

describe('rendu du multi — le cœur des corps', () => {
  it('le cœur est le centre des particules DU CORPS, et son rayon celui du disque', () => {
    const p = particulesVides(4096)
    disque(p, 0, 700, 600, 100)
    disque(p, 1, 2100, 650, 60)
    // des gouttes en vol, une matière sans maître : ni l'une ni l'autre ne
    // tire le cœur à elle
    goutte(p, 0, 3000, 100)
    goutte(p, 0, 2900, 120)
    goutte(p, 1, 0, 0, true)
    const c = coeursDe(p, new Float32Array(16))
    expect(c[0]).toBeCloseTo(700, 0)
    expect(c[1]).toBeCloseTo(600, 0)
    expect(c[3]).toBe(1)
    expect(c[4]).toBeCloseTo(2100, 0)
    expect(c[5]).toBeCloseTo(650, 0)
    // √2 fois l'écart quadratique rend le rayon d'un disque plein (à la
    // maille près : 6 u)
    expect(Math.abs(c[2] - 100)).toBeLessThan(4)
    expect(Math.abs(c[6] - 60)).toBeLessThan(4)
    // personne aux canaux 2 et 3
    expect(Array.from(c.subarray(8, 16))).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('un corps réduit à quelques particules n’a pas de cœur', () => {
    const p = particulesVides(64)
    for (let k = 0; k < 11; k++) {
      p.x[k] = 500 + k
      p.y[k] = 500
      p.attr[k] = attributs(0, true, 0)
    }
    p.n = 11
    const c = coeursDe(p, new Float32Array(16).fill(7))
    expect(Array.from(c.subarray(0, 4))).toEqual([0, 0, 0, 0])
  })
})

describe('rendu du multi — le regard', () => {
  it('il se tourne vers le point visé, sans sortir de la masse', () => {
    const e = new Float32Array(4)
    // né : posé d'emblée, à sa portée, du côté visé
    tourneRegard(e, 0, 1000, 500, 100, true, 1900, 500, 0.016)
    expect(e[0]).toBeCloseTo(REGARD_PORTEE * 100, 3)
    expect(e[1]).toBeCloseTo(0, 3)
    expect(e[2]).toBe(1)
    // la visée passe en bas : il la rejoint, pas d'un coup
    tourneRegard(e, 0, 1000, 500, 100, true, 1000, 1400, 0.016)
    expect(e[0]).toBeGreaterThan(REGARD_PORTEE * 100 * 0.7)
    expect(e[1]).toBeGreaterThan(0)
    let plusLoin = 0
    for (let k = 0; k < 60; k++) {
      tourneRegard(e, 0, 1000, 500, 100, true, 1000, 1400, 0.016)
      plusLoin = Math.max(plusLoin, Math.hypot(e[0], e[1]))
    }
    expect(e[0]).toBeCloseTo(0, 1)
    expect(e[1]).toBeCloseTo(REGARD_PORTEE * 100, 1)
    // en route il n'a jamais dépassé sa portée (une corde, pas un détour)
    expect(plusLoin).toBeLessThanOrEqual(REGARD_PORTEE * 100 + 1e-3)
  })

  it('visé SUR le corps, le regard s’y pose (il ne file pas au bord)', () => {
    const e = new Float32Array(4)
    tourneRegard(e, 0, 1000, 500, 100, true, 1012, 495, 0.016)
    expect(e[0]).toBeCloseTo(12, 3)
    expect(e[1]).toBeCloseTo(-5, 3)
  })

  it('c’est un ÉCART au cœur : le corps peut filer, le regard le suit d’un bloc', () => {
    const e = new Float32Array(4)
    tourneRegard(e, 0, 1000, 500, 100, true, 1900, 500, 0.016)
    const avant = e[0]
    // le corps a fait 400 u d'une image à l'autre, la visée a suivi
    tourneRegard(e, 0, 1400, 500, 100, true, 2300, 500, 0.016)
    expect(e[0]).toBeCloseTo(avant, 3)
  })

  it('un corps sans cœur n’a pas de regard, et le retrouve d’emblée', () => {
    const e = new Float32Array(4)
    tourneRegard(e, 0, 1000, 500, 100, true, 1900, 500, 0.016)
    tourneRegard(e, 0, 0, 0, 0, false, 1900, 500, 0.016)
    expect(e[2]).toBe(0)
    tourneRegard(e, 0, 300, 300, 80, true, 300, -900, 0.016)
    expect(e[0]).toBeCloseTo(0, 3)
    expect(e[1]).toBeCloseTo(-REGARD_PORTEE * 80, 3)
    expect(e[2]).toBe(1)
  })
})
