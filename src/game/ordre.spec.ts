// L'ordre de peinture : ce qui décide, en cas de chevauchement, quelle
// matière se voit. Les cas décrivent le geste du concepteur.

import { describe, expect, it } from 'vitest'
import { deplaceDans, ditLeDeplacement } from './ordre'
import { STRUCT_CHAMBRE, STRUCT_COULOIR, niveauExpanse } from './structures'
import { MAT_HYDROPHILE, MAT_WALL, type LevelDef } from './level'

describe('déplacer un élément dans l’ordre de peinture', () => {
  it('avancer d’un rang le fait passer devant son voisin', () => {
    const l = ['coque', 'couloir', 'vitre']
    expect(deplaceDans(l, 0, 'devant')).toBe(1)
    expect(l).toEqual(['couloir', 'coque', 'vitre'])
  })

  it('reculer d’un rang le fait passer derrière', () => {
    const l = ['coque', 'couloir', 'vitre']
    expect(deplaceDans(l, 2, 'derriere')).toBe(1)
    expect(l).toEqual(['coque', 'vitre', 'couloir'])
  })

  it('les deux bouts : au fond, et tout dessus', () => {
    const l = ['a', 'b', 'c', 'd']
    expect(deplaceDans(l, 2, 'fond')).toBe(0)
    expect(l).toEqual(['c', 'a', 'b', 'd'])
    expect(deplaceDans(l, 0, 'dessus')).toBe(3)
    expect(l).toEqual(['a', 'b', 'd', 'c'])
  })

  it('au bout, le geste ne fait RIEN — ni rotation, ni perte', () => {
    const l = ['a', 'b']
    expect(deplaceDans(l, 0, 'derriere')).toBe(0)
    expect(deplaceDans(l, 1, 'devant')).toBe(1)
    expect(l).toEqual(['a', 'b'])
  })

  it('un indice hors liste ne touche à rien', () => {
    const l = ['a', 'b']
    expect(deplaceDans(l, 5, 'devant')).toBe(5)
    expect(deplaceDans(l, -1, 'fond')).toBe(-1)
    expect(deplaceDans(l, 1.5, 'devant')).toBe(1.5)
    expect(l).toEqual(['a', 'b'])
  })

  it('rien ne se perd ni ne se duplique, quel que soit le sens', () => {
    const l = ['a', 'b', 'c', 'd', 'e']
    for (const sens of ['devant', 'derriere', 'fond', 'dessus'] as const) {
      for (let i = 0; i < l.length; i++) deplaceDans(l, i, sens)
    }
    expect([...l].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('le déplacement se raconte', () => {
  it('dit le nouveau rang quand ça a bougé', () => {
    expect(ditLeDeplacement('dessus', 0, 3, 4)).toContain('4 / 4')
    expect(ditLeDeplacement('fond', 3, 0, 4)).toContain('1 / 4')
  })

  it('dit qu’on est au bout quand rien n’a bougé', () => {
    expect(ditLeDeplacement('derriere', 0, 0, 4)).toContain('au fond')
    expect(ditLeDeplacement('devant', 3, 3, 4)).toContain('dessus')
  })
})


describe('l’ordre tel que le moteur le voit', () => {
  // Ce que l'éditeur déplace doit VRAIMENT changer qui se peint dessus :
  // le rendu suit l'ordre de `boxes`, coques d'abord (niveauExpanse).
  const niveau = (): LevelDef => ({
    name: 'essai',
    code: '21-O',
    bounds: { minX: -500, minY: -300, maxX: 500, maxY: 300 },
    spawn: { x: -400, y: 0, n: 40 },
    exit: { minX: 400, minY: -40, maxX: 460, maxY: 40 },
    journal: '',
    sponges: [],
    labels: [],
    boxes: [
      { minX: -100, minY: -100, maxX: 100, maxY: 100, material: MAT_WALL },
      { minX: 0, minY: -50, maxX: 200, maxY: 50, material: MAT_HYDROPHILE },
    ],
    structures: [
      // l'emprise EXTÉRIEURE, comme le veut StructureDef
      { type: STRUCT_CHAMBRE, minX: -300, minY: -200, maxX: 300, maxY: 200 },
      { type: STRUCT_COULOIR, minX: 200, minY: -80, maxX: 600, maxY: 80 },
    ],
  })

  it('avancer une paroi la met en dernier — donc DESSUS', () => {
    const lv = niveau()
    expect(lv.boxes[lv.boxes.length - 1].material).toBe(MAT_HYDROPHILE)
    deplaceDans(lv.boxes, 0, 'dessus')
    expect(lv.boxes[lv.boxes.length - 1].material).toBe(MAT_WALL)
  })

  it('les coques se peignent AVANT le mobilier, quoi qu’on fasse', () => {
    // le mobilier ne peut pas passer sous une coque en changeant son rang :
    // le panneau le dit, et c'est niveauExpanse qui en décide
    const lv = niveau()
    deplaceDans(lv.boxes, 1, 'fond')
    const boites = niveauExpanse(lv).boxes
    const premiereDuMobilier = boites.length - lv.boxes.length
    expect(premiereDuMobilier).toBeGreaterThan(0)
    expect(boites[premiereDuMobilier].material).toBe(MAT_HYDROPHILE)
  })

  it('déplacer une coque change l’ordre des parois rendues', () => {
    const lv = niveau()
    const avant = JSON.stringify(niveauExpanse(lv).boxes)
    deplaceDans(lv.structures!, 0, 'dessus')
    expect(JSON.stringify(niveauExpanse(lv).boxes)).not.toBe(avant)
  })
})
