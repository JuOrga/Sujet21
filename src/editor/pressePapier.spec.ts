import { describe, expect, it } from 'vitest'
import type { LevelDef } from '../game/level'
import { MAX_LUMIERES } from '../render/renderer'
import {
  colle,
  copie,
  decalageDeCollage,
  elementsDansCadre,
} from './pressePapier'

// UN PETIT TABLEAU : deux parois, une pastille numérotée, une étiquette à
// clé, un rail, une lampe, une éponge — et les uniques (départ, sas, fiole)
// posés là où le cadre peut les attraper ou non.
function tableau(extra: Partial<LevelDef> = {}): LevelDef {
  return {
    name: 'Presse',
    code: 'PP',
    journal: '',
    bounds: { minX: 0, minY: 0, maxX: 2000, maxY: 2000 },
    spawn: { x: 150, y: 150, n: 300 },
    exit: { minX: 1800, minY: 1800, maxX: 1900, maxY: 1900 },
    boxes: [
      { minX: 100, minY: 100, maxX: 300, maxY: 200, material: 1 },
      // celle-ci DÉBORDE du cadre [0, 500]² : effleurée, pas entourée
      { minX: 400, minY: 100, maxX: 700, maxY: 200, material: 1, angle: 15 },
    ],
    sponges: [{ minX: 100, minY: 300, cols: 2, rows: 2, cellSize: 40, capacityPerCell: 5 }],
    labels: [{ x: 250, y: 400, text: 'ICI', tone: 'mur', cle: 'panneau-1' }],
    cibles: [{ x: 350, y: 350, r: 30 }, { x: 900, y: 900, r: 30, canal: 7 }],
    rails: [{ points: [{ x: 100, y: 450 }, { x: 400, y: 450 }] }],
    lumieres: [{ x: 200, y: 250, intensite: 0.5 }],
    fiole: { x: 1000, y: 1000 },
    ...extra,
  }
}

const CADRE = { minX: 0, minY: 0, maxX: 500, maxY: 500 }

describe('le cadre de sélection', () => {
  it('retient ce qui est ENTIÈREMENT dedans, uniques compris', () => {
    const refs = elementsDansCadre(tableau(), CADRE)
    expect(refs).toEqual([
      { kind: 'box', index: 0 },
      { kind: 'sponge', index: 0 },
      { kind: 'label', index: 0 },
      { kind: 'cible', index: 0 },
      { kind: 'rail', index: 0 },
      { kind: 'lumiere', index: 0 },
      { kind: 'spawn' },
    ])
  })

  it('laisse ce que le cadre ne fait qu’effleurer', () => {
    // la paroi 1 s'étend jusqu'à x = 700 : hors cadre
    const refs = elementsDansCadre(tableau(), CADRE)
    expect(refs).not.toContainEqual({ kind: 'box', index: 1 })
    // une pastille dont le rayon déborde n'est pas retenue non plus
    expect(elementsDansCadre(tableau(), { minX: 330, minY: 330, maxX: 370, maxY: 370 })).toEqual([])
  })

  it('se trace dans n’importe quel sens', () => {
    const inverse = { minX: 500, minY: 500, maxX: 0, maxY: 0 }
    expect(elementsDansCadre(tableau(), inverse)).toEqual(
      elementsDansCadre(tableau(), CADRE),
    )
  })
})

describe('copier', () => {
  it('clone les éléments désignés et mesure leur emprise', () => {
    const lv = tableau()
    const { presse, ignores } = copie(lv, [
      { kind: 'box', index: 0 },
      { kind: 'rail', index: 0 },
      { kind: 'spawn' },
    ])
    expect(ignores).toEqual(['le départ'])
    expect(presse?.total).toBe(2)
    expect(presse?.copies.boxes).toEqual([lv.boxes[0]])
    expect(presse?.copies.boxes?.[0]).not.toBe(lv.boxes[0]) // un clone, pas l'original
    expect(presse?.emprise).toEqual({ minX: 100, minY: 100, maxX: 400, maxY: 450 })
  })

  it('n’a pas de presse-papier quand tout est unique', () => {
    const { presse, ignores } = copie(tableau(), [{ kind: 'exit' }, { kind: 'fiole' }])
    expect(presse).toBeNull()
    expect(ignores).toEqual(['le sas', 'la fiole'])
  })

  it('la pastille copiée porte son numéro logique, l’étiquette perd sa clé', () => {
    const lv = tableau()
    const { presse } = copie(lv, [
      { kind: 'cible', index: 0 },
      { kind: 'label', index: 0 },
    ])
    // la cible 0 n'a pas de canal en clair : son numéro logique est 1
    expect(presse?.copies.cibles?.[0].canal).toBe(1)
    expect(presse?.copies.labels?.[0]).toEqual({ x: 250, y: 400, text: 'ICI', tone: 'mur' })
    // l'original garde sa clé
    expect(lv.labels[0].cle).toBe('panneau-1')
  })

  it('ignore les doublons et garde l’ordre de peinture', () => {
    const { presse } = copie(tableau(), [
      { kind: 'box', index: 1 },
      { kind: 'box', index: 0 },
      { kind: 'box', index: 1 },
    ])
    expect(presse?.total).toBe(2)
    expect(presse?.copies.boxes?.map((b) => b.minX)).toEqual([100, 400])
  })
})

describe('coller', () => {
  it('ajoute des clones décalés et rend les références des nouveaux venus', () => {
    const lv = tableau()
    const refs = elementsDansCadre(lv, CADRE)
    const { presse } = copie(lv, refs)
    const res = colle(lv, presse!, 1000, 500)
    expect(res.ignores).toEqual([])
    expect(res.refs).toEqual([
      { kind: 'box', index: 2 },
      { kind: 'label', index: 1 },
      { kind: 'cible', index: 2 },
      { kind: 'sponge', index: 1 },
      { kind: 'rail', index: 1 },
      { kind: 'lumiere', index: 1 },
    ])
    expect(lv.boxes[2]).toEqual({ minX: 1100, minY: 600, maxX: 1300, maxY: 700, material: 1 })
    expect(lv.sponges[1]).toMatchObject({ minX: 1100, minY: 800, cols: 2, rows: 2 })
    expect(lv.labels[1]).toEqual({ x: 1250, y: 900, text: 'ICI', tone: 'mur' })
    expect(lv.cibles?.[2]).toEqual({ x: 1350, y: 850, r: 30, canal: 1 })
    expect(lv.rails?.[1].points).toEqual([{ x: 1100, y: 950 }, { x: 1400, y: 950 }])
    expect(lv.lumieres?.[1]).toEqual({ x: 1200, y: 750, intensite: 0.5 })
    // les originaux n'ont pas bougé
    expect(lv.boxes[0]).toEqual({ minX: 100, minY: 100, maxX: 300, maxY: 200, material: 1 })
    expect(lv.spawn).toEqual({ x: 150, y: 150, n: 300 })
  })

  it('deux collages font deux groupes indépendants du presse-papier', () => {
    const lv = tableau()
    const { presse } = copie(lv, [{ kind: 'rail', index: 0 }])
    const a = colle(lv, presse!, 0, 100)
    const b = colle(lv, presse!, 0, 200)
    expect(a.refs).toEqual([{ kind: 'rail', index: 1 }])
    expect(b.refs).toEqual([{ kind: 'rail', index: 2 }])
    lv.rails![1].points[0].x = -999
    expect(lv.rails![2].points[0].x).toBe(100)
    expect(presse!.copies.rails![0].points[0].x).toBe(100)
  })

  it('refuse les lampes au-delà du plafond, et le dit', () => {
    const lv = tableau({
      lumieres: Array.from({ length: MAX_LUMIERES - 1 }, (_, i) => ({ x: 50 * i, y: 50 })),
    })
    const { presse } = copie(lv, [
      { kind: 'lumiere', index: 0 },
      { kind: 'lumiere', index: 1 },
    ])
    const res = colle(lv, presse!, 0, 300)
    expect(lv.lumieres).toHaveLength(MAX_LUMIERES)
    expect(res.refs).toEqual([{ kind: 'lumiere', index: MAX_LUMIERES - 1 }])
    expect(res.ignores).toEqual([`1 lampe (plafond de ${MAX_LUMIERES})`])
  })
})

describe('le décalage de collage', () => {
  const emprise = { minX: 100, minY: 100, maxX: 300, maxY: 200 }
  it('pose le centre du groupe sous le curseur', () => {
    expect(decalageDeCollage(emprise, { x: 1000, y: 1000 }, 80)).toEqual({ dx: 800, dy: 850 })
  })
  it('sans curseur, un pas fixe vers l’est', () => {
    expect(decalageDeCollage(emprise, null, 80)).toEqual({ dx: 80, dy: 0 })
  })
})
