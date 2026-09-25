// LA COMPOSITION DU MATÉRIEL DE COQUE — ce qui est posé au-dehors, et où.
//
// LE DÉFAUT qu'elle corrige (aperçu du 25/09 sur iPad, « je trouve pas ça
// dingue ») : une petite pièce tirée au sort toutes les 300 unités, de
// profil, plantée sur le bord de la paroi. La salle se lit DE DESSUS — un
// plan : les pièces de profil s'y lisaient comme des autocollants, et leur
// alignement régulier comme une rangée de piquets (cinq paraboles presque
// identiques sur un seul côté). Une station n'est pas « un objet par
// mètre » : elle est COMPOSÉE, de peu d'éléments qui font sa silhouette.
//
// LA RÈGLE : tout est vu de dessus, et chaque salle reçoit une composition
// écrite pour sa forme, stable d'un chargement à l'autre (tirée sur ses
// bornes) :
//   - un grand côté porte l'ÉNERGIE : un bras en treillis qui sort de la
//     coque et, au bout, une aile solaire couchée le long de la paroi ;
//     deux bras sur une très longue salle ;
//   - l'autre grand côté porte le FROID et la LIAISON : des radiateurs qui
//     s'écartent de la coque, et une parabole près d'un bout ;
//   - un petit côté porte l'AMARRAGE : un port et l'amorce du module
//     voisin — la salle est un maillon, pas une boîte perdue ;
//   - aux quatre coins, les PROPULSEURS de contrôle d'attitude, et les feux
//     de navigation : rouge à bâbord (gauche), vert à tribord (droite).
// Une pièce dont l'attache tombe dans un VIDE est retirée avec tout son
// groupe (un bras sans coque où tenir ne porte plus son aile).
//
// Ce module ne dessine rien : il produit la liste que le shader parcourt
// (drawHull, renderer.ts). C'est lui qui se teste.

import type { Bounds } from '../sim/solver'
import { dansForme, type FormeBox } from '../game/formes'
import { COQUE_EPAISSEUR } from './coque'

// Les types, dans l'ordre des cases de l'atlas vu de dessus (assets-ia §28)
// et des branches du shader.
export const PIECE_AILE = 0
export const PIECE_RADIATEUR = 1
export const PIECE_PARABOLE = 2
export const PIECE_AMARRAGE = 3
export const PIECE_TREILLIS = 4
export const PIECE_PROPULSEURS = 5
export const PIECE_FEU = 6

/** Le plafond du shader (uniformes) : une composition en pose une douzaine
 *  à une vingtaine ; au-delà, les dernières sont laissées. */
export const MAX_PIECES_COQUE = 32

export interface PieceCoque {
  type: number
  /** Centre, dans le monde. */
  cx: number
  cy: number
  /** Demi-dimensions dans le repère de la pièce : x LE LONG de la paroi,
   *  y VERS LE DEHORS. */
  hx: number
  hy: number
  /** Angle du repère de la pièce (radians) : son +y regarde le dehors. */
  angle: number
  /** 0..1, stable : déphase les animations d'une pièce à l'autre. */
  graine: number
  /** Le groupe : un bras et son aile tombent ensemble. */
  groupe: number
}

interface Cote {
  /** Point de départ (angle de la cuve) et direction le long de la paroi. */
  ox: number
  oy: number
  ax: number
  ay: number
  /** Normale sortante. */
  nx: number
  ny: number
  long: number
  angle: number
}

function cotes(b: Bounds): { haut: Cote; bas: Cote; gauche: Cote; droite: Cote } {
  const T = COQUE_EPAISSEUR
  const W = b.maxX - b.minX
  const H = b.maxY - b.minY
  return {
    haut: { ox: b.minX, oy: b.maxY + T, ax: 1, ay: 0, nx: 0, ny: 1, long: W, angle: 0 },
    bas: { ox: b.minX, oy: b.minY - T, ax: 1, ay: 0, nx: 0, ny: -1, long: W, angle: Math.PI },
    gauche: { ox: b.minX - T, oy: b.minY, ax: 0, ay: 1, nx: -1, ny: 0, long: H, angle: Math.PI / 2 },
    droite: { ox: b.maxX + T, oy: b.minY, ax: 0, ay: 1, nx: 1, ny: 0, long: H, angle: -Math.PI / 2 },
  }
}

/** Un petit hasard déterministe, tiré des bornes : la même salle reçoit
 *  toujours la même composition, deux salles différentes rarement. */
function graineDe(b: Bounds): () => number {
  let h = 2166136261
  for (const v of [b.minX, b.minY, b.maxX, b.maxY]) {
    h ^= Math.round(v) & 0xffff
    h = Math.imul(h, 16777619)
    h ^= Math.round(v) >>> 16
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 10007) / 10007
  }
}

/** Compose le matériel extérieur d'une cuve. `vides` : les boîtes de vide
 *  du tableau — une pièce dont l'attache y tombe part avec son groupe. */
export function composeCoque(b: Bounds, vides: readonly FormeBox[] = []): PieceCoque[] {
  const alea = graineDe(b)
  const c = cotes(b)
  const horizontale = b.maxX - b.minX >= b.maxY - b.minY
  // les deux grands côtés, puis les deux petits ; lequel porte l'énergie
  // est tiré au sort
  const grands = horizontale ? [c.haut, c.bas] : [c.gauche, c.droite]
  const petits = horizontale ? [c.gauche, c.droite] : [c.haut, c.bas]
  if (alea() < 0.5) grands.reverse()
  if (alea() < 0.5) petits.reverse()
  const [energie, froid] = grands
  const [amarrage, arriere] = petits

  const pieces: PieceCoque[] = []
  const attaches: { groupe: number; x: number; y: number }[] = []
  let groupe = 0
  // pose une pièce sur un côté : `s` le long de la paroi, `d` la distance
  // de son centre à la face externe de la coque
  const pose = (
    cote: Cote,
    type: number,
    s: number,
    d: number,
    hx: number,
    hy: number,
    g: number,
  ) => {
    pieces.push({
      type,
      cx: cote.ox + cote.ax * s + cote.nx * d,
      cy: cote.oy + cote.ay * s + cote.ny * d,
      hx,
      hy,
      angle: cote.angle,
      graine: alea(),
      groupe: g,
    })
  }
  const attache = (cote: Cote, s: number, g: number) =>
    attaches.push({ groupe: g, x: cote.ox + cote.ax * s - cote.nx * 4, y: cote.oy + cote.ay * s - cote.ny * 4 })

  // L'ÉNERGIE : un ou deux bras, une aile couchée au bout de chacun
  {
    const L = energie.long
    const bras = L > 2600 ? [0.27, 0.73] : [0.5 + (alea() - 0.5) * 0.2]
    const envergure = Math.min(bras.length > 1 ? 0.44 * L : 0.72 * L, 1700)
    const longBras = 250 + 60 * alea()
    for (const f of bras) {
      const g = ++groupe
      const s = f * L
      attache(energie, s, g)
      pose(energie, PIECE_TREILLIS, s, longBras / 2, 26, longBras / 2, g)
      pose(energie, PIECE_AILE, s, longBras + 118, envergure / 2, 118, g)
    }
  }
  // LE FROID ET LA LIAISON : deux radiateurs qui s'écartent, une parabole
  {
    const L = froid.long
    const radiateurs = L > 1400 ? [0.33, 0.62] : [0.5]
    for (const f of radiateurs) {
      const g = ++groupe
      const s = f * L
      attache(froid, s, g)
      pose(froid, PIECE_TREILLIS, s, 30, 20, 30, g)
      pose(froid, PIECE_RADIATEUR, s, 60 + 190, 62, 190, g)
    }
    const g = ++groupe
    const s = (alea() < 0.5 ? 0.12 : 0.88) * L
    attache(froid, s, g)
    pose(froid, PIECE_PARABOLE, s, 70, 62, 62, g)
  }
  // L'AMARRAGE : le port, et l'amorce du module voisin qui s'y raccorde
  if (amarrage.long >= 700) {
    const g = ++groupe
    const s = amarrage.long / 2
    attache(amarrage, s, g)
    pose(amarrage, PIECE_AMARRAGE, s, 150, 170, 150, g)
  }
  // LES COINS : propulseurs aux deux bouts des petits côtés, et les feux de
  // navigation au côté arrière (pas sur l'amarrage : le port y est)
  for (const cote of petits) {
    for (const s of [70, cote.long - 70]) {
      const g = ++groupe
      attache(cote, s, g)
      pose(cote, PIECE_PROPULSEURS, s, 40, 36, 36, g)
    }
  }
  for (const cote of [c.gauche, c.droite]) {
    const s = cote === arriere ? cote.long / 2 : cote.long * (alea() < 0.5 ? 0.25 : 0.75)
    if (cote === amarrage && Math.abs(s - cote.long / 2) < 260) continue
    const g = ++groupe
    attache(cote, s, g)
    pose(cote, PIECE_FEU, s, 14, 14, 14, g)
  }

  // arraché par le vide : un groupe dont une attache tombe dans un trou
  const perdus = new Set<number>()
  for (const a of attaches) {
    if (vides.some((v) => dansForme(v, a.x, a.y))) perdus.add(a.groupe)
  }
  return pieces.filter((p) => !perdus.has(p.groupe)).slice(0, MAX_PIECES_COQUE)
}

/** Empaquette pour le shader : (cx, cy, hx, hy) et (type, angle, graine, 0)
 *  par pièce. Renvoie le nombre de pièces écrites. */
export function empaquettePieces(
  pieces: readonly PieceCoque[],
  outGeo: Float32Array,
  outAux: Float32Array,
): number {
  const n = Math.min(pieces.length, MAX_PIECES_COQUE)
  for (let i = 0; i < n; i++) {
    const p = pieces[i]
    outGeo.set([p.cx, p.cy, p.hx, p.hy], i * 4)
    outAux.set([p.type, p.angle, p.graine, 0], i * 4)
  }
  return n
}
