// LA MÉMOIRE DU RIDEAU LAMELLAIRE.
//
// Le shader écarte chaque lanière d'après la glace qu'il voit sur SA colonne
// (rideauRendu) — mais il ne se souvient de rien d'une image à l'autre :
// la glace partie, la lanière retombait droite, sans le balancement d'une
// vraie porte à lanières. Ce qu'il faut retenir tient en peu de chose : OÙ
// la glace a traversé le rideau (la travée, en fractions de sa longueur) et
// DEPUIS QUAND elle en est sortie. Le rendu le calcule ici, sur les grains
// gelés du solveur, et le passe au shader dans aux.z / aux.w du rideau —
// deux champs qu'aucune autre lecture n'utilise pour cette matière.

import type { ObstacleBox } from '../game/level'

/** Le balancement à la fermeture : une oscillation amortie, lue par le
 *  shader (RIDEAU_GLSL). `duree` borne le suivi : à 3 s, l'enveloppe
 *  exp(-3 / 0,6) ne vaut plus que 0,7 %. */
export const RIDEAU_BALANCE = {
  amplitude: 0.55, // en pas de lanière
  frequence: 1.6, // Hz
  amorti: 0.6, // s — constante de temps de l'enveloppe
  montee: 0.15, // s — le relais du geste en cours, sans saut
  duree: 3, // s
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
 *  lui (`marge` × son épaisseur, comme les sondages du shader). null :
 *  aucun. Rotation de la boîte comprise, comme formeContact. */
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
    const t0 = horiz ? b.minY : b.minX
    const t1 = horiz ? b.maxY : b.maxX
    if (s < 0 || s > L || t < t0 - m || t > t1 + m) continue
    if (s < s0) s0 = s
    if (s > s1) s1 = s
  }
  return s0 <= s1 ? [s0 / L, s1 / L] : null
}

interface Etat {
  s0: number
  s1: number
  sortie: number // l'instant où la glace est sortie ; -1 tant qu'elle traverse
}

/** Le suivi des rideaux d'un tableau, une boîte à la fois (clé : l'objet
 *  boîte, comme la charge des surchauffeurs). */
export class SuiviRideaux {
  private etats = new WeakMap<ObstacleBox, Etat>()

  /** (aux.z, aux.w) du rideau à l'instant t : la travée empaquetée (0 :
   *  rien à balancer) et l'âge du balancement en secondes (-1 : la glace
   *  traverse encore, ou rien). */
  aux(b: ObstacleBox, travee: [number, number] | null, t: number): [number, number] {
    let e = this.etats.get(b)
    if (travee) {
      // un même passage ÉLARGIT sa travée : un bloc qui glisse le long du
      // rideau en le traversant laisse toutes ses lanières se balancer
      if (e && e.sortie < 0) {
        e.s0 = Math.min(e.s0, travee[0])
        e.s1 = Math.max(e.s1, travee[1])
      } else {
        e = { s0: travee[0], s1: travee[1], sortie: -1 }
        this.etats.set(b, e)
      }
      return [paquetTravee(e.s0, e.s1), -1]
    }
    if (!e) return [0, -1]
    if (e.sortie < 0) e.sortie = t
    const age = t - e.sortie
    if (age > RIDEAU_BALANCE.duree || age < 0) {
      this.etats.delete(b)
      return [0, -1]
    }
    return [paquetTravee(e.s0, e.s1), age]
  }
}
