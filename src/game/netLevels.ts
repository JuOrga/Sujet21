// Bibliothèque de tableaux partagée (/api/levels) : ouvrir, enregistrer,
// supprimer, réordonner. L'ordre de la liste est la séquence de l'expédition.
// Hors ligne ou en développement local, tout échoue en silence et l'éditeur
// retombe sur son brouillon local.

import { parseLevel } from './levelIO'
import type { LevelDef } from './level'

export interface StoredLevel {
  id: string
  auteur: string
  majAt: string
  level: LevelDef
}

const ENDPOINT = '/api/levels'

function readList(data: unknown): StoredLevel[] {
  if (typeof data !== 'object' || data === null) return []
  const raw = (data as { levels?: unknown }).levels
  if (!Array.isArray(raw)) return []
  const out: StoredLevel[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    const { level } = parseLevel(o.level)
    if (!level || typeof o.id !== 'string') continue
    out.push({
      id: o.id,
      auteur: typeof o.auteur === 'string' ? o.auteur : '',
      majAt: typeof o.majAt === 'string' ? o.majAt : '',
      level,
    })
  }
  return out
}

export async function fetchLibrary(): Promise<StoredLevel[] | null> {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}

async function post(body: object): Promise<{ levels: StoredLevel[]; id: string } | null> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) return null
    const data = await r.json()
    return {
      levels: readList(data),
      // l'identifiant que le serveur a retenu (créé ou confirmé) : la seule
      // source fiable — le deviner par le nom se trompe dès deux homonymes
      id: typeof (data as { id?: unknown }).id === 'string' ? (data as { id: string }).id : '',
    }
  } catch {
    return null
  }
}

/** Enregistre un tableau ; `id` vide crée une entrée nouvelle (id unique
 * forgé par le serveur — jamais d'écrasement d'homonyme). */
export function saveLevel(
  level: LevelDef,
  id: string,
  auteur: string,
): Promise<{ levels: StoredLevel[]; id: string } | null> {
  return post({ level, id, auteur })
}

/** Fixe la séquence de l'expédition, du premier au dernier. */
export async function reorderLibrary(order: string[]): Promise<StoredLevel[] | null> {
  const r = await post({ order })
  return r?.levels ?? null
}

export async function deleteLevel(id: string): Promise<StoredLevel[] | null> {
  try {
    const r = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}
