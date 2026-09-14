import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  compteur,
  douce,
  motDeNote,
  PAS_LIGNE_MS,
  rangDeSalle,
  SEUILS_RANG,
  sortieDouce,
  TEMPS_BILAN,
} from './ceremonie'

describe('le rang d’une salle', () => {
  it('donne S à qui livre 90 % et plus — la prime peut porter au-delà du départ', () => {
    expect(rangDeSalle(0.9).rang).toBe('S')
    expect(rangDeSalle(1.0).rang).toBe('S')
    expect(rangDeSalle(1.4).rang).toBe('S')
  })

  it('descend palier par palier, aux seuils exacts', () => {
    expect(rangDeSalle(0.899).rang).toBe('A')
    expect(rangDeSalle(0.72).rang).toBe('A')
    expect(rangDeSalle(0.719).rang).toBe('B')
    expect(rangDeSalle(0.52).rang).toBe('B')
    expect(rangDeSalle(0.3).rang).toBe('C')
    expect(rangDeSalle(0.299).rang).toBe('D')
    expect(rangDeSalle(0).rang).toBe('D')
  })

  it('tombe au plus bas sur une part cassée, sans jamais lever', () => {
    expect(rangDeSalle(NaN).rang).toBe('D')
    expect(rangDeSalle(-1).rang).toBe('D')
    expect(rangDeSalle(Infinity).rang).toBe('D')
  })

  it('accompagne chaque lettre d’un mot, d’une teinte et d’étoiles décroissantes', () => {
    const rangs = SEUILS_RANG.map(([, seuil]) => rangDeSalle(seuil))
    for (const v of rangs) {
      expect(v.mot.length).toBeGreaterThan(0)
      expect(v.teinte).toMatch(/^#[0-9a-f]{6}$/i)
    }
    const etoiles = rangs.map((v) => v.etoiles)
    expect(etoiles).toEqual([5, 4, 3, 2, 1])
  })

  it('garde ses seuils rangés du plus haut au plus bas — c’est l’ordre de lecture', () => {
    for (let i = 1; i < SEUILS_RANG.length; i++)
      expect(SEUILS_RANG[i][1]).toBeLessThan(SEUILS_RANG[i - 1][1])
    expect(SEUILS_RANG[SEUILS_RANG.length - 1][1]).toBe(0)
  })
})

describe('les temps de la lecture', () => {
  it('arrivent dans l’ordre du récit : titre, rang, litres, prime, lignes, condensat, versement', () => {
    const t = TEMPS_BILAN
    expect(t.titre).toBe(0)
    expect(t.rang).toBeGreaterThan(t.titre)
    expect(t.litres).toBeGreaterThan(t.rang)
    expect(t.prime).toBeGreaterThan(t.litres)
    expect(t.lignes).toBeGreaterThan(t.prime)
    expect(t.condensat).toBeGreaterThan(t.lignes + PAS_LIGNE_MS * 2)
    expect(t.versement).toBeGreaterThan(t.condensat + 1000)
  })

  it('tiennent en moins de six secondes — au-delà, on saute', () => {
    expect(TEMPS_BILAN.versement).toBeLessThan(6000)
  })
})

describe('les courbes des compteurs', () => {
  it('partent de 0 et arrivent à 1, bornées hors du segment', () => {
    for (const f of [sortieDouce, douce]) {
      expect(f(0)).toBe(0)
      expect(f(1)).toBe(1)
      expect(f(-3)).toBe(0)
      expect(f(7)).toBe(1)
    }
  })

  it('montent sans jamais redescendre', () => {
    for (const f of [sortieDouce, douce]) {
      let prev = 0
      for (let i = 1; i <= 100; i++) {
        const v = f(i / 100)
        expect(v).toBeGreaterThanOrEqual(prev)
        prev = v
      }
    }
  })

  it('le compteur arrive EXACTEMENT à sa cible, et file vite au départ', () => {
    expect(compteur(0, 2.5, 1)).toBe(2.5)
    expect(compteur(0, 2.5, 1.4)).toBe(2.5)
    expect(compteur(0, 2.5, 0)).toBe(0)
    // à mi-course, plus des trois quarts du chemin : ça file, puis ça se pose
    expect(compteur(0, 100, 0.5)).toBeGreaterThan(75)
    expect(compteur(10, 10, 0.3)).toBe(10)
  })
})

describe('le mot de la note', () => {
  it('monte avec la note', () => {
    const mots = [0, 80, 180, 300].map(motDeNote)
    expect(new Set(mots).size).toBe(4)
  })
})

// L'ÉCRAN NE SE MONTE PAS TOUT SEUL : sa coque est dans index.html, son
// code dans main.ts, et rien ne relie les deux qu'une poignée
// d'identifiants en toutes lettres. La cérémonie a été refaite de fond en
// comble : ce test garde que chaque poignée que main.ts va chercher existe
// bien dans la coque — un id renommé d'un côté donne, sans ce filet, un
// écran qui s'ouvre sur du vide, sans erreur.
describe('la cérémonie — la coque et ses poignées', () => {
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

  it('porte tous les identifiants « mb-… » que main.ts va chercher', () => {
    const ids = new Set<string>()
    for (const m of MAIN.matchAll(/mbEl\('([a-z0-9-]+)'\)/g)) ids.add(m[1])
    for (const m of MAIN.matchAll(/getElementById\('(mb-[a-z0-9-]+)'\)/g)) ids.add(m[1])
    expect(ids.size).toBeGreaterThan(12) // le test regarde bien quelque chose
    for (const id of ids)
      expect(HTML, `id="${id}" manque à index.html`).toContain(`id="${id}"`)
  })

  it('reste une couche de menu sans porte de sortie : on choisit, on ne ferme pas', () => {
    expect(MAIN).toMatch(/\{ id: 'mb-veil' \}/)
  })

  it('respecte le réglage « moins d’animations » : chaque mise en scène a son repli', () => {
    // la feuille de style de la cérémonie porte ses propres règles de
    // repli — sans elles, un joueur qui a demandé moins d'animations
    // verrait quand même la bannière claquer et les cartes se retourner
    const css = HTML.slice(HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE'), HTML.indexOf('/* ---- Le panneau du GÉNÉRATEUR'))
    expect(css.length).toBeGreaterThan(1000)
    expect(css).toContain('prefers-reduced-motion: reduce')
  })
})
