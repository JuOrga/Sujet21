/**
 * L'AURA D'UNE SURFACE, telle que l'éditeur la trace.
 *
 * Le solveur mesure l'aura d'une surface à sa FORME PHYSIQUE (formeContact
 * sur formePhysique), depuis le CENTRE des grains : une particule la sent
 * tant que (distance − rayon d'un grain) reste sous la portée — sa portée
 * réelle est donc portée + rayon. Une chaudière rayonne depuis sa rampe
 * dessinée, une conduite depuis son tuyau et ses brides — plus depuis leur
 * boîte. L'éditeur, lui, traçait toujours le rectangle arrondi autour de la
 * boîte : sur une rampe, l'aura dessinée débordait de l'aura réelle de
 * 5,6 u sur tout le long côté (bloc de 60, portée 130), et davantage aux
 * coins d'une chaudière compacte, qui est ronde (signalé à la refonte de
 * la chaudière, #459).
 *
 * LA MÉTHODE EXACTE. Une forme à pièces (conduite, chaudière, surchauffeur)
 * est une union de rectangles arrondis ; son iso-distance à la portée p est
 * l'union des mêmes rectangles GONFLÉS de p (rayon r + p) — et le contour
 * de cette union, les morceaux du bord de chaque pièce gonflée qu'aucune
 * autre ne recouvre. Rien d'approché : chaque point tracé est à la portée,
 * au flottant près. (Une première version, par carrés marchants sur le
 * champ, se trompait sur les formes dont le champ n'est pas une vraie
 * distance — l'arc —, dérivait sur les longues pièces et coûtait jusqu'à
 * 16 ms par contour pendant un glisser : écartée en revue, 29/09.)
 *
 * Les autres formes (arc, disque, coin…) gardent le rectangle arrondi autour
 * de la boîte, comme avant.
 */

import { conduiteHoriz, type FormeBox } from '../game/formes'
import { MAT_CHAUD, MAT_FROID, MAT_HYDROPHILE, MAT_HYDROPHOBE } from '../game/level'
import type { SimParams } from '../sim/params'

export type Point = { x: number; y: number }

/** Un morceau du contour : `ferme` quand c'est le bord ENTIER d'une pièce
 *  gonflée (rien ne le recouvre) — à refermer ; sinon un arc ouvert. */
export interface MorceauAura {
  points: Point[]
  ferme: boolean
}

export interface ContourPieces {
  morceaux: MorceauAura[]
  /** le bord complet de chaque pièce gonflée : leur union (remplissage
   *  « nonzero ») est la zone de l'aura */
  surfaces: Point[][]
}

/** Le contour exact de l'aura d'une forme à PIÈCES (formePhysique en a
 *  posé la liste), en MONDE, rotation comprise. `pas` : l'espacement des
 *  points le long du bord, en unités monde. null : pas une forme à pièces. */
export function contourAura(forme: FormeBox, portee: number, pas = 2): ContourPieces | null {
  const pieces = forme.pieces
  if (!pieces || pieces.length === 0) return null
  const w = forme.maxX - forme.minX
  const h = forme.maxY - forme.minY
  const horiz = conduiteHoriz(w, h, forme.sens)
  const cx = (forme.minX + forme.maxX) / 2
  const cy = (forme.minY + forme.maxY) / 2
  const rad = ((forme.angle ?? 0) * Math.PI) / 180
  const ca = Math.cos(rad)
  const sa = Math.sin(rad)
  // (s le long, t en travers, centrés) → monde : la convention de
  // piecesContactAxe, puis la rotation de la boîte autour de son centre
  const monde = (s: number, t: number): Point => {
    const px = horiz ? s : t
    const py = horiz ? t : s
    return { x: cx + px * ca - py * sa, y: cy + px * sa + py * ca }
  }
  // chaque pièce : son rectangle intérieur (demi-côtés hs, ht) et son rayon
  // gonflé — la distance à la pièce vaut p exactement sur ce bord-là
  const P = pieces.map(([s0, s1, e, r0 = 0]) => ({
    cs: (s0 + s1) / 2,
    hs: Math.max(0, (s1 - s0) / 2 - r0),
    ht: Math.max(0, e - r0),
    R: r0 + portee,
  }))
  // la distance signée au bord gonflé d'une pièce : négative dedans
  const d = (k: number, s: number, t: number): number => {
    const q = P[k]
    const qs = Math.abs(s - q.cs) - q.hs
    const qt = Math.abs(t) - q.ht
    return Math.hypot(Math.max(qs, 0), Math.max(qt, 0)) + Math.min(Math.max(qs, qt), 0) - q.R
  }
  const morceaux: MorceauAura[] = []
  const surfaces: Point[][] = []
  for (let i = 0; i < P.length; i++) {
    const q = P[i]
    // le bord, dans le sens trigonométrique : quatre côtés droits et quatre
    // quarts de cercle, au pas demandé
    const bord: [number, number][] = []
    const droit = (s0: number, t0: number, s1: number, t1: number) => {
      const n = Math.max(1, Math.ceil(Math.hypot(s1 - s0, t1 - t0) / pas))
      for (let k = 0; k < n; k++) bord.push([s0 + ((s1 - s0) * k) / n, t0 + ((t1 - t0) * k) / n])
    }
    const quart = (cs: number, ct: number, a0: number) => {
      const n = Math.max(2, Math.ceil(((Math.PI / 2) * q.R) / pas))
      for (let k = 0; k < n; k++) {
        const a = a0 + ((Math.PI / 2) * k) / n
        bord.push([cs + q.R * Math.cos(a), ct + q.R * Math.sin(a)])
      }
    }
    const s0 = q.cs - q.hs
    const s1 = q.cs + q.hs
    droit(s1 + q.R, -q.ht, s1 + q.R, q.ht)
    quart(s1, q.ht, 0)
    droit(s1, q.ht + q.R, s0, q.ht + q.R)
    quart(s0, q.ht, Math.PI / 2)
    droit(s0 - q.R, q.ht, s0 - q.R, -q.ht)
    quart(s0, -q.ht, Math.PI)
    droit(s0, -q.ht - q.R, s1, -q.ht - q.R)
    quart(s1, -q.ht, (3 * Math.PI) / 2)
    surfaces.push(bord.map(([s, t]) => monde(s, t)))
    // un point du bord est VU s'il n'est dans aucune autre pièce gonflée.
    // Sur un bord commun (deux pièces de même bord), la pièce d'indice le
    // plus bas le garde : il n'est tracé qu'une fois
    // (seules les pièces qui débordent sur la même abscisse peuvent le
    // couvrir : une longue rampe en a des dizaines, dont deux ou trois ici)
    const voisines: number[] = []
    for (let j = 0; j < P.length; j++)
      if (j !== i && Math.abs(P[j].cs - q.cs) <= P[j].hs + P[j].R + q.hs + q.R) voisines.push(j)
    const vu = bord.map(([s, t]) => {
      for (const j of voisines) {
        if (Math.abs(s - P[j].cs) > P[j].hs + P[j].R) continue
        const dj = d(j, s, t)
        if (j < i ? dj <= 1e-6 : dj < -1e-6) return false
      }
      return true
    })
    const n = bord.length
    if (vu.every(Boolean)) {
      morceaux.push({ points: bord.map(([s, t]) => monde(s, t)), ferme: true })
      continue
    }
    // les morceaux vus, en partant d'un point caché : aucun ne chevauche la
    // fin de la boucle
    const depart = vu.indexOf(false)
    let cur: Point[] = []
    for (let k = 1; k <= n; k++) {
      const idx = (depart + k) % n
      if (vu[idx]) cur.push(monde(bord[idx][0], bord[idx][1]))
      else if (cur.length) {
        if (cur.length > 1) morceaux.push({ points: cur, ferme: false })
        cur = []
      }
    }
    if (cur.length > 1) morceaux.push({ points: cur, ferme: false })
  }
  return { morceaux, surfaces }
}

/** LES PORTÉES À TRACER d'une surface, aux réglages du banc : la portée
 *  réelle (portée + rayon d'un grain), et selon la matière la portée à
 *  froid complet — la plaque froide s'étend, la chaudière rétrécit. [] :
 *  la surface n'a pas d'aura. */
export interface PorteeAura {
  portee: number
  couleur: string
  fond: string // alpha du remplissage (deux chiffres hexa), '' : aucun
  trait: string
  tirets: number[]
}

export function porteesAura(
  box: { material: number; aura?: number },
  P: Pick<SimParams, 'coldBand' | 'heatBand' | 'hydroBand' | 'chillColdGrowth' | 'chillHeatFade' | 'particleSpacing'>,
): PorteeAura[] {
  const rp = P.particleSpacing * 0.5
  const plein = (band: number, couleur: string): PorteeAura => ({ portee: band + rp, couleur, fond: '10', trait: '55', tirets: [5, 4] })
  const froid = (band: number, couleur: string): PorteeAura => ({ portee: band + rp, couleur, fond: '', trait: '2e', tirets: [2, 7] })
  if (box.material === MAT_FROID) {
    if (P.coldBand <= 0) return []
    return [plein(P.coldBand, '#8fc8ee'), froid(P.coldBand * (1 + P.chillColdGrowth), '#8fc8ee')]
  }
  if (box.material === MAT_CHAUD) {
    // chaque chaudière porte sa propre portée d'aura (champ Aura)
    const band = P.heatBand * (box.aura ?? 1)
    if (band <= 0) return []
    return [plein(band, '#ff8a3c'), froid(band * (1 - P.chillHeatFade), '#ff8a3c')]
  }
  if (box.material === MAT_HYDROPHILE) return P.hydroBand > 0 ? [plein(P.hydroBand, '#2ec6c9')] : []
  if (box.material === MAT_HYDROPHOBE) return P.hydroBand > 0 ? [plein(P.hydroBand, '#a878e8')] : []
  return []
}
