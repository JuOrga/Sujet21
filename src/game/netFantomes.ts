// LES FANTÔMES DU PALMARÈS, côté jeu (/api/fantomes) : la trace du détenteur
// de chaque record, à lire en entrant dans une salle, à proposer au rejeu
// depuis l'écran des records, et à ENVOYER quand on vient de prendre la tête
// du palmarès partagé. Tout échec réseau rend null : l'appelant garde ce
// qu'il a — le fantôme partagé est un plus, jamais une condition.

import { litFantomeDef, type CategorieFantome, type FantomeDef } from './fantome'
import { appelle } from './reseau'

const ENDPOINT = '/api/fantomes'

export interface MetaFantomePartage {
  nom: string
  litres: number
  temps: number
  quand: string
}

export interface SallePartagee {
  volume?: FantomeDef
  chrono?: FantomeDef
}

export type IndexFantomes = Record<string, { volume?: MetaFantomePartage; chrono?: MetaFantomePartage }>

function litMeta(brut: unknown): MetaFantomePartage | null {
  if (typeof brut !== 'object' || brut === null) return null
  const o = brut as Record<string, unknown>
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    nom: typeof o.nom === 'string' ? o.nom : '',
    litres: n(o.litres),
    temps: n(o.temps),
    quand: typeof o.quand === 'string' ? o.quand : '',
  }
}

export function litSallePartagee(brut: unknown): SallePartagee {
  if (typeof brut !== 'object' || brut === null) return {}
  const o = brut as Record<string, unknown>
  const out: SallePartagee = {}
  const v = litFantomeDef(o.volume)
  const c = litFantomeDef(o.chrono)
  if (v) out.volume = v
  if (c) out.chrono = c
  return out
}

export function litIndexFantomes(brut: unknown): IndexFantomes {
  if (typeof brut !== 'object' || brut === null) return {}
  const salles = (brut as { salles?: unknown }).salles
  if (typeof salles !== 'object' || salles === null) return {}
  const out: IndexFantomes = {}
  for (const [code, e] of Object.entries(salles as Record<string, unknown>)) {
    if (typeof e !== 'object' || e === null) continue
    const s = e as Record<string, unknown>
    const volume = litMeta(s.volume)
    const chrono = litMeta(s.chrono)
    if (!volume && !chrono) continue
    out[code] = {}
    if (volume) out[code].volume = volume
    if (chrono) out[code].chrono = chrono
  }
  return out
}

/** Les fantômes partagés d'une salle — null : pas de réseau. */
export async function fetchFantomesPartages(code: string): Promise<SallePartagee | null> {
  try {
    const r = await appelle(`${ENDPOINT}?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
    if (!r.ok) return null
    return litSallePartagee(await r.json())
  } catch {
    return null
  }
}

/** L'index : par salle, qui tient le volume et le chrono — null : pas de réseau. */
export async function fetchIndexFantomes(): Promise<IndexFantomes | null> {
  try {
    const r = await appelle(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    return litIndexFantomes(await r.json())
  } catch {
    return null
  }
}

/** Propose une trace au palmarès. Le serveur ne la garde que si elle bat
 *  celle en place. Renvoie `garde` (et la salle à jour), ou null sans réseau. */
export async function pushFantomePartage(
  code: string,
  cat: CategorieFantome,
  fantome: FantomeDef,
): Promise<{ garde: boolean; salle: SallePartagee } | null> {
  try {
    const r = await appelle(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, cat, fantome }),
    })
    if (!r.ok) return null
    const data = (await r.json()) as { garde?: unknown; salle?: unknown }
    return { garde: data.garde === true, salle: litSallePartagee(data.salle) }
  } catch {
    return null
  }
}
