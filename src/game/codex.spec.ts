// Le contrat du codex : la matrice état × élément est COMPLÈTE (chaque
// matériau physique a ses trois fiches), les fiches sont uniques et
// écrites, la découverte persiste, et la lecture des contacts du solveur
// débloque la bonne fiche — jamais une autre.
import { describe, expect, it } from 'vitest'
import { CODEX, Codex, codexCle } from './codex'
import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
} from './level'

function stockage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

const MATS_PHYSIQUES = [
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
]

describe('Codex — la table des fiches', () => {
  it('les identifiants sont uniques', () => {
    const ids = CODEX.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque fiche est écrite : titre et texte non vides, une icône', () => {
    for (const d of CODEX) {
      expect(d.titre.length, d.id).toBeGreaterThan(4)
      expect(d.texte.length, d.id).toBeGreaterThan(30)
      expect(d.icone.length, d.id).toBeGreaterThan(0)
    }
  })

  it('la matrice est complète : chaque matériau physique × chaque état', () => {
    for (const mat of MATS_PHYSIQUES) {
      for (const etat of [0, 1, 2] as const) {
        const fiches = CODEX.filter((d) => d.mat === mat && d.etat === etat)
        expect(fiches.length, `mat ${mat} × état ${etat}`).toBe(1)
      }
    }
    // 27 combinaisons + les fiches « phénomènes »
    const combos = CODEX.filter((d) => d.mat !== undefined)
    expect(combos.length).toBe(27)
    expect(CODEX.length).toBeGreaterThan(combos.length)
  })

  it('les groupes suivent l’état de la combinaison', () => {
    for (const d of CODEX) {
      if (d.etat === undefined) {
        expect(d.groupe, d.id).toBe('phenomenes')
      } else {
        expect(d.groupe, d.id).toBe(['eau', 'glace', 'vapeur'][d.etat])
      }
    }
  })
})

describe('Codex — découvertes', () => {
  it('marque une fois, prévient une fois, persiste', () => {
    const s = stockage()
    const c = new Codex(s)
    let fanfares = 0
    c.onDecouverte = () => fanfares++
    c.marque('eau-mur')
    c.marque('eau-mur')
    expect(fanfares).toBe(1)
    expect(c.connu('eau-mur')).toBe(true)
    expect(c.compte()).toBe(1)
    const relu = new Codex(s)
    expect(relu.connu('eau-mur')).toBe(true)
    expect(relu.quand('eau-mur')).not.toBe('')
  })

  it('un identifiant inconnu ne consigne rien', () => {
    const c = new Codex(stockage())
    c.marque('fiche-fantome')
    expect(c.compte()).toBe(0)
  })

  it('litContacts débloque la fiche de la combinaison — et elle seule', () => {
    const c = new Codex(stockage())
    const contacts = new Uint8Array(30)
    contacts[codexCle(MAT_RIDEAU, 1)] = 1 // la glace écarte le rideau
    c.litContacts(contacts)
    expect(c.connu('glace-rideau')).toBe(true)
    expect(c.compte()).toBe(1)
    contacts[codexCle(MAT_GRILLE, 2)] = 1 // la vapeur traverse l'évent
    c.litContacts(contacts)
    expect(c.connu('vapeur-grille')).toBe(true)
    expect(c.compte()).toBe(2)
  })
})
