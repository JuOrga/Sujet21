// Contrat d'échange des tableaux : JSON lisible, validé à l'entrée.
// C'est le format que produit l'éditeur et que relit le jeu — il doit rester
// simple à écrire à la main et impossible à charger cassé.

import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
  LAMPE_COULEUR_DEFAUT,
  LAMPE_HAUTEUR_DEFAUT,
  LAMPE_HAUTEUR_MAX,
  LAMPE_HAUTEUR_MIN,
  lampeCouleurRVB,
  type LevelDef,
  type LumiereDef,
  type ObstacleBox,
  type SpongeDef,
  type WorldLabel,
  type CibleDef,
  type LaserDef,
  type PorteDef,
  type RailDef,
  type ZoneDef,
  type ZoneForce,
} from './level'
import { MAX_BOXES, MAX_LUMIERES, MAX_ZONES } from '../render/renderer'
import { ARC_EPAISSEUR_DEFAUT, ARC_OUVERTURE_DEFAUT, FORME_ARC, FORME_COIN, FORME_RECT } from './formes'

export const MATERIALS = [
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
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
  const angle = num(o.angle, 0)
  // aura : portée de chauffe propre à une chaudière (multiplicateur borné)
  const aura = num(o.aura, 1)
  // skin : habillage d'une paroi neutre (décor pur, physique inchangée)
  const skin = Math.round(num(o.skin, 0))
  // forme : rectangle si absente (formes.ts) — clé effacée au défaut, comme
  // angle/aura/skin ; les paramètres ne survivent que pour la forme concernée
  const forme = Math.round(num(o.forme, FORME_RECT))
  const p0 = num(o.p0, forme === FORME_ARC ? ARC_EPAISSEUR_DEFAUT : 0)
  const p1 = num(o.p1, ARC_OUVERTURE_DEFAUT)
  const box: ObstacleBox = {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
    ...(angle ? { angle: Math.max(-180, Math.min(180, angle)) } : {}),
    ...(aura !== 1 && material === MAT_CHAUD ? { aura: Math.max(0.25, Math.min(4, aura)) } : {}),
    ...(skin > 0 && material === MAT_WALL && forme === FORME_RECT ? { skin: Math.min(8, skin) } : {}),
    ...(forme > FORME_RECT && forme <= FORME_ARC ? { forme } : {}),
    ...(forme === FORME_COIN && Math.round(p0) !== 0
      ? { p0: ((Math.round(p0) % 4) + 4) % 4 }
      : {}),
    ...(forme === FORME_ARC && p0 !== ARC_EPAISSEUR_DEFAUT
      ? { p0: Math.max(0.08, Math.min(1, p0)) }
      : {}),
    ...(forme === FORME_ARC && p1 !== ARC_OUVERTURE_DEFAUT
      ? { p1: Math.max(15, Math.min(180, p1)) }
      : {}),
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
    // déclencheurs à l'entrée du corps : cinématique et/ou séquence in-map
    cine: str(o.cine).trim().slice(0, 24) || undefined,
    sequence: str(o.sequence).trim().slice(0, 24) || undefined,
  }
  if (zone.maxX - zone.minX < 1 || zone.maxY - zone.minY < 1) return null
  return zone
}

function readLabel(o: Record<string, unknown>): WorldLabel | null {
  // les SAUTS DE LIGNE font partie du texte (une étiquette se compose sur
  // plusieurs lignes) ; les autres caractères de contrôle, non
  const text = str(o.text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .slice(0, 120)
    .trim()
  // Pictogramme d'état (bible v3.1) : sans texte, mais jamais sans rien —
  // une étiquette est soit un texte, soit un pictogramme, soit les deux
  const p = (o.picto ?? null) as Record<string, unknown> | null
  const note = (v: unknown): number => Math.max(0, Math.min(3, Math.round(num(v, 0))))
  const picto =
    p && /^#[0-9a-fA-F]{6}$/.test(str(p.couleur))
      ? { couleur: str(p.couleur), eau: note(p.eau), glace: note(p.glace), vapeur: note(p.vapeur) }
      : undefined
  if (!text && !picto) return null
  const tone = str(o.tone, 'mur') as WorldLabel['tone']
  return {
    x: num(o.x),
    y: num(o.y),
    text,
    tone: TONES.includes(tone) ? tone : 'mur',
    rang: str(o.rang) === 'secteur' ? 'secteur' : undefined,
    picto,
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
    ambiante: o.ambiante === undefined ? undefined : Math.max(0, Math.min(1, num(o.ambiante, 0.52))),
    dashBudget:
      o.dashBudget === undefined ? undefined : Math.max(0, Math.round(num(o.dashBudget, 3))),
    ambiance: str(o.ambiance) || undefined,
    raccourciVers: str(o.raccourciVers).slice(0, 16) || undefined,
    cineAvant: str(o.cineAvant).trim().slice(0, 24) || undefined,
    cineApres: str(o.cineApres).trim().slice(0, 24) || undefined,
    sequence: str(o.sequence).trim().slice(0, 24) || undefined,
  }
  // Décals (tuyaux, vannes) : du décor pur — relus pour que le passage par
  // l'éditeur ne dépouille pas un tableau de sa machinerie peinte.
  const decals: NonNullable<LevelDef['decals']> = []
  for (const raw of Array.isArray(o.decals) ? o.decals : []) {
    const d = (raw ?? {}) as Record<string, unknown>
    const SORTES = [
      'tuyaux',
      'vanne',
      'ecran-off',
      'ecran-on',
      'fiole-pleine',
      'fiole-vide',
    ] as const
    const kind = SORTES.find((s) => s === d.kind) ?? null
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

  // Mécanismes laser : émetteurs, cibles, portes asservies
  const lasers: LaserDef[] = []
  for (const raw of Array.isArray(o.lasers) ? o.lasers : []) {
    const l = (raw ?? {}) as Record<string, unknown>
    const angle = num(l.angle, NaN)
    if (!Number.isFinite(angle)) {
      rejets.push('un émetteur laser a été écarté (angle manquant)')
      continue
    }
    lasers.push({ x: num(l.x, 0), y: num(l.y, 0), angle: ((angle % 360) + 360) % 360 })
  }
  if (lasers.length > 0) level.lasers = lasers

  const cibles: CibleDef[] = []
  for (const raw of Array.isArray(o.cibles) ? o.cibles : []) {
    const c = (raw ?? {}) as Record<string, unknown>
    const cible: CibleDef = { x: num(c.x, 0), y: num(c.y, 0), r: Math.max(8, num(c.r, 26)) }
    // récepteur NOR (à maintien, la coupure scelle) — tout le reste est TOR
    if (c.mode === 'nor') cible.mode = 'nor'
    cibles.push(cible)
  }
  if (cibles.length > 0) level.cibles = cibles

  const portes: PorteDef[] = []
  for (const raw of Array.isArray(o.portes) ? o.portes : []) {
    const q = (raw ?? {}) as Record<string, unknown>
    const porte = {
      minX: Math.min(num(q.minX), num(q.maxX)),
      minY: Math.min(num(q.minY), num(q.maxY)),
      maxX: Math.max(num(q.minX), num(q.maxX)),
      maxY: Math.max(num(q.minY), num(q.maxY)),
      // négatif conservé : c'est le contrat d'une porte SCÉNARISÉE, que
      // seule une séquence in-map ouvre (voir PorteDef)
      cible: Math.max(-1, Math.round(num(q.cible, 0))),
    }
    if (porte.maxX - porte.minX < 1 || porte.maxY - porte.minY < 1) {
      rejets.push('une porte a été écartée (taille nulle)')
      continue
    }
    portes.push(porte)
  }
  if (portes.length > 0) level.portes = portes

  // Rails magnétiques : des polylignes d'au moins 2 points
  const rails: RailDef[] = []
  for (const raw of Array.isArray(o.rails) ? o.rails : []) {
    const r = (raw ?? {}) as Record<string, unknown>
    const pts: { x: number; y: number }[] = []
    for (const p of Array.isArray(r.points) ? r.points : []) {
      const q = (p ?? {}) as Record<string, unknown>
      pts.push({ x: num(q.x, 0), y: num(q.y, 0) })
    }
    if (pts.length < 2) {
      rejets.push('un rail magnétique a été écarté (moins de 2 points)')
      continue
    }
    rails.push({ points: pts })
  }
  if (rails.length > 0) level.rails = rails

  // Lampes : x, y obligatoires ; hauteur/portée/intensité bornées, clés
  // effacées au défaut (le fichier reste minimal)
  const lumieres: LumiereDef[] = []
  for (const raw of Array.isArray(o.lumieres) ? o.lumieres : []) {
    const l = (raw ?? {}) as Record<string, unknown>
    const h = num(l.h, LAMPE_HAUTEUR_DEFAUT)
    const portee = num(l.portee, 0)
    const intensite = num(l.intensite, 1)
    const couleur = str(l.couleur, '').toLowerCase()
    lumieres.push({
      x: num(l.x, 0),
      y: num(l.y, 0),
      ...(h !== LAMPE_HAUTEUR_DEFAUT
        ? { h: Math.max(LAMPE_HAUTEUR_MIN, Math.min(LAMPE_HAUTEUR_MAX, h)) }
        : {}),
      ...(portee > 0 ? { portee: Math.max(200, Math.min(8000, portee)) } : {}),
      ...(intensite !== 1 ? { intensite: Math.max(0.2, Math.min(2, intensite)) } : {}),
      ...(lampeCouleurRVB(couleur) && couleur !== LAMPE_COULEUR_DEFAUT ? { couleur } : {}),
    })
  }
  if (lumieres.length > 0) level.lumieres = lumieres

  return { level, rejets }
}

/** JSON indenté, champs vides omis — un fichier qu'on peut relire à l'œil. */
export function serializeLevel(level: LevelDef): string {
  const out: Record<string, unknown> = {
    name: level.name,
    code: level.code,
    journal: level.journal,
    par: level.par,
    ambiante: level.ambiante,
    dashBudget: level.dashBudget,
    bounds: level.bounds,
    spawn: level.spawn,
    exit: level.exit,
    boxes: level.boxes,
    sponges: level.sponges,
    labels: level.labels,
  }
  if (level.zones && level.zones.length > 0) out.zones = level.zones
  if (level.lasers && level.lasers.length > 0) out.lasers = level.lasers
  if (level.cibles && level.cibles.length > 0) out.cibles = level.cibles
  if (level.portes && level.portes.length > 0) out.portes = level.portes
  if (level.rails && level.rails.length > 0) out.rails = level.rails
  if (level.lumieres && level.lumieres.length > 0) out.lumieres = level.lumieres
  if (level.decals && level.decals.length > 0) out.decals = level.decals
  if (level.figure) out.figure = level.figure
  if (level.ambiance) out.ambiance = level.ambiance
  if (level.raccourciVers) out.raccourciVers = level.raccourciVers
  if (level.cineAvant) out.cineAvant = level.cineAvant
  if (level.cineApres) out.cineApres = level.cineApres
  if (level.sequence) out.sequence = level.sequence
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
  // Budgets de rendu : la physique voit tous les éléments, mais le décor n'en
  // dessine qu'un nombre borné — au-delà, des blocs (ou zones) deviennent des
  // murs invisibles. Le sas garde sa place quoi qu'il arrive.
  if (level.boxes.length > MAX_BOXES - 1) {
    v.push({
      niveau: 'erreur',
      message: `Trop de blocs : ${level.boxes.length} posés, ${MAX_BOXES - 1} dessinés au plus — les derniers seraient des murs invisibles.`,
    })
  }
  if ((level.zones?.length ?? 0) > MAX_ZONES) {
    v.push({
      niveau: 'erreur',
      message: `Trop de zones d'état : ${level.zones?.length} posées, ${MAX_ZONES} dessinées au plus — les suivantes agiraient sans se voir.`,
    })
  }
  if ((level.lumieres?.length ?? 0) > MAX_LUMIERES) {
    v.push({
      niveau: 'avertissement',
      message: `Trop de lampes : ${level.lumieres?.length} posées, ${MAX_LUMIERES} allumées au plus — les suivantes resteraient éteintes.`,
    })
  }
  for (const lum of level.lumieres ?? []) {
    if (!inBounds(lum.x, lum.y)) {
      v.push({ niveau: 'avertissement', message: 'Une lampe est hors de la cuve : elle éclairera depuis le vide.' })
      break
    }
  }
  // Mécanismes laser : une porte asservie doit l'être à une cible réelle,
  // et un émetteur sans cible n'ouvre rien (il éclaire, c'est tout).
  // Une cible NÉGATIVE est le contrat des portes SCÉNARISÉES : aucun laser
  // ne les ouvre — seule une séquence in-map le fait (la brèche).
  const nCibles = level.cibles?.length ?? 0
  for (const porte of level.portes ?? []) {
    if (porte.cible >= 0 && porte.cible >= nCibles) {
      v.push({
        niveau: 'erreur',
        message: `Une porte est asservie à la cible nº ${porte.cible + 1}, qui n'existe pas.`,
      })
    }
  }
  if ((level.lasers?.length ?? 0) > 0 && nCibles === 0) {
    v.push({
      niveau: 'avertissement',
      message: 'Un émetteur laser sans cible : le faisceau éclaire, mais n’ouvre rien.',
    })
  }
  if (nCibles > 0 && (level.lasers?.length ?? 0) === 0) {
    v.push({
      niveau: 'avertissement',
      message: 'Une cible sans émetteur laser : elle ne s’allumera jamais.',
    })
  }
  for (const l of level.lasers ?? []) {
    if (!inBounds(l.x, l.y)) {
      v.push({ niveau: 'erreur', message: 'Un émetteur laser est hors de la cuve.' })
    }
  }
  // Rails : un rail sans émetteur ne guidera jamais rien, et un rail hors
  // cuve est inatteignable.
  if ((level.rails?.length ?? 0) > 0 && (level.lasers?.length ?? 0) === 0) {
    v.push({
      niveau: 'avertissement',
      message: 'Un rail magnétique sans émetteur laser : aucun arc à guider.',
    })
  }
  for (const r of level.rails ?? []) {
    if (r.points.some((p) => !inBounds(p.x, p.y))) {
      v.push({ niveau: 'erreur', message: 'Un rail magnétique sort de la cuve.' })
    }
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
      message: 'Un évent barre la route sans radiateur ni zone vapeur pour le franchir.',
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
