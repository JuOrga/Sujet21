// LE PAVAGE — un motif répété en grille, JOINTURES COMPRISES.
//
// La demande (11/09) : le tableau « démineur » est fait d'UNE cellule — une
// chambre chanfreinée, sa cachette, sa pastille numérotée, ses portes — que
// le concepteur veut poser à quatre par tableau, ou plus. Dupliquer (D)
// reproduit un élément à la fois et laisse à la main tout ce qui fait la
// JOINTURE entre deux cellules :
//
//   · le RECOUVREMENT des coques, pour que la paroi mitoyenne soit UNE
//     paroi et non deux dos à dos (la « paroi commune ») ;
//   · la FENTE de chaque face en regard — deux coques qui ne font que se
//     toucher ne devinent aucune porte : le milieu d'une face n'entre
//     jamais dans le vide de l'autre (structures.ts, dansLeVide est strict),
//     il faut donc FORCER les ouvertures, des deux côtés, à la même largeur ;
//   · la PORTE ASSERVIE qui doit traverser toute la jointure (une paroi
//     partagée, ou les deux parois accolées), centrée sur la fente — la
//     fente d'une coque est toujours au milieu de sa face ;
//   · les NUMÉROS DE CANAL : chaque cellule reçoit les siens, ses portes
//     suivent — sinon toutes les pastilles copiées commandent les mêmes
//     portes et le démineur n'a plus qu'une seule case ;
//   · les portes du motif qui tombent sur le BORD du pavage : elles
//     n'ouvriraient plus que sur le dehors — on les retire et l'on referme
//     la face.
//
// Ce module est PUR (pas de DOM) : il reçoit le tableau, le motif (des
// indices par famille) et les réglages, et modifie le tableau EN PLACE ;
// l'éditeur committe ensuite. Tout ce qu'il décide se teste.

import type { LevelDef, PorteDef, StructureDef } from '../game/level'
import {
  cotesOuverts,
  epaisseurDessinee,
  structureViable,
} from '../game/structures'
import {
  COQUE_EST,
  COQUE_NORD,
  COQUE_OUEST,
  COQUE_PORTE_DEFAUT,
  COQUE_PORTE_PAS,
  COQUE_SUD,
} from '../game/formes'
import { canalDeCible } from '../game/laser'
import { MAX_LUMIERES } from '../render/renderer'

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Les familles du tableau qu'un motif peut retenir — tout ce qui existe
 *  en plusieurs exemplaires. Le départ, le sas, la fiole, le banc et le
 *  marchand sont uniques : ils restent où ils sont. */
export const FAMILLES_MOTIF = [
  'structures',
  'boxes',
  'sponges',
  'zones',
  'caches',
  'labels',
  'lasers',
  'cibles',
  'portes',
  'chasses',
  'condensats',
  'plots',
  'pupitres',
  'eclats',
  'ancres',
  'rails',
  'lumieres',
  'decals',
] as const
export type FamilleMotif = (typeof FAMILLES_MOTIF)[number]

/** Le MOTIF : des indices dans le tableau, par famille. */
export type Motif = Record<FamilleMotif, number[]>

export function motifVide(): Motif {
  const m = {} as Motif
  for (const f of FAMILLES_MOTIF) m[f] = []
  return m
}

export function tailleMotif(m: Motif): number {
  let n = 0
  for (const f of FAMILLES_MOTIF) n += m[f].length
  return n
}

/** La JOINTURE entre deux cellules voisines :
 *   · partagee — les coques se recouvrent d'une épaisseur, la paroi
 *     mitoyenne est UNE paroi (le kit du démineur) ;
 *   · accolee — deux parois dos à dos, chaque coque garde la sienne ;
 *   · espacee — un écart entre les cellules, à relier soi-même (couloirs) :
 *     rien n'est percé, le motif est recopié tel quel. */
export type Jointure = 'partagee' | 'accolee' | 'espacee'

export interface ReglagesPavage {
  colonnes: number
  rangees: number
  jointure: Jointure
  /** L'écart entre deux cellules (jointure « espacee » seulement). */
  ecart: number
  /** Numéroter les canaux par cellule : les pastilles copiées prennent les
   *  numéros libres suivants et leurs portes suivent. Faux : les copies
   *  partagent les canaux du motif. */
  canaux: boolean
}

export const REGLAGES_PAVAGE_DEFAUT: ReglagesPavage = {
  colonnes: 2,
  rangees: 2,
  jointure: 'partagee',
  ecart: 200,
  canaux: true,
}

/** Par axe : 144 cellules, déjà bien au-delà du budget de blocs. */
export const PAVAGE_MAX = 12

export interface BilanPavage {
  /** Les cellules AJOUTÉES (le motif lui-même n'en est pas une). */
  cellules: number
  /** Les éléments ajoutés, portes de jointure comprises. */
  elements: number
  /** Les portes reconstruites À CHEVAL sur une jointure. */
  portesJointure: number
  /** Les portes du motif retirées parce qu'elles tombaient sur le bord. */
  portesRetirees: number
  bornesEtendues: boolean
  /** Ce qui n'a pas pu être copié, dit en clair. */
  ignores: string[]
}

// ——— L'emprise de chaque élément ————————————————————————————————————

const R_CIBLE_DEFAUT = 30
const R_POINT = 26

function normalise(r: Rect): Rect {
  return {
    minX: Math.min(r.minX, r.maxX),
    minY: Math.min(r.minY, r.maxY),
    maxX: Math.max(r.minX, r.maxX),
    maxY: Math.max(r.minY, r.maxY),
  }
}

/** L'emprise (monde) d'un élément d'une famille — partagée avec le presse-papier. */
export function rectDe(level: LevelDef, f: FamilleMotif, i: number): Rect | null {
  const pt = (
    p: { x: number; y: number } | undefined,
    r: number,
  ): Rect | null =>
    p ? { minX: p.x - r, minY: p.y - r, maxX: p.x + r, maxY: p.y + r } : null
  switch (f) {
    case 'structures':
    case 'boxes':
    case 'zones':
    case 'caches':
    case 'portes':
    case 'chasses':
    case 'plots':
    case 'pupitres':
    case 'ancres': {
      const r = (level[f] ?? [])[i]
      return r ? normalise(r) : null
    }
    case 'sponges': {
      const sp = level.sponges[i]
      return sp
        ? {
            minX: sp.minX,
            minY: sp.minY,
            maxX: sp.minX + sp.cols * sp.cellSize,
            maxY: sp.minY + sp.rows * sp.cellSize,
          }
        : null
    }
    case 'labels':
      return pt(level.labels[i], 0)
    case 'lasers':
      return pt((level.lasers ?? [])[i], 0)
    case 'lumieres':
      return pt((level.lumieres ?? [])[i], 0)
    case 'cibles': {
      const c = (level.cibles ?? [])[i]
      return pt(c, c?.r ?? R_CIBLE_DEFAUT)
    }
    case 'condensats':
      return pt((level.condensats ?? [])[i], R_POINT)
    case 'eclats':
      return pt((level.eclats ?? [])[i], R_POINT)
    case 'decals': {
      const d = (level.decals ?? [])[i]
      return d
        ? {
            minX: d.x - d.w / 2,
            minY: d.y - d.h / 2,
            maxX: d.x + d.w / 2,
            maxY: d.y + d.h / 2,
          }
        : null
    }
    case 'rails': {
      const r = (level.rails ?? [])[i]
      if (!r || r.points.length === 0) return null
      const out = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      }
      for (const p of r.points) {
        out.minX = Math.min(out.minX, p.x)
        out.minY = Math.min(out.minY, p.y)
        out.maxX = Math.max(out.maxX, p.x)
        out.maxY = Math.max(out.maxY, p.y)
      }
      return out
    }
  }
}

function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b
  if (!b) return a
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

const dedans = (r: Rect, x: number, y: number): boolean =>
  x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY

const seCroisent = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

// ——— Le motif ——————————————————————————————————————————————————————

/** Le motif d'UNE STRUCTURE : la coque et tout ce dont le centre tombe
 *  dans son emprise — le mobilier, la cachette, la pastille, les portes
 *  posées à cheval sur sa paroi (leur centre est dans la paroi, donc dans
 *  l'emprise). Une seconde coque centrée dedans (un couloir intérieur) suit
 *  aussi. C'est le geste d'un clic : sélectionner la chambre suffit. */
export function motifDeStructure(level: LevelDef, index: number): Motif {
  const m = motifVide()
  const emp = rectDe(level, 'structures', index)
  if (!emp) return m
  for (const f of FAMILLES_MOTIF) {
    const n = (level[f] ?? []).length
    for (let i = 0; i < n; i++) {
      if (f === 'structures' && i === index) continue
      const r = rectDe(level, f, i)
      if (r && dedans(emp, (r.minX + r.maxX) / 2, (r.minY + r.maxY) / 2))
        m[f].push(i)
    }
  }
  m.structures.unshift(index)
  return m
}

/** Une référence de sélection, telle que l'éditeur les tient : la sorte
 *  et, pour les familles à plusieurs exemplaires, l'indice. */
export interface RefSelection {
  kind: string
  index?: number
}

export const FAMILLE_DE_SORTE: Record<string, FamilleMotif> = {
  structure: 'structures',
  box: 'boxes',
  sponge: 'sponges',
  zone: 'zones',
  cache: 'caches',
  label: 'labels',
  laser: 'lasers',
  cible: 'cibles',
  porte: 'portes',
  chasse: 'chasses',
  condensat: 'condensats',
  plot: 'plots',
  pupitre: 'pupitres',
  eclat: 'eclats',
  ancre: 'ancres',
  rail: 'rails',
  lumiere: 'lumieres',
  decal: 'decals',
}

export const NOMS_UNIQUES: Record<string, string> = {
  spawn: 'le départ',
  exit: 'le sas',
  fiole: 'la fiole',
  banc: 'le banc des mémoires',
  marchand: 'le marchand',
}

/** Le motif d'une SÉLECTION MULTIPLE : exactement ce qui est retenu. Les
 *  éléments uniques du tableau ne se copient pas — ils sont nommés. */
export function motifDeSelection(refs: readonly RefSelection[]): {
  motif: Motif
  ignores: string[]
} {
  const motif = motifVide()
  const ignores: string[] = []
  for (const r of refs) {
    const f = FAMILLE_DE_SORTE[r.kind]
    if (f && r.index !== undefined) {
      if (!motif[f].includes(r.index)) motif[f].push(r.index)
    } else if (NOMS_UNIQUES[r.kind]) ignores.push(NOMS_UNIQUES[r.kind])
  }
  return { motif, ignores }
}

/** L'EMPRISE du motif — la cellule : celle des coques quand il en a (c'est
 *  leur paroi qui fait la jointure), sinon la boîte englobante de tout. */
export function empriseMotif(level: LevelDef, m: Motif): Rect | null {
  let r: Rect | null = null
  if (m.structures.length > 0) {
    for (const i of m.structures) r = union(r, rectDe(level, 'structures', i))
    return r
  }
  for (const f of FAMILLES_MOTIF)
    for (const i of m[f]) r = union(r, rectDe(level, f, i))
  return r
}

// ——— Les côtés et les jointures ————————————————————————————————————

type Cote = 'nord' | 'est' | 'sud' | 'ouest'
const COTES: readonly Cote[] = ['nord', 'est', 'sud', 'ouest']
const BIT: Record<Cote, number> = {
  nord: COQUE_NORD,
  est: COQUE_EST,
  sud: COQUE_SUD,
  ouest: COQUE_OUEST,
}
const OPPOSE: Record<Cote, Cote> = {
  nord: 'sud',
  est: 'ouest',
  sud: 'nord',
  ouest: 'est',
}
const TOL = 1
/** Un côté est-il LATÉRAL (est/ouest : la porte s'étend en y) ? */
const lateral = (c: Cote): boolean => c === 'est' || c === 'ouest'

/** Une coque DROITE touche-t-elle ce bord de la cellule ? (une coque
 *  tournée n'a pas de face en regard : elle ne fait pas de jointure) */
function toucheBord(s: StructureDef, cell: Rect, c: Cote): boolean {
  if (s.angle || !structureViable(s)) return false
  const r = normalise(s)
  if (c === 'ouest') return Math.abs(r.minX - cell.minX) <= TOL
  if (c === 'est') return Math.abs(r.maxX - cell.maxX) <= TOL
  if (c === 'sud') return Math.abs(r.minY - cell.minY) <= TOL
  return Math.abs(r.maxY - cell.maxY) <= TOL
}

/** L'épaisseur de paroi que la cellule présente sur ce bord : la plus
 *  grande des coques droites qui le touchent — 0 sans coque. */
function epaisseurBord(
  structs: readonly StructureDef[],
  cell: Rect,
  c: Cote,
): number {
  let e = 0
  for (const s of structs)
    if (toucheBord(s, cell, c)) e = Math.max(e, epaisseurDessinee(s))
  return e
}

/** Sur quel bord de la cellule une porte du motif est-elle posée ? Une
 *  porte « de côté » chevauche la bande de paroi de ce bord ; à défaut de
 *  paroi (pas de coque), elle en touche la ligne. Ailleurs : intérieure. */
function coteDePorte(
  p: Rect,
  cell: Rect,
  ep: Record<Cote, number>,
): Cote | null {
  if (p.minX <= cell.minX + ep.ouest + TOL && p.maxX >= cell.minX - TOL)
    return 'ouest'
  if (p.maxX >= cell.maxX - ep.est - TOL && p.minX <= cell.maxX + TOL)
    return 'est'
  if (p.minY <= cell.minY + ep.sud + TOL && p.maxY >= cell.minY - TOL)
    return 'sud'
  if (p.maxY >= cell.maxY - ep.nord - TOL && p.minY <= cell.maxY + TOL)
    return 'nord'
  return null
}

/** La FENTE ne doit jamais dépasser la porte qui la couvre (sinon un jour
 *  reste ouvert à côté de la porte fermée) : on arrondit par défaut au pas
 *  du format, et jamais sous un pas. */
const fenteSous = (largeur: number): number =>
  Math.max(
    COQUE_PORTE_PAS,
    Math.floor(largeur / COQUE_PORTE_PAS) * COQUE_PORTE_PAS,
  )

/** L'étendue d'une porte EN TRAVERS d'un côté, et son centre. */
function travers(p: Rect, c: Cote): { largeur: number; centre: number } {
  return lateral(c)
    ? { largeur: p.maxY - p.minY, centre: (p.minY + p.maxY) / 2 }
    : { largeur: p.maxX - p.minX, centre: (p.minX + p.maxX) / 2 }
}

/** L'intervalle d'une coque en travers d'un côté. */
function etendue(s: Rect, c: Cote): { a: number; b: number } {
  const r = normalise(s)
  return lateral(c) ? { a: r.minY, b: r.maxY } : { a: r.minX, b: r.maxX }
}

// ——— Le pavage ——————————————————————————————————————————————————————

interface Cellule {
  c: number
  r: number
  k: number
  dx: number
  dy: number
  /** La table des canaux de la cellule : ceux du motif → les siens. */
  canaux: Map<number, number>
}

const decaleRect = <T extends Rect>(o: T, dx: number, dy: number): T => ({
  ...o,
  minX: o.minX + dx,
  minY: o.minY + dy,
  maxX: o.maxX + dx,
  maxY: o.maxY + dy,
})
const decalePt = <T extends { x: number; y: number }>(
  o: T,
  dx: number,
  dy: number,
): T => ({ ...o, x: o.x + dx, y: o.y + dy })

/** RÉPÈTE le motif en grille — colonnes vers l'est, rangées vers le sud,
 *  le motif restant la cellule (0, 0). Modifie le tableau EN PLACE. */
export function pave(
  level: LevelDef,
  motif: Motif,
  reglages: ReglagesPavage,
): BilanPavage {
  const bilan: BilanPavage = {
    cellules: 0,
    elements: 0,
    portesJointure: 0,
    portesRetirees: 0,
    bornesEtendues: false,
    ignores: [],
  }
  const colonnes = Math.max(
    1,
    Math.min(PAVAGE_MAX, Math.round(reglages.colonnes)),
  )
  const rangees = Math.max(1, Math.min(PAVAGE_MAX, Math.round(reglages.rangees)))
  const cell = empriseMotif(level, motif)
  if (!cell || (colonnes === 1 && rangees === 1)) return bilan
  const jointe = reglages.jointure !== 'espacee'

  const structsAvant = level.structures ?? []
  const motifStructs = motif.structures
    .map((i) => structsAvant[i])
    .filter((s): s is StructureDef => !!s)
  const horsMotif = structsAvant.filter((_, i) => !motif.structures.includes(i))
  const ep: Record<Cote, number> = {
    nord: epaisseurBord(motifStructs, cell, 'nord'),
    est: epaisseurBord(motifStructs, cell, 'est'),
    sud: epaisseurBord(motifStructs, cell, 'sud'),
    ouest: epaisseurBord(motifStructs, cell, 'ouest'),
  }
  const w = cell.maxX - cell.minX
  const h = cell.maxY - cell.minY
  // LE PAS : paroi commune, les coques se recouvrent d'une épaisseur — il
  // faut une paroi de chaque côté pour qu'elles se confondent
  const recouvX =
    reglages.jointure === 'partagee' ? Math.min(ep.est, ep.ouest) : 0
  const recouvY =
    reglages.jointure === 'partagee' ? Math.min(ep.nord, ep.sud) : 0
  const ecart = reglages.jointure === 'espacee' ? Math.max(0, reglages.ecart) : 0
  const pasX = w - recouvX + ecart
  const pasY = h - recouvY + ecart

  // ---- Les canaux -------------------------------------------------------
  const ciblesAvant = level.cibles ?? []
  const canauxMotif = [
    ...new Set(motif.cibles.map((i) => canalDeCible(ciblesAvant, i))),
  ].sort((a, b) => a - b)
  const pris = new Set<number>()
  for (let i = 0; i < ciblesAvant.length; i++)
    pris.add(canalDeCible(ciblesAvant, i))
  const prochainLibre = (): number => {
    let n = 1
    while (pris.has(n)) n++
    pris.add(n)
    return n
  }
  const canalDe = (
    t: Map<number, number>,
    c: number | undefined,
  ): number | undefined => (c === undefined ? undefined : (t.get(c) ?? c))

  // ---- Les cellules, dans l'ordre de lecture ----------------------------
  const cellules: Cellule[] = []
  for (let r = 0; r < rangees; r++)
    for (let c = 0; c < colonnes; c++) {
      const k = r * colonnes + c
      const canaux = new Map<number, number>()
      if (k > 0 && reglages.canaux)
        for (const cm of canauxMotif) canaux.set(cm, prochainLibre())
      cellules.push({ c, r, k, dx: c * pasX, dy: -r * pasY, canaux })
    }
  const copies = cellules.slice(1)
  const aVoisin = (cel: Cellule, cote: Cote): boolean =>
    (cote === 'ouest' && cel.c > 0) ||
    (cote === 'est' && cel.c < colonnes - 1) ||
    (cote === 'nord' && cel.r > 0) ||
    (cote === 'sud' && cel.r < rangees - 1)

  // ---- Les portes du motif, classées par côté --------------------------
  const portesAvant = level.portes ?? []
  const portesMotif = motif.portes
    .map((i) => ({ i, p: portesAvant[i], cote: null as Cote | null }))
    .filter((x): x is { i: number; p: PorteDef; cote: Cote | null } => !!x.p)
  for (const x of portesMotif) x.cote = jointe ? coteDePorte(x.p, cell, ep) : null

  // Une porte de bord est PENDANTE quand rien ne l'attend dehors : ni une
  // cellule voisine du pavage, ni une coque étrangère au motif.
  const pendante = (cote: Cote, cel: Cellule, p: PorteDef): boolean => {
    if (aVoisin(cel, cote)) return false
    const rp = decaleRect(p, cel.dx, cel.dy)
    return !horsMotif.some((s) => seCroisent(rp, normalise(s)))
  }

  // ---- 1. Les coques : copies, puis ouvertures forcées -------------------
  // Les faces en regard d'une jointure s'ouvrent des deux côtés, à la
  // largeur de la porte qui la traverse (à défaut, la porte du kit) ; une
  // face de bord dont la porte est retirée se referme. Une copie ne
  // connaît que le motif : ses côtés « devinés » le sont parmi les coques
  // du motif seulement — un couloir qui touchait l'original n'ouvre rien
  // chez elle.
  const largeurPorteCote = (s: StructureDef, cote: Cote): number => {
    let l = 0
    for (const { p, cote: cp } of portesMotif) {
      // la porte du côté OPPOSÉ est celle que la cellule voisine apporte :
      // même géométrie, décalée d'une cellule — sa position en travers ne
      // change pas, c'est elle qui compte
      if (cp !== cote && cp !== OPPOSE[cote]) continue
      const t = travers(p, cote)
      const e = etendue(s, cote)
      if (t.centre < e.a || t.centre > e.b) continue
      l = Math.max(l, t.largeur)
    }
    return l
  }
  // L'ÉTAT DE DÉPART de chaque coque, figé AVANT la boucle : l'original
  // est modifié en place à la cellule 0, et les copies liraient sinon ses
  // faces déjà forcées comme si le concepteur les avait choisies.
  const bases = new Map(
    motif.structures.map((i) => {
      const o = structsAvant[i]
      return [
        i,
        o && {
          ouvertures: o.ouvertures,
          porte: o.porte,
          devineTout: cotesOuverts(o, structsAvant).cotes,
          devineMotif: cotesOuverts(o, motifStructs).cotes,
        },
      ] as const
    }),
  )
  const structsNeuves: { st: StructureDef; k: number }[] = []
  for (const cel of cellules) {
    for (const i of motif.structures) {
      const orig = structsAvant[i]
      const base = bases.get(i)
      if (!orig || !base) continue
      const st: StructureDef =
        cel.k === 0 ? orig : decaleRect({ ...orig }, cel.dx, cel.dy)
      if (jointe) {
        let mask =
          base.ouvertures !== undefined
            ? base.ouvertures
            : cel.k === 0
              ? base.devineTout
              : base.devineMotif
        let porte = base.porte ?? 0
        for (const cote of COTES) {
          if (!toucheBord(orig, cell, cote)) continue
          if (aVoisin(cel, cote)) {
            mask |= BIT[cote]
            const l = largeurPorteCote(orig, cote)
            porte = Math.max(porte, l > 0 ? fenteSous(l) : COQUE_PORTE_DEFAUT)
          } else if (
            portesMotif.some(
              (x) => x.cote === cote && pendante(cote, cel, x.p),
            )
          )
            mask &= ~BIT[cote]
        }
        st.ouvertures = mask
        if (porte > 0) st.porte = porte
        else delete st.porte
      }
      if (cel.k > 0) structsNeuves.push({ st, k: cel.k })
    }
  }
  if (structsNeuves.length > 0) {
    level.structures = [...structsAvant, ...structsNeuves.map((x) => x.st)]
    bilan.elements += structsNeuves.length
  }
  const structsCellule = (k: number): readonly StructureDef[] =>
    k === 0 ? motifStructs : structsNeuves.filter((x) => x.k === k).map((x) => x.st)

  // ---- 2. Le mobilier : copies décalées ---------------------------------
  const ajoute = <T>(liste: readonly T[] | undefined, items: T[]): T[] => {
    bilan.elements += items.length
    return [...(liste ?? []), ...items]
  }
  const rects = <T extends Rect>(src: readonly T[] | undefined, idx: number[]): T[] => {
    const items: T[] = []
    for (const cel of copies)
      for (const i of idx) {
        const o = src?.[i]
        if (o) items.push(decaleRect(o, cel.dx, cel.dy))
      }
    return items
  }
  const points = <T extends { x: number; y: number }>(
    src: readonly T[] | undefined,
    idx: number[],
  ): T[] => {
    const items: T[] = []
    for (const cel of copies)
      for (const i of idx) {
        const o = src?.[i]
        if (o) items.push(decalePt(o, cel.dx, cel.dy))
      }
    return items
  }
  if (motif.boxes.length > 0)
    level.boxes = ajoute(level.boxes, rects(level.boxes, motif.boxes))
  if (motif.zones.length > 0)
    level.zones = ajoute(level.zones, rects(level.zones, motif.zones))
  if (motif.caches.length > 0)
    level.caches = ajoute(level.caches, rects(level.caches, motif.caches))
  if (motif.plots.length > 0)
    level.plots = ajoute(level.plots, rects(level.plots, motif.plots))
  if (motif.pupitres.length > 0)
    level.pupitres = ajoute(level.pupitres, rects(level.pupitres, motif.pupitres))
  if (motif.ancres.length > 0)
    level.ancres = ajoute(level.ancres, rects(level.ancres, motif.ancres))
  if (motif.sponges.length > 0) {
    const items: typeof level.sponges = []
    for (const cel of copies)
      for (const i of motif.sponges) {
        const sp = level.sponges[i]
        if (sp)
          items.push({ ...sp, minX: sp.minX + cel.dx, minY: sp.minY + cel.dy })
      }
    level.sponges = ajoute(level.sponges, items)
  }
  if (motif.labels.length > 0) {
    const items: typeof level.labels = []
    for (const cel of copies)
      for (const i of motif.labels) {
        const l = level.labels[i]
        if (!l) continue
        // la CLÉ désigne UN panneau que le jeu manipule : une copie n'en
        // porte pas, elle ne serait qu'un doublon ambigu
        const { cle: _cle, ...reste } = l
        items.push(decalePt(reste, cel.dx, cel.dy))
      }
    level.labels = ajoute(level.labels, items)
  }
  if (motif.lasers.length > 0)
    level.lasers = ajoute(level.lasers, points(level.lasers, motif.lasers))
  if (motif.condensats.length > 0)
    level.condensats = ajoute(
      level.condensats,
      points(level.condensats, motif.condensats),
    )
  if (motif.eclats.length > 0)
    level.eclats = ajoute(level.eclats, points(level.eclats, motif.eclats))
  if (motif.decals.length > 0)
    level.decals = ajoute(level.decals, points(level.decals, motif.decals))
  if (motif.rails.length > 0) {
    const src = level.rails ?? []
    const items: typeof src = []
    for (const cel of copies)
      for (const i of motif.rails) {
        const r = src[i]
        if (r)
          items.push({
            ...r,
            points: r.points.map((p) => decalePt(p, cel.dx, cel.dy)),
          })
      }
    level.rails = ajoute(src, items)
  }
  if (motif.lumieres.length > 0) {
    const src = level.lumieres ?? []
    const items: typeof src = []
    let refusees = 0
    for (const cel of copies)
      for (const i of motif.lumieres) {
        const l = src[i]
        if (!l) continue
        if (src.length + items.length >= MAX_LUMIERES) refusees++
        else items.push(decalePt(l, cel.dx, cel.dy))
      }
    level.lumieres = ajoute(src, items)
    if (refusees > 0)
      bilan.ignores.push(
        `${refusees} lampe${refusees > 1 ? 's' : ''} (plafond de ${MAX_LUMIERES})`,
      )
  }

  // ---- 3. Les pastilles et ce qu'elles commandent ------------------------
  if (motif.cibles.length > 0) {
    const items: typeof ciblesAvant = []
    for (const cel of copies)
      for (const i of motif.cibles) {
        const t = ciblesAvant[i]
        if (!t) continue
        // la copie porte son numéro EN CLAIR : le défaut (rang + 1) ne
        // vaudrait plus rien une fois la liste allongée
        const canal = canalDeCible(ciblesAvant, i)
        items.push({
          ...decalePt(t, cel.dx, cel.dy),
          canal: canalDe(cel.canaux, canal) ?? canal,
        })
      }
    level.cibles = ajoute(ciblesAvant, items)
  }
  if (motif.chasses.length > 0) {
    const src = level.chasses ?? []
    const items: typeof src = []
    for (const cel of copies)
      for (const i of motif.chasses) {
        const ch = src[i]
        if (!ch) continue
        const copie = decaleRect({ ...ch }, cel.dx, cel.dy)
        const canal = canalDe(cel.canaux, ch.canal)
        if (canal !== undefined) copie.canal = canal
        items.push(copie)
      }
    level.chasses = ajoute(src, items)
  }

  // ---- 4. Les portes ------------------------------------------------------
  // Intérieures : copiées, leur canal suit la cellule. De bord, pendantes :
  // retirées. De jointure : RECONSTRUITES — une par porte et par jointure,
  // traversant toute la jointure d'une face intérieure à l'autre, centrée
  // sur la face (la fente d'une coque est toujours au milieu).
  const portesNeuves: PorteDef[] = []
  const gardees = new Set<number>()
  const centreFace = (k: number, cote: Cote, centre: number): number => {
    for (const s of structsCellule(k)) {
      const e = etendue(s, cote)
      if (
        centre >= e.a &&
        centre <= e.b &&
        s.ouvertures !== undefined &&
        (s.ouvertures & BIT[cote]) !== 0
      )
        return (e.a + e.b) / 2
    }
    return centre
  }
  const copieTelle = (cel: Cellule, i: number, p: PorteDef): void => {
    if (cel.k === 0) gardees.add(i)
    else {
      const copie = decaleRect({ ...p }, cel.dx, cel.dy)
      copie.canal = canalDe(cel.canaux, p.canal) ?? p.canal
      portesNeuves.push(copie)
    }
  }
  for (const cel of cellules) {
    for (const { i, p, cote } of portesMotif) {
      if (cote === null) {
        copieTelle(cel, i, p)
        continue
      }
      if (pendante(cote, cel, p)) {
        bilan.portesRetirees++
        continue
      }
      if (!aVoisin(cel, cote)) {
        // une coque étrangère l'attend dehors : elle reste telle quelle
        copieTelle(cel, i, p)
        continue
      }
      const t = travers(p, cote)
      const largeur = Math.max(COQUE_PORTE_PAS, t.largeur)
      const centre = centreFace(
        cel.k,
        cote,
        t.centre + (lateral(cote) ? cel.dy : cel.dx),
      )
      let porte: PorteDef
      if (cote === 'est') {
        porte = {
          ...p,
          minX: cell.maxX - ep.est + cel.dx,
          maxX: cell.minX + pasX + ep.ouest + cel.dx,
          minY: centre - largeur / 2,
          maxY: centre + largeur / 2,
        }
      } else if (cote === 'ouest') {
        porte = {
          ...p,
          minX: cell.maxX - pasX - ep.est + cel.dx,
          maxX: cell.minX + ep.ouest + cel.dx,
          minY: centre - largeur / 2,
          maxY: centre + largeur / 2,
        }
      } else if (cote === 'sud') {
        porte = {
          ...p,
          minY: cell.maxY - pasY - ep.nord + cel.dy,
          maxY: cell.minY + ep.sud + cel.dy,
          minX: centre - largeur / 2,
          maxX: centre + largeur / 2,
        }
      } else {
        porte = {
          ...p,
          minY: cell.maxY - ep.nord + cel.dy,
          maxY: cell.minY + pasY + ep.sud + cel.dy,
          minX: centre - largeur / 2,
          maxX: centre + largeur / 2,
        }
      }
      // sans paroi d'aucun côté (pas de coque), il n'y a rien à traverser :
      // la porte est simplement recopiée
      if (porte.maxX - porte.minX < 2 || porte.maxY - porte.minY < 2)
        porte = decaleRect({ ...p }, cel.dx, cel.dy)
      porte.canal = canalDe(cel.canaux, p.canal) ?? p.canal
      // la même jointure vue de l'autre cellule apporte parfois la même
      // porte (un motif percé à l'est ET à l'ouest) : la première posée
      // l'emporte, la seconde ne la double pas
      const doublon = portesNeuves.some(
        (q) =>
          Math.abs(q.minX - porte.minX) < 2 &&
          Math.abs(q.maxX - porte.maxX) < 2 &&
          Math.abs(q.minY - porte.minY) < 2 &&
          Math.abs(q.maxY - porte.maxY) < 2,
      )
      if (!doublon) {
        portesNeuves.push(porte)
        bilan.portesJointure++
      }
    }
  }
  const restantes = portesAvant.filter(
    (_, i) => !motif.portes.includes(i) || gardees.has(i),
  )
  const nbAvant = portesAvant.length
  level.portes = [...restantes, ...portesNeuves]
  bilan.elements += Math.max(0, level.portes.length - nbAvant)
  if (level.portes.length === 0) delete level.portes

  // ---- 5. Les bornes : la cuve s'agrandit si le pavage déborde -----------
  const derniere = cellules[cellules.length - 1]
  const tout: Rect = {
    minX: cell.minX,
    minY: cell.minY + derniere.dy,
    maxX: cell.maxX + derniere.dx,
    maxY: cell.maxY,
  }
  const b = level.bounds
  if (
    tout.minX < b.minX ||
    tout.minY < b.minY ||
    tout.maxX > b.maxX ||
    tout.maxY > b.maxY
  ) {
    b.minX = Math.min(b.minX, tout.minX)
    b.minY = Math.min(b.minY, tout.minY)
    b.maxX = Math.max(b.maxX, tout.maxX)
    b.maxY = Math.max(b.maxY, tout.maxY)
    bilan.bornesEtendues = true
  }

  bilan.cellules = cellules.length - 1
  return bilan
}

const pluriel = (n: number, mot: string): string =>
  `${n} ${mot}${n > 1 ? 's' : ''}`

/** Le compte rendu, en une phrase — celle de la barre d'état. */
export function phrasePavage(b: BilanPavage, r: ReglagesPavage): string {
  if (b.cellules === 0)
    return 'Rien à paver : le motif est vide, ou la grille fait 1 × 1.'
  const parts = [
    `Pavé ${r.colonnes} × ${r.rangees} : ${pluriel(b.cellules, 'cellule')} ajoutée${b.cellules > 1 ? 's' : ''}, ${pluriel(b.elements, 'élément')}`,
  ]
  if (r.jointure !== 'espacee')
    parts.push(
      b.portesJointure > 0
        ? `${pluriel(b.portesJointure, 'porte')} à cheval sur les jointures (${r.jointure === 'partagee' ? 'paroi commune' : 'parois accolées'})`
        : `faces en regard ouvertes, sans porte (${r.jointure === 'partagee' ? 'paroi commune' : 'parois accolées'})`,
    )
  if (b.portesRetirees > 0)
    parts.push(
      `${pluriel(b.portesRetirees, 'porte')} de bord retirée${b.portesRetirees > 1 ? 's' : ''}`,
    )
  if (b.bornesEtendues) parts.push('cuve agrandie')
  if (b.ignores.length > 0) parts.push(`non copié : ${b.ignores.join(', ')}`)
  return parts.join(' · ') + '.'
}
