import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DELIVERIES } from './livraisons'
import { DERNIERE_LIVRAISON, VERSION, versionDe } from './changelog'

// LE JOURNAL RESTE HORS DU PAQUET — un test qui garde un gain mesuré.
//
// livraisons.ts pèse un demi-mégaoctet de prose. Tant qu'il était importé
// statiquement, il partait chez TOUS les joueurs : mesuré, 484 Ko bruts et
// 187 Ko comprimés, un tiers du téléchargement, pour un écran que seul le
// concepteur ouvre. Les chaînes ne se minifient pas — le poids du texte est
// le poids du texte, et aucun réglage de build n'y change rien.
//
// Le gain tient à UNE chose : que personne n'importe `./livraisons` en
// statique. Un seul `import { DELIVERIES } from './livraisons'` ajouté un
// jour dans le jeu, et les 187 Ko reviennent — sans erreur, sans test
// rouge, sans que rien ne le signale. D'où ce test.
//
// L'autre moitié : la version et la dernière livraison DOIVENT rester
// synchrones (la fiche les affiche à l'accueil, rapportPerf() les cite sans
// pouvoir attendre). Elles sont injectées à la compilation par
// vite.config.ts. On vérifie ici que ce qui est injecté dit bien la vérité
// du journal — sinon la fiche annoncerait une version fausse.

const DIR = new URL('.', import.meta.url)

/** Tous les .ts du jeu (hors tests) : les sources qui finissent dans le paquet. */
function sourcesDuJeu(): { chemin: string; texte: string }[] {
  const out: { chemin: string; texte: string }[] = []
  const parcours = (url: URL, prefixe: string): void => {
    for (const e of readdirSync(url, { withFileTypes: true })) {
      if (e.isDirectory()) parcours(new URL(`${e.name}/`, url), `${prefixe}${e.name}/`)
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts'))
        out.push({
          chemin: `${prefixe}${e.name}`,
          texte: readFileSync(new URL(e.name, url), 'utf-8'),
        })
    }
  }
  parcours(new URL('../', DIR), '')
  return out
}

describe('Le journal des livraisons', () => {
  it('n’est importé STATIQUEMENT nulle part dans le jeu', () => {
    // `import … from './livraisons'` ou '../bench/livraisons' — mais PAS
    // `import('./livraisons')`, qui est justement le chargement à la demande,
    // ni `import type`, qui disparaît à la compilation.
    const statique = /(?<!await\s)\bimport\s+(?!type\b)[^('"]*?from\s+['"][^'"]*\/livraisons['"]/s
    const fautes = sourcesDuJeu()
      .filter((f) => statique.test(f.texte))
      .map((f) => f.chemin)
    expect(fautes, 'ces fichiers ramèneraient 187 Ko dans le paquet').toEqual([])
  })

  it('se charge bien par import DYNAMIQUE depuis la façade', () => {
    const facade = readFileSync(new URL('changelog.ts', DIR), 'utf-8')
    expect(facade).toMatch(/import\(['"]\.\/livraisons['"]\)/)
  })

  it('accorde la version injectée à la compilation avec le journal réel', () => {
    // Si ce test tombe, `define` (vite.config.ts) ne s'applique plus : la
    // fiche afficherait une version fausse à l'accueil.
    expect(VERSION).toBe(`0.21.${DELIVERIES.length}`)
    expect(versionDe(0)).toBe(`0.21.${DELIVERIES.length}`)
    expect(versionDe(DELIVERIES.length - 1)).toBe('0.21.1')
  })

  it('accorde la dernière livraison injectée avec la première entrée', () => {
    expect(DERNIERE_LIVRAISON.date).toBe(DELIVERIES[0].date)
    expect(DERNIERE_LIVRAISON.title).toBe(DELIVERIES[0].title)
  })

  it('garde le journal trié de la plus récente à la plus ancienne', () => {
    // La règle est écrite en tête de livraisons.ts ; la version d'une entrée
    // se DÉDUIT de son rang, donc un journal mal trié fausse les numéros.
    const horodate = (d: string): number => {
      const m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d)$/.exec(d.trim())
      if (!m) return NaN
      return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5])
    }
    const t = DELIVERIES.map((d) => horodate(d.date))
    expect(t.filter((x) => !Number.isFinite(x)), 'dates mal formées').toEqual([])
    for (let i = 1; i < t.length; i++)
      expect(t[i], `${DELIVERIES[i].date} après ${DELIVERIES[i - 1].date}`).toBeLessThanOrEqual(t[i - 1])
  })
})
