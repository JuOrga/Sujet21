// LES RÉGLAGES PARTAGÉS du concepteur, par DOMAINE : le plan de la
// descente, la carte de la station, les cartes de l'atelier des
// récompenses, les retouches de textes, les séquences (LA RÉGIE). Un
// document JSON par domaine, publié pour tous depuis l'écran qui le règle —
// le code du jeu porte la version livrée comme filet, ce magasin porte
// celle du concepteur.
//
// Le serveur ne connaît pas la FORME de chaque document (elle vit dans le
// code du jeu, qui la ramène dans ses bornes en la relisant : clampPlanVoie
// pour le plan) ; il garde la taille, le domaine et l'auteur. Un magasin
// par domaine (préfixe `reglages-<domaine>/`, _magasin.ts : pointeur +
// cache en lecture, historique de 4 versions en écriture) — et UNE seule
// fonction Vercel pour tous les domaines : le plan Hobby en compte douze.
//
// GET    ?domaine=plan-voie → { domaine, document | null, auteur, date }
// POST   { domaine, document, auteur } publie (remplace tout)
// DELETE ?domaine=… retire le document : le livré reprend

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ecritDocument, litDocument } from './_magasin.js'

const DOMAINES = ['plan-voie', 'carte', 'recompenses', 'textes', 'sequences']
const MAX_OCTETS = 200_000

interface Magasin {
  domaine: string
  document: unknown
  auteur: string
  date: string
}

function domaineDe(brut: unknown): string | null {
  return typeof brut === 'string' && DOMAINES.includes(brut) ? brut : null
}

function valide(data: unknown): boolean {
  return data !== null && typeof data === 'object' && 'document' in (data as object)
}

async function readAll(domaine: string, opts?: { frais?: boolean }): Promise<Magasin> {
  const data = (await litDocument(`reglages-${domaine}/`, valide, opts)) as Magasin | null
  if (data === null) return { domaine, document: null, auteur: '', date: '' }
  return {
    domaine,
    document: typeof data.document === 'object' ? data.document : null,
    auteur: typeof data.auteur === 'string' ? data.auteur : '',
    date: typeof data.date === 'string' ? data.date : '',
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET' || req.method === 'DELETE') {
      const domaine = domaineDe(req.query.domaine)
      if (!domaine) {
        res.status(400).json({ error: `domaine inconnu (${DOMAINES.join(', ')})` })
        return
      }
      if (req.method === 'GET') {
        res.status(200).json(await readAll(domaine))
        return
      }
      const mag: Magasin = { domaine, document: null, auteur: '', date: new Date().toISOString() }
      await ecritDocument(`reglages-${domaine}/`, mag)
      res.status(200).json(mag)
      return
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      const domaine = domaineDe(body.domaine)
      if (!domaine) {
        res.status(400).json({ error: `domaine inconnu (${DOMAINES.join(', ')})` })
        return
      }
      if (typeof body.document !== 'object' || body.document === null || Array.isArray(body.document)) {
        res.status(400).json({ error: 'document attendu : un objet JSON' })
        return
      }
      if (JSON.stringify(body.document).length > MAX_OCTETS) {
        res.status(400).json({ error: `document trop lourd (max ${MAX_OCTETS} octets)` })
        return
      }
      const mag: Magasin = {
        domaine,
        document: body.document,
        auteur: typeof body.auteur === 'string' ? body.auteur.trim().slice(0, 40) : '',
        date: new Date().toISOString(),
      }
      await ecritDocument(`reglages-${domaine}/`, mag)
      res.status(200).json(mag)
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch (e) {
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
