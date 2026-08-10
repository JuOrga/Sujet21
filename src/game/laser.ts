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
//   · l'eau et la vapeur n'ARRÊTENT pas le faisceau au palier 1 (la
//     réfraction est le palier 2, le plasma le palier 3) — l'eau chauffe,
//     mais c'est la simulation qui s'en charge (laserHeat), pas le traceur.

import { MAT_EXIT, MAT_GRILLE, type LaserDef, type ObstacleBox } from './level'
import type { Bounds } from '../sim/solver'

export const LASER_STEP = 5 // u par pas de marche — sous le rayon de glace
export const LASER_MAX_BOUNCES = 8
export const LASER_MAX_LENGTH = 9000 // u de course totale : personne ne verra plus loin

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
}

export interface TraceResultat {
  /** Polyligne du faisceau : émetteur, points de rebond, point d'arrêt. */
  points: { x: number; y: number }[]
  /** Indices des cibles allumées par CE faisceau. */
  touchees: number[]
}

function dansRect(x: number, y: number, r: Rect): boolean {
  return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY
}

/** Une boîte absorbe-t-elle la lumière ? Grille et sas laissent passer. */
function absorbe(b: ObstacleBox): boolean {
  return b.material !== MAT_GRILLE && b.material !== MAT_EXIT
}

export function traceLaser(em: LaserDef, monde: TraceMonde): TraceResultat {
  const points: { x: number; y: number }[] = [{ x: em.x, y: em.y }]
  const touchees: number[] = []
  const a = (em.angle * Math.PI) / 180
  let dx = Math.cos(a)
  let dy = Math.sin(a)
  let x = em.x
  let y = em.y
  let bounces = 0
  let course = 0

  while (course < LASER_MAX_LENGTH) {
    x += dx * LASER_STEP
    y += dy * LASER_STEP
    course += LASER_STEP

    // hors de la cuve : le faisceau se perd dans la coque
    if (x < monde.bounds.minX || x > monde.bounds.maxX || y < monde.bounds.minY || y > monde.bounds.maxY) {
      points.push({ x, y })
      return { points, touchees }
    }

    // une cible : elle s'allume et boit le faisceau
    for (let c = 0; c < monde.cibles.length; c++) {
      const t = monde.cibles[c]
      const ddx = x - t.x
      const ddy = y - t.y
      if (ddx * ddx + ddy * ddy <= t.r * t.r) {
        points.push({ x: t.x, y: t.y })
        touchees.push(c)
        return { points, touchees }
      }
    }

    // une paroi pleine ou une porte fermée : absorbé
    let stoppe = false
    for (const b of monde.boxes) {
      if (absorbe(b) && dansRect(x, y, b)) {
        stoppe = true
        break
      }
    }
    if (!stoppe) {
      for (const p of monde.portesFermees) {
        if (dansRect(x, y, p)) {
          stoppe = true
          break
        }
      }
    }
    if (stoppe) {
      points.push({ x, y })
      return { points, touchees }
    }

    // la glace : miroir. On réfléchit sur la normale locale, puis on ressort
    // du champ de la surface pour ne pas se re-cogner au pas suivant.
    const n = monde.iceNormal ? monde.iceNormal(x, y) : null
    if (n) {
      if (bounces >= LASER_MAX_BOUNCES) {
        points.push({ x, y })
        return { points, touchees }
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
    }
  }
  points.push({ x, y })
  return { points, touchees }
}
