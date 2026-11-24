// LES CRÉATIONS, côté jeu : les appels à /api/creations et le JETON
// D'AUTEUR de ce poste.
//
// Le jeton est tiré au hasard à la première publication et rangé sur le
// poste ; le serveur n'en garde que l'empreinte. C'est lui, et lui seul,
// qui permet de retoucher ou de retirer ses salles — sans compte. Le
// perdre (navigateur vidé), c'est perdre la main sur ses salles en ligne :
// elles restent jouables, mais plus modifiables. C'est pourquoi il se
// range DANS LE COFFRE de l'emplacement (game/clesAtelier.ts), avec les
// salles de l'atelier : il suit la partie, l'export et le Steam Cloud.
//
// Tous les appels passent par la cloison réseau (reseau.ts) et savent
// échouer en silence : hors ligne, ils rendent null.

import { appelle } from './reseau'
import { CLE_JETON_AUTEUR, CLE_MES_CREATIONS } from './clesAtelier'

const ENDPOINT = '/api/creations'
const CLE_JETON = CLE_JETON_AUTEUR
const CLE_MIENNES = CLE_MES_CREATIONS

interface StockageMin {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
}

/** Le stockage branché par main.ts : la façade du coffre. */
let stockageBranche: StockageMin | null = null

/** Branche le jeton et « Mes créations » sur le coffre de l'emplacement. */
export function brancheStockageCreations(s: StockageMin | null): void {
  stockageBranche = s
}

function stockage(): StockageMin | null {
  if (stockageBranche) return stockageBranche
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Le jeton d'auteur de ce poste — tiré et rangé au premier appel. */
export function jetonAuteur(s: StockageMin | null = stockage()): string {
  try {
    const deja = s?.getItem(CLE_JETON)
    if (deja && /^[A-Za-z0-9_-]{32,128}$/.test(deja)) return deja
  } catch {
    // stockage refusé : un jeton pour la session
  }
  const octets = new Uint8Array(24)
  crypto.getRandomValues(octets)
  const jeton = [...octets].map((o) => o.toString(16).padStart(2, '0')).join('')
  try {
    s?.setItem(CLE_JETON, jeton)
  } catch {
    // la session seule
  }
  return jeton
}

/** Les identifiants des salles publiées depuis ce poste (« Mes créations »). */
export function mesCreations(s: StockageMin | null = stockage()): string[] {
  try {
    const brut = JSON.parse(s?.getItem(CLE_MIENNES) ?? '[]') as unknown
    return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function noteMienne(id: string, garder: boolean, s: StockageMin | null = stockage()): void {
  const liste = mesCreations(s).filter((x) => x !== id)
  if (garder) liste.unshift(id)
  try {
    s?.setItem(CLE_MIENNES, JSON.stringify(liste))
  } catch {
    // la session seule
  }
}

// ---- LES FORMES (celles que sert api/_creations.ts) ----------------------------

export interface Meilleur {
  nom: string
  litres: number
  temps: number
}

export interface CreationListee {
  id: string
  code: string
  nom: string
  auteur: string
  creeLe: string
  majLe: string
  empreinte: string
  meilleur?: Meilleur
}

export interface LigneRecord extends Meilleur {
  quand: string
}

export interface RecordsCreation {
  empreinte: string
  volume: LigneRecord[]
  chrono: LigneRecord[]
}

export interface CreationComplete extends CreationListee {
  /** La salle, son code posé : à passer à parseLevel. */
  salle: Record<string, unknown>
}

/** Le dernier refus du serveur, en clair (« la liste est pleine »…) :
 *  « injoignable » et « refusé » ne se soignent pas de la même façon. */
let derniereRaison = ''
export function raisonCreation(): string {
  return derniereRaison
}

async function json<T>(r: Response): Promise<T | null> {
  if (r.ok) {
    derniereRaison = ''
    return (await r.json()) as T
  }
  try {
    const c = (await r.json()) as { error?: unknown }
    derniereRaison = typeof c.error === 'string' ? c.error : `HTTP ${r.status}`
  } catch {
    derniereRaison = `HTTP ${r.status}`
  }
  return null
}

async function poste<T>(corps: object): Promise<T | null> {
  try {
    const r = await appelle(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
    return await json<T>(r)
  } catch {
    derniereRaison = ''
    return null
  }
}

// ---- LES APPELS ------------------------------------------------------------------

/** La liste de l'écran CRÉATIONS, la plus récente d'abord. */
export async function fetchCreations(): Promise<CreationListee[] | null> {
  try {
    const r = await appelle(ENDPOINT, { cache: 'no-store' })
    const c = await json<{ creations: CreationListee[] }>(r)
    return c ? c.creations : null
  } catch {
    return null
  }
}

/** Une création, prête à jouer, et ses records. */
export async function fetchCreation(
  id: string,
): Promise<{ creation: CreationComplete; records: RecordsCreation } | null> {
  try {
    const r = await appelle(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
    return await json(r)
  } catch {
    return null
  }
}

export interface Publication {
  id: string
  code: string
  empreinte: string
  records: RecordsCreation
  retouches?: string[]
}

/** Publie une salle (ou, avec `id`, la retouche) une fois sa sortie
 *  atteinte par son auteur : `essai` est cette partie. */
export async function publieCreation(
  salle: object,
  auteur: string,
  essai: { litres: number; temps: number },
  id?: string,
): Promise<Publication | null> {
  const p = await poste<Publication>({ action: 'publier', salle, auteur, essai, jeton: jetonAuteur(), id })
  if (p) noteMienne(p.id, true)
  return p
}

/** Dépose une partie dans les records d'une création. */
export async function deposeRecordCreation(
  id: string,
  empreinte: string,
  nom: string,
  litres: number,
  temps: number,
): Promise<{ ameliore: boolean; records: RecordsCreation } | null> {
  return poste({ action: 'record', id, empreinte, nom, litres, temps })
}

/** Retire une de ses salles. */
export async function retireCreation(id: string): Promise<boolean> {
  try {
    const r = await appelle(`${ENDPOINT}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-jeton-auteur': jetonAuteur() },
    })
    const ok = (await json(r)) !== null
    if (ok) noteMienne(id, false)
    return ok
  } catch {
    return false
  }
}
