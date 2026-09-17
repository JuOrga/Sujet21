// LE DESSIN D'UN PUITS — LA CHUTE. Le concepteur (17/09) : « supprime le
// cercle visible en jeu du puits, un design avec des particules pour
// identifier les puits et leur aura » ; puis, devant des lueurs qui
// tournaient : « il n'y a pas de sens dans la gravité, parfois le sens des
// particules est à contre-courant ». Ce qui est vrai d'un puits, c'est que
// TOUT Y TOMBE, DROIT VERS LE CENTRE, selon une loi précise : c'est cela
// qu'on montre. Des GRAINS naissent au bord de l'aura ou dans le cœur et
// tombent vers le centre, lâchés sans vitesse, à l'accélération du solveur
// (game/puits.ts) ; ils s'éteignent au NOYAU et renaissent. Aucun sens de
// rotation, une seule direction. Et le cœur a une propriété qui se voit :
// harmonique, un grain lâché de N'IMPORTE QUELLE distance du cœur arrive au
// centre au même instant — un quart de période, T/4 = (π/2)·√(rayon/force).
// Les grains du cœur tombent donc en cadence, une respiration ; ceux du
// halo (képlérien) traînent. On lit l'étendue, l'allure et la lisière sans
// un trait. Le NOYAU : une masse au centre, sa taille dit la force. Pur : le
// jeu et l'éditeur dessinent ce que ce module calcule.
import { PUITS_FORCE_DEFAUT, PUITS_RAYON_DEFAUT, type PuitsDef } from './level'
import { intensitePuits } from './puits'

export const GRAINS_COEUR = 14 // lâchés dans le cœur, en cadence : la respiration
export const GRAINS_HALO = 10 // lâchés au bord de l'aura, chacun son heure
export const AURA_FACTEUR = 1.6 // sans portée, l'aura visible s'arrête à 1,6 rayon
/** la pause au bord entre deux chutes, en fraction de la chute */
const PAUSE = 0.35

export interface Grain {
  x: number
  y: number
  /** distance au centre (u) */
  r: number
  /** rayon du point (u monde) */
  taille: number
  /** 0…1 : faible à la naissance, vif près du noyau, éteint dedans */
  alpha: number
  /** la direction de la chute (unitaire, vers le centre, repère monde) */
  tx: number
  ty: number
  /** la vitesse de chute (u/s) — la longueur de la traîne */
  vitesse: number
  /** lâché dans le cœur (en cadence) ou au bord de l'aura (à son heure) */
  origine: 'coeur' | 'halo'
}

/** LA PORTÉE VISIBLE de l'aura : la portée du puits, sinon 1,6 rayon. */
export function porteeVisible(p: PuitsDef): number {
  const R = p.rayon ?? PUITS_RAYON_DEFAUT
  return p.portee !== undefined ? Math.min(p.portee, AURA_FACTEUR * R) : AURA_FACTEUR * R
}

/** LE NOYAU : la masse au centre — sa taille dit la force, bornée par le cœur. */
export function rayonNoyau(p: PuitsDef): number {
  const R = p.rayon ?? PUITS_RAYON_DEFAUT
  const F = p.force ?? PUITS_FORCE_DEFAUT
  return Math.min(0.3 * R, 12 + 14 * Math.sqrt(F / PUITS_FORCE_DEFAUT))
}

/** LE QUART DE PÉRIODE du cœur (s) : le temps d'une chute, de n'importe où dans le cœur. */
export function dureeChuteCoeur(p: PuitsDef): number {
  return (Math.PI / 2) * Math.sqrt((p.rayon ?? PUITS_RAYON_DEFAUT) / (p.force ?? PUITS_FORCE_DEFAUT))
}

interface Chute {
  /** r et v échantillonnés à PAS_CHUTE, du lâcher jusqu'au noyau */
  r: Float64Array
  v: Float64Array
  duree: number
}
const PAS_CHUTE = 1 / 60
const chutes = new Map<string, Chute>()

/** LA CHUTE depuis r0, lâchée sans vitesse : intégrée une fois (la loi du
 *  solveur, Euler semi-implicite comme lui), gardée en cache par réglage. */
function chuteDepuis(p: PuitsDef, r0: number): Chute {
  const cle = `${p.force ?? PUITS_FORCE_DEFAUT}|${p.rayon ?? PUITS_RAYON_DEFAUT}|${p.portee ?? ''}|${r0}`
  const memo = chutes.get(cle)
  if (memo) return memo
  const rNoyau = rayonNoyau(p)
  const rs: number[] = [r0]
  const vs: number[] = [0]
  let r = r0
  let v = 0
  for (let k = 0; k < 100000 && r > rNoyau; k++) {
    v += intensitePuits(p, r) * PAS_CHUTE
    r -= v * PAS_CHUTE
    rs.push(Math.max(rNoyau, r))
    vs.push(v)
  }
  const c: Chute = { r: Float64Array.from(rs), v: Float64Array.from(vs), duree: (rs.length - 1) * PAS_CHUTE }
  chutes.set(cle, c)
  return c
}

/** Un bruit déterministe dans [0, 1[ : les grains d'un puits sont les mêmes
 *  à chaque image, et d'un puits à l'autre ils ne se ressemblent pas. */
function bruit(graine: number, k: number): number {
  let h = (graine * 374761393 + k * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Où en est une chute à l'instant `tau` de son cycle (chute puis pause) :
 *  r, v, et la part accomplie (0 au lâcher, 1 au noyau) ; null pendant la pause. */
function etatChute(c: Chute, tau: number, cycle: number): { r: number; v: number; part: number } | null {
  const t = ((tau % cycle) + cycle) % cycle
  if (t >= c.duree) return null
  const i = t / PAS_CHUTE
  const i0 = Math.min(c.r.length - 2, Math.floor(i))
  const f = i - i0
  return { r: c.r[i0] + (c.r[i0 + 1] - c.r[i0]) * f, v: c.v[i0] + (c.v[i0 + 1] - c.v[i0]) * f, part: t / c.duree }
}

/** LES GRAINS d'un puits à l'instant t (s) : ceux qui tombent à cet instant.
 *  `graine` distingue deux puits aux mêmes réglages. */
export function grainsPuits(p: PuitsDef, t: number, graine = 0): Grain[] {
  const R = p.rayon ?? PUITS_RAYON_DEFAUT
  const aura = porteeVisible(p)
  const g = graine * 7919 + Math.round(p.x) * 31 + Math.round(p.y) * 17
  const out: Grain[] = []
  const pousse = (angle: number, e: { r: number; v: number; part: number }, taille: number, origine: Grain['origine']): void => {
    const cx = Math.cos(angle)
    const cy = Math.sin(angle)
    // naît faible, s'avive en tombant, s'éteint dans le noyau
    const alpha = 0.25 + 0.7 * e.part
    out.push({ x: p.x + e.r * cx, y: p.y + e.r * cy, r: e.r, taille, alpha, tx: -cx, ty: -cy, vitesse: e.v, origine })
  }
  // LE CŒUR, EN CADENCE : tous lâchés au même instant, de distances
  // différentes — ils arrivent ensemble, à un noyau près (l'isochronie du
  // cœur harmonique) ; le cycle commun est celui de la chute la plus longue
  const cycleCoeur = chuteDepuis(p, 0.92 * R).duree * (1 + PAUSE)
  for (let k = 0; k < GRAINS_COEUR; k++) {
    const r0 = R * (0.35 + 0.57 * bruit(g, k * 3))
    const e = etatChute(chuteDepuis(p, r0), t, cycleCoeur)
    if (e) pousse(bruit(g, k * 3 + 1) * Math.PI * 2, e, 2.2 + 2 * bruit(g, k * 3 + 2), 'coeur')
  }
  // LE HALO, CHACUN SON HEURE : lâchés au bord de l'aura, ils traînent
  if (aura > R) {
    const c = chuteDepuis(p, aura)
    const cycle = c.duree * (1 + PAUSE)
    for (let k = 0; k < GRAINS_HALO; k++) {
      const e = etatChute(c, t + bruit(g, 100 + k * 2) * cycle, cycle)
      if (e) pousse(bruit(g, 101 + k * 2) * Math.PI * 2, e, 1.8, 'halo')
    }
  }
  return out
}
