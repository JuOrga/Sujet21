// LA PORTÉE D'UNE BOÎTE — jusqu'où elle peut changer la couleur d'un pixel.
//
// LE COÛT QU'ELLE RETIRE. La composition (renderer.ts, COMPOSE_FS) parcourt
// les boîtes du tableau pour CHAQUE pixel, à trois endroits : la salle (l'union
// des coques), la couverture (quel solide recouvre ce pixel) et la peinture.
// Seule la peinture rejetait les boîtes lointaines, et seulement APRÈS avoir
// calculé leur distance, décodé leur matériau et classé celui-ci ; les deux
// autres boucles ne rejetaient rien, et le sas n'était jamais rejeté. Mesuré
// au hub le 16/11/2026 (39 boîtes, compteur d'instructions exécutées injecté
// dans le shader) : 17 040 unités de travail par pixel, dont 13 357 pour le
// seul parcours des boîtes — et 16 000 au moins jusque dans le vide hors des
// modules, où aucune boîte ne peint.
//
// CE QUE CE MODULE CALCULE, une fois par image et par boîte : UN NOMBRE, le
// rayon dont il faut agrandir la boîte englobante (non pivotée) pour contenir
// tout ce que la boîte peut peindre. Le shader le lit en tête de chaque
// boucle (horsPortee) : hors du rectangle, la boîte suivante. Quatre par
// vec4, comme les hauteurs (budgets.spec.ts : un tableau de plus par boîte
// ferait tomber le budget d'uniformes).
// Et, avec le même nombre, LE TRI : une boîte dont le rectangle ne touche pas
// la vue n'est pas envoyée du tout.
//
// L'IMAGE NE CHANGE PAS, et c'est tenu par construction — chaque rayon est
// une borne de ce que le shader peint (portee.spec.ts le vérifie sur les
// jumelles TypeScript des distances) :
//  · PEINTURE : le rayon contient le rejet que le shader faisait déjà
//    (reachMax, recopié dans porteePeinture) — on ne saute que ce qu'il
//    sautait, plus tôt. Le sas, le vide et la baie, jamais rejetés, ont leur
//    borne : au-delà, leurs termes valent exactement 0.
//  · SALLE : une coque ne compte plus dès que tout ce qui lit la distance à
//    la salle est saturé (le fondu du bord, la bande de coque, le liseré).
//  · COUVERTURE : elle ne sert pas qu'au recouvrement. La lumière des
//    solides (eclSolide) se règle sur la hauteur du solide LE PLUS PROCHE, et
//    deux peintures la lisent LOIN de leur boîte : le givre de la plaque
//    froide et le sol chauffé de la chaudière. Le plus proche est alors au
//    plus à la portée de celle qui peint : la couverture garde donc toute
//    boîte à moins de la PLUS GRANDE portée du tableau (elargissement).
//    Le vide et la baie, eux, lisent cette lumière à N'IMPORTE quelle
//    distance du solide le plus proche : un tableau qui en porte garde sa
//    couverture entière, et n'est pas trié (SANS_REJET). Dix tableaux
//    partagés sur 76 au 16/11/2026 ; ils gardent le gain des deux autres
//    boucles.
import {
  MAT_BAIE,
  MAT_CHAUD,
  MAT_EXIT,
  MAT_FROID,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_SURCHAUFFEUR,
  MAT_VIDE,
} from '../game/level'
import { FORME_COQUE } from '../game/formes'
import { HAUTEUR_BLOCS } from './hauteurs'
import { FLOU_OMBRE_COURTE, longueurOmbreCourte } from './volume'

/** Le rayon de rejet d'un solide sans aura : l'ombre courte d'un mur haut et
 *  son flou (le `reachMax` de base du shader — epaisseur.spec.ts). */
export const PORTEE_SOLIDE = longueurOmbreCourte(HAUTEUR_BLOCS) + FLOU_OMBRE_COURTE
/** Le surchauffeur : l'onde de choc de sa recharge, tant que son éclat vit. */
export const PORTEE_ECLAT = 300
/** Le surchauffeur au repos, et le miroir. */
export const PORTEE_POLI = 60
/** « Jamais rejeté » : un rayon plus grand que tout tableau. Fini, pour
 *  rester un flottant ordinaire dans un uniforme. */
export const SANS_REJET = 1e9

/** Ce dont la portée dépend, tel que le shader le reçoit à cette image. */
export interface CadrePortee {
  /** unités d'écran (px CSS) par unité monde */
  zoom: number
  /** le relief 2.5D (uRelief) : 0 éteint */
  relief: number
  /** la vue, en px CSS */
  vueW: number
  vueH: number
  /** le centre de la caméra, en unités monde */
  cx: number
  cy: number
  /** les bandes, telles qu'elles partent en uniformes (uHydroBand,
   *  uHeatBand, uColdBand) et la portée du sas (uExitRadius) */
  hydro: number
  chaud: number
  froid: number
  sas: number
}

/** La boîte telle que le shader la lit : ses bornes et ses deux premières
 *  cases d'`aux` décodées, plus la quatrième (aura, éclat). */
export interface BoitePortee {
  minX: number
  minY: number
  maxX: number
  maxY: number
  material: number
  forme: number
  /** l'angle de la boîte, en RADIANS (aux.y) */
  angle: number
  /** aux.w : la portée d'aura d'une chaudière, l'éclat d'un surchauffeur */
  auxW: number
}

/** Le plus long déplacement du relief sur cette vue : `length(relDisp)` du
 *  shader, pris au coin de l'écran. 0 relief éteint. */
export function debordRelief(c: CadrePortee): number {
  if (!(c.relief > 0)) return 0
  const demiDiagonale = (0.5 * Math.hypot(c.vueW, c.vueH)) / c.zoom
  return demiDiagonale * c.relief * Math.min(1, Math.max(0, c.zoom * 1.2))
}

/** Le liseré (`edgeW` du shader), en unités monde. */
export function lisere(c: CadrePortee): number {
  return 2.5 / c.zoom
}

/** Un solide a un corps : tout, sauf le sas (une bouche) et les ouvertures
 *  sur le dehors — le `solide` du shader, à l'identique. */
export function estSolide(material: number): boolean {
  return material !== MAT_EXIT && material < MAT_VIDE
}

/** Jusqu'où la PEINTURE d'une boîte porte, depuis son rectangle (hors
 *  liseré et relief, que rayonPortee ajoute). Pour un solide : le `reachMax`
 *  du shader, branche pour branche. Pour le sas, le vide et la baie, que le
 *  shader ne rejetait pas : la distance au-delà de laquelle tous leurs termes
 *  valent 0. Un matériau inconnu n'est jamais rejeté. */
export function porteePeinture(material: number, auxW: number, c: CadrePortee): number {
  if (estSolide(material)) {
    let r = PORTEE_SOLIDE
    if (material === MAT_HYDROPHILE || material === MAT_HYDROPHOBE) r = Math.max(r, c.hydro)
    else if (material === MAT_CHAUD) r = Math.max(r, c.chaud * auxW)
    else if (material === MAT_FROID) r = Math.max(r, c.froid)
    else if (material === MAT_SURCHAUFFEUR) r = Math.max(r, auxW > 0.001 ? PORTEE_ECLAT : PORTEE_POLI)
    else if (material > MAT_SURCHAUFFEUR) r = Math.max(r, PORTEE_POLI)
    return r
  }
  // le vide et la baie ne peignent que dans leur forme et sur leur liseré
  if (material === MAT_VIDE || material === MAT_BAIE) return 0
  // le sas se mesure depuis son CENTRE : voir rayonPortee
  if (material === MAT_EXIT) return 0
  return SANS_REJET
}

/** LE RAYON : ce dont on agrandit la boîte englobante NON PIVOTÉE pour
 *  contenir tout ce que la boîte peut peindre. */
export function rayonPortee(b: BoitePortee, c: CadrePortee): number {
  const hx = (b.maxX - b.minX) / 2
  const hy = (b.maxY - b.minY) / 2
  const marge = lisere(c) + debordRelief(c) + 1
  if (b.material === MAT_EXIT) {
    // (un sas qui ferait salle n'existe pas : s'il venait, jamais rejeté)
    if (b.forme >= FORME_COQUE) return SANS_REJET
    // le halo de courant s'éteint à max(uExitRadius, rad) du centre ; l'iris,
    // son assise et son anneau sont à 0 bien avant deux rayons de bouche
    // (l'anneau y vaut e^-39). Le sas ne pivote pas : il se dessine rond.
    const rad = Math.min(hx, hy)
    return Math.max(c.sas, 2 * rad) - rad + marge
  }
  let r = porteePeinture(b.material, b.auxW, c)
  if (r >= SANS_REJET) return SANS_REJET
  // UNE COQUE FAIT SALLE : tant que la distance à la salle n'a pas saturé
  // tout ce qui la lit (le fondu du bord sur 6/zoom, la bande de coque
  // jusqu'à 34 u, le liseré sur 5,5/zoom), elle compte
  if (b.forme >= FORME_COQUE) r = Math.max(r, 40, 8 / c.zoom)
  // la boîte pivote dans son rectangle : ce que la rotation fait déborder
  // de la boîte non pivotée s'ajoute au rayon
  const ca = Math.abs(Math.cos(b.angle))
  const sa = Math.abs(Math.sin(b.angle))
  const exces = Math.max(0, hx * ca + hy * sa - hx, hx * sa + hy * ca - hy)
  return r + marge + exces
}

/** Les boîtes de la vue, prêtes à partir en uniformes. */
export interface BoitesVue {
  /** minX, minY, maxX, maxY — quatre par boîte gardée */
  boxes: Float32Array
  /** aux, quatre par boîte gardée */
  aux: Float32Array
  /** la hauteur de chaque boîte gardée */
  hauteurs: Float32Array
  /** le rayon de portée de chaque boîte gardée */
  portees: Float32Array
  /** combien de boîtes sont gardées */
  n: number
  /** ce dont la COUVERTURE élargit chaque rayon (uPorteeCouv) */
  couverture: number
}

export function boitesVueVides(capacite: number): BoitesVue {
  return {
    boxes: new Float32Array(capacite * 4),
    aux: new Float32Array(capacite * 4),
    hauteurs: new Float32Array(capacite),
    portees: new Float32Array(capacite),
    n: 0,
    couverture: SANS_REJET,
  }
}

// le décodage d'aux.x, comme decodeAux du shader : (matériau, forme)
function decode(code: number, b: BoitePortee): void {
  const q1 = Math.floor(code / 16384)
  code -= q1 * 16384
  const q0 = Math.floor(code / 128)
  code -= q0 * 128
  b.forme = Math.floor(code / 16)
  b.material = code - b.forme * 16
}

const scratch: BoitePortee = { minX: 0, minY: 0, maxX: 0, maxY: 0, material: 0, forme: 0, angle: 0, auxW: 0 }

/**
 * LE TRI ET LES RAYONS. Lit les `n` boîtes telles qu'elles partent au shader
 * (dans l'ordre de peinture), calcule le rayon de chacune et l'élargissement
 * de la couverture, puis ne recopie dans `out` que celles dont le rectangle
 * élargi touche la vue — DANS LE MÊME ORDRE : la dernière peinte reste
 * dessus, et à distance égale la première garde la couverture.
 *
 * Les tableaux d'entrée ne sont pas touchés : le cuiseur de la carte de
 * lumière et la coque les lisent en entier.
 */
export function boitesDansLaVue(
  n: number,
  boxes: Float32Array,
  aux: Float32Array,
  hauteurs: Float32Array,
  c: CadrePortee,
  out: BoitesVue,
): void {
  // premier passage : les rayons (dans out.portees, à l'indice d'ORIGINE),
  // la plus grande portée de peinture d'un solide, et la présence d'une
  // ouverture sur le dehors
  let porteeMax = 0
  let ouverture = false
  const b = scratch
  for (let k = 0; k < n; k++) {
    b.minX = boxes[k * 4]
    b.minY = boxes[k * 4 + 1]
    b.maxX = boxes[k * 4 + 2]
    b.maxY = boxes[k * 4 + 3]
    decode(aux[k * 4], b)
    b.angle = aux[k * 4 + 1]
    b.auxW = aux[k * 4 + 3]
    out.portees[k] = rayonPortee(b, c)
    if (estSolide(b.material)) porteeMax = Math.max(porteeMax, porteePeinture(b.material, b.auxW, c))
    else if (b.material !== MAT_EXIT) ouverture = true
  }
  // LA COUVERTURE garde toute boîte à moins de la plus grande portée du
  // tableau (voir l'en-tête) ; relief allumé, le sommet de celle qui peint et
  // celui de la plus proche ont glissé chacun de leur côté : deux déplacements
  // de plus. Une ouverture sur le dehors : rien n'est rejeté, rien n'est trié.
  out.couverture = ouverture ? SANS_REJET : porteeMax + 2 * debordRelief(c)
  const demiW = c.vueW / 2 / c.zoom
  const demiH = c.vueH / 2 / c.zoom
  const vx0 = c.cx - demiW
  const vx1 = c.cx + demiW
  const vy0 = c.cy - demiH
  const vy1 = c.cy + demiH
  // second passage : le tri, en place — j ≤ k, on n'écrase que du déjà lu
  let j = 0
  for (let k = 0; k < n; k++) {
    const r = out.portees[k] + out.couverture
    const x0 = boxes[k * 4]
    const y0 = boxes[k * 4 + 1]
    const x1 = boxes[k * 4 + 2]
    const y1 = boxes[k * 4 + 3]
    if (x0 - r > vx1 || x1 + r < vx0 || y0 - r > vy1 || y1 + r < vy0) continue
    out.boxes[j * 4] = x0
    out.boxes[j * 4 + 1] = y0
    out.boxes[j * 4 + 2] = x1
    out.boxes[j * 4 + 3] = y1
    out.aux[j * 4] = aux[k * 4]
    out.aux[j * 4 + 1] = aux[k * 4 + 1]
    out.aux[j * 4 + 2] = aux[k * 4 + 2]
    out.aux[j * 4 + 3] = aux[k * 4 + 3]
    out.hauteurs[j] = hauteurs[k]
    out.portees[j] = out.portees[k]
    j++
  }
  out.n = j
}
