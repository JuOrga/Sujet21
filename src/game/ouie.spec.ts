import { describe, expect, it } from 'vitest'
import { NAPPE_ELAN, NAPPE_REPOS, OUIE_EAU, ouieDe, panDepuis, souffleNappe } from './ouie'

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

describe('le souffle de la nappe de vapeur', () => {
  it("immobile, le nuage se tait presque — plus de bourdon qui tourne à vide", () => {
    expect(souffleNappe(0, false, 820)).toBe(NAPPE_REPOS)
    expect(NAPPE_REPOS).toBeLessThan(0.15)
  })
  it('le souffle monte avec la vitesse, sans saut', () => {
    const lent = souffleNappe(100, false, 820)
    const moyen = souffleNappe(250, false, 820)
    const vif = souffleNappe(410, false, 820)
    expect(lent).toBeGreaterThan(NAPPE_REPOS)
    expect(moyen).toBeGreaterThan(lent)
    expect(vif).toBeCloseTo(NAPPE_ELAN)
    expect(souffleNappe(5000, false, 820)).toBeCloseTo(NAPPE_ELAN)
  })
  it('la visée garde la nappe pleine, même à l’arrêt', () => {
    expect(souffleNappe(0, true, 820)).toBe(1)
  })
})
