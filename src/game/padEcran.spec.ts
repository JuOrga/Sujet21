import { describe, expect, it } from 'vitest'
import { BOUTON } from './manette'
import {
  PiloteEcran,
  gesteClavier,
  legendeHTML,
  voisinGrille,
  type LectureManette,
} from './padEcran'

/** Une manette de papier : les fronts qu'on lui donne, le stick qu'on lui pose. */
function manette(fronts: number[] = [], stick?: { x: number; y: number }): LectureManette {
  const f = new Set(fronts)
  const force = stick ? Math.hypot(stick.x, stick.y) : 0
  return {
    edge: (i) => f.has(i),
    force,
    dirX: stick && force > 0 ? stick.x / force : 1,
    dirY: stick && force > 0 ? stick.y / force : 0,
  }
}

describe('le pilote manette d’un écran', () => {
  it('relève les boutons au front, et la croix comme une direction', () => {
    const p = new PiloteEcran()
    expect(p.lit(manette([BOUTON.A, BOUTON.LB, BOUTON.HAUT]), 0)).toEqual(['A', 'LB', 'haut'])
    expect(p.lit(manette([BOUTON.B]), 0.1)).toEqual(['B'])
    expect(p.lit(manette([BOUTON.X, BOUTON.Y, BOUTON.RB]), 0.2)).toEqual(['X', 'Y', 'RB'])
    expect(p.lit(manette([BOUTON.GAUCHE]), 0.3)).toEqual(['gauche'])
    expect(p.lit(manette(), 0.4)).toEqual([])
  })

  it('le stick donne UN cran, attend, puis répète en douceur — et se réarme au relâchement', () => {
    const p = new PiloteEcran()
    const droite = manette([], { x: 0.9, y: 0 })
    expect(p.lit(droite, 0)).toEqual(['droite'])
    expect(p.lit(droite, 0.1)).toEqual([]) // tenu : rien avant l'attente
    expect(p.lit(droite, 0.3)).toEqual([])
    expect(p.lit(droite, 0.35)).toEqual(['droite']) // la première répétition
    expect(p.lit(droite, 0.4)).toEqual([])
    expect(p.lit(droite, 0.48)).toEqual(['droite']) // puis plus vite
    expect(p.lit(manette([], { x: 0.1, y: 0 }), 0.5)).toEqual([]) // relâché
    expect(p.lit(droite, 0.51)).toEqual(['droite']) // réarmé aussitôt
  })

  it('le stick choisit l’axe dominant, et la zone molle ne bouge rien', () => {
    const p = new PiloteEcran()
    expect(p.lit(manette([], { x: 0.2, y: -0.8 }), 0)).toEqual(['haut'])
    expect(new PiloteEcran().lit(manette([], { x: 0.3, y: 0.7 }), 0)).toEqual(['bas'])
    expect(new PiloteEcran().lit(manette([], { x: -0.7, y: 0.2 }), 0)).toEqual(['gauche'])
    expect(new PiloteEcran().lit(manette([], { x: 0.4, y: 0 }), 0)).toEqual([])
  })

  it('la croix prime sur le stick : une seule direction par image', () => {
    const p = new PiloteEcran()
    expect(p.lit(manette([BOUTON.BAS], { x: 0.9, y: 0 }), 0)).toEqual(['bas'])
  })
})

describe('le même schéma au clavier', () => {
  it('flèches, entrée, échap, Q/E, F/R — et rien d’autre', () => {
    expect(gesteClavier('ArrowUp')).toBe('haut')
    expect(gesteClavier('ArrowDown')).toBe('bas')
    expect(gesteClavier('ArrowLeft')).toBe('gauche')
    expect(gesteClavier('ArrowRight')).toBe('droite')
    expect(gesteClavier('Enter')).toBe('A')
    expect(gesteClavier('Escape')).toBe('B')
    expect(gesteClavier('q')).toBe('LB')
    expect(gesteClavier('E')).toBe('RB')
    expect(gesteClavier('f')).toBe('X')
    expect(gesteClavier('R')).toBe('Y')
    expect(gesteClavier(' ')).toBeNull()
    expect(gesteClavier('a')).toBeNull()
  })
})

describe('la grille', () => {
  it('boucle à l’horizontale, s’arrête aux bords à la verticale', () => {
    // 7 cases sur 3 colonnes : [0 1 2] [3 4 5] [6]
    expect(voisinGrille(7, 0, -1, 0, 3)).toBe(6)
    expect(voisinGrille(7, 6, 1, 0, 3)).toBe(0)
    expect(voisinGrille(7, 1, 0, 1, 3)).toBe(4)
    expect(voisinGrille(7, 4, 0, -1, 3)).toBe(1)
    expect(voisinGrille(7, 1, 0, -1, 3)).toBeNull()
    expect(voisinGrille(7, 6, 0, 1, 3)).toBeNull()
  })

  it('descendre sur une dernière rangée incomplète mène à sa dernière case', () => {
    expect(voisinGrille(7, 4, 0, 1, 3)).toBe(6)
    expect(voisinGrille(7, 5, 0, 1, 3)).toBe(6)
  })

  it('sans choix, on part du début ; sans case, rien', () => {
    expect(voisinGrille(5, -1, 0, 1, 2)).toBe(0)
    expect(voisinGrille(0, 0, 1, 0, 2)).toBeNull()
    expect(voisinGrille(5, 2, 0, 0, 2)).toBeNull()
  })
})

describe('la légende', () => {
  const entrees = [
    { b: 'LBRB' as const, t: 'RAYON' },
    { b: 'CROIX' as const, t: 'PARCOURIR' },
    { b: 'A' as const, t: 'ACHETER' },
    { b: 'B' as const, t: 'QUITTER' },
    { b: 'X' as const, t: '' },
  ]

  it('parle manette quand elle est branchée : ses boutons, en rond', () => {
    const html = legendeHTML(entrees, true)
    expect(html).toContain('>LB</kbd>')
    expect(html).toContain('>RB</kbd>')
    expect(html).toContain('pe-b--A pe-ronde">A</kbd>')
    expect(html).toContain('>✚</kbd>')
    expect(html).toContain('MANETTE DÉTECTÉE')
    expect(html).not.toContain('ÉCHAP')
  })

  it('parle clavier sinon, et un bouton sans rôle se montre en creux', () => {
    const html = legendeHTML(entrees, false)
    expect(html).toContain('>Q</kbd>')
    expect(html).toContain('>⏎</kbd>')
    expect(html).toContain('>ÉCHAP</kbd>')
    expect(html).toContain('pe-muette')
    expect(html).toContain('<i>—</i>')
    expect(html).toContain('>CLAVIER</em>')
    expect(html).not.toContain('pe-ronde')
  })

  it('échappe les libellés', () => {
    expect(legendeHTML([{ b: 'A', t: '<b>' }], true)).toContain('&lt;b&gt;')
  })
})
