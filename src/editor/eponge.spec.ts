import { describe, expect, it } from 'vitest'
import { CELLULE_MAX, CELLULE_MIN, grilleEponge } from './eponge'
import { FAMILLES_JOUEUR } from './profilJoueur'

// L'éponge sautait par 24 u quand tout le reste se cale sur la grille de 20 :
// la grille de ses cellules doit désormais paver le trait EXACTEMENT.
describe('la grille d’une éponge suit le rectangle tracé', () => {
  const couvre = (g: { cols: number; rows: number; cellSize: number }) => [g.cols * g.cellSize, g.rows * g.cellSize]

  it('sur la grille de l’éditeur (20 u), elle tombe pile sur le trait', () => {
    for (const [w, h] of [[20, 20], [40, 20], [140, 60], [200, 200], [260, 120], [500, 40]]) {
      const g = grilleEponge(w, h)
      expect(couvre(g), `${w}×${h}`).toEqual([w, h])
      expect(g.cellSize).toBe(20)
    }
  })

  it('l’ancien arrondi à 24 u n’a plus cours : 140 × 60 ne devient pas 144 × 72', () => {
    expect(couvre(grilleEponge(140, 60))).not.toEqual([144, 72])
  })

  it('des côtés hors grille se pavent aussi quand un diviseur raisonnable existe', () => {
    const g = grilleEponge(150, 90)
    expect(couvre(g)).toEqual([150, 90])
    expect(g.cellSize).toBeGreaterThanOrEqual(CELLULE_MIN)
    expect(g.cellSize).toBeLessThanOrEqual(CELLULE_MAX)
  })

  it('garde la cellule réglée par le concepteur tant qu’elle pave encore', () => {
    expect(grilleEponge(240, 120, 24)).toEqual({ cols: 10, rows: 5, cellSize: 24 })
    expect(grilleEponge(240, 120, 12)).toEqual({ cols: 20, rows: 10, cellSize: 12 })
  })

  it('une cellule qui ne pave plus cède la place, au lieu de déborder', () => {
    const g = grilleEponge(260, 120, 24)
    expect(couvre(g)).toEqual([260, 120])
  })

  it('à main levée, sans diviseur possible, l’ancien arrondi demeure', () => {
    const g = grilleEponge(131, 77)
    expect(g.cellSize).toBe(CELLULE_MAX)
    expect(g.cols).toBe(5)
    expect(g.rows).toBe(3)
  })

  it('jamais moins d’une cellule', () => {
    const g = grilleEponge(1, 1)
    expect(g.cols).toBeGreaterThanOrEqual(1)
    expect(g.rows).toBeGreaterThanOrEqual(1)
  })
})

// La ligne d'outils du joueur défile de côté : en sixième place des zones
// d'effet, l'éponge tombait hors de l'écran et passait pour absente.
describe('l’éponge se voit dans l’atelier du joueur', () => {
  it('elle vient juste après les trois états, avant le puits', () => {
    const zones = FAMILLES_JOUEUR.find((f) => f.id === 'zones')!.outils.map((o) => o.outil)
    expect(zones.indexOf('sponge')).toBe(3)
  })
})
