// Bibliothèque de tableaux partagée entre concepteurs. Un document JSON dans
// Vercel Blob, comme les présets et les registres : chacun ouvre, modifie,
// enregistre, et l'ORDRE de la liste est la séquence de l'expédition.
//
// L'endpoint est ouvert (prototype semi-privé) et le dernier écrivain gagne —
// suffisant pour deux personnes qui se parlent.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del, list, put } from '@vercel/blob'

const PREFIX = 'levels/'
const MAX_LEVELS = 60

interface StoredLevel {
  id: string
  auteur: string
  majAt: string
  level: Record<string, unknown> // LevelDef sérialisé, validé côté client
}

interface Library {
  levels: StoredLevel[] // l'ordre du tableau EST la séquence de jeu
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'tableau'
  )
}

async function readLib(): Promise<Library> {
  const { blobs } = await list({ prefix: PREFIX })
  if (blobs.length === 0) return { levels: [] }
  const latest = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )[0]
  const r = await fetch(latest.url, { cache: 'no-store' })
  if (!r.ok) return { levels: [] }
  const data = (await r.json().catch(() => null)) as Library | null
  if (!data || !Array.isArray(data.levels)) return { levels: [] }
  return { levels: data.levels.filter((l) => l && typeof l.id === 'string' && l.level) }
}

async function writeLib(lib: Library): Promise<void> {
  const { blobs } = await list({ prefix: PREFIX })
  await put(`${PREFIX}v.json`, JSON.stringify(lib), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  })
  if (blobs.length > 0) await del(blobs.map((b) => b.url)).catch(() => {})
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readLib())
      return
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>

      // Réordonner : la séquence de l'expédition, du premier au dernier
      if (Array.isArray(body.order)) {
        const order = (body.order as unknown[]).filter((x) => typeof x === 'string') as string[]
        const lib = await readLib()
        const byId = new Map(lib.levels.map((l) => [l.id, l]))
        const next: StoredLevel[] = []
        for (const id of order) {
          const l = byId.get(id)
          if (l) {
            next.push(l)
            byId.delete(id)
          }
        }
        // ce que l'appelant n'a pas cité reste, à la fin : rien ne disparaît
        for (const l of byId.values()) next.push(l)
        await writeLib({ levels: next })
        res.status(200).json({ ok: true, levels: next })
        return
      }

      // Enregistrer (création ou mise à jour)
      const level = body.level
      if (typeof level !== 'object' || level === null) {
        res.status(400).json({ error: 'tableau manquant' })
        return
      }
      const name = typeof (level as Record<string, unknown>).name === 'string'
        ? ((level as Record<string, unknown>).name as string)
        : 'tableau'
      const auteur =
        typeof body.auteur === 'string' ? body.auteur.trim().toUpperCase().slice(0, 12) : ''

      const lib = await readLib()
      let id = typeof body.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : ''
      if (!id) {
        // CRÉATION (« Enregistrer sous ») : jamais écraser un homonyme — si
        // le slug du nom est déjà pris (même tableau rebaptisé pareil, ou
        // deux tableaux au même nom), on suffixe jusqu'à un id libre
        const base = slug(name)
        let candidat = base
        let n = 2
        while (lib.levels.some((l) => l.id === candidat)) candidat = `${base}-${n++}`.slice(0, 64)
        id = candidat
      }
      const entry: StoredLevel = {
        id,
        auteur,
        majAt: new Date().toISOString(),
        level: level as Record<string, unknown>,
      }
      const at = lib.levels.findIndex((l) => l.id === id)
      if (at >= 0) lib.levels[at] = entry
      else lib.levels.push(entry)
      if (lib.levels.length > MAX_LEVELS) {
        res.status(400).json({ error: `bibliothèque pleine (${MAX_LEVELS} tableaux)` })
        return
      }
      await writeLib(lib)
      res.status(200).json({ ok: true, id, levels: lib.levels })
      return
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id ?? '')
      if (!id) {
        res.status(400).json({ error: 'identifiant manquant' })
        return
      }
      const lib = await readLib()
      lib.levels = lib.levels.filter((l) => l.id !== id)
      await writeLib(lib)
      res.status(200).json({ ok: true, levels: lib.levels })
      return
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch {
    res.status(500).json({ error: 'stockage indisponible' })
  }
}
