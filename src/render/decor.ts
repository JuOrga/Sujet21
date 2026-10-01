// LE DÉCOR PEINT — le vaisseau autour de la salle, une image par biome.
//
// Pourquoi une image : le décor bâti en code (des boîtes texturées vues en
// perspective, branche claude/vaisseau-perspective, abandonnée le 01/10) se
// lisait « comme un niveau du premier Doom » — des blocs collés, des
// textures plaquées, rien pour relier les volumes. Le concept du concepteur
// tenait par ce qu'une image peinte apporte d'elle-même : passerelles,
// rambardes, tuyaux qui relient tout, lumière qui coule sur les surfaces.
//
// LE GABARIT (docs/assets-ia.md §34). Chaque image a :
//   · un ciel NOIR PUR au-dessus de l'horizon — le jeu y laisse voir la
//     Terre en direct (render/terre.ts) ;
//   · une OUVERTURE noire où se pose la salle jouée. Le générateur la peint
//     en perspective (un trapèze, plus large en bas) : la salle, rectangle vu
//     de dessus, prend la largeur du BAS du trapèze et le couvre en entier —
//     elle mord deux petits triangles de plancher en haut, comme dans le
//     concept, et la passerelle peinte arrive sur son bord haut.
//
// LES COUCHES. Une seule image, mais trois profondeurs, par bandes : le
// premier plan (autour de la salle) suit le monde ; entre l'horizon et le
// haut de l'ouverture, l'allée et ses modules suivent de moins en moins le
// déplacement de la caméra, jusqu'à PARALLAXE_HORIZON à l'horizon ; le ciel,
// c'est la Terre, qui a déjà la sienne.

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Ce qu'il faut savoir d'une image livrée, en pixels de l'image (y vers le BAS). */
export interface GabaritDecor {
  largeur: number
  hauteur: number
  /** la ligne d'horizon : au-dessus, le ciel noir */
  horizon: number
  /** l'ouverture : son bord haut, son bord bas, et le bas du trapèze en x */
  ouvertureHaut: number
  ouvertureBas: number
  ouvertureGauche: number
  ouvertureDroite: number
}

/** Les images livrées, mesurées sur l'image elle-même (voir tools/images/decor.py). */
export const GABARITS: Record<string, GabaritDecor> = {
  // livrée le 01/10 : 1672 × 941, ouverture de 596 à 863, 573 → 1097 en bas
  tempere: { largeur: 1672, hauteur: 941, horizon: 191, ouvertureHaut: 596, ouvertureBas: 863, ouvertureGauche: 573, ouvertureDroite: 1097 },
}

/** Le biome qui a son image ; les autres prennent la tempérée en attendant. */
export function decorDuBiome(biome: string): string {
  return biome in GABARITS ? biome : 'tempere'
}

/** La part du déplacement de la caméra que suit l'allée À L'HORIZON (0 : elle
 *  suit le monde, comme le premier plan ; 1 : elle reste collée à l'écran). */
export const PARALLAXE_HORIZON = 0.35

export interface PlacementDecor {
  /** l'image entière, dans le monde (y vers le HAUT) */
  image: Rect
  /** unités monde par pixel d'image */
  echelle: number
  /** le centre de la salle : l'allée bouge avec l'écart de la caméra à lui */
  centre: { x: number; y: number }
}

/**
 * PLACER l'image autour de la salle : le haut de l'ouverture s'aligne sur le
 * bord haut de la salle (coque comprise) — la passerelle peinte arrive là —
 * centré sur elle, à l'échelle où la salle COUVRE toute l'ouverture : le bas
 * du trapèze au plus aussi large qu'elle, sa hauteur au plus aussi haute.
 * Une salle plate se règle sur la hauteur (sinon le bas de l'ouverture,
 * noir, dépassait sous elle) et mord alors un peu le plancher de côté.
 */
export function placeDecor(salle: Rect, g: GabaritDecor): PlacementDecor {
  const k = Math.min(
    (salle.maxX - salle.minX) / (g.ouvertureDroite - g.ouvertureGauche),
    (salle.maxY - salle.minY) / (g.ouvertureBas - g.ouvertureHaut),
  )
  const cx = (salle.minX + salle.maxX) / 2
  const xOuverture = (g.ouvertureGauche + g.ouvertureDroite) / 2
  const minX = cx - xOuverture * k
  const maxY = salle.maxY + g.ouvertureHaut * k
  return {
    image: { minX, minY: maxY - g.hauteur * k, maxX: minX + g.largeur * k, maxY },
    echelle: k,
    centre: { x: cx, y: (salle.minY + salle.maxY) / 2 },
  }
}

/** Le jumeau CPU du shader : la parallaxe d'une ligne de l'image (v : 0 en
 *  haut, 1 en bas). Nulle au premier plan, PARALLAXE_HORIZON à l'horizon. */
export function parallaxe(v: number, g: GabaritDecor): number {
  const h = g.horizon / g.hauteur
  const o = g.ouvertureHaut / g.hauteur
  if (v >= o) return 0
  const t = Math.min(1, Math.max(0, (o - v) / (o - h)))
  // en douceur : l'allée près de la salle reste presque collée au premier plan
  return PARALLAXE_HORIZON * t * t
}
