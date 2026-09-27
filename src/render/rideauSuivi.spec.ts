import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { RIDEAU_BALANCE, SuiviRideaux, depaquetTravee, paquetTravee, traveeGlace } from './rideauSuivi'
import { MAT_RIDEAU, type ObstacleBox } from '../game/level'

// LE BALANCEMENT À LA FERMETURE : le shader ne se souvient de rien d'une
// image à l'autre. Le rendu retient où la glace a traversé le rideau et
// depuis quand elle en est sortie — c'est ce qu'on vérifie ici.
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

describe('rideau — la mémoire du balancement', () => {
  it('empaquetée dans un flottant, relue par le jumeau du shader', () => {
    const [a, b] = depaquetTravee(paquetTravee(0.25, 0.8))!
    expect(a).toBeCloseTo(0.25, 2)
    expect(b).toBeCloseTo(0.8, 2)
    expect(depaquetTravee(0)).toBeNull()
    // moins de 2^24 : exact en float32
    expect(Math.fround(paquetTravee(1, 1))).toBe(paquetTravee(1, 1))
  })

  it('pendant le passage : pas d’âge ; la glace sortie : l’âge court, puis tout s’efface', () => {
    const s = new SuiviRideaux()
    const b = rideau(0, 0, 400, 60)
    expect(s.aux(b, null, 0)).toEqual([0, -1])
    expect(s.aux(b, [0.2, 0.3], 1)[1]).toBe(-1)
    // le bloc glisse en traversant : la travée s'élargit
    const [z] = s.aux(b, [0.25, 0.4], 1.1)
    expect(depaquetTravee(z)![0]).toBeCloseTo(0.2, 2)
    expect(depaquetTravee(z)![1]).toBeCloseTo(0.4, 2)
    // sortie à 1,2 s
    expect(s.aux(b, null, 1.2)[1]).toBe(0)
    expect(s.aux(b, null, 2.2)[1]).toBeCloseTo(1, 6)
    expect(s.aux(b, null, 1.2 + RIDEAU_BALANCE.duree + 0.01)).toEqual([0, -1])
  })

  it('une nouvelle glace pendant le balancement repart d’une travée neuve', () => {
    const s = new SuiviRideaux()
    const b = rideau(0, 0, 400, 60)
    s.aux(b, [0.1, 0.2], 0)
    s.aux(b, null, 0.5)
    const [z, w] = s.aux(b, [0.7, 0.8], 1)
    expect(w).toBe(-1)
    expect(depaquetTravee(z)![0]).toBeCloseTo(0.7, 2)
  })

  it('chaque rideau a sa mémoire', () => {
    const s = new SuiviRideaux()
    const a = rideau(0, 0, 400, 60)
    const b = rideau(0, 100, 400, 160)
    s.aux(a, [0.1, 0.2], 0)
    expect(s.aux(b, null, 0.5)).toEqual([0, -1])
  })

  it('le shader relit la mémoire du rideau, et interpole ses constantes', () => {
    const src = readFileSync(new URL('./renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/const float RD_AMPLITUDE = \$\{f\(B\.amplitude\)\};/)
    expect(src).toMatch(/const float RD_AMORTI = \$\{f\(B\.amorti\)\};/)
    expect(src).toMatch(/vec2 rdTravee\(float z\)/)
    expect(src).toMatch(/rideauRendu\([^;]*uBoxAux\[bi\]\.z, uBoxAux\[bi\]\.w\)/)
    expect(src).toMatch(/this\.suiviRideaux\.aux\(bx, traveeGlace\(/)
  })
})
