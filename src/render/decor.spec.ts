// LE DÉCOR PEINT : la salle tombe sur l'ouverture de l'image, quelle que soit
// sa taille, et l'allée suit la caméra de moins en moins vers l'horizon.

import { describe, expect, it } from 'vitest'
import { AMBRE, BLEU, GABARITS, LOINTAIN, PARALLAXE_HORIZON, decorDuBiome, feuxDecor, parallaxe, placeDecor, placeLointain } from './decor'

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

describe('décor peint — la couche lointaine', () => {
  it('son point de fuite tombe sur celui de l’allée, à sa largeur relative', () => {
    const p = placeDecor({ minX: -534, minY: -364, maxX: 534, maxY: 364 }, g)
    const r = placeLointain(p, g)
    const k = (r.maxX - r.minX) / LOINTAIN.largeur
    const fx = p.image.minX + g.fuite.x * p.echelle
    const fy = p.image.maxY - g.fuite.y * p.echelle
    expect(r.minX + LOINTAIN.fuite.x * k).toBeCloseTo(fx, 6)
    expect(r.maxY - LOINTAIN.fuite.y * k).toBeCloseTo(fy, 6)
    expect((r.maxX - r.minX) / (p.image.maxX - p.image.minX)).toBeCloseTo(LOINTAIN.largeurRelative, 9)
  })
})

describe('décor peint — le lien avec la mini-carte, en lumière', () => {
  const vue = (rangsDevant: number, j: string[]) => ({ rangsDevant, voies: 3, joignables: new Set(j) })

  it('ambre sur les joignables du rang suivant, bleu plus loin, rien sur les fermées', () => {
    const f = feuxDecor(g, vue(4, ['1:0', '1:1', '2:1', '3:2']))
    const ambre = f.filter((x) => x.couleur === AMBRE)
    const bleu = f.filter((x) => x.couleur === BLEU)
    expect(ambre.map((x) => [x.x, x.y])).toEqual([g.portes[0][0], g.portes[0][1]].map(([x, y]) => [x, y]))
    expect(bleu.map((x) => [x.x, x.y])).toEqual([g.portes[1][1], g.portes[2][2]].map(([x, y]) => [x, y]))
    expect(f).toHaveLength(4) // 1:2, et les autres rangs, restent éteints
  })

  it('les rangs au-delà de la fin du module ne s’allument pas', () => {
    const f = feuxDecor(g, vue(1, ['1:1', '2:1']))
    expect(f).toHaveLength(1)
  })

  it('plus de rang devant : le sas de la cloison s’allume — la sortie', () => {
    const f = feuxDecor(g, vue(0, []))
    expect(f).toEqual([{ x: g.sas[0], y: g.sas[1], r: g.sas[2], couleur: AMBRE, force: 1 }])
  })

  it('hors d’une run : toutes les portes en veille', () => {
    const f = feuxDecor(g, null)
    expect(f).toHaveLength(g.portes.flat().length)
    for (const x of f) expect(x.couleur).toBe(BLEU)
  })
})
