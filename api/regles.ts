// Le CAHIER DES RÈGLES de génération, partagé entre concepteurs.
// Le catalogue des règles vit dans le code (src/game/reglesGen.ts) ; ici
// vivent ce que les concepteurs y ÉCRIVENT depuis le jeu :
//   · les NOTES — une annotation par règle du catalogue (ou par ajout) ;
//   · les AJOUTS — des règles nouvelles, en texte libre, à implémenter.
// Un seul document JSON dans Vercel Blob (magasin _magasin.ts : pointeur +
// cache en lecture, historique de 4 versions en écriture). Dernier
// écrivain gagnant — suffisant pour une poignée de concepteurs.
//
// GET    → { notes: NoteRegle[], ajouts: AjoutRegle[] }
// POST   → { type:'note', id, note, auteur } annote (note vide : efface)
//        → { type:'ajout', id?, titre?, texte, auteur } ajoute ou réécrit
// DELETE → ?id=… retire un ajout (et sa note)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ecritDocument, litDocument } from './_magasin.js'

const PREFIX = 'regles/'
const MAX_NOTES = 300
const MAX_AJOUTS = 200

interface NoteRegle {
  id: string
  note: string
  auteur: string
  date: string
}

interface AjoutRegle {
  id: string
  titre: string
  texte: string
  auteur: string
  date: string
}

const ID_OK = /^[a-z0-9][a-z0-9-]{1,63}$/

function nettoieNote(input: unknown): NoteRegle | null {
  if (typeof input !== 'object' || input === null) return null
  const p = input as Record<string, unknown>
  if (typeof p.id !== 'string' || !ID_OK.test(p.id)) return null
  if (typeof p.note !== 'string') return null
  return {
    id: p.id,
    note: p.note.trim().slice(0, 2000),
    auteur: typeof p.auteur === 'string' ? p.auteur.trim().slice(0, 40) : '',
    date:
      typeof p.date === 'string' && p.date
        ? p.date.slice(0, 32)
        : new Date().toISOString(),
  }
}

function nettoieAjout(input: unknown): AjoutRegle | null {
  if (typeof input !== 'object' || input === null) return null
  const p = input as Record<string, unknown>
  if (typeof p.texte !== 'string' || !p.texte.trim()) return null
  const id =
    typeof p.id === 'string' && ID_OK.test(p.id)
      ? p.id
      : `x-${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
          .toString(36)
          .padStart(2, '0')}`
  return {
    id,
    titre: typeof p.titre === 'string' ? p.titre.trim().slice(0, 120) : '',
    texte: p.texte.trim().slice(0, 4000),
    auteur: typeof p.auteur === 'string' ? p.auteur.trim().slice(0, 40) : '',
    date:
      typeof p.date === 'string' && p.date
        ? p.date.slice(0, 32)
        : new Date().toISOString(),
  }
}

interface Magasin {
  notes: NoteRegle[]
  ajouts: AjoutRegle[]
}

function valide(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === 'object' &&
    Array.isArray((data as Magasin).notes) &&
    Array.isArray((data as Magasin).ajouts)
  )
}

async function readAll(opts?: { frais?: boolean }): Promise<Magasin> {
  const data = (await litDocument(PREFIX, valide, opts)) as Magasin | null
  if (data === null) return { notes: [], ajouts: [] }
  return {
    notes: data.notes
      .map((n) => nettoieNote(n))
      .filter((n): n is NoteRegle => n !== null && n.note !== ''),
    ajouts: data.ajouts
      .map((a) => nettoieAjout(a))
      .filter((a): a is AjoutRegle => a !== null),
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
      const corps = req.body as Record<string, unknown> | null
      const type = corps?.type
      if (type === 'note') {
        const n = nettoieNote(corps)
        if (!n) {
          res.status(400).json({ error: 'note invalide : id et note attendus' })
          return
        }
        const mag = await readAll({ frais: true })
        mag.notes = mag.notes.filter((q) => q.id !== n.id)
        if (n.note !== '') mag.notes.push(n)
        mag.notes = mag.notes.slice(-MAX_NOTES)
        await ecritDocument(PREFIX, mag)
        res.status(200).json({ ok: true, note: n })
        return
      }
      if (type === 'ajout') {
        const a = nettoieAjout(corps)
        if (!a) {
          res.status(400).json({ error: 'ajout invalide : texte attendu' })
          return
        }
        const mag = await readAll({ frais: true })
        const dejaLa = mag.ajouts.find((q) => q.id === a.id)
        if (dejaLa) a.date = dejaLa.date // la réécriture garde la date d'origine
        mag.ajouts = mag.ajouts.filter((q) => q.id !== a.id)
        mag.ajouts.push(a)
        mag.ajouts = mag.ajouts.slice(-MAX_AJOUTS)
        await ecritDocument(PREFIX, mag)
        res.status(200).json({ ok: true, ajout: a })
        return
      }
      res.status(400).json({ error: 'type inconnu : note ou ajout' })
      return
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id ?? '')
      if (!ID_OK.test(id)) {
        res.status(400).json({ error: 'identifiant manquant' })
        return
      }
      const mag = await readAll({ frais: true })
      mag.ajouts = mag.ajouts.filter((q) => q.id !== id)
      mag.notes = mag.notes.filter((q) => q.id !== id)
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
