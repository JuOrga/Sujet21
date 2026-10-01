import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ANGLE_OBLIQUE_DEG, HAUTEUR_VUE_OBLIQUE, decalageSommet, parametresRelief } from './relief'

describe('le relief des parois', () => {
  it('les modes radiaux gardent leurs coefficients, sans décalage fixe', () => {
    expect(parametresRelief('off')).toEqual({ k: 0, decalX: 0, decalY: 0 })
    expect(parametresRelief('leger')).toEqual({ k: 0.035, decalX: 0, decalY: 0 })
    expect(parametresRelief('fort')).toEqual({ k: 0.07, decalX: 0, decalY: 0 })
  })

  it('radial : le sommet fuit le centre, proportionnellement à l’écart', () => {
    const p = parametresRelief('fort')
    const d = decalageSommet(p, 100, 0, 0, 0, 1)
    expect(d.x).toBeCloseTo(7)
    expect(d.y).toBe(0)
    const g = decalageSommet(p, -200, 0, 0, 0, 1)
    expect(g.x).toBeCloseTo(-14)
    expect(decalageSommet(p, 0, 0, 0, 0, 1)).toEqual({ x: 0, y: 0 })
  })

  it('oblique : le MÊME décalage partout — toutes les parois montrent la même face', () => {
    const p = parametresRelief('oblique')
    expect(p.k).toBeGreaterThan(0) // l'interrupteur de la tranche dans le shader
    const a = decalageSommet(p, -900, 400, 0, 0, 1)
    const b = decalageSommet(p, 1500, -2000, 30, 70, 1)
    expect(a).toEqual(b)
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(HAUTEUR_VUE_OBLIQUE)
    // le sommet monte (caméra au sud) et glisse un peu vers la droite
    expect(a.y).toBeGreaterThan(0)
    expect(a.x).toBeGreaterThan(0)
    expect(a.x).toBeLessThan(a.y)
    expect((Math.atan2(a.y, a.x) * 180) / Math.PI).toBeCloseTo(ANGLE_OBLIQUE_DEG)
  })

  it('oblique : le sommet ne décolle pas des murs minces', () => {
    // la tranche est échantillonnée au quart du décalage : un pas plus
    // large que les murs les plus minces y ouvrirait un jour
    expect(HAUTEUR_VUE_OBLIQUE / 4).toBeLessThanOrEqual(16)
  })

  it('les deux modes s’effacent sous le zoom de carte', () => {
    for (const mode of ['fort', 'oblique'] as const) {
      const p = parametresRelief(mode)
      expect(decalageSommet(p, 500, 500, 0, 0, 0)).toEqual({ x: 0, y: 0 })
      const plein = decalageSommet(p, 500, 500, 0, 0, 1)
      const mi = decalageSommet(p, 500, 500, 0, 0, 0.4)
      expect(mi.x).toBeCloseTo(plein.x * 0.48)
      expect(mi.y).toBeCloseTo(plein.y * 0.48)
    }
  })

  it('le shader porte la même formule que le jumeau', () => {
    const src = readFileSync(new URL('./renderer.ts', import.meta.url), 'utf8')
    expect(src).toContain('uniform vec2 uReliefDecal;')
    expect(src).toMatch(
      /vec2 relDisp = \(dot\(uReliefDecal, uReliefDecal\) > 0\.0 \? uReliefDecal : \(world - uCenter\) \* uRelief\)\s*\* clamp\(uZoom \* 1\.2, 0\.0, 1\.0\);/,
    )
    expect(src).toContain("gl.uniform2f(cu['uReliefDecal']")
  })
})
