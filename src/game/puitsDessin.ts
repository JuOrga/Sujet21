// LE DESSIN D'UN PUITS — les LUEURS qui tournent. Le concepteur (17/09) :
// « supprime le cercle visible en jeu du puits, et fais un design sympa avec
// des particules qui tournent automatiquement autour de chaque puits, afin
// d'identifier les puits, leur aura et leur sens ». Plus d'anneau en jeu :
// des lueurs en orbite, et elles disent VRAI — chacune tourne à la vitesse
// angulaire d'une orbite circulaire à sa distance, la loi du solveur :
// dans le cœur ω = √(force/rayon) pour toutes (le cœur est isochrone :
// elles tournent d'un bloc, comme une roue), au-delà ω = √(force·rayon²/r³)
// (le halo traîne : les lueurs du bord se laissent distancer — on VOIT la
// lisière sans la tracer). L'aura : les lueurs s'éteignent avec la distance,
// jusqu'à la portée ou à 1,6 rayon. Le sens (PuitsDef.sens) : un décor, la
// physique n'en a pas — il dit au joueur dans quel sens le tableau l'invite
// à tourner. Pur : le jeu et l'éditeur dessinent ce que ce module calcule.
import { PUITS_FORCE_DEFAUT, PUITS_RAYON_DEFAUT, type PuitsDef } from './level'

export const LUEURS_COEUR = 18 // dans le cœur, serrées : la roue
export const LUEURS_HALO = 8 // au-delà, rares : l'aura qui s'éteint
export const AURA_FACTEUR = 1.6 // sans portée, l'aura visible s'arrête à 1,6 rayon

export interface Lueur {
  x: number
  y: number
  /** distance au centre (u) */
  r: number
  /** rayon du point à dessiner (u monde, à l'échelle du tableau) */
  taille: number
  /** 0…1 : les lueurs du cœur brillent, celles du halo s'effacent */
  alpha: number
  /** la direction du mouvement (unitaire, repère monde, y vers le haut) */
  tx: number
  ty: number
  /** la vitesse tangentielle (u/s) — la longueur de la traîne */
  vitesse: number
}

/** LA PORTÉE VISIBLE de l'aura : la portée du puits, sinon 1,6 rayon. */
export function porteeVisible(p: PuitsDef): number {
  const R = p.rayon ?? PUITS_RAYON_DEFAUT
  return p.portee !== undefined ? Math.min(p.portee, AURA_FACTEUR * R) : AURA_FACTEUR * R
}

/** LA VITESSE ANGULAIRE (rad/s) d'une orbite circulaire à la distance r. */
export function omegaPuits(p: PuitsDef, r: number): number {
  const F = p.force ?? PUITS_FORCE_DEFAUT
  const R = p.rayon ?? PUITS_RAYON_DEFAUT
  if (r <= R) return Math.sqrt(F / R)
  return Math.sqrt((F * R * R) / (r * r * r))
}

/** Un bruit déterministe dans [0, 1[ : les lueurs d'un puits sont les mêmes
 *  à chaque image, et d'un puits à l'autre elles ne se ressemblent pas. */
function bruit(graine: number, k: number): number {
  let h = (graine * 374761393 + k * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** LES LUEURS d'un puits à l'instant t (s) : leurs positions, tailles,
 *  éclats et directions. `graine` distingue deux puits aux mêmes réglages. */
export function lueursPuits(p: PuitsDef, t: number, graine = 0): Lueur[] {
  const R = p.rayon ?? PUITS_RAYON_DEFAUT
  const aura = porteeVisible(p)
  const sens = p.sens === -1 ? -1 : 1
  const g = graine * 7919 + Math.round(p.x) * 31 + Math.round(p.y) * 17
  const out: Lueur[] = []
  const nHalo = aura > R ? LUEURS_HALO : 0
  for (let k = 0; k < LUEURS_COEUR + nHalo; k++) {
    const coeur = k < LUEURS_COEUR
    // le cœur se peuple de 0,22 à 0,95 rayon (jamais sur la lisière : ce
    // n'est pas un anneau), le halo de 1,05 rayon à la portée visible
    const u = bruit(g, k * 3)
    const r = coeur ? R * (0.22 + 0.73 * u) : R * 1.05 + (aura - R * 1.05) * u
    const phase0 = bruit(g, k * 3 + 1) * Math.PI * 2
    const w = omegaPuits(p, r)
    const a = phase0 + sens * w * t
    const cx = Math.cos(a)
    const cy = Math.sin(a)
    // la traîne pointe où la lueur va : la tangente dans le sens du tour
    const tx = -sens * cy
    const ty = sens * cx
    const eclat = coeur ? 0.55 + 0.4 * bruit(g, k * 3 + 2) : 0.3 * (1 - (r - R) / Math.max(1, aura - R)) + 0.05
    out.push({
      x: p.x + r * cx,
      y: p.y + r * cy,
      r,
      taille: coeur ? 3 + 3 * bruit(g, k * 3 + 2) : 2,
      alpha: eclat,
      tx,
      ty,
      vitesse: w * r,
    })
  }
  return out
}
