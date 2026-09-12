import { describe, expect, it } from 'vitest'
import { dangerDevant, directionDeMarche, saccade, type Saccade } from './regard'

describe('la saccade', () => {
  const neuve = (): Saccade => ({ x: 0, y: 0, t0: 0, duree: 1 })
  it('ne bouge pas pour un petit écart pendant la pose', () => {
    const s = neuve()
    expect(saccade(s, 30, 20, 0.5, () => 0.5)).toBe(false)
    expect(s.x).toBe(0)
  })
  it('saute quand la cible a bougé assez', () => {
    const s = neuve()
    expect(saccade(s, 100, 0, 0.5, () => 0.5)).toBe(true)
    expect(s.x).toBe(100)
    expect(s.t0).toBe(0.5)
  })
  it('saute aussi quand la pose a duré, même pour un petit écart', () => {
    const s = neuve()
    expect(saccade(s, 30, 20, 1.2, () => 0.5)).toBe(true)
    expect(s.y).toBe(20)
    // la prochaine pose est tirée entre 0,4 et 1,5 s
    expect(s.duree).toBeCloseTo(0.4 + 0.5 * 1.1)
  })
})

describe('la direction de marche', () => {
  it('suit la vitesse quand le corps bouge', () => {
    const d = directionDeMarche(300, 0, 0, 0, 999, 999)
    expect(d).toEqual({ dx: 1, dy: 0 })
  })
  it("à l'arrêt, c'est l'opposé du point d'éjection", () => {
    const d = directionDeMarche(0, 0, 0, 0, 0, -50)
    expect(d?.dx).toBeCloseTo(0)
    expect(d?.dy).toBeCloseTo(1)
  })
  it('rien à dire quand le jet est sur le corps', () => {
    expect(directionDeMarche(0, 0, 10, 10, 10, 10)).toBeNull()
  })
})

describe('le danger devant', () => {
  const points = [
    { x: 300, y: 0 }, // devant, proche
    { x: 600, y: 0 }, // devant, plus loin
    { x: 0, y: 300 }, // sur le côté
    { x: -300, y: 0 }, // derrière
  ]
  it('rend le plus proche dans le cône', () => {
    expect(dangerDevant(0, 0, 1, 0, points, 1000)).toEqual({ x: 300, y: 0 })
  })
  it('ignore le côté et l’arrière', () => {
    expect(dangerDevant(0, 0, 0, -1, points, 1000)).toBeNull()
  })
  it('respecte la portée', () => {
    expect(dangerDevant(0, 0, 1, 0, points, 200)).toBeNull()
  })
})
