// L'arbre de l'Éveil : les règles d'achat (prérequis, pré-acquis, à
// venir) et le facteur de péage.
import { describe, expect, it } from 'vitest'
import { NOEUDS_EVEIL, facteurPeage, noeudAchetable, noeudTenu } from './eveil'
import { Records, type StorageLike } from './records'

function memoryStorage(): StorageLike {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

describe('l’arbre de l’Éveil', () => {
  it('les pouvoirs d’état sont tenus d’origine, les « à venir » jamais achetables', () => {
    expect(noeudTenu('solidification', [])).toBe(true)
    expect(noeudTenu('vaporisation', [])).toBe(true)
    expect(noeudAchetable('solidification', [])).toBe(false) // déjà tenu
    expect(noeudAchetable('sublimation', [])).toBe(false) // à venir
    expect(noeudAchetable('ionisation', [])).toBe(false)
  })

  it('les prérequis se respectent : la bascule maîtrisée attend l’économe', () => {
    expect(noeudAchetable('peage-1', [])).toBe(true) // vaporisation pré-acquise
    expect(noeudAchetable('peage-2', [])).toBe(false)
    expect(noeudAchetable('peage-2', ['peage-1'])).toBe(true)
    expect(noeudAchetable('peage-1', ['peage-1'])).toBe(false) // déjà tenu
  })

  it('le facteur de péage : 20 % → 17 % → 15 %', () => {
    expect(facteurPeage([])).toBe(1)
    expect(facteurPeage(['peage-1'])).toBe(0.85)
    expect(facteurPeage(['peage-1', 'peage-2'])).toBe(0.75)
    expect(0.2 * facteurPeage(['peage-1', 'peage-2'])).toBeCloseTo(0.15)
  })

  it('l’achat est atomique dans les registres : mémoire ET nœud, ou rien', () => {
    const st = memoryStorage()
    const r = new Records(st)
    r.gagneMemoire(50)
    expect(r.acquiertEveil('peage-1', 35)).toBe(true)
    expect(r.memoire()).toBe(15)
    expect(r.eveilTient('peage-1')).toBe(true)
    expect(r.acquiertEveil('peage-1', 35)).toBe(false) // jamais deux fois
    expect(r.acquiertEveil('souffle', 40)).toBe(false) // solde insuffisant
    expect(r.memoire()).toBe(15)
    // persistance
    expect(new Records(st).eveilAcquis()).toEqual(['peage-1'])
  })

  it('le catalogue est cohérent : ids uniques, prérequis existants', () => {
    const ids = new Set(NOEUDS_EVEIL.map((n) => n.id))
    expect(ids.size).toBe(NOEUDS_EVEIL.length)
    for (const n of NOEUDS_EVEIL)
      for (const p of n.prereq ?? [])
        expect(ids.has(p), `${n.id}→${p}`).toBe(true)
  })
})
