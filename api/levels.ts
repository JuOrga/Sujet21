// Bibliothèque de tableaux partagée entre concepteurs. Un document JSON dans
// Vercel Blob, comme les présets et les registres : chacun ouvre, modifie,
// enregistre, et l'ORDRE de la liste est la séquence de l'expédition.
//
// L'endpoint est ouvert (prototype semi-privé) et le dernier écrivain gagne —
// suffisant pour deux personnes qui se parlent.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list } from '@vercel/blob'
import { ecritDocument, litDocument } from './_magasin.js'
import { provenanceCode } from './_provenance.js'
import { refusDeBudget } from './_budget.js'

const PREFIX = 'levels/'

interface StoredLevel {
  id: string
  auteur: string
  majAt: string
  // La provenance du CODE, à part : qui l'a saisi et quand. Elle ne bouge
  // QUE lorsque le code change — retoucher le décor d'un tableau ne
  // réattribue pas sa codification (la planche l'affiche sous le code).
  codeAuteur?: string
  codeAt?: string
  level: Record<string, unknown> // LevelDef sérialisé, validé côté client
}

interface Library {
  levels: StoredLevel[] // l'ordre du tableau EST la séquence de jeu
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'tableau'
  )
}

// Lecture/écriture via le magasin partagé (_magasin.ts) : lecture sans
// opération SDK (pointeur + cache), écriture avec historique de 4 versions,
// échec de lecture ≠ bibliothèque vide (ça a déjà coûté la bibliothèque).
// `frais` sur le chemin d'écriture : relecture list() authentique.
function valideLib(data: unknown): boolean {
  return !!data && Array.isArray((data as Library).levels)
}

async function readLib(opts?: { frais?: boolean }): Promise<Library> {
  const data = (await litDocument(PREFIX, valideLib, opts)) as Library | null
  if (data === null) return { levels: [] }
  return { levels: data.levels.filter((l) => l && typeof l.id === 'string' && l.level) }
}

async function writeLib(lib: Library): Promise<void> {
  await ecritDocument(PREFIX, lib)
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      // ?debug=1 : l'état du magasin, blob par blob — chemin, taille, date,
      // statut HTTP du téléchargement et extrait du contenu. Rien de secret
      // (les URL des blobs sont publiques par construction).
      if (req.query.debug) {
        const { blobs } = await list({ prefix: PREFIX })
        const etat = []
        for (const b of [...blobs].sort(
          (x, y) => new Date(y.uploadedAt).getTime() - new Date(x.uploadedAt).getTime(),
        )) {
          let statut = 0
          let extrait = ''
          try {
            const r = await fetch(b.url, { cache: 'no-store' })
            statut = r.status
            extrait = (await r.text()).slice(0, 120)
          } catch (e) {
            extrait = String(e)
          }
          etat.push({ pathname: b.pathname, taille: b.size, uploadedAt: b.uploadedAt, url: b.url, statut, extrait })
        }
        res.status(200).json({ debug: true, nb: blobs.length, etat })
        return
      }
      res.status(200).json(await readLib())
      return
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>

      // Réordonner : la séquence de l'expédition, du premier au dernier
      if (Array.isArray(body.order)) {
        const order = (body.order as unknown[]).filter((x) => typeof x === 'string') as string[]
        const lib = await readLib({ frais: true })
        const byId = new Map(lib.levels.map((l) => [l.id, l]))
        const next: StoredLevel[] = []
        for (const id of order) {
          const l = byId.get(id)
          if (l) {
            next.push(l)
            byId.delete(id)
          }
        }
        // ce que l'appelant n'a pas cité reste, à la fin : rien ne disparaît
        for (const l of byId.values()) next.push(l)
        await writeLib({ levels: next })
        res.status(200).json({ ok: true, levels: next })
        return
      }

      // Enregistrer (création ou mise à jour)
      const level = body.level
      if (typeof level !== 'object' || level === null) {
        res.status(400).json({ error: 'tableau manquant' })
        return
      }
      const name = typeof (level as Record<string, unknown>).name === 'string'
        ? ((level as Record<string, unknown>).name as string)
        : 'tableau'
      const auteur =
        typeof body.auteur === 'string' ? body.auteur.trim().toUpperCase().slice(0, 12) : ''

      const lib = await readLib({ frais: true })
      let id = typeof body.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : ''
      if (!id) {
        // CRÉATION (« Enregistrer sous ») : jamais écraser un homonyme — si
        // le slug du nom est déjà pris (même tableau rebaptisé pareil, ou
        // deux tableaux au même nom), on suffixe jusqu'à un id libre
        const base = slug(name)
        let candidat = base
        let n = 2
        while (lib.levels.some((l) => l.id === candidat)) candidat = `${base}-${n++}`.slice(0, 64)
        id = candidat
      }
      // La saisie du CODE se date à part : seul le serveur connaît l'état
      // d'avant, donc lui seul peut dire si la codification vient de
      // changer — quel que soit l'écran (planche, éditeur) qui l'envoie.
      const at = lib.levels.findIndex((l) => l.id === id)
      const avant = at >= 0 ? lib.levels[at] : undefined
      const maintenant = new Date().toISOString()
      const entry: StoredLevel = {
        id,
        auteur,
        majAt: maintenant,
        ...provenanceCode(
          avant,
          (level as Record<string, unknown>).code,
          auteur,
          maintenant,
        ),
        level: level as Record<string, unknown>,
      }
      if (at >= 0) lib.levels[at] = entry
      else lib.levels.push(entry)
      // Le plafond est un POIDS, pas un nombre d'entrées (cf. _budget.ts) :
      // le document part en entier à chaque lecture, c'est lui qu'on tient.
      const refus = refusDeBudget(lib)
      if (refus) {
        res.status(400).json({ error: refus })
        return
      }
      await writeLib(lib)
      res.status(200).json({ ok: true, id, levels: lib.levels })
      return
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id ?? '')
      if (!id) {
        res.status(400).json({ error: 'identifiant manquant' })
        return
      }
      const lib = await readLib({ frais: true })
      lib.levels = lib.levels.filter((l) => l.id !== id)
      await writeLib(lib)
      res.status(200).json({ ok: true, levels: lib.levels })
      return
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'méthode non autorisée' })
  } catch (e) {
    // le DÉTAIL est précieux : c'est lui qui distingue « blob illisible »
    // de « jeton manquant » — des chiffres de machine, rien de personnel
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
