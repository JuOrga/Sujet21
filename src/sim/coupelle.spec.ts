import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { champCoupelle, COUPELLE_DEBIT } from '../game/coupelle'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function corps(n: number, x = 0, y = 0): FluidSim {
  const s = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
  s.setLevel([], [])
  s.spawnDisc(x, y, n, KIND_PLAYER)
  s.relabel()
  return s
}

/** Une coupelle telle que le jeu la pose : le champ de son aspiration, le débit. */
function coupelle(x: number, y: number, r: number, capacite: number, aspiration?: number) {
  return { x, y, r, capacite, ...champCoupelle(r, aspiration), debit: COUPELLE_DEBIT }
}

function avance(s: FluidSim, secondes: number, geste?: () => void): void {
  const dt = s.params.dt
  for (let t = 0; t < secondes; t += dt) {
    geste?.()
    s.step(dt)
  }
}

describe('la coupelle aspire, boit jusqu’au trait, puis s’arrête', () => {
  it('posée sous le corps, elle boit EXACTEMENT sa capacité — pas une goutte de plus', () => {
    const s = corps(400)
    const avant = s.aliveCount()
    s.setCoupelles([coupelle(0, 0, 60, 30)])
    avance(s, 2)
    s.relabel()
    expect(s.coupelles[0].pleine).toBe(true)
    expect(s.coupelles[0].bu).toBe(30)
    expect(s.aliveCount()).toBe(avant - 30)
    // pleine, elle ne boit plus rien
    avance(s, 1)
    s.relabel()
    expect(s.coupelles[0].bu).toBe(30)
    expect(s.aliveCount()).toBe(avant - 30)
  })

  it('elle boit au DÉBIT, pas d’un coup : l’eau s’écoule, on la voit partir', () => {
    const s = corps(400)
    s.setCoupelles([coupelle(0, 0, 60, 200)])
    avance(s, 0.5)
    // une demi-seconde de débit, plus la courte rafale de la réserve
    const plafond = COUPELLE_DEBIT * 0.5 + COUPELLE_DEBIT * 0.25 + 2
    expect(s.coupelles[0].bu).toBeGreaterThan(0)
    expect(s.coupelles[0].bu).toBeLessThanOrEqual(plafond)
    expect(s.coupelles[0].pleine).toBe(false)
    avance(s, 3)
    expect(s.coupelles[0].pleine).toBe(true)
  })

  it('elle boit les gouttes du JET : le corps paie à distance, sans y entrer', () => {
    const s = corps(400)
    s.setCoupelles([coupelle(600, 0, 60, 20)])
    avance(s, 2, () => s.eject(600, 0, s.params.dt))
    s.updatePlayerStats()
    expect(s.coupelles[0].pleine).toBe(true)
    expect(s.coupelles[0].bu).toBe(20)
    // le recul a poussé le corps à l'opposé : il ne s'est jamais approché
    expect(s.stats.centroidX).toBeLessThan(0)
  })

  it('son courant ATTIRE le corps qui passe à portée — à aspiration nulle, il ne tire que dans la bouche', () => {
    // le corps (~70 u de rayon) posé à 150 u : hors de la bouche (60 u),
    // dans la portée d'une aspiration pleine (180 u)
    const forte = corps(400, -150, 0)
    forte.setCoupelles([coupelle(0, 0, 60, 300, 1)])
    avance(forte, 1.5)
    forte.updatePlayerStats()
    expect(forte.coupelles[0].bu).toBeGreaterThan(0)
    expect(forte.stats.centroidX).toBeGreaterThan(-150)

    const nulle = corps(400, -150, 0)
    nulle.setCoupelles([coupelle(0, 0, 60, 300, 0)])
    avance(nulle, 1.5)
    expect(nulle.coupelles[0].bu).toBe(0)
  })

  it('pleine, elle n’aspire plus : le corps posé à côté ne bouge pas', () => {
    const s = corps(400, -150, 0)
    s.setCoupelles([coupelle(0, 0, 60, 300, 1)])
    s.coupelles[0].pleine = true
    avance(s, 1.5)
    s.updatePlayerStats()
    expect(Math.abs(s.stats.centroidX + 150)).toBeLessThan(10)
  })

  it('la glace la traverse sans payer', () => {
    const s = corps(400)
    s.freezeIntent = true
    avance(s, 1.5) // le corps gèle d'abord, hors de toute coupelle
    s.setCoupelles([coupelle(0, 0, 60, 30)])
    avance(s, 0.5)
    expect(s.coupelles[0].bu).toBe(0)
  })

  it('la vapeur la traverse sans payer', () => {
    const s = corps(400)
    s.naitEnVapeur()
    s.setCoupelles([coupelle(0, 0, 80, 30)])
    s.gasIntent = true
    avance(s, 0.3)
    expect(s.coupelles[0].bu).toBe(0)
  })

  it('la copie de prévision emporte l’état des coupelles', () => {
    const s = corps(300)
    s.setCoupelles([coupelle(0, 0, 60, 10)])
    avance(s, 0.3)
    const c = s.copiePourPrevision()
    expect(c.coupelles).toEqual(s.coupelles)
    expect(c.coupelles[0]).not.toBe(s.coupelles[0]) // une copie, pas un alias
  })
})
