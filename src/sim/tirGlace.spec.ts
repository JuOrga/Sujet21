import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { ECLAT_MIN, FluidSim, KIND_PLAYER, type Bounds } from './solver'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

/** Un corps entièrement gelé, prêt à tirer. */
function corpsGele(n: number, overrides: Partial<SimParams> = {}): FluidSim {
  const s = new FluidSim({ ...DEFAULT_PARAMS, glaceTir: 0.1, ...overrides }, OPEN, 2048)
  s.setLevel([], [])
  s.spawnDisc(0, 0, n, KIND_PLAYER)
  s.freezeIntent = true
  const dt = s.params.dt
  for (let t = 0; t < 1.5; t += dt) s.step(dt)
  s.relabel()
  return s
}

function avance(s: FluidSim, secondes: number): void {
  const dt = s.params.dt
  for (let t = 0; t < secondes; t += dt) s.step(dt)
}

describe('le tir de glace — un éclat du corps gelé file vers le doigt', () => {
  it('une part du corps part en avant, à la vitesse de pleine puissance ; le corps reste, l’éclat reste glace au-delà du dégel', () => {
    const s = corpsGele(400)
    const avant = s.playerCount
    const n = s.lanceEclat(2000, 0) // loin : pleine puissance
    expect(n).toBe(Math.round(avant * 0.1))
    expect(s.playerCount).toBe(avant - n)
    // l'éclat : les particules libres, gelées, à droite du corps, lancées à glaceTirVitesse
    let libres = 0
    let vx = 0
    let xMin = Infinity
    for (let i = 0; i < s.count; i++) {
      if (s.kind[i] === KIND_PLAYER) continue
      libres++
      vx += s.velX[i]
      xMin = Math.min(xMin, s.posX[i])
      expect(s.frozen[i]).toBe(1)
    }
    expect(libres).toBe(n)
    expect(vx / libres).toBeCloseTo(s.params.glaceTirVitesse, 0)
    expect(xMin).toBeGreaterThan(0)
    // trois secondes plus tard (thawTime = 2,5 s) : toujours glace, toujours libres, partis loin, le corps immobile
    avance(s, 3)
    s.updatePlayerStats()
    let gelesLibres = 0
    let xEclat = 0
    for (let i = 0; i < s.count; i++) {
      if (s.kind[i] === KIND_PLAYER) continue
      if (s.frozen[i] === 1) gelesLibres++
      xEclat += s.posX[i]
    }
    expect(gelesLibres).toBe(n)
    expect(xEclat / n).toBeGreaterThan(1500)
    expect(Math.abs(s.stats.centroidX)).toBeLessThan(30)
    expect(s.dispersed).toBe(false)
  })

  it('à mi-distance, mi-puissance ; sans le réglage ou pas entièrement gelé, rien ne part', () => {
    const s = corpsGele(200)
    const n = s.lanceEclat(s.params.gasDashRange * 0.5, 0)
    expect(n).toBeGreaterThan(0)
    let vx = 0
    for (let i = 0; i < s.count; i++) if (s.kind[i] !== KIND_PLAYER) vx += s.velX[i]
    expect(vx / n).toBeCloseTo(s.params.glaceTirVitesse * 0.5, 0)
    expect(corpsGele(200, { glaceTir: 0 }).lanceEclat(2000, 0)).toBe(0)
    const liquide = new FluidSim({ ...DEFAULT_PARAMS, glaceTir: 0.1 }, OPEN, 2048)
    liquide.setLevel([], [])
    liquide.spawnDisc(0, 0, 200, KIND_PLAYER)
    liquide.relabel()
    expect(liquide.lanceEclat(2000, 0)).toBe(0)
  })

  it('le corps rétrécit sans jamais s’épuiser : les éclats rapetissent, le corps garde son plancher', () => {
    const s = corpsGele(60)
    const tailles: number[] = []
    for (let k = 0; k < 400; k++) {
      const n = s.lanceEclat(2000, 0)
      if (n === 0) break
      tailles.push(n)
      avance(s, 0.2) // l'éclat s'éloigne avant le tir suivant
      s.freezeIntent = true
    }
    expect(tailles.length).toBeGreaterThan(10)
    expect(tailles[0]).toBeGreaterThan(tailles[tailles.length - 1])
    expect(Math.min(...tailles)).toBeGreaterThanOrEqual(1)
    expect(s.playerCount).toBe(ECLAT_MIN)
    expect(s.dispersed).toBe(false)
  })

  it('une mire touchée par un éclat le fait disparaître et rend sa taille ; le corps lui-même ne compte jamais', () => {
    const s = corpsGele(400)
    const mires = [{ x: 900, y: 0, r: 80 }]
    // le corps est loin de la mire : rien
    expect(s.touchesMires(mires)).toEqual([])
    const n = s.lanceEclat(2000, 0)
    const total = s.count
    let touches: { mire: number; taille: number; x: number; y: number }[] = []
    const dt = s.params.dt
    for (let t = 0; t < 3 && touches.length === 0; t += dt) {
      s.step(dt)
      touches = s.touchesMires(mires)
    }
    expect(touches).toHaveLength(1)
    expect(touches[0].mire).toBe(0)
    expect(touches[0].taille).toBe(n)
    expect(Math.abs(touches[0].x - 900)).toBeLessThan(120)
    expect(s.count).toBe(total - n)
    expect(s.playerCount).toBe(400 - n)
    // un corps posé sur une mire : pas une touche (il tient au corps)
    const s2 = corpsGele(200)
    expect(s2.touchesMires([{ x: 0, y: 0, r: 300 }])).toEqual([])
  })
})
