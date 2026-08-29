import { describe, expect, it } from 'vitest'
import {
  ECHELLE_MIN,
  PAS_BAISSE,
  PAS_HAUSSE,
  PLAFOND_DPR,
  echelleDepart,
  viseEchelle,
} from './resolution'

// LE COÛT D'UNE IMAGE EST PROPORTIONNEL AU NOMBRE DE PIXELS.
// Mesuré sur iPad Pro M1 : 2,83 Mpx → 18 im/s, 1,26 Mpx → 45 im/s, soit
// ~19 ms par mégapixel dans les deux cas. C'est l'hypothèse dont vit tout
// ce module : si elle tombe, ces tests tombent avec elle.

/**
 * Un appareil imaginaire, limité par le remplissage. On modélise LA VRAIE
 * CHAÎNE, pas une approximation : l'échelle rendue est multipliée par le
 * rapport de pixels de l'écran (plafonné à 2), et c'est ce produit, au
 * carré, qui donne le nombre de pixels peints.
 *     pixels = surface_css × (dpr_plafonné × échelle)²
 */
function appareil(msParMpx: number, vueCssMpx: number, dpr: number) {
  const p = Math.min(dpr, PLAFOND_DPR)
  return (echelle: number): number =>
    1000 / (msParMpx * vueCssMpx * (p * echelle) ** 2)
}

// L'iPad du concepteur : vue 1024×1228 en pixels CSS (1,257 Mpx), dpr 2.
// Deux points mesurés le 29/08 : « moyenne » (échelle 0,75) → 18 im/s,
// « faible » (échelle 0,50) → 45 im/s. Soit 19,6 et 17,7 ms/Mpx : on prend
// 18,6 au milieu, et l'on vérifie que les deux points retombent bien.
const IPAD = appareil(18.6, 1.257, 2)

describe('L’échelle de rendu adaptative', () => {
  it('reproduit les deux mesures de l’iPad : c’est le socle du calcul', () => {
    expect(IPAD(0.75)).toBeGreaterThan(16) // mesuré 18
    expect(IPAD(0.75)).toBeLessThan(20)
    expect(IPAD(0.5)).toBeGreaterThan(41) // mesuré 45
    expect(IPAD(0.5)).toBeLessThan(48)
  })

  it('ne touche à rien dans la zone morte', () => {
    expect(viseEchelle(1, 60, 60)).toBe(null)
    expect(viseEchelle(1, 58, 60)).toBe(null) // 96,7 % : on laisse
    expect(viseEchelle(0.7, 62, 60)).toBe(null) // 103 % : on laisse
    // et jamais de hausse quand on est déjà au natif
    expect(viseEchelle(1, 200, 60)).toBe(null)
  })

  it('vise la cible au lieu de sauter un cran au hasard', () => {
    // deux fois trop lent → il faut √(1/2) ≈ 0,71 fois l'échelle
    const a = viseEchelle(1, 30, 60)
    expect(a?.sens).toBe('baisse')
    expect(a?.echelle).toBeCloseTo(0.75, 2) // borné par le pas de baisse
    // un manque léger appelle une correction LÉGÈRE — c'est tout le grief
    // contre les paliers : ils corrigeaient de 25 % pour 10 % d'écart
    const b = viseEchelle(1, 54, 60)
    expect(b?.echelle).toBeGreaterThan(0.93)
    expect(b?.echelle).toBeLessThan(0.97)
  })

  it('borne chaque pas : un à-coup isolé n’emporte pas l’échelle', () => {
    for (const fps of [0.5, 1, 5, 12]) {
      const a = viseEchelle(0.8, fps, 60)
      expect(a!.echelle).toBeGreaterThanOrEqual(0.8 * PAS_BAISSE - 0.01)
    }
    const h = viseEchelle(0.5, 300, 60)
    expect(h!.echelle).toBeLessThanOrEqual(0.5 * PAS_HAUSSE + 0.01)
  })

  it('ne descend jamais sous le plancher de netteté', () => {
    let e = 1
    for (let i = 0; i < 40; i++) e = viseEchelle(e, 3, 60)?.echelle ?? e
    expect(e).toBe(ECHELLE_MIN)
    expect(ECHELLE_MIN).toBe(0.5) // « faible », la qualité validée
    // et une fois au plancher, il n'y a plus rien à faire
    expect(viseEchelle(ECHELLE_MIN, 3, 60)).toBe(null)
  })

  it('CONVERGE sur l’iPad, s’ARRÊTE, et ne descend pas sous « faible »', () => {
    // c'est la promesse rendue au concepteur : « ça dégrade beaucoup trop »
    // décrivait une mécanique qui dépassait la cible puis y revenait.
    let e = echelleDepart(1.257e6 * PLAFOND_DPR ** 2) // départ sous plafond
    const vus: number[] = []
    for (let i = 0; i < 30; i++) {
      const a = viseEchelle(e, IPAD(e), 60)
      if (!a) break
      e = a.echelle
      vus.push(e)
    }
    // il s'arrête au plancher validé par le concepteur — « faible »…
    expect(e).toBe(ECHELLE_MIN)
    // …ce qui vaut la cadence qu'il y a mesurée, pas 60 : c'est le choix
    // assumé (45 nettes plutôt que 60 floues)
    expect(IPAD(e)).toBeGreaterThan(40)
    // …en peu d'ajustements, et sans jamais remonter entre-temps
    expect(vus.length).toBeLessThanOrEqual(5)
    expect([...vus]).toEqual([...vus].sort((a, b) => b - a))
    // …et il se TAIT ensuite : rejoué cent fois, l'échelle ne bouge plus
    for (let i = 0; i < 100; i++) expect(viseEchelle(e, IPAD(e), 60)).toBe(null)
  })

  it('sur une machine qui tient la cible, il s’arrête AVANT le plancher', () => {
    // sinon l'adaptatif reviendrait à imposer « faible » à tout le monde
    const moyen = appareil(6, 1.0, 1) // ~60 im/s à l'échelle 0,95
    let e = 1
    for (let i = 0; i < 30; i++) {
      const a = viseEchelle(e, moyen(e), 60)
      if (!a) break
      e = a.echelle
    }
    expect(e).toBeGreaterThan(ECHELLE_MIN)
    expect(moyen(e)).toBeGreaterThan(55)
  })

  it('converge aussi sur une machine rapide, en remontant au natif', () => {
    const gros = appareil(2, 1.0, 1) // 500 im/s à l'échelle 1
    let e = echelleDepart(8e6) // parti bas
    expect(e).toBeLessThan(1)
    for (let i = 0; i < 30; i++) {
      const a = viseEchelle(e, gros(e), 60)
      if (!a) break
      e = a.echelle
    }
    expect(e).toBe(1) // il rend toute sa netteté à qui peut la tenir
  })

  it('le départ tient sous le plafond de pixels, sans jamais dépasser le natif', () => {
    expect(echelleDepart(5.03e6)).toBeCloseTo(0.83, 2) // l'iPad
    expect(echelleDepart(1e6)).toBe(1) // une petite vue : rien à rogner
    expect(echelleDepart(0)).toBe(1) // pas de division par zéro
  })

  it('encaisse les valeurs absurdes sans rendre n’importe quoi', () => {
    expect(viseEchelle(1, 0, 60)).toBe(null)
    expect(viseEchelle(1, 60, 0)).toBe(null)
    expect(viseEchelle(1, Number.NaN, 60)).toBe(null)
  })
})
