// LA PROFONDEUR DES COUCHES DE FOND : deux propriétés à graver.
//
// La première est une garantie de non-régression : à zoom = 1, la nouvelle
// formule doit rendre EXACTEMENT l'ancienne. La seconde est l'intention même
// du réglage : à zoom = 0, une couche ne change pas de taille quand la
// caméra grossit — c'est ce qui fait qu'elle est loin.

import { describe, expect, it } from 'vitest'
import {
  PARALLAXE_DEFAUTS,
  PLAQUE_DEFAUTS,
  cadrePlaque,
  coucheFond,
  empriseEcran,
  type Couche,
} from './parallaxe'

/** L'ANCIENNE formule, telle qu'elle était écrite dans le shader :
 *  `world - uCenter * lag`, où lag est le retard de la couche. */
const ancienne = (w: number, c: number, lag: number): number => w - c * lag

describe('parallaxe — la couche collée au monde', () => {
  it('à zoom 1, rend l’ancienne formule au chiffre près, à tout grossissement', () => {
    const couche: Couche = { suivi: 0.38, zoom: 1 } // le ciel d'avant : retard 0,62
    for (const z of [0.12, 0.3, 0.42, 1, 3]) {
      const p = coucheFond(1234, -567, 300, -80, z, couche, 0.42)
      expect(p.x).toBeCloseTo(ancienne(1234, 300, 0.62), 6)
      expect(p.y).toBeCloseTo(ancienne(-567, -80, 0.62), 6)
    }
  })

  it('vaut aussi pour la paroi de cuve et pour le semis', () => {
    const paroi: Couche = { suivi: 0.9, zoom: 1 }
    expect(coucheFond(800, 0, 200, 0, 0.2, paroi, 0.42).x).toBeCloseTo(
      ancienne(800, 200, 0.1),
      6,
    )
    const semis: Couche = { suivi: 1, zoom: 1 } // le semis était collé au monde
    expect(coucheFond(800, 0, 200, 0, 0.9, semis, 0.42).x).toBeCloseTo(800, 6)
  })
})

describe('parallaxe — la couche lointaine', () => {
  it('à zoom 0, garde la même taille apparente quel que soit le grossissement', () => {
    const loin: Couche = { suivi: 0.38, zoom: 0 }
    const a = empriseEcran(1280, 0.15, loin, 0.42)
    const b = empriseEcran(1280, 0.42, loin, 0.42)
    const c = empriseEcran(1280, 1.4, loin, 0.42)
    expect(a).toBeCloseTo(b, 6)
    expect(b).toBeCloseTo(c, 6)
  })

  it('entre les deux, elle grandit MOINS que le monde — dans les deux sens', () => {
    const monde: Couche = { suivi: 1, zoom: 1 }
    const loin = PARALLAXE_DEFAUTS.ciel
    const ref = PARALLAXE_DEFAUTS.ref
    // « emprise » = les unités de texture que couvre la largeur d'écran :
    // plus elle est PETITE, plus le motif paraît GROS.
    const emp = (z: number, c: Couche): number => empriseEcran(1280, z, c, ref)

    // EN SE RAPPROCHANT (le corps rétrécit, la caméra plonge : 0,15 → 0,6),
    // le monde grossit de plein fouet ; la station lointaine, beaucoup moins
    const serreMonde = emp(0.6, monde) / emp(ref, monde)
    const serreLoin = emp(0.6, loin) / emp(ref, loin)
    expect(serreMonde).toBeLessThan(1) // le monde grossit
    expect(serreLoin).toBeGreaterThan(serreMonde) // la station grossit moins
    expect(serreLoin).toBeLessThan(1) // mais elle grossit quand même

    // EN S'ÉLOIGNANT (0,15 → 0,12, la butée), même hiérarchie à l'envers
    const largeMonde = emp(0.12, monde) / emp(ref, monde)
    const largeLoin = emp(0.12, loin) / emp(ref, loin)
    expect(largeMonde).toBeGreaterThan(largeLoin)
    expect(largeLoin).toBeGreaterThan(1)
  })

  it('au zoom d’étalonnage, toutes les couches s’accordent avec le monde', () => {
    const ref = PARALLAXE_DEFAUTS.ref
    for (const c of [PARALLAXE_DEFAUTS.ciel, PARALLAXE_DEFAUTS.semis, PARALLAXE_DEFAUTS.cuve]) {
      expect(empriseEcran(1280, ref, c, ref)).toBeCloseTo(1280 / ref, 6)
    }
  })

  it('l’ordre des couches est celui des distances : ciel < semis < paroi', () => {
    const d = PARALLAXE_DEFAUTS
    expect(d.ciel.zoom).toBeLessThan(d.semis.zoom)
    expect(d.semis.zoom).toBeLessThan(d.cuve.zoom)
    expect(d.cuve.zoom).toBeLessThanOrEqual(1)
    expect(d.ciel.suivi).toBeLessThan(d.cuve.suivi)
  })
})

describe('la plaque de ciel, cadrée — une seule Voie lactée, jamais floue', () => {
  const FORMATS = [[1280, 720, 1], [1280, 800, 2], [720, 1280, 3], [2560, 1080, 1], [390, 844, 3]]
  const ZOOMS = [1e-6, 0.01, 0.05, 0.12, 0.3, 1, 3, 15]

  it('un pixel d’image ne couvre jamais plus de grossMax pixels physiques', () => {
    for (const [w, h, dpr] of FORMATS)
      for (const tex of [1254, 2048, 4096])
        for (const z of ZOOMS) {
          const c = cadrePlaque(0, 0, z, w, h, dpr, tex)
          const pxEcranParTexel = dpr / (c.parPx * tex)
          expect(pxEcranParTexel).toBeLessThanOrEqual(PLAQUE_DEFAUTS.grossMax + 1e-9)
        }
  })

  it('le centre de la galaxie ne quitte jamais l’écran, où qu’aille la caméra', () => {
    for (const [w, h, dpr] of FORMATS)
      for (const z of ZOOMS)
        for (const x of [-1e7, -2250, 0, 900, 1e7])
          for (const y of [-1e7, -750, 0, 1e7]) {
            const c = cadrePlaque(x, y, z, w, h, dpr, 1254)
            // où se dessine le centre de l'image, en px CSS depuis le centre
            expect(Math.abs((0.5 - c.cx) / c.parPx)).toBeLessThan(w / 2)
            expect(Math.abs((0.5 - c.cy) / c.parPx)).toBeLessThan(h / 2)
          }
  })

  it('assez de texels : elle prend la taille réglée ; en reculant, elle rapetisse', () => {
    const d = PLAQUE_DEFAUTS
    // une image de 4096 sur un écran de 1280 × 720 n'est jamais agrandie
    expect(1 / cadrePlaque(0, 0, d.ref, 1280, 720, 1, 4096).parPx).toBeCloseTo(1280 * d.taille, 6)
    const loin = 1 / cadrePlaque(0, 0, 0.15, 1280, 720, 1, 4096).parPx
    const pres = 1 / cadrePlaque(0, 0, 0.6, 1280, 720, 1, 4096).parPx
    expect(loin).toBeLessThan(pres)
  })

  it('la caméra qui se déplace fait glisser le ciel, dans le même sens', () => {
    const a = cadrePlaque(0, 0, 0.3, 1280, 720, 1, 1254)
    const b = cadrePlaque(500, -300, 0.3, 1280, 720, 1, 1254)
    expect(a.cx).toBeCloseTo(0.5, 9)
    expect(b.cx).toBeGreaterThan(a.cx)
    expect(b.cy).toBeLessThan(a.cy)
  })
})
