// LE DÉCOR PEINT : la salle tombe sur l'ouverture de l'image, quelle que soit
// sa taille, et l'allée suit la caméra de moins en moins vers l'horizon.

import { describe, expect, it } from 'vitest'
import { GABARITS, PARALLAXE_HORIZON, decorDuBiome, parallaxe, placeDecor } from './decor'

const g = GABARITS.tempere

describe('décor peint — placer l’image autour de la salle', () => {
  for (const salle of [
    { minX: -534, minY: -364, maxX: 534, maxY: 364 },
    { minX: 1000, minY: 200, maxX: 4000, maxY: 1100 }, // plate : réglée sur la hauteur
    { minX: 0, minY: 0, maxX: 800, maxY: 1400 }, // haute : réglée sur la largeur
  ]) {
    const p = placeDecor(salle, g)
    const versMonde = (px: number, py: number) => [p.image.minX + px * p.echelle, p.image.maxY - py * p.echelle]

    it(`la salle couvre toute l’ouverture, au plus juste (${salle.maxX - salle.minX} × ${salle.maxY - salle.minY} u)`, () => {
      const [x0, yb] = versMonde(g.ouvertureGauche, g.ouvertureBas)
      const [x1] = versMonde(g.ouvertureDroite, g.ouvertureBas)
      expect(x0).toBeGreaterThanOrEqual(salle.minX - 1e-6)
      expect(x1).toBeLessThanOrEqual(salle.maxX + 1e-6)
      expect(yb).toBeGreaterThanOrEqual(salle.minY - 1e-6)
      // au plus juste : la largeur OU la hauteur de l'ouverture est celle de la salle
      const serreX = Math.abs(x1 - x0 - (salle.maxX - salle.minX)) < 1e-6
      const serreY = Math.abs(yb - salle.minY) < 1e-6
      expect(serreX || serreY).toBe(true)
    })

    it('le haut de l’ouverture — où arrive la passerelle — est sur le bord haut de la salle', () => {
      const [, y] = versMonde(0, g.ouvertureHaut)
      expect(y).toBeCloseTo(salle.maxY, 6)
    })

    it('l’image garde ses proportions', () => {
      const r = (p.image.maxX - p.image.minX) / (p.image.maxY - p.image.minY)
      expect(r).toBeCloseTo(g.largeur / g.hauteur, 6)
    })

    it('la salle couvre toute l’ouverture, même son haut plus étroit', () => {
      const [x0] = versMonde(g.ouvertureGauche, g.ouvertureHaut)
      const [x1] = versMonde(g.ouvertureDroite, g.ouvertureHaut)
      expect(x0).toBeGreaterThanOrEqual(salle.minX - 1e-6)
      expect(x1).toBeLessThanOrEqual(salle.maxX + 1e-6)
    })
  }
})

describe('décor peint — les couches', () => {
  it('le premier plan suit le monde ; l’allée de moins en moins vers l’horizon', () => {
    expect(parallaxe(g.ouvertureHaut / g.hauteur, g)).toBe(0)
    expect(parallaxe(0.95, g)).toBe(0)
    expect(parallaxe(g.horizon / g.hauteur, g)).toBeCloseTo(PARALLAXE_HORIZON, 9)
    const a = parallaxe(0.5, g)
    const b = parallaxe(0.3, g)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
  })

  it('les biomes sans image prennent la tempérée', () => {
    expect(decorDuBiome('tempere')).toBe('tempere')
    expect(decorDuBiome('cryo')).toBe('tempere')
  })
})
