import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { SuiviRideaux, TRAVEE_SENS, depaquetTravee, paquetTravee, traveeGlace, type Travee } from './rideauSuivi'
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

  it('son TRAVERS moyen dit de quel côté la glace se présente', () => {
    // un rideau couché, épais de 60 : la glace devant sa face basse (y petit),
    // puis devant sa face haute — marge comprise, hors de 0..1
    const b = rideau(100, 0, 500, 60)
    const bas = grains([
      [200, -6, 1],
      [220, 6, 1],
    ])
    const haut = grains([[200, 66, 1]])
    expect(traveeGlace(b, bas.x, bas.y, bas.gele, bas.n)![2]).toBeCloseTo(0, 6)
    expect(traveeGlace(b, haut.x, haut.y, haut.gele, haut.n)![2]).toBeCloseTo(1.1, 6)
    // debout : le travers se lit en x
    const g = grains([[30, 300, 1]])
    expect(traveeGlace(rideau(0, 0, 40, 1000), g.x, g.y, g.gele, g.n)![2]).toBeCloseTo(0.75, 6)
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
function joue(glace: (k: number) => Travee | null, images: number) {
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
  it('empaquetée dans un flottant (milieu, demi-largeur), relue par le jumeau du shader', () => {
    const [a, b] = depaquetTravee(paquetTravee(0.25, 0.8))!
    expect(a).toBeCloseTo(0.25, 2)
    expect(b).toBeCloseTo(0.8, 2)
    expect(depaquetTravee(0)).toBeNull()
    // moins de 2^24 : exact en float32
    expect(Math.fround(paquetTravee(1, 1))).toBe(paquetTravee(1, 1))
  })

  it('le SENS du passage voyage dans le même paquet, sans rien changer au reste', () => {
    // vers les t croissants : le paquet d'avant, tel quel
    expect(depaquetTravee(paquetTravee(0.25, 0.8))![2]).toBe(1)
    expect(paquetTravee(0.25, 0.8, 1)).toBe(paquetTravee(0.25, 0.8))
    const [c, hw, sens] = depaquetTravee(paquetTravee(0.25, 0.8, -1))!
    expect(c).toBeCloseTo(0.25, 2)
    expect(hw).toBeCloseTo(0.8, 2)
    expect(sens).toBe(-1)
    // le sens pèse plus que tout ce que le milieu et la demi-largeur écrivent
    expect(paquetTravee(1, 1)).toBeLessThanOrEqual(TRAVEE_SENS)
    expect(Math.fround(paquetTravee(1, 1, -1))).toBe(paquetTravee(1, 1, -1))
  })

  it('le sens se lit à l’ARRIVÉE de la glace, puis reste figé tout le passage', () => {
    const sens = (zs: number[]) => zs.filter((z) => z > 0).map((z) => depaquetTravee(z)![2])
    // elle se présente du côté des t petits (travers 0,1) et sort de l'autre
    // (0,9), puis s'en va : les lanières partent vers les t grands, et le
    // balancement qui suit ne les renvoie pas d'un coup de l'autre côté
    const monte = joue((k) => (k < 60 ? [0.4, 0.6, 0.1 + (0.8 * k) / 59] : null), 200)
    expect(new Set(sens(monte.zs))).toEqual(new Set([1]))
    const descend = joue((k) => (k < 60 ? [0.4, 0.6, 0.9 - (0.8 * k) / 59] : null), 200)
    expect(new Set(sens(descend.zs))).toEqual(new Set([-1]))
    // le ressort, lui, est le même dans les deux sens
    expect(descend.xs).toEqual(monte.xs)
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

  it('un passage en cours élargit sa travée autour du MÊME milieu, en douceur', () => {
    // le bloc glisse le long du rideau en le traversant : 0,2..0,3 puis 0,25..0,4
    const { zs } = joue((k) => (k < 30 ? [0.2, 0.3] : k < 90 ? [0.25, 0.4] : null), 90)
    const milieux = zs.slice(5, 90).map((z) => depaquetTravee(z)![0])
    // le milieu ne bouge pas : aucune lanière ne change de côté (revue, 29/09)
    expect(Math.max(...milieux) - Math.min(...milieux)).toBeLessThan(0.002)
    const demi = zs.map((z) => depaquetTravee(z)![1])
    expect(demi[89]).toBeCloseTo(0.15, 2)
    // la demi-largeur rejoint la glace sans sauter
    let saut = 0
    for (let k = 31; k < 90; k++) saut = Math.max(saut, demi[k] - demi[k - 1])
    expect(saut).toBeLessThan(0.02)
  })

  it('une glace qui traverse AILLEURS pendant le balancement repart de sa travée, fermée', () => {
    // 0,1..0,2 une seconde, sortie, puis 0,8..0,9 pendant le balancement
    const { xs, zs } = joue((k) => (k < 60 ? [0.1, 0.2] : k < 80 ? null : [0.8, 0.9]), 81)
    expect(Math.abs(xs[79])).toBeGreaterThan(0.1) // le balancement était en cours
    const [c, hw] = depaquetTravee(zs[80])!
    expect(c).toBeCloseTo(0.85, 2)
    expect(hw).toBeCloseTo(0.05, 2)
    // ses lanières ne naissent pas ouvertes : le ressort repart de zéro
    expect(Math.abs(xs[80])).toBeLessThan(0.05)
  })

  it('un nouveau passage, le ressort au repos, repart de sa travée', () => {
    const neuf = joue((k) => (k < 30 ? [0.1, 0.2] : k < 600 ? null : [0.7, 0.8]), 601)
    expect(depaquetTravee(neuf.zs[600])![0]).toBeCloseTo(0.75, 2)
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
    expect(src).toMatch(/vec3 rdTravee\(float z\)/)
    expect(src).toMatch(/const float RD_TRAVEE_SENS = \$\{f\(TRAVEE_SENS\)\};/)
    // les trois dessins du rideau lisent la même mémoire : la porte sur la
    // tranche, le dessus vu d'en haut, et la porte couchée du relief éteint
    expect(src).toMatch(/rideauRendu\([^;]*uBoxAux\[bi\]\.z, uBoxAux\[bi\]\.w\)/)
    expect(src).toMatch(/rideauDessus\([^;]*uBoxAux\[bi\]\.z, uBoxAux\[bi\]\.w\)/)
    expect(src).toMatch(/rideauTranche\([^;]*uBoxAux\[bi\]\.z, uBoxAux\[bi\]\.w\)/)
    expect(src).toMatch(/this\.suiviRideaux\.aux\(bx, traveeGlace\(/)
    const f = src.slice(src.indexOf('vec4 rideauFace('), src.indexOf('vec4 atlasChaud('))
    expect(f).toMatch(/RD_OUVERTURE \* p \* wR/)
    expect(f).not.toMatch(/float glace =/)
    // vue d'en haut, la lanière sort du côté où la glace s'en va
    expect(f).toMatch(/cote \* trav\.z \* wR/)
  })
})
