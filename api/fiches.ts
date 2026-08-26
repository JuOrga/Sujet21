// Les SURCHARGES de fiches de l'éditeur, partagées entre concepteurs.
// Chaque fiche de la bulle savante (titre, résumé, lignes d'effet) peut
// être réécrite depuis l'éditeur ; la réécriture vaut pour tout le monde.
// Un seul document JSON dans Vercel Blob (magasin _magasin.ts : pointeur +
// cache en lecture, historique de 4 versions en écriture). Dernier
// écrivain gagnant — suffisant pour une poignée de concepteurs.
//
// GET    → { surcharges: FicheSurcharge[] } (vide : personne n'a réécrit)
// POST   → réécrit UNE fiche (corps { cle, titre, resume, lignes, auteur })
// DELETE → ?cle=… rétablit l'original (la surcharge disparaît)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ecritDocument, litDocument } from './_magasin.js'

const PREFIX = 'fiches/'
const MAX_SURCHARGES = 200

interface FicheSurcharge {
  cle: string
  titre: string
  resume: string
  lignes: { cle: string; txt: string }[]
  auteur: string
  date: string
}

function sanitize(input: unknown): FicheSurcharge | null {
  if (typeof input !== 'object' || input === null) return null
  const p = input as Record<string, unknown>
  if (
    typeof p.cle !== 'string' ||
    !/^(mat:\d{1,2}|genre:[a-z-]{2,32})$/.test(p.cle)
  )
    return null
  if (typeof p.titre !== 'string' || !p.titre.trim()) return null
  if (typeof p.resume !== 'string') return null
  if (!Array.isArray(p.lignes)) return null
  const lignes: { cle: string; txt: string }[] = []
  for (const l of p.lignes as unknown[]) {
    if (typeof l !== 'object' || l === null) continue
    const q = l as Record<string, unknown>
    if (typeof q.cle !== 'string' || typeof q.txt !== 'string') continue
    if (!q.txt.trim()) continue
    lignes.push({
      cle: q.cle.trim().slice(0, 12) || '·',
      txt: q.txt.trim().slice(0, 400),
    })
    if (lignes.length >= 12) break
  }
  return {
    cle: p.cle,
    titre: p.titre.trim().slice(0, 80),
    resume: p.resume.trim().slice(0, 400),
    lignes,
    auteur: typeof p.auteur === 'string' ? p.auteur.trim().slice(0, 40) : '',
    date: new Date().toISOString(),
  }
}

interface Magasin {
  surcharges: FicheSurcharge[]
}

function valide(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === 'object' &&
    Array.isArray((data as Magasin).surcharges)
  )
}

async function readAll(opts?: { frais?: boolean }): Promise<Magasin> {
  const data = (await litDocument(PREFIX, valide, opts)) as Magasin | null
  if (data === null) return { surcharges: [] }
  return {
    surcharges: data.surcharges.filter(
      (s) => sanitize(s) !== null,
    ) as FicheSurcharge[],
  }
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
      const s = sanitize(req.body)
      if (!s) {
        res
          .status(400)
          .json({ error: 'fiche invalide : clé, titre et lignes attendus' })
        return
      }
      const mag = await readAll({ frais: true })
      mag.surcharges = mag.surcharges.filter((q) => q.cle !== s.cle)
      mag.surcharges.push(s)
      mag.surcharges.sort((a, b) => a.cle.localeCompare(b.cle, 'fr'))
      mag.surcharges = mag.surcharges.slice(0, MAX_SURCHARGES)
      await ecritDocument(PREFIX, mag)
      res.status(200).json({ ok: true, surcharge: s })
      return
    }
    if (req.method === 'DELETE') {
      const cle = String(req.query.cle ?? '')
      if (!cle) {
        res.status(400).json({ error: 'clé manquante' })
        return
      }
      const mag = await readAll({ frais: true })
      mag.surcharges = mag.surcharges.filter((q) => q.cle !== cle)
      await ecritDocument(PREFIX, mag)
      res.status(200).json({ ok: true })
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch (e) {
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
