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
  // Palmarès (écran RECORDS) : top 10 par tableau, par catégorie. La NOTE
  // combine volume et temps : cL × 60 / (60 + s) — le volume domine, le
  // temps module ; imbattable en bâclant l'un des deux.
  tops?: Record<string, { volume: TopEntry[]; chrono: TopEntry[]; note: TopEntry[] }>
}

interface TopEntry {
  liters: number
  time: number
  name: string
  note: number
  quand: string
}

const TOP_N = 10

function noteDe(liters: number, time: number): number {
  return Math.round((liters * 100 * 60) / (60 + Math.max(0, time)))
}

// Insère dans un top trié ; garde TOP_N ; une seule entrée par opérateur
// (la meilleure) pour que le palmarès respire au lieu d'être monopolisé.
function insere(top: TopEntry[], e: TopEntry, cle: (x: TopEntry) => number, desc: boolean): TopEntry[] {
  const sans = top.filter((x) => x.name !== e.name)
  const mien = top.find((x) => x.name === e.name)
  const garde = mien && (desc ? cle(mien) >= cle(e) : cle(mien) <= cle(e)) ? mien : e
  sans.push(garde)
  sans.sort((a, b) => (desc ? cle(b) - cle(a) : cle(a) - cle(b)))
  return sans.slice(0, TOP_N)
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

// Même durcissement que la bibliothèque : un ÉCHEC de lecture n'est pas un
// tableau d'honneur vide — on LÈVE (l'écriture avorte en 500) au lieu de
// repartir de zéro et d'écraser les records de tout le monde.
async function readBoard(): Promise<Board> {
  const { blobs } = await list({ prefix: PREFIX })
  if (blobs.length === 0) return { tableaux: {}, expedition: null }
  const parDate = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )
  // REPLI : même logique que la bibliothèque — un blob listé mais illisible
  // (403/404, corruption) ne condamne pas la lecture, on remonte l'historique
  let derniere = 'aucun blob lisible'
  for (const b of parDate) {
    try {
      const r = await fetch(b.url, { cache: 'no-store' })
      if (!r.ok) {
        derniere = `lecture registres : HTTP ${r.status} (${b.pathname})`
        continue
      }
      const data = (await r.json()) as Board
      if (data === null || typeof data !== 'object' || typeof data.tableaux !== 'object') {
        derniere = `registres illisibles (${b.pathname})`
        continue
      }
      return { tableaux: data.tableaux ?? {}, expedition: data.expedition ?? null, tops: data.tops ?? {} }
    } catch (e) {
      derniere = String(e)
    }
  }
  throw new Error(derniere)
}

async function writeBoard(board: Board): Promise<void> {
  await put(`${PREFIX}v.json`, JSON.stringify(board), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  })
  // historique de secours : les 4 versions les plus récentes restent
  const { blobs } = await list({ prefix: PREFIX })
  const parDate = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )
  const perimes = parDate.slice(4)
  if (perimes.length > 0) await del(perimes.map((b) => b.url)).catch(() => {})
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
      // le palmarès peut changer SANS que le record simple soit battu : la
      // persistance doit suivre l'un COMME l'autre (sinon le POST renvoie un
      // board à jour — l'accueil l'affiche — mais le GET suivant relit un
      // blob jamais écrit, et l'écran RECORDS ignore la collecte)
      let persister = false
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
        // le palmarès s'alimente à CHAQUE collecte : les tops volume,
        // chrono et note vivent indépendamment du record single
        board.tops ??= {}
        const t = (board.tops[code] ??= { volume: [], chrono: [], note: [] })
        const avantTops = JSON.stringify(t)
        const te: TopEntry = { ...entry, note: noteDe(entry.liters, entry.time), quand: new Date().toISOString() }
        t.volume = insere(t.volume, te, (x) => x.liters * 1e6 - x.time, true)
        t.chrono = insere(t.chrono, te, (x) => x.time, false)
        t.note = insere(t.note, te, (x) => x.note, true)
        if (JSON.stringify(t) !== avantTops) persister = true
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
      if (improved || persister) await writeBoard(board)
      res.status(200).json({ ok: true, improved, board })
      return
    }
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch (e) {
    // le DÉTAIL est précieux : c'est lui qui distingue « blob illisible »
    // de « jeton manquant » — des chiffres de machine, rien de personnel
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
