// Bibliothèque de cinématiques partagée (/api/cinematiques) : lire tout,
// partager la sienne, retirer. Hors ligne ou en local, tout échoue en
// silence — la table de montage retombe sur les livrées et le poste.

import { parseCinematique, type CinematiqueDef } from './cinematique'
import { parseScenario, type ScenarioDef } from './scenario'

export interface SharedCine {
  cine: CinematiqueDef
  auteur: string
  majAt: string
}

const ENDPOINT = '/api/cinematiques'

/** Le scénario publié (il n'y en a qu'un), s'il existe. */
function readScenario(data: unknown): ScenarioDef | null {
  if (typeof data !== 'object' || data === null) return null
  return parseScenario((data as { scenario?: unknown }).scenario)
}

function readList(data: unknown): SharedCine[] {
  if (typeof data !== 'object' || data === null) return []
  const raw = (data as { cines?: unknown }).cines
  if (!Array.isArray(raw)) return []
  const out: SharedCine[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    const r = parseCinematique(o)
    if (!r) continue
    out.push({
      cine: r.cine,
      auteur: typeof o.auteur === 'string' ? o.auteur : '',
      majAt: typeof o.majAt === 'string' ? o.majAt : '',
    })
  }
  return out
}

export async function fetchCines(): Promise<SharedCine[] | null> {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}

/** Les cinématiques ET le scénario en une seule requête — ce que le jeu
 *  charge au démarrage. */
export async function fetchBibliotheque(): Promise<{
  cines: SharedCine[]
  scenario: ScenarioDef | null
} | null> {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    const data = await r.json()
    return { cines: readList(data), scenario: readScenario(data) }
  } catch {
    return null
  }
}

/** Publie LE scénario (il n'y en a qu'un : il remplace le précédent). */
export async function pushScenario(
  scenario: ScenarioDef,
  auteur: string,
): Promise<ScenarioDef | null> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, auteur }),
    })
    if (!r.ok) return null
    return readScenario(await r.json())
  } catch {
    return null
  }
}

/** Publie (ou remplace, même code) une cinématique dans la bibliothèque. */
export async function pushCine(cine: CinematiqueDef, auteur: string): Promise<SharedCine[] | null> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cine, auteur }),
    })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}

export async function deleteCine(code: string): Promise<SharedCine[] | null> {
  try {
    const r = await fetch(`${ENDPOINT}?code=${encodeURIComponent(code)}`, { method: 'DELETE' })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}
