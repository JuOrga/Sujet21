// Obstacles solides et éponge. Un obstacle est un gradient de risque, jamais
// un mur binaire (§6).

import type { SpongeDef } from '../game/level'

export interface ClosestPoint {
  dist: number // 0 si à l'intérieur
  nx: number // normale sortante (vers la particule)
  ny: number
}

// Point le plus proche d'une boîte ; si la particule est dedans, renvoie la
// normale de moindre pénétration et dist = -profondeur.
export function boxContact(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
  out: ClosestPoint,
): void {
  const inside = x > b.minX && x < b.maxX && y > b.minY && y < b.maxY
  if (!inside) {
    const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x
    const cy = y < b.minY ? b.minY : y > b.maxY ? b.maxY : y
    const dx = x - cx
    const dy = y - cy
    const d = Math.hypot(dx, dy)
    out.dist = d
    if (d > 1e-9) {
      out.nx = dx / d
      out.ny = dy / d
    } else {
      out.nx = 0
      out.ny = 1
    }
    return
  }
  const pLeft = x - b.minX
  const pRight = b.maxX - x
  const pBottom = y - b.minY
  const pTop = b.maxY - y
  let pen = pLeft
  let nx = -1
  let ny = 0
  if (pRight < pen) {
    pen = pRight
    nx = 1
    ny = 0
  }
  if (pBottom < pen) {
    pen = pBottom
    nx = 0
    ny = -1
  }
  if (pTop < pen) {
    pen = pTop
    nx = 0
    ny = 1
  }
  out.dist = -pen
  out.nx = nx
  out.ny = ny
}

// L'éponge (§6) : chaque cellule englue, absorbe après un temps de contact
// continu, se sature, et une cellule gorgée devient solide — la brèche payée
// en volume est permanente.
export class Sponge {
  readonly def: SpongeDef
  readonly saturation: Float32Array
  readonly maxX: number
  readonly maxY: number

  constructor(def: SpongeDef) {
    this.def = def
    this.saturation = new Float32Array(def.cols * def.rows)
    this.maxX = def.minX + def.cols * def.cellSize
    this.maxY = def.minY + def.rows * def.cellSize
  }

  contains(x: number, y: number): boolean {
    return x >= this.def.minX && x < this.maxX && y >= this.def.minY && y < this.maxY
  }

  cellIndexAt(x: number, y: number): number {
    const cx = Math.floor((x - this.def.minX) / this.def.cellSize)
    const cy = Math.floor((y - this.def.minY) / this.def.cellSize)
    if (cx < 0 || cx >= this.def.cols || cy < 0 || cy >= this.def.rows) return -1
    return cy * this.def.cols + cx
  }

  isSolid(cell: number): boolean {
    return this.saturation[cell] >= this.def.capacityPerCell
  }

  absorb(cell: number): void {
    this.saturation[cell]++
  }

  cellBounds(cell: number): { minX: number; minY: number; maxX: number; maxY: number } {
    const cx = cell % this.def.cols
    const cy = Math.floor(cell / this.def.cols)
    const s = this.def.cellSize
    const minX = this.def.minX + cx * s
    const minY = this.def.minY + cy * s
    return { minX, minY, maxX: minX + s, maxY: minY + s }
  }
}
