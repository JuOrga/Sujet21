// Enveloppe des noyaux WASM (asm/noyaux.ts → public/noyaux.wasm). Le
// solveur y copie ses tampons d'entrée, appelle les noyaux, et relit les
// sorties — ~50 Ko d'aller-retour par pas, négligeable devant le calcul.
// Si le module ne charge pas (hors ligne, navigateur sans WASM), le jeu
// reste sur le moteur JavaScript : le WASM est une accélération, jamais
// une dépendance.

interface ExportsNoyaux {
  memory: WebAssembly.Memory
  init(capacity: number, maxCells: number): void
  ptrPrdX(): number
  ptrPrdY(): number
  ptrVelX(): number
  ptrVelY(): number
  ptrGas(): number
  ptrFro(): number
  ptrDensity(): number
  buildGrid(n: number, minX: number, minY: number, cellSize: number, nx: number, ny: number): void
  collectAll(
    n: number,
    radius: number,
    minX: number,
    minY: number,
    cellSize: number,
    nx: number,
    ny: number,
  ): void
  densityIterations(
    n: number,
    iters: number,
    h: number,
    h2: number,
    poly6: number,
    spikyGrad: number,
    selfRho: number,
    invRho0: number,
    epsLambda: number,
    sCorrK: number,
    sCorrN: number,
    sCorrNInt: number,
    invWDq: number,
    maxPairDp: number,
  ): void
  xsph(n: number, h2: number, poly6: number, xsphC: number, invRho0: number): void
}

export class NoyauxWasm {
  private readonly ex: ExportsNoyaux
  private capacity = 0
  private maxCells = 0
  // vues sur la mémoire wasm — recréées à chaque (ré)init : memory.grow
  // détache les anciennes
  prdX!: Float32Array
  prdY!: Float32Array
  velX!: Float32Array
  velY!: Float32Array
  gas!: Uint8Array
  fro!: Uint8Array
  density!: Float32Array

  private constructor(ex: ExportsNoyaux) {
    this.ex = ex
  }

  static async charge(source: BufferSource): Promise<NoyauxWasm> {
    const { instance } = await WebAssembly.instantiate(source, {
      env: {
        abort(): void {
          throw new Error('noyaux wasm : abort')
        },
      },
    })
    return new NoyauxWasm(instance.exports as unknown as ExportsNoyaux)
  }

  /** Garantit des tampons pour `capacity` particules et `maxCells` cellules. */
  assure(capacity: number, maxCells: number): void {
    if (capacity <= this.capacity && maxCells <= this.maxCells) return
    this.capacity = Math.max(capacity, this.capacity)
    this.maxCells = Math.max(maxCells, this.maxCells)
    this.ex.init(this.capacity, this.maxCells)
    const mem = this.ex.memory.buffer
    this.prdX = new Float32Array(mem, this.ex.ptrPrdX(), this.capacity)
    this.prdY = new Float32Array(mem, this.ex.ptrPrdY(), this.capacity)
    this.velX = new Float32Array(mem, this.ex.ptrVelX(), this.capacity)
    this.velY = new Float32Array(mem, this.ex.ptrVelY(), this.capacity)
    this.gas = new Uint8Array(mem, this.ex.ptrGas(), this.capacity)
    this.fro = new Uint8Array(mem, this.ex.ptrFro(), this.capacity)
    this.density = new Float32Array(mem, this.ex.ptrDensity(), this.capacity)
  }

  buildGrid(n: number, minX: number, minY: number, cellSize: number, nx: number, ny: number): void {
    this.ex.buildGrid(n, minX, minY, cellSize, nx, ny)
  }

  collectAll(
    n: number,
    radius: number,
    minX: number,
    minY: number,
    cellSize: number,
    nx: number,
    ny: number,
  ): void {
    this.ex.collectAll(n, radius, minX, minY, cellSize, nx, ny)
  }

  densityIterations(
    n: number,
    iters: number,
    h: number,
    h2: number,
    poly6: number,
    spikyGrad: number,
    selfRho: number,
    invRho0: number,
    epsLambda: number,
    sCorrK: number,
    sCorrN: number,
    sCorrNInt: number,
    invWDq: number,
    maxPairDp: number,
  ): void {
    this.ex.densityIterations(
      n,
      iters,
      h,
      h2,
      poly6,
      spikyGrad,
      selfRho,
      invRho0,
      epsLambda,
      sCorrK,
      sCorrN,
      sCorrNInt,
      invWDq,
      maxPairDp,
    )
  }

  xsph(n: number, h2: number, poly6: number, xsphC: number, invRho0: number): void {
    this.ex.xsph(n, h2, poly6, xsphC, invRho0)
  }
}
