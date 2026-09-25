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
//   - les feux de navigation : rouge à bâbord (gauche), vert à tribord
//     (droite). Les propulseurs d'angle ont été retirés (25/09) : aucune
//     version, tracée ou peinte, ne tenait à côté des pièces peintes.
// Une pièce dont l'attache tombe dans un VIDE est retirée avec tout son
// groupe (un bras sans coque où tenir ne porte plus son aile).
//
// Ce module ne dessine rien : il produit la liste que le shader parcourt
// (drawHull, renderer.ts). C'est lui qui se teste.

import type { Bounds } from '../sim/solver'
import { dansForme, type FormeBox } from '../game/formes'
import { COQUE_EPAISSEUR } from './coque'
import { ATLAS_COQUE } from './coqueAtlas'

// Les types, dans l'ordre des cases de l'atlas vu de dessus (assets-ia §28)
// et des branches du shader.
export const PIECE_AILE = 0
export const PIECE_RADIATEUR = 1
export const PIECE_PARABOLE = 2
export const PIECE_AMARRAGE = 3
export const PIECE_TREILLIS = 4
// 5 : les propulseurs, retirés — la case reste libre, l'atlas garde son ordre
export const PIECE_FEU = 6
/** L'EMBASE : la platine boulonnée qui tient une pièce sur la coque. Elle
 *  MORD dans la coque (EMBASE_PROF sous la face externe) : c'est elle qui
 *  fait la liaison — sans elle, les pièces étaient posées contre le bord,
 *  comme collées (aperçu du 25/09). Tracée par le shader, jamais peinte. */
export const PIECE_EMBASE = 7
export const EMBASE_PROF = 22

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
  /** Selon le type — treillis : la longueur d'une répétition de l'image le
   *  long du bras ; port d'amarrage : la part de l'image montrée depuis la
   *  collerette (le module voisin sort du cadre). 0 : sans objet. */
  param: number
}

/** Le rapport largeur / hauteur d'une pièce : celui de son IMAGE quand elle
 *  est livrée (coqueAtlas.ts, écrit par tools/images/materiel.py) — une
 *  pièce n'est jamais déformée —, sinon celui du tracé du shader. */
function rapportDe(type: number, parDefaut: number): number {
  return ATLAS_COQUE[type]?.rapport ?? parDefaut
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
    param = 0,
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
      param,
    })
  }
  // l'attache d'un groupe : le point qui décide s'il tient (le vide), et son
  // EMBASE — posée AVANT les pièces du groupe, donc dessous. `pied` : la
  // largeur de ce qui sort de la coque ; `entretoises` : deux jambes de
  // force en biais, pour ce qui porte loin (les bras).
  const attache = (cote: Cote, s: number, g: number, pied: number, entretoises = false) => {
    attaches.push({ groupe: g, x: cote.ox + cote.ax * s - cote.nx * 4, y: cote.oy + cote.ay * s - cote.ny * 4 })
    const haut = entretoises ? 48 : 10
    pose(cote, PIECE_EMBASE, s, (haut - EMBASE_PROF) / 2, pied / 2 + (entretoises ? 34 : 20), (haut + EMBASE_PROF) / 2, g, entretoises ? pied / 2 : -pied / 2)
  }

  // la largeur du bras en treillis, et la longueur d'une répétition de son
  // image le long du bras (elle se raccorde bout à bout)
  const largeurBras = 46
  const tuileBras = largeurBras / rapportDe(PIECE_TREILLIS, 0.19)
  const bras = (cote: Cote, s: number, long: number, g: number) =>
    pose(cote, PIECE_TREILLIS, s, long / 2, largeurBras / 2, long / 2, g, tuileBras)

  // L'ÉNERGIE : des ailes couchées le long de la paroi, chacune au bout d'un
  // bras court — deux sur un long côté, comme les paires de l'ISS. Leur
  // hauteur (vers le dehors) est bornée par la frange ; la largeur suit
  // le rapport de l'image.
  {
    const L = energie.long
    const places = L > 2000 ? [0.25, 0.75] : [0.5]
    const rapport = rapportDe(PIECE_AILE, 7)
    const longBras = 110 + 30 * alea()
    let hAile = 430
    // deux ailes ne se touchent pas, une seule ne déborde pas de la paroi
    const largeurMax = (places.length > 1 ? 0.46 : 0.8) * L
    if (hAile * rapport > largeurMax) hAile = largeurMax / rapport
    for (const f of places) {
      const g = ++groupe
      const s = f * L
      attache(energie, s, g, largeurBras, true)
      bras(energie, s, longBras, g)
      pose(energie, PIECE_AILE, s, longBras + hAile / 2, (hAile * rapport) / 2, hAile / 2, g)
    }
  }
  // LE FROID ET LA LIAISON : deux radiateurs qui s'écartent, une parabole
  {
    const L = froid.long
    const radiateurs = L > 1400 ? [0.33, 0.62] : [0.5]
    const hRad = 380
    const lRad = hRad * rapportDe(PIECE_RADIATEUR, 0.33)
    for (const f of radiateurs) {
      const g = ++groupe
      const s = f * L
      attache(froid, s, g, largeurBras, true)
      bras(froid, s, 44, g)
      pose(froid, PIECE_RADIATEUR, s, 44 + hRad / 2, lRad / 2, hRad / 2, g)
    }
    const g = ++groupe
    const s = (alea() < 0.5 ? 0.12 : 0.88) * L
    // la parabole sur un pylône court : elle ne flotte plus devant la coque
    attache(froid, s, g, 30)
    bras(froid, s, 40, g)
    const dParab = 150
    const hParab = dParab / rapportDe(PIECE_PARABOLE, 1)
    pose(froid, PIECE_PARABOLE, s, 30 + hParab / 2, dParab / 2, hParab / 2, g)
  }
  // L'AMARRAGE : le port, et l'amorce du module voisin qui s'y raccorde. On
  // ne montre que le bas de l'image (la collerette et un tronçon) : le
  // module continue au-delà, dans le noir.
  if (amarrage.long >= 700) {
    const g = ++groupe
    const s = amarrage.long / 2
    const largeur = 340
    attache(amarrage, s, g, largeur * 0.9)
    const part = 0.62
    const h = (largeur / rapportDe(PIECE_AMARRAGE, 1.13)) * (ATLAS_COQUE[PIECE_AMARRAGE] ? part : 1)
    pose(amarrage, PIECE_AMARRAGE, s, h / 2, largeur / 2, h / 2, g, ATLAS_COQUE[PIECE_AMARRAGE] ? part : 0)
  }
  // LES FEUX DE NAVIGATION : un par côté latéral (pas sur le port
  // d'amarrage, qui tient le milieu du sien)
  for (const cote of [c.gauche, c.droite]) {
    const s = cote === arriere ? cote.long / 2 : cote.long * (alea() < 0.5 ? 0.25 : 0.75)
    if (cote === amarrage && Math.abs(s - cote.long / 2) < 260) continue
    const g = ++groupe
    attache(cote, s, g, 18)
    pose(cote, PIECE_FEU, s, 14, 14, 14, g)
  }

  // arraché par le vide : un groupe dont une attache tombe dans un trou
  const perdus = new Set<number>()
  for (const a of attaches) {
    if (vides.some((v) => dansForme(v, a.x, a.y))) perdus.add(a.groupe)
  }
  return pieces.filter((p) => !perdus.has(p.groupe)).slice(0, MAX_PIECES_COQUE)
}

/** Empaquette pour le shader : (cx, cy, hx, hy) et (type, angle, graine, param)
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
    outAux.set([p.type, p.angle, p.graine, p.param], i * 4)
  }
  return n
}
