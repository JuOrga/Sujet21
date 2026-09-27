// LA MÉMOIRE DU RIDEAU LAMELLAIRE — et le RESSORT de ses lanières.
//
// Le shader ne se souvient de rien d'une image à l'autre. Au départ, il
// écartait chaque lanière d'après la glace qu'il lisait À L'INSTANT dans le
// champ du fluide, et un balancement prenait le relais à la sortie : le
// mouvement suivait le bruit du champ (la glace vue saute d'une image à
// l'autre), le côté de poussée pouvait basculer tout seul, et le relais se
// voyait — « pas assez smooth » (retour du concepteur, 27/09).
//
// Le mouvement vit donc ICI, d'une image à l'autre : un ressort amorti par
// rideau, dont la cible vaut 1 tant que la glace traverse et 0 sinon. Il
// s'ouvre sans à-coup, puis la glace sortie, repasse l'aplomb et oscille en
// s'amortissant — un seul mouvement continu, ouverture et balancement
// compris. Le rendu le passe au shader dans aux.z (la TRAVÉE, où la glace a
// traversé) et aux.w (l'ouverture du ressort) — deux champs qu'aucune autre
// lecture n'utilise pour cette matière.

import type { ObstacleBox } from '../game/level'

/** Le ressort des lanières. `ouverture` (en pas de lanière) est lue par le
 *  shader (RIDEAU_GLSL) ; le reste règle le ressort : une fréquence propre
 *  de 1,6 Hz, amorti presque critique à l'OUVERTURE (elle se fait d'un
 *  geste, sans rebond marqué), faiblement à la FERMETURE (la lanière repasse
 *  l'aplomb et se balance ~0,7 s). */
export const RIDEAU_RESSORT = {
  ouverture: 0.8,
  frequence: 1.6,
  amortiOuvre: 0.6,
  amortiFerme: 0.15,
} as const

/** Une travée (s0, s1 en fractions de L, 0..1) serrée dans UN flottant :
 *  1 + 1024 · q0 + q1, q au 1/1023e. 0 : aucune. Moins de 2^24 : exact en
 *  float32. JUMEAU de rdTravee dans le shader. */
export function paquetTravee(s0: number, s1: number): number {
  const q = (s: number) => Math.round(Math.max(0, Math.min(1, s)) * 1023)
  return 1 + 1024 * q(s0) + q(s1)
}

export function depaquetTravee(z: number): [number, number] | null {
  if (z < 0.5) return null
  const zz = Math.round(z) - 1
  const q0 = Math.floor(zz / 1024)
  return [q0 / 1023, (zz - q0 * 1024) / 1023]
}

/** Où la GLACE traverse le rideau en ce moment : l'étendue, en fractions
 *  de sa longueur, des grains gelés dans sa bande — un peu avant et après
 *  lui (`marge` × son épaisseur : elle s'ouvre à l'arrivée). null : aucun.
 *  Rotation de la boîte comprise, comme formeContact. */
export function traveeGlace(
  b: ObstacleBox,
  posX: ArrayLike<number>,
  posY: ArrayLike<number>,
  gele: ArrayLike<number>,
  count: number,
  marge = 0.15,
): [number, number] | null {
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  const horiz = w >= h
  const L = horiz ? w : h
  const m = marge * (horiz ? h : w)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const rad = ((b.angle ?? 0) * Math.PI) / 180
  const ca = Math.cos(rad)
  const sa = Math.sin(rad)
  const t0 = horiz ? b.minY : b.minX
  const t1 = horiz ? b.maxY : b.maxX
  let s0 = Infinity
  let s1 = -Infinity
  for (let i = 0; i < count; i++) {
    if (gele[i] !== 1) continue
    const rx = posX[i] - cx
    const ry = posY[i] - cy
    const lx = cx + rx * ca + ry * sa
    const ly = cy - rx * sa + ry * ca
    const s = horiz ? lx - b.minX : ly - b.minY
    const t = horiz ? ly : lx
    if (s < 0 || s > L || t < t0 - m || t > t1 + m) continue
    if (s < s0) s0 = s
    if (s > s1) s1 = s
  }
  return s0 <= s1 ? [s0 / L, s1 / L] : null
}

interface Etat {
  s0: number
  s1: number
  x: number // l'ouverture du ressort (négative : au-delà de l'aplomb)
  v: number
  t: number // l'instant du dernier pas
}

/** Le suivi des rideaux d'un tableau, une boîte à la fois (clé : l'objet
 *  boîte, comme la charge des surchauffeurs). */
export class SuiviRideaux {
  private etats = new WeakMap<ObstacleBox, Etat>()

  /** (aux.z, aux.w) du rideau à l'instant t : la travée empaquetée (0 :
   *  aucune) et l'ouverture du ressort. */
  aux(b: ObstacleBox, travee: [number, number] | null, t: number): [number, number] {
    let e = this.etats.get(b)
    if (!e) {
      if (!travee) return [0, 0]
      e = { s0: travee[0], s1: travee[1], x: 0, v: 0, t }
      this.etats.set(b, e)
    }
    if (travee) {
      // un NOUVEAU passage (le ressort presque au repos) repart de sa
      // travée ; un passage en cours l'ÉLARGIT — un bloc qui glisse le long
      // du rideau en le traversant laisse toutes ses lanières ouvertes
      if (Math.abs(e.x) < 0.05 && Math.abs(e.v) < 0.5) {
        e.s0 = travee[0]
        e.s1 = travee[1]
      } else {
        e.s0 = Math.min(e.s0, travee[0])
        e.s1 = Math.max(e.s1, travee[1])
      }
    }
    // le ressort, en sous-pas (Euler semi-implicite, stable à ces pas) ;
    // un saut d'horloge (onglet en veille, tableau rechargé) est borné
    const dt = Math.max(0, Math.min(0.05, t - e.t))
    e.t = t
    const cible = travee ? 1 : 0
    const w = 2 * Math.PI * RIDEAU_RESSORT.frequence
    const z = travee ? RIDEAU_RESSORT.amortiOuvre : RIDEAU_RESSORT.amortiFerme
    const n = 4
    const h = dt / n
    for (let k = 0; k < n; k++) {
      e.v += (w * w * (cible - e.x) - 2 * z * w * e.v) * h
      e.x += e.v * h
    }
    if (!travee && Math.abs(e.x) < 0.003 && Math.abs(e.v) < 0.02) {
      this.etats.delete(b)
      return [0, 0]
    }
    return [paquetTravee(e.s0, e.s1), e.x]
  }
}
