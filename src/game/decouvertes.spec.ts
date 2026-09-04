import { describe, expect, it } from 'vitest'
import { CODEX } from './codex'
import {
  DECOUVERTES,
  prochaineDecouverte,
  recitAcheve,
  FINS,
  prochaineFin,
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

  it('chaque fin a sa fiche au codex (groupe fins), et réciproquement — jamais le marqueur fin-jouee', () => {
    const fiches = CODEX.filter((d) => d.groupe === 'fins')
    expect(fiches.map((d) => d.id).sort()).toEqual([...FINS].sort())
    expect(FINS.every((id) => id.startsWith('fin-'))).toBe(true)
    expect(FINS.includes('fin-jouee')).toBe(false)
    expect(new Set(FINS).size).toBe(FINS.length)
  })

  it('les fins se révèlent dans l’ordre, une par expédition bouclée, puis plus rien', () => {
    const vues: string[] = ['livraison', 'fin-jouee'] // le récit et le marqueur n’y changent rien
    for (const id of FINS) {
      expect(prochaineFin(vues)).toBe(id)
      vues.push(id)
    }
    expect(prochaineFin(vues)).toBeNull()
  })
})
