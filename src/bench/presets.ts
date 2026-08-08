// Présets nommés du banc de réglage : un jeu de paramètres + un titre et une
// description. Enregistrés dans le localStorage du navigateur, et échangeables
// en JSON (le fichier embarque titre et description) pour comparer les
// réglages entre testeurs.

import type { SimParams } from '../sim/params'

export interface Preset {
  title: string
  description: string
  savedAt: string // ISO 8601
  params: Partial<SimParams>
}

const STORAGE_KEY = 'tension-de-surface-presets'
const DEFAULT_KEY = 'tension-de-surface-default'

// La bibliothèque partagée : les présets, plus le titre du préset appliqué
// par défaut au lancement du jeu (commun à tous les testeurs).
export interface SharedLibrary {
  presets: Preset[]
  defaultTitle: string | null
}

// Ne copie que les valeurs numériques connues : un fichier étranger ou une
// vieille version ne peut pas injecter n'importe quoi dans les paramètres.
export function copyParams(from: Partial<SimParams>, into: SimParams): void {
  for (const key of Object.keys(into) as (keyof SimParams)[]) {
    const value = from[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      into[key] = value
    }
  }
}

export function serializePreset(preset: Preset): string {
  return JSON.stringify(preset, null, 2)
}

// Accepte le format préset ({ title, description, params }) et, pour
// compatibilité, l'ancien export à plat (l'objet params directement).
export function parsePresetFile(json: string): Preset {
  const parsed = JSON.parse(json) as Record<string, unknown>
  if (parsed && typeof parsed.params === 'object' && parsed.params !== null) {
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      params: parsed.params as Partial<SimParams>,
    }
  }
  return { title: '', description: '', savedAt: '', params: parsed as Partial<SimParams> }
}

// Enregistre ou remplace : le titre est l'identifiant du préset.
export function upsertPreset(list: Preset[], preset: Preset): Preset[] {
  const kept = list.filter((p) => p.title !== preset.title)
  return [...kept, preset].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export function removePreset(list: Preset[], title: string): Preset[] {
  return list.filter((p) => p.title !== title)
}

function isPresetLike(p: unknown): p is Preset {
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof (p as Preset).title === 'string' &&
    typeof (p as Preset).params === 'object'
  )
}

export function loadStoredPresets(): Preset[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPresetLike)
  } catch {
    return []
  }
}

// ---- Bibliothèque partagée entre testeurs (API /api/presets) ----
// En dev local (vite sans backend), ces appels échouent : le banc retombe
// alors silencieusement en mode localStorage seul.

// Relit le document partagé : nouveau format { presets, defaultTitle } ou,
// pour compatibilité, l'ancien format « tableau de présets » (sans défaut).
export function parseSharedPayload(data: unknown): SharedLibrary {
  if (Array.isArray(data)) {
    return { presets: data.filter(isPresetLike), defaultTitle: null }
  }
  if (data !== null && typeof data === 'object' && Array.isArray((data as SharedLibrary).presets)) {
    const lib = data as { presets: unknown[]; defaultTitle?: unknown }
    return {
      presets: lib.presets.filter(isPresetLike),
      defaultTitle: typeof lib.defaultTitle === 'string' && lib.defaultTitle ? lib.defaultTitle : null,
    }
  }
  return { presets: [], defaultTitle: null }
}

export async function fetchSharedPresets(): Promise<SharedLibrary> {
  const r = await fetch('/api/presets', { cache: 'no-store' })
  if (!r.ok) throw new Error(`bibliothèque partagée : ${r.status}`)
  return parseSharedPayload((await r.json()) as unknown)
}

// Définit (ou retire, avec null) le préset par défaut pour tous les testeurs.
export async function setSharedDefault(title: string | null): Promise<void> {
  const r = await fetch('/api/presets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ defaultTitle: title }),
  })
  if (!r.ok) throw new Error(`bibliothèque partagée : ${r.status}`)
}

// Cache local du préset par défaut : appliqué immédiatement au lancement,
// avant (et sans) la réponse de la bibliothèque partagée.
export function loadStoredDefault(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(DEFAULT_KEY) || null
}

export function storeStoredDefault(title: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (title) localStorage.setItem(DEFAULT_KEY, title)
  else localStorage.removeItem(DEFAULT_KEY)
}

export async function pushSharedPreset(preset: Preset): Promise<void> {
  const r = await fetch('/api/presets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(preset),
  })
  if (!r.ok) throw new Error(`bibliothèque partagée : ${r.status}`)
}

export async function deleteSharedPreset(title: string): Promise<void> {
  const r = await fetch(`/api/presets?title=${encodeURIComponent(title)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`bibliothèque partagée : ${r.status}`)
}

// Fusion locale + partagée : un préset par titre, le plus récent gagne.
export function mergePresets(local: Preset[], shared: Preset[]): Preset[] {
  const byTitle = new Map<string, Preset>()
  for (const p of [...local, ...shared]) {
    const cur = byTitle.get(p.title)
    if (!cur || (p.savedAt || '') > (cur.savedAt || '')) byTitle.set(p.title, p)
  }
  return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

export function storePresets(list: Preset[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}
