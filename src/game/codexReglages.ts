// LES RÉGLAGES D'UNE FICHE DU CODEX, tenus par le concepteur : la MÉMOIRE
// qu'elle rapporte à la découverte, sa RARETÉ, et sa VIDÉO envoyée depuis
// l'atelier. Le code ne porte que les défauts — dix de mémoire, rareté
// normale, vidéo du dossier public/assets/codex — et le magasin partagé
// (/api/codex, Vercel Blob) porte les écarts : un réglage vaut pour tous
// les concepteurs et tous les joueurs, sans passer par le dépôt.
//
// LA RÈGLE DE REPLI vaut celle des textes : sans réseau, sans magasin, ou
// devant un réglage abîmé, la fiche retombe sur ses défauts. Un joueur
// hors-ligne gagne dix de mémoire, jamais zéro, jamais une fiche muette.
//
// Ce module ne touche pas au DOM : la partie pure se teste, la partie
// réseau (fetch…) rend null sur tout échec — l'appelant garde ce qu'il a.

export type RareteFiche = 'normale' | 'rare' | 'legendaire'

/** Les raretés, dans l'ordre de l'atelier. Toutes les fiches naissent
 *  « normale » ; le concepteur trie ensuite, fiche par fiche. */
export const RARETES: readonly { id: RareteFiche; nom: string; teinte: string }[] = [
  { id: 'normale', nom: 'NORMALE', teinte: '#9fc3d6' },
  { id: 'rare', nom: 'RARE', teinte: '#63b7e6' },
  { id: 'legendaire', nom: 'LÉGENDAIRE', teinte: '#ffd24a' },
]

export interface ReglageFiche {
  /** la mémoire gravée à la découverte — 0 : la fiche ne rapporte rien */
  memoire: number
  rarete: RareteFiche
  /** l'URL de la vidéo envoyée depuis l'atelier — vide : celle du dossier */
  video: string
  auteur: string
  date: string
}

export type ReglagesCodex = Record<string, ReglageFiche>

export const MEMOIRE_DEFAUT = 10
export const MEMOIRE_MAX = 500
export const REGLAGE_DEFAUT: Readonly<ReglageFiche> = {
  memoire: MEMOIRE_DEFAUT,
  rarete: 'normale',
  video: '',
  auteur: '',
  date: '',
}

export function rareteDef(id: string): (typeof RARETES)[number] {
  return RARETES.find((r) => r.id === id) ?? RARETES[0]
}

/** Un réglage tel qu'il arrive (magasin, formulaire) : chaque champ absent
 *  ou abîmé retombe sur son défaut — jamais de fiche à mémoire NaN. */
export function litReglage(brut: unknown): ReglageFiche {
  if (typeof brut !== 'object' || brut === null) return { ...REGLAGE_DEFAUT }
  const p = brut as Record<string, unknown>
  const m = Number(p.memoire)
  const memoire = Number.isFinite(m)
    ? Math.max(0, Math.min(MEMOIRE_MAX, Math.round(m)))
    : MEMOIRE_DEFAUT
  const rarete = RARETES.some((r) => r.id === p.rarete)
    ? (p.rarete as RareteFiche)
    : 'normale'
  const video =
    typeof p.video === 'string' && /^https:\/\/[^\s"'<>]+$/.test(p.video)
      ? p.video
      : ''
  return {
    memoire,
    rarete,
    video,
    auteur: typeof p.auteur === 'string' ? p.auteur.slice(0, 40) : '',
    date: typeof p.date === 'string' ? p.date.slice(0, 40) : '',
  }
}

/** Le document du magasin : { fiches: { id → réglage } }. */
export function litReglages(data: unknown): ReglagesCodex {
  const out: ReglagesCodex = {}
  if (typeof data !== 'object' || data === null) return out
  const fiches = (data as { fiches?: unknown }).fiches
  if (typeof fiches !== 'object' || fiches === null) return out
  for (const [id, r] of Object.entries(fiches as Record<string, unknown>)) {
    if (!/^[a-z0-9-]{2,48}$/.test(id)) continue
    out[id] = litReglage(r)
  }
  return out
}

/** Le réglage EFFECTIF d'une fiche : celui du magasin, sinon les défauts. */
export function reglageDe(reglages: ReglagesCodex, id: string): ReglageFiche {
  return reglages[id] ?? { ...REGLAGE_DEFAUT }
}

/** Un réglage vaut-il ses défauts ? (rien à garder au magasin) */
export function estDefaut(r: ReglageFiche): boolean {
  return (
    r.memoire === REGLAGE_DEFAUT.memoire &&
    r.rarete === REGLAGE_DEFAUT.rarete &&
    r.video === ''
  )
}

// ---- LE RÉSEAU : le magasin partagé -----------------------------------------

const ENDPOINT = '/api/codex'

/** Les réglages du magasin — null : pas de réseau, on garde les défauts. */
export async function fetchReglagesCodex(): Promise<ReglagesCodex | null> {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    return litReglages(await r.json())
  } catch {
    return null
  }
}

export interface EnvoiVideo {
  type: string
  /** le fichier en base64 nu */
  data: string
}

/** Enregistre le réglage d'une fiche. `video` : un fichier à envoyer,
 *  'retirer' pour revenir à celle du dossier, absent pour ne pas y toucher.
 *  Renvoie le magasin à jour, ou null si l'envoi a échoué. */
export async function pushReglageCodex(
  id: string,
  reglage: { memoire: number; rarete: RareteFiche },
  auteur: string,
  video?: EnvoiVideo | 'retirer',
): Promise<ReglagesCodex | null> {
  try {
    const corps: Record<string, unknown> = { id, memoire: reglage.memoire, rarete: reglage.rarete, auteur }
    if (video === 'retirer') corps.retirerVideo = true
    else if (video) corps.video = video
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
    if (!r.ok) return null
    return litReglages(await r.json())
  } catch {
    return null
  }
}

/** Rétablit les défauts d'une fiche (et retire sa vidéo envoyée). */
export async function deleteReglageCodex(id: string): Promise<ReglagesCodex | null> {
  try {
    const r = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!r.ok) return null
    return litReglages(await r.json())
  } catch {
    return null
  }
}

/** Le poids maximal d'une vidéo envoyée : le corps d'une fonction Vercel
 *  plafonne à 4,5 Mo et le base64 grossit d'un tiers — 3 Mo de fichier
 *  passent, et une boucle de six secondes en VP9 pèse dix fois moins. */
export const VIDEO_MAX_OCTETS = 3_000_000
export const VIDEO_TYPES: Record<string, string> = {
  'video/webm': '.webm',
  'video/mp4': '.mp4',
}

/** Lit un fichier vidéo pour l'envoi — null : type inconnu ou trop lourd. */
export function litFichierVideo(f: { type: string; size: number }): string | null {
  if (!VIDEO_TYPES[f.type]) return null
  if (f.size <= 0 || f.size > VIDEO_MAX_OCTETS) return null
  return VIDEO_TYPES[f.type]
}
