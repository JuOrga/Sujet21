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
//
// LA TRAVÉE SE DIT PAR SON MILIEU ET SA DEMI-LARGEUR, et son milieu est
// FIGÉ au premier instant du passage : chaque lanière s'écarte du milieu,
// et si l'élargissement déplaçait ce milieu, les lanières entre l'ancien et
// le nouveau changeaient de côté d'une image à l'autre (vu en revue, 29/09).
// La demi-largeur, elle, rejoint la glace en douceur : une lanière qui
// entre dans la travée s'ouvre, elle ne saute pas.
//
// Limite connue : deux morceaux de glace qui traversent ensemble loin l'un
// de l'autre font UNE travée, qui les couvre tous deux — il faudrait un
// état par lanière, et aucun canal vers le shader n'est libre pour ça.

import { dispositionRideau } from '../game/formes'
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
  elargit: 0.12, // s — la constante de temps de la demi-largeur qui s'étend
} as const

/** Une travée (milieu c, demi-largeur hw, en fractions de L, 0..1) serrée
 *  dans UN flottant : 1 + 1024 · q(c) + q(hw), q au 1/1023e. 0 : aucune.
 *  Moins de 2^24 : exact en float32. JUMEAU de rdTravee dans le shader. */
export function paquetTravee(c: number, hw: number): number {
  const q = (s: number) => Math.round(Math.max(0, Math.min(1, s)) * 1023)
  return 1 + 1024 * q(c) + q(hw)
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
  // le rejet grossier : le cercle qui contient la boîte tournée et sa
  // marge — l'essentiel des grains d'une salle est loin de ses rideaux
  const r = Math.hypot(w / 2 + m, h / 2 + m)
  let s0 = Infinity
  let s1 = -Infinity
  for (let i = 0; i < count; i++) {
    if (gele[i] !== 1) continue
    if (Math.abs(posX[i] - cx) > r || Math.abs(posY[i] - cy) > r) continue
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
  c: number // le milieu de la travée, figé au début du passage
  hw: number // sa demi-largeur, qui rejoint hwCible en douceur
  hwCible: number
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
    const neuf = (a: number, z: number): Etat => ({ c: (a + z) / 2, hw: (z - a) / 2, hwCible: (z - a) / 2, x: 0, v: 0, t })
    if (!e) {
      if (!travee) return [0, 0]
      e = neuf(travee[0], travee[1])
      this.etats.set(b, e)
    } else if (travee) {
      // un NOUVEAU passage repart de sa travée : le ressort presque au
      // repos, ou une glace qui traverse AILLEURS (à plus d'une lanière de
      // la travée) — elle ouvrirait sinon tout ce qui sépare les deux
      const w = b.maxX - b.minX
      const hh = b.maxY - b.minY
      const L = Math.max(w, hh)
      const pas = dispositionRideau(L, Math.min(w, hh)).pas / L
      const ailleurs = travee[0] > e.c + e.hwCible + pas || travee[1] < e.c - e.hwCible - pas
      if ((Math.abs(e.x) < 0.05 && Math.abs(e.v) < 0.5) || ailleurs) {
        // le ressort garde son élan au repos (les premières images d'un
        // passage) ; il repart de zéro pour une glace ailleurs — sans quoi
        // ses lanières naîtraient déjà ouvertes
        const n = neuf(travee[0], travee[1])
        n.t = e.t
        if (!ailleurs) {
          n.x = e.x
          n.v = e.v
        }
        e = n
        this.etats.set(b, e)
      } else {
        // un passage en cours ÉLARGIT sa travée autour du MÊME milieu : un
        // bloc qui glisse le long du rideau en le traversant laisse toutes
        // ses lanières ouvertes, chacune du côté où elle est partie
        e.hwCible = Math.max(e.hwCible, e.c - travee[0], travee[1] - e.c)
      }
    }
    // le ressort, en sous-pas (Euler semi-implicite, stable à ces pas) ;
    // un saut d'horloge (onglet en veille, tableau rechargé) est borné
    const dt = Math.max(0, Math.min(0.05, t - e.t))
    e.t = t
    e.hw += (e.hwCible - e.hw) * (1 - Math.exp(-dt / RIDEAU_RESSORT.elargit))
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
    return [paquetTravee(e.c, e.hw), e.x]
  }
}
