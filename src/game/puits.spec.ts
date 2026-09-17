import { describe, expect, it } from 'vitest'
import { PUITS_FONDU, PUITS_FORCE_DEFAUT, PUITS_RAYON_DEFAUT } from './level'
import { accelerationPuits, intensitePuits, periodeCoeur, potentielPuits, vitesseCirculaire } from './puits'

describe('la loi du puits — cœur harmonique, halo képlérien, portée en fondu', () => {
  const p = { x: 0, y: 0, force: 540, rayon: 220 } // un cœur de 220 : les nombres ronds du test, pas les défauts

  it('croît en r dans le cœur, vaut la force au bord, décroît en 1/r² dehors, sans saut au bord', () => {
    expect(intensitePuits(p, 0)).toBe(0)
    expect(intensitePuits(p, 110)).toBeCloseTo(270)
    expect(intensitePuits(p, 220)).toBeCloseTo(540)
    expect(intensitePuits(p, 220.001)).toBeCloseTo(540, 0)
    expect(intensitePuits(p, 440)).toBeCloseTo(135)
    // les défauts : les constantes nommées
    expect(intensitePuits({ x: 0, y: 0 }, PUITS_RAYON_DEFAUT)).toBeCloseTo(PUITS_FORCE_DEFAUT)
  })

  it('le potentiel se raccorde au bord du cœur et sa pente est l’intensité', () => {
    const phi = (r: number): number => potentielPuits([p], r, 0)
    // au bord, les deux branches valent F·R/2 : pas de marche
    expect(phi(220)).toBeCloseTo((540 * 220) / 2)
    expect(phi(220.001)).toBeCloseTo((540 * 220) / 2, -1) // à 0,001 u près, la pente (540) fait 0,54
    const h = 0.01
    expect((phi(110 + h) - phi(110 - h)) / (2 * h)).toBeCloseTo(intensitePuits(p, 110), 1)
    expect((phi(500 + h) - phi(500 - h)) / (2 * h)).toBeCloseTo(intensitePuits(p, 500), 1)
  })

  it('la portée éteint le puits, en fondu sur le dernier quart', () => {
    const q = { ...p, portee: 800 }
    expect(intensitePuits(q, 800)).toBe(0)
    expect(intensitePuits(q, 900)).toBe(0)
    expect(intensitePuits(q, 600)).toBeCloseTo(intensitePuits(p, 600)) // avant le fondu : intact
    const milieuFondu = 800 - (800 * PUITS_FONDU) / 2
    expect(intensitePuits(q, milieuFondu)).toBeCloseTo(intensitePuits(p, milieuFondu) / 2)
  })

  it('l’accélération pointe vers le puits et les puits se somment ; au centre exact, rien', () => {
    const out = { ax: 0, ay: 0 }
    expect(accelerationPuits([p], 220, 0, out)).toBe(true)
    expect(out.ax).toBeCloseTo(-540)
    expect(out.ay).toBeCloseTo(0)
    out.ax = out.ay = 0
    expect(accelerationPuits([p], 0, 0, out)).toBe(false)
    // deux puits symétriques : équilibre au milieu, somme vectorielle ailleurs
    const deux = [{ ...p, x: -300 }, { ...p, x: 300 }]
    out.ax = out.ay = 0
    accelerationPuits(deux, 0, 0, out)
    expect(Math.abs(out.ax)).toBeLessThan(1e-9)
    out.ax = out.ay = 0
    accelerationPuits(deux, 0, 100, out)
    expect(out.ax).toBeCloseTo(0)
    expect(out.ay).toBeLessThan(0)
  })

  it('vitesse circulaire et période du cœur suivent les formules du commentaire', () => {
    expect(vitesseCirculaire(p, 220)).toBeCloseTo(Math.sqrt(540 * 220))
    expect(periodeCoeur(p)).toBeCloseTo(2 * Math.PI * Math.sqrt(220 / 540))
    expect(periodeCoeur(p)).toBeCloseTo(4.01, 1)
    expect(periodeCoeur({ x: 0, y: 0 })).toBeCloseTo(2 * Math.PI * Math.sqrt(PUITS_RAYON_DEFAUT / PUITS_FORCE_DEFAUT))
  })
})
