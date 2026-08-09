// Registres partagés entre testeurs : le tableau d'honneur du protocole.
// Un seul document JSON dans Vercel Blob, comme les présets — dernier
// écrivain gagnant, suffisant pour une poignée d'opérateurs. L'endpoint est
// ouvert (prototype semi-privé) : les records ne contiennent qu'un nom
// d'opérateur, des litres et des secondes.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del, list, put } from '@vercel/blob'

// Chaque écriture crée un blob à URL unique (suffixe aléatoire) et supprime
// les versions précédentes : écraser au même chemin garderait la même URL,
// que le CDN continuerait de servir en cache pendant au moins une minute.
const PREFIX = 'records/'

interface SharedTableauRecord {
  liters: number
  time: number
  name: string
}

interface SharedExpeditionRecord {
  tableaux: number
  liters: number
  time: number
  name: string
}

interface Board {
  tableaux: Record<string, SharedTableauRecord>
  expedition: SharedExpeditionRecord | null
}

function cleanName(v: unknown): string {
  return typeof v === 'string' ? v.trim().toUpperCase().slice(0, 12) : ''
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

// Même règle que les registres locaux : le volume d'abord, le temps départage.
function beatsTableau(entry: SharedTableauRecord, prev: SharedTableauRecord | undefined): boolean {
  if (!prev) return true
  return entry.liters > prev.liters || (entry.liters === prev.liters && entry.time < prev.time)
}

// La meilleure expédition : la distance, puis la réserve, puis le temps.
function beatsExpedition(
  entry: SharedExpeditionRecord,
  prev: SharedExpeditionRecord | null,
): boolean {
  if (!prev) return true
  return (
    entry.tableaux > prev.tableaux ||
    (entry.tableaux === prev.tableaux &&
      (entry.liters > prev.liters || (entry.liters === prev.liters && entry.time < prev.time)))
  )
}

async function readBoard(): Promise<Board> {
  const empty: Board = { tableaux: {}, expedition: null }
  const { blobs } = await list({ prefix: PREFIX })
  if (blobs.length === 0) return empty
  const latest = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )[0]
  const r = await fetch(latest.url, { cache: 'no-store' })
  if (!r.ok) return empty
  const data = (await r.json().catch(() => null)) as Board | null
  if (data === null || typeof data !== 'object' || typeof data.tableaux !== 'object') return empty
  return { tableaux: data.tableaux ?? {}, expedition: data.expedition ?? null }
}

async function writeBoard(board: Board): Promise<void> {
  const { blobs } = await list({ prefix: PREFIX })
  await put(`${PREFIX}v.json`, JSON.stringify(board), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  })
  if (blobs.length > 0) {
    await del(blobs.map((b) => b.url)).catch(() => {})
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readBoard())
      return
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      const name = cleanName(body.name)
      const liters = num(body.liters)
      const time = num(body.time)
      if (!name || liters === null || time === null) {
        res.status(400).json({ error: 'record invalide : nom, litres et temps requis' })
        return
      }
      const board = await readBoard()
      let improved = false
      if (body.kind === 'tableau' && typeof body.code === 'string' && body.code.trim()) {
        const code = body.code.trim().slice(0, 16)
        const entry: SharedTableauRecord = {
          liters: Math.round(liters * 100) / 100,
          time: Math.round(time * 10) / 10,
          name,
        }
        if (beatsTableau(entry, board.tableaux[code])) {
          board.tableaux[code] = entry
          improved = true
        }
      } else if (body.kind === 'expedition') {
        const tableaux = num(body.tableaux)
        if (tableaux === null) {
          res.status(400).json({ error: 'record invalide : nombre de tableaux requis' })
          return
        }
        const entry: SharedExpeditionRecord = {
          tableaux: Math.floor(tableaux),
          liters: Math.round(liters * 100) / 100,
          time: Math.round(time * 10) / 10,
          name,
        }
        if (beatsExpedition(entry, board.expedition)) {
          board.expedition = entry
          improved = true
        }
      } else {
        res.status(400).json({ error: 'record invalide : kind tableau ou expedition requis' })
        return
      }
      if (improved) await writeBoard(board)
      res.status(200).json({ ok: true, improved, board })
      return
    }
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch {
    res.status(500).json({ error: 'stockage indisponible' })
  }
}
