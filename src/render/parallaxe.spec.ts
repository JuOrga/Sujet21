// LA PROFONDEUR DES COUCHES DE FOND : deux propriétés à graver.
//
// La première est une garantie de non-régression : à zoom = 1, la nouvelle
// formule doit rendre EXACTEMENT l'ancienne. La seconde est l'intention même
// du réglage : à zoom = 0, une couche ne change pas de taille quand la
// caméra grossit — c'est ce qui fait qu'elle est loin.

import { describe, expect, it } from 'vitest'
import {
  PARALLAXE_DEFAUTS,
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
