import { describe, expect, it } from 'vitest'
import { issueChargement, tableauOuvert } from './chargement'

describe('charger un JSON quand un tableau est ouvert', () => {
  it('un autre tableau : on demande (ENREGISTRER l’aurait écrasé)', () => {
    expect(issueChargement({ name: 'echangette' }, { name: 'Les 3 voies' })).toBe('demande')
  })

  it('le même tableau (une restauration) : le lien est gardé', () => {
    expect(issueChargement({ name: 'Les 3 voies' }, { name: ' les 3 VOIES ' })).toBe('garde')
  })

  it('aucun tableau ouvert : rien à écraser', () => {
    expect(issueChargement(null, { name: 'Les 3 voies' })).toBe('garde')
  })

  it('un JSON sans nom face à un tableau nommé : on demande', () => {
    expect(issueChargement({ name: 'echangette' }, {})).toBe('demande')
  })

  it('bibliothèque pas encore arrivée : le brouillon fait foi, et l’on demande quand même', () => {
    const brouillon = { name: 'echangette' }
    const ouvert = tableauOuvert('echangette', [], brouillon)
    expect(ouvert).toBe(brouillon)
    expect(issueChargement(ouvert, { name: 'Les 3 voies' })).toBe('demande')
  })

  it('l’entrée de la liste prime sur le brouillon ; sans lien, rien d’ouvert', () => {
    const lib = [{ id: 'x', level: { name: 'dans la liste' } }]
    expect(tableauOuvert('x', lib, { name: 'brouillon' })).toEqual({ name: 'dans la liste' })
    expect(tableauOuvert('', lib, { name: 'brouillon' })).toBeNull()
  })
})
