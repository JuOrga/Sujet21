// Contrat d'échange des tableaux : JSON lisible, validé à l'entrée.
// C'est le format que produit l'éditeur et que relit le jeu — il doit rester
// simple à écrire à la main et impossible à charger cassé.

import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_MIROIR,
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
  type CacheDef,
  type CibleDef,
  type CondensatPose,
  type EclatPose,
  type LaserDef,
  type AncreMeta,
  type MonnaiePlot,
  type PlotMeta,
  type RoleAncre,
  type StructureDef,
  type PorteDef,
  type RailDef,
  type ZoneDef,
  type ZoneForce,
} from './level'
import { ARTICLES_ETAL_IDS } from './economat'
import { ARTICLES_COMPTOIR_IDS, ROLES_ANCRE } from './hub'
import { REPARATIONS } from './reparations'
import { MAX_BOXES, MAX_LUMIERES, MAX_ZONES } from '../render/renderer'
import {
  ARC_EPAISSEUR_DEFAUT,
  ARC_OUVERTURE_DEFAUT,
  FORME_ARC,
  FORME_COIN,
  FORME_RECT,
  formeContact,
  type FormeContact,
  FORME_COQUE,
} from './formes'
import { canalDeCible } from './laser'
import {
  CHANFREIN_MAX,
  EP_MAX,
  EP_MIN,
  STRUCT_CHAMBRE,
  STRUCT_COULOIR,
  niveauExpanse,
  structureViable,
} from './structures'

// LA LISTE FAIT FOI AU CHARGEMENT : `readBox` jette toute surface dont le
// matériau n'y figure pas. Le MIROIR y manquait — il était pourtant offert
// dans la palette de l'éditeur, réfléchissait bien le faisceau (laser.ts) et
// arrêtait le corps comme une paroi (le solveur ne laisse passer que la
// grille, la membrane et le rideau). On pouvait donc en poser un, l'ENREGISTRER
// sans erreur, et le retrouver disparu à la relecture : le seul endroit qui
// l'ignorait était celui qui décide de sa survie. MAT_EXIT reste dehors, lui,
// et c'est voulu : le sas est un champ à part, pas une surface qu'on trace.
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
  MAT_MIROIR,
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

/** Un rectangle remis à l'endroit (min ≤ max), quel que soit l'ordre lu. */
function normRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: Math.min(ax, bx),
    minY: Math.min(ay, by),
    maxX: Math.max(ax, bx),
    maxY: Math.max(ay, by),
  }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** Le CODE DU HUB, en majuscules : le tableau qui porte ce code remplace le
 *  laboratoire et ne compte pas dans la séquence de l'expédition. */
export const CODE_HUB = 'HUB'

/** Canonise le code : « hub », « Hub », «  HUB  » désignent tous le hub —
 * et ses chantiers (« hub2 »…) s'écrivent en majuscules eux aussi. */
export function codeCanon(code: string): string {
  const nu = code.trim()
  return /^hub\d*$/i.test(nu) ? nu.toUpperCase() : nu
}

/** La FAMILLE du laboratoire : HUB (celui qui se joue) et ses chantiers
 * (HUB2…). Aucun d'eux n'entre dans la séquence de l'expédition — sans ce
 * garde-fou, une copie du hub publiée en bibliothèque devenait la
 * « salle 1 » et le sas de lancement semblait renvoyer au hub. */
export function estCodeHub(code: string): boolean {
  return /^hub\d*$/i.test(code.trim())
}

// ---- Le CODE ATELIER : la convention de nommage des tableaux ------------
// Trois chiffres, chacun porte un sens — « 111 » se lit chiffre à chiffre :
//   · 1ᵉʳ  chiffre : le MOMENT de la run (1 début · 2 milieu · 3 fin)
//   · 2ᵉ   chiffre : la MÉCANIQUE requise pour franchir le tableau
//         (0 rien de spécial · 1 la glace · 2 la vapeur · 3 toutes)
//   · 3ᵉ   chiffre : la DIFFICULTÉ, à moment et mécanique égaux
// Le code DÉCRIT le tableau, il ne le range pas : plusieurs tableaux
// portent naturellement le même code. L'ORDRE de la séquence, lui, vient du
// NUMÉRO du tableau (en tête du nom — « 12 », et une lettre départage les
// ex æquo : « 12a », « 12b »). Tout autre code (21-A, HUB…) est simplement
// hors convention : il se charge et se joue pareil, il n'a rien à décoder.

export interface CodeAtelier {
  moment: 1 | 2 | 3
  mecanique: 0 | 1 | 2 | 3
  difficulte: number
}

export const MOMENT_NOMS: Record<CodeAtelier['moment'], string> = {
  1: 'début de run',
  2: 'milieu de partie',
  3: 'fin de partie',
}

export const MECANIQUE_NOMS: Record<CodeAtelier['mecanique'], string> = {
  0: 'aucune',
  1: 'glace',
  2: 'vapeur',
  3: 'toutes',
}

// ---- La CODIFICATION COMPLÈTE « 21XX-MMD » ------------------------------
// La forme définitive du concepteur : tout niveau commence par « 21 »,
// puis DEUX LETTRES qui donnent l'ORDRE dans la run (AA = premier après le
// hub, AB = deuxième… puis BA après AZ), un tiret, et les trois chiffres
// de l'atelier (moment · mécanique · difficulté). Exemple : « 21BE-121 »
// (« 21BE - 121 » s'écrit aussi, les espaces sont tolérées). Plusieurs
// tableaux peuvent porter le MÊME ordre : c'est le POOL — en fin de salle,
// le jeu en propose deux au choix.

export interface Code21 {
  ordre: number // AA = 1, AB = 2 … AZ = 26, BA = 27 …
  atelier: CodeAtelier
}

/** Les lettres d'ordre du rang donné : 1 → AA, 2 → AB, 27 → BA. */
export function lettresOrdre(ordre: number): string {
  const n = Math.max(1, Math.floor(ordre)) - 1
  return (
    String.fromCharCode(65 + (Math.floor(n / 26) % 26)) +
    String.fromCharCode(65 + (n % 26))
  )
}

/** Décode la codification complète « 21XX-MMD » — null hors convention. */
export function decodeCode21(code: string): Code21 | null {
  const m = /^21\s*([A-Z]{2})\s*-\s*(\d)(\d)(\d)$/i.exec(code.trim())
  if (!m) return null
  const L = m[1].toUpperCase()
  const ordre = (L.charCodeAt(0) - 65) * 26 + (L.charCodeAt(1) - 65) + 1
  const moment = Number(m[2])
  if (moment < 1 || moment > 3) return null
  const mecanique = Number(m[3])
  if (mecanique > 3) return null
  return {
    ordre,
    atelier: {
      moment: moment as CodeAtelier['moment'],
      mecanique: mecanique as CodeAtelier['mecanique'],
      difficulte: Number(m[4]),
    },
  }
}

/** Décode un code de la convention atelier — null si le code n'en est pas
 * (ce n'est pas une erreur : les codes livrés « 21-A » vivent à côté).
 * La codification complète « 21XX-MMD » se décode aussi : ses trois
 * chiffres portent le même sens. */
export function decodeCodeAtelier(code: string): CodeAtelier | null {
  const c21 = decodeCode21(code)
  if (c21) return c21.atelier
  const m = /^(\d)(\d)(\d)$/.exec(code.trim())
  if (!m) return null
  const moment = Number(m[1])
  if (moment < 1 || moment > 3) return null // le moment n'a que trois valeurs
  const mecanique = Number(m[2])
  if (mecanique > 3) return null // 4..9 : pas une mécanique connue
  return {
    moment: moment as CodeAtelier['moment'],
    mecanique: mecanique as CodeAtelier['mecanique'],
    difficulte: Number(m[3]),
  }
}

/** Le NUMÉRO du tableau : ce qui le range dans la séquence — lu en tête du
 * NOM (« 12 La chaudière », « 12a … », « 12b … » : la lettre départage les
 * ex æquo). null quand le nom ne commence pas par un numéro. */
export function numeroTableau(
  name: string,
): { numero: number; lettre: string } | null {
  const m = /^\s*(\d+)\s*([a-z]?)(?=[\s.\-–—:]|$)/i.exec(name)
  if (!m) return null
  return { numero: Number(m[1]), lettre: m[2].toLowerCase() }
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
  const p2 = Math.round(num(o.p2, 0))
  const box: ObstacleBox = {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
    ...(angle ? { angle: Math.max(-180, Math.min(180, angle)) } : {}),
    ...(aura !== 1 && material === MAT_CHAUD
      ? { aura: Math.max(0.25, Math.min(4, aura)) }
      : {}),
    ...(skin > 0 && material === MAT_WALL && forme === FORME_RECT
      ? { skin: Math.min(9, skin) }
      : {}),
    ...(forme > FORME_RECT && forme <= FORME_COQUE ? { forme } : {}),
    ...(forme === FORME_COIN && Math.round(p0) !== 0
      ? { p0: ((Math.round(p0) % 4) + 4) % 4 }
      : {}),
    ...(forme === FORME_ARC && p0 !== ARC_EPAISSEUR_DEFAUT
      ? { p0: Math.max(0.08, Math.min(1, p0)) }
      : {}),
    ...(forme === FORME_ARC && p1 !== ARC_OUVERTURE_DEFAUT
      ? { p1: Math.max(15, Math.min(180, p1)) }
      : {}),
    // LA COQUE : ses quatre réglages voyagent serrés dans p0 et p1 (cf.
    // coquePack) — bornés ici comme partout ailleurs
    ...(forme === FORME_COQUE
      ? { p0: Math.max(0, Math.min(127, Math.round(p0))) }
      : {}),
    ...(forme === FORME_COQUE
      ? { p1: Math.max(0, Math.min(1023, Math.round(p1))) }
      : {}),
    ...(forme === FORME_ARC && p2 !== 0
      ? { p2: Math.max(0, Math.min(2, p2)) }
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
  const note = (v: unknown): number =>
    Math.max(0, Math.min(3, Math.round(num(v, 0))))
  const picto =
    p && /^#[0-9a-fA-F]{6}$/.test(str(p.couleur))
      ? {
          couleur: str(p.couleur),
          eau: note(p.eau),
          glace: note(p.glace),
          vapeur: note(p.vapeur),
        }
      : undefined
  if (!text && !picto) return null
  const tone = str(o.tone, 'mur') as WorldLabel['tone']
  // la CLÉ voyage avec l'étiquette : c'est elle qui la désigne dans le
  // code (réparations, sceau du secteur 4), pas sa prose — un tableau
  // exporté puis relu doit garder l'identité de ses panneaux
  const cle = str(o.cle).slice(0, 48).trim()
  return {
    x: num(o.x),
    y: num(o.y),
    text,
    cle: cle || undefined,
    tone: TONES.includes(tone) ? tone : 'mur',
    rang: str(o.rang) === 'secteur' ? 'secteur' : undefined,
    picto,
  }
}

/**
 * Relit un tableau depuis du JSON. Renvoie le tableau et la liste des rejets
 * (une pièce mal formée est écartée, elle n'empêche pas de charger le reste).
 */
export function parseLevel(input: unknown): {
  level: LevelDef | null
  rejets: string[]
} {
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
    return {
      level: null,
      rejets: ['la cuve est trop petite (200 u minimum de côté)'],
    }
  }

  const sp = (o.spawn ?? {}) as Record<string, unknown>
  const ex = (o.exit ?? {}) as Record<string, unknown>

  const boxes: ObstacleBox[] = []
  for (const raw of Array.isArray(o.boxes) ? o.boxes : []) {
    const box = readBox((raw ?? {}) as Record<string, unknown>)
    if (box) boxes.push(box)
    else
      rejets.push(
        'une surface a été écartée (matériau inconnu ou taille nulle)',
      )
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
    // Le code « HUB » est un MOT-CLÉ (il désigne le laboratoire, hors
    // séquence) : on le canonise, sans quoi « hub » ou « Hub » échouait en
    // silence — le tableau finissait dans l'expédition sans rien dire.
    code: codeCanon(str(o.code, '21-?').slice(0, 16)),
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
    par:
      o.par === undefined ? undefined : Math.max(1, Math.round(num(o.par, 3))),
    ambiante:
      o.ambiante === undefined
        ? undefined
        : Math.max(0, Math.min(1, num(o.ambiante, 0.52))),
    brume:
      o.brume === undefined
        ? undefined
        : Math.max(0, Math.min(1, num(o.brume, 0))),
    plafond: str(o.plafond).trim().slice(0, 24) || undefined,
    dashBudget:
      o.dashBudget === undefined
        ? undefined
        : Math.max(0, Math.round(num(o.dashBudget, 3))),
    ambiance: str(o.ambiance) || undefined,
    // seul 'libres' se grave : 'cycle' est le défaut, il reste implicite
    etats: o.etats === 'libres' ? 'libres' : undefined,
    exige: Array.isArray(o.exige)
      ? (o.exige.filter((e: unknown) => e === 'glace' || e === 'vapeur') as (
          | 'glace'
          | 'vapeur'
        )[])
      : undefined,
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
      'serre-ble-nain',
      'serre-rampe',
      'serre-rampe-a',
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
      fade:
        typeof d.fade === 'number' && Number.isFinite(d.fade)
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
    lasers.push({
      x: num(l.x, 0),
      y: num(l.y, 0),
      angle: ((angle % 360) + 360) % 360,
    })
  }
  if (lasers.length > 0) level.lasers = lasers

  const cibles: CibleDef[] = []
  for (const raw of Array.isArray(o.cibles) ? o.cibles : []) {
    const c = (raw ?? {}) as Record<string, unknown>
    const cible: CibleDef = {
      x: num(c.x, 0),
      y: num(c.y, 0),
      r: Math.max(8, num(c.r, 26)),
    }
    // récepteur NOR (à maintien, la coupure scelle) — tout le reste est TOR
    if (c.mode === 'nor') cible.mode = 'nor'
    // le n° logique (canal) : conservé s'il est explicite et valable ;
    // absent, la pastille vaut sa position (indice + 1)
    const canal = Math.round(num(c.canal, 0))
    if (canal >= 1) cible.canal = canal
    cibles.push(cible)
  }
  if (cibles.length > 0) level.cibles = cibles

  const portes: PorteDef[] = []
  for (const raw of Array.isArray(o.portes) ? o.portes : []) {
    const q = (raw ?? {}) as Record<string, unknown>
    // le canal visé : soit explicite (`canal`), soit HÉRITÉ des anciens
    // fichiers où `cible` était un INDICE dans la liste — on le traduit en
    // n° logique via la pastille qu'il désignait. Négatif conservé : c'est
    // le contrat d'une porte SCÉNARISÉE, que seule une séquence ouvre.
    let canal: number
    if (q.canal !== undefined) {
      const brut = Math.round(num(q.canal, 1))
      canal = brut >= 1 ? brut : -1
    } else {
      const idx = Math.round(num(q.cible, 0))
      canal = idx < 0 ? -1 : (cibles[idx]?.canal ?? idx + 1)
    }
    const porte: PorteDef = {
      minX: Math.min(num(q.minX), num(q.maxX)),
      minY: Math.min(num(q.minY), num(q.maxY)),
      maxX: Math.max(num(q.minX), num(q.maxX)),
      maxY: Math.max(num(q.minY), num(q.maxY)),
      canal,
    }
    if (q.regle === 'et') porte.regle = 'et'
    if (porte.maxX - porte.minX < 1 || porte.maxY - porte.minY < 1) {
      rejets.push('une porte a été écartée (taille nulle)')
      continue
    }
    portes.push(porte)
  }
  if (portes.length > 0) level.portes = portes

  // Cachettes : des pans voilés (brouillard ou paroi factice), levés à
  // l'entrée du corps. Formes et rotation : les mêmes règles que les boîtes.
  const caches: CacheDef[] = []
  for (const raw of Array.isArray(o.caches) ? o.caches : []) {
    const c = (raw ?? {}) as Record<string, unknown>
    const angle = num(c.angle, 0)
    const forme = Math.round(num(c.forme, FORME_RECT))
    const p0 = num(c.p0, forme === FORME_ARC ? ARC_EPAISSEUR_DEFAUT : 0)
    const p1 = num(c.p1, ARC_OUVERTURE_DEFAUT)
    const p2 = Math.round(num(c.p2, 0))
    const cache: CacheDef = {
      minX: Math.min(num(c.minX), num(c.maxX)),
      minY: Math.min(num(c.minY), num(c.maxY)),
      maxX: Math.max(num(c.minX), num(c.maxX)),
      maxY: Math.max(num(c.minY), num(c.maxY)),
      ...(angle ? { angle: Math.max(-180, Math.min(180, angle)) } : {}),
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
      ...(forme === FORME_ARC && p2 !== 0
        ? { p2: Math.max(0, Math.min(2, p2)) }
        : {}),
      ...(c.style === 'paroi' ? { style: 'paroi' as const } : {}),
    }
    if (cache.maxX - cache.minX < 1 || cache.maxY - cache.minY < 1) {
      rejets.push('une cachette a été écartée (taille nulle)')
      continue
    }
    caches.push(cache)
  }
  if (caches.length > 0) level.caches = caches

  // Pastilles de condensat posées main (rares : le semis automatique fait
  // le cas général) — x, y et valeur en centilitres bornée
  const condensats: CondensatPose[] = []
  for (const raw of Array.isArray(o.condensats) ? o.condensats : []) {
    const p = (raw ?? {}) as Record<string, unknown>
    condensats.push({
      x: num(p.x, 0),
      y: num(p.y, 0),
      cl: Math.max(1, Math.min(200, Math.round(num(p.cl, 8)))),
    })
  }
  if (condensats.length > 0) level.condensats = condensats

  // L'emplacement de fiole posé main (un seul par tableau)
  if (o.fiole && typeof o.fiole === 'object') {
    const f = o.fiole as Record<string, unknown>
    level.fiole = { x: num(f.x, 0), y: num(f.y, 0) }
  }

  // LE MÉTA POSÉ — les plots d'article : liste FERMÉE par monnaie (un id
  // inconnu est écarté, comme une sorte de décalque inconnue), prix borné
  const plots: PlotMeta[] = []
  for (const raw of Array.isArray(o.plots) ? o.plots : []) {
    const p = (raw ?? {}) as Record<string, unknown>
    const monnaie: MonnaiePlot =
      p.monnaie === 'memoire' ? 'memoire' : 'condensat'
    const article = str(p.article)
    const connus: readonly string[] =
      monnaie === 'memoire' ? ARTICLES_COMPTOIR_IDS : ARTICLES_ETAL_IDS
    if (!connus.includes(article)) {
      rejets.push(`plot d'article inconnu écarté (${article || 'sans id'})`)
      continue
    }
    const r = normRect(
      num(p.minX, 0),
      num(p.minY, 0),
      num(p.maxX, 0),
      num(p.maxY, 0),
    )
    const plotLu: PlotMeta = { ...r, article, monnaie }
    if (p.prix !== undefined) {
      plotLu.prix = Math.max(1, Math.min(999, Math.round(num(p.prix, 1))))
    }
    plots.push(plotLu)
  }
  if (plots.length > 0) level.plots = plots

  // LES STRUCTURES DE COQUE : sorte fermée, réglages bornés. Une coque
  // sans intérieur (deux parois qui se touchent) est écartée — ce serait
  // un bloc plein, pas un terrain de jeu.
  const structures: StructureDef[] = []
  for (const raw of Array.isArray(o.structures) ? o.structures : []) {
    const t = (raw ?? {}) as Record<string, unknown>
    const type = Math.round(num(t.type, STRUCT_CHAMBRE))
    if (type !== STRUCT_CHAMBRE && type !== STRUCT_COULOIR) {
      rejets.push(`structure de sorte inconnue écartée (${type})`)
      continue
    }
    const r = normRect(
      num(t.minX, 0),
      num(t.minY, 0),
      num(t.maxX, 0),
      num(t.maxY, 0),
    )
    const st: StructureDef = { type, ...r }
    if (t.ep !== undefined)
      st.ep = Math.max(EP_MIN, Math.min(EP_MAX, Math.round(num(t.ep, 40))))
    if (t.chanfrein !== undefined && type === STRUCT_CHAMBRE)
      st.chanfrein = Math.max(
        0,
        Math.min(CHANFREIN_MAX, num(t.chanfrein, 0.25)),
      )
    if (t.angle !== undefined) {
      const a = Math.max(-180, Math.min(180, num(t.angle, 0)))
      if (a) st.angle = a
    }
    if (type === STRUCT_COULOIR && (t.axe === 0 || t.axe === 1)) st.axe = t.axe
    if (type === STRUCT_COULOIR && t.raccord === false) st.raccord = false
    if (t.ouvertures !== undefined)
      st.ouvertures = Math.max(0, Math.min(15, Math.round(num(t.ouvertures, 0))))
    if (t.porte !== undefined)
      st.porte = Math.max(0, Math.min(2000, Math.round(num(t.porte, 0))))
    if (t.bouchon !== undefined && type === STRUCT_COULOIR) {
      const m = Math.round(num(t.bouchon, MAT_WALL))
      if (MATERIALS.includes(m as (typeof MATERIALS)[number])) st.bouchon = m
    }
    if (t.material !== undefined) {
      const m = Math.round(num(t.material, MAT_WALL))
      if (MATERIALS.includes(m as (typeof MATERIALS)[number]) && m !== MAT_WALL)
        st.material = m
    }
    if (t.skin !== undefined) {
      const k = Math.round(num(t.skin, 0))
      if (k >= 0 && k <= 10) st.skin = k
    }
    if (!structureViable(st)) {
      rejets.push('une structure sans intérieur a été écartée (coque trop épaisse)')
      continue
    }
    structures.push(st)
  }
  if (structures.length > 0) level.structures = structures
  if (o.coque === 'structures') level.coque = 'structures'

  // LES ANCRES MÉTA du module : rôle dans la liste fermée, id de station
  // au catalogue des réparations (un rôle ou un id inconnu est écarté —
  // une ancre muette vaut mieux qu'une ancre qui s'active à tort)
  const ancres: AncreMeta[] = []
  const idsStation = REPARATIONS.map((r) => r.id)
  for (const raw of Array.isArray(o.ancres) ? o.ancres : []) {
    const a = (raw ?? {}) as Record<string, unknown>
    const role = str(a.role) as RoleAncre
    if (!ROLES_ANCRE.includes(role)) {
      rejets.push(`ancre méta de rôle inconnu écartée (${role || 'sans rôle'})`)
      continue
    }
    const r = normRect(
      num(a.minX, 0),
      num(a.minY, 0),
      num(a.maxX, 0),
      num(a.maxY, 0),
    )
    if (role === 'station' || role === 'degat') {
      const id = str(a.id)
      if (!idsStation.includes(id)) {
        rejets.push(`ancre de station inconnue écartée (${id || 'sans id'})`)
        continue
      }
      ancres.push({ ...r, role, id })
    } else ancres.push({ ...r, role })
  }
  if (ancres.length > 0) level.ancres = ancres

  // le banc des mémoires (un seul), le marchand (un seul)
  if (o.bancMemoires && typeof o.bancMemoires === 'object') {
    const b = o.bancMemoires as Record<string, unknown>
    level.bancMemoires = normRect(
      num(b.minX, 0),
      num(b.minY, 0),
      num(b.maxX, 0),
      num(b.maxY, 0),
    )
  }
  if (o.marchand && typeof o.marchand === 'object') {
    const m = o.marchand as Record<string, unknown>
    level.marchand = { x: num(m.x, 0), y: num(m.y, 0) }
  }

  // les éclats de mémoire : valeur gravée bornée (jamais semés — l'auteur
  // seul en pose)
  const eclats: EclatPose[] = []
  for (const raw of Array.isArray(o.eclats) ? o.eclats : []) {
    const e = (raw ?? {}) as Record<string, unknown>
    eclats.push({
      x: num(e.x, 0),
      y: num(e.y, 0),
      memoire: Math.max(1, Math.min(99, Math.round(num(e.memoire, 2)))),
    })
  }
  if (eclats.length > 0) level.eclats = eclats

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
    // Le drapeau CONDUIT doit être relu ici, sinon il disparaît à
    // l'enregistrement sans un mot — c'est exactement la panne du miroir
    // (MATERIALS oubliait MAT_MIROIR, la boîte entière était jetée).
    const rail: RailDef = { points: pts }
    if (r.conduit === true) rail.conduit = true
    rails.push(rail)
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
      ...(intensite !== 1
        ? { intensite: Math.max(0.2, Math.min(2, intensite)) }
        : {}),
      ...(lampeCouleurRVB(couleur) && couleur !== LAMPE_COULEUR_DEFAUT
        ? { couleur }
        : {}),
      // le luminaire (l'objet visible) : mêmes règles — le défaut efface la clé
      ...(num(l.taille, 1) !== 1
        ? { taille: Math.max(0, Math.min(3, num(l.taille, 1))) }
        : {}),
      ...(str(l.forme, '') === 'bandeau' ? { forme: 'bandeau' as const } : {}),
      ...(str(l.forme, '') === 'bandeau' && num(l.longueur, 260) !== 260
        ? { longueur: Math.max(80, Math.min(1600, num(l.longueur, 260))) }
        : {}),
      ...(str(l.forme, '') === 'bandeau' && num(l.angle, 0) !== 0
        ? { angle: ((num(l.angle, 0) % 360) + 360) % 360 }
        : {}),
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
    brume: level.brume,
    plafond: level.plafond,
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
  if (level.cibles && level.cibles.length > 0) {
    // canal égal à la position : implicite, la clé disparaît du fichier
    out.cibles = level.cibles.map((c, i) => {
      if (c.canal === i + 1) {
        const copie = { ...c }
        delete copie.canal
        return copie
      }
      return c
    })
  }
  if (level.portes && level.portes.length > 0) out.portes = level.portes
  if (level.rails && level.rails.length > 0) out.rails = level.rails
  if (level.caches && level.caches.length > 0) out.caches = level.caches
  if (level.condensats && level.condensats.length > 0)
    out.condensats = level.condensats
  if (level.fiole) out.fiole = level.fiole
  if (level.plots?.length) out.plots = level.plots
  if (level.structures?.length) out.structures = level.structures
  if (level.coque === 'structures') out.coque = 'structures'
  if (level.ancres?.length) out.ancres = level.ancres
  if (level.bancMemoires) out.bancMemoires = level.bancMemoires
  if (level.marchand) out.marchand = level.marchand
  if (level.eclats?.length) out.eclats = level.eclats
  if (level.lumieres && level.lumieres.length > 0) out.lumieres = level.lumieres
  if (level.decals && level.decals.length > 0) out.decals = level.decals
  if (level.figure) out.figure = level.figure
  if (level.ambiance) out.ambiance = level.ambiance
  if (level.etats === 'libres') out.etats = 'libres'
  if (level.exige?.length) out.exige = level.exige
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

/** Le corps d'un rail, en unités monde : sa bande de capture, celle que le
 *  calque dessine et sur laquelle le solveur fait buter la matière. Copié de
 *  DEFAULT_PARAMS.plasmaRailRadius — l'importer ici ferait entrer tout le
 *  banc de réglage dans le format. */
const PLASMA_RAIL_RAYON = 30

/** La distance d'un point à une polyligne. */
function distanceAuTrace(
  pts: { x: number; y: number }[],
  x: number,
  y: number,
): number {
  let d = Infinity
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k]
    const b = pts[k + 1]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const l2 = abx * abx + aby * aby
    const t =
      l2 < 1e-9
        ? 0
        : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / l2))
    d = Math.min(d, Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t)))
  }
  return d
}

/**
 * Garde-fous du level design, les mêmes que ceux des tableaux livrés : une
 * erreur rend le tableau injouable, un avertissement le rend douteux.
 */
export function checkLevel(brut: LevelDef): Verdict[] {
  const v: Verdict[] = []
  // LE TABLEAU TEL QUE LE MOTEUR LE VERRA : les structures expansées en
  // parois. Le budget de blocs, le dégagement du départ et la chimie
  // raisonnent donc sur la vérité, pas sur le plan.
  const level = niveauExpanse(brut)
  const b = level.bounds
  const inBounds = (x: number, y: number): boolean =>
    x > b.minX && x < b.maxX && y > b.minY && y < b.maxY

  if (!inBounds(level.spawn.x, level.spawn.y)) {
    v.push({
      niveau: 'erreur',
      message: 'Le point de départ est hors de la cuve.',
    })
  }
  // Le DÉGAGEMENT se mesure à la VRAIE silhouette (forme ET rotation) :
  // la boîte englobante ne bouge pas quand la pièce pivote — un arc tourné
  // pour éloigner sa bande du départ criait encore à tort.
  const contact: FormeContact = { dist: 0, nx: 0, ny: 1 }
  for (const box of level.boxes) {
    formeContact(level.spawn.x, level.spawn.y, box, contact)
    if (contact.dist < 120) {
      v.push({
        niveau: 'erreur',
        message:
          'Le point de départ naît dans une surface (120 u de dégagement exigés).',
      })
      break
    }
  }

  const ex = level.exit
  if (
    ex.minX < b.minX ||
    ex.maxX > b.maxX ||
    ex.minY < b.minY ||
    ex.maxY > b.maxY
  ) {
    v.push({ niveau: 'erreur', message: 'Le sas déborde de la cuve.' })
  }
  if (ex.maxX - ex.minX < 40 || ex.maxY - ex.minY < 40) {
    v.push({
      niveau: 'erreur',
      message: 'Le sas est trop petit (40 u minimum).',
    })
  }
  const cx = (ex.minX + ex.maxX) / 2
  if (Math.abs(cx - level.spawn.x) < 800) {
    v.push({
      niveau: 'avertissement',
      message:
        'Le sas est à moins de 800 u du départ : il n’y a presque pas de traversée.',
    })
  }

  if (level.boxes.length + level.sponges.length === 0) {
    v.push({
      niveau: 'avertissement',
      message: 'Le tableau est vide : aucun obstacle.',
    })
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
      v.push({
        niveau: 'avertissement',
        message:
          'Une lampe est hors de la cuve : elle éclairera depuis le vide.',
      })
      break
    }
  }
  // Mécanismes laser : une porte asservie doit viser un canal qu'une
  // pastille porte vraiment, et un émetteur sans cible n'ouvre rien.
  // Un canal NÉGATIF est le contrat des portes SCÉNARISÉES : aucun laser
  // ne les ouvre — seule une séquence in-map le fait (la brèche).
  const nCibles = level.cibles?.length ?? 0
  const canaux = new Set<number>()
  for (let c = 0; c < nCibles; c++) canaux.add(canalDeCible(level.cibles!, c))
  for (const porte of level.portes ?? []) {
    if (porte.canal >= 0 && !canaux.has(porte.canal)) {
      v.push({
        niveau: 'erreur',
        message: `Une porte est asservie au canal nº ${porte.canal} — aucune cible ne porte ce numéro.`,
      })
    }
  }
  if ((level.lasers?.length ?? 0) > 0 && nCibles === 0) {
    v.push({
      niveau: 'avertissement',
      message:
        'Un émetteur laser sans cible : le faisceau éclaire, mais n’ouvre rien.',
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
      v.push({
        niveau: 'erreur',
        message: 'Un émetteur laser est hors de la cuve.',
      })
    }
  }
  // Rails : un rail sans émetteur ne guidera jamais rien, et un rail hors
  // cuve est inatteignable.
  // TOUT rail réclame un émetteur, CONDUIT COMPRIS : le tube ne s'ouvre
  // qu'au plasma, donc à un arc ionisé. Un conduit sans laser n'est pas un
  // raccourci, c'est une paroi invisible que rien ne pourra jamais ouvrir —
  // le pire des tableaux, celui qui a l'air jouable.
  if ((level.rails?.length ?? 0) > 0 && (level.lasers?.length ?? 0) === 0) {
    v.push({
      niveau: 'avertissement',
      message:
        'Un rail magnétique sans émetteur laser : aucun arc à guider — et un CONDUIT sans arc ne s’ouvrira jamais.',
    })
  }
  for (const r of level.rails ?? []) {
    if (r.points.some((p) => !inBounds(p.x, p.y))) {
      v.push({
        niveau: 'erreur',
        message: 'Un rail magnétique sort de la cuve.',
      })
    }
    // LE DÉPART NE NAÎT PAS DANS UNE PAROI. Depuis qu'un rail a un corps —
    // il barre l'eau, la glace et la vapeur ordinaire, seul le plasma le
    // franchit — un tracé qui passe sur le point de départ y ferait naître
    // le corps DANS le mur, et le solveur l'expulserait à la première image.
    // Mesuré sur le générateur : 8 graines sur 1500 tombaient dedans, la
    // pire à 0,0 unité de l'axe. La preuve de traversée ne peut pas le voir
    // (elle ignore les portes d'état) : c'est donc ici que ça se dit, et
    // comme valideNiveau relit checkLevel, le générateur retire la graine.
    if (
      distanceAuTrace(r.points, level.spawn.x, level.spawn.y) <
      PLASMA_RAIL_RAYON
    ) {
      v.push({
        niveau: 'erreur',
        message:
          'Le départ est posé dans le corps d’un rail : le corps naîtrait dans une paroi.',
      })
    }
  }
  if (level.journal.trim().length < 40) {
    v.push({
      niveau: 'avertissement',
      message: 'L’entrée de journal fait moins de 40 caractères.',
    })
  }
  if (!level.labels.some((l) => l.tone === 'sas')) {
    v.push({
      niveau: 'avertissement',
      message: 'Aucune étiquette ne désigne le sas.',
    })
  }

  // Une zone qui impose la vapeur sans radiateur, ou la glace sans hublot,
  // n'est pas fautive — mais elle mérite d'être signalée au concepteur.
  const hasChaud = level.boxes.some((x) => x.material === MAT_CHAUD)
  const hasFroid = level.boxes.some((x) => x.material === MAT_FROID)
  for (const z of level.zones ?? []) {
    if (z.force === 'vapeur' && !hasChaud) {
      v.push({
        niveau: 'avertissement',
        message:
          'Une zone impose la vapeur alors qu’aucun radiateur n’en fournit.',
      })
      break
    }
  }
  for (const z of level.zones ?? []) {
    if (z.force === 'glace' && !hasFroid) {
      v.push({
        niveau: 'avertissement',
        message:
          'Une zone impose la glace alors qu’aucun hublot froid n’en donne.',
      })
      break
    }
  }

  const grilleSansVapeur =
    level.boxes.some((x) => x.material === MAT_GRILLE) &&
    !hasChaud &&
    !(level.zones ?? []).some((z) => z.force === 'vapeur')
  if (grilleSansVapeur) {
    v.push({
      niveau: 'avertissement',
      message:
        'Un évent barre la route sans radiateur ni zone vapeur pour le franchir.',
    })
  }

  const chimie = level.boxes.some(
    (x) => x.material === MAT_HYDROPHILE || x.material === MAT_HYDROPHOBE,
  )
  if (!chimie && level.sponges.length === 0 && level.boxes.length > 0) {
    v.push({
      niveau: 'avertissement',
      message:
        'Aucune chimie ni éponge : les obstacles ne sont que de la géométrie.',
    })
  }

  return v
}
