// Le contrat du pool : les candidats se trouvent par l'ordre du code, les
// deux propositions privilégient le moment de la phase puis la diversité
// des mécaniques — et un rang sans pool laisse l'enchaînement linéaire.
import { describe, expect, it } from 'vitest'
import type { LevelDef } from './level'
import { candidatsAuRang, phaseRun, propositionsSalles } from './poule'

function niveau(code: string, name = code): LevelDef {
  return {
    name,
    code,
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    spawn: { x: 10, y: 50, n: 100 },
    exit: { minX: 80, minY: 40, maxX: 95, maxY: 60 },
    boxes: [],
    sponges: [],
  } as unknown as LevelDef
}

describe('Pool de salles', () => {
  it('phaseRun découpe la run en trois tiers', () => {
    expect(phaseRun(1, 9)).toBe(1)
    expect(phaseRun(4, 9)).toBe(2)
    expect(phaseRun(9, 9)).toBe(3)
  })

  it('candidatsAuRang filtre par les lettres d’ordre', () => {
    const seq = [
      niveau('21AA-101'),
      niveau('21AB-111'),
      niveau('21AB-121'),
      niveau('21-01'),
    ]
    expect(candidatsAuRang(seq, 2).map((l) => l.code)).toEqual([
      '21AB-111',
      '21AB-121',
    ])
    expect(candidatsAuRang(seq, 5)).toEqual([])
  })

  it('deux candidats au rang : deux propositions, mécaniques diverses', () => {
    const seq = [
      niveau('21AA-101'),
      niveau('21AB-111', 'glace facile'),
      niveau('21AB-121', 'vapeur facile'),
      niveau('21AB-112', 'glace dure'),
    ]
    const props = propositionsSalles(seq, 2, 6)
    expect(props).toHaveLength(2)
    // la première : moment adapté, difficulté douce — la seconde : une AUTRE mécanique
    expect(props[0].code).toBe('21AB-111')
    expect(props[1].code).toBe('21AB-121')
  })

  it('mécaniques identiques : l’écart de difficulté fait le second choix', () => {
    const seq = [niveau('21AB-111'), niveau('21AB-112'), niveau('21AB-115')]
    const props = propositionsSalles(seq, 2, 6)
    expect(props[0].code).toBe('21AB-111')
    expect(props[1].code).toBe('21AB-115')
  })

  it('moins de deux candidats : pas de choix, enchaînement linéaire', () => {
    const seq = [niveau('21AA-101'), niveau('21AB-111')]
    expect(propositionsSalles(seq, 2, 6)).toEqual([])
    expect(propositionsSalles(seq, 3, 6)).toEqual([])
  })
})
