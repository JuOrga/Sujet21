// LA LOI DU PUITS DE GRAVITÉ — pure, partagée par le solveur (qui l'applique
// à chaque particule), le prédicteur de trajectoire (qui l'intègre sur un
// point-masse) et, plus tard, l'éditeur (qui la dessine). Une seule loi à
// trois endroits : ce que la ligne prédit est ce que le corps subit.
//
// Cœur harmonique (r ≤ rayon) : a = force · r / rayon — pas de singularité au
// centre, orbites elliptiques centrées sur le puits, période 2π·√(rayon/force)
// quelle que soit l'orbite (isochrone) : c'est ce qui rend une chaîne de
// puits prévisible. Halo képlérien (r > rayon) : a = force · rayon² / r²,
// continu au bord. Portée : au-delà, rien ; sur le dernier quart, fondu
// linéaire (une frontière nette ferait un à-coup).
import { PUITS_FONDU, PUITS_FORCE_DEFAUT, PUITS_RAYON_DEFAUT, type PuitsDef } from './level'

export interface Accel {
  ax: number
  ay: number
}

/** L'ACCÉLÉRATION d'un puits à la distance r de son centre (u/s²), sans
 *  direction. Zéro au centre, `force` au bord du cœur, décroît en 1/r² après. */
export function intensitePuits(p: PuitsDef, r: number): number {
  const F = p.force ?? PUITS_FORCE_DEFAUT
  const R = Math.max(1e-3, p.rayon ?? PUITS_RAYON_DEFAUT)
  let a = r <= R ? (F * r) / R : (F * R * R) / (r * r)
  if (p.portee !== undefined) {
    if (r >= p.portee) return 0
    const fondu = p.portee * PUITS_FONDU
    if (fondu > 0) a *= Math.min(1, (p.portee - r) / fondu)
  }
  return a
}

/** ACCUMULE dans `out` l'accélération de tous les puits en (x, y) — la
 *  superposition est une somme. Rend vrai si au moins un puits agit. */
export function accelerationPuits(puits: readonly PuitsDef[], x: number, y: number, out: Accel): boolean {
  let agit = false
  for (const p of puits) {
    const dx = p.x - x
    const dy = p.y - y
    const r = Math.hypot(dx, dy)
    if (r < 1e-6) continue // au centre exact, le cœur harmonique vaut zéro
    const a = intensitePuits(p, r)
    if (a === 0) continue
    out.ax += (a * dx) / r
    out.ay += (a * dy) / r
    agit = true
  }
  return agit
}

/** LE POTENTIEL (u²/s²) de tous les puits en (x, y) — pour les tests
 *  d'énergie et la recherche d'orbite ; la portée n'y est pas comptée
 *  (elle ne sert qu'à borner un puits, pas à lui donner une énergie). */
export function potentielPuits(puits: readonly PuitsDef[], x: number, y: number): number {
  let phi = 0
  for (const p of puits) {
    const F = p.force ?? PUITS_FORCE_DEFAUT
    const R = Math.max(1e-3, p.rayon ?? PUITS_RAYON_DEFAUT)
    const r = Math.hypot(p.x - x, p.y - y)
    // dedans : F·r²/(2R) ; dehors : 3FR/2 − F·R²/r — les deux se raccordent en r = R
    phi += r <= R ? (F * r * r) / (2 * R) : (3 * F * R) / 2 - (F * R * R) / r
  }
  return phi
}

/** La VITESSE CIRCULAIRE à la distance r d'un puits : √(a·r). */
export function vitesseCirculaire(p: PuitsDef, r: number): number {
  return Math.sqrt(intensitePuits(p, r) * r)
}

/** La PÉRIODE d'une orbite dans le cœur (s) : 2π·√(rayon/force), la même pour toutes. */
export function periodeCoeur(p: PuitsDef): number {
  const F = p.force ?? PUITS_FORCE_DEFAUT
  const R = p.rayon ?? PUITS_RAYON_DEFAUT
  return 2 * Math.PI * Math.sqrt(R / F)
}
