// LA TERRE VUE DE L'ISS — le mode TERRE du ciel du dehors. (Ou vue de
// plus loin, entière, depuis un point de Lagrange : voir VueTerre.)
//
// Derrière la station, au lieu de la Voie lactée : la Terre telle qu'on la
// voit depuis la Station spatiale internationale, à 420 km d'altitude, le
// regard penché vers l'avant — le sol défile vers le bas de l'écran,
// l'horizon courbe barre le haut, et au-dessus, le noir.
//
// « À PEU PRÈS EN DIRECT » : ce n'est pas une transmission, c'est une
// SIMULATION réglée sur l'horloge. Tout ce qu'il faut se sait d'avance :
//
//   - l'ORBITE de l'ISS — circulaire à 420 km, inclinée de 51,64°, un tour
//     en ~92,8 min, et son plan qui recule de ~5° par jour (le renflement
//     équatorial, J2). Sa PHASE, elle, est arbitraire : sans éléments
//     orbitaux frais (le réseau ne les joint pas, et l'orbite réelle dérive
//     avec la traînée et les rehaussements), on ne prétend pas dire AU-DESSUS
//     DE QUEL PAYS elle passe en ce moment. Tout le reste est vrai : les
//     latitudes survolées, la vitesse du sol, un jour et une nuit toutes les
//     quarante-six minutes ;
//   - la ROTATION de la Terre — le temps sidéral de Greenwich ;
//   - le SOLEIL — sa position du jour et de l'heure (l'algorithme bref de
//     l'Astronomical Almanac, précis à ~0,01°) : la ligne du jour et de la
//     nuit est celle de l'instant, les saisons comprises.
//
// CE QUI SE CALCULE ICI, une fois par image : la position de la station, le
// Soleil et le repère de la caméra, en RAYONS TERRESTRES, dans le repère lié
// à la Terre (x vers Greenwich, z vers le pôle Nord) — celui de la texture.
// Le shader n'a plus, par pixel de ciel, qu'un rayon à lancer contre une
// sphère et UNE lecture de texture (renderer.ts, uCielMode 3). Tout ce qui
// ne dépend pas du pixel est cuit ici — et ce fichier est la SEULE
// implémentation de ces règles, celle que les tests couvrent.

export const RAYON_TERRE_KM = 6371
const MU_KM3_S2 = 398600.4418
const J2 = 1.08263e-3
const DEG = Math.PI / 180

/** D'OÙ l'on regarde. L'ISS rase la Terre ; les autres la voient ENTIÈRE,
 *  comme un disque :
 *   - 'chez-vous' : un satellite FIXE au-dessus de la région du joueur, à
 *     l'altitude géostationnaire (35 786 km). Il tourne avec la Terre : la
 *     région reste au centre du disque, et la ligne du jour et de la nuit la
 *     traverse à l'HEURE LOCALE du joueur — nuit chez lui, nuit à l'écran.
 *     Les points de Lagrange, eux, montrent la face tournée vers eux, quelle
 *     que soit l'heure du joueur (« il faut que l'éclairage respecte l'heure
 *     de la zone où l'on joue », 30/09). La région vient du fuseau horaire
 *     du navigateur (render/lieu.ts) ;
 *   - 'l1-lune' : le point L1 du couple Terre–Lune, entre les deux, à ~84 %
 *     du chemin vers la Lune (~323 000 km). La Terre y a des PHASES — celles
 *     de la Lune vue d'ici, à l'envers : pleine Terre à la nouvelle Lune,
 *     Terre noire semée de villes à la pleine Lune ;
 *   - 'l1-soleil' : le point L1 du couple Soleil–Terre, à 1,5 million de km
 *     vers le Soleil — là où veille le satellite DSCOVR, dont la caméra EPIC
 *     photographie chaque jour la Terre PLEINE, toujours de face au jour. */
export type VueTerre = 'chez-vous' | 'iss' | 'l1-lune' | 'l1-soleil'

export interface ReglagesTerre {
  /** le point de vue (voir VueTerre) */
  vue: VueTerre
  /** 'chez-vous' : la région du joueur, en degrés (render/lieu.ts) */
  lieuLat: number
  lieuLon: number
  /** DEPUIS UN POINT DE LAGRANGE — le rayon du disque, en fraction de la
   *  PETITE dimension de l'écran. À l'œil nu, la Terre y ferait 2° (L1
   *  Terre–Lune) ou un demi-degré (L1 Soleil–Terre) : on la cadre comme
   *  un téléobjectif, comme le fait EPIC. */
  disque: number
  /** où se tient son centre, en fraction de l'écran (x vers la droite,
   *  y vers le HAUT) */
  centreX: number
  centreY: number
  /** l'altitude de l'orbite (km) */
  altitudeKm: number
  /** l'inclinaison de l'orbite sur l'équateur (degrés) */
  inclinaisonDeg: number
  /** le nœud ascendant et l'argument de latitude à l'ÉPOQUE (degrés) : la
   *  phase arbitraire de l'orbite (voir l'en-tête) */
  noeudDeg: number
  latitudeArgDeg: number
  /** l'époque de ces deux angles (ms Unix) */
  epoqueMs: number
  /** le regard, compté depuis le NADIR (degrés) : 0 regarde droit en bas ;
   *  l'horizon est à ~69,7°. À 52°, il barre le haut de l'écran. */
  penchementDeg: number
  /** la focale, en fraction de la GRANDE dimension de l'écran : 0,6 donne
   *  ~80° de champ — un grand angle, celui des photos de la Cupola */
  focale: number
  /** la dérive de la vue avec la caméra du jeu, en px CSS par unité-monde
   *  (avant saturation) : la profondeur se sent, la Terre ne s'en va pas */
  derive: number
  /** la luminosité : le vide doit rester plus sombre que la cuve éclairée */
  force: number
  /** un décalage d'horloge (minutes) — pour voir le jour ou la nuit à la
   *  demande, depuis la console (__terre) ; 0 = maintenant */
  decalageMin: number
}

export const TERRE_DEFAUTS: ReglagesTerre = {
  vue: 'chez-vous',
  // Paris, en attendant le fuseau du joueur (main.ts, lieuDuJoueur)
  lieuLat: 48.86,
  lieuLon: 2.35,
  disque: 0.36,
  centreX: 0.62,
  centreY: 0.55,
  altitudeKm: 420,
  inclinaisonDeg: 51.64,
  noeudDeg: 120,
  latitudeArgDeg: 0,
  epoqueMs: Date.UTC(2026, 0, 1),
  penchementDeg: 52,
  focale: 0.6,
  derive: 0.012,
  force: 0.8,
  decalageMin: 0,
}

export type Vec3 = [number, number, number]

const norme = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])
const unite = (v: Vec3): Vec3 => {
  const n = norme(v) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}
const croix = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const scal = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Jours juliens depuis J2000,0 (1er janvier 2000, 12 h TT ≈ UTC ici). */
export function joursJ2000(ms: number): number {
  return ms / 86400000 + 2440587.5 - 2451545.0
}

/** Le temps sidéral moyen de Greenwich (radians, 0..2π) : de combien la
 *  Terre a tourné sous les étoiles. */
export function tempsSideral(ms: number): number {
  const d = joursJ2000(ms)
  const deg = (280.46061837 + 360.98564736629 * d) % 360
  return (deg < 0 ? deg + 360 : deg) * DEG
}

/** Du repère inertiel (lié aux étoiles) au repère lié à la Terre. */
function versTerre(v: Vec3, gmst: number): Vec3 {
  const c = Math.cos(gmst)
  const s = Math.sin(gmst)
  return [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]]
}

/** La direction du Soleil, dans le repère lié à la Terre (unitaire). */
export function soleil(ms: number): Vec3 {
  const d = joursJ2000(ms)
  const L = (280.46 + 0.9856474 * d) * DEG
  const g = (357.528 + 0.9856003 * d) * DEG
  const lambda = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG
  const eps = (23.439 - 0.0000004 * d) * DEG
  const eci: Vec3 = [
    Math.cos(lambda),
    Math.cos(eps) * Math.sin(lambda),
    Math.sin(eps) * Math.sin(lambda),
  ]
  return versTerre(eci, tempsSideral(ms))
}

/** LA LUNE : direction (unitaire, repère lié à la Terre) et distance (km).
 *  L'algorithme bref de l'Astronomical Almanac — ~0,3° en direction, ce qui
 *  suffit : il ne sert qu'à placer le point L1 et donc la PHASE de la Terre,
 *  qui se lit sur tout un mois. */
export function lune(ms: number): { dir: Vec3; km: number } {
  const T = joursJ2000(ms) / 36525
  const s = (a: number, b: number): number => Math.sin((a + b * T) * DEG)
  const c = (a: number, b: number): number => Math.cos((a + b * T) * DEG)
  const lambda =
    (218.32 +
      481267.881 * T +
      6.29 * s(135.0, 477198.87) -
      1.27 * s(259.3, -413335.36) +
      0.66 * s(235.7, 890534.22) +
      0.21 * s(269.9, 954397.74) -
      0.19 * s(357.5, 35999.05) -
      0.11 * s(186.5, 966404.03)) *
    DEG
  const beta =
    (5.13 * s(93.3, 483202.02) +
      0.28 * s(228.2, 960400.89) -
      0.28 * s(318.3, 6003.15) -
      0.17 * s(217.6, -407332.21)) *
    DEG
  const parallaxe =
    (0.9508 +
      0.0518 * c(135.0, 477198.87) +
      0.0095 * c(259.3, -413335.36) +
      0.0078 * c(235.7, 890534.22) +
      0.0028 * c(269.9, 954397.74)) *
    DEG
  const eps = (23.439 - 0.013 * T) * DEG
  const cb = Math.cos(beta)
  const eci: Vec3 = [
    cb * Math.cos(lambda),
    Math.cos(eps) * cb * Math.sin(lambda) - Math.sin(eps) * Math.sin(beta),
    Math.sin(eps) * cb * Math.sin(lambda) + Math.cos(eps) * Math.sin(beta),
  ]
  return { dir: versTerre(eci, tempsSideral(ms)), km: RAYON_TERRE_KM / Math.sin(parallaxe) }
}

/** L1 Terre–Lune, en fraction de la distance à la Lune (~61 000 km avant
 *  elle) ; L1 Soleil–Terre, à 1,5 million de km. */
const L1_LUNE = 0.8404
const L1_SOLEIL_KM = 1.5e6

/** La position de l'observateur à un point de Lagrange, en rayons
 *  terrestres, dans le repère lié à la Terre. */
export function pointLagrange(ms: number, vue: 'l1-lune' | 'l1-soleil'): Vec3 {
  if (vue === 'l1-soleil') {
    const k = L1_SOLEIL_KM / RAYON_TERRE_KM
    const sd = soleil(ms)
    return [sd[0] * k, sd[1] * k, sd[2] * k]
  }
  const l = lune(ms)
  const k = (l.km * L1_LUNE) / RAYON_TERRE_KM
  return [l.dir[0] * k, l.dir[1] * k, l.dir[2] * k]
}

/** L'altitude géostationnaire, depuis le centre de la Terre (km) : là où un
 *  satellite fait le tour en un jour sidéral, et reste au-dessus du même
 *  point. */
const GEO_KM = 42164

/** La position de l'observateur d'un point de vue à disque, en rayons
 *  terrestres, dans le repère lié à la Terre. */
export function positionVue(ms: number, r: ReglagesTerre): Vec3 {
  if (r.vue === 'chez-vous') {
    const k = GEO_KM / RAYON_TERRE_KM
    const la = r.lieuLat * DEG
    const lo = r.lieuLon * DEG
    return [k * Math.cos(la) * Math.cos(lo), k * Math.cos(la) * Math.sin(lo), k * Math.sin(la)]
  }
  return pointLagrange(ms, r.vue === 'l1-soleil' ? 'l1-soleil' : 'l1-lune')
}

/** La période de l'orbite (s) : Kepler, pour une orbite circulaire. */
export function periodeS(r: ReglagesTerre = TERRE_DEFAUTS): number {
  const a = RAYON_TERRE_KM + r.altitudeKm
  return 2 * Math.PI * Math.sqrt((a * a * a) / MU_KM3_S2)
}

/** La station : position (en rayons terrestres) et direction du vol, dans
 *  le repère lié à la Terre. */
export function station(
  ms: number,
  r: ReglagesTerre = TERRE_DEFAUTS,
): { pos: Vec3; vol: Vec3 } {
  const aKm = RAYON_TERRE_KM + r.altitudeKm
  const n = (2 * Math.PI) / periodeS(r)
  const i = r.inclinaisonDeg * DEG
  const t = (ms - r.epoqueMs) / 1000
  // le plan de l'orbite recule : c'est le renflement de l'équateur (J2)
  const dNoeud = -1.5 * n * J2 * (RAYON_TERRE_KM / aKm) ** 2 * Math.cos(i)
  const O = r.noeudDeg * DEG + dNoeud * t
  const u = r.latitudeArgDeg * DEG + n * t
  const cO = Math.cos(O)
  const sO = Math.sin(O)
  const cu = Math.cos(u)
  const su = Math.sin(u)
  const ci = Math.cos(i)
  const si = Math.sin(i)
  const k = aKm / RAYON_TERRE_KM
  const pos: Vec3 = [k * (cO * cu - sO * su * ci), k * (sO * cu + cO * su * ci), k * su * si]
  const vol: Vec3 = [-cO * su - sO * cu * ci, -sO * su + cO * cu * ci, cu * si]
  const gmst = tempsSideral(ms)
  return { pos: versTerre(pos, gmst), vol: versTerre(vol, gmst) }
}

/** Latitude et longitude (degrés) d'un point du repère lié à la Terre. */
export function latLon(p: Vec3): { lat: number; lon: number } {
  const u = unite(p)
  return { lat: Math.asin(Math.max(-1, Math.min(1, u[2]))) / DEG, lon: Math.atan2(u[1], u[0]) / DEG }
}

/**
 * LE CADRE DE L'IMAGE, cuit pour le shader : une mat4 (ordre des colonnes,
 * celui de uniformMatrix4fv) —
 *
 *   col 0 : le rayon du coin bas-gauche de l'écran (xyz) · Soleil x
 *   col 1 : le pas d'un px CSS vers la droite (xyz)     · Soleil y
 *   col 2 : le pas d'un px CSS vers le haut (xyz)       · Soleil z
 *   col 3 : la station, en rayons terrestres (xyz)      · la force
 *
 * Le rayon d'un pixel (x, y en px CSS, y vers le haut — gl_FragCoord) est
 * alors `col0 + col1·x + col2·y` : deux multiplications-additions. Le
 * jumeau exact de ce calcul côté shader : rayonPixel, plus bas.
 */
export function cadreTerre(
  ms: number,
  camX: number,
  camY: number,
  largeurCss: number,
  hauteurCss: number,
  out: Float32Array,
  r: ReglagesTerre = TERRE_DEFAUTS,
): Float32Array {
  const t = ms + r.decalageMin * 60000
  const sol = soleil(t)
  const reste = Math.min(largeurCss, hauteurCss) / 8
  const glisse = (cam: number): number =>
    reste > 1e-6 ? reste * Math.tanh((cam * r.derive) / reste) : 0
  if (r.vue !== 'iss') {
    // DE LOIN (au-dessus de chez le joueur, ou d'un point de Lagrange) : le
    // regard droit sur le centre de la Terre, le NORD en haut de l'écran
    // (comme les images d'EPIC), et une focale de téléobjectif qui donne au
    // disque le rayon voulu
    const pos = positionVue(t, r)
    const F = unite([-pos[0], -pos[1], -pos[2]])
    const nord: Vec3 = [0, 0, 1]
    const U = unite([nord[0] - F[0] * F[2], nord[1] - F[1] * F[2], nord[2] - F[2] * F[2]])
    const R = croix(F, U)
    const rayonPx = Math.max(1, r.disque * Math.min(largeurCss, hauteurCss))
    const f = rayonPx / Math.tan(Math.asin(1 / norme(pos)))
    const ox = largeurCss * r.centreX + glisse(camX)
    const oy = hauteurCss * r.centreY + glisse(camY)
    return remplit(out, F, R, U, f, ox, oy, pos, sol, r.force)
  }
  const { pos, vol } = station(t, r)
  const haut = unite(pos) // le zénith local
  // le vol, ramené dans le plan de l'horizon local
  const avant = unite([
    vol[0] - haut[0] * scal(vol, haut),
    vol[1] - haut[1] * scal(vol, haut),
    vol[2] - haut[2] * scal(vol, haut),
  ])
  const a = r.penchementDeg * DEG
  // le regard : depuis le nadir, penché vers l'avant ; le haut de l'écran
  // lui est perpendiculaire, dans le même plan vertical
  const F: Vec3 = [
    -haut[0] * Math.cos(a) + avant[0] * Math.sin(a),
    -haut[1] * Math.cos(a) + avant[1] * Math.sin(a),
    -haut[2] * Math.cos(a) + avant[2] * Math.sin(a),
  ]
  const U: Vec3 = [
    haut[0] * Math.sin(a) + avant[0] * Math.cos(a),
    haut[1] * Math.sin(a) + avant[1] * Math.cos(a),
    haut[2] * Math.sin(a) + avant[2] * Math.cos(a),
  ]
  const R = croix(F, U)
  const f = Math.max(1, r.focale * Math.max(largeurCss, hauteurCss))
  // la dérive avec la caméra, saturée comme celle de la plaque : la Terre
  // bouge un peu quand on se déplace, ne s'en va jamais
  const ox = largeurCss / 2 + glisse(camX)
  const oy = hauteurCss / 2 + glisse(camY)
  return remplit(out, F, R, U, f, ox, oy, pos, sol, r.force)
}

function remplit(
  out: Float32Array,
  F: Vec3,
  R: Vec3,
  U: Vec3,
  f: number,
  ox: number,
  oy: number,
  pos: Vec3,
  sol: Vec3,
  force: number,
): Float32Array {
  for (let k = 0; k < 3; k++) {
    out[k] = F[k] - (R[k] * ox + U[k] * oy) / f
    out[4 + k] = R[k] / f
    out[8 + k] = U[k] / f
    out[12 + k] = pos[k]
  }
  out[3] = sol[0]
  out[7] = sol[1]
  out[11] = sol[2]
  out[15] = force
  return out
}

/** LE RAYON D'UN PIXEL — le jumeau du shader (renderer.ts, `terre`) : où
 *  il touche la Terre, ou null s'il part dans le noir. (x, y) en px CSS,
 *  y vers le HAUT depuis le bas de l'écran. */
export function rayonPixel(c: Float32Array, x: number, y: number): Vec3 | null {
  const d = unite([c[0] + c[4] * x + c[8] * y, c[1] + c[5] * x + c[9] * y, c[2] + c[6] * x + c[10] * y])
  const P: Vec3 = [c[12], c[13], c[14]]
  const b = scal(P, d)
  // le point du rayon le plus proche du centre, pris en VECTEUR — la même
  // forme que le shader (voir `terre`, renderer.ts)
  const m: Vec3 = [P[0] - d[0] * b, P[1] - d[1] * b, P[2] - d[2] * b]
  const disc = 1 - scal(m, m)
  if (disc < 0 || b > 0) return null
  const t = -b - Math.sqrt(disc)
  return [P[0] + d[0] * t, P[1] + d[1] * t, P[2] + d[2] * t]
}

/**
 * LA LUMIÈRE DE LA SCÈNE SUR LA STATION — le même Soleil que la Terre, et la
 * lueur de la Terre elle-même. Sans elle, la salle était éclairée par un
 * soleil fixe « en haut à gauche » devant une Terre éclairée d'ailleurs, et
 * se lisait comme un tableau posé devant une affiche.
 *
 * Tout se déduit du cadre de l'image (cadreTerre) : le repère de la caméra,
 * la station et le Soleil y sont déjà. Rempli dans `out` (8 nombres) :
 *
 *   0, 1 : le Soleil dans le plan de l'écran (x droite, y haut) — sa LONGUEUR
 *          est la part du Soleil qui vient de côté (1 : rasant, 0 : dans
 *          l'axe du regard), c'est elle qui fait briller les arêtes
 *   2    : le Soleil sur la FACE des modules, −1..1 : 1, il est derrière le
 *          regard et les éclaire de face ; −1, il est derrière la Terre et
 *          les laisse à contre-jour
 *   3    : 1 — la lumière de scène est active (0 : l'éclairage d'avant)
 *   4, 5 : la direction de la Terre à l'écran, depuis le centre (unitaire)
 *   6    : la lueur de la Terre, 0..1 — la part éclairée qu'on en voit
 *          (ses phases), pondérée par sa taille dans le ciel
 *   7    : 0 (réservé)
 */
export function lumiereStation(
  cadre: Float32Array,
  largeurCss: number,
  hauteurCss: number,
  out: Float32Array,
  r: ReglagesTerre = TERRE_DEFAUTS,
): Float32Array {
  const col = (k: number): Vec3 => [cadre[4 * k], cadre[4 * k + 1], cadre[4 * k + 2]]
  const R = unite(col(1))
  const U = unite(col(2))
  const F = croix(U, R)
  const f = 1 / Math.max(norme(col(1)), 1e-12)
  const c0 = col(0)
  const ox = -scal(c0, R) * f
  const oy = -scal(c0, U) * f
  const P = col(3)
  const sol: Vec3 = [cadre[3], cadre[7], cadre[11]]
  out[0] = scal(sol, R)
  out[1] = scal(sol, U)
  out[2] = -scal(sol, F)
  out[3] = 1
  // le centre de la Terre, projeté sur l'écran
  const v: Vec3 = [-P[0], -P[1], -P[2]]
  const prof = scal(v, F)
  let dx: number
  let dy: number
  if (prof > 1e-9) {
    dx = ox + (f * scal(v, R)) / prof - largeurCss / 2
    dy = oy + (f * scal(v, U)) / prof - hauteurCss / 2
  } else {
    dx = scal(v, R)
    dy = scal(v, U)
  }
  const n = Math.hypot(dx, dy)
  out[4] = n > 1e-9 ? dx / n : 0
  out[5] = n > 1e-9 ? dy / n : -1
  // la phase : la part éclairée du disque vu d'ici. Sous l'ISS, la Terre
  // couvre la moitié du ciel ; de loin, elle n'est qu'un disque (cadré en
  // grand, mais sa lumière est celle d'un astre lointain) : 0,7
  const phase = 0.5 * (1 + scal(sol, unite(P)))
  out[6] = phase * (r.vue === 'iss' ? 1 : 0.7)
  out[7] = 0
  return out
}
