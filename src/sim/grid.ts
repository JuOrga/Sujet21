// Grille spatiale uniforme (tri par comptage, zéro allocation dans build).

export class SpatialGrid {
  readonly cellSize: number
  readonly minX: number
  readonly minY: number
  readonly nx: number
  readonly ny: number

  private readonly cellOf: Int32Array
  private readonly starts: Int32Array // taille ncells + 1
  private readonly cursor: Int32Array
  private readonly entries: Int32Array
  private count = 0

  constructor(minX: number, minY: number, maxX: number, maxY: number, cellSize: number, capacity: number) {
    this.cellSize = cellSize
    this.minX = minX
    this.minY = minY
    this.nx = Math.max(1, Math.ceil((maxX - minX) / cellSize))
    this.ny = Math.max(1, Math.ceil((maxY - minY) / cellSize))
    const ncells = this.nx * this.ny
    this.cellOf = new Int32Array(capacity)
    this.starts = new Int32Array(ncells + 1)
    this.cursor = new Int32Array(ncells)
    this.entries = new Int32Array(capacity)
  }

  private cellIndex(x: number, y: number): number {
    let cx = Math.floor((x - this.minX) / this.cellSize)
    let cy = Math.floor((y - this.minY) / this.cellSize)
    if (cx < 0) cx = 0
    else if (cx >= this.nx) cx = this.nx - 1
    if (cy < 0) cy = 0
    else if (cy >= this.ny) cy = this.ny - 1
    return cy * this.nx + cx
  }

  build(posX: Float32Array, posY: Float32Array, count: number): void {
    this.count = count
    const ncells = this.nx * this.ny
    this.starts.fill(0)
    for (let i = 0; i < count; i++) {
      const c = this.cellIndex(posX[i], posY[i])
      this.cellOf[i] = c
      this.starts[c + 1]++
    }
    for (let c = 0; c < ncells; c++) {
      this.starts[c + 1] += this.starts[c]
      this.cursor[c] = this.starts[c]
    }
    for (let i = 0; i < count; i++) {
      const c = this.cellOf[i]
      this.entries[this.cursor[c]++] = i
    }
  }

  // Collecte sans callback (chemin chaud du solveur) : écrit dans `out` à
  // partir de `offset` les indices ≠ self à distance < radius, retourne le
  // curseur final. Zéro allocation, zéro appel de fonction par voisin.
  collect(
    posX: Float32Array,
    posY: Float32Array,
    x: number,
    y: number,
    radius: number,
    self: number,
    out: Int32Array,
    offset: number,
    max: number,
  ): number {
    if (this.count === 0) return offset
    const r2max = radius * radius
    // bornes inlinées : ce chemin est appelé une fois PAR PARTICULE et PAR
    // PAS — une fermeture allouée ici devient un torrent pour le GC
    const nx1 = this.nx - 1
    const ny1 = this.ny - 1
    let cx0 = Math.floor((x - radius - this.minX) / this.cellSize)
    let cy0 = Math.floor((y - radius - this.minY) / this.cellSize)
    let cx1 = Math.floor((x + radius - this.minX) / this.cellSize)
    let cy1 = Math.floor((y + radius - this.minY) / this.cellSize)
    if (cx0 < 0) cx0 = 0
    else if (cx0 > nx1) cx0 = nx1
    if (cy0 < 0) cy0 = 0
    else if (cy0 > ny1) cy0 = ny1
    if (cx1 < 0) cx1 = 0
    else if (cx1 > nx1) cx1 = nx1
    if (cy1 < 0) cy1 = 0
    else if (cy1 > ny1) cy1 = ny1
    let cursor = offset
    const cap = offset + max
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * this.nx + cx
        const end = this.starts[c + 1]
        for (let e = this.starts[c]; e < end; e++) {
          const j = this.entries[e]
          if (j === self || cursor >= cap) continue
          const dx = x - posX[j]
          const dy = y - posY[j]
          if (dx * dx + dy * dy < r2max) out[cursor++] = j
        }
      }
    }
    return cursor
  }

  forEachNeighbor(x: number, y: number, radius: number, cb: (j: number) => void): void {
    if (this.count === 0) return
    // Clamp complet des deux bornes (inliné, comme collect) : une requête
    // hors grille retombe sur les cellules de bord, où les particules hors
    // bornes sont rangées par build().
    const nx1 = this.nx - 1
    const ny1 = this.ny - 1
    let cx0 = Math.floor((x - radius - this.minX) / this.cellSize)
    let cy0 = Math.floor((y - radius - this.minY) / this.cellSize)
    let cx1 = Math.floor((x + radius - this.minX) / this.cellSize)
    let cy1 = Math.floor((y + radius - this.minY) / this.cellSize)
    if (cx0 < 0) cx0 = 0
    else if (cx0 > nx1) cx0 = nx1
    if (cy0 < 0) cy0 = 0
    else if (cy0 > ny1) cy0 = ny1
    if (cx1 < 0) cx1 = 0
    else if (cx1 > nx1) cx1 = nx1
    if (cy1 < 0) cy1 = 0
    else if (cy1 > ny1) cy1 = ny1
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * this.nx + cx
        const end = this.starts[c + 1]
        for (let e = this.starts[c]; e < end; e++) {
          cb(this.entries[e])
        }
      }
    }
  }
}
