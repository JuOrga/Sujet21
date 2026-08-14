// Rapports de performance envoyés depuis le jeu (voile PARAMÈTRES) : un
// document JSON par envoi dans Vercel Blob, les 20 derniers conservés.
// L'endpoint est ouvert (prototype semi-privé), comme les registres — il
// sert la boucle d'analyse à distance : le joueur envoie depuis son
// appareil (Steam Deck, téléphone), l'analyse se fait sur les URLs listées.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del, list, put } from '@vercel/blob'

const PREFIX = 'perf/'
const MAX_REPORTS = 20

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'anonyme'
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method === 'GET') {
    const { blobs } = await list({ prefix: PREFIX })
    const tri = [...blobs].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    )
    const rapports = tri.map((b) => ({
      url: b.url,
      envoyeAt: b.uploadedAt,
      nom: b.pathname.slice(PREFIX.length),
    }))
    // Les 3 plus récents, CONTENU INCLUS : l'analyse à distance n'a besoin
    // que de cet endpoint — le domaine du stockage blob n'est pas joignable
    // depuis tous les environnements d'analyse.
    const derniers = await Promise.all(
      tri.slice(0, 3).map(async (b) => {
        const r = await fetch(b.url, { cache: 'no-store' })
        return {
          nom: b.pathname.slice(PREFIX.length),
          envoyeAt: b.uploadedAt,
          contenu: r.ok ? await r.json().catch(() => null) : null,
        }
      }),
    )
    res.status(200).json({ rapports, derniers })
    return
  }

  if (req.method === 'POST') {
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
      auteur?: unknown
      rapport?: unknown
    }
    if (!body.rapport || typeof body.rapport !== 'object') {
      res.status(400).json({ erreur: 'rapport manquant' })
      return
    }
    const auteur = typeof body.auteur === 'string' ? body.auteur : 'anonyme'
    const doc = JSON.stringify({ auteur, rapport: body.rapport })
    if (doc.length > 200_000) {
      res.status(413).json({ erreur: 'rapport trop grand' })
      return
    }
    const nom = `${PREFIX}${Date.now()}-${slug(auteur)}.json`
    await put(nom, doc, { access: 'public', addRandomSuffix: true, contentType: 'application/json' })
    // ne garder que les derniers : les vieux rapports s'effacent
    const { blobs } = await list({ prefix: PREFIX })
    const anciens = [...blobs]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(MAX_REPORTS)
    if (anciens.length > 0) await del(anciens.map((b) => b.url)).catch(() => {})
    res.status(200).json({ ok: true, nom })
    return
  }

  res.status(405).json({ erreur: 'méthode' })
}
