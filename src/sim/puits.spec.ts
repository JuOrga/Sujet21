import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { periodeCoeur, potentielPuits, vitesseCirculaire } from '../game/puits'
import type { PuitsDef } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const PUITS: PuitsDef = { x: 0, y: 0, force: 540, rayon: 300 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  const s = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  s.setLevel([], [])
  return s
}

/** Fait tourner `seconds` de physique sous les puits, comme le jeu : le
 *  champ avant le pas. */
function orbite(s: FluidSim, puits: PuitsDef[], seconds: number, chaque?: (t: number) => void): void {
  const dt = s.params.dt
  const steps = Math.round(seconds / dt)
  for (let k = 0; k < steps; k++) {
    s.applyPuits(puits, dt)
    s.step(dt)
    if (chaque) chaque((k + 1) * dt)
  }
}

describe('FluidSim.applyPuits — la seule accélération pure du solveur', () => {
  it('une particule lancée à la vitesse circulaire au bord du cœur y reste, trois périodes durant, et revient à son point', () => {
    const s = makeSim()
    const R = 300
    const i = s.addParticle(R, 0, KIND_FREE)
    s.velY[i] = vitesseCirculaire(PUITS, R)
    const T = periodeCoeur(PUITS)
    let rMin = Infinity
    let rMax = 0
    orbite(s, [PUITS], 3 * T, () => {
      const r = Math.hypot(s.posX[i], s.posY[i])
      rMin = Math.min(rMin, r)
      rMax = Math.max(rMax, r)
    })
    expect(rMin).toBeGreaterThan(R * 0.95)
    expect(rMax).toBeLessThan(R * 1.05)
    // après trois périodes entières, elle est de retour près de (R, 0)
    expect(Math.hypot(s.posX[i] - R, s.posY[i])).toBeLessThan(R * 0.08)
  })

  it('l’énergie d’une particule libre (v²/2 + Φ) dérive de moins de 2 % sur trois périodes', () => {
    const s = makeSim()
    const i = s.addParticle(150, 0, KIND_FREE)
    s.velY[i] = 250 // une ellipse, pas un cercle
    const e0 = (250 * 250) / 2 + potentielPuits([PUITS], 150, 0)
    let eMax = 0
    orbite(s, [PUITS], 3 * periodeCoeur(PUITS), () => {
      const e = (s.velX[i] ** 2 + s.velY[i] ** 2) / 2 + potentielPuits([PUITS], s.posX[i], s.posY[i])
      eMax = Math.max(eMax, Math.abs(e - e0))
    })
    expect(eMax / e0).toBeLessThan(0.02)
  })

  /** Un corps lancé en orbite circulaire à la distance r : ce qu'il garde
   *  de lui-même après `seconds`, et l'excursion de son rayon. */
  function corpsEnOrbite(r: number, n: number, seconds: number): { garde: number; rMin: number; rMax: number; dispersed: boolean } {
    const s = makeSim()
    s.spawnDisc(r, 0, n, KIND_PLAYER)
    s.lanceCorps(0, vitesseCirculaire(PUITS, r))
    let rMin = Infinity
    let rMax = 0
    orbite(s, [PUITS], seconds, () => {
      s.updatePlayerStats()
      const rr = Math.hypot(s.stats.centroidX, s.stats.centroidY)
      rMin = Math.min(rMin, rr)
      rMax = Math.max(rMax, rr)
    })
    s.relabel()
    return { garde: s.playerCount / n, rMin, rMax, dispersed: s.dispersed }
  }

  it('DANS LE CŒUR, un corps lancé en orbite reste entier (la marée harmonique le comprime) et tient son rayon à ±3 %', () => {
    const r = 200 // 0,67 rayon
    const petit = corpsEnOrbite(r, 400, 4)
    expect(petit.dispersed).toBe(false)
    expect(petit.garde).toBeGreaterThan(0.97)
    expect(petit.rMin).toBeGreaterThan(r * 0.97)
    expect(petit.rMax).toBeLessThan(r * 1.03)
    const gros = corpsEnOrbite(r, 900, 4)
    expect(gros.garde).toBeGreaterThan(0.97)
    expect(gros.rMax).toBeLessThan(r * 1.03)
  })

  it('À LA LISIÈRE DU CŒUR, le corps se déchire : le halo étire, la règle de conception en découle (orbiter à moins de 0,8 rayon)', () => {
    // mesuré le 17/09 : 55 % gardés à 4 s pour 400 comme pour 900 particules —
    // ce test garde le phénomène, pas une valeur : si la loi change et que
    // la lisière cesse de déchirer, la règle de conception peut s'assouplir
    const bord = corpsEnOrbite(300, 400, 4)
    expect(bord.garde).toBeLessThan(0.8)
    expect(bord.dispersed).toBe(false)
  })

  it('un bloc de glace orbite aussi : la moyenne d’icePass porte la traction', () => {
    const s = makeSim()
    const R = 200
    s.spawnDisc(R, 0, 120, KIND_PLAYER)
    s.freezeIntent = true
    const v = vitesseCirculaire(PUITS, R)
    for (let i = 0; i < s.count; i++) {
      s.frozen[i] = 1
      s.frost[i] = 1
      s.velY[i] = v
    }
    s.relabel()
    let rMin = Infinity
    let rMax = 0
    orbite(s, [PUITS], 2, () => {
      s.updatePlayerStats()
      const r = Math.hypot(s.stats.centroidX, s.stats.centroidY)
      rMin = Math.min(rMin, r)
      rMax = Math.max(rMax, r)
    })
    expect(rMin).toBeGreaterThan(R * 0.85)
    expect(rMax).toBeLessThan(R * 1.15)
    // et elle a bien tourné : elle n'est plus sur son axe de départ
    expect(Math.abs(s.stats.centroidY)).toBeGreaterThan(50)
  })

  it('deux puits se superposent : au point d’équilibre rien ne bouge ; hors portée, rien non plus', () => {
    const s = makeSim()
    const deux: PuitsDef[] = [{ ...PUITS, x: -300 }, { ...PUITS, x: 300 }]
    const i = s.addParticle(0, 0, KIND_FREE)
    orbite(s, deux, 1)
    expect(Math.abs(s.posX[i])).toBeLessThan(1)
    expect(Math.abs(s.posY[i])).toBeLessThan(1)
    const t = makeSim()
    const borne: PuitsDef = { ...PUITS, portee: 500 }
    const j = t.addParticle(700, 0, KIND_FREE)
    orbite(t, [borne], 1)
    expect(t.posX[j]).toBeCloseTo(700, 3)
  })
})

describe('FluidSim.copiePourPrevision — une copie qui avance comme l’original', () => {
  it('la copie prise en vol suit le même centre que l’original sur une seconde, et ne le touche pas', () => {
    const s = makeSim()
    s.setLevel([{ minX: 600, minY: -400, maxX: 700, maxY: 400, material: 0 }], [])
    s.spawnDisc(150, 0, 300, KIND_PLAYER)
    s.lanceCorps(0, vitesseCirculaire(PUITS, 150))
    orbite(s, [PUITS], 0.5)
    const c = s.copiePourPrevision()
    expect(c.count).toBe(s.count)
    expect(c.playerCount).toBe(s.playerCount)
    const dt = s.params.dt
    // l'original ne bouge pas pendant que la copie avance : une somme de
    // contrôle de ses positions, prise avant, retrouvée après
    const somme = (a: Float32Array): number => a.subarray(0, s.count).reduce((t, v) => t + v, 0)
    const sommeAvant = somme(s.posX) + somme(s.posY) + somme(s.velX)
    for (let k = 0; k < Math.round(1 / dt); k++) {
      c.applyPuits([PUITS], dt)
      c.step(dt)
    }
    c.updatePlayerStats()
    expect(somme(s.posX) + somme(s.posY) + somme(s.velX)).toBe(sommeAvant)
    orbite(s, [PUITS], 1)
    s.updatePlayerStats()
    expect(Math.hypot(c.stats.centroidX - s.stats.centroidX, c.stats.centroidY - s.stats.centroidY)).toBeLessThan(2)
    expect(c.dispersed).toBe(false)
  })
})
