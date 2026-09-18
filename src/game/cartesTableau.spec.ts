import { describe, expect, it } from 'vitest'
import { GLACE_TIR_PART_MAX, cartesActives, cartesInconnues, litCartes, partTirEffective } from './cartesTableau'
import { INSTRUMENTS, levier } from './instruments'
import { REGLAGES_CIBLES } from './minijeux'

describe('les cartes d’un tableau', () => {
  it('les cartes imposées s’ajoutent aux tenues, une carte tenue et imposée ne compte qu’une fois', () => {
    expect(cartesActives(['buse-calibree'], ['eclateur', 'buse-calibree'])).toEqual(['buse-calibree', 'eclateur'])
    expect(cartesActives([], undefined)).toEqual([])
    expect(cartesActives(['eclateur'], ['eclateur'])).toEqual(['eclateur'])
  })

  it('l’Éclateur donne le tir de glace par le levier, la salle des cibles le donne par son preset — les deux s’additionnent', () => {
    expect(levier(['eclateur'], 'glaceTir')).toBeCloseTo(0.1)
    expect(levier([], 'glaceTir')).toBe(0)
    // tenue deux fois (imposée + en poche), elle ne compte qu'une fois
    expect(levier(cartesActives(['eclateur'], ['eclateur']), 'glaceTir')).toBeCloseTo(0.1)
    expect(partTirEffective(REGLAGES_CIBLES.glaceTir!, levier(['eclateur'], 'glaceTir'))).toBeCloseTo(0.2)
    // sans preset ni carte : rien ne part
    expect(partTirEffective(0, 0)).toBe(0)
  })

  it('la part de l’éclat est plafonnée, et jamais négative', () => {
    expect(partTirEffective(0.4, 0.3)).toBe(GLACE_TIR_PART_MAX)
    expect(partTirEffective(-1, 0.1)).toBeCloseTo(0.1)
    expect(partTirEffective(NaN, 0.1)).toBeCloseTo(0.1)
  })

  it('la vitesse de l’éclat se multiplie entre cartes, neutre à 1', () => {
    expect(levier([], 'glaceTirVitesse')).toBe(1)
    expect(levier(['eclateur'], 'glaceTirVitesse')).toBe(1)
  })

  it('l’Éclateur est une carte du catalogue livré, au tirage, à l’icône unique', () => {
    const d = INSTRUMENTS.find((c) => c.id === 'eclateur')!
    expect(d).toBeTruthy()
    expect(d.contrepartie).toBeFalsy()
    expect(INSTRUMENTS.filter((c) => c.icone === d.icone)).toHaveLength(1)
  })

  it('les identifiants inconnus du catalogue sont dits, une liste se lit sans doublon ni vide', () => {
    expect(cartesInconnues(['eclateur', 'carte-fantome'], INSTRUMENTS)).toEqual(['carte-fantome'])
    expect(cartesInconnues(undefined, INSTRUMENTS)).toEqual([])
    expect(litCartes(['eclateur', ' eclateur ', '', 3, 'ballast'])).toEqual(['eclateur', 'ballast'])
    expect(litCartes([])).toBeUndefined()
    expect(litCartes('eclateur')).toBeUndefined()
  })
})
