// L'ATELIER DANS LE COFFRE (clesAtelier.ts) : les salles du joueur et son
// jeton d'auteur vivent dans le document de l'EMPLACEMENT — celui qui
// s'exporte et que le Steam Cloud synchronise — et non plus dans le
// stockage d'un seul navigateur, qui les perdait au premier ménage.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Coffre, cleEmplacement, litDocument, stockageMemoire } from './coffre'
import {
  CLES_ATELIER,
  CLE_ATELIER_SALLES,
  CLE_JETON_AUTEUR,
  reprendAtelierDuNavigateur,
} from './clesAtelier'

describe('la reprise depuis le navigateur', () => {
  it('copie ce que le coffre n’a pas, puis efface le double du navigateur', () => {
    const coffre = stockageMemoire()
    const nav = stockageMemoire()
    nav.setItem(CLE_ATELIER_SALLES, '[{"cle":"a"}]')
    nav.setItem(CLE_JETON_AUTEUR, 'j'.repeat(48))
    nav.setItem('sujet21.reglage-du-poste', 'reste')
    expect(reprendAtelierDuNavigateur(coffre, nav).sort()).toEqual([CLE_ATELIER_SALLES, CLE_JETON_AUTEUR].sort())
    expect(coffre.getItem(CLE_ATELIER_SALLES)).toBe('[{"cle":"a"}]')
    expect(nav.getItem(CLE_ATELIER_SALLES)).toBeNull()
    expect(nav.getItem(CLE_JETON_AUTEUR)).toBeNull()
    // ce qui n'est pas de l'atelier ne bouge pas
    expect(nav.getItem('sujet21.reglage-du-poste')).toBe('reste')
  })

  it('n’écrase JAMAIS une salle déjà dans le coffre par une copie de poste', () => {
    const coffre = stockageMemoire()
    const nav = stockageMemoire()
    coffre.setItem(CLE_JETON_AUTEUR, 'celui-du-coffre')
    nav.setItem(CLE_JETON_AUTEUR, 'celui-du-poste')
    expect(reprendAtelierDuNavigateur(coffre, nav)).toEqual([])
    expect(coffre.getItem(CLE_JETON_AUTEUR)).toBe('celui-du-coffre')
  })

  it('sans navigateur, ou avec un stockage qui refuse, rien ne se perd', () => {
    const coffre = stockageMemoire()
    expect(reprendAtelierDuNavigateur(coffre, null)).toEqual([])
    const hostile = { getItem: () => 'x', setItem: () => { throw new Error('plein') }, removeItem: () => { throw new Error('non') } }
    expect(() => reprendAtelierDuNavigateur(hostile, stockageMemoire())).not.toThrow()
    const navPlein = stockageMemoire()
    navPlein.setItem(CLE_JETON_AUTEUR, 'a-garder')
    reprendAtelierDuNavigateur({ getItem: () => null, setItem: () => { throw new Error('plein') }, removeItem: () => {} }, navPlein)
    // la copie a échoué : l'original reste au navigateur
    expect(navPlein.getItem(CLE_JETON_AUTEUR)).toBe('a-garder')
  })
})

describe('avec le vrai coffre', () => {
  it('les salles et le jeton finissent dans le DOCUMENT de l’emplacement — celui du Steam Cloud', () => {
    const dos = stockageMemoire()
    const c = new Coffre(dos, { maintenant: () => '2026-11-24T18:00:00.000Z', machine: () => 'poste-a' })
    const nav = stockageMemoire()
    nav.setItem(CLE_ATELIER_SALLES, '[{"cle":"a"}]')
    nav.setItem(CLE_JETON_AUTEUR, 'j'.repeat(48))
    reprendAtelierDuNavigateur(c.stockage, nav)
    const doc = litDocument(dos.getItem(cleEmplacement(c.actif))).doc
    expect(doc?.cles[CLE_ATELIER_SALLES]).toBe('[{"cle":"a"}]')
    expect(doc?.cles[CLE_JETON_AUTEUR]).toBe('j'.repeat(48))
  })
})

describe('le câblage', () => {
  const ED = readFileSync(new URL('../editor/editor.ts', import.meta.url), 'utf-8')
  const NET = readFileSync(new URL('./netCreations.ts', import.meta.url), 'utf-8')
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

  it('l’atelier lit et écrit par le stockage injecté, jamais directement au navigateur', () => {
    for (const ligne of ED.split('\n')) {
      if (/ATELIER_(META_|SALLES_)?KEY/.test(ligne) && /localStorage/.test(ligne)) throw new Error(`atelier au navigateur : ${ligne.trim()}`)
    }
    expect(ED).toContain('return this.hooks.stockageAtelier?.() ?? localStorage')
    expect(MAIN).toContain('stockageAtelier: () => coffre.stockage,')
  })

  it('le jeton et « Mes créations » aussi, et la reprise passe AVANT le branchement', () => {
    expect(NET).toContain('if (stockageBranche) return stockageBranche')
    const reprise = MAIN.indexOf('reprendAtelierDuNavigateur(coffre.stockage')
    const branche = MAIN.indexOf('brancheStockageCreations(coffre.stockage)')
    expect(reprise).toBeGreaterThan(0)
    expect(branche).toBeGreaterThan(reprise)
  })

  it('cinq clés, toutes de l’atelier', () => {
    expect(CLES_ATELIER).toHaveLength(5)
  })
})
