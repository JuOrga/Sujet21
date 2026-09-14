// Le traceur de faisceau laser (palier 1) — partagé entre le jeu et
// l'éditeur : la MÊME marche de rayon sert la mécanique, le rendu et
// l'aperçu de conception. Règles optiques :
//   · les parois pleines ABSORBENT (mur, hydrophile, hydrophobe, froid,
//     chaud) — le faisceau s'arrête, il ne rebondit pas sur la tôle ;
//   · la grille et le sas laissent passer (de la lumière entre des mailles) ;
//   · une PORTE FERMÉE absorbe ; ouverte, elle n'existe pas ;
//   · la GLACE RÉFLÉCHIT : le corps gelé est un miroir — c'est le cœur du
//     scénario. La normale locale vient du champ de particules (callback,
//     fourni par la simulation ; l'éditeur n'en a pas et trace tout droit) ;
//   · une CIBLE touchée s'allume et absorbe le faisceau ;
//   · l'EAU RÉFRACTE (palier 2) : le corps liquide est un prisme vivant.
//     À chaque traversée de surface, Snell-Descartes plie le rayon
//     (indice ≈ 1,33) ; en ressortant trop à plat (au-delà de l'angle
//     critique, ≈ 49° de la normale), c'est la RÉFLEXION TOTALE INTERNE :
//     le faisceau reste prisonnier de l'eau et ricoche sous sa surface.
//     Traverser est GRATUIT : la lumière plie le corps, elle ne le boit
//     pas — servir de prisme ne coûte rien ;
//   · la VAPEUR IONISE (palier 3) : le faisceau qui traverse le nuage
//     devient un arc de PLASMA — et le plasma, extrêmement soumis aux
//     champs magnétiques, est CAPTURÉ par les rails posés dans le décor :
//     s'il passe près de la ligne (N'IMPORTE OÙ le long du rail) en étant
//     ionisé, l'arc s'y accroche et la suit DANS LE SENS DU TRACÉ — du
//     premier point vers le dernier (virages, serpentins) — puis repart
//     tout droit au bout. Le faisceau ordinaire ignore les rails. Le
//     plasma se PROVOQUE — être vapeur dans la lumière au bon endroit —
//     il ne se choisit pas : ce n'est pas un quatrième état.

import {
  MAT_GRILLE,
  MAT_MIROIR,
  sansPhysique,
  type LaserDef,
  type ObstacleBox,
} from './level'
import { dansForme } from './formes'
import { MILIEU_EAU, MILIEU_GLACE, MILIEU_VAPEUR, type Bounds } from '../sim/solver'

export { MILIEU_EAU, MILIEU_GLACE, MILIEU_VAPEUR }

export const LASER_STEP = 5 // u par pas de marche — sous le rayon de glace
export const LASER_MAX_BOUNCES = 8
export const LASER_MAX_LENGTH = 9000 // u de course totale : personne ne verra plus loin
// Les dioptres (entrées/sorties d'eau, réflexions totales internes) ont leur
// propre plafond, plus généreux que les rebonds de miroir : un nuage de
// gouttes sur le trajet en crée facilement une dizaine.
export const LASER_MAX_REFRACT = 32
export const LASER_INDICE_EAU = 1.33
// Rayon de capture par défaut autour de la LIGNE du rail (tout du long),
// et plafond de rails suivis par un même faisceau (contre les boucles).
export const LASER_RAIL_RADIUS = 30
export const LASER_MAX_RAILS = 6

export interface CiblePoint {
  x: number
  y: number
  r: number
}

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface TraceMonde {
  bounds: Bounds
  boxes: ObstacleBox[]
  portesFermees: Rect[]
  cibles: CiblePoint[]
  /** Normale de la surface de glace en (x, y), ou null si pas de glace là.
   * L'éditeur passe null pour l'ensemble : il trace sans miroir. */
  iceNormal: ((x: number, y: number) => { nx: number; ny: number } | null) | null
  /** Le milieu liquide, pour la réfraction (palier 2) — ou null (éditeur :
   * pas de corps, le faisceau file droit dans l'air). `dedans` est le test
   * de milieu, appelé à CHAQUE pas (il doit rester bon marché) ; `normale`
   * n'est appelée qu'au franchissement d'un dioptre. */
  eau: {
    dedans(x: number, y: number): boolean
    normale(x: number, y: number): { nx: number; ny: number }
  } | null
  /** Indice de réfraction de l'eau (défaut LASER_INDICE_EAU ≈ 1,33).
   * À 1 : l'eau redevient optiquement transparente, comme au palier 1. */
  indice?: number
  /** La vapeur ionisante (palier 3), ou null (éditeur : pas de nuage, le
   * faisceau ne s'ionise jamais et les rails restent muets). Appelée à
   * chaque pas — elle doit rester bon marché. */
  vapeur: ((x: number, y: number) => boolean) | null
  /** Les rails magnétiques du tableau (polylignes, ≥ 2 points chacune —
   * l'ORDRE des points est le sens de circulation de l'arc). */
  rails: { points: { x: number; y: number }[] }[]
  /** Rayon de capture autour de la ligne du rail (défaut LASER_RAIL_RADIUS). */
  railRadius?: number
  /** LE MILIEU EN UN PASSAGE — le raccourci de la boucle chaude : les bits
   * MILIEU_GLACE (glace au contact), MILIEU_EAU (eau liquide, au sens de
   * `eau.dedans`) et MILIEU_VAPEUR (vapeur, au sens de `vapeur`) en (x, y).
   * Fourni, le traceur ne demande plus à chaque pas que lui, et ne calcule
   * la normale de glace (`iceNormal`, coûteuse) qu'où la glace est là.
   * Absent (l'éditeur, les tests), les trois requêtes séparées répondent
   * — même résultat, trois parcours de voisins au lieu d'un. */
  milieu?: (x: number, y: number) => number
}

export interface TraceResultat {
  /** Rebonds sur la glace (miroir vivant) : 0 si le faisceau n'a jamais
   * été réfléchi par un corps gelé. */
  rebondsGlace?: number
  /** Polyligne du faisceau : émetteur, dioptres, rebonds, nœuds de rail,
   * point d'arrêt. `eau` marque les points d'où le segment SUIVANT court
   * sous l'eau (halo élargi et rosé) ; `plasma` ceux d'où il court ionisé
   * — dans la vapeur ou guidé le long d'un rail (arc blanc-violet). */
  points: { x: number; y: number; eau?: boolean; plasma?: boolean }[]
  /** Indices des cibles allumées par CE faisceau. */
  touchees: number[]
  /** Indices des rails PARCOURUS par l'arc — le champ y est actif : la
   * simulation y convoie la vapeur le long de la ligne. */
  railsSuivis: number[]
}

function dansRect(x: number, y: number, r: Rect & { angle?: number; forme?: number; p0?: number; p1?: number }): boolean {
  // une FORME (disque, capsule, coin, arc) : le signe de son champ — la
  // marche par pas de 5 u fait le reste, comme pour les rectangles
  if (r.forme) return dansForme(r, x, y)
  if (r.angle) {
    const cx = (r.minX + r.maxX) / 2
    const cy = (r.minY + r.maxY) / 2
    const rad = (r.angle * Math.PI) / 180
    const ca = Math.cos(rad)
    const sa = Math.sin(rad)
    const rx = x - cx
    const ry = y - cy
    const lx = cx + rx * ca + ry * sa
    const ly = cy - rx * sa + ry * ca
    return lx >= r.minX && lx <= r.maxX && ly >= r.minY && ly <= r.maxY
  }
  return dansRectAxe(x, y, r)
}

function dansRectAxe(x: number, y: number, r: Rect): boolean {
  return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY
}

/** Une boîte absorbe-t-elle la lumière ? La grille laisse passer, et tout
 * ce qui n'a pas de physique (sas, vide, baie) n'a pas de matière à opposer.
 * (Le MIROIR FIXE « absorbe » aussi au sens des rails — l'arc guidé s'y
 * éteint — mais la marche libre le RÉFLÉCHIT avant d'en arriver là.) */
function absorbe(b: ObstacleBox): boolean {
  return b.material !== MAT_GRILLE && !sansPhysique(b.material)
}

// ---- LE FILTRE DES BOÎTES : un pas ne teste que celles qui sont sur sa
// route ------------------------------------------------------------------
//
// POURQUOI. Le rapport de performance du 14/09/2026 (Firefox sur Windows,
// salle « démineur » : 112 boîtes, 7 émetteurs, 7 cibles) montrait 10 im/s
// avec 97 ms d'« autre JS » par image — ni la physique (12 ms) ni le rendu
// (0,4 ms). C'était ce traceur : à CHAQUE pas de 5 u, chaque faisceau
// testait TOUTES les boîtes du tableau, deux fois (le miroir, puis la
// paroi), plus les portes. Sept faisceaux qui traversent un tableau de
// 2 800 u : ~4 000 pas × 230 tests de rectangle par image — 12 ms au banc
// dans Node, et bien plus sur un moteur JS moins prompt à optimiser ces
// boucles. Le coût grimpait avec le NOMBRE de boîtes, pas avec ce que le
// faisceau rencontrait.
//
// COMMENT. Entre deux événements (rebond, dioptre, rail), le faisceau court
// en ligne droite. Au départ de chaque segment droit, on calcule pour
// chaque boîte l'intervalle de distance [tIn, tOut] pendant lequel le rayon
// peut se trouver dans son ENVELOPPE (test des « slabs » sur la boîte
// englobante alignée — rotation comprise —, gonflée d'un pas et demi) ; un
// pas ne teste alors au contact près (dansRect : la forme, la rotation) que
// les boîtes dont l'intervalle contient sa distance parcourue. Le résultat
// est LE MÊME au pas près : le filtre n'écarte que les boîtes que le pas
// ne pouvait pas toucher. Les boîtes transparentes (grille, sas, vide,
// baie) ne sont même plus dans la liste.

/** Compteurs du DERNIER tracé : le nombre de pas de marche et le nombre de
 * tests de rectangle qu'ils ont coûté. Diagnostic et test — c'est ce qui
 * garde le filtre honnête (un tracé ne doit pas coûter plus de quelques
 * tests par pas, quel que soit le nombre de boîtes du tableau). */
export const statsTrace = { pas: 0, testsBoites: 0 }

const CONTACT_RIEN = -1
const CONTACT_OPAQUE = -2
// l'enveloppe est gonflée d'un pas et demi : le point testé avance par pas
// de LASER_STEP le long du segment, l'intervalle doit l'attraper à coup sûr
const GONFLE_ENVELOPPE = LASER_STEP * 1.5

export interface Enveloppe {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** L'enveloppe ALIGNÉE d'une boîte, gonflée de `marge` : pour une boîte
 * pivotée, c'est la boîte englobante du rectangle tourné — plus large que
 * min/max, qui décrivent le rectangle AVANT rotation (une barre de 300 × 40
 * pivotée de 90° occupe 40 × 300). Une forme (disque, capsule, coin, arc)
 * tient dans sa boîte min/max : l'enveloppe est la même. */
export function enveloppeBoite(b: Rect & { angle?: number }, marge: number): Enveloppe {
  if (b.angle) {
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    const hw = (b.maxX - b.minX) / 2
    const hh = (b.maxY - b.minY) / 2
    const rad = (b.angle * Math.PI) / 180
    const ca = Math.abs(Math.cos(rad))
    const sa = Math.abs(Math.sin(rad))
    const ex = hw * ca + hh * sa
    const ey = hw * sa + hh * ca
    return { minX: cx - ex - marge, minY: cy - ey - marge, maxX: cx + ex + marge, maxY: cy + ey + marge }
  }
  return { minX: b.minX - marge, minY: b.minY - marge, maxX: b.maxX + marge, maxY: b.maxY + marge }
}

/** L'intervalle de distance [tIn, tOut] (t ≥ 0) pendant lequel le rayon
 * (ox, oy) + t · (dx, dy) est dans l'enveloppe — écrit dans `out`. Faux si
 * le rayon ne la rencontre pas devant lui (à côté, ou déjà derrière). Un
 * départ DANS l'enveloppe donne tIn = 0. */
export function intervalleRayon(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  e: Enveloppe,
  out: { tIn: number; tOut: number },
): boolean {
  let tIn = 0
  let tOut = Infinity
  if (Math.abs(dx) < 1e-9) {
    if (ox < e.minX || ox > e.maxX) return false
  } else {
    const a = (e.minX - ox) / dx
    const b = (e.maxX - ox) / dx
    if (a < b) {
      if (a > tIn) tIn = a
      if (b < tOut) tOut = b
    } else {
      if (b > tIn) tIn = b
      if (a < tOut) tOut = a
    }
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < e.minY || oy > e.maxY) return false
  } else {
    const a = (e.minY - oy) / dy
    const b = (e.maxY - oy) / dy
    if (a < b) {
      if (a > tIn) tIn = a
      if (b < tOut) tOut = b
    } else {
      if (b > tIn) tIn = b
      if (a < tOut) tOut = a
    }
  }
  if (tOut < tIn) return false
  out.tIn = tIn
  out.tOut = tOut
  return true
}

class FiltreBoites {
  // les boîtes qui comptent (parois, miroirs, portes fermées), dans l'ordre
  // du tableau — l'ordre départage deux miroirs superposés comme avant
  private readonly boites: (Rect & { angle?: number; forme?: number; p0?: number; p1?: number })[] = []
  private readonly env: Enveloppe[] = []
  private readonly miroir: boolean[] = []
  // les candidats du segment droit courant, et leur intervalle de distance
  private readonly cand: number[] = []
  private readonly tIn: number[] = []
  private readonly tOut: number[] = []
  private n = 0
  private readonly scratch = { tIn: 0, tOut: 0 }

  constructor(boxes: ObstacleBox[], portesFermees: Rect[]) {
    for (const b of boxes) {
      if (!absorbe(b)) continue // transparente : jamais testée
      this.boites.push(b)
      this.env.push(enveloppeBoite(b, GONFLE_ENVELOPPE))
      this.miroir.push(b.material === MAT_MIROIR)
    }
    for (const p of portesFermees) {
      this.boites.push(p)
      this.env.push(enveloppeBoite(p, GONFLE_ENVELOPPE))
      this.miroir.push(false)
    }
  }

  /** Un nouveau segment droit part de (ox, oy) dans la direction (dx, dy) :
   * on retient les boîtes qu'il peut rencontrer, et quand. */
  segment(ox: number, oy: number, dx: number, dy: number): void {
    this.n = 0
    const sc = this.scratch
    for (let i = 0; i < this.boites.length; i++) {
      if (!intervalleRayon(ox, oy, dx, dy, this.env[i], sc)) continue
      this.cand[this.n] = i
      this.tIn[this.n] = sc.tIn
      this.tOut[this.n] = sc.tOut
      this.n++
    }
  }

  /** Ce que touche le point (x, y), à la distance `s` du départ du segment :
   * l'index d'un MIROIR (le premier dans l'ordre du tableau), CONTACT_OPAQUE
   * (paroi ou porte fermée), ou CONTACT_RIEN. */
  contact(s: number, x: number, y: number): number {
    let miroir = CONTACT_RIEN
    let opaque = false
    for (let k = 0; k < this.n; k++) {
      if (s < this.tIn[k] || s > this.tOut[k]) continue
      const i = this.cand[k]
      statsTrace.testsBoites++
      if (!dansRect(x, y, this.boites[i])) continue
      if (this.miroir[i]) {
        if (miroir === CONTACT_RIEN) miroir = i
      } else opaque = true
    }
    if (miroir !== CONTACT_RIEN) return miroir
    return opaque ? CONTACT_OPAQUE : CONTACT_RIEN
  }

  /** La boîte d'un index rendu par `contact` (un miroir : toujours une boîte
   * du tableau, jamais une porte). */
  boite(i: number): ObstacleBox {
    return this.boites[i] as ObstacleBox
  }
}

// ---- Le MIROIR FIXE : la paroi polie qui réfléchit le faisceau ----------
// La normale au point d'impact : analytique pour le rectangle (pivoté ou
// non — la face la plus proche dans le repère local) et pour le disque
// (radiale) ; numérique pour les autres formes (l'échantillonnage du champ
// autour du point donne la direction de sortie).
export function normaleMiroir(
  b: ObstacleBox,
  x: number,
  y: number,
): { nx: number; ny: number } {
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  if (!b.forme) {
    // repère local (dé-pivoté)
    let lx = x
    let ly = y
    const rad = ((b.angle ?? 0) * Math.PI) / 180
    if (b.angle) {
      const ca = Math.cos(rad)
      const sa = Math.sin(rad)
      const rx = x - cx
      const ry = y - cy
      lx = cx + rx * ca + ry * sa
      ly = cy - rx * sa + ry * ca
    }
    const pg = lx - b.minX
    const pd = b.maxX - lx
    const pb = ly - b.minY
    const ph = b.maxY - ly
    const m = Math.min(pg, pd, pb, ph)
    let nx = 0
    let ny = 0
    if (m === pg) nx = -1
    else if (m === pd) nx = 1
    else if (m === pb) ny = -1
    else ny = 1
    if (!b.angle) return { nx, ny }
    const ca = Math.cos(rad)
    const sa = Math.sin(rad)
    return { nx: nx * ca - ny * sa, ny: nx * sa + ny * ca }
  }
  if (b.forme === 1) {
    // disque/ellipse : la normale radiale, corrigée des demi-axes
    const ax = Math.max(1e-3, (b.maxX - b.minX) / 2)
    const ay = Math.max(1e-3, (b.maxY - b.minY) / 2)
    let nx = (x - cx) / (ax * ax)
    let ny = (y - cy) / (ay * ay)
    const n = Math.hypot(nx, ny) || 1
    nx /= n
    ny /= n
    return { nx, ny }
  }
  // formes composées : la moyenne des directions qui SORTENT du champ
  let sx = 0
  let sy = 0
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const ox = Math.cos(a) * 7
    const oy = Math.sin(a) * 7
    if (!dansForme(b, x + ox, y + oy)) {
      sx += ox
      sy += oy
    }
  }
  const n = Math.hypot(sx, sy)
  if (n < 1e-6) return { nx: 0, ny: 1 }
  return { nx: sx / n, ny: sy / n }
}

export function traceLaser(em: LaserDef, monde: TraceMonde): TraceResultat {
  const indice = monde.indice ?? LASER_INDICE_EAU
  const refracte = monde.eau !== null && indice > 1.001
  let dansEau = refracte && monde.eau!.dedans(em.x, em.y)
  const points: TraceResultat['points'] = [{ x: em.x, y: em.y, eau: dansEau }]
  const touchees: number[] = []
  const railsSuivis: number[] = []
  const a = (em.angle * Math.PI) / 180
  let dx = Math.cos(a)
  let dy = Math.sin(a)
  let x = em.x
  let y = em.y
  let bounces = 0
  let dioptres = 0
  let course = 0
  // ---- plasma (palier 3) ----
  const rr = monde.railRadius ?? LASER_RAIL_RADIUS
  let dansVapeur = monde.vapeur !== null && monde.vapeur(em.x, em.y)
  if (dansVapeur) points[0].plasma = true
  let railsPris = 0
  let capSursis = 0 // distance à parcourir avant de pouvoir reprendre un rail
  // le filtre des boîtes (voir plus haut) : un segment droit démarre ici,
  // et redémarre à chaque changement de direction ou de position
  const filtre = new FiltreBoites(monde.boxes, monde.portesFermees)
  filtre.segment(x, y, dx, dy)
  let sSeg = 0 // distance parcourue depuis le départ du segment droit courant
  statsTrace.pas = 0
  statsTrace.testsBoites = 0

  // Marche GUIDÉE le long d'un rail capturé : l'arc suit la polyligne nœud
  // par nœud, mais reste de la lumière — cibles, parois et portes fermées
  // l'arrêtent en chemin. Renvoie true si le faisceau s'est éteint.
  const suivreRail = (ordre: { x: number; y: number }[]): boolean => {
    for (const noeud of ordre) {
      let restant = Math.hypot(noeud.x - x, noeud.y - y)
      if (restant < 1e-6) continue
      const ux = (noeud.x - x) / restant
      const uy = (noeud.y - y) / restant
      dx = ux
      dy = uy
      filtre.segment(x, y, ux, uy)
      let sRail = 0
      while (restant > 0) {
        if (course >= LASER_MAX_LENGTH) {
          points.push({ x, y, plasma: true })
          return true
        }
        const pas = Math.min(LASER_STEP, restant)
        x += ux * pas
        y += uy * pas
        course += pas
        restant -= pas
        sRail += pas
        statsTrace.pas++
        for (let c = 0; c < monde.cibles.length; c++) {
          const t = monde.cibles[c]
          const ddx = x - t.x
          const ddy = y - t.y
          if (ddx * ddx + ddy * ddy <= t.r * t.r) {
            points.push({ x: t.x, y: t.y })
            touchees.push(c)
            return true
          }
        }
        // paroi, porte fermée — ou miroir : l'arc guidé s'y éteint
        if (filtre.contact(sRail, x, y) !== CONTACT_RIEN) {
          points.push({ x, y })
          return true
        }
      }
      points.push({ x: noeud.x, y: noeud.y, plasma: true })
    }
    return false
  }

  while (course < LASER_MAX_LENGTH) {
    const px = x
    const py = y
    x += dx * LASER_STEP
    y += dy * LASER_STEP
    course += LASER_STEP
    sSeg += LASER_STEP
    statsTrace.pas++

    // hors de la cuve : le faisceau se perd dans la coque
    if (x < monde.bounds.minX || x > monde.bounds.maxX || y < monde.bounds.minY || y > monde.bounds.maxY) {
      points.push({ x, y })
      return { points, touchees, railsSuivis, rebondsGlace: bounces }
    }

    // une cible : elle s'allume et boit le faisceau
    for (let c = 0; c < monde.cibles.length; c++) {
      const t = monde.cibles[c]
      const ddx = x - t.x
      const ddy = y - t.y
      if (ddx * ddx + ddy * ddy <= t.r * t.r) {
        points.push({ x: t.x, y: t.y })
        touchees.push(c)
        return { points, touchees, railsSuivis, rebondsGlace: bounces }
      }
    }

    // un MIROIR FIXE : la paroi polie réfléchit — même plafond de rebonds
    // que la glace (contre les couloirs de miroirs infinis)
    const contact = filtre.contact(sSeg, x, y)
    const miroirTouche = contact >= 0 ? filtre.boite(contact) : null
    if (miroirTouche) {
      if (bounces >= LASER_MAX_BOUNCES) {
        points.push({ x, y })
        return { points, touchees, railsSuivis, rebondsGlace: bounces }
      }
      bounces++
      points.push({ x, y })
      const n = normaleMiroir(miroirTouche, x, y)
      const dsc = dx * n.nx + dy * n.ny
      dx -= 2 * dsc * n.nx
      dy -= 2 * dsc * n.ny
      const inv = 1 / Math.max(1e-6, Math.hypot(dx, dy))
      dx *= inv
      dy *= inv
      // dégagement : on ressort du poli le long de la normale
      let garde = 0
      while (garde++ < 10 && dansRect(x, y, miroirTouche)) {
        x += n.nx * LASER_STEP
        y += n.ny * LASER_STEP
        course += LASER_STEP
      }
      filtre.segment(x, y, dx, dy)
      sSeg = 0
      if (refracte) dansEau = monde.eau!.dedans(x, y)
      if (monde.vapeur) dansVapeur = monde.vapeur(x, y)
      points[points.length - 1].eau = dansEau
      points[points.length - 1].plasma = dansVapeur
      continue
    }

    // une paroi pleine ou une porte fermée : absorbé
    if (contact === CONTACT_OPAQUE) {
      points.push({ x, y })
      return { points, touchees, railsSuivis, rebondsGlace: bounces }
    }

    // le milieu du pas, en un passage quand la simulation sait le dire
    // (−1 : pas de raccourci, chaque question se pose à part)
    const milieu = monde.milieu ? monde.milieu(x, y) : -1

    // la glace : miroir. On réfléchit sur la normale locale, puis on ressort
    // du champ de la surface pour ne pas se re-cogner au pas suivant.
    const n =
      monde.iceNormal && (milieu < 0 || (milieu & MILIEU_GLACE) !== 0)
        ? monde.iceNormal(x, y)
        : null
    if (n) {
      if (bounces >= LASER_MAX_BOUNCES) {
        points.push({ x, y })
        return { points, touchees, railsSuivis, rebondsGlace: bounces }
      }
      bounces++
      points.push({ x, y })
      const d = dx * n.nx + dy * n.ny
      dx -= 2 * d * n.nx
      dy -= 2 * d * n.ny
      const inv = 1 / Math.max(1e-6, Math.hypot(dx, dy))
      dx *= inv
      dy *= inv
      // dégagement : on recule le long de la normale jusqu'à quitter la glace
      let garde = 0
      while (garde++ < 8 && monde.iceNormal && monde.iceNormal(x, y)) {
        x += n.nx * LASER_STEP
        y += n.ny * LASER_STEP
        course += LASER_STEP
      }
      filtre.segment(x, y, dx, dy)
      sSeg = 0
      // le dégagement a pu nous déposer dans l'eau ou la vapeur (la glace
      // baigne dans le corps) : on resynchronise SANS déclencher de dioptre
      if (refracte) dansEau = monde.eau!.dedans(x, y)
      if (monde.vapeur) dansVapeur = monde.vapeur(x, y)
      points[points.length - 1].eau = dansEau
      points[points.length - 1].plasma = dansVapeur
      continue
    }

    // l'eau : dioptre. Changer de milieu plie le rayon (Snell-Descartes) ;
    // sortir trop à plat le RÉFLÉCHIT sous la surface (réflexion totale).
    if (refracte) {
      const la = milieu < 0 ? monde.eau!.dedans(x, y) : (milieu & MILIEU_EAU) !== 0
      if (la !== dansEau) {
        if (dioptres >= LASER_MAX_REFRACT) {
          points.push({ x, y })
          return { points, touchees, railsSuivis, rebondsGlace: bounces } // trop de gouttes : le faisceau se diffuse
        }
        dioptres++
        const n = monde.eau!.normale(x, y)
        // la normale doit faire FACE au rayon incident
        let nx = n.nx
        let ny = n.ny
        let cosi = -(dx * nx + dy * ny)
        if (cosi < 0) {
          nx = -nx
          ny = -ny
          cosi = -cosi
        }
        const eta = dansEau ? indice : 1 / indice // n1/n2 du milieu quitté vers l'autre
        const k = 1 - eta * eta * (1 - cosi * cosi)
        if (k < 0) {
          // réflexion totale interne : le rayon reste dans son milieu.
          // On revient au point d'AVANT le franchissement pour repartir
          // du bon côté de la surface.
          points.push({ x: px, y: py, eau: dansEau })
          const d = dx * nx + dy * ny
          dx -= 2 * d * nx
          dy -= 2 * d * ny
          x = px
          y = py
        } else {
          points.push({ x, y, eau: la })
          const t = eta * cosi - Math.sqrt(k)
          dx = eta * dx + t * nx
          dy = eta * dy + t * ny
          dansEau = la
        }
        const inv = 1 / Math.max(1e-6, Math.hypot(dx, dy))
        dx *= inv
        dy *= inv
        filtre.segment(x, y, dx, dy)
        sSeg = 0
      }
    }

    // le plasma : dans la vapeur, le faisceau s'ionise (l'arc se voit) —
    // et l'arc ionisé qui passe près d'une extrémité de rail est CAPTURÉ
    // par le champ : il suit la ligne jusqu'à l'autre bout, puis repart
    // tout droit, désionisé (sauf à ressortir dans un nuage).
    if (capSursis > 0) capSursis -= LASER_STEP
    if (monde.vapeur) {
      const ion = milieu < 0 ? monde.vapeur(x, y) : (milieu & MILIEU_VAPEUR) !== 0
      if (ion !== dansVapeur) {
        dansVapeur = ion
        points.push({ x, y, eau: dansEau, plasma: dansVapeur })
      }
      if (dansVapeur && capSursis <= 0 && railsPris < LASER_MAX_RAILS) {
        for (let ri = 0; ri < monde.rails.length; ri++) {
          const pts = monde.rails[ri].points
          if (pts.length < 2) continue
          // le point de la LIGNE le plus proche du faisceau : la capture se
          // fait n'importe où le long du rail, pas seulement aux bouts
          let best = Infinity
          let bx = 0
          let by = 0
          let bseg = -1
          for (let s = 0; s + 1 < pts.length; s++) {
            const a = pts[s]
            const b = pts[s + 1]
            const abx = b.x - a.x
            const aby = b.y - a.y
            const len2 = abx * abx + aby * aby
            const t =
              len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
            const qx = a.x + abx * t
            const qy = a.y + aby * t
            const d = Math.hypot(x - qx, y - qy)
            if (d < best) {
              best = d
              bx = qx
              by = qy
              bseg = s
            }
          }
          if (best > rr) continue
          railsPris++
          if (!railsSuivis.includes(ri)) railsSuivis.push(ri)
          points.push({ x, y, plasma: true })
          // l'arc rejoint la ligne au point de capture, puis la suit dans
          // le SENS DU TRACÉ — du point de capture vers le dernier point
          const ordre = [{ x: bx, y: by }, ...pts.slice(bseg + 1)]
          if (suivreRail(ordre)) return { points, touchees, railsSuivis, rebondsGlace: bounces }
          // sorti au bout du rail : on repart tout droit, dans le milieu
          // qu'on y trouve — et un court sursis évite de reprendre le
          // même rail par son extrémité de sortie.
          capSursis = rr + LASER_STEP * 2
          filtre.segment(x, y, dx, dy)
          sSeg = 0
          if (refracte) dansEau = monde.eau!.dedans(x, y)
          dansVapeur = monde.vapeur(x, y)
          const dernier = points[points.length - 1]
          dernier.eau = dansEau
          dernier.plasma = dansVapeur
          break
        }
      }
    }
  }
  points.push({ x, y })
  return { points, touchees, railsSuivis, rebondsGlace: bounces }
}

// ---- Les récepteurs (TOR / NOR) : la mémoire des cibles, pure et testable ----
// Deux familles, chacune à transition UNIQUE :
//   · TOR : un passage du faisceau allume POUR DE BON — la porte asservie
//     s'ouvre et le reste (l'activation est acquise jusqu'au Recommencer) ;
//   · NOR : active TANT QUE le faisceau la tient — à la PREMIÈRE coupure,
//     la pastille grille : scellée, la porte se referme définitivement.
// La persistance absorbe le tremblement d'une image (miroir de glace qui
// frémit, porte qui s'ouvre et déplace le trajet à l'image suivante) : une
// micro-coupure sous ce délai ne scelle pas.
export const CIBLE_PERSISTANCE = 0.12 // s

export interface EtatRecepteurs {
  vues: boolean[] // touchée au moins une fois depuis le début (TOR : verrou)
  dernierPhoton: number[] // date du dernier photon reçu, en secondes
  scellees: boolean[] // NOR : la coupure est passée par là — plus rien ne bouge
}

export function creerEtatRecepteurs(n: number): EtatRecepteurs {
  return {
    vues: Array.from({ length: n }, () => false),
    dernierPhoton: Array.from({ length: n }, () => -Infinity),
    scellees: Array.from({ length: n }, () => false),
  }
}

/** Avancé une fois par image, APRÈS le traçage : consigne les photons reçus
 * puis scelle les NOR dont le faisceau vient de se couper. */
export function avancerRecepteurs(
  cibles: { mode?: 'tor' | 'nor'; canal?: number }[],
  touchees: number[],
  etat: EtatRecepteurs,
  now: number,
): void {
  for (const c of touchees) {
    if (c < 0 || c >= cibles.length) continue
    etat.vues[c] = true
    etat.dernierPhoton[c] = now
  }
  for (let c = 0; c < cibles.length; c++) {
    if ((cibles[c].mode ?? 'tor') !== 'nor') continue
    if (etat.vues[c] && !etat.scellees[c] && now - etat.dernierPhoton[c] > CIBLE_PERSISTANCE) {
      etat.scellees[c] = true
    }
  }
}

/** Une cible alimente-t-elle ses portes en cet instant ?
 * TOR : oui dès qu'elle a été vue. NOR : oui sous le faisceau (persistance
 * comprise), plus jamais une fois scellée. */
export function cibleActive(
  cible: { mode?: 'tor' | 'nor'; canal?: number },
  etat: EtatRecepteurs,
  c: number,
  now: number,
): boolean {
  if ((cible.mode ?? 'tor') === 'nor') {
    return etat.vues[c] && !etat.scellees[c] && now - etat.dernierPhoton[c] <= CIBLE_PERSISTANCE
  }
  return etat.vues[c] === true
}

// ---- Les CANAUX : le numéro d'une pastille est logique, pas positionnel ----
// Plusieurs pastilles peuvent porter le même numéro ; une porte vise ce
// numéro et choisit sa règle : OU (défaut) — une pastille active du canal
// suffit ; ET — il les faut toutes en même temps.

/** Le numéro affiché sur une pastille : le sien, sinon sa position. */
export function canalDeCible(cibles: { canal?: number }[], c: number): number {
  return cibles[c]?.canal ?? c + 1
}

/** Le canal d'une porte l'alimente-t-il en cet instant ?
 * Négatif (porte scénarisée) ou sans pastille : jamais. */
export function canalActif(
  cibles: { mode?: 'tor' | 'nor'; canal?: number }[],
  canal: number,
  regle: 'et' | undefined,
  etat: EtatRecepteurs,
  now: number,
): boolean {
  if (canal < 0) return false
  let pastilles = 0
  for (let c = 0; c < cibles.length; c++) {
    if (canalDeCible(cibles, c) !== canal) continue
    pastilles++
    const active = cibleActive(cibles[c], etat, c, now)
    if (regle === 'et') {
      if (!active) return false
    } else if (active) {
      return true
    }
  }
  return regle === 'et' && pastilles > 0
}
