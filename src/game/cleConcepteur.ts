// LA CLÉ CONCEPTEUR, côté poste : ce que le jeu joint à chaque ÉCRITURE
// vers le magasin partagé (/api/*, POST et DELETE). Le serveur la vérifie
// (api/_garde.ts) ; lire ne demande rien.
//
// Elle vit en sessionStorage, PAS en localStorage : un script qui se
// glisserait dans la page (un nom de tableau mal échappé, par exemple) ne
// doit pas la trouver rangée pour toujours — elle meurt avec l'onglet, et
// on la redemande à la prochaine séance. C'est une gêne assumée : la
// concepteur la tape une fois par onglet.
//
// Le geste est unique et central : `fetchConcepteur` remplace `fetch` sur
// les écritures. Il joint la clé s'il l'a, la demande sinon (une invite
// du navigateur : c'est un outil de concepteur, pas un écran du jeu), et
// si le serveur la refuse (401, 403) il l'oublie et la redemande UNE fois
// avant de rendre la réponse telle quelle — les écrans savent déjà dire
// « refusé » et pourquoi.

export const EN_TETE_CLE = 'X-Cle-Concepteur'
const STOCKAGE = 'sujet21-cle-concepteur'

/** Le tiroir de la clé — injectable pour le banc, sessionStorage en vrai.
 *  Absent (page d'essai sans stockage, mode privé qui lève) : la clé ne
 *  tient que le temps de l'appel. */
export interface Tiroir {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

function tiroir(): Tiroir | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

let enMemoire: string | null = null

export function cleEnPoche(): string | null {
  try {
    return tiroir()?.getItem(STOCKAGE) ?? enMemoire
  } catch {
    return enMemoire
  }
}

export function retientCle(cle: string): void {
  enMemoire = cle
  try {
    tiroir()?.setItem(STOCKAGE, cle)
  } catch {
    /* pas de tiroir : la mémoire du module suffit pour l'onglet */
  }
}

export function oublieCle(): void {
  enMemoire = null
  try {
    tiroir()?.removeItem(STOCKAGE)
  } catch {
    /* rien à retirer */
  }
}

/** L'invite — `prompt` du navigateur en vrai, remplaçable au banc. Rend
 *  `null` si l'on annule ou si aucune invite n'existe (Node, page sans
 *  fenêtre) : l'écriture part alors sans clé et le serveur dira non. */
export type Invite = (message: string) => string | null

let invite: Invite = (message) =>
  typeof prompt === 'function' ? prompt(message) : null

export function regleInvite(i: Invite): void {
  invite = i
}

function demandeCle(motif: string): string | null {
  const saisie = invite(`Clé concepteur — ${motif}`)
  const cle = saisie?.trim() ?? ''
  if (!cle) return null
  retientCle(cle)
  return cle
}

/** Les en-têtes d'une écriture : ceux de l'appelant, plus la clé si on
 *  l'a (ou si on vient de l'obtenir). */
export function enTetesConcepteur(
  base: Record<string, string> = {},
  motif = 'elle protège les écritures du magasin partagé',
): Record<string, string> {
  const cle = cleEnPoche() ?? demandeCle(motif)
  return cle ? { ...base, [EN_TETE_CLE]: cle } : { ...base }
}

/** `fetch` pour une écriture du concepteur. Signature de `fetch` — seule
 *  différence : les `headers` doivent être un objet simple (c'est le cas
 *  de tous les appels du dépôt). */
export async function fetchConcepteur(
  url: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const envoie = (): Promise<Response> =>
    fetchImpl(url, { ...init, headers: enTetesConcepteur(init.headers ?? {}) })
  let r = await envoie()
  if (r.status === 401 || r.status === 403) {
    // clé absente ou fausse : on l'oublie, on la redemande une fois
    oublieCle()
    const cle = demandeCle(
      r.status === 401 ? 'le serveur la demande' : 'le serveur a refusé celle-ci',
    )
    if (cle) r = await envoie()
  }
  return r
}
