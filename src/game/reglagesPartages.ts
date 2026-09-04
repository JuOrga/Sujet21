// LE MAGASIN DES RÉGLAGES PARTAGÉS (/api/reglages), côté jeu : un document
// JSON par domaine, publié par le concepteur pour tous. Ce module ne
// connaît pas la forme des documents — chaque domaine la relit et la
// ramène dans ses bornes (planPartage.ts pour le plan de la descente). Tout
// échec réseau rend null : l'appelant garde ce qu'il a.

export type DomaineReglage = 'plan-voie' | 'carte' | 'recompenses' | 'textes' | 'sequences'

export interface ReglagePublie {
  document: unknown
  auteur: string
  date: string
}

const ENDPOINT = '/api/reglages'

function litPublie(data: unknown): ReglagePublie {
  const p = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return {
    document: typeof p.document === 'object' ? p.document : null,
    auteur: typeof p.auteur === 'string' ? p.auteur : '',
    date: typeof p.date === 'string' ? p.date : '',
  }
}

/** Le document publié d'un domaine — document null : rien de publié ;
 *  résultat null : pas de réseau. */
export async function fetchReglage(domaine: DomaineReglage): Promise<ReglagePublie | null> {
  try {
    const r = await fetch(`${ENDPOINT}?domaine=${encodeURIComponent(domaine)}`, { cache: 'no-store' })
    if (!r.ok) return null
    return litPublie(await r.json())
  } catch {
    return null
  }
}

export async function pushReglage(
  domaine: DomaineReglage,
  document: unknown,
  auteur: string,
): Promise<ReglagePublie | null> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domaine, document, auteur }),
    })
    if (!r.ok) return null
    return litPublie(await r.json())
  } catch {
    return null
  }
}

/** Retire le document publié : le livré reprend, pour tout le monde. */
export async function deleteReglage(domaine: DomaineReglage): Promise<boolean> {
  try {
    const r = await fetch(`${ENDPOINT}?domaine=${encodeURIComponent(domaine)}`, { method: 'DELETE' })
    return r.ok
  } catch {
    return false
  }
}
