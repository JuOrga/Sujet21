// LES RÉGLAGES DU CODEX, partagés entre concepteurs : pour chaque fiche, la
// MÉMOIRE gravée à la découverte, la RARETÉ, et la VIDÉO de l'effet envoyée
// depuis l'atelier du codex (sans passer par le dépôt). Le code du jeu
// porte les défauts (dix de mémoire, normale, vidéo du dossier public) ;
// ce magasin ne garde que les écarts.
//
// Deux étages dans Vercel Blob, comme les images :
//   - la VIDÉO : un blob binaire par fiche, sous `codex-blobs/` ;
//   - le DOCUMENT : { fiches: { id → réglage } } via _magasin (pointeur +
//     cache en lecture, historique de 4 versions en écriture).
//
// GET    → { fiches }
// POST   → { id, memoire, rarete, auteur, video?: { type, data }, retirerVideo? }
//          enregistre UNE fiche ; la vidéo (base64) remplace la précédente
// DELETE → ?id=… rétablit les défauts de la fiche (sa vidéo est supprimée)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del, put } from '@vercel/blob'
import { ecritDocument, litDocument } from './_magasin.js'

const PREFIX = 'codex/'
const BLOBS = 'codex-blobs/'
const MAX_FICHES = 300
const MEMOIRE_MAX = 500
// le corps d'une fonction plafonne à 4,5 Mo, base64 compris : 3 Mo de fichier
const VIDEO_MAX_OCTETS = 3_000_000
const RARETES = ['normale', 'rare', 'legendaire']
const TYPES: Record<string, string> = {
  'video/webm': '.webm',
  'video/mp4': '.mp4',
}

interface Reglage {
  memoire: number
  rarete: string
  video: string
  auteur: string
  date: string
}

interface Magasin {
  fiches: Record<string, Reglage>
}

const idValide = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-z0-9-]{2,48}$/.test(id)

function litReglage(brut: unknown): Reglage {
  const p = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>
  const m = Number(p.memoire)
  return {
    memoire: Number.isFinite(m) ? Math.max(0, Math.min(MEMOIRE_MAX, Math.round(m))) : 10,
    rarete: RARETES.includes(String(p.rarete)) ? String(p.rarete) : 'normale',
    video: typeof p.video === 'string' && /^https:\/\/[^\s"'<>]+$/.test(p.video) ? p.video : '',
    auteur: typeof p.auteur === 'string' ? p.auteur.trim().slice(0, 40) : '',
    date: typeof p.date === 'string' ? p.date.slice(0, 40) : '',
  }
}

function valide(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === 'object' &&
    typeof (data as Magasin).fiches === 'object' &&
    (data as Magasin).fiches !== null
  )
}

async function readAll(opts?: { frais?: boolean }): Promise<Magasin> {
  const data = (await litDocument(PREFIX, valide, opts)) as Magasin | null
  const fiches: Record<string, Reglage> = {}
  if (data) {
    for (const [id, r] of Object.entries(data.fiches)) {
      if (idValide(id)) fiches[id] = litReglage(r)
    }
  }
  return { fiches }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readAll())
      return
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (!idValide(body.id)) {
        res.status(400).json({ error: 'id de fiche invalide' })
        return
      }
      const id = body.id
      const mag = await readAll({ frais: true })
      const avant = mag.fiches[id]
      if (!avant && Object.keys(mag.fiches).length >= MAX_FICHES) {
        res.status(400).json({ error: `magasin plein (${MAX_FICHES} fiches)` })
        return
      }
      const r = litReglage({ ...body, video: avant?.video ?? '' })
      r.date = new Date().toISOString()
      let ancienne: string | null = null
      if (body.retirerVideo === true) {
        ancienne = avant?.video ?? null
        r.video = ''
      } else if (typeof body.video === 'object' && body.video !== null) {
        const v = body.video as { type?: unknown; data?: unknown }
        const ext = TYPES[typeof v.type === 'string' ? v.type : '']
        if (!ext) {
          res.status(400).json({ error: 'type de vidéo inconnu (webm ou mp4)' })
          return
        }
        let octets: Buffer
        try {
          octets = Buffer.from(typeof v.data === 'string' ? v.data : '', 'base64')
        } catch {
          res.status(400).json({ error: 'base64 illisible' })
          return
        }
        if (octets.length === 0 || octets.length > VIDEO_MAX_OCTETS) {
          res.status(400).json({ error: `vidéo vide ou trop lourde (max ${VIDEO_MAX_OCTETS} octets)` })
          return
        }
        const blob = await put(`${BLOBS}${id}${ext}`, octets, {
          access: 'public',
          addRandomSuffix: true,
          contentType: v.type as string,
        })
        ancienne = avant?.video ?? null
        r.video = blob.url
      }
      mag.fiches[id] = r
      await ecritDocument(PREFIX, mag)
      // l'ancienne vidéo de la même fiche ne sert plus à personne
      if (ancienne && ancienne !== r.video) await del(ancienne).catch(() => {})
      res.status(200).json(mag)
      return
    }
    if (req.method === 'DELETE') {
      const id = req.query.id
      if (!idValide(id)) {
        res.status(400).json({ error: 'id de fiche invalide' })
        return
      }
      const mag = await readAll({ frais: true })
      const visee = mag.fiches[id]
      delete mag.fiches[id]
      await ecritDocument(PREFIX, mag)
      if (visee?.video) await del(visee.video).catch(() => {})
      res.status(200).json(mag)
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch (e) {
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
