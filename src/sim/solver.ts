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
import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
  type ObstacleBox,
  type SpongeDef,
} from '../game/level'

export const KIND_FREE = 0
export const KIND_PLAYER = 1

// Voisins retenus par particule et par pas (au-delà : ignorés — les zones
// aussi denses sont déjà sur-contraintes)
const MAX_NEIGHBORS = 48

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
  // Glace (§6) : givre 0 → 1, puis gel. Un amas gelé est un bloc RIGIDE et
  // BALISTIQUE : il garde son élan (vitesse commune à l'amas), pousse le
  // liquide (masse infinie), rebondit sur les parois au lieu d'éclabousser,
  // et ignore la chimie des surfaces. La glace prise au contact d'une plaque
  // froide s'y soude (vitesse nulle) : c'est l'ancrage. Le dégel rend l'eau
  // au corps, dans le mouvement où la glace se trouvait.
  frost: Float32Array
  frozen: Uint8Array
  // Vapeur (§6, tableau 3) : hors du solveur de densité (elle ne presse pas
  // et n'est pas pressée), elle s'étale par répulsion douce, flotte, passe
  // les grilles, et se PILOTE en continu vers le pointeur — au prix d'une
  // évaporation. Le froid la condense avant de gérer quoi que ce soit d'autre.
  vapor: Float32Array
  gaseous: Uint8Array
  // Mémoire de lien du gaz : à 1 tant que la particule est gazeuse, décroît
  // lentement après (gasLinkDecay). Le rayon d'adjacence des amas et le
  // rappel de condensation la suivent : un nuage qui redevient eau reste UN
  // corps le temps de se regrouper — changer d'état ne disperse pas.
  gasLink: Float32Array
  // Gel volontaire (touche F) / vapeur volontaire (touche G)
  freezeIntent = false
  gasIntent = false
  // Refroidissement du vaisseau (§5), fixé par le jeu : 0 = tiède, 1 = glacial.
  // Étend les auras froides, durcit gel et dégel, affaiblit les radiateurs.
  chill = 0
  private gasCarry = 0
  // Vitesse normale du dernier choc de bloc de glace (consommé par l'audio)
  iceImpact = 0
  private readonly welded: Uint8Array // gelée au contact d'une plaque : soudée
  private readonly iceVxSum: Float32Array
  private readonly iceVySum: Float32Array
  private readonly iceCnt: Int32Array
  private readonly iceNxSum: Float32Array
  private readonly iceNySum: Float32Array
  private readonly iceWeld: Uint8Array

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
  // Eau avalée par le sas : retirée de la simulation, mise en bonbonne à la
  // sortie. Le sas boit — cette eau n'est pas perdue.
  swallowed = 0
  private mouthX = 0
  private mouthY = 0
  private drainOn = false
  stats: PlayerStats = { count: 0, centroidX: 0, centroidY: 0, velX: 0, velY: 0, rmsRadius: 1 }

  private grid: SpatialGrid
  private kernels: Kernels
  private restDensity: number
  private lastKernelRadius: number
  private lastSpacing: number
  private ejectCarry = 0
  private stepIndex = 0
  private readonly stack: Int32Array
  // Voisinages en listes plates, construits une fois par pas et réutilisés
  // par toutes les itérations (et la viscosité) : les corrections par
  // itération sont bornées à une fraction de h, le voisinage ne bouge pas
  // significativement au sein d'un pas.
  private readonly nbStart: Int32Array
  private readonly nbList: Int32Array
  // Données de paires calculées par la passe lambda et réutilisées telles
  // quelles par la passe de déplacement (les positions ne bougent qu'après) :
  // évite de refaire distances et noyaux deux fois par itération.
  private readonly pairDx: Float32Array
  private readonly pairDy: Float32Array
  private readonly pairW: Float32Array
  private readonly pairC: Float32Array

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
    this.frost = new Float32Array(capacity)
    this.frozen = new Uint8Array(capacity)
    this.vapor = new Float32Array(capacity)
    this.gasLink = new Float32Array(capacity)
    this.gaseous = new Uint8Array(capacity)
    this.welded = new Uint8Array(capacity)
    this.iceVxSum = new Float32Array(capacity)
    this.iceVySum = new Float32Array(capacity)
    this.iceCnt = new Int32Array(capacity)
    this.iceNxSum = new Float32Array(capacity)
    this.iceNySum = new Float32Array(capacity)
    this.iceWeld = new Uint8Array(capacity)
    this.stack = new Int32Array(capacity)
    this.nbStart = new Int32Array(capacity + 1)
    this.nbList = new Int32Array(capacity * MAX_NEIGHBORS)
    this.pairDx = new Float32Array(capacity * MAX_NEIGHBORS)
    this.pairDy = new Float32Array(capacity * MAX_NEIGHBORS)
    this.pairW = new Float32Array(capacity * MAX_NEIGHBORS)
    this.pairC = new Float32Array(capacity * MAX_NEIGHBORS)
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

  private hasCold = false
  private hasHeat = false
  private hasGrille = false
  private heatCarry = 0
  private gasIdleCarry = 0
  private grilleCarry = 0
  // Règle de transformation : la dispersion se constate, elle ne se décrète
  // pas — il faut rester sous le seuil critique dispersalGrace secondes
  // d'affilée, le temps qu'un corps qui condense ou dégèle se regroupe.
  private belowCritical = false
  private criticalTimer = 0

  setLevel(boxes: ObstacleBox[], sponges: SpongeDef[]): void {
    this.boxes = boxes
    this.sponges = sponges.map((d) => new Sponge(d))
    this.hasCold = boxes.some((b) => b.material === MAT_FROID)
    this.hasHeat = boxes.some((b) => b.material === MAT_CHAUD)
    this.hasGrille = boxes.some((b) => b.material === MAT_GRILLE)
  }

  // Exposition à la chaleur en (x, y) : 1 au contact d'un radiateur, 0 au
  // bord de l'aura. Même géométrie que l'aura de gel des plaques froides.
  private heatExposureAt(x: number, y: number): number {
    if (!this.hasHeat) return 0
    // le vaisseau refroidit : l'aura des radiateurs se rétracte
    const band = this.params.heatBand * (1 - this.params.chillHeatFade * this.chill)
    if (band <= 1) return 0
    const rp = this.params.particleSpacing * 0.5
    const cp = this.scratchCP
    let heat = 0
    for (const b of this.boxes) {
      if (b.material !== MAT_CHAUD) continue
      if (
        x < b.minX - band - rp ||
        x > b.maxX + band + rp ||
        y < b.minY - band - rp ||
        y > b.maxY + band + rp
      ) {
        continue
      }
      boxContact(x, y, b, cp)
      const f = 1 - Math.max(0, cp.dist - rp) / band
      if (f > heat) heat = Math.min(1, f)
    }
    return heat
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
      this.frost[i] = this.frost[last]
      this.frozen[i] = this.frozen[last]
      this.vapor[i] = this.vapor[last]
      this.gaseous[i] = this.gaseous[last]
      this.gasLink[i] = this.gasLink[last]
      this.welded[i] = this.welded[last]
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
    this.frost[i] = 0
    this.frozen[i] = 0
    this.vapor[i] = 0
    this.gaseous[i] = 0
    this.gasLink[i] = 0
    this.welded[i] = 0
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
        if (this.kind[i] !== KIND_PLAYER || this.frozen[i] === 1 || this.gaseous[i] === 1) continue
        const dx = this.posX[i] - aimX
        const dy = this.posY[i] - aimY
        const d2 = dx * dx + dy * dy
        if (d2 < bestD2) {
          bestD2 = d2
          best = i
        }
      }
      if (best < 0) return // tout le corps est gelé : temps mort, rien à éjecter

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

      const departX = this.posX[best]
      const departY = this.posY[best]
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

      // Entraînement du voisinage : le liquide voisin CONVERGE vers le point
      // d'émission (radialement, comme l'entonnoir qui alimente une buse) —
      // le corps se creuse sans recevoir de poussée dans le sens du jet.
      // Pousser les voisines dans la direction de l'éjection annulerait
      // localement le recul : la déformation de propulsion disparaîtrait.
      let entrainX = 0
      let entrainY = 0
      if (p.ejectEntrain > 0 && this.playerCount > 0) {
        const R = p.kernelRadius * 1.8
        const R2 = R * R
        for (let i = 0; i < this.count; i++) {
          if (this.kind[i] !== KIND_PLAYER || this.frozen[i] === 1 || this.gaseous[i] === 1) continue
          const dx = departX - this.posX[i]
          const dy = departY - this.posY[i]
          const d2 = dx * dx + dy * dy
          if (d2 >= R2 || d2 < 1e-6) continue
          const d = Math.sqrt(d2)
          const w = 1 - d / R
          const a = (p.ejectSpeed * p.ejectEntrain * w) / d
          const ax = dx * a
          const ay = dy * a
          this.velX[i] += ax
          this.velY[i] += ay
          entrainX += ax
          entrainY += ay
        }
      }

      // Réaction : conservation exacte, entraînement compris. Le recul est
      // pondéré vers le point d'éjection (recoilLocality) — à 0 il est
      // uniforme et le corps part d'un bloc comme un solide ; à 1 il est
      // concentré à l'émission et se propage par pression : le côté éjection
      // s'écrase d'abord, le corps se déforme en accélérant.
      const locality = Math.min(1, Math.max(0, p.recoilLocality))
      const localR = p.kernelRadius * 3
      let wSum = 0
      let liquid = 0
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] !== KIND_PLAYER || this.frozen[i] === 1 || this.gaseous[i] === 1) continue
        liquid++
        let w = 1 - locality
        const dx = this.posX[i] - departX
        const dy = this.posY[i] - departY
        const d = Math.hypot(dx, dy)
        if (d < localR) w += locality * (1 - d / localR)
        this.dvX[i] = w // scratch : poids de recul (dvX est libre hors step)
        wSum += w
      }
      if (wSum < 1e-6) {
        if (liquid === 0) continue // le reste du corps est gelé : la glace encaisse le recul
        // corps entier hors du rayon local (improbable) : repli uniforme
        wSum = liquid
        for (let i = 0; i < this.count; i++) {
          if (this.kind[i] === KIND_PLAYER && this.frozen[i] === 0 && this.gaseous[i] === 0) {
            this.dvX[i] = 1
          }
        }
      }
      const rx = -(dvx + entrainX) / wSum
      const ry = -(dvy + entrainY) / wSum
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] === KIND_PLAYER && this.frozen[i] === 0 && this.gaseous[i] === 0) {
          this.velX[i] += rx * this.dvX[i]
          this.velY[i] += ry * this.dvX[i]
        }
      }
    }
  }

  // Se déplacer en gaz (§ tableau 3) : le nuage est piloté en continu vers le
  // point visé — pas d'éjection, pas de recul, une dérive douce. Le prix est
  // l'évaporation : tant qu'on pilote, la traîne du nuage se perd (les
  // particules les plus éloignées de la visée disparaissent, gasLossRate/s).
  applyGasSteer(aimX: number, aimY: number, dt: number): void {
    if (this.dispersed) return
    const p = this.params
    const cap2 = p.gasMaxSpeed * p.gasMaxSpeed
    let any = false
    for (let i = 0; i < this.count; i++) {
      if (this.kind[i] !== KIND_PLAYER || this.gaseous[i] !== 1) continue
      any = true
      let dx = aimX - this.posX[i]
      let dy = aimY - this.posY[i]
      const d = Math.hypot(dx, dy)
      if (d < 1e-3) continue
      dx /= d
      dy /= d
      this.velX[i] += dx * p.gasThrust * dt
      this.velY[i] += dy * p.gasThrust * dt
      const v2 = this.velX[i] * this.velX[i] + this.velY[i] * this.velY[i]
      if (v2 > cap2) {
        const s = p.gasMaxSpeed / Math.sqrt(v2)
        this.velX[i] *= s
        this.velY[i] *= s
      }
    }
    if (!any) return
    this.gasCarry += p.gasLossRate * dt
    while (this.gasCarry >= 1 && this.playerCount > 2) {
      this.gasCarry -= 1
      let worst = -1
      let worstD2 = -1
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] !== KIND_PLAYER || this.gaseous[i] !== 1) continue
        const dx = this.posX[i] - aimX
        const dy = this.posY[i] - aimY
        const d2 = dx * dx + dy * dy
        if (d2 > worstD2) {
          worstD2 = d2
          worst = i
        }
      }
      if (worst < 0) break
      this.removeParticle(worst) // évaporée : perdue, pas mise en bonbonne
    }
  }

  // Vortex de regroupement (clic droit) : l'eau est entraînée vers un champ
  // de courant en spirale rentrante. Un champ de vitesses cible (plutôt que
  // des forces) garantit la convergence : une force tourbillonnaire pure
  // ferait orbiter les gouttes jusqu'à les éjecter du rayon d'action.
  // La rotation rallonge la spirale : plus de tourbillon = retour plus lent.
  //
  // `life` est la vie restante du vortex (1 → 0). Sur la fraction finale
  // (vortexWindDown), le courant s'essouffle : le champ tend vers zéro mais
  // l'entraînement reste — le vortex freine l'eau et la dépose immobile.
  // Sans cette retombée, l'eau regroupée est lâchée en pleine giration et la
  // force centrifuge fait éclater le corps dès que le champ disparaît.
  applyVortex(cx: number, cy: number, dt: number, life = 1): void {
    const p = this.params
    const R = p.vortexRadius
    const R2 = R * R
    const fade = p.vortexWindDown > 0 ? Math.min(1, life / p.vortexWindDown) : 1
    // La vitesse du courant se répartit entre rentrant et giratoire
    const inv = 1 / Math.sqrt(1 + p.vortexSwirl * p.vortexSwirl)
    const vIn = p.vortexPull * inv * fade
    const vTan = p.vortexPull * p.vortexSwirl * inv * fade
    // L'entraînement se renforce à mesure que le courant faiblit : l'eau suit
    // le champ mourant sans retard et se fige au lieu de garder son élan.
    const drag = p.vortexDrag / Math.max(0.15, fade)
    const blend = 1 - Math.exp(-drag * dt)
    for (let i = 0; i < this.count; i++) {
      if (this.frozen[i] === 1) continue // la glace est ancrée
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d2 = dx * dx + dy * dy
      if (d2 >= R2 || d2 < 1e-6) continue
      const d = Math.sqrt(d2)
      const ux = dx / d
      const uy = dy / d
      const rim = Math.min(1, (1 - d / R) * 2) // fondu au bord du rayon d'action
      const settle = Math.min(1, d / (R * 0.08)) // l'eau se pose au centre au lieu d'osciller
      // Cœur en rotation « corps solide » (vortex de Rankine) : sans lui,
      // l'eau trouve une orbite d'équilibre (r ≈ vTan²/(drag·vIn)) et tourne
      // sans jamais entrer. Le cœur doit englober ce rayon d'équilibre.
      const tanScale = Math.min(1, d / (R * 0.5))
      const tx = (ux * vIn * settle - uy * vTan * tanScale) * rim
      const ty = (uy * vIn * settle + ux * vTan * tanScale) * rim
      this.velX[i] += (tx - this.velX[i]) * blend
      this.velY[i] += (ty - this.velY[i]) * blend
    }
  }

  // Le sas est une bouche d'aspiration : dans son rayon d'action, un courant
  // permanent entraîne l'eau vers le trou, en spirale rentrante (entonnoir).
  // Même modèle en champ de vitesses que le vortex — une force pure ferait
  // orbiter l'eau autour de la bouche sans jamais y entrer. Contrairement au
  // vortex, le courant se renforce à l'approche du trou, comme une vidange,
  // et il n'y a pas de retombée : le trou avale, il ne dépose pas.
  applyExitSuction(cx: number, cy: number, dt: number): void {
    const p = this.params
    const R = p.exitRadius
    this.mouthX = cx
    this.mouthY = cy
    this.drainOn = R > 0 && p.exitPull > 0
    if (!this.drainOn) return
    const R2 = R * R
    const inv = 1 / Math.sqrt(1 + p.exitSwirl * p.exitSwirl)
    // Entraînement fixe : le courant du sas est permanent, l'eau le suit
    // franchement sans qu'un curseur de plus soit nécessaire.
    const blend = 1 - Math.exp(-4 * dt)
    for (let i = 0; i < this.count; i++) {
      if (this.frozen[i] === 1) continue // la glace est ancrée
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d2 = dx * dx + dy * dy
      if (d2 >= R2 || d2 < 1e-6) continue
      const d = Math.sqrt(d2)
      const ux = dx / d
      const uy = dy / d
      const rim = Math.min(1, (1 - d / R) * 2) // fondu au bord du rayon d'action
      // La vidange accélère vers le trou — sur le courant rentrant seulement :
      // amplifier aussi la giration élargirait l'orbite d'équilibre au-delà
      // du cœur de Rankine et l'eau tournerait sans jamais entrer.
      // Le second terme est la gorgée finale : tout près de la bouche, le
      // courant plonge franchement — les dernières gouttes, même plaquées
      // contre la paroi voisine, sont bues au lieu de tourner en rond.
      const boost = 1 + 1.5 * (1 - d / R) + 1.5 * (1 - Math.min(1, d / (R * 0.3)))
      const vIn = p.exitPull * inv * boost
      const vTan = p.exitPull * p.exitSwirl * inv
      // Cœur en rotation « corps solide » (Rankine), durci au carré : la
      // giration s'efface à l'approche de la bouche, l'eau y tombe droit.
      const t0 = Math.min(1, d / (R * 0.5))
      const tanScale = t0 * t0
      const tx = (ux * vIn - uy * vTan * tanScale) * rim
      const ty = (uy * vIn + ux * vTan * tanScale) * rim
      this.velX[i] += (tx - this.velX[i]) * blend
      this.velY[i] += (ty - this.velY[i]) * blend
    }

    // Le trou avale : toute particule qui atteint l'œil est retirée de la
    // simulation et comptée — elle sera mise en bonbonne à la sortie.
    const swallowR = p.kernelRadius * 2.8
    const swallowR2 = swallowR * swallowR
    let i = 0
    while (i < this.count) {
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      if (this.frozen[i] === 0 && dx * dx + dy * dy < swallowR2) {
        this.removeParticle(i)
        this.swallowed++
        continue // l'indice i contient maintenant une autre particule
      }
      i++
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

    // 1. Prédiction (apesanteur : pas de force externe). La glace avance
    // aussi : sa vitesse est celle de son bloc (assignée par icePass).
    const frozen = this.frozen
    for (let i = 0; i < n; i++) {
      prdX[i] = posX[i] + velX[i] * dt
      prdY[i] = posY[i] + velY[i] * dt
    }

    // sCorr de référence : W(dq · h)
    const dq = p.sCorrDq * h
    const wDq = k.w(dq * dq)
    const invWDq = wDq > 0 ? 1 / wDq : 0

    // 1bis. Voisinages : UNE construction de grille par pas, listes plates
    // réutilisées par toutes les itérations et la viscosité — c'est le gros
    // du coût CPU du solveur sur petites machines.
    grid.build(prdX, prdY, n)
    const nbStart = this.nbStart
    const nbList = this.nbList
    const pairDx = this.pairDx
    const pairDy = this.pairDy
    const pairW = this.pairW
    const pairC = this.pairC
    {
      let cursor = 0
      const reach = h * 1.15 // marge : les itérations déplacent un peu les particules
      for (let i = 0; i < n; i++) {
        nbStart[i] = cursor
        cursor = grid.collect(prdX, prdY, prdX[i], prdY[i], reach, i, nbList, cursor, MAX_NEIGHBORS)
      }
      nbStart[n] = cursor
    }
    const selfRho = k.poly6Coeff * h2 * h2 * h2
    // Exposant de cohésion : puissance entière déroulée quand c'est possible
    // (Math.pow dans la boucle de paires coûte cher sur petites machines)
    const sCorrNInt = Math.abs(p.sCorrN - Math.round(p.sCorrN)) < 1e-9 ? Math.round(p.sCorrN) : 0

    // 2. Itérations de contrainte de densité. La vapeur est hors du solveur :
    // elle ne compte pas dans la densité du liquide et n'est pas corrigée —
    // un nuage n'appuie pas, et rien ne l'appuie.
    const gaseous = this.gaseous
    for (let iter = 0; iter < p.solverIterations; iter++) {
      for (let i = 0; i < n; i++) {
        if (gaseous[i] === 1) {
          density[i] = selfRho
          lambda[i] = 0
          continue
        }
        const xi = prdX[i]
        const yi = prdY[i]
        let rho = selfRho
        let sumGradX = 0
        let sumGradY = 0
        let sumGrad2 = 0
        const end = nbStart[i + 1]
        for (let e = nbStart[i]; e < end; e++) {
          const j = nbList[e]
          if (gaseous[j] === 1) {
            pairW[e] = 0
            pairC[e] = 0
            continue
          }
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          const r2 = dx * dx + dy * dy
          if (r2 >= h2) {
            pairW[e] = 0
            pairC[e] = 0
            continue
          }
          const t = h2 - r2
          const w = k.poly6Coeff * t * t * t
          rho += w
          const r = Math.sqrt(r2)
          if (r < 1e-6) {
            pairW[e] = 0
            pairC[e] = 0
            continue
          }
          const tg = h - r
          const c = (k.spikyGradCoeff * tg * tg) / r
          // mémorisé pour la passe de déplacement de cette itération
          pairDx[e] = dx
          pairDy[e] = dy
          pairW[e] = w
          pairC[e] = c
          const gx = c * dx * invRho0
          const gy = c * dy * invRho0
          sumGradX += gx
          sumGradY += gy
          sumGrad2 += gx * gx + gy * gy
        }
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
        if (gaseous[i] === 1) {
          dpX[i] = 0
          dpY[i] = 0
          continue
        }
        const li = lambda[i]
        let dx0 = 0
        let dy0 = 0
        const end = nbStart[i + 1]
        for (let e = nbStart[i]; e < end; e++) {
          const c = pairC[e]
          if (c === 0) continue
          const ratio = pairW[e] * invWDq
          let powed: number
          if (sCorrNInt > 0) {
            powed = ratio
            for (let q = 1; q < sCorrNInt; q++) powed *= ratio
          } else {
            powed = Math.pow(ratio, p.sCorrN)
          }
          const sCorr = -p.sCorrK * powed
          const scale = (li + lambda[nbList[e]] + sCorr) * invRho0
          let px = scale * c * pairDx[e]
          let py = scale * c * pairDy[e]
          const m2 = px * px + py * py
          if (m2 > maxPairDp2) {
            const s = maxPairDp / Math.sqrt(m2)
            px *= s
            py *= s
          }
          dx0 += px
          dy0 += py
        }
        dpX[i] = dx0
        dpY[i] = dy0
      }

      for (let i = 0; i < n; i++) {
        if (frozen[i] === 1) continue // masse infinie : la correction ne s'applique qu'au liquide
        prdX[i] += dpX[i]
        prdY[i] += dpY[i]
      }
    }

    // 3. Obstacles solides (parois, cellules d'éponge saturées)
    this.resolveObstacles(dt)

    // 3bis. Bords du monde (contact enregistré pour la glace : elle rebondit)
    const b = this.bounds
    const inset = p.particleSpacing * 0.5
    for (let i = 0; i < n; i++) {
      let nx = 0
      let ny = 0
      if (prdX[i] < b.minX + inset) {
        prdX[i] = b.minX + inset
        nx = 1
      } else if (prdX[i] > b.maxX - inset) {
        prdX[i] = b.maxX - inset
        nx = -1
      }
      if (prdY[i] < b.minY + inset) {
        prdY[i] = b.minY + inset
        ny = 1
      } else if (prdY[i] > b.maxY - inset) {
        prdY[i] = b.maxY - inset
        ny = -1
      }
      if ((nx !== 0 || ny !== 0) && frozen[i] === 1) {
        const inv = 1 / Math.hypot(nx, ny)
        this.contactMat[i] = MAT_WALL
        this.contactNX[i] = nx * inv
        this.contactNY[i] = ny * inv
      }
    }

    // 4. Vitesses puis viscosité XSPH (antisymétrique : conserve la quantité
    //    de mouvement). La glace garde sa vitesse de bloc : la recalculer des
    //    positions y injecterait les à-coups de résolution de contact.
    const invDt = 1 / dt
    const maxV = p.maxSpeed
    const maxV2 = maxV * maxV
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 1) continue
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
      for (let i = 0; i < n; i++) {
        if (frozen[i] === 1 || gaseous[i] === 1) {
          dvX[i] = 0
          dvY[i] = 0
          continue
        }
        const xi = prdX[i]
        const yi = prdY[i]
        const vxi = velX[i]
        const vyi = velY[i]
        let ax = 0
        let ay = 0
        const end = nbStart[i + 1]
        for (let e = nbStart[i]; e < end; e++) {
          const j = nbList[e]
          if (gaseous[j] === 1) continue
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          const r2 = dx * dx + dy * dy
          if (r2 >= h2) continue
          const t = h2 - r2
          const w = k.poly6Coeff * t * t * t
          ax += (velX[j] - vxi) * w
          ay += (velY[j] - vyi) * w
        }
        dvX[i] = ax * p.xsphC * invRho0
        dvY[i] = ay * p.xsphC * invRho0
      }
      for (let i = 0; i < n; i++) {
        velX[i] += dvX[i]
        velY[i] += dvY[i]
      }
    }

    // 4ter. Blocs de glace : vitesse commune par amas, rebonds, soudures
    this.icePass()

    // 4quater. Vapeur : expansion douce et flottement
    this.applyGasDynamics(dt)

    // 5. Validation des positions, cooldowns, identité du corps
    for (let i = 0; i < n; i++) {
      posX[i] = prdX[i]
      posY[i] = prdY[i]
      if (this.cooldown[i] > 0) this.cooldown[i] -= dt
    }

    // 5bis. Froid : givre, gel volontaire (F), dégel
    this.processCold(dt)

    // 5bis-b. Règle de transformation : la condensation regroupe — les
    // gouttelettes qui redeviennent eau sont rappelées vers le corps
    this.applyCondenseRegroup(dt)

    // 5bis-c. La vapeur n'est pas un état de croisière : être gaz s'évapore
    // en continu, et les mailles d'une grille essorent le nuage au passage
    this.processGasCosts(dt)

    // 5ter. Éponge : traînée, temps de contact, absorption (§6)
    if (this.sponges.length > 0) this.processSponges(dt)

    this.stepIndex++
    if (this.stepIndex % Math.max(1, Math.round(p.componentEvery)) === 0) {
      this.relabel()
    }
    if (this.belowCritical && !this.dispersed) {
      this.criticalTimer += dt
      if (this.criticalTimer >= p.dispersalGrace) this.dispersed = true
    } else if (!this.belowCritical) {
      this.criticalTimer = 0
    }
  }

  // La vapeur se paie (§4 : chaque bouffée part définitivement) : tant que
  // le corps est en gaz, sa traîne s'évapore — même immobile — et chaque
  // particule prise dans la maille d'une grille risque d'y rester. La vapeur
  // reste le passe-muraille du jeu, mais chaque passage a un prix.
  private processGasCosts(dt: number): void {
    const p = this.params
    let anyPlayerGas = false
    let inMesh = 0
    for (let i = 0; i < this.count; i++) {
      if (this.gaseous[i] !== 1) continue
      if (this.kind[i] === KIND_PLAYER) anyPlayerGas = true
      if (this.hasGrille && this.grilleAt(this.posX[i], this.posY[i])) inMesh++
    }
    // péage de grille : proportionnel à la présence dans la maille
    if (inMesh > 0) this.grilleCarry += inMesh * p.grilleGasLoss * dt
    else this.grilleCarry = 0
    while (this.grilleCarry >= 1) {
      this.grilleCarry -= 1
      let pick = -1
      for (let i = 0; i < this.count; i++) {
        if (this.gaseous[i] !== 1) continue
        if (this.grilleAt(this.posX[i], this.posY[i])) {
          pick = i
          break
        }
      }
      if (pick < 0 || (this.kind[pick] === KIND_PLAYER && this.playerCount <= 2)) break
      this.removeParticle(pick)
    }
    // évaporation d'état : la traîne du nuage (la plus loin du corps) se perd
    if (anyPlayerGas) this.gasIdleCarry += p.gasIdleLossRate * dt
    else this.gasIdleCarry = 0
    while (this.gasIdleCarry >= 1 && this.playerCount > 2) {
      this.gasIdleCarry -= 1
      let worst = -1
      let worstD2 = -1
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] !== KIND_PLAYER || this.gaseous[i] !== 1) continue
        const dx = this.posX[i] - this.stats.centroidX
        const dy = this.posY[i] - this.stats.centroidY
        const d2 = dx * dx + dy * dy
        if (d2 > worstD2) {
          worstD2 = d2
          worst = i
        }
      }
      if (worst < 0) break
      this.removeParticle(worst)
    }
  }

  private grilleAt(x: number, y: number): boolean {
    for (const b of this.boxes) {
      if (b.material !== MAT_GRILLE) continue
      if (x > b.minX && x < b.maxX && y > b.minY && y < b.maxY) return true
    }
    return false
  }

  // Tant qu'une particule garde de la vapeur résiduelle (le corps est en
  // train de redevenir liquide) et qu'on ne pilote pas le nuage, elle est
  // rappelée vers le corps : redevenir eau ne disperse pas l'échantillon.
  // Physiquement : la condensation nuclée — les gouttelettes retombent.
  private applyCondenseRegroup(dt: number): void {
    const p = this.params
    if (p.condenseRegroup <= 0 || this.playerCount === 0) return // pas de corps : rien vers quoi retomber
    const cx = this.stats.centroidX
    const cy = this.stats.centroidY
    for (let i = 0; i < this.count; i++) {
      const v = Math.max(this.vapor[i], this.gasLink[i])
      if (v <= 0.02 || this.frozen[i] === 1) continue
      if (this.gasIntent && this.kind[i] === KIND_PLAYER) continue // le pilotage garde la main
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d = Math.hypot(dx, dy)
      if (d < 1e-3) continue
      // Asservissement en vitesse (comme le vortex) : la vitesse d'approche
      // cible décroît avec la distance — la pluie converge et se pose, sans
      // jamais s'effondrer sur le corps (une force constante exploserait un
      // nuage compact)
      const ux = dx / d
      const uy = dy / d
      const vTarget = Math.min(p.condenseRegroup, d * 2.5)
      const vRadial = this.velX[i] * ux + this.velY[i] * uy
      const k = Math.min(1, 6 * v * dt)
      this.velX[i] += (vTarget - vRadial) * ux * k
      this.velY[i] += (vTarget - vRadial) * uy * k
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
        // La grille arrête le liquide et la glace ; la vapeur la traverse
        if (b.material === MAT_GRILLE && this.gaseous[i] === 1) continue
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
    const bite = p.surfaceBite // mordant global : les surfaces pèsent plus
    const philDamp = Math.exp(-p.hydrophileFriction * bite * dt)

    for (let i = 0; i < n; i++) {
      // La glace et la vapeur ignorent la chimie des surfaces
      if (this.frozen[i] === 1 || this.gaseous[i] === 1) continue
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
        if (b.material !== MAT_HYDROPHILE && b.material !== MAT_HYDROPHOBE && b.material !== MAT_WALL) {
          continue
        }
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
          if (b.material === MAT_WALL) {
            // Mur neutre : l'éclat d'impact vient du rebond de pression qui
            // projette les particules loin de la paroi. On amortit la vitesse
            // sortante dans la bande — l'eau s'étale et épouse la forme au
            // lieu de jaillir ; le glissement tangentiel reste libre.
            const vn = this.velX[i] * cp.nx + this.velY[i] * cp.ny
            if (vn > 0) {
              const damp = p.wallSplashDamp * f
              this.velX[i] -= cp.nx * vn * damp
              this.velY[i] -= cp.ny * vn * damp
            }
            continue
          }
          const a =
            (b.material === MAT_HYDROPHILE ? -p.hydrophilePull : p.hydrophobeRepel) * f * dt * bite
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
    const drag = Math.exp(-p.spongeDrag * p.surfaceBite * dt)
    const absorbTime = p.spongeAbsorbTime / Math.max(0.1, p.surfaceBite)
    let i = 0
    while (i < this.count) {
      if (this.frozen[i] === 1 || this.gaseous[i] === 1) {
        i++
        continue // ni la glace ni la vapeur ne sont engluées ou absorbées
      }
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
        if (this.contactTime[i] >= absorbTime) {
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

  // La vapeur s'étale (répulsion douce entre particules de gaz, réutilise
  // les voisinages du pas) et flotte (freinage propre). L'expansion s'arrête
  // d'elle-même : au-delà de h, plus de répulsion — le nuage trouve son
  // étendue sans jamais se déchirer (le rayon d'amas du gaz est plus grand).
  private applyGasDynamics(dt: number): void {
    const n = this.count
    const gaseous = this.gaseous
    let any = false
    for (let i = 0; i < n; i++) {
      if (gaseous[i] === 1) {
        any = true
        break
      }
    }
    if (!any) return
    const p = this.params
    const k = this.kernels
    const h = k.h
    const h2 = k.h2
    const drag = Math.exp(-p.gasDrag * dt)
    const { prdX, prdY, velX, velY } = this
    const nbStart = this.nbStart
    const nbList = this.nbList
    // Turbulence : deux octaves de tourbillons (rotationnel d'un potentiel,
    // donc sans divergence — le nuage se tord en volutes sans se déchirer).
    // Déterministe : fonction de la position et du temps de simulation.
    const time = this.stepIndex * dt
    const k1 = 0.011
    const k2 = 0.023
    const turb = p.gasTurb * dt
    for (let i = 0; i < n; i++) {
      if (gaseous[i] !== 1) continue
      velX[i] *= drag
      velY[i] *= drag
      const xi = prdX[i]
      const yi = prdY[i]
      if (turb > 0) {
        const c1x = -Math.sin(xi * k1 + time * 0.8) * Math.sin(yi * k1 - time * 0.6)
        const c1y = -Math.cos(xi * k1 + time * 0.8) * Math.cos(yi * k1 - time * 0.6)
        const c2x = -Math.sin(xi * k2 - time * 1.3) * Math.sin(yi * k2 + time * 1.1)
        const c2y = -Math.cos(xi * k2 - time * 1.3) * Math.cos(yi * k2 + time * 1.1)
        velX[i] += (c1x * 0.65 + c2x * 0.35) * turb
        velY[i] += (c1y * 0.65 + c2y * 0.35) * turb
      }
      let ax = 0
      let ay = 0
      const end = nbStart[i + 1]
      for (let e = nbStart[i]; e < end; e++) {
        const j = nbList[e]
        if (gaseous[j] !== 1) continue
        const dx = xi - prdX[j]
        const dy = yi - prdY[j]
        const r2 = dx * dx + dy * dy
        if (r2 >= h2 || r2 < 1e-6) continue
        const r = Math.sqrt(r2)
        const a = (p.gasExpand * (1 - r / h)) / r
        ax += dx * a
        ay += dy * a
      }
      velX[i] += ax * dt
      velY[i] += ay * dt
    }
  }

  // Le froid et la glace (§6). Deux chemins vers le gel : l'aura des plaques
  // froides (givre ∝ proximité), et l'intention volontaire (touche F — le
  // corps entier prend, vite). À 1, la particule gèle EN GARDANT sa vitesse :
  // la glace est balistique. Gelée au contact d'une plaque, elle s'y soude
  // (icePass annule la vitesse du bloc). Le dégel — intention levée ET à
  // l'écart du froid — descend sous 0,55 avant de libérer : l'hystérésis
  // évite le clignotement en bord d'aura.
  private processCold(dt: number): void {
    const p = this.params
    // Refroidissement du vaisseau (§5) : les auras froides s'étendent, le gel
    // prend plus vite, le dégel traîne, la vapeur volontaire se fait chère et
    // la condensation ambiante s'accélère — le monde devient moins jouable.
    const chill = this.chill
    const band = p.coldBand * (1 + p.chillColdGrowth * chill)
    const rp = p.particleSpacing * 0.5
    const freeze = (dt * p.surfaceBite) / Math.max(0.05, p.freezeTime * (1 - 0.5 * chill))
    const freezeSelf = dt / Math.max(0.05, p.freezeSelfTime)
    const thaw = dt / Math.max(0.1, p.thawTime * (1 + chill))
    const boilTime = p.boilTime * (1 + 2 * p.chillHeatFade * chill)
    const vaporizeTime = p.vaporizeTime * (1 + 1.5 * chill)
    const condenseTime = p.condenseTime * (1 - 0.4 * chill)
    const cp = this.scratchCP
    const intent = this.freezeIntent
    // Ressenti thermique du liquide : l'eau qui givre s'engourdit, l'eau qui
    // chauffe frémit — la température se sent avant le changement d'état
    const time = this.stepIndex * dt
    const agit = p.heatAgitation * dt
    const kAgit = 0.06
    for (let i = 0; i < this.count; i++) {
      const x = this.posX[i]
      const y = this.posY[i]
      let exposure = 0
      let minSep = Infinity
      if (this.hasCold) {
        for (const b of this.boxes) {
          if (b.material !== MAT_FROID) continue
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
          if (sep < minSep) minSep = sep
          const f = 1 - Math.max(0, sep) / band
          if (f > exposure) exposure = Math.min(1, f)
        }
      }
      this.welded[i] = this.frozen[i] === 1 && minSep <= 1 ? 1 : 0

      // Radiateur (tableau 4) : l'aura de chaleur, symétrique de l'aura de gel
      const heat = this.heatExposureAt(x, y)

      // Vapeur : le froid condense en priorité (vite), puis la chaleur
      // vaporise qu'on le veuille ou non, sinon l'intention (G) vaporise et
      // son absence condense. Hystérésis comme pour la glace.
      const wantGas = this.gasIntent && this.kind[i] === KIND_PLAYER && this.frozen[i] === 0
      let dv: number
      if (exposure > 0) dv = -exposure * (dt / 0.25)
      else if (heat > 0 && this.frozen[i] === 0) dv = heat * (dt / Math.max(0.05, boilTime))
      else if (wantGas) dv = dt / Math.max(0.05, vaporizeTime)
      else dv = -dt / Math.max(0.05, condenseTime)
      const vap = Math.min(1, Math.max(0, this.vapor[i] + dv))
      this.vapor[i] = vap
      if (vap >= 1) this.gaseous[i] = 1
      else if (this.gaseous[i] === 1 && vap <= 0.55) this.gaseous[i] = 0

      // Mémoire de lien : pleine tant que gazeuse, s'éteint doucement après —
      // le temps que le nuage condensé retombe sur le corps
      if (this.gaseous[i] === 1) this.gasLink[i] = 1
      else if (this.gasLink[i] > 0)
        this.gasLink[i] = Math.max(0, this.gasLink[i] - dt / Math.max(0.2, p.gasLinkDecay))

      // Givre : jamais sur la vapeur — le froid doit d'abord la condenser.
      // La chaleur empêche la prise, et dégèle bien plus vite qu'à l'air libre.
      const wanted = intent && this.kind[i] === KIND_PLAYER && this.gaseous[i] === 0
      const canFrost = this.gaseous[i] === 0 && vap < 0.5 && heat <= 0
      const rate = canFrost ? Math.max(exposure * freeze, wanted ? freezeSelf : 0) : 0
      if (rate > 0) {
        this.frost[i] = Math.min(1, this.frost[i] + rate)
        if (this.frost[i] >= 1) this.frozen[i] = 1 // la vitesse est conservée
      } else {
        const melt =
          heat > 0 ? Math.max(thaw, (heat * dt) / Math.max(0.05, p.heatThawTime)) : thaw
        this.frost[i] = Math.max(0, this.frost[i] - melt)
        if (this.frozen[i] === 1 && this.frost[i] <= 0.55) this.frozen[i] = 0
      }

      // La température se sent dans le liquide lui-même :
      if (this.frozen[i] === 0 && this.gaseous[i] === 0) {
        const fr = this.frost[i]
        // l'eau qui givre s'engourdit — pâteuse, dure à propulser. Le gel
        // VOLONTAIRE (F) y échappe : « geler, c'est parier sur une
        // trajectoire » — l'élan choisi est conservé
        if (fr > 0 && p.frostSluggish > 0 && !(wanted && this.kind[i] === KIND_PLAYER)) {
          const damp = Math.exp(-p.frostSluggish * fr * dt)
          this.velX[i] *= damp
          this.velY[i] *= damp
        }
        const warmth = Math.max(this.vapor[i], heat)
        if (warmth > 0.05 && agit > 0) {
          // l'eau qui chauffe frémit : un bouillonnement doux, déterministe
          const xi = this.posX[i]
          const yi = this.posY[i]
          const jx = -Math.sin(xi * kAgit + time * 5.1) * Math.sin(yi * kAgit - time * 4.3)
          const jy = -Math.cos(xi * kAgit + time * 5.1) * Math.cos(yi * kAgit - time * 4.3)
          this.velX[i] += jx * agit * warmth
          this.velY[i] += jy * agit * warmth
        }
      }
    }

    // La vapeur qui s'attarde dans l'aura d'un radiateur s'évapore : perdue,
    // pas mise en bonbonne. La plus exposée part en premier.
    if (this.hasHeat) {
      let anyHotGas = false
      for (let i = 0; i < this.count; i++) {
        if (this.gaseous[i] === 1 && this.heatExposureAt(this.posX[i], this.posY[i]) > 0) {
          anyHotGas = true
          break
        }
      }
      if (anyHotGas) {
        this.heatCarry += p.heatLossRate * p.surfaceBite * dt
        while (this.heatCarry >= 1) {
          this.heatCarry -= 1
          let best = -1
          let bestHeat = 0
          for (let i = 0; i < this.count; i++) {
            if (this.gaseous[i] !== 1) continue
            const h = this.heatExposureAt(this.posX[i], this.posY[i])
            if (h > bestHeat) {
              bestHeat = h
              best = i
            }
          }
          if (best < 0 || (this.kind[best] === KIND_PLAYER && this.playerCount <= 2)) break
          this.removeParticle(best)
        }
      } else {
        this.heatCarry = 0
      }
    }
  }

  // Les blocs de glace : chaque amas connexe de particules gelées est un
  // corps rigide en translation — une seule vitesse pour tout l'amas (la
  // moyenne), un rebond commun quand l'un de ses points touche une paroi,
  // l'arrêt complet si l'un d'eux est soudé à une plaque froide.
  private icePass(): void {
    const n = this.count
    const frozen = this.frozen
    let any = false
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 1) {
        any = true
        break
      }
    }
    if (!any) return
    const p = this.params
    const linkR = p.linkRadiusFactor * p.kernelRadius
    const linkR2 = linkR * linkR
    const { prdX, prdY, velX, velY, labels } = this
    const grid = this.grid
    const forEachIce = (i: number, cb: (j: number) => void) => {
      if (frozen[i] === 0) return // le liquide : singletons, hors des blocs
      const xi = prdX[i]
      const yi = prdY[i]
      grid.forEachNeighbor(xi, yi, linkR, (j) => {
        if (j === i || frozen[j] === 0) return
        const dx = xi - prdX[j]
        const dy = yi - prdY[j]
        if (dx * dx + dy * dy <= linkR2) cb(j)
      })
    }
    const comps = labelComponents(n, labels, forEachIce, this.stack)
    this.iceVxSum.fill(0, 0, comps)
    this.iceVySum.fill(0, 0, comps)
    this.iceCnt.fill(0, 0, comps)
    this.iceNxSum.fill(0, 0, comps)
    this.iceNySum.fill(0, 0, comps)
    this.iceWeld.fill(0, 0, comps)
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 0) continue
      const c = labels[i]
      this.iceVxSum[c] += velX[i]
      this.iceVySum[c] += velY[i]
      this.iceCnt[c]++
      if (this.contactMat[i] >= 0) {
        this.iceNxSum[c] += this.contactNX[i]
        this.iceNySum[c] += this.contactNY[i]
      }
      if (this.welded[i] === 1) this.iceWeld[c] = 1
    }
    const rest = Math.min(1, Math.max(0, p.iceRestitution))
    for (let c = 0; c < comps; c++) {
      const cnt = this.iceCnt[c]
      if (cnt === 0) continue
      let vx = this.iceVxSum[c] / cnt
      let vy = this.iceVySum[c] / cnt
      if (this.iceWeld[c] === 1) {
        vx = 0
        vy = 0
      } else {
        const nl = Math.hypot(this.iceNxSum[c], this.iceNySum[c])
        if (nl > 1e-6) {
          const nx = this.iceNxSum[c] / nl
          const ny = this.iceNySum[c] / nl
          const vn = vx * nx + vy * ny
          if (vn < 0) {
            vx -= (1 + rest) * vn * nx
            vy -= (1 + rest) * vn * ny
            if (-vn > this.iceImpact) this.iceImpact = -vn
          }
        }
      }
      this.iceVxSum[c] = vx // réutilisé : vitesse finale du bloc
      this.iceVySum[c] = vy
    }
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 0) continue
      const c = labels[i]
      velX[i] = this.iceVxSum[c]
      velY[i] = this.iceVySum[c]
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
    // Le nuage de vapeur est distendu : son rayon d'adjacence est élargi,
    // sinon l'expansion du gaz compterait comme une dispersion. Le rayon
    // suit la vapeur RÉSIDUELLE (continue), pas l'étiquette gazeuse : en
    // condensant, le lien se resserre au rythme où le corps se regroupe,
    // au lieu de tomber d'un coup — redevenir eau ne scinde pas l'amas.
    const gasLinkR = linkR * Math.max(1, p.gasLinkFactor)
    const gasSpan = Math.max(1, p.gasLinkFactor) - 1
    const { posX, posY, labels, gasLink } = this
    const grid = this.grid
    grid.build(posX, posY, n)

    const forEachNeighbor = (i: number, cb: (j: number) => void) => {
      const xi = posX[i]
      const yi = posY[i]
      grid.forEachNeighbor(xi, yi, gasLinkR, (j) => {
        if (j === i) return
        const dx = xi - posX[j]
        const dy = yi - posY[j]
        const r2 = dx * dx + dy * dy
        const v = Math.max(gasLink[i], gasLink[j])
        if (v > 0) {
          const lr = linkR * (1 + gasSpan * v)
          if (r2 <= lr * lr) cb(j)
        } else if (r2 <= linkR2) {
          cb(j)
        }
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
    // Dans l'emprise du sas, la perte de cohésion n'est pas une dispersion :
    // c'est le trou qui boit le corps — le jeu conclut en victoire, pas en
    // défaite, même si le volume restant passe sous le seuil critique.
    // Marge ×1,3 : une éclaboussure qui déborde brièvement du rayon pendant
    // que le sas boit ne doit pas requalifier la fin en dispersion.
    const inDrainGrip =
      this.drainOn &&
      Math.hypot(this.stats.centroidX - this.mouthX, this.stats.centroidY - this.mouthY) <
        this.params.exitRadius * 1.3

    if (playerLabel < 0) {
      this.playerCount = 0
      if (!inDrainGrip) this.dispersed = true
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

    if (inDrainGrip) {
      this.belowCritical = false
      return
    }
    // Sous le seuil critique : constaté ici, tranché par le délai de grâce
    // (dispersalGrace, dans step) — un corps en pleine transformation a le
    // temps de se regrouper avant que le protocole ne conclue à la perte.
    this.belowCritical =
      this.baseVolume > 0 && count < this.baseVolume * p.criticalVolumeFraction
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
