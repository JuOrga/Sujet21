import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LA COUVERTURE DE LA SAUVEGARDE — ce que l'API sert, le script le lit.
//
// Le 07/09, ops/sauvegarde.mjs connaissait sept familles ; l'API en
// servait dix, plus cinq domaines derrière /api/reglages. Le journal
// (récit et fins), les réglages du codex, le plan de la descente, la
// CARTE DE LA STATION, les récompenses, les textes et les séquences
// publiés n'avaient que les quatre versions du magasin : un
// `DELETE ?domaine=carte` les effaçait sans recours. Chaque nouvel
// endpoint avait été livré avec son écran, jamais avec sa famille.
//
// Ce test lit les deux côtés dans les sources : chaque handler de api/
// (hors helpers, hors perf — des rapports de diagnostic, pas du contenu)
// doit avoir sa `route:` dans le script, et chaque domaine de
// api/reglages.ts sa route `reglages?domaine=…` et son fichier. Un
// endpoint ajouté demain sans sa famille fera tomber ce test.

const RACINE = new URL('../../', import.meta.url)
const lit = (chemin: string): string => readFileSync(new URL(chemin, RACINE), 'utf-8')

/** Les endpoints qui ne portent pas de contenu de concepteur. */
const HORS_SAUVEGARDE = new Set(['perf'])

describe('La sauvegarde couvre tout ce que l’API sert', () => {
  const script = lit('ops/sauvegarde.mjs')
  const restaure = lit('ops/restaure.mjs')

  it('chaque handler de api/ a sa famille dans ops/sauvegarde.mjs', () => {
    const handlers = readdirSync(new URL('api/', RACINE))
      .filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.spec.ts'))
      .map((f) => f.slice(0, -3))
      .filter((r) => !HORS_SAUVEGARDE.has(r))
    expect(handlers.length).toBeGreaterThan(8)
    for (const route of handlers) {
      const presente = script.includes(`route: '${route}'`) || script.includes(`route: \`${route}?`)
      expect(presente, `/api/${route} n’a pas de famille dans ops/sauvegarde.mjs`).toBe(true)
    }
  })

  it('chaque domaine de api/reglages.ts a sa route et son fichier', () => {
    const src = lit('api/reglages.ts')
    const m = /const DOMAINES = \[([^\]]+)\]/.exec(src)
    expect(m, 'DOMAINES introuvable dans api/reglages.ts').not.toBeNull()
    const domaines = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(domaines.length).toBeGreaterThanOrEqual(5)
    // les domaines sont écrits en clair dans le script (une liste), pas
    // recopiés par un import : le script tourne sans TypeScript
    for (const d of domaines) {
      expect(script.includes(`'${d}'`), `domaine ${d} absent de ops/sauvegarde.mjs`).toBe(true)
      expect(restaure.includes(`'${d}'`), `domaine ${d} absent de ops/restaure.mjs`).toBe(true)
    }
    expect(script).toContain('route: `reglages?domaine=${domaine}`')
    expect(script).toContain('fichier: `reglages-${domaine}.json`')
  })

  it('la restauration rend le journal, les réglages et le codex, sans publier du vide', () => {
    for (const fichier of ['journal.json', 'codex.json', 'reglages-${domaine}.json']) {
      expect(restaure.includes(fichier), `${fichier} non relu par ops/restaure.mjs`).toBe(true)
    }
    for (const route of ["poste('journal'", "poste('reglages'", "poste('codex'"]) {
      expect(restaure.includes(route), `${route} absent de ops/restaure.mjs`).toBe(true)
    }
    // « rien de publié » se saute : on ne remplace pas le livré par du vide
    expect(restaure).toContain('journal.journal === null')
    expect(restaure).toContain('r.document === null')
  })
})
