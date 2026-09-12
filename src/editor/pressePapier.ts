// LE PRESSE-PAPIER DE L'ÉDITEUR — le cadre de sélection, copier, coller.
//
// La demande (12/09) : « avec un rectangle de sélection, sélectionner plein
// d'éléments et copier-coller — et quand ça colle, il faut que le sélecteur
// soit sur ce qui a collé, afin de le déplacer immédiatement à la souris ».
// Jusqu'ici la sélection multiple se faisait élément par élément (Maj +
// clic) et Dupliquer (D) ne reproduisait qu'UN élément, décalé d'un pas
// fixe ; le pavage répète un motif en grille, mais ce n'est pas le geste
// d'un copier-coller libre.
//
// Trois briques, PURES (pas de DOM), testées :
//   · elementsDansCadre — ce que le cadre retient : les éléments ENTIÈREMENT
//     dedans (un cadre qui frôle une grande paroi ne l'embarque pas — on
//     vise ce qu'on entoure, pas ce qu'on effleure), uniques compris (le
//     départ ou le sas se déplacent avec le groupe, ils ne se copient pas) ;
//   · copie — des CLONES des éléments retenus, en coordonnées du monde,
//     avec l'emprise du groupe : le presse-papier ne pointe pas des indices
//     (ils bougent à la moindre suppression), il tient des objets ;
//   · colle — des clones NEUFS décalés, ajoutés au tableau, et les
//     références des nouveaux venus : l'éditeur en fait sa sélection, la
//     souris les emporte aussitôt. Coller deux fois donne deux groupes
//     indépendants ; modifier l'un ne touche ni l'autre ni le presse-papier.

import type { LevelDef } from '../game/level'
import { canalDeCible } from '../game/laser'
import { MAX_LUMIERES } from '../render/renderer'
import {
  FAMILLE_DE_SORTE,
  FAMILLES_MOTIF,
  NOMS_UNIQUES,
  rectDe,
  type FamilleMotif,
  type Rect,
  type RefSelection,
} from './pavage'

type Element<F extends FamilleMotif> = NonNullable<LevelDef[F]>[number]

/** Les copies, par famille, telles qu'elles étaient dans le monde. */
export type Copies = { [F in FamilleMotif]?: Element<F>[] }

export interface PressePapier {
  copies: Copies
  /** L'emprise du groupe copié — son centre sert à le poser sous le curseur. */
  emprise: Rect
  total: number
}

const SORTE_DE_FAMILLE: Record<FamilleMotif, string> = (() => {
  const out = {} as Record<FamilleMotif, string>
  for (const [sorte, f] of Object.entries(FAMILLE_DE_SORTE)) out[f] = sorte
  return out
})()

/** Les demi-tailles des éléments uniques, telles que l'éditeur les dessine
 *  (boundsOf) — pour que le cadre retienne ce qu'on voit. */
const DEMI_FIOLE = 30
const DEMI_MARCHAND = 40

const normalise = (r: Rect): Rect => ({
  minX: Math.min(r.minX, r.maxX),
  minY: Math.min(r.minY, r.maxY),
  maxX: Math.max(r.minX, r.maxX),
  maxY: Math.max(r.minY, r.maxY),
})

const contient = (cadre: Rect, r: Rect): boolean =>
  r.minX >= cadre.minX &&
  r.maxX <= cadre.maxX &&
  r.minY >= cadre.minY &&
  r.maxY <= cadre.maxY

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

// ——— Le cadre ———————————————————————————————————————————————————————

/** Tout ce qui tient ENTIÈREMENT dans le cadre (tracé dans n'importe quel
 *  sens), familles dans l'ordre du tableau puis les uniques. */
export function elementsDansCadre(level: LevelDef, cadre: Rect): RefSelection[] {
  const c = normalise(cadre)
  const refs: RefSelection[] = []
  for (const f of FAMILLES_MOTIF) {
    const n = (level[f] ?? []).length
    for (let i = 0; i < n; i++) {
      const r = rectDe(level, f, i)
      if (r && contient(c, r)) refs.push({ kind: SORTE_DE_FAMILLE[f], index: i })
    }
  }
  const pt = (p: { x: number; y: number }, demi: number): Rect => ({
    minX: p.x - demi,
    minY: p.y - demi,
    maxX: p.x + demi,
    maxY: p.y + demi,
  })
  if (contient(c, pt(level.spawn, 0))) refs.push({ kind: 'spawn' })
  if (contient(c, normalise(level.exit))) refs.push({ kind: 'exit' })
  if (level.fiole && contient(c, pt(level.fiole, DEMI_FIOLE)))
    refs.push({ kind: 'fiole' })
  if (level.bancMemoires && contient(c, normalise(level.bancMemoires)))
    refs.push({ kind: 'banc' })
  if (level.marchand && contient(c, pt(level.marchand, DEMI_MARCHAND)))
    refs.push({ kind: 'marchand' })
  return refs
}

// ——— Copier ——————————————————————————————————————————————————————————

/** Clone les éléments désignés. Les uniques ne se copient pas : ils sont
 *  nommés. Sans rien de copiable, pas de presse-papier. */
export function copie(
  level: LevelDef,
  refs: readonly RefSelection[],
): { presse: PressePapier | null; ignores: string[] } {
  const ignores: string[] = []
  const parFamille = new Map<FamilleMotif, Set<number>>()
  for (const r of refs) {
    const f = FAMILLE_DE_SORTE[r.kind]
    if (f && r.index !== undefined) {
      const s = parFamille.get(f) ?? new Set<number>()
      s.add(r.index)
      parFamille.set(f, s)
    } else if (NOMS_UNIQUES[r.kind] && !ignores.includes(NOMS_UNIQUES[r.kind]))
      ignores.push(NOMS_UNIQUES[r.kind])
  }
  const copies: Copies = {}
  let emprise: Rect | null = null
  let total = 0
  for (const f of FAMILLES_MOTIF) {
    const indices = parFamille.get(f)
    if (!indices) continue
    const src = (level[f] ?? []) as readonly Element<typeof f>[]
    const items: Element<typeof f>[] = []
    // dans l'ordre du tableau : l'ordre de peinture des originaux se
    // retrouve chez les copies
    for (const i of [...indices].sort((a, b) => a - b)) {
      const o = src[i]
      if (!o) continue
      const clone = structuredClone(o) as Element<typeof f>
      if (f === 'cibles') {
        // la copie porte le NUMÉRO logique de l'originale, en clair : une
        // « cible 1 » collée reste une cible 1 — comme Dupliquer
        ;(clone as Element<'cibles'>).canal = canalDeCible(level.cibles ?? [], i)
      } else if (f === 'labels') {
        // la CLÉ désigne UN panneau que le jeu manipule : une copie n'en
        // porte pas, elle ne serait qu'un doublon ambigu (même règle qu'au
        // pavage)
        delete (clone as Element<'labels'>).cle
      }
      items.push(clone)
      emprise = union(emprise, rectDe(level, f, i))
      total++
    }
    if (items.length > 0) (copies as Record<string, unknown[]>)[f] = items
  }
  if (total === 0 || !emprise) return { presse: null, ignores }
  return { presse: { copies, emprise, total }, ignores }
}

// ——— Coller ——————————————————————————————————————————————————————————

const RECTS = [
  'structures',
  'boxes',
  'zones',
  'caches',
  'portes',
  'chasses',
  'plots',
  'pupitres',
  'ancres',
] as const
const POINTS = [
  'labels',
  'lasers',
  'cibles',
  'condensats',
  'eclats',
  'decals',
] as const

/** Ajoute au tableau des clones NEUFS du presse-papier, décalés de (dx, dy),
 *  et rend les références des nouveaux venus — la sélection à poser dessus.
 *  Les lampes au-delà du plafond sont refusées et comptées. */
export function colle(
  level: LevelDef,
  presse: PressePapier,
  dx: number,
  dy: number,
): { refs: RefSelection[]; ignores: string[] } {
  const refs: RefSelection[] = []
  const ignores: string[] = []
  const ajoute = <F extends FamilleMotif>(
    f: F,
    liste: Element<F>[] | undefined,
    items: Element<F>[],
  ): Element<F>[] => {
    const base = liste ?? []
    items.forEach((_, k) =>
      refs.push({ kind: SORTE_DE_FAMILLE[f], index: base.length + k }),
    )
    return [...base, ...items]
  }
  const clones = <F extends FamilleMotif>(f: F): Element<F>[] =>
    ((presse.copies[f] ?? []) as Element<F>[]).map(
      (o) => structuredClone(o) as Element<F>,
    )
  for (const f of RECTS) {
    const items = clones(f)
    if (items.length === 0) continue
    for (const o of items) {
      o.minX += dx
      o.maxX += dx
      o.minY += dy
      o.maxY += dy
    }
    ;(level as Record<typeof f, unknown[]>)[f] = ajoute(f, level[f], items)
  }
  for (const f of POINTS) {
    const items = clones(f)
    if (items.length === 0) continue
    for (const o of items) {
      o.x += dx
      o.y += dy
    }
    ;(level as Record<typeof f, unknown[]>)[f] = ajoute(f, level[f], items)
  }
  const sponges = clones('sponges')
  if (sponges.length > 0) {
    for (const sp of sponges) {
      sp.minX += dx
      sp.minY += dy
    }
    level.sponges = ajoute('sponges', level.sponges, sponges)
  }
  const rails = clones('rails')
  if (rails.length > 0) {
    for (const r of rails)
      for (const p of r.points) {
        p.x += dx
        p.y += dy
      }
    level.rails = ajoute('rails', level.rails, rails)
  }
  const lumieres = clones('lumieres')
  if (lumieres.length > 0) {
    const place = Math.max(0, MAX_LUMIERES - (level.lumieres ?? []).length)
    const refusees = lumieres.length - place
    const gardees = lumieres.slice(0, place)
    for (const l of gardees) {
      l.x += dx
      l.y += dy
    }
    if (gardees.length > 0)
      level.lumieres = ajoute('lumieres', level.lumieres, gardees)
    if (refusees > 0)
      ignores.push(
        `${refusees} lampe${refusees > 1 ? 's' : ''} (plafond de ${MAX_LUMIERES})`,
      )
  }
  return { refs, ignores }
}

/** Le décalage qui pose le CENTRE du groupe sous le curseur — ou, sans
 *  curseur sur la carte, un pas fixe vers l'est (comme Dupliquer), pour que
 *  la copie ne se confonde pas avec l'original. */
export function decalageDeCollage(
  emprise: Rect,
  curseur: { x: number; y: number } | null,
  pas: number,
): { dx: number; dy: number } {
  if (!curseur) return { dx: pas, dy: 0 }
  return {
    dx: curseur.x - (emprise.minX + emprise.maxX) / 2,
    dy: curseur.y - (emprise.minY + emprise.maxY) / 2,
  }
}
