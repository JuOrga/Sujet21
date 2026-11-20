import { describe, expect, it } from 'vitest'
import { commandeManette, litManette, nouvelEtatManette, type PadLu } from './manetteMulti'
import { Hote } from './partie'
import { MODE_HOCKEY, decodeCommande, encodeCommande } from './trame'

/** Une fausse manette : le stick gauche, et les boutons tenus. */
const pad = (ax: number, ay: number, ...tenus: number[]): PadLu => ({
  axes: [ax, ay, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: tenus.includes(i), value: tenus.includes(i) ? 1 : 0 })),
})
const A = 0
const LB = 4
const LT = 6
const RT = 7
const START = 9

describe('manette du multi — la lecture', () => {
  it('le stick donne la direction et l’inclinaison, au-delà de la zone morte', () => {
    const e = nouvelEtatManette()
    litManette(pad(0.1, 0.05), e)
    expect(e.force).toBe(0)
    expect(e.vie).toBe(false)
    litManette(pad(0, -1), e)
    expect(e.force).toBe(1)
    expect(e.dirX).toBeCloseTo(0, 6)
    expect(e.dirY).toBeCloseTo(-1, 6)
    expect(e.vie).toBe(true)
  })

  it('relâché, le stick garde sa dernière direction', () => {
    const e = nouvelEtatManette()
    litManette(pad(-0.8, 0), e)
    litManette(pad(0, 0), e)
    expect(e.force).toBe(0)
    expect(e.dirX).toBeCloseTo(-1, 6)
  })

  it('A ou RT poussent, LT ou LB ouvrent', () => {
    const e = nouvelEtatManette()
    for (const b of [A, RT]) {
      litManette(pad(0, 0, b), e)
      expect(e.pousse).toBe(true)
      expect(e.ouvert).toBe(false)
    }
    for (const b of [LT, LB]) {
      litManette(pad(0, 0, b), e)
      expect(e.ouvert).toBe(true)
      expect(e.pousse).toBe(false)
    }
  })

  it('Start recommence UNE fois par appui, même tenu', () => {
    const e = nouvelEtatManette()
    litManette(pad(0, 0, START), e)
    expect(e.recommence).toBe(true)
    litManette(pad(0, 0, START), e)
    expect(e.recommence).toBe(false)
    litManette(pad(0, 0), e)
    litManette(pad(0, 0, START), e)
    expect(e.recommence).toBe(true)
  })

  it('débranchée en pleine poussée : plus rien n’est tenu', () => {
    const e = nouvelEtatManette()
    litManette(pad(1, 0, A, LT), e)
    litManette(null, e)
    expect(e.connectee).toBe(false)
    expect(e.pousse).toBe(false)
    expect(e.ouvert).toBe(false)
    expect(e.force).toBe(0)
  })
})

describe('manette du multi — la commande', () => {
  it('on vise HORS de son corps, du côté du stick, et la visée dit où aller', () => {
    const e = nouvelEtatManette()
    litManette(pad(1, 0, A), e)
    const c = commandeManette(e, 1000, 500)
    expect(c.aller).toBe(true)
    expect(c.pousse).toBe(true)
    expect(c.y).toBeCloseTo(500, 6)
    // au-delà du corps (~105 u de rayon) : sinon pousser rassemblerait
    expect(c.x - 1000).toBeGreaterThan(200)
  })

  it('stick au repos et A tenu : on vise son propre cœur — se rassembler', () => {
    const e = nouvelEtatManette()
    litManette(pad(0, 0, A), e)
    expect(commandeManette(e, 1000, 500)).toMatchObject({ pousse: true, x: 1000, y: 500 })
  })

  it('stick au repos, rien de tenu : on ne pousse pas, mais la visée reste où elle était', () => {
    const e = nouvelEtatManette()
    litManette(pad(0, 1), e)
    litManette(pad(0, 0), e)
    const c = commandeManette(e, 1000, 500)
    expect(c.pousse).toBe(false)
    expect(c.y - 500).toBeGreaterThan(200)
  })

  it('le sens « où aller » voyage dans la trame', () => {
    for (const aller of [true, false]) {
      const lu = decodeCommande(encodeCommande(3, { pousse: true, ouvert: false, x: 10, y: 20, aller }))!
      expect(lu.commande.aller).toBe(aller)
    }
  })
})

describe('manette du multi — chez l’hôte', () => {
  const pas = (h: Hote, n: number): void => {
    for (let s = 0; s < n; s++) h.avance(h.params.dt, 1e9)
  }

  it('pousser le stick à droite fait ALLER à droite ; à la souris, viser à droite fait aller à gauche', () => {
    const vitesse = (aller: boolean): number => {
      const h = new Hote(2)
      pas(h, 30)
      const c = h.sim.corps[0].stats
      for (let s = 0; s < 120; s++) {
        h.commande(0, { pousse: true, ouvert: false, x: c.centroidX + 300, y: c.centroidY, aller })
        pas(h, 1)
      }
      return h.sim.corps[0].stats.velX
    }
    expect(vitesse(true)).toBeGreaterThan(25)
    expect(vitesse(false)).toBeLessThan(-25)
  })

  it('au hockey, le palet part du côté où pointe le stick', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 60)
    const e = nouvelEtatManette()
    const commande = (p: PadLu): void => {
      litManette(p, e)
      const c = h.sim.corps[1].stats
      h.commande(1, commandeManette(e, c.centroidX, c.centroidY))
    }
    // LT tenu : le corps 1 s'ouvre, le palet lui arrive dessus
    h.sim.palet.vx = 600
    for (let s = 0; s < 360 && h.hockey!.tenuPar !== 1; s++) {
      commande(pad(0, 0, LT))
      pas(h, 1)
    }
    expect(h.hockey!.tenuPar).toBe(1)
    // le stick vers le HAUT, on tient, puis on relâche LT
    for (let s = 0; s < 150; s++) {
      commande(pad(0, -1, LT))
      pas(h, 1)
    }
    commande(pad(0, -1))
    pas(h, 1)
    expect(h.hockey!.tenuPar).toBe(-1)
    expect(h.sim.palet.vy).toBeLessThan(-1200)
    expect(Math.abs(h.sim.palet.vx)).toBeLessThan(200)
  })
})
