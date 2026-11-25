// LA CLÉ CONCEPTEUR, côté poste : où elle se range, comment elle part.
//
// Le serveur refuse désormais toute écriture dans ce que tout le monde
// joue sans une clé (api/_cle.ts). Le concepteur la saisit UNE fois dans
// la régie ; elle se range sur ce poste et la cloison réseau (reseau.ts)
// la pose sur chaque écriture. Rien d'autre ne la voit passer.
//
// Elle se range à part du coffre des sauvegardes, exprès : une clé n'est
// pas une partie — elle ne doit ni voyager dans un emplacement que le
// Steam Cloud synchronise, ni partir dans l'export d'une sauvegarde.

import { appelle, reseau } from './reseau'

const CLE_STOCKAGE = 'sujet21.cleConcepteur'

interface StockageMin {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
  removeItem(cle: string): void
}

function stockage(): StockageMin | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null // stockage refusé (navigation privée stricte) : la session seule
  }
}

/** Au démarrage : la clé rangée sur ce poste rejoint la cloison réseau. */
export function chargeCle(s: StockageMin | null = stockage()): string {
  let cle = ''
  try {
    cle = s?.getItem(CLE_STOCKAGE)?.trim() ?? ''
  } catch {
    cle = ''
  }
  reseau.cle = cle
  return cle
}

/** Range (ou, vide, oublie) la clé de ce poste — et la pose aussitôt. */
export function rangeCle(cle: string, s: StockageMin | null = stockage()): void {
  const propre = cle.trim()
  reseau.cle = propre
  try {
    if (propre) s?.setItem(CLE_STOCKAGE, propre)
    else s?.removeItem(CLE_STOCKAGE)
  } catch {
    // stockage refusé : la clé vaut pour cette session seulement
  }
}

/** Une clé est-elle posée sur ce poste ? */
export function clePosee(): boolean {
  return reseau.cle !== ''
}

export type EtatCle =
  | { etat: 'reconnue'; nom: string }
  | { etat: 'absente' }
  | { etat: 'refusee'; raison: string }
  | { etat: 'serveur-sans-cle'; raison: string }
  | { etat: 'injoignable' }

/** Demande au serveur si la clé posée passe — sans rien écrire. La
 *  question part en GET (lecture) : la clé y est donc jointe à la main. */
export async function verifieCle(): Promise<EtatCle> {
  if (!reseau.cle) return { etat: 'absente' }
  try {
    const r = await appelle('/api/reglages?verifie=cle', {
      cache: 'no-store',
      headers: { 'x-cle-concepteur': reseau.cle },
    })
    const corps = (await r.json().catch(() => ({}))) as { ok?: unknown; nom?: unknown; error?: unknown }
    const raison = typeof corps.error === 'string' ? corps.error : `HTTP ${r.status}`
    // un 200 ne suffit pas : sans API derrière (serveur de dev), la page
    // d'accueil répond 200 à tout — seul le « ok: true » du serveur compte
    if (r.ok && corps.ok === true) {
      return { etat: 'reconnue', nom: typeof corps.nom === 'string' ? corps.nom : '' }
    }
    if (r.status === 503) return { etat: 'serveur-sans-cle', raison }
    if (r.status === 401) return { etat: 'refusee', raison }
    return { etat: 'injoignable' }
  } catch {
    return { etat: 'injoignable' }
  }
}
