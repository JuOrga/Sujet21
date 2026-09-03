import { describe, it, expect } from 'vitest'
import {
  ECRANS_PUPITRE,
  PUPITRES,
  fichePupitre,
  plaquePupitre,
} from './pupitres'

describe('le catalogue des pupitres', () => {
  it('n’a ni doublon ni fiche muette : chaque écran a son nom, son icône, sa note', () => {
    const ids = PUPITRES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of PUPITRES) {
      expect(p.nom.length).toBeGreaterThan(2)
      expect(p.icone.length).toBeGreaterThan(0)
      expect(p.note.length).toBeGreaterThan(20)
    }
  })

  it('ECRANS_PUPITRE dit exactement le catalogue — c’est lui que le format lit', () => {
    expect([...ECRANS_PUPITRE]).toEqual(PUPITRES.map((p) => p.id))
  })

  it('porte les trois écrans demandés : records, carte, avaries', () => {
    expect(ECRANS_PUPITRE).toContain('records')
    expect(ECRANS_PUPITRE).toContain('station')
    expect(ECRANS_PUPITRE).toContain('reparations')
  })

  it('une fiche se retrouve par son id ; un id hors catalogue rend null', () => {
    expect(fichePupitre('records')?.nom).toBe('MUR DES RECORDS')
    expect(fichePupitre('la-lune')).toBeNull()
    expect(fichePupitre('')).toBeNull()
  })

  it('la plaque : le titre posé prime, sinon le nom du catalogue', () => {
    expect(plaquePupitre({ ecran: 'records', titre: 'PALMARÈS' })).toBe(
      'PALMARÈS',
    )
    expect(plaquePupitre({ ecran: 'records' })).toBe('MUR DES RECORDS')
    // un titre vide (ou tout en espaces) ne compte pas : sans quoi le
    // pupitre n'aurait aucune plaque du tout
    expect(plaquePupitre({ ecran: 'station', titre: '   ' })).toBe(
      'PLAN DE LA STATION',
    )
  })
})
