// La règle de fusion, tenue sous tests — le shader ne s'en teste pas, sa
// formule si. Chaque cas décrit une situation du décor, pas une valeur.

import { describe, expect, it } from 'vitest'
import { lisereLibre, plusInterieur, smoothstep } from './fusion'

const EDGE = 2.5

describe('le plus intérieur des solides', () => {
  it('désigne celui qui enfonce le plus, pas le premier venu', () => {
    // un couloir effleuré (−0,4) et une chambre bien franchie (−9)
    expect(plusInterieur([0.8, -0.4, -9])).toEqual({ i: 2, d: -9 })
  })

  it('sur le vide, ne désigne personne', () => {
    expect(plusInterieur([]).i).toBe(-1)
  })

  it('à égalité, garde le premier — comme la boucle du shader', () => {
    // le shader n'écrase que sur un STRICTEMENT plus petit : les deux
    // doivent trancher pareil, sinon le liseré clignoterait d'un solide à
    // l'autre au fil des images
    expect(plusInterieur([-4, -4]).i).toBe(0)
  })
})

describe('le liseré passe, ou il est enterré', () => {
  it('le bord d’un couloir enfoncé dans une chambre disparaît', () => {
    // le pixel est à 9 u DANS la chambre (indice 0) : le bord du couloir
    // (indice 1) qui passe par là ne doit plus rien peindre
    expect(lisereLibre(1, 0, -9, EDGE)).toBe(0)
  })

  it('la silhouette EXTÉRIEURE, elle, reste entière', () => {
    // dehors, le plus intérieur est le solide lui-même : rien ne le couvre
    expect(lisereLibre(1, 1, -0.2, EDGE)).toBe(1)
    // et si personne n’est là du tout
    expect(lisereLibre(1, -1, 1e9, EDGE)).toBe(1)
  })

  it('le passage sous le voisin se fait en fondu, jamais en marche', () => {
    const aFleur = lisereLibre(1, 0, 0, EDGE) // juste sur la peau du voisin
    const aMiChemin = lisereLibre(1, 0, -EDGE / 2, EDGE)
    const dedans = lisereLibre(1, 0, -EDGE, EDGE)
    expect(aFleur).toBe(1)
    expect(dedans).toBe(0)
    expect(aMiChemin).toBeGreaterThan(0)
    expect(aMiChemin).toBeLessThan(1)
    // et c’est monotone : pas de rebond qui ferait scintiller le bord
    expect(aMiChemin).toBeLessThan(aFleur)
    expect(aMiChemin).toBeGreaterThan(dedans)
  })
})

describe('smoothstep, le jumeau de celui de GLSL', () => {
  it('borne, et suit la courbe en S', () => {
    expect(smoothstep(0, 1, -3)).toBe(0)
    expect(smoothstep(0, 1, 4)).toBe(1)
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12)
    expect(smoothstep(0, 1, 0.25)).toBeCloseTo(0.15625, 12)
  })
})
