// Bibliothèque de présets partagée entre testeurs. Un seul document JSON
// dans Vercel Blob ; dernier écrivain gagnant — suffisant pour une poignée
// de testeurs. L'endpoint est ouvert (pas d'authentification) : le site est
// un prototype semi-privé, les présets ne contiennent que des réglages.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del, list, put } from '@vercel/blob'

// Chaque écriture crée un blob à URL unique (suffixe aléatoire) et supprime
// les versions précédentes : écraser un blob au même chemin garderait la même
// URL, que le CDN continuerait de servir en cache pendant au moins une minute.
const PREFIX = 'presets/'
const MAX_PRESETS = 200

interface SharedPreset {
  title: string
  description: string
  savedAt: string
  params: Record<string, number>
}

function sanitize(input: unknown): SharedPreset | null {
  if (typeof input !== 'object' || input === null) return null
  const p = input as Record<string, unknown>
  if (typeof p.title !== 'string' || !p.title.trim()) return null
  if (typeof p.params !== 'object' || p.params === null) return null
  const params: Record<string, number> = {}
  for (const [k, v] of Object.entries(p.params as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) params[k.slice(0, 64)] = v
  }
  return {
    title: p.title.trim().slice(0, 80),
    description: typeof p.description === 'string' ? p.description.slice(0, 500) : '',
    savedAt: new Date().toISOString(),
    params,
  }
}

interface Library {
  presets: SharedPreset[]
  defaultTitle: string | null // préset appliqué au lancement, pour tous
}

// Accepte le document courant { presets, defaultTitle } et, pour
// compatibilité, l'ancien format « tableau de présets ».
async function readAll(): Promise<Library> {
  const empty: Library = { presets: [], defaultTitle: null }
  const { blobs } = await list({ prefix: PREFIX })
  if (blobs.length === 0) return empty
  const latest = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )[0]
  const r = await fetch(latest.url, { cache: 'no-store' })
  if (!r.ok) return empty
  const data = (await r.json().catch(() => null)) as unknown
  if (Array.isArray(data)) {
    return { presets: data.filter((p) => sanitize(p) !== null) as SharedPreset[], defaultTitle: null }
  }
  if (data !== null && typeof data === 'object' && Array.isArray((data as Library).presets)) {
    const lib = data as { presets: unknown[]; defaultTitle?: unknown }
    return {
      presets: lib.presets.filter((p) => sanitize(p) !== null) as SharedPreset[],
      defaultTitle:
        typeof lib.defaultTitle === 'string' && lib.defaultTitle ? lib.defaultTitle : null,
    }
  }
  return empty
}

async function writeAll(library: Library): Promise<void> {
  const { blobs } = await list({ prefix: PREFIX })
  await put(`${PREFIX}v.json`, JSON.stringify(library), {
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
      res.status(200).json(await readAll())
      return
    }
    if (req.method === 'POST') {
      const body = req.body as Record<string, unknown> | null
      // Deux actions : définir le préset par défaut (body { defaultTitle }),
      // ou publier un préset (body préset complet avec params).
      if (body !== null && typeof body === 'object' && 'defaultTitle' in body && !('params' in body)) {
        const dt = body.defaultTitle
        const lib = await readAll()
        if (dt === null || dt === '') {
          lib.defaultTitle = null
        } else if (typeof dt === 'string' && lib.presets.some((q) => q.title === dt)) {
          lib.defaultTitle = dt
        } else {
          res.status(400).json({ error: 'préset par défaut inconnu' })
          return
        }
        await writeAll(lib)
        res.status(200).json({ ok: true })
        return
      }
      const preset = sanitize(body)
      if (!preset) {
        res.status(400).json({ error: 'préset invalide : il faut un titre et des paramètres' })
        return
      }
      const lib = await readAll()
      lib.presets = lib.presets.filter((q) => q.title !== preset.title)
      lib.presets.push(preset)
      lib.presets.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      lib.presets = lib.presets.slice(0, MAX_PRESETS)
      await writeAll(lib)
      res.status(200).json({ ok: true })
      return
    }
    if (req.method === 'DELETE') {
      const title = String(req.query.title ?? '')
      if (!title) {
        res.status(400).json({ error: 'titre manquant' })
        return
      }
      const lib = await readAll()
      lib.presets = lib.presets.filter((q) => q.title !== title)
      if (lib.defaultTitle === title) lib.defaultTitle = null // le défaut suit le préset
      await writeAll(lib)
      res.status(200).json({ ok: true })
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch {
    res.status(500).json({ error: 'stockage indisponible' })
  }
}
