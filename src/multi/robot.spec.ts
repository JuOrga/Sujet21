import { describe, expect, it } from 'vitest'
import { Hote } from './partie'
import { Robot } from './robot'
import { ARENE } from './sumo'
import { MODE_HOCKEY, MODE_LIBRE, MODE_SUMO, PHASE_DECOMPTE, PHASE_JEU } from './trame'

/** Un hasard qui se rejoue : les tests n'ont pas à dépendre d'un tirage. */
const graine = (g: number) => (): number => {
  g = (g * 1664525 + 1013904223) >>> 0
  return g / 4294967296
}
/** Fait jouer `secondes` au plus, le robot aux commandes de son corps ;
 *  s'arrête dès que `fini` le dit. Rend le temps simulé écoulé. */
const joue = (h: Hote, robots: Robot[], secondes: number, fini: (h: Hote) => boolean): number => {
  const dt = h.params.dt
  for (let s = 0; s < secondes * 120; s++) {
    for (const r of robots) h.commande(r.joueur, r.commande(h, dt))
    h.avance(dt, 1e9)
    if (fini(h)) return s / 120
  }
  return secondes
}

describe('robot — il joue avec les commandes d’un joueur', () => {
  it('pendant le décompte, il ne demande rien', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    const r = new Robot(1, graine(1))
    expect(h.jeu()!.phase).toBe(PHASE_DECOMPTE)
    expect(r.commande(h, h.params.dt)).toMatchObject({ pousse: false, ouvert: false, dash: false })
  })

  it('en partie libre il n’y a rien à gagner : il ne fait rien', () => {
    const h = new Hote(2, undefined, MODE_LIBRE)
    const r = new Robot(1, graine(1))
    for (let s = 0; s < 240; s++) {
      h.commande(1, r.commande(h, h.params.dt))
      h.avance(h.params.dt, 1e9)
    }
    expect(h.sim.corps[1].playerCount).toBe(900)
    expect(Math.abs(h.sim.corps[1].stats.velX)).toBeLessThan(5)
  })

  it('sa visée dit où ALLER, hors de son corps (sinon pousser le rassemblerait)', () => {
    const h = new Hote(2, undefined, MODE_SUMO)
    const r = new Robot(1, graine(1))
    joue(h, [r], 4, (x) => x.jeu()!.phase === PHASE_JEU)
    let pousse = 0
    for (let s = 0; s < 60; s++) {
      const c = r.commande(h, h.params.dt)
      h.commande(1, c)
      h.avance(h.params.dt, 1e9)
      expect(c.aller).toBe(true)
      const coeur = h.sim.corps[1].stats
      if (c.pousse) {
        pousse++
        expect(Math.hypot(c.x - coeur.centroidX, c.y - coeur.centroidY)).toBeGreaterThan(250)
      }
    }
    expect(pousse).toBeGreaterThan(10)
  })
})

describe('robot — au hockey', () => {
  it('il va prendre le palet, puis il marque contre un adversaire immobile', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    const r = new Robot(0, graine(7))
    // il le prend dans les dix premières secondes…
    const prise = joue(h, [r], 12, (x) => x.jeu()!.tenuPar === 0)
    expect(h.jeu()!.tenuPar).toBe(0)
    expect(prise).toBeLessThan(10)
    // …et marque dans la demi-minute (mesuré : premier but à 14 s)
    joue(h, [r], 30, (x) => x.jeu()!.scores[0] > 0)
    expect(h.jeu()!.scores[0]).toBe(1)
    // sans y laisser son corps
    expect(h.sim.corps[0].playerCount).toBeGreaterThan(600)
  })

  it('il vient reprendre le palet à celui qui le porte', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    const r = new Robot(1, graine(3))
    // le joueur 0 s'ouvre sur place : le palet, à 215 u, lui arrive dessus
    h.commande(0, { pousse: false, ouvert: true, x: 0, y: 0 })
    joue(h, [], 4, (x) => x.jeu()!.phase === PHASE_JEU)
    h.sim.palet.vx = -500
    joue(h, [], 3, (x) => x.jeu()!.tenuPar === 0)
    expect(h.jeu()!.tenuPar).toBe(0)
    // le robot fonce : le porteur perd le palet avant qu'il ne lui échappe
    // de lui-même (trois secondes)
    const t = joue(h, [r], 2.6, (x) => x.jeu()!.tenuPar !== 0)
    expect(h.jeu()!.tenuPar).not.toBe(0)
    expect(t).toBeLessThan(2.5)
  })
})

describe('robot — au sumo', () => {
  it('il sort un adversaire immobile de l’anneau, d’un côté comme de l’autre', () => {
    for (const place of [0, 1]) {
      const h = new Hote(2, undefined, MODE_SUMO)
      const r = new Robot(place, graine(5))
      // mesuré : la manche est gagnée à 5 s (décompte compris)
      const t = joue(h, [r], 12, (x) => x.jeu()!.scores[place] > 0)
      expect(h.jeu()!.scores[place]).toBe(1)
      expect(h.jeu()!.scores[1 - place]).toBe(0)
      expect(t).toBeLessThan(10)
    }
  })

  it('en poussant l’autre dehors, il ne sort pas lui-même', () => {
    const h = new Hote(2, undefined, MODE_SUMO)
    const r = new Robot(1, graine(9))
    joue(h, [], 4, (x) => x.jeu()!.phase === PHASE_JEU)
    const cx = (ARENE.minX + ARENE.maxX) / 2
    const cy = (ARENE.minY + ARENE.maxY) / 2
    // de combien son cœur a dépassé l'anneau, au pire (négatif : resté dedans)
    let auPire = -Infinity
    joue(h, [r], 10, (x) => {
      if (x.jeu()!.phase !== PHASE_JEU) return true
      const c = x.sim.corps[1].stats
      auPire = Math.max(auPire, Math.hypot(c.centroidX - cx, c.centroidY - cy) - x.jeu()!.anneau)
      return false
    })
    // la manche est finie, c'est lui qui l'a gagnée, et il n'a jamais été dehors
    expect(h.jeu()!.scores).toEqual([0, 1])
    expect(auPire).toBeLessThan(0)
  })
})
