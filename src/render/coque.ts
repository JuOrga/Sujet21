// LA COQUE DE LA CUVE — sa géométrie et ce qui la perce, en clair et testable.
//
// La coque est une passe à part (drawHull, renderer.ts) : quatre bandes
// texturées posées PAR-DESSUS la composition. Deux conséquences qui ont
// motivé ce module :
//
// 1. LE VIDE NE LA PERÇAIT PAS. Un bloc « Vide (le dehors, à nu) » posé à
//    cheval sur la paroi se peignait dans la composition — donc DESSOUS la
//    coque, qui repassait intacte par-dessus : le trou s'arrêtait net au
//    bord de la cuve, et sa part au-dehors dessinait un cadre dans le vide.
//    La passe de coque reçoit donc désormais les vides qui la touchent, et
//    s'efface dedans (discard), tranche de la découpe comprise.
//
// 2. LE DEHORS ÉTAIT NU. Au-delà de la coque, rien que le ciel : une
//    station n'est pas un caisson lisse. Chaque bande s'étend donc d'une
//    FRANGE au-delà de la paroi, où le shader pose le matériel de coque
//    d'une station orbitale, vu de dessus et COMPOSÉ pour la salle
//    (compositionCoque.ts) — du décor pur, sans physique.
//
// Le shader ne se teste pas ; ce qui décide de ce qu'il reçoit, si.

import type { Bounds } from '../sim/solver'
import { MAT_VIDE } from '../game/level'

/** Épaisseur de la coque, en unités monde. */
export const COQUE_EPAISSEUR = 90
/** La frange de décor extérieur, au-delà de la coque : la plus grande pièce
 *  de la composition y tient — le bras (jusqu'à 310) et l'aile au bout
 *  (236), vue de dessus (compositionCoque.ts). */
export const COQUE_FRANGE = 560
/** Longueur d'une répétition de la texture de coque (aspect 2,5:1). */
export const COQUE_REP = 225
/** Vides que la passe de coque sait découper — au-delà, les suivants ne
 *  percent plus la coque (ils restent peints dans la cuve). Un tableau en
 *  pose rarement plus de deux ou trois à cheval sur la paroi. */
export const MAX_VIDES_COQUE = 16

/** Flottants par sommet : position (2), le long / en travers (2), côté et
 *  longueur utile de la paroi (2). */
export const COQUE_FLOTTANTS = 6
/** 4 bandes × 2 morceaux (la coque d'onglet, la frange) × 2 triangles ×
 *  3 sommets. */
export const COQUE_SOMMETS = 48
/** Le FOND DE STATION : un grand quadrilatère sous les bandes, où se posent
 *  les modules voisins et le lointain (compositionCoque.ts). Côté 4 : le
 *  shader le reconnaît, et s'arrête sur la cuve et sa coque. */
export const STATION_SOMMETS = 6
export const COTE_STATION = 4
/** Assez large pour couvrir l'écran au plus fort recul. */
export const STATION_MARGE = 20000

// Les côtés, dans l'ordre où le shader les lit (vCote) : la normale
// sortante s'en déduit — 0 haut (+y), 1 bas (−y), 2 gauche (−x), 3 droite (+x).
export const COTE_HAUT = 0
export const COTE_BAS = 1
export const COTE_GAUCHE = 2
export const COTE_DROITE = 3

/** Remplit `out` avec les quatre bandes de coque ET leur frange extérieure.
 *  Chaque sommet porte (x, y, s, a, côté, longueur) : `s` court le long de
 *  la paroi depuis l'angle bas-gauche de la cuve, `a` monte du bord
 *  INTÉRIEUR (0, le tube lumineux) vers le dehors (épaisseur + frange).
 *
 *  LES ANGLES SONT COUPÉS D'ONGLET, comme un cadre. Chaque bande a deux
 *  morceaux : la COQUE (0 ≤ a ≤ épaisseur), un trapèze dont le bord
 *  intérieur court de 0 à la longueur et le bord extérieur déborde d'une
 *  épaisseur à chaque bout — les quatre se rejoignent sur les diagonales des
 *  angles ; puis la FRANGE (au-delà), un rectangle.
 *  Avant, les bandes horizontales couvraient seules les carrés d'angle et
 *  les verticales s'y arrêtaient net : en haut à gauche, la tôle du haut
 *  filait par-dessus le montant, dont les plaques, le tube et le chanfrein
 *  butaient sur une couture droite (retour du concepteur, 17/11 : « il
 *  faudrait que cela fusionne »). Coupés d'onglet, la tôle, les conduites
 *  et le tube lumineux tournent l'angle ensemble.
 *  Les franges, elles, gardent leur partage : les horizontales débordent
 *  d'une épaisseur aux deux bouts, les verticales s'arrêtent à la cuve —
 *  elles ne se chevauchent jamais. */
export function remplitBandesCoque(
  b: Bounds,
  out: Float32Array,
  epaisseur = COQUE_EPAISSEUR,
  frange = COQUE_FRANGE,
): number {
  const T = epaisseur
  const H = epaisseur + frange
  const lx = b.maxX - b.minX
  const ly = b.maxY - b.minY
  let o = 0
  const sommet = (x: number, y: number, s: number, a: number, cote: number, long: number) => {
    out[o++] = x
    out[o++] = y
    out[o++] = s
    out[o++] = a
    out[o++] = cote
    out[o++] = long
  }
  // un quadrilatère (s, a) en deux triangles (p0 p1 p2) (p0 p2 p3) : `s`
  // et `a` sont affines dans le monde, l'interpolation les rend exacts
  // jusque dans le biais de l'onglet
  const quad = (
    cote: number,
    long: number,
    coins: readonly [number, number][],
    pos: (s: number, a: number) => [number, number],
  ) => {
    const [p0, p1, p2, p3] = coins
    for (const [s, a] of [p0, p1, p2, p0, p2, p3]) {
      const [x, y] = pos(s, a)
      sommet(x, y, s, a, cote, long)
    }
  }
  const bande = (
    cote: number,
    long: number,
    f0: number,
    f1: number,
    pos: (s: number, a: number) => [number, number],
  ) => {
    // la coque, coupée d'onglet : bord intérieur [0, long], bord extérieur
    // [−T, long + T] — le biais tombe sur la diagonale du carré d'angle
    quad(cote, long, [[0, 0], [long, 0], [long + T, T], [-T, T]], pos)
    // la frange, de f0 à f1 le long de la paroi
    quad(cote, long, [[f0, T], [f1, T], [f1, H], [f0, H]], pos)
  }
  // les positions se calculent depuis l'angle le plus proche : les sommets
  // que deux bandes partagent sur un biais tombent au même flottant, sans
  // fente d'un pixel entre elles
  const le = (min: number, max: number, l: number, s: number) =>
    s <= l / 2 ? min + s : max - (l - s)
  bande(COTE_HAUT, lx, -T, lx + T, (s, a) => [le(b.minX, b.maxX, lx, s), b.maxY + a])
  bande(COTE_BAS, lx, -T, lx + T, (s, a) => [le(b.minX, b.maxX, lx, s), b.minY - a])
  bande(COTE_GAUCHE, ly, 0, ly, (s, a) => [b.minX - a, le(b.minY, b.maxY, ly, s)])
  bande(COTE_DROITE, ly, 0, ly, (s, a) => [b.maxX + a, le(b.minY, b.maxY, ly, s)])
  return o / COQUE_FLOTTANTS
}

/** Retient, parmi les boîtes déjà empaquetées pour la composition
 *  (`boites` : minX, minY, maxX, maxY ; `aux` : code, angle, …, par pas de
 *  4), les VIDES qui touchent la coque ou sa frange — ceux qui doivent la
 *  percer. Un vide tout entier dans la cuve ne la touche pas : il n'occupe
 *  pas de case. Le test est conservateur (le cercle circonscrit, qui couvre
 *  toute rotation et toute forme) : un vide gardé à tort ne coûte qu'une
 *  itération, un vide oublié laisserait la coque intacte.
 *  Renvoie le nombre de vides écrits dans `outBoites` (4 par vide) et
 *  `outAux` (code, angle). */
export function videsPercantLaCoque(
  boites: ArrayLike<number>,
  aux: ArrayLike<number>,
  n: number,
  b: Bounds,
  outBoites: Float32Array,
  outAux: Float32Array,
  epaisseur = COQUE_EPAISSEUR,
  frange = COQUE_FRANGE,
): number {
  const ext = epaisseur + frange
  let k = 0
  for (let i = 0; i < n && k < MAX_VIDES_COQUE; i++) {
    const code = aux[i * 4]
    if (Math.round(code) % 16 !== MAT_VIDE) continue
    const x0 = boites[i * 4]
    const y0 = boites[i * 4 + 1]
    const x1 = boites[i * 4 + 2]
    const y1 = boites[i * 4 + 3]
    const cx = (x0 + x1) * 0.5
    const cy = (y0 + y1) * 0.5
    const r = Math.hypot(x1 - x0, y1 - y0) * 0.5
    // tout entier DANS la cuve : il ne touche pas la paroi
    const dedans =
      cx - r >= b.minX && cx + r <= b.maxX && cy - r >= b.minY && cy + r <= b.maxY
    // tout entier au-delà de la frange : rien à percer
    const loin =
      cx + r < b.minX - ext ||
      cx - r > b.maxX + ext ||
      cy + r < b.minY - ext ||
      cy - r > b.maxY + ext
    if (dedans || loin) continue
    outBoites[k * 4] = x0
    outBoites[k * 4 + 1] = y0
    outBoites[k * 4 + 2] = x1
    outBoites[k * 4 + 3] = y1
    outAux[k * 2] = code
    outAux[k * 2 + 1] = aux[i * 4 + 1]
    k++
  }
  return k
}

/** Écrit le fond de station (STATION_SOMMETS sommets) à partir de `debut`
 *  (en sommets) dans `out` : un rectangle autour de la cuve, au même format
 *  que les bandes. Renvoie le nombre de sommets écrits. */
export function remplitFondStation(b: Bounds, out: Float32Array, debut: number): number {
  const m = STATION_MARGE
  const x0 = b.minX - m
  const x1 = b.maxX + m
  const y0 = b.minY - m
  const y1 = b.maxY + m
  let o = debut * COQUE_FLOTTANTS
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y0],
    [x1, y1],
    [x0, y1],
  ]) {
    out[o++] = x
    out[o++] = y
    out[o++] = 0
    out[o++] = 0
    out[o++] = COTE_STATION
    out[o++] = 0
  }
  return STATION_SOMMETS
}

// ——— LA COQUE A UNE HAUTEUR (relief 2.5D) ————————————————————————————
// « Il n'y a pas d'effet 2,5D sur les parois d'enceinte des tableaux » (le
// concepteur, 17/11). Relief allumé, le dessus de chaque solide de la cuve
// fuit le centre de l'écran et sa tranche se dresse (reliefParois.ts) ; la
// coque, passe à part dessinée par-dessus, restait couchée au sol. Les murs
// collés à la paroi glissaient sous elle : leur dessus s'arrêtait net au bord
// de la cuve, et l'enceinte — la plus haute paroi du tableau — était la seule
// à n'avoir ni dessus déplacé ni face.
// La coque est désormais un mur haut comme les autres : son dessus (bande ET
// frange, qui y est fixée) glisse de la même part qu'un mur haut — sa hauteur
// est bornée à HAUTEUR_BLOCS par facteurRelief, comme pour toute coque —, et
// sa FACE INTÉRIEURE, celle qui regarde la cuve, occupe l'anneau entre le
// pied (le bord de la cuve) et le bord déplacé de son dessus.

/** Le côté des faces intérieures dans vCote : 5 + le côté de la bande
 *  (5 haut · 6 bas · 7 gauche · 8 droite). */
export const COTE_FLANC = 5
/** 4 faces × 2 triangles × 3 sommets. */
export const FLANC_SOMMETS = 24

/** Écrit, à partir de `debut` (en sommets), les quatre FACES INTÉRIEURES de
 *  la coque : un trapèze par paroi, du pied (le bord de la cuve, a = 0) au
 *  bord intérieur du dessus (a = 1). Les sommets portent le point du PIED ;
 *  le shader pousse ceux du haut à la place de leur sommet (pointDuSommet,
 *  reliefParois.ts) — les arêtes verticales de la cuve y deviennent les
 *  rayons qui partent du centre, et deux faces voisines se partagent la
 *  leur, sans recouvrement ni jour. Relief éteint, le trapèze est plat :
 *  rien ne se peint. `s` court le long de la paroi comme pour les bandes. */
export function remplitFlancsCoque(b: Bounds, out: Float32Array, debut: number): number {
  const lx = b.maxX - b.minX
  const ly = b.maxY - b.minY
  let o = debut * COQUE_FLOTTANTS
  const face = (cote: number, long: number, x0: number, y0: number, x1: number, y1: number) => {
    // (s, a) : le long, la hauteur (0 pied, 1 sommet)
    for (const [x, y, s, a] of [
      [x0, y0, 0, 0],
      [x1, y1, long, 0],
      [x1, y1, long, 1],
      [x0, y0, 0, 0],
      [x1, y1, long, 1],
      [x0, y0, 0, 1],
    ]) {
      out[o++] = x
      out[o++] = y
      out[o++] = s
      out[o++] = a
      out[o++] = COTE_FLANC + cote
      out[o++] = long
    }
  }
  face(COTE_HAUT, lx, b.minX, b.maxY, b.maxX, b.maxY)
  face(COTE_BAS, lx, b.minX, b.minY, b.maxX, b.minY)
  face(COTE_GAUCHE, ly, b.minX, b.minY, b.minX, b.maxY)
  face(COTE_DROITE, ly, b.maxX, b.minY, b.maxX, b.maxY)
  return FLANC_SOMMETS
}

/** CE QUE MONTRE UN POINT DE LA FACE INTÉRIEURE d'une paroi de coque. Le
 *  point d'écran (wx, wy) — en unités monde — est sur la face s'il existe un
 *  t de [0, 1] tel que `c + (w − c)(1 − t·f)` tombe sur la paroi : t = 0 le
 *  pied, t = 1 le sommet (`f` : fractionSommet de la coque, `c` le centre de
 *  l'écran). Rend [t, abscisse du pied le long de la paroi], ou null hors de
 *  la face — au-delà d'un bout de la paroi (c'est la voisine), ou quand la
 *  face tourne le dos au centre (l'œil est au-delà de la paroi : c'est sa
 *  face extérieure qu'on verrait).
 *  Exact : une paroi est une droite, un seul t la croise. Le jumeau GLSL
 *  (FLANC_COQUE_GLSL) dit la même chose ; coque.spec.ts tient les deux. */
export function piedFlancCoque(
  wx: number,
  wy: number,
  cx: number,
  cy: number,
  f: number,
  b: Bounds,
  cote: number,
): [number, number] | null {
  if (f <= 0) return null
  // la normale sortante de la paroi, et la position de la paroi sur elle
  const nx = cote === COTE_GAUCHE ? -1 : cote === COTE_DROITE ? 1 : 0
  const ny = cote === COTE_HAUT ? 1 : cote === COTE_BAS ? -1 : 0
  const paroi = cote === COTE_HAUT ? b.maxY : cote === COTE_BAS ? -b.minY : cote === COTE_GAUCHE ? -b.minX : b.maxX
  const den = nx * (wx - cx) + ny * (wy - cy)
  const num = paroi - (nx * cx + ny * cy)
  if (den <= 0 || num <= 0) return null
  const k = num / den // 1 − t·f
  const t = (1 - k) / f
  if (t < 0 || t > 1) return null
  const px = cx + (wx - cx) * k
  const py = cy + (wy - cy) * k
  const s = nx !== 0 ? py - b.minY : px - b.minX
  // le pied au-delà d'un bout de la paroi : c'est la face voisine
  if (s < 0 || s > (nx !== 0 ? b.maxY - b.minY : b.maxX - b.minX)) return null
  return [t, s]
}

/** Le jumeau GLSL de piedFlancCoque : (t, s, 1) sur la face, (0, 0, 0)
 *  dehors. `cote` : 0 haut · 1 bas · 2 gauche · 3 droite ; `cuve` : minX,
 *  minY, maxX, maxY. */
export const FLANC_COQUE_GLSL = `// (coque.ts : piedFlancCoque, son jumeau TypeScript)
vec3 piedFlancCoque(vec2 w, vec2 c, float f, vec4 cuve, float cote) {
  if (f <= 0.0) return vec3(0.0);
  vec2 n = cote < 0.5 ? vec2(0.0, 1.0) : cote < 1.5 ? vec2(0.0, -1.0)
         : cote < 2.5 ? vec2(-1.0, 0.0) : vec2(1.0, 0.0);
  float paroi = cote < 0.5 ? cuve.w : cote < 1.5 ? -cuve.y : cote < 2.5 ? -cuve.x : cuve.z;
  float den = dot(n, w - c);
  float num = paroi - dot(n, c);
  if (den <= 0.0 || num <= 0.0) return vec3(0.0);
  float k = num / den;
  float t = (1.0 - k) / f;
  if (t < 0.0 || t > 1.0) return vec3(0.0);
  vec2 p = c + (w - c) * k;
  float s = cote > 1.5 ? p.y - cuve.y : p.x - cuve.x;
  if (s < 0.0 || s > (cote > 1.5 ? cuve.w - cuve.y : cuve.z - cuve.x)) return vec3(0.0);
  return vec3(t, s, 1.0);
}`

// ——— L'OMBRE AU PIED DE LA COQUE ———————————————————————————————————————
// « La délimitation entre le sol et la paroi manque de quelque chose, peut-
// être une ombre » (le concepteur, 17/11, capture relief fort). Depuis que la
// coque se dresse, sa face tombe sur le fond sans rien qui l'y pose : le pied
// n'avait que l'ombre de contact de 6 u (renderer.ts : contactCoque), et le
// halo des parois ÉCLAIRCIT le fond le long d'elles — la face sombre et le
// fond se confondaient. Les solides de la cuve, eux, ont deux lectures au
// sol (volume des parois, volet 2) ; la coque, mur le plus haut du tableau,
// les reçoit à son tour :
//  - l'OCCLUSION, sur les quatre parois : l'angle du fond et du mur reçoit
//    moins de lumière — sombre au pied, fondue sur OMBRE_PIED_PORTEE ;
//  - l'OMBRE COURTE, à l'opposé de la lumière : la longueur d'un mur haut
//    (OMBRE_COURTE_PAR_HAUTEUR × HAUTEUR_BLOCS, 56 u) — la hauteur bornée de
//    la coque, celle de son relief.

/** La part de lumière que l'occlusion ôte au pied même de la paroi. */
export const OMBRE_PIED_FORCE = 0.55
/** Sa portée sur le fond, en unités monde (au moins quelques pixels au recul,
 *  voir le shader). */
export const OMBRE_PIED_PORTEE = 36

/** Ce que la coque ôte au FOND en (x, y) : [occlusion, ombre courte], chacune
 *  de 0 à 1 ; [0, 0] hors de la cuve. (lx, ly) : la direction VERS la
 *  lumière (unitaire) ; `portee` : celle de l'occlusion ; `long` et `flou` :
 *  la longueur de l'ombre courte et son fondu. Le jumeau GLSL
 *  (OMBRE_PIED_COQUE_GLSL) dit la même chose ; coque.spec.ts tient les deux. */
export function ombrePiedCoque(
  x: number,
  y: number,
  b: Bounds,
  lx: number,
  ly: number,
  portee: number,
  long: number,
  flou: number,
): [number, number] {
  const d = Math.min(x - b.minX, b.maxX - x, y - b.minY, b.maxY - y)
  if (d < 0) return [0, 0]
  const ao = OMBRE_PIED_FORCE * Math.exp(-d / portee)
  // depuis ce point du fond, on remonte VERS la lumière : la paroi croisée
  // le premier, à la distance t, l'ombre si t est plus court que l'ombre
  const tx = lx > 1e-6 ? (b.maxX - x) / lx : lx < -1e-6 ? (b.minX - x) / lx : Infinity
  const ty = ly > 1e-6 ? (b.maxY - y) / ly : ly < -1e-6 ? (b.minY - y) / ly : Infinity
  const t = Math.min(tx, ty)
  const lisse = (a: number, c: number, v: number): number => {
    const k = Math.min(Math.max((v - a) / (c - a), 0), 1)
    return k * k * (3 - 2 * k)
  }
  // dense au pied, elle s'éclaircit en s'éloignant — comme celle des solides
  const o = (1 - lisse(long, long + flou, t)) * (1 - 0.5 * lisse(0, long + flou, t))
  return [ao, o]
}

export const OMBRE_PIED_COQUE_GLSL = `// (coque.ts : ombrePiedCoque, son jumeau TypeScript)
vec2 ombrePiedCoque(vec2 p, vec2 bMin, vec2 bMax, vec2 l, float portee, float lng, float flou) {
  float d = min(min(p.x - bMin.x, bMax.x - p.x), min(p.y - bMin.y, bMax.y - p.y));
  if (d < 0.0) return vec2(0.0);
  float ao = ${OMBRE_PIED_FORCE.toFixed(4)} * exp(-d / portee);
  float tx = l.x > 1e-6 ? (bMax.x - p.x) / l.x : l.x < -1e-6 ? (bMin.x - p.x) / l.x : 1.0e9;
  float ty = l.y > 1e-6 ? (bMax.y - p.y) / l.y : l.y < -1e-6 ? (bMin.y - p.y) / l.y : 1.0e9;
  float t = min(tx, ty);
  float o = (1.0 - smoothstep(lng, lng + flou, t)) * (1.0 - 0.5 * smoothstep(0.0, lng + flou, t));
  return vec2(ao, o);
}`
