// ---------------------------------------------------------------------------
// LES CAPTEURS — ce que l'agent « voit » d'un tableau.
//
// Ce fichier est le PONT entre l'entraînement et le jeu : l'environnement
// sans écran et le jeu dans le navigateur lisent la même observation, par le
// même code. S'ils divergeaient d'un seul nombre, une politique entraînée
// hors ligne se comporterait autrement à l'écran — et personne ne saurait
// pourquoi.
//
// Pas de pixels : le corps connaît sa position, sa vitesse, son volume, la
// direction du sas, et tâte les parois autour de lui par télémétrie — des
// rayons, comme les moustaches d'un chat. Tout est normalisé dans [-1, 1]
// environ : ni un réseau ni une politique linéaire n'a à deviner les
// échelles.
// ---------------------------------------------------------------------------

import type { FluidSim } from '../sim/solver'
import { MAT_EXIT, dansBoite, type LevelDef, type ObstacleBox } from '../game/level'

/**
 * Code de matériau réservé à l'éponge : elle n'est pas une paroi (elle
 * englue, elle absorbe), mais elle barre la route — l'agent doit la sentir,
 * sinon le mur d'éponge du tableau 21-A est un piège invisible.
 */
export const MAT_EPONGE = 11

/** Une paroi arrête-t-elle l'eau ? Le sas est du rendu, jamais de la physique. */
function paroiSolide(b: ObstacleBox): boolean {
  return b.material !== MAT_EXIT
}

export interface OptionsCapteurs {
  /** Nombre de rayons de télémétrie autour du corps (défaut 16). */
  rayons?: number
  /** Portée de la télémétrie, en unités monde (défaut 700). */
  porteeRayon?: number
  /** Durée de référence pour normaliser le chrono (défaut 60 s). */
  dureeReference?: number
}

export class Capteurs {
  readonly rayons: number
  readonly porteeRayon: number
  readonly dureeReference: number
  readonly taille: number
  readonly sortie: { x: number; y: number }
  readonly diagonale: number

  private readonly bounds: LevelDef['bounds']
  private readonly parois: ObstacleBox[]
  private readonly eponges: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }[]
  private readonly obs: Float32Array

  constructor(level: LevelDef, opts: OptionsCapteurs = {}) {
    this.rayons = opts.rayons ?? 16
    this.porteeRayon = opts.porteeRayon ?? 700
    this.dureeReference = opts.dureeReference ?? 60
    this.bounds = level.bounds
    this.parois = level.boxes.filter(paroiSolide)
    this.eponges = level.sponges.map((e) => ({
      minX: e.minX,
      minY: e.minY,
      maxX: e.minX + e.cols * e.cellSize,
      maxY: e.minY + e.rows * e.cellSize,
    }))
    this.sortie = {
      x: (level.exit.minX + level.exit.maxX) * 0.5,
      y: (level.exit.minY + level.exit.maxY) * 0.5,
    }
    this.diagonale = Math.hypot(
      level.bounds.maxX - level.bounds.minX,
      level.bounds.maxY - level.bounds.minY,
    )
    this.taille = 11 + 2 * this.rayons
    this.obs = new Float32Array(this.taille)
  }

  /** L'observation, réécrite dans le même tampon à chaque appel. */
  lis(sim: FluidSim, temps: number): Float32Array {
    const b = this.bounds
    const o = this.obs
    const p = sim.params
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    const vmax = Math.max(1, p.maxSpeed)
    let i = 0
    o[i++] = ((cx - b.minX) / (b.maxX - b.minX)) * 2 - 1
    o[i++] = ((cy - b.minY) / (b.maxY - b.minY)) * 2 - 1
    o[i++] = sim.stats.velX / vmax
    o[i++] = sim.stats.velY / vmax
    const dx = this.sortie.x - cx
    const dy = this.sortie.y - cy
    const d = Math.hypot(dx, dy) || 1
    o[i++] = dx / d
    o[i++] = dy / d
    o[i++] = Math.min(1, d / this.diagonale)
    o[i++] = sim.baseVolume > 0 ? sim.aliveCount() / sim.baseVolume : 0
    o[i++] = sim.baseVolume > 0 ? sim.swallowed / sim.baseVolume : 0
    o[i++] = Math.min(1, sim.stats.rmsRadius / (p.kernelRadius * 12))
    o[i++] = Math.min(1, temps / this.dureeReference)
    for (let k = 0; k < this.rayons; k++) {
      const a = (k / this.rayons) * Math.PI * 2
      const t = this.tate(cx, cy, Math.cos(a), Math.sin(a))
      o[i++] = t.distance / this.porteeRayon
      o[i++] = t.materiau / 10
    }
    return o
  }

  /**
   * Télémétrie : jusqu'où va-t-on dans cette direction avant une paroi (ou le
   * bord de la cuve) ? Échantillonnage régulier — la précision d'un pas de
   * grille suffit largement à une décision prise dix fois par seconde, et
   * coûte cent fois moins qu'un pas de fluide.
   */
  private tate(
    x: number,
    y: number,
    dx: number,
    dy: number,
  ): { distance: number; materiau: number } {
    const pas = 14
    const b = this.bounds
    for (let d = pas; d <= this.porteeRayon; d += pas) {
      const px = x + dx * d
      const py = y + dy * d
      if (px < b.minX || px > b.maxX || py < b.minY || py > b.maxY) {
        return { distance: d, materiau: 0 } // la coque de la cuve
      }
      for (let j = 0; j < this.parois.length; j++) {
        const boite = this.parois[j]
        if (dansBoite(boite, px, py)) {
          return { distance: d, materiau: boite.material }
        }
      }
      for (let j = 0; j < this.eponges.length; j++) {
        const e = this.eponges[j]
        if (px >= e.minX && px <= e.maxX && py >= e.minY && py <= e.maxY) {
          return { distance: d, materiau: MAT_EPONGE }
        }
      }
    }
    return { distance: this.porteeRayon, materiau: -1 }
  }
}
