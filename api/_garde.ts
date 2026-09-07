// LA CLÉ CONCEPTEUR : ce qui ferme les écritures du magasin partagé.
//
// Le dépôt est public et l'adresse de l'API se lit dans ops/ et dans les
// workflows : sans clé, n'importe qui pouvait vider la bibliothèque, la
// carte publiée ou le journal d'un `curl -X DELETE` en boucle — et le
// magasin ne garde que quatre versions (cf. _magasin.ts). La clé n'est
// pas un système de comptes : c'est un seul secret, partagé entre les
// concepteurs, qui sépare « lire » (tout le monde) de « écrire » (eux).
//
// Elle voyage dans l'en-tête `X-Cle-Concepteur` et se règle côté serveur
// par la variable d'environnement CLE_CONCEPTEUR (projet Vercel). SANS
// VARIABLE, LE SERVEUR REFUSE D'ÉCRIRE (503) plutôt que de laisser
// ouvert : un déploiement oublié ne rouvre jamais la porte en silence.
//
// Deux endpoints n'en veulent pas : /api/records (les joueurs y postent
// leurs scores) et /api/perf (leurs rapports de performance).

import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const EN_TETE = 'x-cle-concepteur'
export const VARIABLE = 'CLE_CONCEPTEUR'

/** Le refus à opposer, ou `null` si la clé présentée est la bonne. Pure :
 *  testée au banc avec des chaînes, exécutée ici avec l'en-tête et la
 *  variable d'environnement. */
export function refusDeCle(
  presentee: unknown,
  attendue: string | undefined,
): { status: number; error: string } | null {
  if (!attendue) {
    return {
      status: 503,
      error: `écriture fermée : la clé concepteur n’est pas configurée sur le serveur (variable ${VARIABLE})`,
    }
  }
  if (typeof presentee !== 'string' || presentee === '') {
    return { status: 401, error: 'clé concepteur requise pour écrire' }
  }
  // comparaison en temps constant : les longueurs d'abord (timingSafeEqual
  // lève si elles diffèrent), puis les octets
  const a = new TextEncoder().encode(presentee)
  const b = new TextEncoder().encode(attendue)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { status: 403, error: 'clé concepteur refusée' }
  }
  return null
}

/** À appeler en tête de chaque branche POST / DELETE : répond et rend
 *  `false` si la clé manque ou ment, rend `true` si l'on peut écrire. */
export function exigeCle(req: VercelRequest, res: VercelResponse): boolean {
  const brut = req.headers[EN_TETE]
  const presentee = Array.isArray(brut) ? brut[0] : brut
  const refus = refusDeCle(presentee, process.env[VARIABLE])
  if (!refus) return true
  res.status(refus.status).json({ error: refus.error })
  return false
}
