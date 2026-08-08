// Solveur de fluide 2D « Position Based Fluids » (Macklin & Müller 2013).
//
// Choix structurants, dictés par le doc fonctionnel :
// - contrainte de densité en égalité (pas seulement anti-compression) : en
//   apesanteur, le déficit de densité en surface attire les particules vers
//   l'intérieur — c'est la tension de surface qui tient le corps (§2.3) ;
// - sCorr (correction tensile) empêche l'agglutination que cette égalité
//   provoquerait, et son intensité est le curseur de cohésion (décision n°1) ;
// - toutes les interactions internes sont antisymétriques par paires : la
//   quantité de mouvement est conservée exactement, l'éjection comprise (§3.3).

import type { SimParams } from './params'
import { SpatialGrid } from './grid'
import { makeKernels, computeRestDensity, type Kernels } from './kernels'
import { labelComponents } from './components'
import { boxContact, Sponge, type ClosestPoint } from './obstacles'
import { MAT_HYDROPHILE, MAT_HYDROPHOBE, type ObstacleBox, type SpongeDef } from '../game/level'

export const KIND_FREE = 0
export const KIND_PLAYER = 1

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface PlayerStats {
  count: number
  centroidX: number
  centroidY: number
  velX: number
  velY: number
  rmsRadius: number
}

export class FluidSim {
  readonly params: SimParams
  readonly bounds: Bounds
  readonly capacity: number
  count = 0

  posX: Float32Array
  posY: Float32Array
  prdX: Float32Array
  prdY: Float32Array
  velX: Float32Array
  velY: Float32Array
  lambda: Float32Array
  dpX: Float32Array
  dpY: Float32Array
  dvX: Float32Array
  dvY: Float32Array
  density: Float32Array
  kind: Uint8Array
  cooldown: Float32Array
  labels: Int32Array

  boxes: ObstacleBox[] = []
  sponges: Sponge[] = []
  contactTime: Float32Array // temps de contact continu avec l'éponge
  private contactMat: Int8Array // -1 aucun, sinon matériau du contact solide
  private contactNX: Float32Array
  private contactNY: Float32Array
  private contactVn: Float32Array // vitesse normale entrante avant résolution

  baseVolume = 0
  playerCount = 0
  dispersed = false
  stats: PlayerStats = { count: 0, centroidX: 0, centroidY: 0, velX: 0, velY: 0, rmsRadius: 1 }

  private grid: SpatialGrid
  private kernels: Kernels
  private restDensity: number
  private lastKernelRadius: number
  private lastSpacing: number
  private ejectCarry = 0
  private stepIndex = 0
  private readonly stack: Int32Array

  constructor(params: SimParams, bounds: Bounds, capacity = 4096) {
    this.params = params
    this.bounds = bounds
    this.capacity = capacity

    this.posX = new Float32Array(capacity)
    this.posY = new Float32Array(capacity)
    this.prdX = new Float32Array(capacity)
    this.prdY = new Float32Array(capacity)
    this.velX = new Float32Array(capacity)
    this.velY = new Float32Array(capacity)
    this.lambda = new Float32Array(capacity)
    this.dpX = new Float32Array(capacity)
    this.dpY = new Float32Array(capacity)
    this.dvX = new Float32Array(capacity)
    this.dvY = new Float32Array(capacity)
    this.density = new Float32Array(capacity)
    this.kind = new Uint8Array(capacity)
    this.cooldown = new Float32Array(capacity)
    this.labels = new Int32Array(capacity)
    this.stack = new Int32Array(capacity)
    this.contactTime = new Float32Array(capacity)
    this.contactMat = new Int8Array(capacity)
    this.contactNX = new Float32Array(capacity)
    this.contactNY = new Float32Array(capacity)
    this.contactVn = new Float32Array(capacity)

    this.lastKernelRadius = params.kernelRadius
    this.lastSpacing = params.particleSpacing
    this.kernels = makeKernels(params.kernelRadius)
    this.restDensity = computeRestDensity(params.kernelRadius, params.particleSpacing)
    this.grid = this.makeGrid()
  }

  private makeGrid(): SpatialGrid {
    const h = this.params.kernelRadius
    const margin = h * 4
    return new SpatialGrid(
      this.bounds.minX - margin,
      this.bounds.minY - margin,
      this.bounds.maxX + margin,
      this.bounds.maxY + margin,
      h,
      this.capacity,
    )
  }

  private refreshDerived(): void {
    const p = this.params
    if (p.kernelRadius !== this.lastKernelRadius || p.particleSpacing !== this.lastSpacing) {
      this.lastKernelRadius = p.kernelRadius
      this.lastSpacing = p.particleSpacing
      this.kernels = makeKernels(p.kernelRadius)
      this.restDensity = computeRestDensity(p.kernelRadius, p.particleSpacing)
      this.grid = this.makeGrid()
    }
  }

  setLevel(boxes: ObstacleBox[], sponges: SpongeDef[]): void {
    this.boxes = boxes
    this.sponges = sponges.map((d) => new Sponge(d))
  }

  // Retrait par échange avec la dernière particule (absorption éponge).
  removeParticle(i: number): void {
    if (this.kind[i] === KIND_PLAYER) this.playerCount--
    const last = this.count - 1
    if (i !== last) {
      this.posX[i] = this.posX[last]
      this.posY[i] = this.posY[last]
      this.prdX[i] = this.prdX[last]
      this.prdY[i] = this.prdY[last]
      this.velX[i] = this.velX[last]
      this.velY[i] = this.velY[last]
      this.kind[i] = this.kind[last]
      this.cooldown[i] = this.cooldown[last]
      this.contactTime[i] = this.contactTime[last]
    }
    this.count = last
  }

  addParticle(x: number, y: number, kind: number): number {
    if (this.count >= this.capacity) return -1
    const i = this.count++
    this.posX[i] = x
    this.posY[i] = y
    this.velX[i] = 0
    this.velY[i] = 0
    this.kind[i] = kind
    this.cooldown[i] = 0
    this.contactTime[i] = 0
    if (kind === KIND_PLAYER) this.playerCount++
    return i
  }

  // Disque de n particules sur réseau hexagonal, centré en (cx, cy).
  spawnDisc(cx: number, cy: number, n: number, kind: number): void {
    const s = this.params.particleSpacing
    const rowH = s * Math.sqrt(3) * 0.5
    const extent = Math.ceil(Math.sqrt(n)) + 2
    const pts: { x: number; y: number; d2: number }[] = []
    for (let row = -extent; row <= extent; row++) {
      const y = row * rowH
      const xOffset = (row & 1) !== 0 ? s * 0.5 : 0
      for (let col = -extent; col <= extent; col++) {
        const x = col * s + xOffset
        pts.push({ x, y, d2: x * x + y * y })
      }
    }
    pts.sort((a, b) => a.d2 - b.d2)
    for (let i = 0; i < n && i < pts.length; i++) {
      this.addParticle(cx + pts[i].x, cy + pts[i].y, kind)
    }
    if (kind === KIND_PLAYER) this.baseVolume += n
    this.updatePlayerStats()
  }

  // Le verbe unique (§3.3) : la matière part vers le point visé, le corps part
  // à l'opposé. Conservation exacte : la réaction est répartie uniformément
  // sur les particules restantes du corps.
  eject(aimX: number, aimY: number, dt: number): void {
    if (this.dispersed) return
    const p = this.params
    this.ejectCarry += p.ejectRate * dt
    while (this.ejectCarry >= 1) {
      this.ejectCarry -= 1
      if (this.playerCount <= 1) {
        this.dispersed = true
        return
      }
      let best = -1
      let bestD2 = Infinity
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] !== KIND_PLAYER) continue
        const dx = this.posX[i] - aimX
        const dy = this.posY[i] - aimY
        const d2 = dx * dx + dy * dy
        if (d2 < bestD2) {
          bestD2 = d2
          best = i
        }
      }
      if (best < 0) return

      let dirX = aimX - this.posX[best]
      let dirY = aimY - this.posY[best]
      let len = Math.hypot(dirX, dirY)
      if (len < 1e-6) {
        dirX = aimX - this.stats.centroidX
        dirY = aimY - this.stats.centroidY
        len = Math.hypot(dirX, dirY)
        if (len < 1e-6) {
          dirX = 1
          dirY = 0
          len = 1
        }
      }
      dirX /= len
      dirY /= len

      const newVx = this.stats.velX + dirX * p.ejectSpeed
      const newVy = this.stats.velY + dirY * p.ejectSpeed
      const dvx = newVx - this.velX[best]
      const dvy = newVy - this.velY[best]
      this.velX[best] = newVx
      this.velY[best] = newVy
      // La gouttelette décolle hors de la couche de surface : sans ce
      // décalage, elle traverse ses voisines à pleine vitesse au pas suivant
      // et la projection PBF injecte de l'énergie dans le corps.
      this.posX[best] += dirX * p.kernelRadius * 0.8
      this.posY[best] += dirY * p.kernelRadius * 0.8
      this.kind[best] = KIND_FREE
      this.cooldown[best] = p.reabsorbCooldown
      this.playerCount--

      const rx = -dvx / this.playerCount
      const ry = -dvy / this.playerCount
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] === KIND_PLAYER) {
          this.velX[i] += rx
          this.velY[i] += ry
        }
      }
    }
  }

  step(dt: number): void {
    this.refreshDerived()
    const p = this.params
    const n = this.count
    if (n === 0) return

    const { posX, posY, prdX, prdY, velX, velY, lambda, dpX, dpY, dvX, dvY, density } = this
    const k = this.kernels
    const h = k.h
    const h2 = k.h2
    const rho0 = this.restDensity
    const invRho0 = 1 / rho0
    const grid = this.grid

    // 1. Prédiction (apesanteur : pas de force externe)
    for (let i = 0; i < n; i++) {
      prdX[i] = posX[i] + velX[i] * dt
      prdY[i] = posY[i] + velY[i] * dt
    }

    // sCorr de référence : W(dq · h)
    const dq = p.sCorrDq * h
    const wDq = k.w(dq * dq)
    const invWDq = wDq > 0 ? 1 / wDq : 0

    // 2. Itérations de contrainte de densité
    for (let iter = 0; iter < p.solverIterations; iter++) {
      grid.build(prdX, prdY, n)

      for (let i = 0; i < n; i++) {
        const xi = prdX[i]
        const yi = prdY[i]
        let rho = 0
        let sumGradX = 0
        let sumGradY = 0
        let sumGrad2 = 0
        grid.forEachNeighbor(xi, yi, h, (j) => {
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          const r2 = dx * dx + dy * dy
          if (r2 >= h2) return
          const t = h2 - r2
          rho += k.poly6Coeff * t * t * t
          if (j === i) return
          const r = Math.sqrt(r2)
          if (r < 1e-6) return
          const tg = h - r
          const c = (k.spikyGradCoeff * tg * tg) / r
          const gx = c * dx * invRho0
          const gy = c * dy * invRho0
          sumGradX += gx
          sumGradY += gy
          sumGrad2 += gx * gx + gy * gy
        })
        density[i] = rho
        const C = rho * invRho0 - 1
        const denom = sumGrad2 + sumGradX * sumGradX + sumGradY * sumGradY + p.epsilonLambda
        lambda[i] = -C / denom
      }

      // Plafond de correction PAR PAIRE : le terme est exactement opposé pour
      // i et j, le plafonner préserve la conservation de la quantité de
      // mouvement tout en bornant les projections catastrophiques quand une
      // particule rapide frôle une voisine (r → 0 ⇒ correction → ∞).
      const maxPairDp = p.maxDeltaPFactor * h
      const maxPairDp2 = maxPairDp * maxPairDp
      for (let i = 0; i < n; i++) {
        const xi = prdX[i]
        const yi = prdY[i]
        const li = lambda[i]
        let dx0 = 0
        let dy0 = 0
        grid.forEachNeighbor(xi, yi, h, (j) => {
          if (j === i) return
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          const r2 = dx * dx + dy * dy
          if (r2 >= h2) return
          const r = Math.sqrt(r2)
          if (r < 1e-6) return
          const t = h2 - r2
          const w = k.poly6Coeff * t * t * t
          const ratio = w * invWDq
          const sCorr = -p.sCorrK * Math.pow(ratio, p.sCorrN)
          const tg = h - r
          const c = (k.spikyGradCoeff * tg * tg) / r
          const scale = (li + lambda[j] + sCorr) * invRho0
          let px = scale * c * dx
          let py = scale * c * dy
          const m2 = px * px + py * py
          if (m2 > maxPairDp2) {
            const s = maxPairDp / Math.sqrt(m2)
            px *= s
            py *= s
          }
          dx0 += px
          dy0 += py
        })
        dpX[i] = dx0
        dpY[i] = dy0
      }

      for (let i = 0; i < n; i++) {
        prdX[i] += dpX[i]
        prdY[i] += dpY[i]
      }
    }

    // 3. Obstacles solides (parois, cellules d'éponge saturées)
    this.resolveObstacles(dt)

    // 3bis. Bords du monde
    const b = this.bounds
    const inset = p.particleSpacing * 0.5
    for (let i = 0; i < n; i++) {
      if (prdX[i] < b.minX + inset) prdX[i] = b.minX + inset
      else if (prdX[i] > b.maxX - inset) prdX[i] = b.maxX - inset
      if (prdY[i] < b.minY + inset) prdY[i] = b.minY + inset
      else if (prdY[i] > b.maxY - inset) prdY[i] = b.maxY - inset
    }

    // 4. Vitesses puis viscosité XSPH (antisymétrique : conserve la quantité
    //    de mouvement)
    const invDt = 1 / dt
    const maxV = p.maxSpeed
    const maxV2 = maxV * maxV
    for (let i = 0; i < n; i++) {
      let vx = (prdX[i] - posX[i]) * invDt
      let vy = (prdY[i] - posY[i]) * invDt
      const v2 = vx * vx + vy * vy
      if (v2 > maxV2) {
        const s = maxV / Math.sqrt(v2)
        vx *= s
        vy *= s
      }
      velX[i] = vx
      velY[i] = vy
    }

    // 4bis. Réponses matériaux : rebond hydrophobe, adhérence hydrophile,
    // bandes d'influence (§6)
    this.applyMaterialVelocities(dt)

    if (p.xsphC > 0) {
      grid.build(prdX, prdY, n)
      for (let i = 0; i < n; i++) {
        const xi = prdX[i]
        const yi = prdY[i]
        const vxi = velX[i]
        const vyi = velY[i]
        let ax = 0
        let ay = 0
        grid.forEachNeighbor(xi, yi, h, (j) => {
          if (j === i) return
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          const r2 = dx * dx + dy * dy
          if (r2 >= h2) return
          const t = h2 - r2
          const w = k.poly6Coeff * t * t * t
          ax += (velX[j] - vxi) * w
          ay += (velY[j] - vyi) * w
        })
        dvX[i] = ax * p.xsphC * invRho0
        dvY[i] = ay * p.xsphC * invRho0
      }
      for (let i = 0; i < n; i++) {
        velX[i] += dvX[i]
        velY[i] += dvY[i]
      }
    }

    // 5. Validation des positions, cooldowns, identité du corps
    for (let i = 0; i < n; i++) {
      posX[i] = prdX[i]
      posY[i] = prdY[i]
      if (this.cooldown[i] > 0) this.cooldown[i] -= dt
    }

    // 5bis. Éponge : traînée, temps de contact, absorption (§6)
    if (this.sponges.length > 0) this.processSponges(dt)

    this.stepIndex++
    if (this.stepIndex % Math.max(1, Math.round(p.componentEvery)) === 0) {
      this.relabel()
    }
  }

  private readonly scratchCP: ClosestPoint = { dist: 0, nx: 0, ny: 0 }

  // Pousse les particules hors des solides et enregistre le contact (normale,
  // vitesse normale entrante, matériau) pour la réponse en vitesse.
  private resolveObstacles(dt: number): void {
    const n = this.count
    const p = this.params
    const rp = p.particleSpacing * 0.5
    const invDt = 1 / dt
    const cp = this.scratchCP
    this.contactMat.fill(-1, 0, n)
    if (this.boxes.length === 0 && this.sponges.length === 0) return

    for (let i = 0; i < n; i++) {
      let x = this.prdX[i]
      let y = this.prdY[i]

      for (const b of this.boxes) {
        if (x < b.minX - rp || x > b.maxX + rp || y < b.minY - rp || y > b.maxY + rp) {
          continue
        }
        boxContact(x, y, b, cp)
        const sep = cp.dist - rp
        if (sep < 0) {
          const vn = ((x - this.posX[i]) * cp.nx + (y - this.posY[i]) * cp.ny) * invDt
          x -= cp.nx * sep
          y -= cp.ny * sep
          this.contactMat[i] = b.material
          this.contactNX[i] = cp.nx
          this.contactNY[i] = cp.ny
          this.contactVn[i] = vn
        }
      }

      // Cellules d'éponge saturées : des murs. La particule peut chevaucher
      // jusqu'à 4 cellules — on les résout toutes.
      for (const sp of this.sponges) {
        const d = sp.def
        if (x < d.minX - rp || x >= sp.maxX + rp || y < d.minY - rp || y >= sp.maxY + rp) continue
        const cx0 = Math.max(0, Math.floor((x - rp - d.minX) / d.cellSize))
        const cy0 = Math.max(0, Math.floor((y - rp - d.minY) / d.cellSize))
        const cx1 = Math.min(d.cols - 1, Math.floor((x + rp - d.minX) / d.cellSize))
        const cy1 = Math.min(d.rows - 1, Math.floor((y + rp - d.minY) / d.cellSize))
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const cell = cy * d.cols + cx
            if (!sp.isSolid(cell)) continue
            const cb = sp.cellBounds(cell)
            boxContact(x, y, cb, cp)
            const sep = cp.dist - rp
            if (sep < 0) {
              x -= cp.nx * sep
              y -= cp.ny * sep
              this.contactMat[i] = 0 // comportement mur neutre
              this.contactNX[i] = cp.nx
              this.contactNY[i] = cp.ny
              this.contactVn[i] = 0
            }
          }
        }
      }

      this.prdX[i] = x
      this.prdY[i] = y
    }
  }

  // Rebond hydrophobe, adhérence hydrophile, et bandes d'influence sans
  // contact : la répulsion dévie les trajectoires, l'adhésion aspire vers la
  // surface (§6).
  private applyMaterialVelocities(dt: number): void {
    if (this.boxes.length === 0) return
    const n = this.count
    const p = this.params
    const rp = p.particleSpacing * 0.5
    const cp = this.scratchCP
    const band = p.hydroBand
    const philDamp = Math.exp(-p.hydrophileFriction * dt)

    for (let i = 0; i < n; i++) {
      const mat = this.contactMat[i]
      if (mat === MAT_HYDROPHOBE) {
        const vnIn = this.contactVn[i]
        if (vnIn < 0) {
          const nx = this.contactNX[i]
          const ny = this.contactNY[i]
          const vn = this.velX[i] * nx + this.velY[i] * ny
          const target = -vnIn * p.hydrophobeRestitution
          this.velX[i] += (target - vn) * nx
          this.velY[i] += (target - vn) * ny
        }
      } else if (mat === MAT_HYDROPHILE) {
        const nx = this.contactNX[i]
        const ny = this.contactNY[i]
        let vn = this.velX[i] * nx + this.velY[i] * ny
        let vtx = this.velX[i] - vn * nx
        let vty = this.velY[i] - vn * ny
        vtx *= philDamp
        vty *= philDamp
        if (vn > 0) vn *= 0.25 // décoller se paie
        this.velX[i] = vtx + vn * nx
        this.velY[i] = vty + vn * ny
      }

      const x = this.prdX[i]
      const y = this.prdY[i]
      for (const b of this.boxes) {
        if (b.material !== MAT_HYDROPHILE && b.material !== MAT_HYDROPHOBE) continue
        if (
          x < b.minX - band - rp ||
          x > b.maxX + band + rp ||
          y < b.minY - band - rp ||
          y > b.maxY + band + rp
        ) {
          continue
        }
        boxContact(x, y, b, cp)
        const sep = cp.dist - rp
        if (sep > 0 && sep < band) {
          const f = 1 - sep / band
          const a = (b.material === MAT_HYDROPHILE ? -p.hydrophilePull : p.hydrophobeRepel) * f * dt
          this.velX[i] += cp.nx * a
          this.velY[i] += cp.ny * a
        }
      }
    }
  }

  // Le contact éponge n'est pas mortel : il englue et absorbe après un temps
  // de contact continu. Chaque cellule se sature ; gorgée, elle devient
  // solide — on peut payer un passage en volume (§6).
  private processSponges(dt: number): void {
    const p = this.params
    const drag = Math.exp(-p.spongeDrag * dt)
    let i = 0
    while (i < this.count) {
      let touching = false
      let removed = false
      const x = this.posX[i]
      const y = this.posY[i]
      for (const sp of this.sponges) {
        if (!sp.contains(x, y)) continue
        const cell = sp.cellIndexAt(x, y)
        if (cell < 0 || sp.isSolid(cell)) continue
        touching = true
        this.velX[i] *= drag
        this.velY[i] *= drag
        this.contactTime[i] += dt
        if (this.contactTime[i] >= p.spongeAbsorbTime) {
          sp.absorb(cell)
          this.removeParticle(i)
          removed = true
        }
        break
      }
      if (removed) continue // l'indice i contient maintenant une autre particule
      if (!touching) this.contactTime[i] = 0
      i++
    }
  }

  // Le corps du joueur est la composante connexe qui recouvre le mieux le
  // corps précédent. Deux masses d'eau qui se touchent fusionnent — ce n'est
  // pas une règle, c'est la connexité (§3.1). Une gouttelette détachée est
  // perdue. Les particules fraîchement éjectées (cooldown > 0) ne sont pas
  // réabsorbées immédiatement.
  relabel(): void {
    const n = this.count
    if (n === 0) return
    const p = this.params
    const linkR = p.linkRadiusFactor * p.kernelRadius
    const linkR2 = linkR * linkR
    const { posX, posY, labels } = this
    const grid = this.grid
    grid.build(posX, posY, n)

    const forEachNeighbor = (i: number, cb: (j: number) => void) => {
      const xi = posX[i]
      const yi = posY[i]
      grid.forEachNeighbor(xi, yi, linkR, (j) => {
        if (j === i) return
        const dx = xi - posX[j]
        const dy = yi - posY[j]
        if (dx * dx + dy * dy <= linkR2) cb(j)
      })
    }
    const componentCount = labelComponents(n, labels, forEachNeighbor, this.stack)

    // Composante contenant le plus de particules de l'ancien corps
    const playerPerLabel = new Int32Array(componentCount)
    for (let i = 0; i < n; i++) {
      if (this.kind[i] === KIND_PLAYER) playerPerLabel[labels[i]]++
    }
    let playerLabel = -1
    let bestCount = 0
    for (let c = 0; c < componentCount; c++) {
      if (playerPerLabel[c] > bestCount) {
        bestCount = playerPerLabel[c]
        playerLabel = c
      }
    }
    if (playerLabel < 0) {
      this.playerCount = 0
      this.dispersed = true
      return
    }

    let count = 0
    for (let i = 0; i < n; i++) {
      if (labels[i] === playerLabel && this.cooldown[i] <= 0) {
        this.kind[i] = KIND_PLAYER
        count++
      } else {
        this.kind[i] = KIND_FREE
      }
    }
    this.playerCount = count
    this.updatePlayerStats()

    if (this.baseVolume > 0 && count < this.baseVolume * p.criticalVolumeFraction) {
      this.dispersed = true
    }
    if (count < 2) this.dispersed = true
  }

  updatePlayerStats(): void {
    const n = this.count
    let cx = 0
    let cy = 0
    let vx = 0
    let vy = 0
    let m = 0
    for (let i = 0; i < n; i++) {
      if (this.kind[i] !== KIND_PLAYER) continue
      cx += this.posX[i]
      cy += this.posY[i]
      vx += this.velX[i]
      vy += this.velY[i]
      m++
    }
    if (m === 0) return
    cx /= m
    cy /= m
    vx /= m
    vy /= m
    let r2sum = 0
    for (let i = 0; i < n; i++) {
      if (this.kind[i] !== KIND_PLAYER) continue
      const dx = this.posX[i] - cx
      const dy = this.posY[i] - cy
      r2sum += dx * dx + dy * dy
    }
    this.stats.count = m
    this.stats.centroidX = cx
    this.stats.centroidY = cy
    this.stats.velX = vx
    this.stats.velY = vy
    this.stats.rmsRadius = Math.sqrt(r2sum / m)
  }

  totalMomentum(): { px: number; py: number } {
    let px = 0
    let py = 0
    for (let i = 0; i < this.count; i++) {
      px += this.velX[i]
      py += this.velY[i]
    }
    return { px, py }
  }

  liters(): number {
    return this.playerCount * this.params.litersPerParticle
  }
}
