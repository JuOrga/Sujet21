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
//   · la vapeur n'arrête toujours pas le faisceau (le plasma, palier 3).

import { MAT_EXIT, MAT_GRILLE, type LaserDef, type ObstacleBox } from './level'
import type { Bounds } from '../sim/solver'

export const LASER_STEP = 5 // u par pas de marche — sous le rayon de glace
export const LASER_MAX_BOUNCES = 8
export const LASER_MAX_LENGTH = 9000 // u de course totale : personne ne verra plus loin
// Les dioptres (entrées/sorties d'eau, réflexions totales internes) ont leur
// propre plafond, plus généreux que les rebonds de miroir : un nuage de
// gouttes sur le trajet en crée facilement une dizaine.
export const LASER_MAX_REFRACT = 32
export const LASER_INDICE_EAU = 1.33

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
}

export interface TraceResultat {
  /** Polyligne du faisceau : émetteur, dioptres, rebonds, point d'arrêt.
   * `eau` marque les points d'où le segment SUIVANT court sous l'eau —
   * le rendu adoucit et élargit le halo de ces tronçons immergés. */
  points: { x: number; y: number; eau?: boolean }[]
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
  const indice = monde.indice ?? LASER_INDICE_EAU
  const refracte = monde.eau !== null && indice > 1.001
  let dansEau = refracte && monde.eau!.dedans(em.x, em.y)
  const points: { x: number; y: number; eau?: boolean }[] = [{ x: em.x, y: em.y, eau: dansEau }]
  const touchees: number[] = []
  const a = (em.angle * Math.PI) / 180
  let dx = Math.cos(a)
  let dy = Math.sin(a)
  let x = em.x
  let y = em.y
  let bounces = 0
  let dioptres = 0
  let course = 0

  while (course < LASER_MAX_LENGTH) {
    const px = x
    const py = y
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
      // le dégagement a pu nous déposer dans l'eau (la glace baigne dans le
      // corps) : on resynchronise le milieu SANS déclencher de dioptre
      if (refracte) dansEau = monde.eau!.dedans(x, y)
      points[points.length - 1].eau = dansEau
      continue
    }

    // l'eau : dioptre. Changer de milieu plie le rayon (Snell-Descartes) ;
    // sortir trop à plat le RÉFLÉCHIT sous la surface (réflexion totale).
    if (refracte) {
      const la = monde.eau!.dedans(x, y)
      if (la !== dansEau) {
        if (dioptres >= LASER_MAX_REFRACT) {
          points.push({ x, y })
          return { points, touchees } // trop de gouttes : le faisceau se diffuse
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
      }
    }
  }
  points.push({ x, y })
  return { points, touchees }
}
