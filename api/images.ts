// Bibliothèque d'images partagée : les visuels des cinématiques (et de tout
// décor à venir) importés PAR les concepteurs, sans passer par le dépôt.
//
// Deux étages dans Vercel Blob :
//   - le PIXEL : un blob binaire par image, sous `imagerie-blobs/` (hors du
//     préfixe du catalogue — _magasin liste son préfixe et tente d'y lire du
//     JSON, les binaires n'ont rien à y faire) ;
//   - le CATALOGUE : un document JSON (`imagerie/`) via _magasin — nom, URL
//     publique du blob, poids, auteur, date. La lecture chaude ne coûte
//     aucune opération SDK, comme les autres magasins.
//
// L'image arrive en base64 (le client la recomprime en WebP ≤ 1600 px avant
// l'envoi) ; remplacer un nom remplace le blob, l'ancien est supprimé.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del, put } from '@vercel/blob'
import { ecritDocument, litDocument } from './_magasin.js'

const PREFIX = 'imagerie/'
const BLOBS = 'imagerie-blobs/'
const MAX_IMAGES = 150
const MAX_OCTETS = 2_500_000 // ~2,4 Mo décodés : large pour du WebP 1600 px

interface SharedImage {
  nom: string
  url: string
  poids: number
  auteur: string
  majAt: string
}

interface Catalogue {
  images: SharedImage[]
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'image'
  )
}

const TYPES: Record<string, string> = {
  'image/webp': '.webp',
  'image/png': '.png',
  'image/jpeg': '.jpg',
}

function valideCat(data: unknown): boolean {
  return !!data && Array.isArray((data as Catalogue).images)
}

async function readCat(opts?: { frais?: boolean }): Promise<Catalogue> {
  const data = (await litDocument(PREFIX, valideCat, opts)) as Catalogue | null
  if (data === null) return { images: [] }
  return {
    images: data.images.filter(
      (i) => i && typeof i.nom === 'string' && typeof i.url === 'string',
    ),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readCat())
      return
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as {
        nom?: unknown
        type?: unknown
        data?: unknown
        auteur?: unknown
      }
      const nom = slug(typeof body.nom === 'string' ? body.nom : '')
      const ext = TYPES[typeof body.type === 'string' ? body.type : '']
      if (!ext) {
        res.status(400).json({ error: 'type inconnu (webp, png ou jpeg)' })
        return
      }
      let octets: Buffer
      try {
        octets = Buffer.from(typeof body.data === 'string' ? body.data : '', 'base64')
      } catch {
        res.status(400).json({ error: 'base64 illisible' })
        return
      }
      if (octets.length === 0 || octets.length > MAX_OCTETS) {
        res.status(400).json({ error: `image vide ou trop lourde (max ${MAX_OCTETS} octets)` })
        return
      }
      const cat = await readCat({ frais: true })
      if (cat.images.length >= MAX_IMAGES && !cat.images.some((i) => i.nom === nom)) {
        res.status(400).json({ error: `catalogue plein (${MAX_IMAGES} images)` })
        return
      }
      const blob = await put(`${BLOBS}${nom}${ext}`, octets, {
        access: 'public',
        addRandomSuffix: true,
        contentType: typeof body.type === 'string' ? body.type : 'application/octet-stream',
      })
      const entree: SharedImage = {
        nom,
        url: blob.url,
        poids: octets.length,
        auteur: typeof body.auteur === 'string' ? body.auteur.slice(0, 12) : '',
        majAt: new Date().toISOString(),
      }
      const idx = cat.images.findIndex((i) => i.nom === nom)
      const ancienne = idx >= 0 ? cat.images[idx].url : null
      if (idx >= 0) cat.images[idx] = entree
      else cat.images.push(entree)
      await ecritDocument(PREFIX, cat)
      // l'ancien pixel du même nom ne sert plus à personne
      if (ancienne && ancienne !== blob.url) await del(ancienne).catch(() => {})
      res.status(200).json(cat)
      return
    }
    if (req.method === 'DELETE') {
      const nom = typeof req.query.nom === 'string' ? req.query.nom : ''
      if (!nom) {
        res.status(400).json({ error: 'nom requis' })
        return
      }
      const cat = await readCat({ frais: true })
      const visee = cat.images.find((i) => i.nom === nom)
      cat.images = cat.images.filter((i) => i.nom !== nom)
      await ecritDocument(PREFIX, cat)
      if (visee) await del(visee.url).catch(() => {})
      res.status(200).json(cat)
      return
    }
    res.status(405).json({ error: 'méthode inconnue' })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
