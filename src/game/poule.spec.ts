// Le contrat du pool : les candidats se trouvent par l'ordre du code, les
// deux propositions privilégient le moment de la phase puis la diversité
// des mécaniques — et un rang sans pool laisse l'enchaînement linéaire.
import { describe, expect, it } from 'vitest'
import type { LevelDef } from './level'
import {
  candidatsAuRang,
  candidatsPool,
  ecartAuCahier,
  phaseRun,
  piocheEcrite,
  propositionsSalles,
} from './poule'
import type { CodeAtelier } from './levelIO'

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

describe('LA PIOCHE DU POOL : le trigramme, pas le rang', () => {
  const zero = new Set<string>()
  const tout = (): boolean => true
  const premier = (): number => 0
  const vise = (
    moment: 1 | 2 | 3,
    difficulte: number,
  ): CodeAtelier => ({ moment, mecanique: 3, difficulte })

  it('candidatsPool garde tout le monde, et lit le cahier quand il existe', () => {
    const seq = [niveau('21AA-101'), niveau('21-A'), niveau('213')]
    expect(candidatsPool(seq).map((c) => c.atelier !== null)).toEqual([
      true,
      false,
      true,
    ])
  })

  it('LA BIBLIOTHÈQUE NON MIGRÉE continue de se proposer, dans son ordre', () => {
    // aucun tableau livré ne porte encore le trigramme : une pioche
    // strictement trigrammée aurait supprimé la carte écrite du jeu
    const seq = [niveau('21-A'), niveau('21-B'), niveau('21-C')]
    expect(piocheEcrite(seq, vise(2, 3), zero, tout, premier)?.code).toBe('21-A')
    // le hasard ne bat pas les muets : l'ordre tient, comme avant
    expect(piocheEcrite(seq, vise(2, 3), zero, tout, () => 0.99)?.code).toBe(
      '21-A',
    )
    // et le premier vu franchi, c'est le suivant
    expect(
      piocheEcrite(seq, vise(2, 3), new Set(['21-A']), tout, premier)?.code,
    ).toBe('21-B')
  })

  it('un tableau CODÉ passe devant un muet, même mal assorti', () => {
    const seq = [niveau('21-A'), niveau('21AA-101')]
    // la case demande du moment 3 : « 101 » est loin, mais il est codé
    expect(piocheEcrite(seq, vise(3, 9), zero, tout, premier)?.code).toBe(
      '21AA-101',
    )
  })

  it('l’écart pèse le MOMENT dix fois la difficulté', () => {
    const a = { moment: 1, mecanique: 0, difficulte: 0 } as CodeAtelier
    // un cran de moment coûte plus que neuf crans de difficulté
    expect(ecartAuCahier(a, vise(2, 0))).toBeGreaterThan(
      ecartAuCahier(a, vise(1, 9)),
    )
  })

  it('la pioche prend le tableau le plus proche de la case du plan', () => {
    const seq = [
      niveau('21AA-101'), // moment 1, diff 1
      niveau('21AB-233'), // moment 2, diff 3
      niveau('21AC-317'), // moment 3, diff 7
    ]
    expect(piocheEcrite(seq, vise(2, 3), zero, tout, premier)?.code).toBe(
      '21AB-233',
    )
    expect(piocheEcrite(seq, vise(3, 7), zero, tout, premier)?.code).toBe(
      '21AC-317',
    )
  })

  it('L’ORDRE N’EST PLUS L’ORDRE : un tableau rangé haut remplit une case tardive', () => {
    const seq = [
      niveau('21AA-337'), // rangé premier, mais c'est un tableau de FIN
      niveau('21AB-101'),
      niveau('21AC-111'),
    ]
    expect(piocheEcrite(seq, vise(3, 7), zero, tout, premier)?.code).toBe(
      '21AA-337',
    )
  })

  it('un tableau déjà vu de la run ne se repioche pas', () => {
    const seq = [niveau('21AA-233'), niveau('21AB-234')]
    const vus = new Set(['21AA-233'])
    expect(piocheEcrite(seq, vise(2, 3), vus, tout, premier)?.code).toBe(
      '21AB-234',
    )
    // les deux vus : le pool n'a plus rien, la descente reste procédurale
    expect(
      piocheEcrite(seq, vise(2, 3), new Set(['21AA-233', '21AB-234']), tout, premier),
    ).toBeNull()
  })

  it('un tableau qui EXIGE un état non tissé est écarté', () => {
    const dur = niveau('21AA-233')
    ;(dur as { exige?: string[] }).exige = ['glace']
    const seq = [dur, niveau('21AB-234')]
    const sansGlace = (lv: LevelDef): boolean => (lv.exige ?? []).length === 0
    expect(piocheEcrite(seq, vise(2, 3), zero, sansGlace, premier)?.code).toBe(
      '21AB-234',
    )
  })

  it('à écart égal, la mécanique qu’on vient de jouer passe en second', () => {
    const seq = [niveau('21AA-213'), niveau('21AB-223')]
    // sans consigne, le premier ex æquo sort
    expect(piocheEcrite(seq, vise(2, 3), zero, tout, premier)?.code).toBe(
      '21AA-213',
    )
    // en évitant la mécanique 1, l'autre passe devant
    expect(piocheEcrite(seq, vise(2, 3), zero, tout, premier, 1)?.code).toBe(
      '21AB-223',
    )
  })

  it('à écart égal, le hasard départage — deux descentes diffèrent', () => {
    const seq = [niveau('21AA-233'), niveau('21AB-233'), niveau('21AC-233')]
    const vus = new Set<string>()
    const tires = new Set<string>()
    for (const r of [0, 0.5, 0.99])
      tires.add(piocheEcrite(seq, vise(2, 3), vus, tout, () => r)!.code)
    expect(tires.size).toBe(3)
  })
})
