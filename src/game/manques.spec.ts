import { describe, expect, it } from 'vitest'
import type { LevelDef } from './level'
import { cleManque, inventairePool, litManques, noteManque } from './manques'

// des tableaux réduits à ce que l'inventaire lit : le code et le biome
const lv = (code: string, biome?: string): LevelDef => ({ code, biome }) as unknown as LevelDef

describe('inventairePool — ce que la bibliothèque contient, case par case', () => {
  it('compte par biome, mécanique et moment ; un tableau sans biome compte partout, un tableau muet nulle part', () => {
    const inv = inventairePool(
      [
        lv('21AC-100'), // eau (mécanique 0), début, universel
        lv('21AD-110', 'cryo'), // glace, début, cryo seulement
        lv('21AE-222', 'chaud'), // vapeur, milieu, chaud seulement
        lv('LIBRE-01'), // sans cahier : ne remplit aucune case
      ],
      ['cryo', 'chaud', 'cryo', ''],
    )
    // deux biomes (le doublon et le vide s'écartent) × quatre mécaniques × trois moments
    expect(inv).toHaveLength(2 * 4 * 3)
    const c = (biome: string, mecanique: number, moment: number): string[] =>
      inv.find((x) => x.biome === biome && x.mecanique === mecanique && x.moment === moment)!.codes
    expect(c('cryo', 0, 1)).toEqual(['21AC-100'])
    expect(c('chaud', 0, 1)).toEqual(['21AC-100'])
    expect(c('cryo', 1, 1)).toEqual(['21AD-110'])
    expect(c('chaud', 1, 1)).toEqual([])
    expect(c('chaud', 2, 2)).toEqual(['21AE-222'])
    expect(c('cryo', 2, 2)).toEqual([])
    expect(inv.every((x) => !x.codes.includes('LIBRE-01'))).toBe(true)
  })
})

describe('noteManque — le relevé des portes générées faute de tableau', () => {
  const base = { biome: 'cryo', mecanique: 1 as const, moment: 2 as const, difficulte: 3, module: 'C1' }

  it('un manque s’ajoute, le même se compte, un autre module est un autre manque', () => {
    let l = noteManque([], base, '2026-09-16T10:00:00Z')
    expect(l).toEqual([{ ...base, fois: 1, dernier: '2026-09-16T10:00:00Z' }])
    l = noteManque(l, { ...base, difficulte: 4 }, '2026-09-16T11:00:00Z')
    expect(l).toHaveLength(1)
    expect(l[0].fois).toBe(2)
    expect(l[0].difficulte).toBe(4) // la plus récente
    expect(l[0].dernier).toBe('2026-09-16T11:00:00Z')
    l = noteManque(l, { ...base, module: 'C3' })
    expect(l).toHaveLength(2)
    expect(cleManque(l[1])).toBe('cryo|1|2|C3')
  })

  it('le relevé se trie par occurrences, et se lit du stockage sans jamais lever', () => {
    let l = noteManque([], { ...base, module: 'A' })
    l = noteManque(l, { ...base, module: 'B' })
    l = noteManque(l, { ...base, module: 'B' })
    expect(l.map((m) => m.module)).toEqual(['B', 'A'])
    expect(litManques(undefined)).toEqual([])
    expect(litManques('x')).toEqual([])
    expect(litManques([{ biome: 'cryo', mecanique: 9, moment: 1 }, null, { mecanique: 2, moment: 3, fois: 2.7 }])).toEqual([
      { biome: '', mecanique: 2, moment: 3, difficulte: 0, module: '', fois: 2, dernier: '' },
    ])
    expect(litManques(JSON.parse(JSON.stringify(l)))).toEqual(l)
  })
})
