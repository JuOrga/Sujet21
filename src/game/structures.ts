// LES STRUCTURES DE COQUE — le kit de construction du terrain de jeu.
//
// Une STRUCTURE est une coque VIDE : un anneau de parois qui enferme un
// volume jouable. On en pose deux sortes — une CHAMBRE (un rectangle
// ou un octogone, selon son chanfrein) et un COULOIR (un tube ouvert
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
  dansBoite,
  MAT_WALL,
  type LevelDef,
  type ObstacleBox,
  type StructureDef,
} from './level'
import {
  COQUE_EST,
  COQUE_NORD,
  COQUE_OUEST,
  COQUE_SUD,
  FORME_COQUE,
  coquePack,
  coqueUnpack,
} from './formes'

export const STRUCT_CHAMBRE = 0
export const STRUCT_COULOIR = 1
export const SORTES_STRUCTURE = [STRUCT_CHAMBRE, STRUCT_COULOIR] as const

/** L'épaisseur de coque par défaut, en unités monde. */
export const EP_DEFAUT = 40
export const EP_MIN = 12
export const EP_MAX = 240
/** Le chanfrein, en PART du demi-petit-côté (0 rectangle, 0.5 chanfrein maximal).
 * En part et non en unités : le concepteur redimensionne, et l'octogone
 * doit garder sa forme au lieu de s'écraser. */
export const CHANFREIN_DEFAUT = 0.25
export const CHANFREIN_MAX = 0.5
/** Le passage libre minimal : sous ça, la structure n'a plus d'intérieur. */
export const PASSAGE_MIN = 24

export interface RectStruct {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// ——— Les réglages effectifs d'une structure ————————————————————————

const borne = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

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

/** La structure a-t-elle une taille tenable ? Une coque très épaisse n'est
 * PAS refusée : elle se referme et devient un octogone PLEIN — un pilier,
 * une masse. C'est la même forme, remplie. Seule la coque dégénérée (plus
 * petite qu'un passage) n'a pas de sens. */
export function structureViable(s: StructureDef): boolean {
  const w = Math.abs(s.maxX - s.minX)
  const h = Math.abs(s.maxY - s.minY)
  return w >= 4 * PASSAGE_MIN && h >= 4 * PASSAGE_MIN
}

/** …et lui reste-t-il un VIDE ? (sinon c'est un plein, et rien ne la
 * traverse — l'éditeur le dit au concepteur plutôt que de le deviner) */
export function structureCreuse(s: StructureDef): boolean {
  const e = epaisseurDe(s)
  const w = Math.abs(s.maxX - s.minX)
  const h = Math.abs(s.maxY - s.minY)
  return w - 2 * e >= PASSAGE_MIN && h - 2 * e >= PASSAGE_MIN
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

// ——— La coque : UNE forme, UNE boîte ————————————————————————————————
//
// Une structure ne s'assemble plus : elle EST une forme creuse du moteur
// (FORME_COQUE). Un module = une boîte. Les portes ne se percent plus
// après coup — elles sont dans le champ de la forme, centrées sur les
// côtés qu'on ouvre.
//
// LA RÈGLE DU KIT : les modules se rejoignent CENTRE DE CÔTÉ contre
// CENTRE DE CÔTÉ. C'est ce qui fait qu'un assemblage est propre plutôt
// que bricolé — et c'est ce qui permet à la porte d'être une simple fente
// centrée, sans réglage de position.

const RAD = Math.PI / 180

/** Le rectangle intérieur d'une structure, en LOCAL (demi-largeurs). */
function demiInterieur(s: StructureDef): { hx: number; hy: number } {
  const e = epaisseurDe(s)
  return {
    hx: Math.abs(s.maxX - s.minX) / 2 - e,
    hy: Math.abs(s.maxY - s.minY) / 2 - e,
  }
}

function centreDe(s: StructureDef): { x: number; y: number } {
  return { x: (s.minX + s.maxX) / 2, y: (s.minY + s.maxY) / 2 }
}

/** Un point local reporté dans le monde (rotation autour du centre). */
function versMonde(
  s: StructureDef,
  px: number,
  py: number,
): { x: number; y: number } {
  const c = centreDe(s)
  const a = (s.angle ?? 0) * RAD
  const co = Math.cos(a)
  const si = Math.sin(a)
  return { x: c.x + co * px - si * py, y: c.y + si * px + co * py }
}

/** …et le chemin inverse. */
function versLocal(
  s: StructureDef,
  x: number,
  y: number,
): { x: number; y: number } {
  const c = centreDe(s)
  const a = -(s.angle ?? 0) * RAD
  const co = Math.cos(a)
  const si = Math.sin(a)
  const dx = x - c.x
  const dy = y - c.y
  return { x: co * dx - si * dy, y: si * dx + co * dy }
}

/** LA LARGEUR DE PASSAGE d'une structure : ce qu'un voisin doit ouvrir
 * chez elle pour que le corps traverse. */
export function passageDe(s: StructureDef): number {
  const { hx, hy } = demiInterieur(s)
  if (s.type === STRUCT_COULOIR) return 2 * Math.max(0, Math.min(hx, hy))
  return 2 * Math.max(0, Math.min(hx, hy))
}

/** Le point est-il dans le VIDE d'une structure ? Le vide d'un couloir
 * déborde d'une épaisseur à chaque bout : c'est ce débord qui vient
 * chercher la paroi d'en face et lui demander sa porte. */
function dansLeVide(s: StructureDef, x: number, y: number): boolean {
  const p = versLocal(s, x, y)
  const { hx, hy } = demiInterieur(s)
  if (hx <= 0 || hy <= 0) return false
  const e = epaisseurDe(s)
  const marge = s.type === STRUCT_COULOIR ? e + 2 : 0
  const axe = axeDe(s)
  const dx = hx + (s.type === STRUCT_COULOIR && axe === 0 ? marge : 0)
  const dy = hy + (s.type === STRUCT_COULOIR && axe === 1 ? marge : 0)
  return Math.abs(p.x) < dx && Math.abs(p.y) < dy
}

/** LES CÔTÉS OUVERTS d'une structure. Forcés si le concepteur les a posés
 * (ouvertures) ; sinon DEVINÉS : un côté s'ouvre quand le vide d'une autre
 * structure vient toucher le milieu de sa face. */
export function cotesOuverts(
  s: StructureDef,
  autres: readonly StructureDef[],
): { cotes: number; porte: number } {
  const hx = Math.abs(s.maxX - s.minX) / 2
  const hy = Math.abs(s.maxY - s.minY) / 2
  if (s.ouvertures !== undefined)
    return {
      cotes: Math.max(0, Math.min(15, Math.round(s.ouvertures))),
      porte: s.porte ?? passageDe(s),
    }
  // un COULOIR est ouvert à ses deux bouts, par nature
  if (s.type === STRUCT_COULOIR)
    return {
      cotes: axeDe(s) === 0 ? COQUE_EST | COQUE_OUEST : COQUE_NORD | COQUE_SUD,
      porte: s.porte ?? passageDe(s),
    }
  const faces: [number, number, number][] = [
    [COQUE_NORD, 0, hy],
    [COQUE_EST, hx, 0],
    [COQUE_SUD, 0, -hy],
    [COQUE_OUEST, -hx, 0],
  ]
  let cotes = 0
  let porte = 0
  for (const [bit, px, py] of faces) {
    const m = versMonde(s, px, py)
    for (const o of autres) {
      if (o === s || !structureViable(o)) continue
      if (!dansLeVide(o, m.x, m.y)) continue
      cotes |= bit
      porte = Math.max(porte, passageDe(o))
      break
    }
  }
  return { cotes, porte: s.porte ?? (porte || passageDe(s)) }
}

/** L'ÉPAISSEUR TELLE QU'ELLE SERA DESSINÉE : le format serre l'épaisseur
 * par pas de 8 unités (coquePack). Un raccord calculé sur la valeur brute
 * tomberait à côté du mur réel de quelques unités — assez pour laisser une
 * marche visible. */
export function epaisseurDessinee(s: StructureDef): number {
  return coqueUnpack(coquePack({
    cotes: 0,
    chanfrein: 0,
    ep: epaisseurDe(s),
    porte: 0,
  })).ep
}

/** LE RACCORD. Un couloir se pose EN MORDANT dans les modules qu'il relie
 * — c'est ainsi qu'on dit « raccorde-les ». Mais s'il gardait cette
 * emprise, sa paroi traverserait le mur d'en face et dépasserait DANS la
 * salle : une marche à chaque porte, et deux blocs qui se chevauchent au
 * lieu de se raccorder.
 *
 * On rend donc au couloir sa vraie longueur : d'une FACE INTÉRIEURE à
 * l'autre. Le tube bute contre le mur, le mur reste d'un seul tenant, et
 * la jonction se lit comme une seule pièce. Le concepteur garde la main
 * (raccord: false) s'il veut l'emprise brute. */
export function boiteRaccordee(
  s: StructureDef,
  autres: readonly StructureDef[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  const brut = {
    minX: Math.min(s.minX, s.maxX),
    minY: Math.min(s.minY, s.maxY),
    maxX: Math.max(s.minX, s.maxX),
    maxY: Math.max(s.minY, s.maxY),
  }
  if (s.type !== STRUCT_COULOIR || s.raccord === false || s.angle) return brut
  const axe = axeDe(s)
  const c = centreDe(s)
  // l'axe long du couloir, et la coordonnée qu'il vise en travers
  const bas = axe === 0 ? brut.minX : brut.minY
  const haut = axe === 0 ? brut.maxX : brut.maxY
  const travers = axe === 0 ? c.y : c.x
  let a = bas
  let b = haut
  for (const o of autres) {
    if (o === s || o.angle || !structureViable(o)) continue
    const e = epaisseurDessinee(o)
    const oBas = axe === 0 ? Math.min(o.minX, o.maxX) : Math.min(o.minY, o.maxY)
    const oHaut = axe === 0 ? Math.max(o.minX, o.maxX) : Math.max(o.minY, o.maxY)
    const oT0 = (axe === 0 ? Math.min(o.minY, o.maxY) : Math.min(o.minX, o.maxX)) + e
    const oT1 = (axe === 0 ? Math.max(o.minY, o.maxY) : Math.max(o.minX, o.maxX)) - e
    // le couloir ne vise ce module que s'il tombe en face de son creux
    if (travers <= oT0 || travers >= oT1) continue
    // un module qui avalerait le couloir tout entier ne le raccourcit pas
    if (oBas < bas && oHaut > haut) continue
    if (oBas < bas && oHaut > bas) a = Math.max(a, oHaut - e) // il entre par là
    if (oHaut > haut && oBas < haut) b = Math.min(b, oBas + e)
  }
  // jamais au point de le faire disparaître
  if (b - a < 4 * PASSAGE_MIN) return brut
  return axe === 0
    ? { ...brut, minX: a, maxX: b }
    : { ...brut, minY: a, maxY: b }
}

/** LA COQUE d'une structure : UNE boîte, une forme creuse. */
export function boxesDeStructure(
  s: StructureDef,
  autres: readonly StructureDef[] = [],
): ObstacleBox[] {
  if (!structureViable(s)) return []
  const { cotes, porte } = cotesOuverts(s, autres)
  const petit = Math.min(
    Math.abs(s.maxX - s.minX) / 2,
    Math.abs(s.maxY - s.minY) / 2,
  )
  const { p0, p1 } = coquePack({
    cotes,
    chanfrein: s.type === STRUCT_COULOIR ? 0 : (s.chanfrein ?? CHANFREIN_DEFAUT),
    ep: epaisseurDe(s),
    // la porte ne peut pas manger toute la face : on lui laisse un montant
    porte: Math.max(0, Math.min(porte, 2 * petit - 2 * epaisseurDe(s))),
  })
  const r = boiteRaccordee(s, autres)
  const b: ObstacleBox = {
    ...r,
    material: s.material ?? MAT_WALL,
    forme: FORME_COQUE,
    p0,
    p1,
  }
  if (s.angle) b.angle = Math.max(-180, Math.min(180, s.angle))
  if (s.skin !== undefined && s.skin > 0) b.skin = s.skin
  const out = [b]
  // LA PORTE DE MATIÈRE d'un couloir : une lame en travers du passage. Elle
  // ne peut pas vivre dans la coque (une forme n'a qu'un matériau) — c'est
  // la seule pièce qu'une structure pose EN PLUS de sa coque.
  if (s.type === STRUCT_COULOIR && s.bouchon !== undefined) {
    const { hx, hy } = demiInterieur(s)
    const e = epaisseurDe(s)
    const axe = axeDe(s)
    const c = centreDe(s)
    const lame: ObstacleBox =
      axe === 0
        ? { minX: c.x - e / 2, minY: c.y - hy, maxX: c.x + e / 2, maxY: c.y + hy, material: s.bouchon }
        : { minX: c.x - hx, minY: c.y - e / 2, maxX: c.x + hx, maxY: c.y + e / 2, material: s.bouchon }
    if (s.angle) lame.angle = Math.max(-180, Math.min(180, s.angle))
    out.push(lame)
  }
  return out
}

/** Toutes les coques d'un plan — une boîte par structure. */
export function boxesDesStructures(
  structures: readonly StructureDef[] | undefined,
): ObstacleBox[] {
  if (!structures || structures.length === 0) return []
  const out: ObstacleBox[] = []
  for (const s of structures) out.push(...boxesDeStructure(s, structures))
  return out
}

/** Ce que coûte un plan de structures, en blocs dessinés : UN par coque. */
export function coutStructures(
  structures: readonly StructureDef[] | undefined,
): number {
  return boxesDesStructures(structures).length
}

/** L'intérieur d'une structure, en polygone MONDE : le vide qu'elle
 * enferme. Sert aux tests, à l'éclairage et au repérage. */
export function interieurStructure(s: StructureDef): { x: number; y: number }[] {
  const { hx, hy } = demiInterieur(s)
  if (hx <= 0 || hy <= 0) return []
  const e = epaisseurDe(s)
  const c = chanfreinDe(s)
  const pts: { x: number; y: number }[] = []
  if (s.type !== STRUCT_COULOIR && c > 0.5) {
    const d = Math.max(0, c - e * (Math.SQRT2 - 1))
    const dx = Math.min(d, hx - 1)
    const dy = Math.min(d, hy - 1)
    pts.push(
      { x: hx, y: hy - dy },
      { x: hx - dx, y: hy },
      { x: -(hx - dx), y: hy },
      { x: -hx, y: hy - dy },
      { x: -hx, y: -(hy - dy) },
      { x: -(hx - dx), y: -hy },
      { x: hx - dx, y: -hy },
      { x: hx, y: -(hy - dy) },
    )
  } else {
    pts.push(
      { x: hx, y: hy },
      { x: -hx, y: hy },
      { x: -hx, y: -hy },
      { x: hx, y: -hy },
    )
  }
  return pts.map((p) => versMonde(s, p.x, p.y))
}


/** Le point tombe-t-il sur la COQUE d'une structure (ses parois, pas son
 * vide) ? L'éditeur attrape une structure par ses murs : son intérieur
 * reste transparent au clic, on y pose le mobilier normalement. */
export function dansCoque(
  s: StructureDef,
  autres: readonly StructureDef[],
  x: number,
  y: number,
): boolean {
  return boxesDeStructure(s, autres).some((b) => dansBoite(b, x, y))
}

/** LE TABLEAU TEL QUE LE MOTEUR LE VOIT : les coques D'ABORD (en cas de
 * dépassement du budget, mieux vaut perdre un meuble qu'un mur), le
 * mobilier posé ensuite. Sans structure, c'est le tableau LUI-MÊME qui
 * revient — même référence : rien de ce qui existe ne change. */
export function niveauExpanse(level: LevelDef): LevelDef {
  if (!level.structures || level.structures.length === 0) return level
  return {
    ...level,
    boxes: [...boxesDesStructures(level.structures), ...level.boxes],
  }
}
