import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function corps(n: number): FluidSim {
  const s = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
  s.setLevel([], [])
  s.spawnDisc(0, 0, n, KIND_PLAYER)
  s.relabel()
  return s
}

function avance(s: FluidSim, secondes: number, geste?: () => void): void {
  const dt = s.params.dt
  for (let t = 0; t < secondes; t += dt) {
    geste?.()
    s.step(dt)
  }
}

describe('la coupelle boit jusqu’au trait, puis se ferme', () => {
  it('posée sous le corps, elle boit EXACTEMENT sa capacité — pas une goutte de plus', () => {
    const s = corps(400)
    const avant = s.aliveCount()
    s.setCoupelles([{ x: 0, y: 0, r: 60, capacite: 30 }])
    avance(s, 0.5)
    s.relabel()
    expect(s.coupelles[0].pleine).toBe(true)
    expect(s.coupelles[0].bu).toBe(30)
    expect(s.aliveCount()).toBe(avant - 30)
    // pleine, elle ne boit plus rien
    avance(s, 0.5)
    s.relabel()
    expect(s.coupelles[0].bu).toBe(30)
    expect(s.aliveCount()).toBe(avant - 30)
  })

  it('elle boit les gouttes du JET : le corps paie à distance, sans y entrer', () => {
    const s = corps(400)
    s.setCoupelles([{ x: 600, y: 0, r: 60, capacite: 20 }])
    avance(s, 2, () => s.eject(600, 0, s.params.dt))
    s.updatePlayerStats()
    expect(s.coupelles[0].pleine).toBe(true)
    expect(s.coupelles[0].bu).toBe(20)
    // le recul a poussé le corps à l'opposé : il ne s'est jamais approché
    expect(s.stats.centroidX).toBeLessThan(0)
  })

  it('la glace la traverse sans payer', () => {
    const s = corps(400)
    s.freezeIntent = true
    avance(s, 1.5) // le corps gèle d'abord, hors de toute coupelle
    s.setCoupelles([{ x: 0, y: 0, r: 60, capacite: 30 }])
    avance(s, 0.5)
    expect(s.coupelles[0].bu).toBe(0)
  })

  it('la vapeur la traverse sans payer', () => {
    const s = corps(400)
    s.naitEnVapeur()
    s.setCoupelles([{ x: 0, y: 0, r: 80, capacite: 30 }])
    s.gasIntent = true
    avance(s, 0.3)
    expect(s.coupelles[0].bu).toBe(0)
  })

  it('le couvercle attend que la bouche soit vide : jamais au milieu du corps', () => {
    const s = corps(400)
    s.setCoupelles([{ x: 0, y: 0, r: 60, capacite: 30 }])
    avance(s, 0.3)
    // le trait est payé, mais le corps est encore dans la bouche
    expect(s.coupelles[0].pleine).toBe(true)
    expect(s.coupelles[0].fermee).toBe(false)
    // le corps s'en va : la bouche se vide, le couvercle tombe
    s.lanceCorps(900, 0)
    avance(s, 1.5)
    expect(s.coupelles[0].fermee).toBe(true)
  })

  it('la copie de prévision emporte l’état des coupelles', () => {
    const s = corps(300)
    s.setCoupelles([{ x: 0, y: 0, r: 60, capacite: 10 }])
    avance(s, 0.3)
    const c = s.copiePourPrevision()
    expect(c.coupelles).toEqual(s.coupelles)
    expect(c.coupelles[0]).not.toBe(s.coupelles[0]) // une copie, pas un alias
  })
})
