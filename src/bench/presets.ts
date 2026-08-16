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
const HIDDEN_KEY = 'tension-de-surface-presets-masques'

// ---- Présets LIVRÉS avec le banc ----------------------------------------
// Sept manières de sentir le même fluide. Chacun est une intention de jeu,
// pas un simple jeu de curseurs — la description dit quoi chercher à la
// manette. savedAt vide : si un testeur enregistre un préset du même titre,
// SA version gagne la fusion (le livré s'efface poliment).
export const BUILTIN_PRESETS: Preset[] = [
  {
    title: '⚙ Tempo nerveux',
    description:
      'Le ressenti du ×2 sans accélérer le temps : attentes divisées par deux (gel, dégel, vapeur, réabsorption), corps prompt à se reformer, caméra plus vive. L’éjection à 1800 est le PLAFOND mesuré au mur mince — au-delà, les gouttes traversent les parois. Le chrono, lui, reste honnête : records comparables.',
    savedAt: '',
    params: {
      freezeTime: 0.7,
      thawTime: 1.4,
      boilTime: 0.7,
      vaporizeTime: 0.3,
      condenseTime: 0.5,
      freezeSelfTime: 0.25,
      vortexDuration: 1.0,
      reabsorbCooldown: 0.7,
      regroupAccel: 1200,
      regroupDamp: 8,
      condenseRegroup: 700,
      exitPull: 480,
      cameraSmoothing: 4,
      ejectSpeed: 1800,
      gasDashSpeed: 1050,
      speedColorScale: 280,
    },
  },
  {
    title: '⚙ Sirop de cuve',
    description:
      'L’eau devient épaisse et pensive : chaque impulsion se prépare, les gouttes molles retombent souvent dans la flaque — et reviennent (⟳ au HUD). Le nuage de vapeur rampe au lieu de fuser. Pour les tableaux-casse-tête et la contemplation, pas pour le chrono.',
    savedAt: '',
    params: {
      xsphC: 0.55,
      ejectSpeed: 950,
      ejectRate: 24,
      regroupAccel: 480,
      regroupDamp: 4,
      cameraSmoothing: 1.6,
      freezeTime: 1.8,
      thawTime: 3.4,
      gasDrag: 2.2,
      gasExpand: 180,
      gasTurb: 60,
      reabsorbCooldown: 1.6,
      speedColorScale: 160,
    },
  },
  {
    title: '⚙ Champagne',
    description:
      'Tout pétille : tirs en rafale fine, transformations éclair, nuage turbulent qui se tord. La réabsorption pardonne (0,4 s — les maladresses reviennent vite), mais ÊTRE vapeur coûte plus cher : on bascule souvent, on ne s’attarde pas.',
    savedAt: '',
    params: {
      ejectRate: 48,
      ejectSpeed: 1300,
      reabsorbCooldown: 0.4,
      vaporizeTime: 0.25,
      condenseTime: 0.5,
      gasExpand: 400,
      gasTurb: 260,
      gasDrag: 1.0,
      gasIdleLossRate: 3,
      gasDashExhaust: 0.2,
      regroupAccel: 900,
      vortexSwirl: 2.2,
      vortexDuration: 1.2,
    },
  },
  {
    title: '⚙ Protocole d’austérité',
    description:
      'Chaque goutte compte double : réabsorption lente (2,4 s — une goutte lâchée reste longtemps en danger), péage de vaporisation à 30 %, vapeur qui s’évapore vite, souffle de dash à 25 %, rosée avare. Pour les pilotes qui veulent finir un tableau à la goutte près.',
    savedAt: '',
    params: {
      reabsorbCooldown: 2.4,
      vaporTollFrac: 0.3,
      gasIdleLossRate: 4,
      gasDashExhaust: 0.25,
      grilleGasLoss: 0.5,
      ejectRate: 26,
      recondRate: 2,
      recondFraction: 0.35,
    },
  },
  {
    title: '⚙ Ballet orbital',
    description:
      'Tout glisse et orbite : les rebonds portent, le vortex danse longtemps, le sas enroule en spirale large, la caméra respire. Le jeu au ralenti SANS toucher au temps — la lenteur vient des forces, pas de l’horloge.',
    savedAt: '',
    params: {
      regroupAccel: 380,
      regroupDamp: 3,
      maxSpeed: 2000,
      ejectSpeed: 1100,
      gasDrag: 0.7,
      gasTurb: 70,
      vortexDuration: 2.6,
      vortexSwirl: 2.4,
      vortexPull: 320,
      vortexDrag: 3,
      exitSwirl: 2.0,
      cameraSmoothing: 1.4,
      iceRestitution: 0.7,
      speedColorScale: 180,
    },
  },
  {
    title: '⚙ Palet de match',
    description:
      'La glace est reine : gel quasi instantané, dégel express près des sources chaudes, rebonds francs comme un palet de hockey — et les surfaces hydrophobes deviennent des bumpers de flipper. Pensé pour les tableaux-billards et les trajectoires à une bande.',
    savedAt: '',
    params: {
      freezeTime: 0.6,
      freezeSelfTime: 0.2,
      thawTime: 1.8,
      heatThawTime: 0.25,
      iceRestitution: 0.92,
      hydrophobeIceRestitution: 1.35,
      hydrophobeIceKick: 340,
      hydrophileIceDrag: 2.4,
      reabsorbCooldown: 1.0,
    },
  },
  {
    title: '⚙ Geyser',
    description:
      'La vapeur est la voie royale : bascule éclair, dashs puissants au souffle réduit (10 %), coût d’état allégé, rosée généreuse aux parois froides. À l’inverse de l’austérité — pour apprendre à VIVRE en nuage avant d’en payer le vrai prix.',
    savedAt: '',
    params: {
      vaporizeTime: 0.25,
      condenseTime: 0.45,
      boilTime: 0.8,
      gasDashSpeed: 1150,
      gasDashExhaust: 0.1,
      gasDashExhaustSpeed: 0.9,
      gasIdleLossRate: 1.2,
      recondRate: 7,
      gasExpand: 300,
      condenseRegroup: 600,
    },
  },
]

// Présets livrés masqués par le testeur (supprimés au banc) : on retient les
// titres, sinon la suppression ne survivrait pas au rechargement — le livré
// reviendrait à chaque lancement, indestructible.
export function loadHiddenBuiltins(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

export function hideBuiltin(title: string): void {
  if (typeof localStorage === 'undefined') return
  if (!BUILTIN_PRESETS.some((p) => p.title === title)) return
  const hidden = loadHiddenBuiltins()
  if (!hidden.includes(title)) localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden, title]))
}

// Les présets livrés effectivement visibles sur cet appareil.
export function builtinPresets(): Preset[] {
  const hidden = loadHiddenBuiltins()
  return BUILTIN_PRESETS.filter((p) => !hidden.includes(p.title))
}

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
