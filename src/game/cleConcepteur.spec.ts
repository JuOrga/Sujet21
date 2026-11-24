// LA CLÉ CONCEPTEUR, de bout en bout : la règle du serveur (api/_cle.ts),
// le garde posé sur CHAQUE endpoint qui change ce que tout le monde joue,
// la cloison réseau qui porte la clé, et son rangement sur le poste.
//
// Avant elle, un POST ou un DELETE anonyme réécrivait la bibliothèque, la
// carte, le récit — depuis n'importe quel navigateur. Le bloc « les
// endpoints » est le test qui tombe sans le garde.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLE_LONGUEUR_MIN,
  ENTETE_CLE,
  avisDeJoueur,
  exigeConcepteur,
  lisCles,
  verdictConcepteur,
} from '../../api/_cle'
import { ENTETE_CLE as ENTETE_CLIENT, appelle, reseau } from './reseau'
import { chargeCle, rangeCle, verifieCle } from './cleConcepteur'

const CLE_A = 'a'.repeat(CLE_LONGUEUR_MIN) + '-julian'
const CLE_B = 'b'.repeat(CLE_LONGUEUR_MIN) + '-ami'
const CLES = `julian:${CLE_A}, ami:${CLE_B}`

describe('la règle du serveur', () => {
  it('lit une clé par personne, nommée, sous tous les séparateurs', () => {
    expect(lisCles(`julian:${CLE_A};ami:${CLE_B}\nsolo:${'c'.repeat(20)}`).map((c) => c.nom)).toEqual([
      'julian',
      'ami',
      'solo',
    ])
    // une clé sans nom s'appelle « concepteur »
    expect(lisCles(CLE_A).map((c) => c.nom)).toEqual(['concepteur'])
  })

  it('ignore une clé trop courte — elle se devinerait', () => {
    expect(lisCles('julian:courte')).toEqual([])
    expect(lisCles(undefined)).toEqual([])
    expect(lisCles('')).toEqual([])
  })

  it('ne garde que des empreintes, jamais la clé en clair', () => {
    const [c] = lisCles(`julian:${CLE_A}`)
    expect(new TextDecoder().decode(c.empreinte)).not.toContain(CLE_A)
    expect(c.empreinte.length).toBe(32)
  })

  it('une LECTURE passe toujours, sans clé', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS', 'get', undefined]) {
      expect(verdictConcepteur(m, '', CLES)).toEqual({ ok: true, nom: '' })
      // même sur un serveur sans clé configurée : le jeu doit pouvoir lire
      expect(verdictConcepteur(m, '', undefined).ok).toBe(true)
    }
  })

  it('une ÉCRITURE sans clé configurée est REFUSÉE (503) — une variable oubliée ne rouvre pas la porte', () => {
    for (const m of ['POST', 'DELETE', 'PUT', 'PATCH']) {
      const v = verdictConcepteur(m, CLE_A, undefined)
      expect(v.ok).toBe(false)
      if (!v.ok) {
        expect(v.statut).toBe(503)
        expect(v.erreur).toContain('CLES_CONCEPTEUR')
      }
    }
  })

  it('une écriture sans clé, ou avec une mauvaise, est refusée (401)', () => {
    const sans = verdictConcepteur('POST', '', CLES)
    expect(sans).toMatchObject({ ok: false, statut: 401 })
    const fausse = verdictConcepteur('DELETE', CLE_A + 'x', CLES)
    expect(fausse).toMatchObject({ ok: false, statut: 401, erreur: 'clé concepteur refusée' })
  })

  it('chaque clé valide passe, et dit QUI écrit', () => {
    expect(verdictConcepteur('POST', CLE_A, CLES)).toEqual({ ok: true, nom: 'julian' })
    expect(verdictConcepteur('DELETE', CLE_B, CLES)).toEqual({ ok: true, nom: 'ami' })
  })

  it('l’avis d’un joueur se dépose sans clé — pas son effacement', () => {
    expect(avisDeJoueur('POST', 'ecoute')).toBe(true)
    expect(avisDeJoueur('POST', 'avis-salles')).toBe(true)
    expect(avisDeJoueur('DELETE', 'avis-salles')).toBe(false)
    expect(avisDeJoueur('POST', 'carte')).toBe(false)
    expect(avisDeJoueur('POST', undefined)).toBe(false)
  })

  it('le garde répond lui-même quand il refuse, et laisse passer sinon', () => {
    const rendus: { statut: number; corps: unknown }[] = []
    const res = {
      status: (statut: number) => ({ json: (corps: unknown) => rendus.push({ statut, corps }) }),
    }
    expect(exigeConcepteur({ method: 'POST', headers: {} }, res, CLES)).toBe(false)
    expect(rendus).toHaveLength(1)
    expect(rendus[0].statut).toBe(401)
    expect(exigeConcepteur({ method: 'POST', headers: { [ENTETE_CLE]: CLE_B } }, res, CLES)).toBe(true)
    // un en-tête répété : le premier compte
    expect(exigeConcepteur({ method: 'POST', headers: { [ENTETE_CLE]: [CLE_A, 'autre'] } }, res, CLES)).toBe(true)
    expect(rendus).toHaveLength(1)
  })

  it('le client et le serveur parlent du même en-tête', () => {
    expect(ENTETE_CLIENT).toBe(ENTETE_CLE)
  })
})

// ---- LES ENDPOINTS : le test qui tombe sans le garde ----------------------

interface Rendu {
  statut: number
  corps: unknown
}
function reponseFactice(): { res: never; rendus: Rendu[] } {
  const rendus: Rendu[] = []
  const res = {
    setHeader: () => res,
    status: (statut: number) => ({
      json: (corps: unknown) => {
        rendus.push({ statut, corps })
      },
    }),
  }
  return { res: res as never, rendus }
}

type Handler = (req: never, res: never) => Promise<void>
const ENDPOINTS_CONCEPTEUR: [string, () => Promise<{ default: Handler }>, Record<string, unknown>][] = [
  ['levels', () => import('../../api/levels'), { level: { name: 'x' } }],
  ['presets', () => import('../../api/presets'), { title: 'x', params: {} }],
  ['cinematiques', () => import('../../api/cinematiques'), {}],
  ['codex', () => import('../../api/codex'), {}],
  ['fiches', () => import('../../api/fiches'), {}],
  ['images', () => import('../../api/images'), {}],
  ['journal', () => import('../../api/journal'), {}],
  ['regles', () => import('../../api/regles'), { type: 'note', id: 'x', note: 'y' }],
  ['reglages', () => import('../../api/reglages'), { domaine: 'carte', document: {} }],
]

describe('les endpoints qui changent ce que tout le monde joue', () => {
  let avant: string | undefined
  beforeEach(() => {
    avant = process.env.CLES_CONCEPTEUR
    process.env.CLES_CONCEPTEUR = CLES
  })
  afterEach(() => {
    if (avant === undefined) delete process.env.CLES_CONCEPTEUR
    else process.env.CLES_CONCEPTEUR = avant
  })

  for (const [nom, charge, corps] of ENDPOINTS_CONCEPTEUR) {
    for (const method of ['POST', 'DELETE']) {
      it(`${nom} : un ${method} anonyme est refusé AVANT de toucher au magasin`, async () => {
        const { default: handler } = await charge()
        const { res, rendus } = reponseFactice()
        await handler({ method, headers: {}, query: { id: 'x', title: 'x', domaine: 'carte' }, body: corps } as never, res)
        expect(rendus).toHaveLength(1)
        expect(rendus[0].statut).toBe(401)
      })
    }
    it(`${nom} : sans aucune clé sur le serveur, l'écriture reste fermée (503)`, async () => {
      delete process.env.CLES_CONCEPTEUR
      const { default: handler } = await charge()
      const { res, rendus } = reponseFactice()
      await handler({ method: 'POST', headers: {}, query: {}, body: corps } as never, res)
      expect(rendus[0]?.statut).toBe(503)
    })
  }

  it('reglages : l’avis d’un joueur passe le garde sans clé (il atteint le magasin)', async () => {
    const { default: handler } = await import('../../api/reglages')
    const { res, rendus } = reponseFactice()
    await handler(
      { method: 'POST', headers: {}, query: {}, body: { domaine: 'avis-salles', document: {} } } as never,
      res,
    )
    // sans jeton Blob au banc, le magasin échoue (500) : l'important est
    // que la réponse ne vienne PAS du garde
    expect(rendus[0]?.statut).not.toBe(401)
    expect(rendus[0]?.statut).not.toBe(503)
  })

  it('reglages ?verifie=cle : reconnaît la clé et dit à qui elle est, sans rien écrire', async () => {
    const { default: handler } = await import('../../api/reglages')
    const bon = reponseFactice()
    await handler({ method: 'GET', headers: { [ENTETE_CLE]: CLE_B }, query: { verifie: 'cle' } } as never, bon.res)
    expect(bon.rendus).toEqual([{ statut: 200, corps: { ok: true, nom: 'ami' } }])
    const mauvais = reponseFactice()
    await handler({ method: 'GET', headers: { [ENTETE_CLE]: 'nimporte-quoi-de-long' }, query: { verifie: 'cle' } } as never, mauvais.res)
    expect(mauvais.rendus[0].statut).toBe(401)
  })
})

// ---- LE POSTE : la cloison réseau et le rangement -------------------------

function dosFactice(reponse: () => Response = () => new Response('{"ok":true}', { status: 200 })): {
  vus: { url: string; init?: RequestInit }[]
} {
  const vus: { url: string; init?: RequestInit }[] = []
  reseau.dos = {
    fetch: (url, init) => {
      vus.push({ url, init })
      return Promise.resolve(reponse())
    },
  }
  return { vus }
}

function stockageFactice(): { getItem(c: string): string | null; setItem(c: string, v: string): void; removeItem(c: string): void; m: Map<string, string> } {
  const m = new Map<string, string>()
  return {
    m,
    getItem: (c) => m.get(c) ?? null,
    setItem: (c, v) => void m.set(c, v),
    removeItem: (c) => void m.delete(c),
  }
}

describe('le poste du concepteur', () => {
  afterEach(() => {
    reseau.dos = null
    reseau.cle = ''
  })

  it('la clé accompagne chaque écriture, en gardant les en-têtes de l’appelant', async () => {
    const { vus } = dosFactice()
    reseau.cle = CLE_A
    await appelle('/api/levels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    await appelle('/api/levels?id=x', { method: 'DELETE' })
    for (const v of vus) {
      const h = new Headers(v.init?.headers)
      expect(h.get(ENTETE_CLE)).toBe(CLE_A)
    }
    expect(new Headers(vus[0].init?.headers).get('Content-Type')).toBe('application/json')
    expect(vus[0].init?.body).toBe('{}')
  })

  it('une lecture ne porte jamais la clé', async () => {
    const { vus } = dosFactice()
    reseau.cle = CLE_A
    await appelle('/api/levels', { cache: 'no-store' })
    await appelle('/api/levels')
    for (const v of vus) expect(new Headers(v.init?.headers).get(ENTETE_CLE)).toBeNull()
  })

  it('sans clé, l’appel part tel quel', async () => {
    const { vus } = dosFactice()
    const init = { method: 'POST', body: '{}' }
    await appelle('/api/records', init)
    expect(vus[0].init).toBe(init)
  })

  it('se range sur le poste, se recharge au démarrage, s’oublie', () => {
    const s = stockageFactice()
    rangeCle(`  ${CLE_A}  `, s)
    expect(reseau.cle).toBe(CLE_A)
    reseau.cle = ''
    expect(chargeCle(s)).toBe(CLE_A)
    expect(reseau.cle).toBe(CLE_A)
    rangeCle('', s)
    expect(reseau.cle).toBe('')
    expect(s.m.size).toBe(0)
  })

  it('un stockage refusé ne casse rien : la clé vaut pour la session', () => {
    const hostile = {
      getItem: () => {
        throw new Error('refusé')
      },
      setItem: () => {
        throw new Error('refusé')
      },
      removeItem: () => {
        throw new Error('refusé')
      },
    }
    rangeCle(CLE_A, hostile)
    expect(reseau.cle).toBe(CLE_A)
    expect(chargeCle(hostile)).toBe('')
  })

  it('la vérification traduit la réponse du serveur', async () => {
    expect(await verifieCle()).toEqual({ etat: 'absente' })
    reseau.cle = CLE_A
    const cas: [Response, string][] = [
      [new Response('{"ok":true,"nom":"julian"}', { status: 200 }), 'reconnue'],
      [new Response('{"error":"clé concepteur refusée"}', { status: 401 }), 'refusee'],
      [new Response('{"error":"écritures verrouillées"}', { status: 503 }), 'serveur-sans-cle'],
      [new Response('oups', { status: 500 }), 'injoignable'],
      // sans API derrière, la page d'accueil répond 200 : ce n'est pas un oui
      [new Response('<!doctype html><html></html>', { status: 200 }), 'injoignable'],
    ]
    for (const [rep, etat] of cas) {
      const { vus } = dosFactice(() => rep)
      expect((await verifieCle()).etat).toBe(etat)
      // la vérification est une lecture : la clé y est jointe à la main
      expect(new Headers(vus[0].init?.headers).get(ENTETE_CLE)).toBe(CLE_A)
      expect(vus[0].url).toBe('/api/reglages?verifie=cle')
    }
  })
})
