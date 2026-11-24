// LES CRÉATIONS DES JOUEURS : l'endpoint. Les règles vivent dans
// _creations.ts ; ici, seulement le transport et le dépôt Vercel Blob.
//
// GET                 → { creations } : la liste, pour l'écran CRÉATIONS
// GET    ?id=…        → { creation, records } : une salle, prête à jouer
// POST   { action: 'publier', salle, auteur, jeton, essai, id? }
//                     → publie (ou, avec id, retouche) une salle
// POST   { action: 'record', id, empreinte, nom, litres, temps }
//                     → dépose une partie dans les records d'une salle
// DELETE ?id=…  (en-tête x-jeton-auteur) → son auteur la retire
//
// Ouvert sans clé concepteur, exprès : ce sont les joueurs qui écrivent.
// La liste blanche (_creation.ts) trie ce qu'ils envoient ; le jeton
// d'auteur protège leurs salles les unes des autres.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BlobError, BlobPreconditionFailedError, del, get, put } from '@vercel/blob'
import { traiteCreations, type Depot } from './_creations.js'

/** Le dépôt Blob. LIRE : `useCache: false`, la version d'origine et son
 *  ETag — une lecture servie par le cache CDN (jusqu'à 60 s) donnerait un
 *  contenu ancien avec un ETag récent, et l'écriture conditionnelle
 *  écraserait ce qu'elle croit protéger. ÉCRIRE : à chemin fixe, avec
 *  l'ETag lu (`ifMatch`), ou en création seule (`allowOverwrite: false`). */
const depotBlob: Depot = {
  async lit(chemin) {
    const r = await get(chemin, { access: 'public', useCache: false }).catch((e: unknown) => {
      // absent : pas une panne
      if (e instanceof BlobError && /not found|does not exist/i.test(e.message)) return null
      throw e
    })
    if (!r || r.statusCode !== 200) return null
    const texte = await new Response(r.stream).text()
    return { corps: JSON.parse(texte) as unknown, etag: r.blob.etag }
  },
  async ecrit(chemin, corps, etag) {
    try {
      await put(chemin, JSON.stringify(corps), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: etag !== null,
        ...(etag !== null ? { ifMatch: etag } : {}),
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      })
      return 'ok'
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) return 'conflit'
      // création seule sur un chemin déjà pris
      if (e instanceof BlobError && /already exists/i.test(e.message)) return 'conflit'
      throw e
    }
  },
  async efface(chemin) {
    await del(chemin).catch(() => {}) // déjà parti : rien à faire
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const query: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(req.query)) query[k] = Array.isArray(v) ? v[0] : v
    const jeton = req.headers['x-jeton-auteur']
    const r = await traiteCreations(
      {
        methode: req.method ?? 'GET',
        query,
        corps: req.body,
        jeton: Array.isArray(jeton) ? jeton[0] : jeton,
      },
      depotBlob,
    )
    if (r.statut === 405) res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(r.statut).json(r.corps)
  } catch (e) {
    res.status(500).json({ error: 'stockage indisponible', detail: String(e) })
  }
}
