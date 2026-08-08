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

export async function fetchSharedPresets(): Promise<Preset[]> {
  const r = await fetch('/api/presets', { cache: 'no-store' })
  if (!r.ok) throw new Error(`bibliothèque partagée : ${r.status}`)
  const data = (await r.json()) as unknown
  if (!Array.isArray(data)) return []
  return data.filter(isPresetLike)
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
