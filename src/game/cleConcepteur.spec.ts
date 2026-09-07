import { readFileSync, readdirSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { refusDeCle } from '../../api/_garde'
import {
  EN_TETE_CLE,
  cleEnPoche,
  fetchConcepteur,
  oublieCle,
  regleInvite,
  retientCle,
} from './cleConcepteur'

// LA CLÉ CONCEPTEUR — le test qui garde la porte fermée.
//
// Le 07/09, onze fonctions Vercel acceptaient POST et DELETE de n'importe
// qui : un `curl -X DELETE` en boucle vidait la bibliothèque partagée en
// trente secondes, et le magasin ne garde que quatre versions. Ce fichier
// vérifie les trois étages : la règle pure du serveur (api/_garde.ts), le
// geste du poste (fetchConcepteur), et — par lecture des sources — qu'aucun
// handler ni aucune écriture du jeu n'a oublié de passer par eux.

describe('La garde du serveur (refusDeCle)', () => {
  it('ferme tout tant que la variable n’est pas configurée : 503, jamais ouvert par oubli', () => {
    expect(refusDeCle('n’importe quoi', undefined)?.status).toBe(503)
    expect(refusDeCle('n’importe quoi', '')?.status).toBe(503)
  })
  it('réclame la clé quand elle manque (401), la refuse quand elle ment (403)', () => {
    expect(refusDeCle(undefined, 'secret')?.status).toBe(401)
    expect(refusDeCle('', 'secret')?.status).toBe(401)
    expect(refusDeCle('faux', 'secret')?.status).toBe(403)
    expect(refusDeCle('secre', 'secret')?.status).toBe(403) // longueur différente
    expect(refusDeCle('secret ', 'secret')?.status).toBe(403)
  })
  it('laisse passer la bonne clé', () => {
    expect(refusDeCle('secret', 'secret')).toBeNull()
    expect(refusDeCle('clé avec accents é', 'clé avec accents é')).toBeNull()
  })
})

interface Appel {
  url: string
  headers: Record<string, string>
}

/** Un `fetch` factice qui répond selon la clé présentée, comme le serveur. */
function serveur(attendue: string, appels: Appel[]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    appels.push({ url, headers })
    const refus = refusDeCle(headers[EN_TETE_CLE], attendue)
    return new Response(JSON.stringify(refus ?? { ok: true }), {
      status: refus?.status ?? 200,
    })
  }) as unknown as typeof fetch
}

describe('Le geste du poste (fetchConcepteur)', () => {
  beforeEach(() => {
    oublieCle()
    regleInvite(() => null)
  })

  it('joint la clé en poche à l’écriture, sans rien demander', async () => {
    retientCle('secret')
    const appels: Appel[] = []
    let demandes = 0
    regleInvite(() => (demandes++, null))
    const r = await fetchConcepteur('/api/levels', { method: 'DELETE' }, serveur('secret', appels))
    expect(r.status).toBe(200)
    expect(appels).toHaveLength(1)
    expect(appels[0].headers[EN_TETE_CLE]).toBe('secret')
    expect(demandes).toBe(0)
  })

  it('sans clé, la demande avant d’écrire, la retient, et la réutilise', async () => {
    const appels: Appel[] = []
    regleInvite(() => '  secret  ')
    const r = await fetchConcepteur(
      '/api/reglages',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      serveur('secret', appels),
    )
    expect(r.status).toBe(200)
    expect(appels).toHaveLength(1)
    expect(appels[0].headers).toEqual({ 'Content-Type': 'application/json', [EN_TETE_CLE]: 'secret' })
    expect(cleEnPoche()).toBe('secret') // rognée, gardée pour l'onglet
  })

  it('une clé refusée est oubliée, redemandée UNE fois, puis l’écriture repart', async () => {
    retientCle('périmée')
    const appels: Appel[] = []
    const propositions = ['secret']
    regleInvite(() => propositions.shift() ?? null)
    const r = await fetchConcepteur('/api/journal', { method: 'DELETE' }, serveur('secret', appels))
    expect(r.status).toBe(200)
    expect(appels.map((a) => a.headers[EN_TETE_CLE])).toEqual(['périmée', 'secret'])
    expect(cleEnPoche()).toBe('secret')
  })

  it('si l’on annule l’invite, la réponse du serveur revient telle quelle et rien n’est retenu', async () => {
    const appels: Appel[] = []
    const r = await fetchConcepteur('/api/codex', { method: 'POST' }, serveur('secret', appels))
    expect(r.status).toBe(401)
    expect(appels).toHaveLength(1)
    expect(cleEnPoche()).toBeNull()
  })

  it('n’insiste pas : deux refus d’affilée, et l’on rend le 403', async () => {
    retientCle('faux')
    const appels: Appel[] = []
    regleInvite(() => 'encore faux')
    const r = await fetchConcepteur('/api/images?nom=x', { method: 'DELETE' }, serveur('secret', appels))
    expect(r.status).toBe(403)
    expect(appels).toHaveLength(2)
  })
})

// ---- LE FILET : personne n'a oublié la clé -------------------------------

const RACINE = new URL('../../', import.meta.url)
const lit = (chemin: string): string => readFileSync(new URL(chemin, RACINE), 'utf-8')

/** Le corps d'une branche `if (req.method === 'X') {` — jusqu'à l'accolade
 *  qui la ferme. */
function brancheMethode(src: string, methode: string): string | null {
  const i = src.indexOf(`if (req.method === '${methode}')`)
  if (i < 0) return null
  const debut = src.indexOf('{', i)
  let n = 0
  for (let k = debut; k < src.length; k++) {
    if (src[k] === '{') n++
    else if (src[k] === '}' && --n === 0) return src.slice(debut, k + 1)
  }
  return null
}

describe('Le filet : chaque écriture passe par la clé', () => {
  /** Les deux endpoints où les JOUEURS écrivent : scores et rapports de
   *  performance. Tout autre handler qui écrit doit exiger la clé. */
  const OUVERTS = new Set(['records.ts', 'perf.ts'])

  it('chaque handler qui accepte POST ou DELETE appelle exigeCle en tête de la branche', () => {
    const handlers = readdirSync(new URL('api/', RACINE)).filter(
      (f) => f.endsWith('.ts') && !f.startsWith('_') && !OUVERTS.has(f),
    )
    expect(handlers.length).toBeGreaterThan(5)
    for (const f of handlers) {
      const src = lit(`api/${f}`)
      expect(src, `${f} n’importe pas la garde`).toContain("from './_garde.js'")
      for (const m of ['POST', 'DELETE']) {
        const branche = brancheMethode(src, m)
        if (!branche) continue // ce handler ne connaît pas cette méthode
        // la première instruction de la branche est la garde — sauf quand
        // GET et DELETE partagent leur branche (reglages) : la garde suit
        // alors le `return` du GET
        const gardee =
          branche.startsWith('{\n      if (!exigeCle(req, res)) return') ||
          /if \(req\.method === 'GET'\) \{[^}]*\}\n\s+if \(!exigeCle\(req, res\)\) return/.test(branche)
        expect(gardee, `${f} : la branche ${m} n’est pas gardée`).toBe(true)
      }
    }
  })

  it('aucune écriture du jeu vers /api n’appelle fetch nu (hors scores et rapports)', () => {
    const fautifs: string[] = []
    const parcourt = (dossier: string): void => {
      for (const e of readdirSync(new URL(dossier, RACINE), { withFileTypes: true })) {
        const chemin = `${dossier}${e.name}`
        if (e.isDirectory()) parcourt(`${chemin}/`)
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) {
          const src = lit(chemin)
          // l'adresse peut être une constante du fichier (ENDPOINT) plutôt
          // qu'un littéral sur place : on la lit pour reconnaître les
          // deux endpoints ouverts aux joueurs
          const endpoint = /const ENDPOINT = '([^']+)'/.exec(src)?.[1] ?? ''
          const lignes = src.split('\n')
          lignes.forEach((l, i) => {
            if (!/[^a-zA-Z]fetch\(/.test(l) || /fetchConcepteur\(/.test(l)) return
            // la méthode se déclare sur la même ligne ou dans les trois qui suivent
            const fenetre = lignes.slice(i, i + 4).join('\n')
            if (!/method:\s*'(POST|DELETE)'/.test(fenetre)) return
            if (/\/api\/(records|perf)/.test(fenetre + '\n' + endpoint)) return
            fautifs.push(`${chemin}:${i + 1}`)
          })
        }
      }
    }
    parcourt('src/')
    expect(fautifs).toEqual([])
  })
})
