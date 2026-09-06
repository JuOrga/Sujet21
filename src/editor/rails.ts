// LES RAILS MAGNÉTIQUES SOUS LA MAIN — la géométrie d'une polyligne, pure,
// sans canvas ni pointeur.
//
// Le rail est une POLYLIGNE : une suite de nœuds, dans l'ordre du tracé
// (qui est le sens de l'arc). Tant qu'on ne pouvait le saisir que d'un
// bloc, un rail à plusieurs nœuds était un objet coulé : impossible
// d'allonger un tronçon sans traîner tout le reste — c'est la plainte du
// concepteur (06/09), et c'est ce que ce fichier répare, en donnant une
// prise à CHAQUE nœud et à CHAQUE longueur.
//
// Ce module ne connaît ni l'écran ni la souris : des points, des distances,
// des index. C'est ce qui le rend testable au millimètre.

import type { RailDef } from '../game/level'

export interface PointRail {
  x: number
  y: number
}

/** Un nœud désigné : le rail, puis le rang du point dans son tracé. */
export interface NoeudRail {
  rail: number
  noeud: number
}

/** Distance d'un point au segment [a, b] — la prise d'un rail au clic. */
export function distanceSegment(
  x: number,
  y: number,
  a: PointRail,
  b: PointRail,
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  const t =
    len2 < 1e-9
      ? 0
      : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
  return Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t))
}

/** Le rail dont la LIGNE passe le plus près — celui qu'on attrape au clic.
 *  Les rails du dessus (les derniers posés) l'emportent à égalité. */
export function railProche(
  rails: readonly RailDef[],
  x: number,
  y: number,
  tol: number,
): number | null {
  let meilleur: number | null = null
  let dist = tol
  for (let i = rails.length - 1; i >= 0; i--) {
    const pts = rails[i].points
    for (let k = 0; k + 1 < pts.length; k++) {
      const d = distanceSegment(x, y, pts[k], pts[k + 1])
      if (d < dist) {
        dist = d
        meilleur = i
      }
    }
  }
  return meilleur
}

/** Le NŒUD le plus proche dans un tracé — la poignée sous le doigt. */
export function noeudProche(
  points: readonly PointRail[],
  x: number,
  y: number,
  tol: number,
): number | null {
  let meilleur: number | null = null
  let dist = tol
  for (let k = 0; k < points.length; k++) {
    const d = Math.hypot(points[k].x - x, points[k].y - y)
    if (d < dist) {
      dist = d
      meilleur = k
    }
  }
  return meilleur
}

/** Le TRONÇON le plus proche : le rang du segment [k, k+1]. Sert à insérer
 *  un nœud là où l'on montre, entre deux points existants. */
export function tronconProche(
  points: readonly PointRail[],
  x: number,
  y: number,
  tol: number,
): number | null {
  let meilleur: number | null = null
  let dist = tol
  for (let k = 0; k + 1 < points.length; k++) {
    const d = distanceSegment(x, y, points[k], points[k + 1])
    if (d < dist) {
      dist = d
      meilleur = k
    }
  }
  return meilleur
}

/**
 * L'ACCROCHE : le nœud d'un rail voisin où se coller exactement.
 *
 * Poser deux rails bout à bout au pixel près était un exercice d'adresse ;
 * l'aimant de grille n'y suffit pas dès qu'un tracé sort de la trame. Ici,
 * un nœud qui approche d'un autre s'y pose EXACTEMENT — et les deux rails
 * restent deux objets distincts, chacun réglable.
 *
 * `sauf` retire de la recherche le nœud qu'on tire ET SES VOISINS DE
 * TRACÉ : sans cela, un point neuf se recollait aussitôt sur le précédent
 * (ils naissent au même endroit) et aucun tronçon court n'était traçable.
 */
export function accroche(
  rails: readonly RailDef[],
  x: number,
  y: number,
  tol: number,
  sauf: readonly NoeudRail[] = [],
): PointRail | null {
  let meilleur: PointRail | null = null
  let dist = tol
  for (let i = 0; i < rails.length; i++) {
    const pts = rails[i].points
    for (let k = 0; k < pts.length; k++) {
      if (sauf.some((n) => n.rail === i && n.noeud === k)) continue
      const d = Math.hypot(pts[k].x - x, pts[k].y - y)
      if (d < dist) {
        dist = d
        meilleur = { x: pts[k].x, y: pts[k].y }
      }
    }
  }
  return meilleur
}

/** Longueur d'un tronçon (segment [k, k+1]) — 0 hors tracé. */
export function longueurTroncon(points: readonly PointRail[], k: number): number {
  const a = points[k]
  const b = points[k + 1]
  if (!a || !b) return 0
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Longueur totale de la ligne de champ. */
export function longueurRail(points: readonly PointRail[]): number {
  let total = 0
  for (let k = 0; k + 1 < points.length; k++) total += longueurTroncon(points, k)
  return total
}

/**
 * RÈGLE LA LONGUEUR D'UN SEUL TRONÇON, sans toucher aux autres : le nœud
 * aval glisse le long de la direction du segment, et TOUT L'AVAL le suit
 * du même écart. La forme du reste du tracé est donc conservée — on
 * allonge un tronçon comme on tire sur un maillon de chaîne.
 *
 * Un tronçon de longueur nulle n'a pas de direction : on le laisse tel
 * quel plutôt que d'inventer un sens.
 */
export function regleLongueurTroncon(
  points: readonly PointRail[],
  k: number,
  longueur: number,
): PointRail[] {
  const copie = points.map((p) => ({ x: p.x, y: p.y }))
  const a = copie[k]
  const b = copie[k + 1]
  if (!a || !b) return copie
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len < 1e-6) return copie
  const cible = Math.max(1, longueur)
  const dx = ((b.x - a.x) / len) * (cible - len)
  const dy = ((b.y - a.y) / len) * (cible - len)
  for (let i = k + 1; i < copie.length; i++) {
    copie[i].x += dx
    copie[i].y += dy
  }
  return copie
}

/** Insère un nœud AU MILIEU du tronçon k — un coude de plus à plier. */
export function insereNoeud(
  points: readonly PointRail[],
  k: number,
): PointRail[] {
  const copie = points.map((p) => ({ x: p.x, y: p.y }))
  const a = copie[k]
  const b = copie[k + 1]
  if (!a || !b) return copie
  copie.splice(k + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  return copie
}

/** Retire un nœud. Null : le tracé n'aurait plus deux points — un rail
 *  d'un seul point n'est plus une ligne de champ, on refuse. */
export function retireNoeud(
  points: readonly PointRail[],
  k: number,
): PointRail[] | null {
  if (points.length <= 2 || k < 0 || k >= points.length) return null
  const copie = points.map((p) => ({ x: p.x, y: p.y }))
  copie.splice(k, 1)
  return copie
}

/**
 * COUPE le tracé au nœud k : deux rails distincts, qui se TOUCHENT en ce
 * point (le nœud appartient aux deux). C'est la sortie de secours du
 * concepteur qui a prolongé un rail par mégarde.
 *
 * Attention, et le panneau le dit : ce n'est pas qu'un geste d'édition.
 * L'arc quitte un rail à son bout et repart tout droit — il ne saute pas
 * la coupure. Couper change donc le tableau, pas seulement sa manipulation.
 *
 * Null : couper à une extrémité ne donnerait qu'un rail d'un point.
 */
export function coupeRail(
  points: readonly PointRail[],
  k: number,
): [PointRail[], PointRail[]] | null {
  if (k < 1 || k > points.length - 2) return null
  const copie = points.map((p) => ({ x: p.x, y: p.y }))
  return [copie.slice(0, k + 1), copie.slice(k)]
}
