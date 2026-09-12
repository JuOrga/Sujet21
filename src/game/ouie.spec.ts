import { describe, expect, it } from 'vitest'
import { OUIE_EAU, ouieDe, panDepuis } from './ouie'

describe("l'ouïe du Sujet", () => {
  // exp(log(x)) rend x à l'arrondi flottant près : on compare à la virgule
  const pareil = (a: ReturnType<typeof ouieDe>, b: ReturnType<typeof ouieDe>): void => {
    expect(a.coupure).toBeCloseTo(b.coupure, 6)
    expect(a.aigus).toBeCloseTo(b.aigus, 9)
    expect(a.niveau).toBeCloseTo(b.niveau, 9)
  }
  it("en eau, c'est l'oreille de l'eau", () => {
    pareil(ouieDe(0, 0), OUIE_EAU)
  })
  it('la glace assourdit, la vapeur ouvre', () => {
    const glace = ouieDe(1, 0)
    const vapeur = ouieDe(0, 1)
    expect(glace.coupure).toBeLessThan(OUIE_EAU.coupure)
    expect(glace.niveau).toBeLessThan(1)
    expect(vapeur.coupure).toBeGreaterThan(OUIE_EAU.coupure)
    expect(vapeur.aigus).toBeGreaterThan(0)
  })
  it('une transformation à moitié est entre les deux, en octaves', () => {
    const demi = ouieDe(0.5, 0)
    const attendu = Math.sqrt(OUIE_EAU.coupure * ouieDe(1, 0).coupure)
    expect(demi.coupure).toBeCloseTo(attendu, 0)
  })
  it('borne les fractions : rien ne dépasse', () => {
    pareil(ouieDe(3, 0), ouieDe(1, 0))
    pareil(ouieDe(-1, -1), OUIE_EAU)
  })
})

describe('le panoramique depuis le corps', () => {
  it('à droite du corps, à droite ; à gauche, à gauche ; dessus, au centre', () => {
    expect(panDepuis(100, 450)).toBeCloseTo(0.425)
    expect(panDepuis(100, -250)).toBeCloseTo(-0.425)
    expect(panDepuis(100, 100)).toBe(0)
  })
  it('jamais tout à fait dans une oreille', () => {
    expect(panDepuis(0, 100000)).toBeCloseTo(0.85)
    expect(panDepuis(0, -100000)).toBeCloseTo(-0.85)
  })
})
