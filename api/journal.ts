// LE JOURNAL publié par le concepteur : le RÉCIT, les FINS, et les deux
// seuils (révélation après N fragments, dénouement après N fins). Le code
// du jeu porte le journal LIVRÉ (src/game/journal.ts) ; ce magasin porte
// celui que le concepteur a publié depuis l'atelier RÉCIT & FINS — pour
// tous les joueurs, sans passer par le dépôt.
//
// Un seul document JSON dans Vercel Blob (magasin _magasin.ts : pointeur +
// cache en lecture, historique de 4 versions en écriture). Dernier
// écrivain gagnant — suffisant pour une poignée de concepteurs.
//
// GET    → { journal: JournalDef | null, auteur, date } (null : rien de publié)
// POST   → { journal, auteur } publie (remplace tout)
// DELETE → retire le journal publié : le livré reprend

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ecritDocument, litDocument } from './_magasin.js'

const PREFIX = 'journal/'
const MAX_ENTREES = 60
const MAX_TITRE = 80
const MAX_TEXTE = 1200
const MAX_ICONE = 8
const ID_OK = /^[a-z0-9-]{3,48}$/
const PREFIXE: Record<string, string> = { recit: 'recit-', fins: 'fin-' }
const ID_RESERVE = 'fin-jouee'

interface Entree {
  id: string
  icone: string
  titre: string
  texte: string
}

interface Journal {
  recit: Entree[]
  fins: Entree[]
  revelationApres: number
  denouementApres: number
}

interface Magasin {
  journal: Journal | null
  auteur: string
  date: string
}

function litEntree(brut: unknown, groupe: string): Entree | null {
  if (typeof brut !== 'object' || brut === null) return null
  const p = brut as Record<string, unknown>
  if (typeof p.id !== 'string' || !ID_OK.test(p.id) || !p.id.startsWith(PREFIXE[groupe])) return null
  if (p.id === ID_RESERVE) return null
  return {
    id: p.id,
    icone: typeof p.icone === 'string' ? p.icone.trim().slice(0, MAX_ICONE) : '',
    titre: typeof p.titre === 'string' ? p.titre.trim().slice(0, MAX_TITRE) : '',
    texte: typeof p.texte === 'string' ? p.texte.trim().slice(0, MAX_TEXTE) : '',
  }
}

function litSeuil(brut: unknown, max: number): number {
  const n = Number(brut)
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : max
}

// La même lecture que src/game/journal.ts (litJournal) : ce qui entre au
// magasin est déjà propre, le client n'a rien à réparer en le relisant.
function litJournal(brut: unknown): Journal | null {
  if (typeof brut !== 'object' || brut === null) return null
  const p = brut as Record<string, unknown>
  if (!Array.isArray(p.recit) || !Array.isArray(p.fins)) return null
  const vus = new Set<string>()
  const lis = (liste: unknown[], groupe: string): Entree[] => {
    const out: Entree[] = []
    for (const b of liste) {
      const e = litEntree(b, groupe)
      if (!e || vus.has(e.id)) continue
      vus.add(e.id)
      out.push(e)
      if (out.length >= MAX_ENTREES) break
    }
    return out
  }
  const recit = lis(p.recit, 'recit')
  const fins = lis(p.fins, 'fins')
  return {
    recit,
    fins,
    revelationApres: litSeuil(p.revelationApres, recit.length),
    denouementApres: litSeuil(p.denouementApres, fins.length),
  }
}

function valide(data: unknown): boolean {
  return data !== null && typeof data === 'object' && 'journal' in (data as object)
}

async function readAll(opts?: { frais?: boolean }): Promise<Magasin> {
  const data = (await litDocument(PREFIX, valide, opts)) as Magasin | null
  if (data === null) return { journal: null, auteur: '', date: '' }
  return {
    journal: litJournal(data.journal),
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
    if (req.method === 'GET') {
      res.status(200).json(await readAll())
      return
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      const journal = litJournal(body.journal)
      if (!journal) {
        res.status(400).json({ error: 'journal invalide : recit et fins attendus' })
        return
      }
      const mag: Magasin = {
        journal,
        auteur: typeof body.auteur === 'string' ? body.auteur.trim().slice(0, 40) : '',
        date: new Date().toISOString(),
      }
      await ecritDocument(PREFIX, mag)
      res.status(200).json(mag)
      return
    }
    if (req.method === 'DELETE') {
      const mag: Magasin = { journal: null, auteur: '', date: new Date().toISOString() }
      await ecritDocument(PREFIX, mag)
      res.status(200).json(mag)
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch (e) {
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
