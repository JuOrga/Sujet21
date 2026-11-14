import { describe, expect, it } from 'vitest'
import { FORME_COQUE, FORME_DISQUE, FORME_RECT } from '../game/formes'
import {
  MAT_BAIE,
  MAT_EXIT,
  MAT_HYDROPHOBE,
  MAT_RIDEAU,
  MAT_VIDE,
  MAT_WALL,
} from '../game/level'
import { HAUTEUR_BLOCS } from './renderer'
import {
  HAUTEUR_DE_RANG,
  LUMIERE_PAR_DEFAUT,
  RANG_DE_MATIERE,
  hauteurPropre,
  hauteursPartagees,
} from './volume'

const boite = (x0: number, y0: number, x1: number, y1: number, mat: number, forme = FORME_RECT, angle = 0) => ({
  x0, y0, x1, y1, mat, forme, angle,
})

describe('le contrat des hauteurs', () => {
  it('chaque matière solide a un rang, et aucun rang n’est nul', () => {
    for (const mat of [0, 1, 2, 4, 5, 6, 7, 8, 9, 10]) {
      expect(RANG_DE_MATIERE[mat], `mat ${mat}`).toBeDefined()
    }
    for (const h of Object.values(HAUTEUR_DE_RANG)) expect(h).toBeGreaterThan(0)
    expect(HAUTEUR_DE_RANG.haut).toBeGreaterThan(HAUTEUR_DE_RANG.moyen)
    expect(HAUTEUR_DE_RANG.moyen).toBeGreaterThan(HAUTEUR_DE_RANG.bas)
    // le haut ne dépasse pas ce sur quoi les ombres sont réglées
    expect(HAUTEUR_DE_RANG.haut).toBe(HAUTEUR_BLOCS)
  })

  it('un mur seul vaut haut, un hydrophobe moyen, un rideau bas', () => {
    const h = hauteursPartagees([
      boite(0, 0, 10, 10, MAT_WALL),
      boite(100, 0, 110, 10, MAT_HYDROPHOBE),
      boite(200, 0, 210, 10, MAT_RIDEAU),
    ])
    expect(Array.from(h)).toEqual([HAUTEUR_DE_RANG.haut, HAUTEUR_DE_RANG.moyen, HAUTEUR_DE_RANG.bas])
  })

  it('un plancher mur + rideau + hydrophobe bout à bout donne trois haut', () => {
    const h = hauteursPartagees([
      boite(0, 0, 100, 20, MAT_WALL),
      boite(100, 0, 200, 20, MAT_RIDEAU),
      boite(200, 0, 300, 20, MAT_HYDROPHOBE),
    ])
    expect(Array.from(h)).toEqual([140, 140, 140])
  })

  it('deux blocs séparés d’un jour gardent leur hauteur', () => {
    const h = hauteursPartagees([
      boite(0, 0, 100, 20, MAT_WALL),
      boite(105, 0, 200, 20, MAT_RIDEAU),
    ])
    expect(Array.from(h)).toEqual([HAUTEUR_DE_RANG.haut, HAUTEUR_DE_RANG.bas])
  })

  it('une boîte tournée de 45° qui touche un mur se joint à lui', () => {
    const h = hauteursPartagees([
      boite(0, 0, 100, 20, MAT_WALL),
      // barre debout, centrée à (108, 10), demi-côtés 5 × 80 : droite, elle
      // laisse 3 unités de jour au mur ; tournée, sa tranche l'atteint
      boite(103, -70, 113, 90, MAT_RIDEAU, FORME_RECT, 45),
      // la même, trop loin
      boite(303, -70, 313, 90, MAT_RIDEAU, FORME_RECT, 45),
    ])
    expect(h[1]).toBe(140)
    expect(h[2]).toBe(HAUTEUR_DE_RANG.bas)
    // la même, droite : le jour reste
    const droite = hauteursPartagees([
      boite(0, 0, 100, 20, MAT_WALL),
      boite(103, -70, 113, 90, MAT_RIDEAU),
    ])
    expect(droite[1]).toBe(HAUTEUR_DE_RANG.bas)
  })

  it('une coque ne dépasse jamais le haut, et n’engloutit pas ce qu’elle entoure', () => {
    for (const mat of [0, 1, 8]) {
      expect(hauteurPropre(mat, FORME_COQUE)).toBeLessThanOrEqual(HAUTEUR_DE_RANG.haut)
    }
    const h = hauteursPartagees([
      { ...boite(0, 0, 1000, 1000, MAT_WALL, FORME_COQUE), p0: 64, p1: 0 },
      boite(400, 400, 500, 500, MAT_RIDEAU),
    ])
    expect(h[0]).toBeLessThanOrEqual(HAUTEUR_DE_RANG.haut)
    expect(h[1]).toBe(HAUTEUR_DE_RANG.bas)
  })

  it('une forme courbe ne se joint pas par son rectangle englobant', () => {
    const h = hauteursPartagees([
      boite(0, 0, 100, 100, MAT_RIDEAU, FORME_DISQUE),
      boite(95, 95, 200, 200, MAT_WALL),
    ])
    expect(h[0]).toBe(HAUTEUR_DE_RANG.bas)
  })

  it('le sas, le vide et la baie valent 0 et ne joignent rien', () => {
    expect(hauteurPropre(MAT_EXIT, 0)).toBe(0)
    const h = hauteursPartagees([
      boite(0, 0, 100, 20, MAT_WALL),
      boite(100, 0, 200, 20, MAT_VIDE),
      boite(200, 0, 300, 20, MAT_RIDEAU),
      boite(0, 100, 50, 120, MAT_EXIT),
      boite(50, 100, 100, 120, MAT_BAIE),
    ])
    expect(Array.from(h)).toEqual([140, 0, HAUTEUR_DE_RANG.bas, 0, 0])
  })

  it('LUMIERE_PAR_DEFAUT est unitaire', () => {
    expect(Math.hypot(...LUMIERE_PAR_DEFAUT)).toBeCloseTo(1, 6)
  })
})
