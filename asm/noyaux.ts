// Noyaux WASM du solveur PBF — portage LIGNE À LIGNE des chemins chauds de
// src/sim/solver.ts et src/sim/grid.ts : grille interne, collecte de
// voisins, itérations de densité, viscosité XSPH. Tout le reste (glace,
// gaz, matériaux, obstacles) reste en JavaScript et lit les mêmes tableaux.
//
// RÈGLE D'OR DU PORTAGE : mêmes formules, MÊME ORDRE D'OPÉRATIONS, mêmes
// précisions (tableaux f32, arithmétique f64 — comme les Float32Array lus
// en double par le moteur JS). Le test de parité (wasm.spec.ts) compare
// les deux moteurs pas à pas : toute divergence est un bogue de portage.
//
// Compilé par AssemblyScript (pnpm asbuild) → public/noyaux.wasm, chargé
// au démarrage ; si le chargement échoue, le jeu reste sur le moteur JS.

const MAXN: i32 = 48 // MAX_NEIGHBORS du solveur JS

// ---- tampons (offsets posés par init) ----
let pPrdX: usize = 0
let pPrdY: usize = 0
let pVelX: usize = 0
let pVelY: usize = 0
let pGas: usize = 0
let pFro: usize = 0
let pLambda: usize = 0
let pDensity: usize = 0
let pDpX: usize = 0
let pDpY: usize = 0
let pDvX: usize = 0
let pDvY: usize = 0
let pNbStart: usize = 0
let pNbList: usize = 0
let pPairDx: usize = 0
let pPairDy: usize = 0
let pPairW: usize = 0
let pPairC: usize = 0
let pStarts: usize = 0
let pCursor: usize = 0
let pCellOf: usize = 0
let pEntries: usize = 0

// ---- accès mémoire (f32 lu/écrit, calcul f64 — comme le moteur JS) ----
// @ts-ignore: décorateur AssemblyScript
@inline
function gf(p: usize, i: i32): f64 {
  return <f64>load<f32>(p + ((<usize>i) << 2))
}
// @ts-ignore: décorateur AssemblyScript
@inline
function sf(p: usize, i: i32, v: f64): void {
  store<f32>(p + ((<usize>i) << 2), <f32>v)
}
// @ts-ignore: décorateur AssemblyScript
@inline
function gi(p: usize, i: i32): i32 {
  return load<i32>(p + ((<usize>i) << 2))
}
// @ts-ignore: décorateur AssemblyScript
@inline
function si(p: usize, i: i32, v: i32): void {
  store<i32>(p + ((<usize>i) << 2), v)
}
// @ts-ignore: décorateur AssemblyScript
@inline
function gu8(p: usize, i: i32): i32 {
  return <i32>load<u8>(p + <usize>i)
}

let bump: usize = 0

function alloue(octets: usize): usize {
  const p = bump
  bump = (bump + octets + 15) & ~<usize>15
  return p
}

/** Pose les tampons pour `capacity` particules et `maxCells` cellules de
 * grille. Ré-appelable (niveau plus grand) : les offsets sont recalculés. */
export function init(capacity: i32, maxCells: i32): void {
  const c = <usize>capacity
  const f32c = c << 2
  bump = (__heap_base + 15) & ~<usize>15
  pPrdX = alloue(f32c)
  pPrdY = alloue(f32c)
  pVelX = alloue(f32c)
  pVelY = alloue(f32c)
  pGas = alloue(c)
  pFro = alloue(c)
  pLambda = alloue(f32c)
  pDensity = alloue(f32c)
  pDpX = alloue(f32c)
  pDpY = alloue(f32c)
  pDvX = alloue(f32c)
  pDvY = alloue(f32c)
  pNbStart = alloue((c + 1) << 2)
  pNbList = alloue((c * MAXN) << 2)
  pPairDx = alloue((c * MAXN) << 2)
  pPairDy = alloue((c * MAXN) << 2)
  pPairW = alloue((c * MAXN) << 2)
  pPairC = alloue((c * MAXN) << 2)
  pStarts = alloue((<usize>maxCells + 1) << 2)
  pCursor = alloue(<usize>maxCells << 2)
  pCellOf = alloue(c << 2)
  pEntries = alloue(c << 2)
  const pagesVoulues = <i32>((bump + 0xffff) >> 16)
  const manque = pagesVoulues - memory.size()
  if (manque > 0) memory.grow(manque)
}

export function ptrPrdX(): usize { return pPrdX }
export function ptrPrdY(): usize { return pPrdY }
export function ptrVelX(): usize { return pVelX }
export function ptrVelY(): usize { return pVelY }
export function ptrGas(): usize { return pGas }
export function ptrFro(): usize { return pFro }
export function ptrDensity(): usize { return pDensity }

// ---- Grille spatiale : portage de SpatialGrid.build (tri par comptage) ----
export function buildGrid(n: i32, minX: f64, minY: f64, cellSize: f64, nx: i32, ny: i32): void {
  const ncells = nx * ny
  memory.fill(pStarts, 0, (<usize>(ncells + 1)) << 2)
  for (let i = 0; i < n; i++) {
    let cx = <i32>Math.floor((gf(pPrdX, i) - minX) / cellSize)
    let cy = <i32>Math.floor((gf(pPrdY, i) - minY) / cellSize)
    if (cx < 0) cx = 0
    else if (cx >= nx) cx = nx - 1
    if (cy < 0) cy = 0
    else if (cy >= ny) cy = ny - 1
    const cell = cy * nx + cx
    si(pCellOf, i, cell)
    si(pStarts, cell + 1, gi(pStarts, cell + 1) + 1)
  }
  for (let cell = 0; cell < ncells; cell++) {
    si(pStarts, cell + 1, gi(pStarts, cell + 1) + gi(pStarts, cell))
    si(pCursor, cell, gi(pStarts, cell))
  }
  for (let i = 0; i < n; i++) {
    const cell = gi(pCellOf, i)
    const cur = gi(pCursor, cell)
    si(pEntries, cur, i)
    si(pCursor, cell, cur + 1)
  }
}

// ---- Collecte des voisins : portage de grid.collect, pour TOUTES les
// particules (nbStart/nbList), plafond MAXN et arrêt de balayage identiques.
export function collectAll(n: i32, radius: f64, minX: f64, minY: f64, cellSize: f64, nx: i32, ny: i32): void {
  const r2max = radius * radius
  const nx1 = nx - 1
  const ny1 = ny - 1
  let cursor: i32 = 0
  for (let i = 0; i < n; i++) {
    si(pNbStart, i, cursor)
    const x = gf(pPrdX, i)
    const y = gf(pPrdY, i)
    let cx0 = <i32>Math.floor((x - radius - minX) / cellSize)
    let cy0 = <i32>Math.floor((y - radius - minY) / cellSize)
    let cx1 = <i32>Math.floor((x + radius - minX) / cellSize)
    let cy1 = <i32>Math.floor((y + radius - minY) / cellSize)
    if (cx0 < 0) cx0 = 0
    else if (cx0 > nx1) cx0 = nx1
    if (cy0 < 0) cy0 = 0
    else if (cy0 > ny1) cy0 = ny1
    if (cx1 < 0) cx1 = 0
    else if (cx1 > nx1) cx1 = nx1
    if (cy1 < 0) cy1 = 0
    else if (cy1 > ny1) cy1 = ny1
    const cap = cursor + MAXN
    // arrêt de balayage à liste pleine — même contrat que grid.collect
    // (pas d'étiquette de boucle en AssemblyScript : un drapeau la remplace)
    let plein = false
    for (let cy = cy0; cy <= cy1 && !plein; cy++) {
      for (let cx = cx0; cx <= cx1 && !plein; cx++) {
        const cell = cy * nx + cx
        const end = gi(pStarts, cell + 1)
        for (let e = gi(pStarts, cell); e < end; e++) {
          const j = gi(pEntries, e)
          if (j == i) continue
          const dx = x - gf(pPrdX, j)
          const dy = y - gf(pPrdY, j)
          if (dx * dx + dy * dy < r2max) {
            si(pNbList, cursor, j)
            cursor++
            if (cursor >= cap) {
              plein = true
              break
            }
          }
        }
      }
    }
  }
  si(pNbStart, n, cursor)
}

// ---- Itérations de densité : portage exact de la section 2 de step() ----
export function densityIterations(
  n: i32,
  iters: i32,
  h: f64,
  h2: f64,
  poly6: f64,
  spikyGrad: f64,
  selfRho: f64,
  invRho0: f64,
  epsLambda: f64,
  sCorrK: f64,
  sCorrN: f64,
  sCorrNInt: i32,
  invWDq: f64,
  maxPairDp: f64,
): void {
  const maxPairDp2 = maxPairDp * maxPairDp
  for (let iter = 0; iter < iters; iter++) {
    for (let i = 0; i < n; i++) {
      if (gu8(pGas, i) == 1) {
        sf(pDensity, i, selfRho)
        sf(pLambda, i, 0)
        continue
      }
      const xi = gf(pPrdX, i)
      const yi = gf(pPrdY, i)
      let rho = selfRho
      let sumGradX: f64 = 0
      let sumGradY: f64 = 0
      let sumGrad2: f64 = 0
      const end = gi(pNbStart, i + 1)
      for (let e = gi(pNbStart, i); e < end; e++) {
        const j = gi(pNbList, e)
        if (gu8(pGas, j) == 1) {
          sf(pPairW, e, 0)
          sf(pPairC, e, 0)
          continue
        }
        const dx = xi - gf(pPrdX, j)
        const dy = yi - gf(pPrdY, j)
        const r2 = dx * dx + dy * dy
        if (r2 >= h2) {
          sf(pPairW, e, 0)
          sf(pPairC, e, 0)
          continue
        }
        const t = h2 - r2
        const w = poly6 * t * t * t
        rho += w
        const r = Math.sqrt(r2)
        if (r < 1e-6) {
          sf(pPairW, e, 0)
          sf(pPairC, e, 0)
          continue
        }
        const tg = h - r
        const cc = (spikyGrad * tg * tg) / r
        sf(pPairDx, e, dx)
        sf(pPairDy, e, dy)
        sf(pPairW, e, w)
        sf(pPairC, e, cc)
        const gx = cc * dx * invRho0
        const gy = cc * dy * invRho0
        sumGradX += gx
        sumGradY += gy
        sumGrad2 += gx * gx + gy * gy
      }
      sf(pDensity, i, rho)
      const C = rho * invRho0 - 1
      const denom = sumGrad2 + sumGradX * sumGradX + sumGradY * sumGradY + epsLambda
      sf(pLambda, i, -C / denom)
    }

    for (let i = 0; i < n; i++) {
      if (gu8(pGas, i) == 1) {
        sf(pDpX, i, 0)
        sf(pDpY, i, 0)
        continue
      }
      const li = gf(pLambda, i)
      let dx0: f64 = 0
      let dy0: f64 = 0
      const end = gi(pNbStart, i + 1)
      for (let e = gi(pNbStart, i); e < end; e++) {
        const cc = gf(pPairC, e)
        if (cc == 0) continue
        const ratio = gf(pPairW, e) * invWDq
        let powed: f64
        if (sCorrNInt > 0) {
          powed = ratio
          for (let q = 1; q < sCorrNInt; q++) powed *= ratio
        } else {
          powed = Math.pow(ratio, sCorrN)
        }
        const sCorr = -sCorrK * powed
        const scale = (li + gf(pLambda, gi(pNbList, e)) + sCorr) * invRho0
        let px = scale * cc * gf(pPairDx, e)
        let py = scale * cc * gf(pPairDy, e)
        const m2 = px * px + py * py
        if (m2 > maxPairDp2) {
          const s = maxPairDp / Math.sqrt(m2)
          px *= s
          py *= s
        }
        dx0 += px
        dy0 += py
      }
      sf(pDpX, i, dx0)
      sf(pDpY, i, dy0)
    }

    for (let i = 0; i < n; i++) {
      if (gu8(pFro, i) == 1) continue // masse infinie : correction liquide seule
      sf(pPrdX, i, gf(pPrdX, i) + gf(pDpX, i))
      sf(pPrdY, i, gf(pPrdY, i) + gf(pDpY, i))
    }
  }
}

// ---- Viscosité XSPH : portage exact de la section 4 de step() ----
export function xsph(n: i32, h2: f64, poly6: f64, xsphC: f64, invRho0: f64): void {
  for (let i = 0; i < n; i++) {
    if (gu8(pFro, i) == 1 || gu8(pGas, i) == 1) {
      sf(pDvX, i, 0)
      sf(pDvY, i, 0)
      continue
    }
    const xi = gf(pPrdX, i)
    const yi = gf(pPrdY, i)
    const vxi = gf(pVelX, i)
    const vyi = gf(pVelY, i)
    let ax: f64 = 0
    let ay: f64 = 0
    const end = gi(pNbStart, i + 1)
    for (let e = gi(pNbStart, i); e < end; e++) {
      const j = gi(pNbList, e)
      if (gu8(pGas, j) == 1) continue
      const dx = xi - gf(pPrdX, j)
      const dy = yi - gf(pPrdY, j)
      const r2 = dx * dx + dy * dy
      if (r2 >= h2) continue
      const t = h2 - r2
      const w = poly6 * t * t * t
      ax += (gf(pVelX, j) - vxi) * w
      ay += (gf(pVelY, j) - vyi) * w
    }
    sf(pDvX, i, ax * xsphC * invRho0)
    sf(pDvY, i, ay * xsphC * invRho0)
  }
  for (let i = 0; i < n; i++) {
    sf(pVelX, i, gf(pVelX, i) + gf(pDvX, i))
    sf(pVelY, i, gf(pVelY, i) + gf(pDvY, i))
  }
}
