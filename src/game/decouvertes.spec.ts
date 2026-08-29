import { describe, expect, it } from 'vitest'
import { CODEX } from './codex'
import {
  DECOUVERTES,
  prochaineDecouverte,
  recitAcheve,
} from './decouvertes'

describe('l’arc des découvertes — un jalon par retour', () => {
  it('dix jalons, ids uniques, le-choix ferme la file', () => {
    expect(DECOUVERTES.length).toBe(10)
    expect(new Set(DECOUVERTES).size).toBe(10)
    expect(DECOUVERTES[DECOUVERTES.length - 1]).toBe('le-choix')
  })

  it('chaque jalon a sa fiche au codex (groupe recit), et réciproquement', () => {
    const fiches = CODEX.filter((d) => d.groupe === 'recit')
    expect(fiches.map((f) => f.id).sort()).toEqual(
      DECOUVERTES.map((id) => `recit-${id}`).sort(),
    )
    for (const f of fiches) {
      expect(f.titre.length).toBeGreaterThan(3)
      expect(f.texte.length).toBeGreaterThan(80) // un vrai jalon, pas un stub
      expect(f.mat).toBeUndefined() // servi par le récit, jamais par contact
    }
  })

  it('la file est ORDONNÉE : la prochaine est la première non-vue', () => {
    expect(prochaineDecouverte([])).toBe('livraison')
    expect(prochaineDecouverte(['livraison'])).toBe('cahier-charges')
    // un trou (id inconnu dans les vues) ne casse pas l'ordre
    expect(prochaineDecouverte(['livraison', 'fantome'])).toBe('cahier-charges')
    expect(prochaineDecouverte([...DECOUVERTES])).toBe(null)
  })

  it('recitAcheve ne cède qu’au récit complet', () => {
    expect(recitAcheve([])).toBe(false)
    expect(recitAcheve(DECOUVERTES.slice(0, 9))).toBe(false)
    expect(recitAcheve([...DECOUVERTES])).toBe(true)
    expect(recitAcheve([...DECOUVERTES, 'bonus'])).toBe(true)
  })
})
