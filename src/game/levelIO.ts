// Contrat d'échange des tableaux : JSON lisible, validé à l'entrée.
// C'est le format que produit l'éditeur et que relit le jeu — il doit rester
// simple à écrire à la main et impossible à charger cassé.

import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
  type LevelDef,
  type ObstacleBox,
  type SpongeDef,
  type WorldLabel,
  type ZoneDef,
  type ZoneForce,
} from './level'

export const MATERIALS = [
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
] as const

const FORCES: ZoneForce[] = ['libre', 'eau', 'glace', 'vapeur']
const TONES: WorldLabel['tone'][] = [
  'mur',
  'phile',
  'phobe',
  'eponge',
  'froid',
  'grille',
  'sas',
  'chaud',
]

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** Boîte normalisée : min toujours inférieur à max, matériau connu. */
function readBox(o: Record<string, unknown>): ObstacleBox | null {
  const minX = num(o.minX)
  const maxX = num(o.maxX)
  const minY = num(o.minY)
  const maxY = num(o.maxY)
  const material = num(o.material, MAT_WALL)
  if (!MATERIALS.includes(material as (typeof MATERIALS)[number])) return null
  // Normaliser AVANT de juger la taille : une boîte tracée de droite à gauche
  // est parfaitement valide, elle est seulement à l'envers.
  const box = {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
    material,
  }
  if (box.maxX - box.minX < 1 || box.maxY - box.minY < 1) return null
  return box
}

function readSponge(o: Record<string, unknown>): SpongeDef | null {
  const cols = Math.round(num(o.cols))
  const rows = Math.round(num(o.rows))
  if (cols < 1 || rows < 1) return null
  return {
    minX: num(o.minX),
    minY: num(o.minY),
    cols,
    rows,
    cellSize: Math.max(4, num(o.cellSize, 24)),
    capacityPerCell: Math.max(1, Math.round(num(o.capacityPerCell, 5))),
  }
}

function readZone(o: Record<string, unknown>): ZoneDef | null {
  const minX = num(o.minX)
  const maxX = num(o.maxX)
  const minY = num(o.minY)
  const maxY = num(o.maxY)
  const force = str(o.force, 'libre') as ZoneForce
  const zone = {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
    force: FORCES.includes(force) ? force : 'libre',
    label: str(o.label) || undefined,
  }
  if (zone.maxX - zone.minX < 1 || zone.maxY - zone.minY < 1) return null
  return zone
}

function readLabel(o: Record<string, unknown>): WorldLabel | null {
  const text = str(o.text).slice(0, 40)
  if (!text) return null
  const tone = str(o.tone, 'mur') as WorldLabel['tone']
  return {
    x: num(o.x),
    y: num(o.y),
    text,
    tone: TONES.includes(tone) ? tone : 'mur',
  }
}

/**
 * Relit un tableau depuis du JSON. Renvoie le tableau et la liste des rejets
 * (une pièce mal formée est écartée, elle n'empêche pas de charger le reste).
 */
export function parseLevel(input: unknown): { level: LevelDef | null; rejets: string[] } {
  const rejets: string[] = []
  if (typeof input !== 'object' || input === null) {
    return { level: null, rejets: ['le document n’est pas un objet JSON'] }
  }
  const o = input as Record<string, unknown>
  const b = (o.bounds ?? {}) as Record<string, unknown>
  const bounds = {
    minX: num(b.minX, -1200),
    minY: num(b.minY, -750),
    maxX: num(b.maxX, 1200),
    maxY: num(b.maxY, 750),
  }
  if (bounds.maxX - bounds.minX < 200 || bounds.maxY - bounds.minY < 200) {
    return { level: null, rejets: ['la cuve est trop petite (200 u minimum de côté)'] }
  }

  const sp = (o.spawn ?? {}) as Record<string, unknown>
  const ex = (o.exit ?? {}) as Record<string, unknown>

  const boxes: ObstacleBox[] = []
  for (const raw of Array.isArray(o.boxes) ? o.boxes : []) {
    const box = readBox((raw ?? {}) as Record<string, unknown>)
    if (box) boxes.push(box)
    else rejets.push('une surface a été écartée (matériau inconnu ou taille nulle)')
  }

  const sponges: SpongeDef[] = []
  for (const raw of Array.isArray(o.sponges) ? o.sponges : []) {
    const s = readSponge((raw ?? {}) as Record<string, unknown>)
    if (s) sponges.push(s)
    else rejets.push('une éponge a été écartée (grille vide)')
  }

  const zones: ZoneDef[] = []
  for (const raw of Array.isArray(o.zones) ? o.zones : []) {
    const z = readZone((raw ?? {}) as Record<string, unknown>)
    if (z) zones.push(z)
    else rejets.push('une zone a été écartée (taille nulle)')
  }

  const labels: WorldLabel[] = []
  for (const raw of Array.isArray(o.labels) ? o.labels : []) {
    const l = readLabel((raw ?? {}) as Record<string, unknown>)
    if (l) labels.push(l)
    else rejets.push('une étiquette a été écartée (texte vide)')
  }

  const level: LevelDef = {
    name: str(o.name, 'Sans titre').slice(0, 60),
    code: str(o.code, '21-?').slice(0, 16),
    journal: str(o.journal, ''),
    figure: str(o.figure) || undefined,
    bounds,
    spawn: {
      x: num(sp.x, bounds.minX + 250),
      y: num(sp.y, 0),
      n: Math.max(50, Math.min(3000, Math.round(num(sp.n, 900)))),
    },
    exit: {
      minX: num(ex.minX, bounds.maxX - 160),
      minY: num(ex.minY, -120),
      maxX: num(ex.maxX, bounds.maxX - 20),
      maxY: num(ex.maxY, 120),
    },
    boxes,
    sponges,
    labels,
    zones: zones.length > 0 ? zones : undefined,
    par: o.par === undefined ? undefined : Math.max(1, Math.round(num(o.par, 3))),
    ambiance: str(o.ambiance) || undefined,
  }
  // Décals (tuyaux, vannes) : du décor pur — relus pour que le passage par
  // l'éditeur ne dépouille pas un tableau de sa machinerie peinte.
  const decals: NonNullable<LevelDef['decals']> = []
  for (const raw of Array.isArray(o.decals) ? o.decals : []) {
    const d = (raw ?? {}) as Record<string, unknown>
    const kind = d.kind === 'vanne' ? 'vanne' : d.kind === 'tuyaux' ? 'tuyaux' : null
    const w = num(d.w, 0)
    const h = num(d.h, 0)
    if (!kind || w <= 0 || h <= 0) {
      rejets.push('un décal a été écarté (sorte inconnue ou taille nulle)')
      continue
    }
    decals.push({
      x: num(d.x, 0),
      y: num(d.y, 0),
      w,
      h,
      kind,
      flip: d.flip === true ? true : undefined,
      fade: typeof d.fade === 'number' && Number.isFinite(d.fade)
        ? Math.min(1, Math.max(0, d.fade))
        : undefined,
    })
  }
  if (decals.length > 0) level.decals = decals
  return { level, rejets }
}

/** JSON indenté, champs vides omis — un fichier qu'on peut relire à l'œil. */
export function serializeLevel(level: LevelDef): string {
  const out: Record<string, unknown> = {
    name: level.name,
    code: level.code,
    journal: level.journal,
    par: level.par,
    bounds: level.bounds,
    spawn: level.spawn,
    exit: level.exit,
    boxes: level.boxes,
    sponges: level.sponges,
    labels: level.labels,
  }
  if (level.zones && level.zones.length > 0) out.zones = level.zones
  if (level.decals && level.decals.length > 0) out.decals = level.decals
  if (level.figure) out.figure = level.figure
  if (level.ambiance) out.ambiance = level.ambiance
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
  return JSON.stringify(out, null, 2)
}

export interface Verdict {
  niveau: 'erreur' | 'avertissement'
  message: string
}

/**
 * Garde-fous du level design, les mêmes que ceux des tableaux livrés : une
 * erreur rend le tableau injouable, un avertissement le rend douteux.
 */
export function checkLevel(level: LevelDef): Verdict[] {
  const v: Verdict[] = []
  const b = level.bounds
  const inBounds = (x: number, y: number): boolean =>
    x > b.minX && x < b.maxX && y > b.minY && y < b.maxY

  if (!inBounds(level.spawn.x, level.spawn.y)) {
    v.push({ niveau: 'erreur', message: 'Le point de départ est hors de la cuve.' })
  }
  for (const box of level.boxes) {
    const near =
      level.spawn.x > box.minX - 120 &&
      level.spawn.x < box.maxX + 120 &&
      level.spawn.y > box.minY - 120 &&
      level.spawn.y < box.maxY + 120
    if (near) {
      v.push({
        niveau: 'erreur',
        message: 'Le point de départ naît dans une surface (120 u de dégagement exigés).',
      })
      break
    }
  }

  const ex = level.exit
  if (ex.minX < b.minX || ex.maxX > b.maxX || ex.minY < b.minY || ex.maxY > b.maxY) {
    v.push({ niveau: 'erreur', message: 'Le sas déborde de la cuve.' })
  }
  if (ex.maxX - ex.minX < 40 || ex.maxY - ex.minY < 40) {
    v.push({ niveau: 'erreur', message: 'Le sas est trop petit (40 u minimum).' })
  }
  const cx = (ex.minX + ex.maxX) / 2
  if (Math.abs(cx - level.spawn.x) < 800) {
    v.push({
      niveau: 'avertissement',
      message: 'Le sas est à moins de 800 u du départ : il n’y a presque pas de traversée.',
    })
  }

  if (level.boxes.length + level.sponges.length === 0) {
    v.push({ niveau: 'avertissement', message: 'Le tableau est vide : aucun obstacle.' })
  }
  if (level.journal.trim().length < 40) {
    v.push({
      niveau: 'avertissement',
      message: 'L’entrée de journal fait moins de 40 caractères.',
    })
  }
  if (!level.labels.some((l) => l.tone === 'sas')) {
    v.push({ niveau: 'avertissement', message: 'Aucune étiquette ne désigne le sas.' })
  }

  // Une zone qui impose la vapeur sans radiateur, ou la glace sans hublot,
  // n'est pas fautive — mais elle mérite d'être signalée au concepteur.
  const hasChaud = level.boxes.some((x) => x.material === MAT_CHAUD)
  const hasFroid = level.boxes.some((x) => x.material === MAT_FROID)
  for (const z of level.zones ?? []) {
    if (z.force === 'vapeur' && !hasChaud) {
      v.push({
        niveau: 'avertissement',
        message: 'Une zone impose la vapeur alors qu’aucun radiateur n’en fournit.',
      })
      break
    }
  }
  for (const z of level.zones ?? []) {
    if (z.force === 'glace' && !hasFroid) {
      v.push({
        niveau: 'avertissement',
        message: 'Une zone impose la glace alors qu’aucun hublot froid n’en donne.',
      })
      break
    }
  }

  const grilleSansVapeur =
    level.boxes.some((x) => x.material === MAT_GRILLE) && !hasChaud &&
    !(level.zones ?? []).some((z) => z.force === 'vapeur')
  if (grilleSansVapeur) {
    v.push({
      niveau: 'avertissement',
      message: 'Une grille barre la route sans radiateur ni zone vapeur pour la franchir.',
    })
  }

  const chimie = level.boxes.some(
    (x) => x.material === MAT_HYDROPHILE || x.material === MAT_HYDROPHOBE,
  )
  if (!chimie && level.sponges.length === 0 && level.boxes.length > 0) {
    v.push({
      niveau: 'avertissement',
      message: 'Aucune chimie ni éponge : les obstacles ne sont que de la géométrie.',
    })
  }

  return v
}
