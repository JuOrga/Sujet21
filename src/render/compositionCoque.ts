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
// bornes), en TROIS COUCHES :
//   0. LE MODULE — son propre matériel, rien de plus : un port d'amarrage à
//      chaque bout, une antenne de liaison, ses feux de navigation (rouge à
//      bâbord, vert à tribord). Il portait auparavant ailes, radiateurs et
//      parabole : l'attirail d'un satellite entier, et la salle se lisait
//      comme LE vaisseau (retour du 25/09). Sur l'ISS, un module n'en porte
//      aucun : ils pendent à la poutre maîtresse.
//   1. LES VOISINS — derrière chaque port, le module suivant, dans le plan
//      de la salle, jusqu'au-delà de l'écran : la salle est un maillon.
//   2. LE LOINTAIN — la poutre maîtresse de la station, qui passe au large,
//      avec les grandes ailes solaires et les radiateurs qui y pendent. En
//      PARALLAXE (échelle et défilement ECHELLE_LOINTAIN) : plus petite,
//      plus lente, derrière — la station est bien plus grande que ce qu'on
//      en voit.
// Les propulseurs d'angle ont été retirés (25/09) : aucune version, tracée
// ou peinte, ne tenait à côté des pièces peintes.
// Une pièce dont l'attache tombe dans un VIDE est retirée avec tout son
// groupe (un port arraché emporte le module voisin qui s'y tenait).
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
/** Le MODULE VOISIN : le cylindre qui prolonge un port d'amarrage. Peint
 *  avec l'image du port (sa partie au-dessus de la collerette, répétée en
 *  miroir), sinon tracé. */
export const PIECE_MODULE = 8

/** Les couches (voir l'en-tête). */
export const COUCHE_MODULE = 0
export const COUCHE_VOISINS = 1
export const COUCHE_LOINTAIN = 2
/** Le lointain est vu à cette échelle, et défile à cette fraction du
 *  mouvement de la caméra (les deux vont ensemble : c'est la profondeur).
 *  Le shader en tire P = C + (W − C) / s. */
export const ECHELLE_LOINTAIN = 0.55

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
  /** La couche : 0 le module, 1 ses voisins, 2 le lointain (coordonnées
   *  du plan lointain — voir ECHELLE_LOINTAIN). */
  couche: number
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

/** La clé de la composition : elle change dès que ce qui la décide change —
 *  la cuve, et TOUT ce qui dit si un point tombe dans un vide (dansForme) :
 *  boîte, angle, forme, ses paramètres p0 à p2, sa coupe. Une clé qui
 *  oubliait p0..p2 et la coupe laissait, à l'éditeur, un port dessiné sur
 *  un trou (ou manquant sur une coque intacte) après avoir tourné un coin
 *  ou réglé un arc. */
export function cleComposition(b: Bounds, vides: readonly FormeBox[]): string {
  return (
    `${b.minX},${b.minY},${b.maxX},${b.maxY}|` +
    vides
      .map(
        (v) =>
          `${v.minX},${v.minY},${v.maxX},${v.maxY},${v.angle ?? 0},${v.forme ?? 0},` +
          `${v.p0 ?? ''},${v.p1 ?? ''},${v.p2 ?? ''},${v.coupe ? JSON.stringify(v.coupe) : ''}`,
      )
      .join(';')
  )
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
  // le côté DORSAL est celui au large duquel passe la poutre maîtresse
  const [dorsal, ventral] = grands

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
    couche = COUCHE_MODULE,
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
      couche,
    })
  }
  // l'attache d'un groupe : le point qui décide s'il tient (le vide), et son
  // EMBASE — posée AVANT les pièces du groupe, donc dessous. `pied` : la
  // largeur de ce qui sort de la coque ; `entretoises` : deux jambes de
  // force en biais, pour ce qui porte loin.
  const attache = (cote: Cote, s: number, g: number, pied: number, entretoises = false) => {
    attaches.push({ groupe: g, x: cote.ox + cote.ax * s - cote.nx * 4, y: cote.oy + cote.ay * s - cote.ny * 4 })
    const haut = entretoises ? 48 : 10
    pose(cote, PIECE_EMBASE, s, (haut - EMBASE_PROF) / 2, pied / 2 + (entretoises ? 34 : 20), (haut + EMBASE_PROF) / 2, g, entretoises ? pied / 2 : -pied / 2)
  }
  const largeurBras = 46
  const tuileBras = largeurBras / rapportDe(PIECE_TREILLIS, 0.19)
  const bras = (cote: Cote, s: number, long: number, g: number) =>
    pose(cote, PIECE_TREILLIS, s, long / 2, largeurBras / 2, long / 2, g, tuileBras)

  // ——— LE LOINTAIN (dessous de tout, posé en premier) ———————————————
  // La poutre maîtresse passe au large du côté dorsal, parallèle au grand
  // axe, et file des deux côtés hors de l'écran ; ailes et radiateurs y
  // pendent, tournés vers le dehors. Coordonnées du PLAN LOINTAIN : son
  // centre est celui de la salle, et une distance D y paraît D × s.
  {
    const sL = ECHELLE_LOINTAIN
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    const demiCourt = Math.min(b.maxX - b.minX, b.maxY - b.minY) / 2
    // la poutre paraît à ~420 u au-delà de la coque, derrière le matériel
    // du module
    const D = (demiCourt + COQUE_EPAISSEUR + 420) / sL
    const nx = dorsal.nx
    const ny = dorsal.ny
    const ax = dorsal.ax
    const ay = dorsal.ay
    const g = ++groupe
    const loin = (type: number, le: number, dehors: number, hx: number, hy: number, param = 0) =>
      pieces.push({
        type,
        cx: cx + ax * le + nx * (D + dehors),
        cy: cy + ay * le + ny * (D + dehors),
        hx,
        hy,
        angle: dorsal.angle,
        graine: alea(),
        groupe: g,
        param,
        couche: COUCHE_LOINTAIN,
      })
    // la poutre : un treillis couché le long du grand axe, très long ; son
    // repère est celui d'un bras tourné d'un quart de tour
    const largeurPoutre = 150
    const longPoutre = 40000
    pieces.push({
      type: PIECE_TREILLIS,
      cx: cx + nx * D,
      cy: cy + ny * D,
      hx: largeurPoutre / 2,
      hy: longPoutre / 2,
      angle: dorsal.angle - Math.PI / 2,
      graine: alea(),
      groupe: g,
      param: largeurPoutre / rapportDe(PIECE_TREILLIS, 0.19),
      couche: COUCHE_LOINTAIN,
    })
    // les grandes ailes, deux paires, et les radiateurs entre elles
    const hAile = 1400
    const lAile = hAile * rapportDe(PIECE_AILE, 2.12)
    for (const le of [-1, 1].map((k) => k * (lAile / 2 + 1300))) {
      loin(PIECE_AILE, le, largeurPoutre / 2 + hAile / 2 - 20, lAile / 2, hAile / 2)
    }
    const hRad = 900
    const lRad = hRad * rapportDe(PIECE_RADIATEUR, 0.4)
    for (const le of [-600, 600]) {
      loin(PIECE_RADIATEUR, le, largeurPoutre / 2 + hRad / 2 - 20, lRad / 2, hRad / 2)
    }
  }

  // ——— LE MODULE, et ses voisins derrière ses ports ———————————————
  // un port d'amarrage à chaque bout ; derrière chacun, le module voisin
  for (const cote of petits) {
    if (cote.long < 700) continue
    const g = ++groupe
    const s = cote.long / 2
    const largeur = 340
    attache(cote, s, g, largeur * 0.9)
    const part = 0.62
    const h = (largeur / rapportDe(PIECE_AMARRAGE, 1.13)) * (ATLAS_COQUE[PIECE_AMARRAGE] ? part : 1)
    // le voisin d'abord (couche 1, dessiné sous le module de toute façon) :
    // il commence sous le haut du port, qui s'y fond, et file hors de
    // l'écran. Sa tuile : la partie cylindre de l'image du port.
    const longVoisin = 6000
    const debut = h - 60
    const largeurCyl = largeur * 0.95
    // une tuile : la bande haute de l'image du port (26 % de sa hauteur)
    const tuile = largeurCyl / (rapportDe(PIECE_AMARRAGE, 1.13) / 0.26)
    pose(cote, PIECE_MODULE, s, debut + longVoisin / 2, largeurCyl / 2, longVoisin / 2, g,
      tuile, COUCHE_VOISINS)
    pose(cote, PIECE_AMARRAGE, s, h / 2, largeur / 2, h / 2, g, ATLAS_COQUE[PIECE_AMARRAGE] ? part : 0)
  }
  // l'antenne de liaison : une parabole sur un pylône court, près d'un bout
  // du côté ventral (le dorsal regarde la poutre)
  {
    const g = ++groupe
    const s = (alea() < 0.5 ? 0.14 : 0.86) * ventral.long
    attache(ventral, s, g, 30)
    bras(ventral, s, 40, g)
    const dParab = 130
    const hParab = dParab / rapportDe(PIECE_PARABOLE, 1)
    pose(ventral, PIECE_PARABOLE, s, 30 + hParab / 2, dParab / 2, hParab / 2, g)
  }
  // les feux de navigation : un par côté latéral, à l'écart du port
  for (const cote of [c.gauche, c.droite]) {
    const s = cote.long * (alea() < 0.5 ? 0.2 : 0.8)
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

/** Empaquette pour le shader : (cx, cy, hx, hy) et (type + 16·couche, angle, graine, param)
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
    outAux.set([p.type + 16 * p.couche, p.angle, p.graine, p.param], i * 4)
  }
  return n
}
