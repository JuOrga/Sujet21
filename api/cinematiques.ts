// Bibliothèque de cinématiques partagée entre concepteurs. Un document JSON
// dans Vercel Blob, comme les tableaux : chacun compose sur sa table de
// montage puis PARTAGE — la cinématique devient visible (et jouable par son
// code) sur tous les postes. Dernier écrivain gagnant, endpoint ouvert
// (prototype semi-privé) : même régime que /api/levels.
//
// Les images des planches sont des RÉFÉRENCES (/assets/… ou une URL de la
// bibliothèque d'images /api/images) — jamais des data URI : le document
// resterait sinon impossible à borner.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ecritDocument, litDocument } from './_magasin.js'

const PREFIX = 'cinematiques/'
const MAX_CINES = 100
const MAX_PLANCHES = 40

interface SharedCine {
  code: string
  titre: string
  planches: Record<string, unknown>[]
  auteur: string
  majAt: string
}

interface Library {
  cines: SharedCine[]
}

function borne(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function sanitizePlanche(input: unknown): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null) return null
  const p = input as Record<string, unknown>
  const image = borne(p.image, 600)
  if (image.startsWith('data:')) return null // référence seulement, jamais le pixel
  const duree = typeof p.duree === 'number' && Number.isFinite(p.duree) ? Math.min(30, Math.max(1, p.duree)) : 5
  return {
    image,
    texte: borne(p.texte, 500),
    duree,
    effet: borne(p.effet, 24),
    fondu: borne(p.fondu, 12),
    bruitage: borne(p.bruitage, 32),
    ponctuation: borne(p.ponctuation, 32),
    piste: borne(p.piste, 32),
  }
}

function sanitize(input: unknown, auteur: string): SharedCine | null {
  if (typeof input !== 'object' || input === null) return null
  const c = input as Record<string, unknown>
  const code = borne(c.code, 24).trim()
  if (!code) return null
  const brut = Array.isArray(c.planches) ? c.planches.slice(0, MAX_PLANCHES) : []
  const planches = brut.map(sanitizePlanche).filter((p): p is Record<string, unknown> => p !== null)
  if (planches.length === 0) return null
  return {
    code,
    titre: borne(c.titre, 80).trim() || code,
    planches,
    auteur: auteur.slice(0, 12),
    majAt: new Date().toISOString(),
  }
}

function valideLib(data: unknown): boolean {
  return !!data && Array.isArray((data as Library).cines)
}

async function readLib(opts?: { frais?: boolean }): Promise<Library> {
  const data = (await litDocument(PREFIX, valideLib, opts)) as Library | null
  if (data === null) return { cines: [] }
  return { cines: data.cines.filter((c) => c && typeof c.code === 'string' && Array.isArray(c.planches)) }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readLib())
      return
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as { cine?: unknown; auteur?: unknown }
      const cine = sanitize(body.cine, typeof body.auteur === 'string' ? body.auteur : '')
      if (!cine) {
        res.status(400).json({ error: 'cinématique illisible' })
        return
      }
      const lib = await readLib({ frais: true })
      const bas = cine.code.toLowerCase()
      const idx = lib.cines.findIndex((c) => c.code.toLowerCase() === bas)
      if (idx >= 0) lib.cines[idx] = cine
      else lib.cines.push(cine)
      if (lib.cines.length > MAX_CINES) lib.cines = lib.cines.slice(-MAX_CINES)
      await ecritDocument(PREFIX, lib)
      res.status(200).json(lib)
      return
    }
    if (req.method === 'DELETE') {
      const code = typeof req.query.code === 'string' ? req.query.code.toLowerCase() : ''
      if (!code) {
        res.status(400).json({ error: 'code requis' })
        return
      }
      const lib = await readLib({ frais: true })
      lib.cines = lib.cines.filter((c) => c.code.toLowerCase() !== code)
      await ecritDocument(PREFIX, lib)
      res.status(200).json(lib)
      return
    }
    res.status(405).json({ error: 'méthode inconnue' })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
