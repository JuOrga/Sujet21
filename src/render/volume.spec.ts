import { describe, expect, it } from 'vitest'
import { FORME_COQUE, FORME_DISQUE, FORME_RECT, coquePack } from '../game/formes'
import {
  MAT_BAIE,
  MAT_EXIT,
  MAT_HYDROPHOBE,
  MAT_RIDEAU,
  MAT_VIDE,
  MAT_WALL,
} from '../game/level'
import { HAUTEUR_BLOCS } from './hauteurs'
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
      { ...boite(0, 0, 1000, 1000, MAT_WALL, FORME_COQUE), ...coquePack({ cotes: 15, chanfrein: 0, ep: 64, porte: 0 }) },
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

  // Ces deux cas échouaient avec l'ancien échantillonnage (64 sommets de
  // formeOutline) DANS LES DEUX SENS : les points tombent entre deux
  // sommets, et les sommets de l'autre solide ne sont pas dans la forme.
  it('une barre qui entame le bord d\'une très grande ellipse s\'y joint', () => {
    // tournée d'un demi-pas d'échantillon : les points du contour tombent à
    // droite et à gauche de la barre, jamais dessous
    const grande = boite(-2000, -2000, 2000, 2000, MAT_WALL, FORME_DISQUE, 2.8125)
    // aucun de ses coins n'est dans l'ellipse (à plus d'une unité), mais sa
    // base y mord au milieu
    const barre = boite(-90, -2004, 90, -1999.4, MAT_RIDEAU)
    const h = hauteursPartagees([grande, barre])
    expect(h[1]).toBe(HAUTEUR_DE_RANG.haut)
  })

  it('un grand disque posé contre la face intérieure d\'une coque s\'y joint', () => {
    const coque = { ...boite(0, 0, 5000, 5000, MAT_WALL, FORME_COQUE), ...coquePack({ cotes: 15, chanfrein: 0, ep: 64, porte: 0 }) }
    // tangent à la face (y = 64) ; tourné d'un demi-pas d'échantillon pour
    // que le point de contact tombe entre deux points du contour
    const disque = boite(500, 64, 4500, 4064, MAT_RIDEAU, FORME_DISQUE, 2.8125)
    expect(hauteursPartagees([coque, disque])[1]).toBe(HAUTEUR_DE_RANG.haut)
  })

  it('une forme coupée ne se joint pas par sa partie retranchée', () => {
    const coupe = { x: 50, y: 0, nx: 1, ny: 0 } // retranche x > 50
    const coupee = { ...boite(0, 0, 100, 100, MAT_WALL), coupe }
    // (le bord retranché, x = 100, est entièrement couvert par cette boîte)
    const dansRetranche = boite(80, -10, 120, 110, MAT_RIDEAU)
    const dansReste = boite(30, 10, 70, 90, MAT_RIDEAU)
    expect(hauteursPartagees([coupee, dansRetranche])[1]).toBe(HAUTEUR_DE_RANG.bas)
    expect(hauteursPartagees([coupee, dansReste])[1]).toBe(HAUTEUR_DE_RANG.haut)
  })

  it("la vitre (mur, habillage 9) est basse, et partage la hauteur d'un mur voisin", () => {
    expect(hauteurPropre(MAT_WALL, 0, 9)).toBe(HAUTEUR_DE_RANG.bas)
    expect(hauteurPropre(MAT_WALL, 0, 3)).toBe(HAUTEUR_DE_RANG.haut)
    const seule = hauteursPartagees([{ ...boite(0, 0, 100, 20, MAT_WALL), skin: 9 }])
    expect(seule[0]).toBe(HAUTEUR_DE_RANG.bas)
    const collee = hauteursPartagees([
      { ...boite(0, 0, 100, 20, MAT_WALL), skin: 9 },
      boite(100, 0, 200, 20, MAT_WALL),
    ])
    expect(Array.from(collee)).toEqual([140, 140])
  })

  it("une barre à cheval sur la paroi d'une coque s'y joint, un bloc collé aussi", () => {
    // coque de 1000 × 1000, paroi de 64 : la barre a un bout dans le creux,
    // l'autre dehors, et aucun de ses SOMMETS n'est dans la paroi
    const coque = { ...boite(0, 0, 1000, 1000, MAT_WALL, FORME_COQUE), ...coquePack({ cotes: 15, chanfrein: 0, ep: 64, porte: 0 }) }
    const barre = boite(480, -100, 520, 150, MAT_RIDEAU)
    const collee = boite(500, 64, 560, 120, MAT_RIDEAU)
    const loin = boite(400, 400, 500, 500, MAT_RIDEAU)
    const h = hauteursPartagees([coque, barre, collee, loin])
    expect(h[1]).toBe(HAUTEUR_DE_RANG.haut)
    expect(h[3]).toBe(HAUTEUR_DE_RANG.bas)
    expect(hauteursPartagees([coque, collee])[1]).toBe(HAUTEUR_DE_RANG.haut)
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
