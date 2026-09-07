import { describe, expect, it } from 'vitest'
import type { RailDef } from '../game/level'
import {
  accroche,
  coupeRail,
  distanceSegment,
  insereNoeud,
  longueurRail,
  longueurTroncon,
  noeudProche,
  railProche,
  regleLongueurTroncon,
  retireNoeud,
  tronconProche,
} from './rails'

/** Un rail en L : (0,0) → (100,0) → (100,100). */
const enL = (): RailDef => ({
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ],
})

describe('attraper un rail', () => {
  it('mesure la distance à la ligne, pas aux bouts', () => {
    expect(distanceSegment(50, 12, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(12)
    // au-delà du segment, c'est l'extrémité qui compte
    expect(distanceSegment(-3, 4, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(5)
  })

  it('trouve le rail dont la ligne passe le plus près, et personne au-delà de la tolérance', () => {
    const rails = [enL(), { points: [{ x: 0, y: 300 }, { x: 100, y: 300 }] }]
    expect(railProche(rails, 50, 8, 20)).toBe(0)
    expect(railProche(rails, 50, 292, 20)).toBe(1)
    expect(railProche(rails, 50, 150, 20)).toBe(null)
  })

  it('désigne le NŒUD sous le doigt — c’est lui qui donne la poignée', () => {
    const pts = enL().points
    expect(noeudProche(pts, 98, 4, 16)).toBe(1)
    expect(noeudProche(pts, 50, 0, 16)).toBe(null) // au milieu : aucun nœud
  })

  it('désigne le TRONÇON montré, pour y insérer un coude', () => {
    const pts = enL().points
    expect(tronconProche(pts, 50, 5, 16)).toBe(0)
    expect(tronconProche(pts, 104, 50, 16)).toBe(1)
    expect(tronconProche(pts, 300, 300, 16)).toBe(null)
  })
})

describe('l’accroche entre rails', () => {
  const rails = (): RailDef[] => [
    enL(),
    { points: [{ x: 400, y: 400 }, { x: 500, y: 400 }] },
  ]

  it('colle EXACTEMENT sur le nœud voisin quand on l’approche', () => {
    expect(accroche(rails(), 103, 97, 20)).toEqual({ x: 100, y: 100 })
  })

  it('ne s’accroche ni au nœud qu’on tire ni à ses voisins de tracé', () => {
    expect(accroche(rails(), 101, 101, 20, [{ rail: 0, noeud: 2 }])).toBe(null)
    // le point neuf naît sur le précédent : sans l'exclusion du voisin,
    // il s'y recollait et aucun tronçon court n'était traçable
    expect(
      accroche(rails(), 100, 4, 20, [
        { rail: 0, noeud: 1 },
        { rail: 0, noeud: 2 },
      ]),
    ).toBe(null)
  })

  it('laisse le point libre hors de portée', () => {
    expect(accroche(rails(), 200, 200, 20)).toBe(null)
  })
})

describe('les longueurs, tronçon par tronçon', () => {
  it('mesure chaque tronçon et le total', () => {
    const pts = enL().points
    expect(longueurTroncon(pts, 0)).toBe(100)
    expect(longueurTroncon(pts, 1)).toBe(100)
    expect(longueurRail(pts)).toBe(200)
  })

  it('RÈGLE UN SEUL TRONÇON : l’aval suit, les autres longueurs ne bougent pas', () => {
    const pts = regleLongueurTroncon(enL().points, 0, 160)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[1]).toEqual({ x: 160, y: 0 })
    // le coude s'est déplacé d'un bloc : le second tronçon garde sa mesure
    expect(pts[2]).toEqual({ x: 160, y: 100 })
    expect(longueurTroncon(pts, 1)).toBe(100)
  })

  it('règle le DERNIER tronçon sans toucher au premier', () => {
    const pts = regleLongueurTroncon(enL().points, 1, 40)
    expect(pts[1]).toEqual({ x: 100, y: 0 })
    expect(pts[2]).toEqual({ x: 100, y: 40 })
    expect(longueurTroncon(pts, 0)).toBe(100)
  })

  it('ne touche à rien sur un tronçon sans direction (deux points confondus)', () => {
    const plat = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
    ]
    expect(regleLongueurTroncon(plat, 0, 80)).toEqual(plat)
  })
})

describe('nœuds : en ajouter, en retirer', () => {
  it('insère un coude au milieu du tronçon montré', () => {
    const pts = insereNoeud(enL().points, 0)
    expect(pts).toHaveLength(4)
    expect(pts[1]).toEqual({ x: 50, y: 0 })
  })

  it('retire un nœud', () => {
    const pts = retireNoeud(enL().points, 1)
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
  })

  it('refuse de descendre sous deux points — un rail d’un point n’est plus une ligne', () => {
    expect(
      retireNoeud(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        0,
      ),
    ).toBe(null)
  })
})

describe('couper un rail en deux', () => {
  it('donne deux tracés qui se touchent au point de coupe', () => {
    const paire = coupeRail(enL().points, 1)
    expect(paire).not.toBe(null)
    const [amont, aval] = paire!
    expect(amont).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(aval).toEqual([
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
  })

  it('refuse la coupe à une extrémité', () => {
    expect(coupeRail(enL().points, 0)).toBe(null)
    expect(coupeRail(enL().points, 2)).toBe(null)
  })

  it('ne partage aucun objet avec le tracé d’origine', () => {
    const origine = enL().points
    const [amont] = coupeRail(origine, 1)!
    amont[0].x = -999
    expect(origine[0].x).toBe(0)
  })
})
