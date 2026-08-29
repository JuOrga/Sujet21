// LES STRUCTURES DE COQUE — le kit de construction du terrain de jeu.
//
// Une STRUCTURE est une coque VIDE : un anneau de parois qui enferme un
// volume jouable. On en pose deux sortes — une CHAMBRE (rectangle,
// hexagone ou octogone selon son chanfrein) et un COULOIR (un tube ouvert
// aux deux bouts) — et on les RECOUVRE les unes les autres : là où le vide
// d'une structure traverse la paroi d'une autre, la porte se perce toute
// seule. C'est tout le principe du modulaire : aucune « connexion » à
// déclarer, on empile des formes et le passage apparaît.
//
// Ce module est PUR et sans dépendance au DOM : il ne fait que de la
// géométrie. Il rend des ObstacleBox ordinaires — le solveur, le shader,
// le laser et le format ne voient jamais une structure, seulement les
// parois qu'elle fabrique. Zéro travail moteur, zéro forme nouvelle.
//
// LE CHANFREIN N'EST PAS UN « COIN ». La forme COIN de formes.ts est un
// triangle PLEIN : posée dans un angle, elle boucherait le coin et la
// silhouette extérieure resterait un rectangle — or, le dehors étant le
// vide, c'est justement cette silhouette qu'on voit. Le chanfrein d'une
// coque est une BANDE diagonale d'épaisseur `ep` : un simple rectangle
// pivoté à ±45°. Même prix, forme juste.

import {
  MAT_WALL,
  type LevelDef,
  type ObstacleBox,
  type StructureDef,
} from './level'

export const STRUCT_CHAMBRE = 0
export const STRUCT_COULOIR = 1
export const SORTES_STRUCTURE = [STRUCT_CHAMBRE, STRUCT_COULOIR] as const

/** L'épaisseur de coque par défaut, en unités monde. */
export const EP_DEFAUT = 40
export const EP_MIN = 12
export const EP_MAX = 240
/** Le chanfrein, en PART du demi-petit-côté (0 rectangle, 0.5 hexagone).
 * En part et non en unités : le concepteur redimensionne, et l'octogone
 * doit garder sa forme au lieu de s'écraser. */
export const CHANFREIN_DEFAUT = 0.25
export const CHANFREIN_MAX = 0.5
/** Le passage libre minimal : sous ça, la structure n'a plus d'intérieur. */
export const PASSAGE_MIN = 24
/** Un morceau de paroi plus court que ça n'est pas dessiné. */
const MIETTE = 8

export interface RectStruct {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// ——— Les réglages effectifs d'une structure ————————————————————————

const borne = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

const norm180 = (a: number): number => ((((a + 180) % 360) + 360) % 360) - 180

export function epaisseurDe(s: StructureDef): number {
  return borne(Math.round(s.ep ?? EP_DEFAUT), EP_MIN, EP_MAX)
}

/** Le chanfrein EN UNITÉS, déjà borné : jamais assez grand pour refermer
 * la chambre sur elle-même. */
export function chanfreinDe(s: StructureDef): number {
  if (s.type !== STRUCT_CHAMBRE) return 0
  const w = Math.abs(s.maxX - s.minX)
  const h = Math.abs(s.maxY - s.minY)
  const e = epaisseurDe(s)
  const part = borne(s.chanfrein ?? CHANFREIN_DEFAUT, 0, CHANFREIN_MAX)
  const petit = Math.min(w, h)
  return Math.max(0, Math.min((part * petit) / 2, petit / 2 - e))
}

/** Le couloir suit son GRAND côté, sauf ordre contraire (axe posé). */
export function axeDe(s: StructureDef): 0 | 1 {
  if (s.axe === 0 || s.axe === 1) return s.axe
  return Math.abs(s.maxY - s.minY) > Math.abs(s.maxX - s.minX) ? 1 : 0
}

/** La structure a-t-elle encore un intérieur ? (deux parois plus le
 * passage minimal — sinon elle n'est plus une coque, mais un bloc) */
export function structureViable(s: StructureDef): boolean {
  const e = epaisseurDe(s)
  const w = Math.abs(s.maxX - s.minX)
  const h = Math.abs(s.maxY - s.minY)
  const mini = 2 * e + PASSAGE_MIN
  return s.type === STRUCT_COULOIR
    ? (axeDe(s) === 0 ? h : w) >= mini && Math.max(w, h) >= mini
    : w >= mini && h >= mini
}

/** Une structure neuve, aux défauts de la maison, sur le rectangle tracé. */
export function structureNeuve(type: number, r: RectStruct): StructureDef {
  const s: StructureDef = {
    type: type === STRUCT_COULOIR ? STRUCT_COULOIR : STRUCT_CHAMBRE,
    minX: Math.min(r.minX, r.maxX),
    minY: Math.min(r.minY, r.maxY),
    maxX: Math.max(r.minX, r.maxX),
    maxY: Math.max(r.minY, r.maxY),
  }
  if (s.type === STRUCT_COULOIR) s.axe = axeDe(s)
  return s
}

// ——— Les pans, en coordonnées MONDE ————————————————————————————————
//
// Un PAN est une bande : un centre, une demi-longueur le long de son axe,
// une demi-épaisseur en travers, et l'angle de cet axe. C'est dans ce
// repère que le percement travaille — c'est ce qui le rend exact à
// n'importe quel angle, chanfreins compris.

interface Pan {
  cx: number
  cy: number
  demiLong: number
  demiEp: number
  ang: number // degrés, l'axe LONG par rapport à +X
  material: number
  skin?: number
}

const RAD = Math.PI / 180

/** Un pan local (repère de la structure) reporté dans le monde. */
function poseLocal(
  p: { cx: number; cy: number; demiLong: number; demiEp: number; ang: number },
  cx: number,
  cy: number,
  a: number,
  material: number,
  skin: number | undefined,
): Pan {
  const c = Math.cos(a * RAD)
  const s = Math.sin(a * RAD)
  return {
    cx: cx + c * p.cx - s * p.cy,
    cy: cy + s * p.cx + c * p.cy,
    demiLong: p.demiLong,
    demiEp: p.demiEp,
    ang: norm180(a + p.ang),
    material,
    ...(skin !== undefined ? { skin } : {}),
  }
}

/** Le pan devenu boîte. Un axe à ±90° ou ±180° s'écrit SANS clé `angle`,
 * en échangeant les demi-côtés : on ne paie la branche oblique du shader
 * que pour les vrais chanfreins. */
function panEnBoite(p: Pan): ObstacleBox {
  let ang = norm180(p.ang)
  let dl = p.demiLong
  let dt = p.demiEp
  if (Math.abs(Math.abs(ang) - 90) < 0.0005) {
    ang = 0
    dl = p.demiEp
    dt = p.demiLong
  } else if (Math.abs(Math.abs(ang) - 180) < 0.0005 || Math.abs(ang) < 0.0005) {
    ang = 0
  }
  const b: ObstacleBox = {
    minX: p.cx - dl,
    minY: p.cy - dt,
    maxX: p.cx + dl,
    maxY: p.cy + dt,
    material: p.material,
  }
  if (Math.abs(ang) > 0.0005) b.angle = Math.round(ang * 1000) / 1000
  if (p.skin !== undefined && p.skin > 0 && p.material === MAT_WALL)
    b.skin = p.skin
  return b
}

/** Les pans d'une structure, en monde, AVANT percement. */
function pansDeStructure(s: StructureDef): Pan[] {
  const e = epaisseurDe(s)
  const cx = (s.minX + s.maxX) / 2
  const cy = (s.minY + s.maxY) / 2
  const mat = s.material ?? MAT_WALL
  const skin = s.skin
  const locaux: {
    cx: number
    cy: number
    demiLong: number
    demiEp: number
    ang: number
    mat?: number
  }[] = []

  if (s.type === STRUCT_COULOIR) {
    // le couloir se calcule TOUJOURS le long de +X : l'axe vertical n'est
    // que la même figure tournée d'un quart de tour
    const axe = axeDe(s)
    const w = Math.abs(s.maxX - s.minX)
    const h = Math.abs(s.maxY - s.minY)
    const hw = (axe === 1 ? h : w) / 2
    const hh = (axe === 1 ? w : h) / 2
    locaux.push({ cx: 0, cy: hh - e / 2, demiLong: hw, demiEp: e / 2, ang: 0 })
    locaux.push({ cx: 0, cy: -(hh - e / 2), demiLong: hw, demiEp: e / 2, ang: 0 })
    if (s.bouchon !== undefined && s.bouchon !== null)
      locaux.push({
        cx: 0,
        cy: 0,
        demiLong: hh - e,
        demiEp: e / 2,
        ang: 90,
        mat: s.bouchon,
      })
    const a = norm180((s.angle ?? 0) + (axe === 1 ? 90 : 0))
    return locaux.map((p) =>
      poseLocal(p, cx, cy, a, p.mat ?? mat, p.mat !== undefined ? undefined : skin),
    )
  }

  const hw = Math.abs(s.maxX - s.minX) / 2
  const hh = Math.abs(s.maxY - s.minY) / 2
  const c = chanfreinDe(s)
  // les quatre pans droits, raccourcis de la coupe des angles
  locaux.push({ cx: 0, cy: hh - e / 2, demiLong: hw - c, demiEp: e / 2, ang: 0 })
  locaux.push({ cx: 0, cy: -(hh - e / 2), demiLong: hw - c, demiEp: e / 2, ang: 0 })
  locaux.push({ cx: hw - e / 2, cy: 0, demiLong: hh - c, demiEp: e / 2, ang: 90 })
  locaux.push({ cx: -(hw - e / 2), cy: 0, demiLong: hh - c, demiEp: e / 2, ang: 90 })
  if (c > 0.5) {
    // LES QUATRE CHANFREINS : une bande diagonale par angle. Son bout coupé
    // tombe DANS le pan droit voisin (décalage e/√2 < e) : aucune fente.
    const d = e / (2 * Math.SQRT2)
    const demi = (c * Math.SQRT2) / 2
    const coins: [number, number, number][] = [
      [1, 1, -45], // nord-est
      [-1, 1, 45], // nord-ouest
      [-1, -1, -45], // sud-ouest
      [1, -1, 45], // sud-est
    ]
    for (const [sx, sy, ang] of coins)
      locaux.push({
        cx: sx * (hw - c / 2) - sx * d,
        cy: sy * (hh - c / 2) - sy * d,
        demiLong: demi,
        demiEp: e / 2,
        ang,
      })
  }
  const a = norm180(s.angle ?? 0)
  return locaux.map((p) => poseLocal(p, cx, cy, a, mat, skin))
}

// ——— L'intérieur : le vide que la structure enferme ————————————————

/** L'intérieur d'une structure, en polygone MONDE (sens trigonométrique).
 * C'est lui qui perce les parois des autres. */
export function interieurStructure(s: StructureDef): { x: number; y: number }[] {
  return polygoneInterieur(s, 0)
}

function polygoneInterieur(
  s: StructureDef,
  rallonge: number,
): { x: number; y: number }[] {
  const e = epaisseurDe(s)
  const cx = (s.minX + s.maxX) / 2
  const cy = (s.minY + s.maxY) / 2
  const pts: { x: number; y: number }[] = []
  if (s.type === STRUCT_COULOIR) {
    const axe = axeDe(s)
    const w = Math.abs(s.maxX - s.minX)
    const h = Math.abs(s.maxY - s.minY)
    const hw = (axe === 1 ? h : w) / 2 + rallonge
    const hh = (axe === 1 ? w : h) / 2 - e
    pts.push({ x: hw, y: hh }, { x: -hw, y: hh }, { x: -hw, y: -hh }, { x: hw, y: -hh })
    const a = norm180((s.angle ?? 0) + (axe === 1 ? 90 : 0))
    return pts.map((p) => mondePoint(p, cx, cy, a))
  }
  const hw = Math.abs(s.maxX - s.minX) / 2 - e
  const hh = Math.abs(s.maxY - s.minY) / 2 - e
  const c = chanfreinDe(s)
  if (c > 0.5) {
    // l'octogone intérieur : les faces droites reculées de e, les
    // diagonales reculées de e le long de leur normale (e·√2 sur x+y)
    const d = c + e * (Math.SQRT2 - 1)
    const dx = Math.min(d, hw + e - 1)
    const dy = Math.min(d, hh + e - 1)
    pts.push(
      { x: hw, y: hh - dy },
      { x: hw - dx, y: hh },
      { x: -(hw - dx), y: hh },
      { x: -hw, y: hh - dy },
      { x: -hw, y: -(hh - dy) },
      { x: -(hw - dx), y: -hh },
      { x: hw - dx, y: -hh },
      { x: hw, y: -(hh - dy) },
    )
  } else {
    pts.push({ x: hw, y: hh }, { x: -hw, y: hh }, { x: -hw, y: -hh }, { x: hw, y: -hh })
  }
  const a = norm180(s.angle ?? 0)
  return pts.map((p) => mondePoint(p, cx, cy, a))
}

function mondePoint(
  p: { x: number; y: number },
  cx: number,
  cy: number,
  a: number,
): { x: number; y: number } {
  const c = Math.cos(a * RAD)
  const s = Math.sin(a * RAD)
  return { x: cx + c * p.x - s * p.y, y: cy + s * p.x + c * p.y }
}

// ——— Le percement ————————————————————————————————————————————————
//
// On ne SOUSTRAIT pas des boîtes (subtractBox refuse les formes et ne coupe
// qu'à l'axe, subtractBoxOblique refuse les angles différents) : on ne
// FABRIQUE PAS le morceau de pan qui manque. Le vide de l'autre structure
// est projeté sur l'axe long du pan, et le reste s'émet en morceaux.

/** Le polygone qui perce : celui d'un couloir déborde d'une épaisseur à
 * chaque bout, pour traverser la coque d'en face de part en part — sans
 * quoi une branche oblique laisserait deux triangles de fuite au raccord. */
function polygonePerceur(s: StructureDef): { x: number; y: number }[] {
  return polygoneInterieur(s, s.type === STRUCT_COULOIR ? epaisseurDe(s) : 0)
}

/** Clip d'un polygone convexe à la bande |v| ≤ dt (Sutherland–Hodgman). */
function clipBande(
  poly: { u: number; v: number }[],
  dt: number,
): { u: number; v: number }[] {
  let out = poly
  for (const signe of [1, -1]) {
    const dedans = (p: { u: number; v: number }) => signe * p.v <= dt
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const a = src[i]
      const b = src[(i + 1) % src.length]
      const da = dedans(a)
      const db = dedans(b)
      if (da) out.push(a)
      if (da !== db) {
        const t = (signe * dt - signe * a.v) / (signe * b.v - signe * a.v)
        out.push({ u: a.u + t * (b.u - a.u), v: a.v + t * (b.v - a.v) })
      }
    }
    if (out.length === 0) return []
  }
  return out
}

/** Le pan, moins les vides qui le traversent. */
function percePan(pan: Pan, vides: { x: number; y: number }[][]): Pan[] {
  const c = Math.cos(pan.ang * RAD)
  const s = Math.sin(pan.ang * RAD)
  const trous: [number, number][] = []
  for (const poly of vides) {
    const local = poly.map((p) => {
      const dx = p.x - pan.cx
      const dy = p.y - pan.cy
      return { u: c * dx + s * dy, v: -s * dx + c * dy }
    })
    const q = clipBande(local, pan.demiEp)
    if (q.length === 0) continue
    let u0 = Infinity
    let u1 = -Infinity
    for (const p of q) {
      if (p.u < u0) u0 = p.u
      if (p.u > u1) u1 = p.u
    }
    if (u1 > -pan.demiLong && u0 < pan.demiLong) trous.push([u0, u1])
  }
  if (trous.length === 0) return [pan]
  trous.sort((a, b) => a[0] - b[0])
  const morceaux: Pan[] = []
  let curseur = -pan.demiLong
  const emet = (a: number, b: number): void => {
    if (b - a < MIETTE) return
    const m = (a + b) / 2
    morceaux.push({
      ...pan,
      cx: pan.cx + c * m,
      cy: pan.cy + s * m,
      demiLong: (b - a) / 2,
    })
  }
  for (const [u0, u1] of trous) {
    if (u0 > curseur) emet(curseur, Math.min(u0, pan.demiLong))
    curseur = Math.max(curseur, u1)
    if (curseur >= pan.demiLong) break
  }
  if (curseur < pan.demiLong) emet(curseur, pan.demiLong)
  return morceaux
}

// ——— L'entrée du module ————————————————————————————————————————————

/** Les parois d'UNE structure, percées par les vides des `autres`. */
export function boxesDeStructure(
  s: StructureDef,
  autres: readonly StructureDef[] = [],
): ObstacleBox[] {
  if (!structureViable(s)) return []
  const vides = autres
    .filter((o) => o !== s && structureViable(o))
    .map(polygonePerceur)
  const out: ObstacleBox[] = []
  for (const pan of pansDeStructure(s))
    for (const morceau of percePan(pan, vides))
      if (morceau.demiLong >= 4 && morceau.demiEp >= 4)
        out.push(panEnBoite(morceau))
  return out
}

/** Toutes les parois d'un plan de structures, percées entre elles. */
export function boxesDesStructures(
  structures: readonly StructureDef[] | undefined,
): ObstacleBox[] {
  if (!structures || structures.length === 0) return []
  const out: ObstacleBox[] = []
  for (const s of structures) out.push(...boxesDeStructure(s, structures))
  return out
}

/** Ce que coûte un plan de structures, en blocs dessinés. */
export function coutStructures(
  structures: readonly StructureDef[] | undefined,
): number {
  return boxesDesStructures(structures).length
}

/** LE TABLEAU TEL QUE LE MOTEUR LE VOIT : les parois des structures
 * D'ABORD (en cas de dépassement du budget, mieux vaut perdre un meuble
 * qu'un mur), le mobilier posé ensuite. Sans structure, c'est le tableau
 * LUI-MÊME qui revient — même référence : rien de ce qui existe ne change. */
export function niveauExpanse(level: LevelDef): LevelDef {
  if (!level.structures || level.structures.length === 0) return level
  return {
    ...level,
    boxes: [...boxesDesStructures(level.structures), ...level.boxes],
  }
}

