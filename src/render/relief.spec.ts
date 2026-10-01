import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ANGLE_OBLIQUE_DEG,
  HAUTEUR_VUE_OBLIQUE,
  PAS_TRANCHE_OBLIQUE,
  decalageSommet,
  parametresRelief,
} from './relief'

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
    expect(decalageSommet(p, -200, 0, 0, 0, 1).x).toBeCloseTo(-14)
    expect(decalageSommet(p, 0, 0, 0, 0, 1)).toEqual({ x: 0, y: 0 })
  })

  it('radial : il s’efface sous le zoom de carte', () => {
    const p = parametresRelief('fort')
    expect(decalageSommet(p, 500, 500, 0, 0, 0)).toEqual({ x: 0, y: 0 })
    const plein = decalageSommet(p, 500, 500, 0, 0, 1)
    const mi = decalageSommet(p, 500, 500, 0, 0, 0.4)
    expect(mi.x).toBeCloseTo(plein.x * 0.48)
    expect(mi.y).toBeCloseTo(plein.y * 0.48)
  })

  it('oblique : le MÊME décalage partout — toutes les parois montrent la même face', () => {
    const p = parametresRelief('oblique')
    expect(p.k).toBeGreaterThan(0) // l'interrupteur de la tranche dans le shader
    const a = decalageSommet(p, -900, 400, 0, 0, 0.14)
    const b = decalageSommet(p, 1500, -2000, 30, 70, 1)
    expect(a).toEqual(b)
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(HAUTEUR_VUE_OBLIQUE)
    // le sommet monte (caméra au sud) et glisse un peu vers la droite
    expect(a.y).toBeGreaterThan(0)
    expect(a.x).toBeGreaterThan(0)
    expect(a.x).toBeLessThan(a.y)
    expect((Math.atan2(a.y, a.x) * 180) / Math.PI).toBeCloseTo(ANGLE_OBLIQUE_DEG)
  })

  it('oblique : au zoom de JEU, le décalage se VOIT à l’écran', () => {
    // le défaut du premier réglage : fondu sous le zoom de carte, le
    // décalage tombait à un pixel au zoom de jeu ordinaire (~0,14 px/u)
    const p = parametresRelief('oblique')
    for (const zoom of [0.12, 0.14, 0.3]) {
      const d = decalageSommet(p, 0, 0, 0, 0, zoom)
      expect(Math.hypot(d.x, d.y) * zoom).toBeGreaterThanOrEqual(15)
    }
  })

  it('oblique : la tranche ne s’ouvre pas sur les murs ordinaires', () => {
    // un pas d'échantillonnage plus large qu'une coque ordinaire (40 u)
    // ouvrirait un jour entre la base et le sommet
    expect(HAUTEUR_VUE_OBLIQUE / PAS_TRANCHE_OBLIQUE).toBeLessThanOrEqual(16)
  })

  it('le shader porte la même formule que le jumeau', () => {
    const src = readFileSync(new URL('./renderer.ts', import.meta.url), 'utf8')
    expect(src).toContain('uniform vec2 uReliefDecal;')
    expect(src).toMatch(
      /vec2 relDisp = reliefOblique\s*\? uReliefDecal\s*: \(world - uCenter\) \* \(uRelief \* clamp\(uZoom \* 1\.2, 0\.0, 1\.0\)\);/,
    )
    expect(src).toContain(`int pasTranche = reliefOblique ? ${PAS_TRANCHE_OBLIQUE} : 4;`)
    expect(src).toContain("gl.uniform2f(cu['uReliefDecal']")
  })
})
