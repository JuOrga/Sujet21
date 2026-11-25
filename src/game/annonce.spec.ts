// L'ANNONCE DES NOUVEAUTÉS (annonce.ts) : quand elle paraît, ce qu'elle
// dit, et son câblage (main.ts et index.html, lus dans la source).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ANNONCE_COMMUNAUTE,
  annonceAMontrer,
  lisAnnoncesVues,
  marqueAnnonceVue,
  rendCarteAnnonce,
} from './annonce'
import { ICONES_ATELIER } from '../editor/iconesAtelier'

const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
const A = ANNONCE_COMMUNAUTE

describe('quand l’annonce paraît', () => {
  const base = { vues: [] as string[], lieuVisible: true, enPause: false }

  it('une fois : vue, elle ne revient plus', () => {
    expect(annonceAMontrer(A, base)).toBe(true)
    expect(annonceAMontrer(A, { ...base, vues: marqueAnnonceVue([], A.id) })).toBe(false)
  })

  it('pas tant que COMMUNAUTÉ n’est pas dans le rail (tout premier lancement)', () => {
    expect(annonceAMontrer(A, { ...base, lieuVisible: false })).toBe(false)
  })

  it('jamais par-dessus une partie en pause', () => {
    expect(annonceAMontrer(A, { ...base, enPause: true })).toBe(false)
  })

  it('la liste des vues se relit sans jamais lever, sans doublon', () => {
    expect(lisAnnoncesVues(null)).toEqual([])
    expect(lisAnnoncesVues('pas du json')).toEqual([])
    expect(lisAnnoncesVues('["a", 3, "b"]')).toEqual(['a', 'b'])
    expect(marqueAnnonceVue(['a'], 'a')).toEqual(['a'])
    expect(marqueAnnonceVue(['a'], 'b')).toEqual(['a', 'b'])
  })
})

describe('ce qu’elle dit', () => {
  it('trois cartes : où c’est, bâtir, jouer — chacune avec son dessin décrit', () => {
    expect(A.cartes.map((c) => c.titre)).toEqual(['COMMUNAUTÉ', 'BÂTISSEZ VOTRE SALLE', 'JOUEZ CELLES DES AUTRES'])
    for (const c of A.cartes) {
      expect(c.dessin).toMatch(/^<svg class="an-dessin" viewBox="0 0 320 180" role="img" aria-label="[^"]+"/)
      expect(c.puces.length).toBeGreaterThan(0)
      expect(c.puces.length).toBeLessThanOrEqual(3)
    }
  })

  it('le dessin de l’éditeur est fait de ses VRAIS pictogrammes', () => {
    const corps = (outil: string): string => ICONES_ATELIER[outil].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    for (const o of ['select', 'box:2', 'puits', 'laser']) expect(A.cartes[1].dessin, o).toContain(corps(o))
  })

  it('ne promet rien que le jeu ne fasse pas (la modération n’existe pas encore)', () => {
    const tout = JSON.stringify(A.cartes.map(({ dessin: _, ...mots }) => mots))
    expect(tout).not.toMatch(/modér/i)
    // les noms sont ceux du menu
    expect(tout).toContain('COMMUNAUTÉ')
    expect(tout).toContain('ÉDITEUR')
    expect(tout).toContain('CRÉATIONS DE LA COMMUNAUTÉ')
  })

  it('on feuillette : SUIVANT, PRÉCÉDENT, et la dernière carte mène droit à COMMUNAUTÉ', () => {
    const premiere = rendCarteAnnonce(A, 0)
    expect(premiere).toContain('id="an-suiv"')
    expect(premiere).not.toContain('id="an-prec"')
    expect(premiere).toContain('aria-selected="true" aria-label="Carte 1 sur 3"')
    const derniere = rendCarteAnnonce(A, 2)
    expect(derniere).toContain('id="an-prec"')
    expect(derniere).toContain('id="an-editeur"')
    expect(derniere).toContain('id="an-creations"')
    expect(derniere).not.toContain('id="an-suiv"')
    // hors bornes : ramené à la première ou à la dernière
    expect(rendCarteAnnonce(A, 99)).toBe(derniere)
    expect(rendCarteAnnonce(A, -4)).toBe(premiere)
  })
})

describe('le câblage', () => {
  it('une fenêtre de dialogue, au-dessus de la fiche, qui se ferme', () => {
    expect(HTML).toMatch(/<div id="annonce" hidden role="dialog" aria-modal="true" aria-labelledby="an-titre">/)
    expect(HTML).toContain('id="an-fermer"')
    expect(HTML).toMatch(/#annonce \{[^}]*z-index: 45/)
    // le mouvement se tait pour qui l'a demandé
    expect(HTML).toMatch(/prefers-reduced-motion: reduce\) \{\s*#annonce, #annonce \.an-boite, #annonce \.an-goutte/)
  })

  it('montrée depuis la fiche quand COMMUNAUTÉ paraît, retenue dans le coffre une fois fermée', () => {
    expect(MAIN).toMatch(/annonceAMontrer\(ANNONCE_COMMUNAUTE, \{ vues: annoncesVues\(\), lieuVisible: progression, enPause: hasPlayed \}\)/)
    const ferme = MAIN.slice(MAIN.indexOf('function fermeAnnonce'), MAIN.indexOf('function feuillette'))
    expect(ferme).toContain('coffre.stockage.setItem(CLE_ANNONCES_VUES')
  })

  it('la manette : B referme l’annonce, et l’écran des créations', () => {
    expect(MAIN).toContain("{ id: 'annonce', retour: 'an-fermer' }")
    expect(MAIN).toContain("{ id: 'creations', retour: 'cr-fermer' }")
    // l'annonce passe avant la fiche dans la pile
    expect(MAIN.indexOf("{ id: 'annonce'")).toBeLessThan(MAIN.indexOf("    id: 'home',"))
  })
})
