// Le tableau d'honneur partagé (§10) : les records de tous les opérateurs,
// servis par /api/records (Vercel Blob). Tout est optionnel et silencieux —
// hors ligne ou en développement local, le jeu retombe sur les registres
// locaux sans une erreur en console.

export interface SharedTableauRecord {
  liters: number
  time: number
  name: string
}

export interface SharedExpeditionRecord {
  tableaux: number
  liters: number
  time: number
  name: string
}

export interface SharedBoard {
  tableaux: Record<string, SharedTableauRecord>
  expedition: SharedExpeditionRecord | null
}

const ENDPOINT = '/api/records'

export async function fetchSharedBoard(): Promise<SharedBoard | null> {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    const data = (await r.json()) as SharedBoard
    if (typeof data !== 'object' || data === null || typeof data.tableaux !== 'object') return null
    return { tableaux: data.tableaux ?? {}, expedition: data.expedition ?? null }
  } catch {
    return null
  }
}

// Publication d'un record : le serveur applique la même règle « meilleur
// gagne » que les registres locaux et renvoie le tableau d'honneur à jour.
async function push(body: object): Promise<SharedBoard | null> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) return null
    const data = (await r.json()) as { board?: SharedBoard }
    return data.board ?? null
  } catch {
    return null
  }
}

export function pushTableauRecord(
  code: string,
  liters: number,
  time: number,
  name: string,
): Promise<SharedBoard | null> {
  return push({ kind: 'tableau', code, liters, time, name })
}

export function pushExpeditionRecord(
  tableaux: number,
  liters: number,
  time: number,
  name: string,
): Promise<SharedBoard | null> {
  return push({ kind: 'expedition', tableaux, liters, time, name })
}
