// LE MAGASIN DES CRÉATIONS (api/_creations.ts) joué contre un dépôt en
// mémoire qui tient les ETags comme Vercel Blob : une écriture avec un ETag
// dépassé est refusée, une création sur un chemin pris aussi. Le dépôt sait
// glisser une écriture CONCURRENTE juste avant la nôtre — le cas où, avec
// le magasin des concepteurs, l'une des deux publications disparaissait.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CHEMIN_INDEX,
  CREATIONS_MAX,
  ESSAIS_ECRITURE,
  PAR_AUTEUR_MAX,
  RECORDS_MAX,
  cheminRecords,
  cheminSalle,
  codeCreation,
  empreinteJeton,
  traiteCreations,
  type Depot,
  type EntreeIndex,
  type Reponse,
} from '../../api/_creations'
import { parseLevel } from './levelIO'
import { reseau } from './reseau'
import {
  deposeRecordCreation,
  fetchCreations,
  jetonAuteur,
  mesCreations,
  publieCreation,
  raisonCreation,
  retireCreation,
} from './netCreations'

// ---- le dépôt en mémoire ------------------------------------------------------

function depotMemoire(): {
  depot: Depot
  docs: Map<string, { corps: string; etag: string }>
  /** joué une fois, juste AVANT la prochaine écriture sur ce chemin */
  avant: Map<string, () => void>
  ecritures: string[]
  pose(chemin: string, corps: unknown): void
} {
  const docs = new Map<string, { corps: string; etag: string }>()
  const avant = new Map<string, () => void>()
  const ecritures: string[] = []
  let n = 0
  const pose = (chemin: string, corps: unknown): void => {
    docs.set(chemin, { corps: JSON.stringify(corps), etag: `e${++n}` })
  }
  const depot: Depot = {
    async lit(chemin) {
      const d = docs.get(chemin)
      return d ? { corps: JSON.parse(d.corps) as unknown, etag: d.etag } : null
    },
    async ecrit(chemin, corps, etag) {
      const h = avant.get(chemin)
      if (h) {
        avant.delete(chemin)
        h()
      }
      const d = docs.get(chemin)
      if (etag === null ? d !== undefined : d?.etag !== etag) return 'conflit'
      pose(chemin, corps)
      ecritures.push(chemin)
      return 'ok'
    },
    async efface(chemin) {
      docs.delete(chemin)
    },
  }
  return { depot, docs, avant, ecritures, pose }
}

const JETON_A = 'a'.repeat(40)
const JETON_B = 'b'.repeat(40)
const QUAND = '2026-11-24T12:00:00.000Z'

function salle(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'La ronde',
    journal: 'Payer la coupelle, puis s’arracher au puits.',
    bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
    spawn: { x: -800, y: 0, n: 900 },
    exit: { minX: 800, minY: -100, maxX: 950, maxY: 100 },
    boxes: [{ minX: -200, minY: 300, maxX: 200, maxY: 340, material: 0 }],
    sponges: [],
    labels: [],
    ...extra,
  }
}

function fait(depot: Depot, methode: string, opts: { query?: Record<string, string>; corps?: unknown; jeton?: string } = {}): Promise<Reponse> {
  return traiteCreations({ methode, query: opts.query ?? {}, corps: opts.corps, jeton: opts.jeton }, depot, () => QUAND)
}

const publier = (depot: Depot, extra: Record<string, unknown> = {}): Promise<Reponse> =>
  fait(depot, 'POST', {
    corps: { action: 'publier', salle: salle(), auteur: 'JULIAN', jeton: JETON_A, essai: { litres: 61, temps: 42.6 }, ...extra },
  })

const corpsDe = <T = Record<string, unknown>>(r: Reponse): T => r.corps as T

// ---- publier et lire ------------------------------------------------------------

describe('publier une salle', () => {
  it('elle entre dans la liste, se relit comme le jeu la lira, et la partie de l’auteur est son premier record', async () => {
    const { depot } = depotMemoire()
    const p = await publier(depot)
    expect(p.statut).toBe(200)
    const { id, code } = corpsDe<{ id: string; code: string }>(p)
    expect(code).toBe(codeCreation(id))

    const liste = corpsDe<{ creations: Record<string, unknown>[] }>(await fait(depot, 'GET')).creations
    expect(liste).toHaveLength(1)
    expect(liste[0]).toMatchObject({ id, code, nom: 'La ronde', auteur: 'JULIAN', meilleur: { nom: 'JULIAN', litres: 61, temps: 42.6 } })
    // la clé d'auteur ne sort jamais
    expect(liste[0]).not.toHaveProperty('cle')

    const une = corpsDe<{ creation: Record<string, unknown>; records: { volume: unknown[] } }>(
      await fait(depot, 'GET', { query: { id } }),
    )
    expect(une.creation).not.toHaveProperty('empreinteJeton')
    const { level, rejets } = parseLevel(une.creation.salle)
    expect(rejets).toEqual([])
    expect(level!.code).toBe(code)
    expect(une.records.volume).toEqual([{ nom: 'JULIAN', litres: 61, temps: 42.6, quand: QUAND }])
  })

  it('la liste blanche a trié ce qu’elle garde', async () => {
    const { depot, docs } = depotMemoire()
    const p = await publier(depot, { salle: salle({ plots: [{}], reglages: { g: 1 } }) })
    const { id, retouches } = corpsDe<{ id: string; retouches: string[] }>(p)
    const doc = JSON.parse(docs.get(cheminSalle(id))!.corps) as { salle: Record<string, unknown> }
    expect(doc.salle).not.toHaveProperty('plots')
    expect(doc.salle).not.toHaveProperty('reglages')
    expect(retouches.join('\n')).toContain('« plots »')
  })

  it('refuse, avec sa raison, ce qui ne se publie pas', async () => {
    const { depot, docs } = depotMemoire()
    const cas: [Record<string, unknown>, string][] = [
      [{ jeton: 'court' }, 'jeton'],
      [{ auteur: '  ' }, 'nom d’auteur'],
      [{ essai: undefined }, 'sortie atteinte'],
      [{ essai: { litres: 61, temps: 0 } }, 'sortie atteinte'],
      [{ salle: salle({ name: '' }) }, 'nom'],
    ]
    for (const [extra, mot] of cas) {
      const r = await publier(depot, extra)
      expect(r.statut).toBe(400)
      expect(corpsDe<{ error: string }>(r).error).toContain(mot)
    }
    expect(docs.size).toBe(0)
  })
})

describe('deux joueurs publient à la même seconde', () => {
  it('l’index relu et réappliqué garde les deux salles', async () => {
    const m = depotMemoire()
    const premiere = corpsDe<{ id: string }>(await publier(m.depot)).id
    // entre notre lecture de l'index et notre écriture, un autre publie
    const intrus: EntreeIndex = { id: 'zzzzzzzz', code: 'J-ZZZZZZZZ', nom: 'Autre', auteur: 'AMI', creeLe: QUAND, majLe: QUAND, empreinte: 'x', cle: 'y' }
    m.avant.set(CHEMIN_INDEX, () => {
      const idx = JSON.parse(m.docs.get(CHEMIN_INDEX)!.corps) as { creations: EntreeIndex[] }
      m.pose(CHEMIN_INDEX, { format: 1, creations: [...idx.creations, intrus] })
    })
    const seconde = corpsDe<{ id: string }>(await publier(m.depot, { jeton: JETON_B })).id
    const ids = corpsDe<{ creations: { id: string }[] }>(await fait(m.depot, 'GET')).creations.map((c) => c.id).sort()
    expect(ids).toEqual([premiere, seconde, 'zzzzzzzz'].sort())
  })

  it('un index disputé sans fin finit en refus clair, et la salle écrite ne traîne pas', async () => {
    const m = depotMemoire()
    await publier(m.depot)
    // à chaque écriture de l'index, quelqu'un écrit juste avant nous
    const derange = (): void => {
      m.pose(CHEMIN_INDEX, JSON.parse(m.docs.get(CHEMIN_INDEX)!.corps))
      m.avant.set(CHEMIN_INDEX, derange)
    }
    m.avant.set(CHEMIN_INDEX, derange)
    const r = await publier(m.depot, { jeton: JETON_B })
    expect(r.statut).toBe(409)
    m.avant.clear()
    expect([...m.docs.keys()].filter((k) => k.startsWith('creations/salles/'))).toHaveLength(1)
    expect(ESSAIS_ECRITURE).toBeGreaterThan(1)
  })

  it('un identifiant déjà pris se retire au sort une seconde fois', async () => {
    const m = depotMemoire()
    let tirage = 0
    // deux premiers tirages identiques, le troisième différent
    const alea = (n: number): Uint8Array => new Uint8Array(n).fill(tirage++ < 2 ? 0 : 1)
    const r1 = await traiteCreations({ methode: 'POST', query: {}, corps: { action: 'publier', salle: salle(), auteur: 'A', jeton: JETON_A, essai: { litres: 1, temps: 1 } } }, m.depot, () => QUAND, alea)
    const r2 = await traiteCreations({ methode: 'POST', query: {}, corps: { action: 'publier', salle: salle(), auteur: 'B', jeton: JETON_B, essai: { litres: 1, temps: 1 } } }, m.depot, () => QUAND, alea)
    expect(corpsDe<{ id: string }>(r1).id).toBe('aaaaaaaa')
    expect(corpsDe<{ id: string }>(r2).id).toBe('bbbbbbbb')
  })
})

describe('l’auteur retouche sa salle', () => {
  it('même contenu : ses records restent ; contenu changé : ils repartent de sa partie', async () => {
    const { depot } = depotMemoire()
    const { id, empreinte } = corpsDe<{ id: string; empreinte: string }>(await publier(depot))
    await fait(depot, 'POST', { corps: { action: 'record', id, empreinte, nom: 'AMI', litres: 70, temps: 40 } })

    const meme = corpsDe<{ empreinte: string; records: { volume: { nom: string }[] } }>(
      await publier(depot, { id, essai: { litres: 50, temps: 50 } }),
    )
    expect(meme.empreinte).toBe(empreinte)
    expect(meme.records.volume.map((l) => l.nom)).toEqual(['AMI', 'JULIAN'])

    const autre = corpsDe<{ empreinte: string; records: { volume: { nom: string; litres: number }[] } }>(
      await publier(depot, { id, salle: salle({ boxes: [] }), essai: { litres: 55, temps: 30 } }),
    )
    expect(autre.empreinte).not.toBe(empreinte)
    expect(autre.records.volume).toEqual([{ nom: 'JULIAN', litres: 55, temps: 30, quand: QUAND }])
    const liste = corpsDe<{ creations: { empreinte: string; meilleur: { litres: number } }[] }>(await fait(depot, 'GET')).creations
    expect(liste[0].empreinte).toBe(autre.empreinte)
    expect(liste[0].meilleur.litres).toBe(55)
  })

  it('un autre jeton ne retouche pas la salle', async () => {
    const { depot } = depotMemoire()
    const { id } = corpsDe<{ id: string }>(await publier(depot))
    const r = await publier(depot, { id, jeton: JETON_B, salle: salle({ name: 'Volée' }) })
    expect(r.statut).toBe(403)
  })
})

describe('les records d’une création', () => {
  it('un meilleur volume entre, met l’index à jour ; une partie moins bonne n’écrit rien', async () => {
    const m = depotMemoire()
    const { id, empreinte } = corpsDe<{ id: string; empreinte: string }>(await publier(m.depot))
    const r = corpsDe<{ ameliore: boolean }>(await fait(m.depot, 'POST', { corps: { action: 'record', id, empreinte, nom: 'AMI', litres: 80, temps: 50 } }))
    expect(r.ameliore).toBe(true)
    expect(corpsDe<{ creations: { meilleur: { nom: string } }[] }>(await fait(m.depot, 'GET')).creations[0].meilleur.nom).toBe('AMI')

    const avant = m.ecritures.length
    const pire = corpsDe<{ ameliore: boolean }>(await fait(m.depot, 'POST', { corps: { action: 'record', id, empreinte, nom: 'AMI', litres: 10, temps: 99 } }))
    expect(pire.ameliore).toBe(false)
    expect(m.ecritures.length).toBe(avant)
  })

  it(`${RECORDS_MAX} places par classement, une ligne par nom`, async () => {
    const { depot } = depotMemoire()
    const { id, empreinte } = corpsDe<{ id: string; empreinte: string }>(await publier(depot))
    for (let i = 0; i < 8; i++) {
      await fait(depot, 'POST', { corps: { action: 'record', id, empreinte, nom: `J${i}`, litres: 62 + i, temps: 40 - i } })
    }
    const recs = corpsDe<{ records: { volume: { nom: string }[]; chrono: { nom: string }[] } }>(await fait(depot, 'GET', { query: { id } })).records
    expect(recs.volume).toHaveLength(RECORDS_MAX)
    expect(recs.volume[0].nom).toBe('J7')
    expect(new Set(recs.volume.map((l) => l.nom)).size).toBe(RECORDS_MAX)
  })

  it('une partie jouée sur l’ancienne version de la salle ne compte plus', async () => {
    const { depot } = depotMemoire()
    const { id, empreinte } = corpsDe<{ id: string; empreinte: string }>(await publier(depot))
    await publier(depot, { id, salle: salle({ boxes: [] }) })
    const r = await fait(depot, 'POST', { corps: { action: 'record', id, empreinte, nom: 'AMI', litres: 99, temps: 1 } })
    expect(r.statut).toBe(409)
  })

  it('une mesure invraisemblable est refusée', async () => {
    const { depot } = depotMemoire()
    const { id, empreinte } = corpsDe<{ id: string; empreinte: string }>(await publier(depot))
    for (const [litres, temps] of [[-1, 10], [61, 0], [1e9, 10], [61, Number.NaN]]) {
      const r = await fait(depot, 'POST', { corps: { action: 'record', id, empreinte, nom: 'AMI', litres, temps } })
      expect(r.statut).toBe(400)
    }
  })
})

describe('retirer une salle', () => {
  it('seul son auteur la retire ; elle quitte la liste et ses fichiers partent', async () => {
    const m = depotMemoire()
    const { id } = corpsDe<{ id: string }>(await publier(m.depot))
    expect((await fait(m.depot, 'DELETE', { query: { id }, jeton: JETON_B })).statut).toBe(403)
    expect((await fait(m.depot, 'DELETE', { query: { id } })).statut).toBe(401)
    expect((await fait(m.depot, 'DELETE', { query: { id }, jeton: JETON_A })).statut).toBe(200)
    expect(corpsDe<{ creations: unknown[] }>(await fait(m.depot, 'GET')).creations).toEqual([])
    expect(m.docs.has(cheminSalle(id))).toBe(false)
    expect(m.docs.has(cheminRecords(id))).toBe(false)
    expect((await fait(m.depot, 'GET', { query: { id } })).statut).toBe(404)
  })
})

describe('les plafonds de la liste', () => {
  const remplis = (n: number, cle: string): EntreeIndex[] =>
    Array.from({ length: n }, (_, i) => ({ id: `id${String(i).padStart(6, '0')}`, code: 'J-X', nom: 'x', auteur: 'x', creeLe: QUAND, majLe: QUAND, empreinte: 'x', cle }))

  it(`${PAR_AUTEUR_MAX} salles par auteur, et rien n’est écrit au-delà`, async () => {
    const m = depotMemoire()
    m.pose(CHEMIN_INDEX, { format: 1, creations: remplis(PAR_AUTEUR_MAX, empreinteJeton(JETON_A).slice(0, 12)) })
    const r = await publier(m.depot)
    expect(r.statut).toBe(429)
    expect([...m.docs.keys()].some((k) => k.startsWith('creations/salles/'))).toBe(false)
    // un autre auteur publie encore
    expect((await publier(m.depot, { jeton: JETON_B })).statut).toBe(200)
  })

  it(`${CREATIONS_MAX} créations au plus dans la liste`, async () => {
    const m = depotMemoire()
    m.pose(CHEMIN_INDEX, { format: 1, creations: remplis(CREATIONS_MAX, 'autre') })
    expect((await publier(m.depot, { jeton: JETON_B })).statut).toBe(507)
  })
})

describe('les requêtes malformées', () => {
  it('répondent clairement', async () => {
    const { depot } = depotMemoire()
    expect((await fait(depot, 'POST', { corps: { action: 'effacer-tout' } })).statut).toBe(400)
    expect((await fait(depot, 'PUT')).statut).toBe(405)
    expect((await fait(depot, 'GET', { query: { id: '../index' } })).statut).toBe(400)
    expect((await fait(depot, 'DELETE', { query: { id: '../../x' }, jeton: JETON_A })).statut).toBe(400)
    expect((await fait(depot, 'GET', { query: { id: 'abcdefgh' } })).statut).toBe(404)
  })
})

// ---- le poste : la cloison réseau et le jeton ------------------------------------

describe('le poste du joueur', () => {
  // le banc tourne dans Node, sans localStorage : un stockage en mémoire
  beforeEach(() => {
    const m = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (c: string) => m.get(c) ?? null,
      setItem: (c: string, v: string) => void m.set(c, v),
      removeItem: (c: string) => void m.delete(c),
    }
  })
  afterEach(() => {
    reseau.dos = null
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('un jeton d’auteur stable, au bon format, et la liste de ses salles', async () => {
    const j = jetonAuteur()
    expect(j).toMatch(/^[0-9a-f]{48}$/)
    expect(jetonAuteur()).toBe(j)

    const m = depotMemoire()
    const vus: { url: string; init?: RequestInit }[] = []
    // la cloison réseau branchée sur le vrai magasin, en mémoire
    reseau.dos = {
      fetch: async (url, init) => {
        vus.push({ url, init })
        const u = new URL(url, 'http://local')
        const r = await traiteCreations(
          {
            methode: init?.method ?? 'GET',
            query: Object.fromEntries(u.searchParams),
            corps: init?.body ? JSON.parse(String(init.body)) : undefined,
            jeton: new Headers(init?.headers).get('x-jeton-auteur') ?? undefined,
          },
          m.depot,
        )
        return new Response(JSON.stringify(r.corps), { status: r.statut })
      },
    }
    const p = await publieCreation(salle(), 'JULIAN', { litres: 61, temps: 42.6 })
    expect(p).not.toBeNull()
    expect(mesCreations()).toEqual([p!.id])
    expect((await fetchCreations())!.map((c) => c.id)).toEqual([p!.id])
    expect((await deposeRecordCreation(p!.id, p!.empreinte, 'AMI', 70, 40))!.ameliore).toBe(true)

    // un refus du serveur se lit en clair
    expect(await publieCreation(salle({ name: '' }), 'JULIAN', { litres: 1, temps: 1 })).toBeNull()
    expect(raisonCreation()).toContain('nom')

    expect(await retireCreation(p!.id)).toBe(true)
    expect(mesCreations()).toEqual([])
    expect(new Headers(vus[vus.length - 1].init?.headers).get('x-jeton-auteur')).toBe(j)
  })
})
