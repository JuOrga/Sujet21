import { describe, expect, it } from 'vitest'
import {
  CATALOGUE_REGLES,
  FAMILLES_REGLES,
  regleParId,
  reglesDeFamille,
} from './reglesGen'

describe('reglesGen — le cahier des règles', () => {
  it('chaque identité est unique et stable de forme', () => {
    const ids = CATALOGUE_REGLES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{2,64}$/)
  })

  it('chaque règle appartient à une famille déclarée, et aucune famille n’est vide', () => {
    const familles = new Set(FAMILLES_REGLES.map((f) => f.id))
    for (const r of CATALOGUE_REGLES) expect(familles).toContain(r.famille)
    for (const f of FAMILLES_REGLES)
      expect(
        CATALOGUE_REGLES.some((r) => r.famille === f.id),
        `famille ${f.id}`,
      ).toBe(true)
  })

  it('titres et textes sont écrits — pas de règle creuse', () => {
    for (const r of CATALOGUE_REGLES) {
      expect(r.titre.trim().length).toBeGreaterThan(8)
      expect(r.texte.trim().length).toBeGreaterThan(60)
    }
  })

  it('le cahier porte les deux natures : en place, et proposées', () => {
    expect(CATALOGUE_REGLES.some((r) => r.etat === 'en-place')).toBe(true)
    expect(CATALOGUE_REGLES.some((r) => r.etat === 'proposee')).toBe(true)
  })

  it('regleParId retrouve, reglesDeFamille classe en-place d’abord', () => {
    expect(regleParId('determinisme')?.famille).toBe('contrat')
    expect(regleParId('inconnue')).toBeNull()
    const rampe = reglesDeFamille('rampe')
    const premierePropo = rampe.findIndex((r) => r.etat === 'proposee')
    expect(premierePropo).toBeGreaterThan(0)
    for (let i = premierePropo; i < rampe.length; i++)
      expect(rampe[i].etat).toBe('proposee')
  })
})
