// Bibliothèque de présets partagée entre testeurs. Un seul document JSON
// dans Vercel Blob ; dernier écrivain gagnant — suffisant pour une poignée
// de testeurs. L'endpoint est ouvert (pas d'authentification) : le site est
// un prototype semi-privé, les présets ne contiennent que des réglages.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ecritDocument, litDocument } from './_magasin'

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
// compatibilité, l'ancien format « tableau de présets ». Lecture/écriture
// via le magasin partagé (_magasin.ts) : pointeur + cache en lecture,
// historique de 4 versions en écriture, échec de lecture ≠ vide.
function validePresets(data: unknown): boolean {
  return Array.isArray(data) || (data !== null && typeof data === 'object' && Array.isArray((data as Library).presets))
}

async function readAll(opts?: { frais?: boolean }): Promise<Library> {
  const data = (await litDocument(PREFIX, validePresets, opts)) as unknown
  if (data === null) return { presets: [], defaultTitle: null }
  if (Array.isArray(data)) {
    return { presets: data.filter((p) => sanitize(p) !== null) as SharedPreset[], defaultTitle: null }
  }
  const lib = data as { presets: unknown[]; defaultTitle?: unknown }
  return {
    presets: lib.presets.filter((p) => sanitize(p) !== null) as SharedPreset[],
    defaultTitle:
      typeof lib.defaultTitle === 'string' && lib.defaultTitle ? lib.defaultTitle : null,
  }
}

async function writeAll(library: Library): Promise<void> {
  await ecritDocument(PREFIX, library)
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
        const lib = await readAll({ frais: true })
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
      const lib = await readAll({ frais: true })
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
      const lib = await readAll({ frais: true })
      lib.presets = lib.presets.filter((q) => q.title !== title)
      if (lib.defaultTitle === title) lib.defaultTitle = null // le défaut suit le préset
      await writeAll(lib)
      res.status(200).json({ ok: true })
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch (e) {
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
