import { describe, expect, it } from 'vitest'
import { pointInBox } from './level'
import { CODE_RONDE, REGLES_RONDE, sansSas, tableauRonde } from './ronde'
import { tableauOrbites } from './minijeux'
import { TABLEAUX } from './level'

describe('la ronde — le tableau', () => {
  it('trois puits alignés sur x = 0, symétriques ; le départ lancé droit vers le haut ; toute la salle en glace ; pas de sas', () => {
    const lv = tableauRonde()
    expect(lv.code).toBe(CODE_RONDE)
    expect(lv.puits!.map((p) => p.x)).toEqual([0, 0, 0])
    expect(lv.puits![0].y).toBe(-lv.puits![2].y)
    expect(lv.puits![1].y).toBe(0)
    expect(lv.spawn.impulsion).toEqual(REGLES_RONDE.depart.impulsion)
    expect(lv.spawn.impulsion!.angle).toBe(90)
    expect(lv.spawn.y).toBe(0)
    // la zone de glace couvre la cuve entière : où que le bloc aille, il reste glace
    const z = lv.zones![0]
    expect(z.force).toBe('glace')
    expect(z.minX).toBeLessThanOrEqual(lv.bounds.minX)
    expect(z.maxX).toBeGreaterThanOrEqual(lv.bounds.maxX)
    expect(z.minY).toBeLessThanOrEqual(lv.bounds.minY)
    expect(z.maxY).toBeGreaterThanOrEqual(lv.bounds.maxY)
    // la ronde tient dans la cuve : le sommet du lobe du haut (mesuré : 1001) plus le corps
    expect(lv.bounds.maxY).toBeGreaterThan(1001 + 110)
    expect(pointInBox(lv.exit.minX, lv.exit.minY, lv.bounds)).toBe(false)
    expect(sansSas(lv)).toBe(true)
    expect(sansSas(tableauOrbites())).toBe(true)
    expect(sansSas(TABLEAUX[0])).toBe(false)
  })
})
