import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { SuiviRideaux, depaquetTravee, paquetTravee, traveeGlace } from './rideauSuivi'
import { MAT_RIDEAU, type ObstacleBox } from '../game/level'

// LE RESSORT DES LANIÈRES : le shader ne se souvient de rien d'une image à
// l'autre. Le rendu tient, par rideau, où la glace le traverse et un
// ressort amorti — ouverture, puis balancement à la fermeture, sans à-coup.
const rideau = (minX: number, minY: number, maxX: number, maxY: number, angle = 0): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material: MAT_RIDEAU,
  ...(angle ? { angle } : {}),
})

function grains(pts: [number, number, number][]) {
  return {
    x: Float32Array.from(pts.map((p) => p[0])),
    y: Float32Array.from(pts.map((p) => p[1])),
    gele: Uint8Array.from(pts.map((p) => p[2])),
    n: pts.length,
  }
}

describe('rideau — la travée de glace', () => {
  it('couché : l’étendue des grains GELÉS dans sa bande, en fractions de L', () => {
    const g = grains([
      [150, 30, 1],
      [250, 20, 1],
      [300, 30, 0], // de l'eau : ne compte pas
      [350, 200, 1], // loin du rideau : ne compte pas
    ])
    const t = traveeGlace(rideau(100, 0, 500, 60), g.x, g.y, g.gele, g.n)!
    expect(t[0]).toBeCloseTo(50 / 400, 6)
    expect(t[1]).toBeCloseTo(150 / 400, 6)
  })

  it('un peu avant le rideau, la glace compte déjà (0,15 T), pas au-delà', () => {
    const b = rideau(0, 0, 400, 60)
    const avant = grains([[200, -8, 1]])
    const loin = grains([[200, -10, 1]])
    expect(traveeGlace(b, avant.x, avant.y, avant.gele, avant.n)).not.toBeNull()
    expect(traveeGlace(b, loin.x, loin.y, loin.gele, loin.n)).toBeNull()
  })

  it('debout : la longueur se lit en y', () => {
    const g = grains([[20, 300, 1]])
    const t = traveeGlace(rideau(0, 0, 40, 1000), g.x, g.y, g.gele, g.n)!
    expect(t[0]).toBeCloseTo(0.3, 6)
  })

  it('oblique : la rotation de la boîte est comprise', () => {
    // un rideau de 400 × 40 centré en (0, 0), tourné de 90° : il est debout
    const g = grains([[0, 100, 1]])
    const t = traveeGlace(rideau(-200, -20, 200, 20, 90), g.x, g.y, g.gele, g.n)
    expect(t).not.toBeNull()
    const sansRotation = traveeGlace(rideau(-200, -20, 200, 20), g.x, g.y, g.gele, g.n)
    expect(sansRotation).toBeNull()
  })
})

/** Un rideau suivi à 60 images/s ; `glace(k)` : la travée à l'image k. */
function joue(glace: (k: number) => [number, number] | null, images: number) {
  const s = new SuiviRideaux()
  const b = rideau(0, 0, 400, 60)
  const xs: number[] = []
  const zs: number[] = []
  for (let k = 0; k < images; k++) {
    const [z, w] = s.aux(b, glace(k), k / 60)
    xs.push(w)
    zs.push(z)
  }
  return { xs, zs }
}

describe('rideau — le ressort des lanières', () => {
  it('empaquetée dans un flottant, la travée est relue par le jumeau du shader', () => {
    const [a, b] = depaquetTravee(paquetTravee(0.25, 0.8))!
    expect(a).toBeCloseTo(0.25, 2)
    expect(b).toBeCloseTo(0.8, 2)
    expect(depaquetTravee(0)).toBeNull()
    // moins de 2^24 : exact en float32
    expect(Math.fround(paquetTravee(1, 1))).toBe(paquetTravee(1, 1))
  })

  it('sans glace, rien : ni travée ni ouverture', () => {
    const { xs, zs } = joue(() => null, 30)
    expect(xs.every((x) => x === 0)).toBe(true)
    expect(zs.every((z) => z === 0)).toBe(true)
  })

  it('la glace qui traverse l’ouvre d’un geste, sans rebond marqué', () => {
    const { xs } = joue(() => [0.4, 0.6], 60)
    expect(xs[59]).toBeGreaterThan(0.95)
    expect(Math.max(...xs)).toBeLessThan(1.15)
  })

  it('la glace sortie, les lanières repassent l’aplomb, se balancent, puis tout s’efface', () => {
    const { xs, zs } = joue((k) => (k < 60 ? [0.4, 0.6] : null), 60 + 5 * 60)
    const apres = xs.slice(60)
    // le premier aller dépasse l'aplomb d'un bon tiers de l'ouverture
    expect(Math.min(...apres.slice(0, 45))).toBeLessThan(-0.3)
    // et revient : au moins un second passage du côté ouvert
    expect(Math.max(...apres.slice(20, 90))).toBeGreaterThan(0.05)
    // éteint en quelques secondes : la mémoire est rendue
    expect(zs[zs.length - 1]).toBe(0)
    expect(xs[xs.length - 1]).toBe(0)
  })

  it('SANS À-COUP : une glace vue une image sur deux ne fait pas sauter les lanières', () => {
    // le reproche (27/09) : le mouvement suivait le bruit de la détection
    const { xs } = joue((k) => (k % 2 === 0 ? [0.4, 0.6] : null), 120)
    let saut = 0
    for (let k = 1; k < xs.length; k++) saut = Math.max(saut, Math.abs(xs[k] - xs[k - 1]))
    // le plus grand pas d'une image à la suivante, sur toute l'ouverture
    expect(saut).toBeLessThan(0.08)
  })

  it('un passage en cours élargit sa travée ; un nouveau repart de la sienne', () => {
    const { zs } = joue((k) => (k < 30 ? [0.2, 0.3] : k < 60 ? [0.25, 0.4] : null), 60)
    const [a, b] = depaquetTravee(zs[59])!
    expect(a).toBeCloseTo(0.2, 2)
    expect(b).toBeCloseTo(0.4, 2)
    const neuf = joue((k) => (k < 30 ? [0.1, 0.2] : k < 600 ? null : [0.7, 0.8]), 601)
    expect(depaquetTravee(neuf.zs[600])![0]).toBeCloseTo(0.7, 2)
  })

  it('chaque rideau a son ressort', () => {
    const s = new SuiviRideaux()
    const a = rideau(0, 0, 400, 60)
    const b = rideau(0, 100, 400, 160)
    s.aux(a, [0.1, 0.2], 0)
    expect(s.aux(b, null, 0.5)).toEqual([0, 0])
  })

  it('le shader lit le ressort, et ne tire plus l’ouverture du champ du fluide', () => {
    const src = readFileSync(new URL('./renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/const float RD_OUVERTURE = \$\{f\(B\.ouverture\)\};/)
    expect(src).toMatch(/vec2 rdTravee\(float z\)/)
    expect(src).toMatch(/rideauRendu\([^;]*uBoxAux\[bi\]\.z, uBoxAux\[bi\]\.w\)/)
    expect(src).toMatch(/this\.suiviRideaux\.aux\(bx, traveeGlace\(/)
    const f = src.slice(src.indexOf('vec4 rideauRendu('), src.indexOf('vec4 atlasChaud('))
    expect(f).toMatch(/RD_OUVERTURE \* p \* wR/)
    expect(f).not.toMatch(/float glace =/)
  })
})
