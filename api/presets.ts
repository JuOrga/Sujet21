// Bibliothèque de présets partagée entre testeurs. Un seul document JSON
// dans Vercel Blob ; dernier écrivain gagnant — suffisant pour une poignée
// de testeurs. L'endpoint est ouvert (pas d'authentification) : le site est
// un prototype semi-privé, les présets ne contiennent que des réglages.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list, put } from '@vercel/blob'

const KEY = 'presets.json'
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

async function readAll(): Promise<SharedPreset[]> {
  const { blobs } = await list({ prefix: KEY })
  const blob = blobs.find((b) => b.pathname === KEY)
  if (!blob) return []
  // cache-busting : l'URL du blob est servie par un CDN qui garde ~1 min
  const r = await fetch(`${blob.url}?v=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) return []
  const data = (await r.json().catch(() => [])) as unknown
  return Array.isArray(data) ? (data.filter((p) => sanitize(p) !== null) as SharedPreset[]) : []
}

async function writeAll(presets: SharedPreset[]): Promise<void> {
  await put(KEY, JSON.stringify(presets), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readAll())
      return
    }
    if (req.method === 'POST') {
      const preset = sanitize(req.body)
      if (!preset) {
        res.status(400).json({ error: 'préset invalide : il faut un titre et des paramètres' })
        return
      }
      const all = (await readAll()).filter((q) => q.title !== preset.title)
      all.push(preset)
      all.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      await writeAll(all.slice(0, MAX_PRESETS))
      res.status(200).json({ ok: true })
      return
    }
    if (req.method === 'DELETE') {
      const title = String(req.query.title ?? '')
      if (!title) {
        res.status(400).json({ error: 'titre manquant' })
        return
      }
      await writeAll((await readAll()).filter((q) => q.title !== title))
      res.status(200).json({ ok: true })
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch {
    res.status(500).json({ error: 'stockage indisponible' })
  }
}
