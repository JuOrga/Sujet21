import { describe, expect, it } from 'vitest'
import { DEBORD_SALLE, DEMI_HAUTEUR_MIN, MARGE_CORPS, cadreSalle, cadreVoulu, ecranVersMonde, mondeVersEcran, suitCadre } from './cadrage'
import { SALLE } from './partie'

const ASPECT = 16 / 9
const corps = (x: number, y: number, disperse = false) => ({ x, y, disperse })

describe('le cadrage du multi', () => {
  it('la vue d’ensemble contient toute la salle, à tout rapport d’écran', () => {
    for (const a of [16 / 9, 4 / 3, 21 / 9, 9 / 16]) {
      const c = cadreSalle(SALLE, a)
      expect(c.cx - c.demiL).toBeLessThanOrEqual(SALLE.minX - DEBORD_SALLE + 1e-6)
      expect(c.cx + c.demiL).toBeGreaterThanOrEqual(SALLE.maxX + DEBORD_SALLE - 1e-6)
      expect(c.cy - c.demiH).toBeLessThanOrEqual(SALLE.minY - DEBORD_SALLE + 1e-6)
      expect(c.cy + c.demiH).toBeGreaterThanOrEqual(SALLE.maxY + DEBORD_SALLE - 1e-6)
      expect(c.demiL / c.demiH).toBeCloseTo(a, 6)
    }
  })

  it('les deux corps sont toujours dans le cadre, avec leur marge — où qu’ils soient', () => {
    const positions: [number, number, number, number][] = [
      [960, 1080, 2880, 1080],
      [100, 100, 3700, 2000],
      [1900, 1000, 1950, 1100],
      [50, 2100, 60, 2110],
      [3800, 30, 200, 2100],
    ]
    for (const [x0, y0, x1, y1] of positions) {
      const c = cadreVoulu([corps(x0, y0), corps(x1, y1)], SALLE, ASPECT)
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        expect(Math.abs(x - c.cx)).toBeLessThanOrEqual(c.demiL)
        expect(Math.abs(y - c.cy)).toBeLessThanOrEqual(c.demiH)
      }
      expect(c.demiL / c.demiH).toBeCloseTo(ASPECT, 6)
    }
  })

  it('deux corps proches : on regarde de près, mais jamais de plus près que le minimum', () => {
    const c = cadreVoulu([corps(1900, 1080), corps(1960, 1080)], SALLE, ASPECT)
    expect(c.demiH).toBeCloseTo(DEMI_HAUTEUR_MIN, 6)
    expect(c.demiL).toBeLessThan(cadreSalle(SALLE, ASPECT).demiL / 2)
  })

  it('deux corps aux deux bouts : la vue d’ensemble, pas plus large', () => {
    const c = cadreVoulu([corps(120, 1080), corps(3720, 1080)], SALLE, ASPECT)
    expect(c).toEqual(cadreSalle(SALLE, ASPECT))
  })

  it('un corps collé au mur ne fait pas cadrer le vide derrière le mur', () => {
    const c = cadreVoulu([corps(20, 20), corps(60, 40)], SALLE, ASPECT)
    expect(c.cx - c.demiL).toBeGreaterThanOrEqual(SALLE.minX - DEBORD_SALLE - 1e-6)
    expect(c.cy - c.demiH).toBeGreaterThanOrEqual(SALLE.minY - DEBORD_SALLE - 1e-6)
  })

  it('un corps dispersé ne compte plus ; sans personne, on montre la salle', () => {
    const seul = cadreVoulu([corps(600, 600), corps(3600, 2000, true)], SALLE, ASPECT)
    expect(Math.abs(seul.cx - 600)).toBeLessThan(MARGE_CORPS + 200)
    expect(seul.demiH).toBeCloseTo(DEMI_HAUTEUR_MIN, 6)
    expect(cadreVoulu([corps(1, 1, true), corps(2, 2, true)], SALLE, ASPECT)).toEqual(cadreSalle(SALLE, ASPECT))
    expect(cadreVoulu([], SALLE, ASPECT)).toEqual(cadreSalle(SALLE, ASPECT))
  })

  it('la caméra suit en douceur, sans dépasser, et ne bouge pas à dt nul', () => {
    const a = cadreSalle(SALLE, ASPECT)
    const b = cadreVoulu([corps(600, 600), corps(700, 650)], SALLE, ASPECT)
    expect(suitCadre(a, b, 0)).toEqual(a)
    const mi = suitCadre(a, b, 1 / 60)
    expect(mi.demiL).toBeLessThan(a.demiL)
    expect(mi.demiL).toBeGreaterThan(b.demiL)
    let c = a
    for (let k = 0; k < 600; k++) c = suitCadre(c, b, 1 / 60)
    expect(c.demiL).toBeCloseTo(b.demiL, 2)
    expect(c.cx).toBeCloseTo(b.cx, 2)
  })

  it('le pointeur va au monde et en revient', () => {
    const c = cadreVoulu([corps(900, 700), corps(1500, 1300)], SALLE, ASPECT)
    expect(ecranVersMonde(c, 0.5, 0.5)).toEqual({ x: c.cx, y: c.cy })
    // le haut de l'écran est le HAUT du monde (y vers le bas, comme l'écran)
    expect(ecranVersMonde(c, 0.5, 0).y).toBeCloseTo(c.cy - c.demiH, 6)
    const m = ecranVersMonde(c, 0.2, 0.9)
    const e = mondeVersEcran(c, m.x, m.y)
    expect(e.fx).toBeCloseTo(0.2, 9)
    expect(e.fy).toBeCloseTo(0.9, 9)
  })
})
