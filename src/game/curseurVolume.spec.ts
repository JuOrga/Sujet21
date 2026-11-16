import { describe, expect, it } from 'vitest'
import { avanceCurseur, nouveauCurseurVolume, prendCurseur } from './curseurVolume'

// un corps en disque de rayon 10, puis un corps en barre horizontale
const disque = (dx: number, dy: number): boolean => Math.hypot(dx, dy) <= 10
const barre = (dx: number, dy: number): boolean => Math.abs(dx) <= 30 && Math.abs(dy) <= 2

describe('curseur dans le volume', () => {
  it('naît au centre à chaque prise', () => {
    const c = nouveauCurseurVolume()
    expect(c.actif).toBe(false)
    c.dx = 7
    c.dy = -3
    prendCurseur(c)
    expect(c).toEqual({ actif: true, dx: 0, dy: 0 })
  })

  it('suit le stick — pousser vers le haut de l’écran monte dans le monde', () => {
    const c = nouveauCurseurVolume()
    prendCurseur(c)
    avanceCurseur(c, 1, 0, 2, disque)
    expect(c.dx).toBeCloseTo(2)
    avanceCurseur(c, 0, -1, 3, disque)
    expect(c.dy).toBeCloseTo(3)
  })

  it('ne sort pas du volume', () => {
    const c = nouveauCurseurVolume()
    prendCurseur(c)
    for (let i = 0; i < 50; i++) avanceCurseur(c, 1, 0, 1, disque)
    expect(c.dx).toBeCloseTo(10)
    expect(disque(c.dx, c.dy)).toBe(true)
  })

  it('glisse le long du bord au lieu de s’y clouer', () => {
    const c = nouveauCurseurVolume()
    prendCurseur(c)
    // en diagonale dans une barre : la hauteur bute vite, la longueur continue
    for (let i = 0; i < 40; i++) avanceCurseur(c, 0.7, -0.7, 1, barre)
    expect(c.dy).toBeLessThanOrEqual(2)
    expect(c.dx).toBeGreaterThan(20)
  })

  it('revient vers le centre quand le corps se dérobe', () => {
    const c = nouveauCurseurVolume()
    prendCurseur(c)
    for (let i = 0; i < 30; i++) avanceCurseur(c, 1, 0, 1, barre)
    expect(c.dx).toBeGreaterThan(25)
    // le corps se ramasse en disque : le bout de la barre n'existe plus
    avanceCurseur(c, 0, 0, 1, disque)
    expect(disque(c.dx, c.dy)).toBe(true)
    expect(c.dx).toBeGreaterThan(0) // ramené, pas remis à zéro
  })

  it('reste au centre s’il n’y a plus de corps du tout', () => {
    const c = nouveauCurseurVolume()
    prendCurseur(c)
    c.dx = 5
    avanceCurseur(c, 0, 0, 1, () => false)
    expect(c).toEqual({ actif: true, dx: 0, dy: 0 })
  })
})
