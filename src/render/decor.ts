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
  /** l'horizon de l'allée : là où sa parallaxe atteint PARALLAXE_HORIZON */
  horizon: number
  /** l'ouverture : son bord haut, son bord bas, et le bas du trapèze en x */
  ouvertureHaut: number
  ouvertureBas: number
  ouvertureGauche: number
  ouvertureDroite: number
  /** le point où file l'allée : la couche lointaine s'y accroche */
  fuite: { x: number; y: number }
  /** les portes PEINTES ÉTEINTES, rang par rang (le rang +1 d'abord), voie
   *  par voie de gauche à droite : x, y, rayon — le moteur les allume */
  portes: [number, number, number][][]
  /** le sas de la cloison de fin du module : x, y, rayon */
  sas: [number, number, number]
}

/** Les images livrées, mesurées sur l'image elle-même (tools/images/decor.py,
 *  portes relevées à la main sur l'image). */
export const GABARITS: Record<string, GabaritDecor> = {
  // v2 livrée le 01/10 : 1672 × 941, la frise des modules lointains effacée
  // (ils viennent de la couche lointaine) ; ouverture de 620 à 883, 615 →
  // 1057 en bas ; quatre rangs de portes lisibles, le cinquième caché
  tempere: {
    largeur: 1672,
    hauteur: 941,
    horizon: 150,
    ouvertureHaut: 620,
    ouvertureBas: 883,
    ouvertureGauche: 615,
    ouvertureDroite: 1057,
    fuite: { x: 840, y: 150 },
    portes: [
      [[443, 490, 45], [840, 490, 45], [1233, 490, 45]],
      [[560, 363, 32], [840, 360, 32], [1123, 363, 32]],
      [[630, 270, 22], [840, 270, 22], [1040, 270, 22]],
      [[677, 220, 15], [840, 219, 15], [1003, 220, 15]],
    ],
    sas: [840, 160, 38],
  },
}

/** LA COUCHE LOINTAINE : les autres modules de la station, une image pour
 *  tous les biomes (livrée le 01/10, 1986 × 792), son point de fuite là où
 *  ses poutres convergent. Accrochée au point de fuite de l'allée, plus
 *  large qu'elle, elle suit la caméra bien plus que l'allée. */
export const LOINTAIN = { largeur: 1986, hauteur: 792, fuite: { x: 993, y: 320 }, largeurRelative: 0.95, parallaxe: 0.6 }

/** Où poser la couche lointaine, dans le monde, d'après le décor placé. */
export function placeLointain(p: PlacementDecor, g: GabaritDecor): Rect {
  const lImage = p.image.maxX - p.image.minX
  const k = (lImage * LOINTAIN.largeurRelative) / LOINTAIN.largeur
  const fx = p.image.minX + g.fuite.x * p.echelle
  const fy = p.image.maxY - g.fuite.y * p.echelle
  const minX = fx - LOINTAIN.fuite.x * k
  const maxY = fy + LOINTAIN.fuite.y * k
  return { minX, minY: maxY - LOINTAIN.hauteur * k, maxX: minX + LOINTAIN.largeur * k, maxY }
}

/** Ce que la mini-carte dit des salles devant soi (main.ts la remplit). */
export interface VueCarte {
  /** combien de rangs restent devant la salle courante dans le module */
  rangsDevant: number
  voies: number
  /** les salles joignables : "k:v" — k = 1 pour le rang suivant */
  joignables: ReadonlySet<string>
}

/** Un feu à poser sur l'image : x, y, rayon (pixels d'image), couleur, force. */
export interface FeuDecor {
  x: number
  y: number
  r: number
  couleur: [number, number, number]
  force: number
}

export const AMBRE: [number, number, number] = [1.0, 0.62, 0.25]
export const BLEU: [number, number, number] = [0.39, 0.72, 0.9]

/**
 * LE LIEN AVEC LA MINI-CARTE, rien qu'en lumière : les portes sont peintes
 * éteintes, le moteur allume celles qui comptent. Ambre franc sur les salles
 * joignables du rang suivant — où l'on peut aller maintenant ; bleu pâle sur
 * celles qu'on pourra joindre plus loin ; rien sur les salles que les choix
 * ont fermées. Le sas de la cloison s'allume quand il ne reste plus de rang :
 * la sortie du module. Hors d'une run, toutes les portes en veille.
 * La peinture est fixe : la première rangée est TOUJOURS le rang +1.
 */
export function feuxDecor(g: GabaritDecor, vue: VueCarte | null): FeuDecor[] {
  const feux: FeuDecor[] = []
  if (!vue) {
    for (const rang of g.portes) for (const [x, y, r] of rang) feux.push({ x, y, r, couleur: BLEU, force: 0.35 })
    return feux
  }
  g.portes.forEach((rang, i) => {
    const k = i + 1
    if (k > vue.rangsDevant) return
    rang.forEach(([x, y, r], j) => {
      // les voies de la carte sur les trois portes peintes
      const v = vue.voies === rang.length ? j : Math.round((j * (vue.voies - 1)) / Math.max(1, rang.length - 1))
      if (!vue.joignables.has(`${k}:${v}`)) return
      feux.push(k === 1 ? { x, y, r, couleur: AMBRE, force: 1 } : { x, y, r, couleur: BLEU, force: 0.55 })
    })
  })
  if (vue.rangsDevant <= 0) {
    const [x, y, r] = g.sas
    feux.push({ x, y, r, couleur: AMBRE, force: 1 })
  }
  return feux
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
