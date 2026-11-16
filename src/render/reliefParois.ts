// LE RELIEF 2.5D DES PAROIS, RÉPARÉ (volume des parois, volet 1) — les
// règles pures. Le shader de composition en reçoit le jumeau GLSL
// (RELIEF_PAROIS_GLSL, généré ici) ; reliefParois.spec.ts tient les deux.
//
// Le relief allumé, le SOMMET de chaque solide fuit le centre de l'écran
// (le dessus d'une paroi haute est plus près de l'œil que son pied) et la
// tranche se révèle du côté qui regarde le centre. La physique, elle, reste
// sur la BASE : c'est au pied que le fluide touche. Trois choses en
// découlent, que le relief d'avant ignorait :
//  - la longueur du flanc suit la hauteur de l'élément (volume.ts) : une
//    plaque basse ne se dresse pas comme un mur ;
//  - là où le sommet déplacé recouvre le sol au-delà du pied, ce sol ne se
//    voit plus — ni le fluide qui touche le pied, ni ce qui se pose au sol ;
//  - ce qui est plaqué sur un dessus (les décalques d'un mur) suit son sommet.
import { HAUTEUR_BLOCS } from './hauteurs'
import { glslFloat } from './surfacesSculptees'
import { MAT_GRILLE, MAT_MEMBRANE, MAT_RIDEAU } from '../game/level'

/** Les solides que le fluide TRAVERSE, sous l'une de ses phases (level.ts) :
 *  la vapeur passe l'évent, l'eau la membrane, la glace le rideau. Leur base
 *  peut contenir du fluide ; celle d'un étanche, rien que la lisière qui
 *  touche son pied. */
export const MATIERES_PERMEABLES: readonly number[] = [MAT_GRILLE, MAT_MEMBRANE, MAT_RIDEAU]

/** La part du déplacement que prend le sommet d'un solide de hauteur `h` :
 *  sa hauteur sur celle d'un mur haut. Le mur haut (HAUTEUR_BLOCS) garde le
 *  flanc d'avant ; un hydro moyen n'en prend que 90/140, une plaque basse
 *  40/140. Bornée au mur haut, comme la coque l'est pour l'image (volume.ts :
 *  hauteurPropre) — sinon une cloison de modules (2400) jaillirait de
 *  l'écran. */
export function facteurRelief(h: number): number {
  return Math.min(Math.max(h, 0), HAUTEUR_BLOCS) / HAUTEUR_BLOCS
}

/** Le relief s'efface au zoom de carte (en dessous de ~0,8) : de loin, des
 *  sommets qui glissent donneraient le mal de mer. La même formule que le
 *  shader (`clamp(uZoom * 1.2, 0, 1)`). */
export function fonduRelief(zoom: number): number {
  return Math.min(Math.max(zoom * 1.2, 0), 1)
}

/** La fraction `f` dont le sommet d'un solide de hauteur `h` s'écarte du
 *  centre de l'écran : le shader montre, au point `w` de l'écran, le sommet
 *  du point `c + (w − c)(1 − f)` de la base (`k` : RELIEF_K, main.ts). */
export function fractionSommet(k: number, zoom: number, h: number): number {
  return k * fonduRelief(zoom) * facteurRelief(h)
}

/** Où se voit, relief allumé, le point (x, y) du DESSUS d'un solide : la
 *  réciproque de la règle du shader. Un décalque plaqué sur le mur y pose
 *  ses sommets ; f = 0 le laisse où il est. */
export function pointDuSommet(
  x: number,
  y: number,
  cx: number,
  cy: number,
  f: number,
): [number, number] {
  const s = 1 / (1 - f)
  return [cx + (x - cx) * s, cy + (y - cy) * s]
}

/** CE QUI EST POSÉ SUR UN SOLIDE SUIT SON SOMMET — la règle des décalques
 *  (renderer.ts : drawDecals), pour ce que la toile 2D dessine par-dessus.
 *  Les coupelles se peignaient au PIED : relief allumé, le logement rond
 *  plaqué sur le mur glissait avec son dessus, la coupelle restait en
 *  arrière — centrées au milieu de l'écran, de plus en plus décalées vers
 *  ses bords (le concepteur, 16/11 : « les coupelles ne sont plus au centre
 *  des parois rondes derrière, quand elles sont sur le côté de l'écran »).
 *  `hSupport` : la hauteur du solide sous le point (renderer.ts :
 *  hauteurSousDecal), −1 au sol — au sol, rien ne bouge, comme un décalque
 *  posé au sol. (sx, sy) et le centre (cx, cy) sont à l'ÉCRAN : l'homothétie
 *  y est la même que dans le monde. */
export function pointPose(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  k: number,
  zoom: number,
  hSupport: number,
): [number, number] {
  if (hSupport < 0) return [sx, sy]
  return pointDuSommet(sx, sy, cx, cy, fractionSommet(k, zoom, hSupport))
}

/** LA HAUTEUR DES SOLIDES QU'UN CADRE TOUCHE — une porte d'énergie, une
 *  chasse : ce qui ferme ou remplit un passage prend le sommet de CE qui le
 *  borde. Elles prenaient d'office celui d'un mur haut : juste entre deux
 *  cloisons, mais entre deux solides plus bas (vitre, hydro, membrane…) le
 *  dessin dépassait leur dessus et s'en décollait vers les bords de l'écran,
 *  du même écart que les coupelles (le concepteur, 16/11 : « je me demande
 *  si ce n'est pas le cas des portes également »).
 *  On sonde à `marge` unités AU-DEHORS des quatre côtés (au quart, au milieu
 *  et aux trois quarts) et on garde le plus haut — celui que l'image montre,
 *  des solides qui se touchent partageant leur hauteur (volume.ts).
 *  `hauteurEn` : la hauteur du solide en un point, négative au sol. Rend −1
 *  si rien ne borde le cadre : à l'appelant de dire ce qu'il vaut seul. */
export function hauteurAppui(
  r: { minX: number; minY: number; maxX: number; maxY: number },
  hauteurEn: (x: number, y: number) => number,
  marge = 8,
): number {
  let h = -1
  for (const t of [0.25, 0.5, 0.75]) {
    const x = r.minX + (r.maxX - r.minX) * t
    const y = r.minY + (r.maxY - r.minY) * t
    h = Math.max(
      h,
      hauteurEn(r.minX - marge, y),
      hauteurEn(r.maxX + marge, y),
      hauteurEn(x, r.minY - marge),
      hauteurEn(x, r.maxY + marge),
    )
  }
  return h < 0 ? -1 : h
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Le SOL QUE LE SOLIDE CACHE, 0..1, en un pixel : `relief` le relief du
 *  moment (uRelief : 0 éteint), `d` la distance signée à la base, `dV` au
 *  sommet déplacé, `flanc` la tranche peinte ici (0..1), `w` le fondu d'un
 *  pixel. UNE règle : un dessus opaque cache ce qui est dessous.
 *  - RELIEF ÉTEINT, ELLE VAUT 0, quoi qu'on lui passe d'autre. Relief éteint,
 *    le sommet ne bouge pas (dV = d) : sur la base, 1 − smoothstep(−w, 0, d)
 *    vaut 1, et la règle seule cacherait le fluide dans tout solide —
 *    membrane, rideau, évent : par défaut. La garde uRelief du shader ne
 *    suffisait pas à le tenir (relecture finale : un appel sorti de sa garde,
 *    toute la suite restait verte) ; la règle le tient elle-même.
 *  - Partout où le dessus couvre le pixel, le sol est caché — au-delà du
 *    pied du côté où il déborde (le fluide qui touche le pied passe dessous),
 *    et sur la base aussi. Un solide étanche n'y contient rien (seule la
 *    lisière des splats y déborde) ; un PERMÉABLE (membrane, évent, rideau)
 *    y laisse passer le fluide, qui entre sous le dessus et ressort au-delà
 *    du débord, sans couture. (La première règle ne cachait la base que du
 *    côté du débord : le fluide qui traversait une membrane s'arrêtait net au
 *    milieu de son dessus — vu au banc, tableau 9, relecture R4.)
 *  - Hors de la base, la tranche est peinte (une face latérale vue de
 *    biais) : le sol derrière elle est caché.
 *  - Côté où le pied se voit (la tranche sur la base, d ≤ 0, hors du dessus) :
 *    sur un ÉTANCHE, rien n'est caché — la base n'y contient que la lisière
 *    du fluide, qui touche le bas du flanc. Sur un PERMÉABLE (`permeable` 1),
 *    la base contient le fluide qui le traverse : il se peignait sur toute la
 *    face latérale, devant une face opaque — l'eau se lisait devant le mur
 *    (relecture finale, mineur 1). Il y est caché, sauf une bande de pied
 *    d'environ `w`, où il touche le bas du flanc comme ailleurs.
 *  - `opacite` : celle du dessus (1 ; la vitre, 0,32 à 1) — sous un verre, on
 *    voit le sol au travers. Sa tranche (le dormant) reste opaque.
 *  Le shader ne l'appelle que relief allumé (sous uRelief > 0) : relief
 *  éteint, ni calcul ni changement. */
export function solCache(
  relief: number,
  d: number,
  dV: number,
  flanc: number,
  w: number,
  opacite = 1,
  permeable = 0,
): number {
  if (!(relief > 0)) return 0
  const sommet = (1 - smoothstep(-w, 0, dV)) * opacite
  const tranche = d > 0 ? flanc : flanc * permeable * smoothstep(0.5 * w, 1.5 * w, -d)
  return Math.max(sommet, tranche)
}

/** LE CORPS A UNE HAUTEUR (relief allumé). Les parois étaient extrudées, le
 *  corps peint à plat : collé à un mur, il s'arrêtait net sur la ligne du
 *  pied, et la tranche — une face verticale vue de biais — se lisait comme
 *  une bande de sol à côté de lui (le concepteur, 16/11 : « quand il est en
 *  contact ça peut faire étrange »). Une première réponse, l'ombre du corps
 *  sur la tranche, ne suffisait pas : la tranche est déjà sombre au pied.
 *  Ce qui dit la profondeur, c'est le RECOUVREMENT : le dessus du corps
 *  glisse comme celui d'un solide de sa hauteur, et passe DEVANT le bas de la
 *  tranche. Le pixel `u` (coordonnée d'écran, centre `c`) montre le corps si
 *  l'un des points de base `u − (u − c)·f·t`, t de 0 (le pied) à 1 (le
 *  dessus), est dans le champ : ce sont ces points que la règle rend, le
 *  pied d'abord, le dessus en dernier. `f` : fractionSommet à la hauteur du
 *  corps ; 0 (relief éteint) ne rend que le pied — le rendu d'avant. */
export function basesDuCorps(u: number, c: number, f: number): number[] {
  if (!(f > 0)) return [u]
  const bases = [u]
  for (let i = 1; i <= PAS_CORPS; i++) bases.push(u - (u - c) * f * (i / PAS_CORPS))
  return bases
}
/** Les pas du balayage, pied exclu. Trois : au relief fort, en bord d'un
 *  écran de 1920, le dessus glisse de ~45 px — 15 px par pas, sous la
 *  largeur d'une goutte (26 u), qui ne se dédouble donc pas. */
export const PAS_CORPS = 3

/** LA LUEUR DU CORPS SUR LA TRANCHE, 0..1. Le corps éclaire déjà le sol sous
 *  lui (le halo du sujet) ; adossé à une paroi, sa lumière monte sur la face.
 *  Dans une salle sombre, une lumière se lit là où une ombre se perd.
 *  `corps` : sa présence devant le pied (0..1) ; `z` : la hauteur du point de
 *  la tranche, unités monde ; `hCorps` : la hauteur du corps. Pleine jusqu'à
 *  la hauteur du corps (qui la recouvre là où il touche : elle se voit sur
 *  ses côtés et à son approche), elle retombe au-dessus sans s'éteindre —
 *  le haut du mur reçoit encore le corps, de plus loin. */
export function lueurCorpsFlanc(corps: number, z: number, hCorps: number): number {
  const h = Math.max(hCorps, 1e-3)
  return Math.min(Math.max(corps, 0), 1) * (1 - (1 - LUEUR_HAUT_FLANC) * smoothstep(0.7 * h, 1.5 * h, z))
}
/** Ce qu'il reste de la lueur tout en haut d'un mur. */
export const LUEUR_HAUT_FLANC = 0.4

/** LE CORPS DEVINÉ. Relief allumé, le fluide passe SOUS les sommets : dans
 *  une membrane, un évent, un rideau — les parois qu'une de ses phases
 *  traverse —, sous le débord d'un dessus, derrière une tranche vue de biais.
 *  Le masque l'y EFFAÇAIT : le corps disparaissait en traversant, et l'on ne
 *  savait plus où il était ni ce qu'il en restait de l'autre côté (« continuer
 *  à le voir », le concepteur, 16/11). Il s'y DEVINE maintenant, au travers :
 *  un fond léger, et son contour franc. */
export const DEVINE_FOND = 0.5
export const DEVINE_LISERE = 0.95

/** La part du corps qui reste peinte en un pixel : `cache` le sol que les
 *  sommets cachent (solCache, 0..1), `lisere` 1 au contour du corps, 0 dans
 *  sa masse. Rien de caché : 1, le corps d'avant, au bit près (relief éteint,
 *  cache vaut 0 partout). Caché : le fond dans la masse, le liseré au bord —
 *  jamais 0, jamais plein : la paroi reste devant, le corps se lit dessous. */
export function corpsDevine(cache: number, lisere: number): number {
  const c = Math.min(Math.max(cache, 0), 1)
  const l = Math.min(Math.max(lisere, 0), 1)
  return 1 - c * (1 - (DEVINE_FOND + (DEVINE_LISERE - DEVINE_FOND) * l))
}

/** LE FLANC D'UNE BOÎTE, BALAYÉ EXACTEMENT. Le point `p` (dans le repère de
 *  la boîte `b` = minX, minY, maxX, maxY) est sur la tranche s'il existe un
 *  t de [0, 1] tel que `p − t·r` soit dans la boîte : t = 0 le pied, t = 1
 *  le sommet (`r` le déplacement du sommet, dans le même repère). Rend
 *  [distance signée au balayage, hauteur vue].
 *  POURQUOI pas des échantillons : le flanc était la réunion de cinq copies
 *  de la boîte (pied, ¼, ½, ¾, sommet) ; au coin LIBRE d'une paroi, le bord
 *  en biais du flanc tombait en escalier — quatre marches, « l'affichage
 *  pose problème là où c'est en contact » (le concepteur, 16/11, les
 *  hydrophobes isolées et la porte D2).
 *  - Dedans : l'intervalle des t qui tombent dans la boîte se lit axe par axe
 *    (les « tranches » d'un lancer de rayon). La hauteur vue est sa borne
 *    haute — le DERNIER passage du dedans au dehors en montant ; la distance,
 *    celle de la boîte au milieu de l'intervalle (négative, nulle au bord).
 *  - Dehors : la distance d'un segment à un rectangle qu'il ne coupe pas —
 *    le plus court de ses deux bouts à la boîte et des quatre coins au
 *    segment. Exacte : le bord en biais est une droite. La hauteur vue est
 *    celle du point le plus proche (le liseré d'anticrénelage suit la
 *    tranche). */
export function flancBalaye(
  px: number,
  py: number,
  b: readonly number[],
  rx: number,
  ry: number,
): [number, number] {
  const boite = (x: number, y: number): number => {
    const qx = Math.abs(x - (b[0] + b[2]) * 0.5) - (b[2] - b[0]) * 0.5
    const qy = Math.abs(y - (b[1] + b[3]) * 0.5) - (b[3] - b[1]) * 0.5
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
  }
  let t0 = 0
  let t1 = 1
  const tranche = (p: number, r: number, lo: number, hi: number): void => {
    if (Math.abs(r) < 1e-6) {
      if (p < lo || p > hi) t0 = 2
      return
    }
    const a = (p - hi) / r
    const c = (p - lo) / r
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
  }
  tranche(px, rx, b[0], b[2])
  tranche(py, ry, b[1], b[3])
  if (t0 <= t1) {
    const tm = 0.5 * (t0 + t1)
    return [Math.min(boite(px - tm * rx, py - tm * ry), 0), t1]
  }
  let d = boite(px, py)
  let t = 0
  const d1 = boite(px - rx, py - ry)
  if (d1 < d) {
    d = d1
    t = 1
  }
  const rr = Math.max(rx * rx + ry * ry, 1e-6)
  for (const [cx, cy] of [
    [b[0], b[1]],
    [b[2], b[1]],
    [b[0], b[3]],
    [b[2], b[3]],
  ]) {
    const tc = Math.min(Math.max(((px - cx) * rx + (py - cy) * ry) / rr, 0), 1)
    const dc = Math.hypot(px - tc * rx - cx, py - tc * ry - cy)
    if (dc < d) {
      d = dc
      t = tc
    }
  }
  return [d, t]
}

/** LA FACE QUE MONTRE UN POINT DE LA TRANCHE d'une boîte : sa normale, dans
 *  le repère de la boîte (mêmes `p`, `b`, `r` que flancBalaye). C'est la face
 *  par laquelle le chemin `p − t·r` QUITTE la base en montant — celle où
 *  tombe le pied du point.
 *  POURQUOI : la tranche prenait la normale de l'arête la plus proche du
 *  PIXEL. Près d'un bout de la face, l'arête la plus proche est celle d'à
 *  côté, qu'on ne voit pas : un triangle à 45° y prenait une autre lumière,
 *  une texture tournée d'un quart et une hauteur fausse — « quelques bugs
 *  sur les faces verticales » (le concepteur, 16/11, deux captures).
 *  [0, 0] si le sommet ne se déplace pas : il n'y a pas de tranche. */
export function faceFlanc(
  px: number,
  py: number,
  b: readonly number[],
  rx: number,
  ry: number,
): [number, number] {
  // la sortie le long de chaque axe : le plus grand des deux t où le chemin
  // croise les bords de cet axe ; la première sortie des deux décide
  const sx = Math.abs(rx) < 1e-6 ? Infinity : Math.max((px - b[2]) / rx, (px - b[0]) / rx)
  const sy = Math.abs(ry) < 1e-6 ? Infinity : Math.max((py - b[3]) / ry, (py - b[1]) / ry)
  if (sx === Infinity && sy === Infinity) return [0, 0]
  // on sort par le côté OPPOSÉ au déplacement : la face regarde l'œil
  return sx <= sy ? [rx < 0 ? 1 : -1, 0] : [0, ry < 0 ? 1 : -1]
}

/** LE FLANC D'UN TRIANGLE, BALAYÉ EXACTEMENT — le COIN, la moitié d'une
 *  boîte (formes.ts). Le même contrat que flancBalaye : [distance signée au
 *  balayage, hauteur vue], `tri` = ax, ay, bx, by, cx, cy dans le repère de
 *  la boîte, dans un sens ou dans l'autre.
 *  POURQUOI : les formes gardaient les cinq copies ; le sommet de la tranche
 *  d'un triangle hydrophobe sortait en dents de scie (le concepteur, 16/11).
 *  Un triangle est convexe : chaque arête borne l'intervalle des t d'un côté
 *  (p − t·r reste de son côté intérieur), comme les tranches de la boîte.
 *  Dehors, la distance d'un segment à un triangle qu'il ne coupe pas : ses
 *  deux bouts aux trois arêtes, les trois sommets au segment. */
export function flancBalayeTriangle(
  px: number,
  py: number,
  tri: readonly number[],
  rx: number,
  ry: number,
): [number, number] {
  const V = [
    [tri[0], tri[1]],
    [tri[2], tri[3]],
    [tri[4], tri[5]],
  ]
  const sens =
    (V[1][0] - V[0][0]) * (V[2][1] - V[0][1]) - (V[1][1] - V[0][1]) * (V[2][0] - V[0][0]) < 0 ? -1 : 1
  // la normale SORTANTE de l'arête i → i + 1
  const normale = (i: number): [number, number] => {
    const j = (i + 1) % 3
    return [sens * (V[j][1] - V[i][1]), -sens * (V[j][0] - V[i][0])]
  }
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 3; i++) {
    const [nx, ny] = normale(i)
    const a = nx * (px - V[i][0]) + ny * (py - V[i][1])
    const q = nx * rx + ny * ry
    if (Math.abs(q) < 1e-6) {
      if (a > 0) t0 = 2
    } else if (q > 0) t0 = Math.max(t0, a / q)
    else t1 = Math.min(t1, a / q)
  }
  if (t0 <= t1) {
    const tm = 0.5 * (t0 + t1)
    let fond = Infinity
    for (let i = 0; i < 3; i++) {
      const [nx, ny] = normale(i)
      const l = Math.max(Math.hypot(nx, ny), 1e-6)
      fond = Math.min(fond, -(nx * (px - tm * rx - V[i][0]) + ny * (py - tm * ry - V[i][1])) / l)
    }
    return [-Math.max(fond, 0), t1]
  }
  const segment = (x: number, y: number, i: number): number => {
    const j = (i + 1) % 3
    const ex = V[j][0] - V[i][0]
    const ey = V[j][1] - V[i][1]
    const u = Math.min(Math.max(((x - V[i][0]) * ex + (y - V[i][1]) * ey) / Math.max(ex * ex + ey * ey, 1e-6), 0), 1)
    return Math.hypot(x - V[i][0] - u * ex, y - V[i][1] - u * ey)
  }
  let d = Infinity
  let t = 0
  const rr = Math.max(rx * rx + ry * ry, 1e-6)
  for (let i = 0; i < 3; i++) {
    const dA = segment(px, py, i)
    if (dA < d) {
      d = dA
      t = 0
    }
    const dB = segment(px - rx, py - ry, i)
    if (dB < d) {
      d = dB
      t = 1
    }
    const tc = Math.min(Math.max(((px - V[i][0]) * rx + (py - V[i][1]) * ry) / rr, 0), 1)
    const dc = Math.hypot(px - tc * rx - V[i][0], py - tc * ry - V[i][1])
    if (dc < d) {
      d = dc
      t = tc
    }
  }
  return [d, t]
}

type PointMonde = { x: number; y: number }
type RectMonde = { minX: number; minY: number; maxX: number; maxY: number }

/** LES FACES DE LA TRANCHE D'UNE PORTE D'ÉNERGIE, relief allumé : les arêtes
 *  du `contour` (monde, sens trigonométrique — portePolygone) dont la face
 *  regarde l'œil, posé au-dessus de (`cx`, `cy`), le centre de l'écran. Une
 *  face se voit quand sa normale sortante pointe vers ce centre : de là, son
 *  sommet a glissé au-delà de son pied. LES BOUTS sont exclus — les deux
 *  petits côtés du rectangle `p`, collés aux murs que la porte relie : leur
 *  tranche se peindrait sur ces murs. Le FRONT d'une porte qui se ferme, au
 *  milieu du passage, est une face libre : il garde la sienne. */
export function facesTranche(
  contour: readonly PointMonde[],
  p: RectMonde,
  cx: number,
  cy: number,
): { a: PointMonde; b: PointMonde }[] {
  const couchee = p.maxX - p.minX >= p.maxY - p.minY
  const eps = 1e-6
  const surBout = (a: PointMonde, b: PointMonde): boolean =>
    couchee
      ? Math.abs(a.x - b.x) < eps && (Math.abs(a.x - p.minX) < eps || Math.abs(a.x - p.maxX) < eps)
      : Math.abs(a.y - b.y) < eps && (Math.abs(a.y - p.minY) < eps || Math.abs(a.y - p.maxY) < eps)
  const faces: { a: PointMonde; b: PointMonde }[] = []
  for (let k = 0; k < contour.length; k++) {
    const a = contour[k]
    const b = contour[(k + 1) % contour.length]
    if (surBout(a, b)) continue
    // la normale sortante d'une arête parcourue dans le sens trigonométrique
    const nx = b.y - a.y
    const ny = a.x - b.x
    const mx = (a.x + b.x) / 2 - cx
    const my = (a.y + b.y) / 2 - cy
    if (nx * mx + ny * my < 0) faces.push({ a, b })
  }
  return faces
}

/** Les règles en GLSL, pour le shader de composition. */
export const RELIEF_PAROIS_GLSL = `// (reliefParois.ts : les règles et leur jumeau TypeScript)
float facteurRelief(float h) {
  return clamp(h, 0.0, ${glslFloat(HAUTEUR_BLOCS)}) / ${glslFloat(HAUTEUR_BLOCS)};
}
bool matPermeable(float mat) {
  return ${MATIERES_PERMEABLES.map((m) => `abs(mat - ${glslFloat(m)}) < 0.5`).join(' || ')};
}
float solCache(float relief, float d, float dV, float flanc, float w, float opacite, float permeable) {
  if (relief <= 0.0) return 0.0;
  float sommet = (1.0 - smoothstep(-w, 0.0, dV)) * opacite;
  float tranche = d > 0.0 ? flanc : flanc * permeable * smoothstep(0.5 * w, 1.5 * w, -d);
  return max(sommet, tranche);
}
float lueurCorpsFlanc(float corps, float z, float hCorps) {
  float h = max(hCorps, 1e-3);
  return clamp(corps, 0.0, 1.0) * (1.0 - (1.0 - ${glslFloat(LUEUR_HAUT_FLANC)}) * smoothstep(0.7 * h, 1.5 * h, z));
}
float corpsDevine(float cache, float lisere) {
  float c = clamp(cache, 0.0, 1.0);
  float l = clamp(lisere, 0.0, 1.0);
  return 1.0 - c * (1.0 - mix(${glslFloat(DEVINE_FOND)}, ${glslFloat(DEVINE_LISERE)}, l));
}
// le flanc d'une boîte, balayé exactement (flancBalaye, reliefParois.ts) :
// (distance signée au balayage, hauteur vue). La boîte se mesure ici, à la
// main : boxSdf vient plus loin dans le shader.
float boiteFlanc(vec2 p, vec4 b) {
  vec2 q = abs(p - (b.xy + b.zw) * 0.5) - (b.zw - b.xy) * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
vec2 flancBalaye(vec2 p, vec4 b, vec2 r) {
  float t0 = 0.0;
  float t1 = 1.0;
  for (int k = 0; k < 2; k++) {
    float pk = k == 0 ? p.x : p.y;
    float rk = k == 0 ? r.x : r.y;
    float lo = k == 0 ? b.x : b.y;
    float hi = k == 0 ? b.z : b.w;
    if (abs(rk) < 1e-6) {
      if (pk < lo || pk > hi) t0 = 2.0;
    } else {
      float a = (pk - hi) / rk;
      float c = (pk - lo) / rk;
      t0 = max(t0, min(a, c));
      t1 = min(t1, max(a, c));
    }
  }
  if (t0 <= t1) {
    float tm = 0.5 * (t0 + t1);
    return vec2(min(boiteFlanc(p - tm * r, b), 0.0), t1);
  }
  float d = boiteFlanc(p, b);
  float t = 0.0;
  float d1 = boiteFlanc(p - r, b);
  if (d1 < d) { d = d1; t = 1.0; }
  float rr = max(dot(r, r), 1e-6);
  for (int k = 0; k < 4; k++) {
    vec2 c = vec2(k == 0 || k == 2 ? b.x : b.z, k < 2 ? b.y : b.w);
    float tc = clamp(dot(p - c, r) / rr, 0.0, 1.0);
    float dc = length(p - tc * r - c);
    if (dc < d) { d = dc; t = tc; }
  }
  return vec2(d, t);
}
// la face que montre un point de la tranche d'une boîte (faceFlanc,
// reliefParois.ts) : celle par où le chemin pied → sommet quitte la base,
// pas l'arête la plus proche du pixel
vec2 faceFlanc(vec2 p, vec4 b, vec2 r) {
  float sx = abs(r.x) < 1e-6 ? 1.0e9 : max((p.x - b.z) / r.x, (p.x - b.x) / r.x);
  float sy = abs(r.y) < 1e-6 ? 1.0e9 : max((p.y - b.w) / r.y, (p.y - b.y) / r.y);
  if (sx > 0.5e9 && sy > 0.5e9) return vec2(0.0);
  return sx <= sy ? vec2(r.x < 0.0 ? 1.0 : -1.0, 0.0) : vec2(0.0, r.y < 0.0 ? 1.0 : -1.0);
}
// le flanc d'un triangle, balayé exactement (flancBalayeTriangle,
// reliefParois.ts) — et celui du COIN d'une boîte (q0 : l'angle droit, les
// mêmes sommets que formeSdf)
float segmentFlanc(vec2 p, vec2 a, vec2 b) {
  vec2 e = b - a;
  return length(p - a - e * clamp(dot(p - a, e) / max(dot(e, e), 1e-6), 0.0, 1.0));
}
vec2 flancBalayeTriangle(vec2 p, vec2 A, vec2 B, vec2 C, vec2 r) {
  float sens = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) < 0.0 ? -1.0 : 1.0;
  float t0 = 0.0;
  float t1 = 1.0;
  for (int i = 0; i < 3; i++) {
    vec2 Vi = i == 0 ? A : (i == 1 ? B : C);
    vec2 Vj = i == 0 ? B : (i == 1 ? C : A);
    vec2 n = sens * vec2(Vj.y - Vi.y, Vi.x - Vj.x);
    float a = dot(n, p - Vi);
    float q = dot(n, r);
    if (abs(q) < 1e-6) {
      if (a > 0.0) t0 = 2.0;
    } else if (q > 0.0) t0 = max(t0, a / q);
    else t1 = min(t1, a / q);
  }
  if (t0 <= t1) {
    vec2 m = p - 0.5 * (t0 + t1) * r;
    float fond = 1.0e9;
    for (int i = 0; i < 3; i++) {
      vec2 Vi = i == 0 ? A : (i == 1 ? B : C);
      vec2 Vj = i == 0 ? B : (i == 1 ? C : A);
      vec2 n = sens * vec2(Vj.y - Vi.y, Vi.x - Vj.x);
      fond = min(fond, -dot(n, m - Vi) / max(length(n), 1e-6));
    }
    return vec2(-max(fond, 0.0), t1);
  }
  float d = 1.0e9;
  float t = 0.0;
  float rr = max(dot(r, r), 1e-6);
  for (int i = 0; i < 3; i++) {
    vec2 Vi = i == 0 ? A : (i == 1 ? B : C);
    vec2 Vj = i == 0 ? B : (i == 1 ? C : A);
    float dA = segmentFlanc(p, Vi, Vj);
    if (dA < d) { d = dA; t = 0.0; }
    float dB = segmentFlanc(p - r, Vi, Vj);
    if (dB < d) { d = dB; t = 1.0; }
    float tc = clamp(dot(p - Vi, r) / rr, 0.0, 1.0);
    float dc = length(p - tc * r - Vi);
    if (dc < d) { d = dc; t = tc; }
  }
  return vec2(d, t);
}
vec2 flancBalayeCoin(vec2 p, vec4 b, float q0, vec2 r) {
  vec2 c = (b.xy + b.zw) * 0.5;
  vec2 h = (b.zw - b.xy) * 0.5;
  vec2 A; vec2 B; vec2 C;
  if (q0 < 0.5)      { A = vec2(-h.x, -h.y); B = vec2( h.x, -h.y); C = vec2(-h.x,  h.y); }
  else if (q0 < 1.5) { A = vec2( h.x, -h.y); B = vec2( h.x,  h.y); C = vec2(-h.x, -h.y); }
  else if (q0 < 2.5) { A = vec2( h.x,  h.y); B = vec2(-h.x,  h.y); C = vec2( h.x, -h.y); }
  else               { A = vec2(-h.x,  h.y); B = vec2(-h.x, -h.y); C = vec2( h.x,  h.y); }
  return flancBalayeTriangle(p, c + A, c + B, c + C, r);
}
float solCache(float relief, float d, float dV, float flanc, float w) {
  return solCache(relief, d, dV, flanc, w, 1.0, 0.0);
}
`

/** Le jumeau GLSL de basesDuCorps, pour TOUT shader qui lit le corps dans le
 *  champ (la composition, les décalques) : le texel le plus dense le long du
 *  chemin pied → dessus. `uvVu` : où il a été lu (les voisins du relief de
 *  l'eau se lisent là) ; `rSommet` : la densité au DESSUS seul — là où elle
 *  manque, on regarde le côté du corps, pas son dessus. textureLod : appelé
 *  aussi hors flot uniforme. */
export const CORPS_RELIEF_GLSL = `vec4 champCorps(sampler2D champ, vec2 uv, float f, out vec2 uvVu, out float rSommet) {
  vec4 t = textureLod(champ, uv, 0.0);
  uvVu = uv;
  rSommet = t.r;
  if (f <= 0.0) return t;
  vec2 dep = (uv - 0.5) * f;
  for (int i = 1; i <= ${PAS_CORPS}; i++) {
    vec2 u = uv - dep * (float(i) / ${glslFloat(PAS_CORPS)});
    vec4 s = textureLod(champ, u, 0.0);
    if (i == ${PAS_CORPS}) rSommet = s.r;
    if (s.r > t.r) { t = s; uvVu = u; }
  }
  return t;
}
`
