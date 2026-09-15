// LA MATÉRIALISATION D'UNE PORTE : la paroi n'apparaît plus d'un coup, un
// FRONT la déploie — droit (rideau) ou pivotant (éventail). Tout se ramène
// à un rectangle tronqué par un demi-plan (la Coupe de formes.ts) dont la
// ligne bouge au fil d'un AVANCEMENT 0..1 : 0, la porte n'existe pas ; 1,
// elle est pleine. Ce module ne connaît ni le solveur ni le canvas : il
// rend la boîte à donner au solveur, le polygone à dessiner, et fait
// avancer la valeur au temps de jeu. Le même chemin sert à l'ouverture, à
// rebours — un rideau qui se lève est le même rideau.

import type { Coupe, FormeBox } from './formes'
import {
  PORTE_ALLURE_DEFAUT,
  PORTE_SENS_DEFAUT,
  type PorteDef,
  type PorteMaterialisation,
} from './level'

export interface Point {
  x: number
  y: number
}

export const PORTE_MATERIALISATION_NOMS: Record<
  PorteMaterialisation | '',
  string
> = {
  '': 'D’un coup (la paroi apparaît)',
  rideau: 'Rideau — un front droit qui avance',
  eventail: 'Éventail — un front qui pivote sur une charnière',
}

// Les huit charnières de l'éventail, en tournant depuis le coin sud-ouest.
export const PORTE_PIVOT_NOMS = [
  'Coin sud-ouest',
  'Milieu sud',
  'Coin sud-est',
  'Milieu est',
  'Coin nord-est',
  'Milieu nord',
  'Coin nord-ouest',
  'Milieu ouest',
]

type Rect = { minX: number; minY: number; maxX: number; maxY: number }

const RAD = Math.PI / 180

/** La charnière de l'éventail, et l'ÉVENTAIL D'ANGLES sous lequel le
 *  rectangle se voit depuis elle (a0..a1, radians, sens trigonométrique) :
 *  un quart de tour depuis un coin, un demi-tour depuis le milieu d'un
 *  côté. Le front balaie cet éventail, et rien d'autre. */
export function porteCharniere(
  p: Rect,
  pivot: number | undefined,
): { x: number; y: number; a0: number; a1: number } {
  const k = ((Math.round(pivot ?? 0) % 8) + 8) % 8
  const cx = (p.minX + p.maxX) / 2
  const cy = (p.minY + p.maxY) / 2
  switch (k) {
    case 0:
      return { x: p.minX, y: p.minY, a0: 0, a1: 90 * RAD }
    case 1:
      return { x: cx, y: p.minY, a0: 0, a1: 180 * RAD }
    case 2:
      return { x: p.maxX, y: p.minY, a0: 90 * RAD, a1: 180 * RAD }
    case 3:
      return { x: p.maxX, y: cy, a0: 90 * RAD, a1: 270 * RAD }
    case 4:
      return { x: p.maxX, y: p.maxY, a0: 180 * RAD, a1: 270 * RAD }
    case 5:
      return { x: cx, y: p.maxY, a0: 180 * RAD, a1: 360 * RAD }
    case 6:
      return { x: p.minX, y: p.maxY, a0: 270 * RAD, a1: 360 * RAD }
    default:
      return { x: p.minX, y: cy, a0: 270 * RAD, a1: 450 * RAD }
  }
}

function coins(p: Rect): Point[] {
  return [
    { x: p.minX, y: p.minY },
    { x: p.maxX, y: p.minY },
    { x: p.maxX, y: p.maxY },
    { x: p.minX, y: p.maxY },
  ]
}

/** La COURSE du front, en unités monde : ce que l'allure (u/s) doit
 *  parcourir pour que la porte soit pleine. Rideau : l'étendue du rectangle
 *  dans sa direction. Éventail : l'arc décrit par l'extrémité la plus
 *  lointaine — le bout du front, pas sa charnière. */
export function porteCourse(p: PorteDef): number {
  if (p.materialisation === 'eventail') {
    const ch = porteCharniere(p, p.pivot)
    let rMax = 0
    for (const c of coins(p)) rMax = Math.max(rMax, Math.hypot(c.x - ch.x, c.y - ch.y))
    return (ch.a1 - ch.a0) * rMax
  }
  const a = (p.sens ?? PORTE_SENS_DEFAUT) * RAD
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  let tMin = Infinity
  let tMax = -Infinity
  for (const c of coins(p)) {
    const t = c.x * ux + c.y * uy
    tMin = Math.min(tMin, t)
    tMax = Math.max(tMax, t)
  }
  return tMax - tMin
}

/** La durée (s) d'une fermeture complète — 0 pour une porte d'un coup. */
export function porteDuree(p: PorteDef): number {
  if (!p.materialisation) return 0
  const allure = p.allure ?? PORTE_ALLURE_DEFAUT
  if (!(allure > 0)) return 0
  return porteCourse(p) / allure
}

/** La COUPE à l'avancement s (strictement entre 0 et 1) : le demi-plan
 *  derrière le front. Ce qui est du côté de la normale n'existe pas encore. */
export function porteCoupe(p: PorteDef, s: number): Coupe {
  if (p.materialisation === 'eventail') {
    const ch = porteCharniere(p, p.pivot)
    const phi = p.horaire
      ? ch.a1 - s * (ch.a1 - ch.a0)
      : ch.a0 + s * (ch.a1 - ch.a0)
    const fx = Math.cos(phi)
    const fy = Math.sin(phi)
    // trigonométrique : on garde ce qui est « avant » le front dans le sens
    // de rotation, soit à sa droite — la normale sortante est sa gauche ;
    // horaire : l'inverse
    return p.horaire
      ? { x: ch.x, y: ch.y, nx: fy, ny: -fx }
      : { x: ch.x, y: ch.y, nx: -fy, ny: fx }
  }
  const a = (p.sens ?? PORTE_SENS_DEFAUT) * RAD
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  let tMin = Infinity
  let tMax = -Infinity
  for (const c of coins(p)) {
    const t = c.x * ux + c.y * uy
    tMin = Math.min(tMin, t)
    tMax = Math.max(tMax, t)
  }
  const t = tMin + s * (tMax - tMin)
  const cx = (p.minX + p.maxX) / 2
  const cy = (p.minY + p.maxY) / 2
  const tc = cx * ux + cy * uy
  return { x: cx + ux * (t - tc), y: cy + uy * (t - tc), nx: ux, ny: uy }
}

/** La BOÎTE à donner au solveur (et au laser) pour l'avancement s : rien
 *  à 0, le rectangle plein à 1, le rectangle tronqué entre les deux. */
export function porteBoite(p: PorteDef, s: number): FormeBox | null {
  if (!(s > 0)) return null
  const rect = { minX: p.minX, minY: p.minY, maxX: p.maxX, maxY: p.maxY }
  if (s >= 1 || !p.materialisation) return rect
  return { ...rect, coupe: porteCoupe(p, s) }
}

/** Le POLYGONE de la partie matérialisée (monde, sens trigonométrique), et
 *  le FRONT — le segment où la ligne coupe le rectangle, vide quand la
 *  porte est pleine ou absente. Sutherland–Hodgman sur un seul demi-plan. */
export function portePolygone(
  p: PorteDef,
  s: number,
): { contour: Point[]; front: Point[] } {
  const c = coins(p)
  if (!(s > 0)) return { contour: [], front: [] }
  if (s >= 1 || !p.materialisation) return { contour: c, front: [] }
  const k = porteCoupe(p, s)
  const d = c.map((q) => (q.x - k.x) * k.nx + (q.y - k.y) * k.ny)
  const contour: Point[] = []
  const front: Point[] = []
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    if (d[i] <= 0) contour.push(c[i])
    if ((d[i] <= 0) !== (d[j] <= 0)) {
      const t = d[i] / (d[i] - d[j])
      const q = { x: c[i].x + (c[j].x - c[i].x) * t, y: c[i].y + (c[j].y - c[i].y) * t }
      contour.push(q)
      front.push(q)
    }
  }
  return { contour, front }
}

/** L'avancement à l'image suivante : il court vers 1 (fermée) ou 0
 *  (ouverte) au rythme de l'allure, au TEMPS DE JEU dt (s) — une pause le
 *  suspend. Une porte d'un coup saute directement à sa cible. */
export function porteAvance(
  p: PorteDef,
  avance: number,
  ouverte: boolean,
  dt: number,
): number {
  const cible = ouverte ? 0 : 1
  const duree = porteDuree(p)
  if (!(duree > 0)) return cible
  const pas = dt / duree
  if (avance < cible) return Math.min(cible, avance + pas)
  if (avance > cible) return Math.max(cible, avance - pas)
  return cible
}
