// LA PROFONDEUR DES COUCHES DE FOND.
//
// Le dehors du vaisseau se peint en couches — la station lointaine, le semis
// d'étoiles, la paroi de cuve derrière l'eau. Jusqu'ici chacune n'avait qu'UN
// nombre : son glissement quand la caméra se déplace. Leur TAILLE, elle,
// suivait le zoom à l'identique sur toutes les couches — et c'est pour cette
// raison que le dehors restait un défilement au lieu d'une profondeur. Une
// chose lointaine ne grossit presque pas quand on s'en approche : c'est même
// à ça qu'on la reconnaît comme lointaine.
//
// Chaque couche porte donc DEUX nombres, tous deux entre 0 et 1, avec la
// même convention pour les deux :
//
//     1 — la couche se comporte comme le PLAN DE JEU ;
//     0 — la couche est INFINIMENT LOIN.
//
//   suivi : ce qu'elle fait quand la caméra se DÉPLACE. À 1 elle est collée
//           au monde et défile comme lui ; à 0 elle est collée à l'écran.
//   zoom  : ce qu'elle fait quand la caméra ZOOME. À 1 elle grandit comme le
//           monde ; à 0 sa taille apparente ne change jamais.
//
// Ce module tient la règle, les valeurs ET le calcul : le facteur ne dépend
// que du zoom et des réglages, jamais du pixel — il part donc au shader tout
// cuit, une fois par image, et le shader n'a plus qu'une multiplication. Les tests de ce fichier gravent les deux
// propriétés qui comptent : à zoom = 1 le rendu est celui d'AVANT au chiffre
// près, et à zoom = 0 la couche ne change pas de taille.

export interface Couche {
  suivi: number
  zoom: number
}

export interface ReglagesParallaxe {
  ciel: Couche
  semis: Couche
  cuve: Couche
  /** Le zoom d'ÉTALONNAGE : le grossissement auquel toutes les couches
   *  s'accordent avec le monde. À caler sur le zoom de JEU ordinaire, pour
   *  que la profondeur ne se manifeste qu'aux moments de recul. */
  ref: number
}

/** Les valeurs d'origine. Les SUIVIS sont ceux d'avant, au chiffre près (le
 *  ciel suivait la caméra à 62 %, donc s'accrochait au monde à 38 %) ; seuls
 *  les ZOOMS sont neufs. */
export const PARALLAXE_DEFAUTS: ReglagesParallaxe = {
  ciel: { suivi: 0.38, zoom: 0.45 },
  semis: { suivi: 1, zoom: 0.75 },
  cuve: { suivi: 0.9, zoom: 0.94 },
  // MESURÉ, pas estimé : le zoom d'une salle en début de partie tourne
  // autour de 0,13–0,15 sur 1280 × 800 (l'auto-zoom cadre le corps, et le
  // corps est alors au plus gros). C'est donc là qu'on étale : à l'entrée
  // d'une salle l'image est exactement celle d'avant ce réglage, et la
  // profondeur se révèle ENSUITE — car le corps rétrécit à chaque impulsion,
  // la caméra se rapproche, et les couches lointaines refusent de grossir
  // avec elle. Le fond s'ouvre à mesure que le sujet s'amenuise ; ce n'est
  // pas un effet cherché, c'est la conséquence exacte de la règle, et elle
  // tombe juste.
  ref: 0.15,
}

/**
 * LE FACTEUR D'UNE COUCHE : le rapport entre le zoom réel et celui qu'elle
 * « ressent ». À zoom = 1 il vaut 1 quoi qu'il arrive — et la formule se
 * réduit exactement à l'ancienne, `w - centre * (1 - suivi)`.
 *
 * Il ne dépend que des réglages et du zoom, jamais du pixel : il se calcule
 * donc ICI, une fois par image, et part au shader tout cuit. Le shader n'a
 * plus qu'une multiplication — et cette fonction-ci, celle que les tests
 * couvrent, est la SEULE implémentation de la règle.
 */
export function facteurG(zoom: number, couche: Couche, ref: number): number {
  return Math.pow(Math.max(zoom, 1e-4) / Math.max(ref, 1e-4), 1 - couche.zoom)
}

/**
 * Où échantillonner une couche, pour un point du monde — le miroir exact de
 * ce que fait le shader, gardé ici pour que les tests portent sur la règle.
 */
export function coucheFond(
  wx: number,
  wy: number,
  cx: number,
  cy: number,
  zoom: number,
  couche: Couche,
  ref: number,
): { x: number; y: number } {
  const g = facteurG(zoom, couche, ref)
  return { x: cx * couche.suivi + (wx - cx) * g, y: cy * couche.suivi + (wy - cy) * g }
}

/**
 * COMBIEN D'UNITÉS DE TEXTURE tient une largeur d'écran donnée, pour une
 * couche. C'est la mesure qui dit si une couche « grandit » ou non : plus le
 * nombre est petit, plus le motif paraît gros à l'écran.
 */
export function empriseEcran(
  largeurCss: number,
  zoom: number,
  couche: Couche,
  ref: number,
): number {
  return (largeurCss / Math.max(zoom, 1e-4)) * facteurG(zoom, couche, ref)
}

// ---------------------------------------------------------------------------
// LA PLAQUE DE CIEL, CADRÉE — une seule Voie lactée, jamais répétée.
//
// La plaque était une couche comme les autres : collée au monde, répétée à
// l'infini. En reculant ou en se déplaçant, on voyait donc sa COPIE — deux
// Voies lactées parallèles, puis trois : un papier peint. Un ciel n'a
// qu'une Voie lactée.
//
// Elle est donc cadrée par rapport à l'ÉCRAN, et non plus au monde : l'écran
// en montre une PART (sur sa grande dimension), qui ne dépend que du zoom,
// bornée des deux côtés ; son centre DÉRIVE avec la caméra pour que la
// profondeur se sente, mais par une tangente hyperbolique qui sature avant le
// bord. La garantie que les tests gravent : quels que soient la position, le
// zoom et le format de l'écran, le rectangle vu tient DANS l'image.

export interface ReglagesPlaque {
  /** La part de la plaque que montre la grande dimension de l'écran, au
   *  zoom d'étalonnage. Plus grande : la Voie lactée paraît plus petite. */
  part: number
  /** La réponse au zoom, même convention que les couches : 1 grandit comme
   *  le monde, 0 ne change jamais de taille. Le ciel est loin : peu. */
  zoom: number
  /** Les bornes de la part montrée : la plus serrée (zoom avant) et la plus
   *  large (recul) — celle-ci reste sous 1, c'est ce qui interdit le bord. */
  partMin: number
  partMax: number
  /** La dérive du centre, en fraction de plaque par unité-monde de
   *  déplacement de la caméra, près de l'origine (avant saturation). */
  derive: number
  /** Le zoom d'étalonnage, celui du jeu ordinaire. */
  ref: number
}

// La part de 0,85 se règle sur la plaque livrée (une image de 1254 px) :
// à 0,6, la bande emplissait tout l'écran — plus de noir autour, plus de
// région bleue — et l'image, agrandie d'autant, tournait au grain pâteux.
export const PLAQUE_DEFAUTS: ReglagesPlaque = {
  part: 0.85,
  zoom: 0.3,
  partMin: 0.45,
  partMax: 0.96,
  derive: 4e-5,
  ref: 0.3,
}

/** Où l'écran regarde dans la plaque : le centre (en coordonnées de
 *  texture, 0..1, y vers le haut) et la taille d'un pixel CSS en coordonnées
 *  de texture. Le shader n'a plus qu'une multiplication-addition par pixel. */
export interface CadrePlaque {
  cx: number
  cy: number
  parPx: number
}

export function cadrePlaque(
  camX: number,
  camY: number,
  zoom: number,
  largeurCss: number,
  hauteurCss: number,
  r: ReglagesPlaque = PLAQUE_DEFAUTS,
): CadrePlaque {
  const z = Math.max(zoom, 1e-4) / Math.max(r.ref, 1e-4)
  const partMax = Math.min(r.partMax, 0.96)
  const part = Math.min(partMax, Math.max(r.partMin, r.part * Math.pow(z, -(1 - r.zoom))))
  const grand = Math.max(largeurCss, hauteurCss, 1)
  const parPx = part / grand
  // la place qui reste de chaque côté du rectangle vu : la dérive ne peut
  // pas la dépasser, la tangente hyperbolique y tend sans l'atteindre. Moins
  // une MARGE d'un pour cent : saturée, la tangente touche le bord au
  // chiffre près, et le filtrage lit aussi les texels voisins de l'écran
  const MARGE = 0.01
  const resteX = 0.5 - MARGE - (largeurCss * parPx) / 2
  const resteY = 0.5 - MARGE - (hauteurCss * parPx) / 2
  const glisse = (cam: number, reste: number): number =>
    reste > 1e-6 ? reste * Math.tanh((cam * r.derive) / reste) : 0
  return { cx: 0.5 + glisse(camX, resteX), cy: 0.5 + glisse(camY, resteY), parPx }
}
