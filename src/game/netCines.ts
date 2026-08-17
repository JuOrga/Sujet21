// Bibliothèque de cinématiques partagée (/api/cinematiques) : lire tout,
// partager la sienne, retirer. Hors ligne ou en local, tout échoue en
// silence — la table de montage retombe sur les livrées et le poste.

import { parseCinematique, type CinematiqueDef } from './cinematique'

export interface SharedCine {
  cine: CinematiqueDef
  auteur: string
  majAt: string
}

const ENDPOINT = '/api/cinematiques'

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
