import { describe, expect, it } from 'vitest'
import { Hote, Miroir, salleDe } from './partie'
import { KIND_PLAYER } from './solveurMulti'
import { ARENE, DUREE_MANCHE, MANCHES_POUR_GAGNER, RAYON_ANNEAU, RAYON_FINAL, Sumo } from './sumo'
import { MODE_SUMO, PHASE_BUT, PHASE_DECOMPTE, PHASE_FINI, PHASE_JEU, encodeEtat, litEnteteEtat, modeTrame, particulesVides } from './trame'

const pas = (h: Hote, n: number): void => {
  for (let s = 0; s < n; s++) h.avance(h.params.dt, 1e9)
}
const CX = (ARENE.minX + ARENE.maxX) / 2
const CY = (ARENE.minY + ARENE.maxY) / 2
const sumo = (h: Hote): Sumo => h.regle as Sumo
/** Une manche dont le décompte est passé. */
const enJeu = (): Hote => {
  const h = new Hote(2, undefined, MODE_SUMO)
  pas(h, 60)
  sumo(h).decompte = 0
  pas(h, 1)
  return h
}
/** Donne une vitesse à tout le corps j. */
const lance = (h: Hote, j: number, vx: number): void => {
  const s = h.sim
  for (let i = 0; i < s.count; i++) if (s.kind[i] === KIND_PLAYER && s.proprio[i] === j) s.velX[i] += vx
}
/** Fait avancer jusqu'à ce que la manche se joue (ou que `n` pas soient passés). */
const jusquaLaFin = (h: Hote, n: number): void => {
  for (let s = 0; s < n && sumo(h).phase === PHASE_JEU; s++) pas(h, 1)
}

describe('sumo — la manche', () => {
  it('l’arène, l’anneau, chacun de son côté du centre, et un décompte', () => {
    const h = new Hote(2, undefined, MODE_SUMO)
    expect(h.salle).toBe(ARENE)
    expect(salleDe(MODE_SUMO)).toBe(ARENE)
    pas(h, 60)
    const j = h.jeu()!
    expect(j).toMatchObject({ mode: MODE_SUMO, phase: PHASE_DECOMPTE, scores: [0, 0], paletActif: false })
    expect(j.anneau).toBe(RAYON_ANNEAU)
    expect(h.sim.corps[0].stats.centroidX).toBeLessThan(CX - 200)
    expect(h.sim.corps[1].stats.centroidX).toBeGreaterThan(CX + 200)
    expect(h.sim.palet.actif).toBe(false)
  })

  it('pendant le décompte, pousser ne fait pas bouger', () => {
    const h = new Hote(2, undefined, MODE_SUMO)
    h.commande(0, { pousse: true, ouvert: false, x: 0, y: CY, dash: true })
    pas(h, 120)
    expect(Math.abs(h.sim.corps[0].stats.velX)).toBeLessThan(5)
    expect(h.sim.corps[0].playerCount).toBe(900)
  })

  it('on ne s’ouvre pas au sumo : deux corps « ouverts » restent deux', () => {
    const h = enJeu()
    h.commande(0, { pousse: false, ouvert: true, x: 0, y: CY })
    h.commande(1, { pousse: false, ouvert: true, x: 0, y: CY })
    pas(h, 5)
    expect(h.sim.corps[0].ouvert).toBe(false)
    expect(h.sim.corps[1].ouvert).toBe(false)
    expect(h.corps()[0].ouvert).toBe(false)
  })

  it('celui dont le cœur passe l’anneau perd la manche', () => {
    const h = enJeu()
    // le corps 1 est lancé vers la droite, hors de l'anneau
    lance(h, 1, 700)
    jusquaLaFin(h, 360)
    expect(sumo(h).phase).toBe(PHASE_BUT)
    expect(h.jeu()).toMatchObject({ scores: [1, 0], buteur: 0 })
    // la pause, puis une manche neuve : chacun à sa place, l'anneau entier
    pas(h, 200)
    expect(sumo(h).phase).toBe(PHASE_DECOMPTE)
    expect(sumo(h).anneau).toBe(RAYON_ANNEAU)
    expect(h.sim.corps[1].playerCount).toBe(900)
    expect(h.sim.corps[1].stats.centroidX).toBeLessThan(CX + 300)
    expect(h.jeu()!.scores).toEqual([1, 0])
  })

  it('POUSSER l’autre dehors : un corps lancé sur l’autre le sort de l’anneau', () => {
    const h = enJeu()
    // le corps 0 fonce sur le corps 1, plusieurs fois (comme des dashs)
    for (let k = 0; k < 6 && sumo(h).phase === PHASE_JEU; k++) {
      lance(h, 0, 420)
      jusquaLaFin(h, 150)
    }
    // quelqu'un est sorti, et c'est par la droite
    expect(sumo(h).phase).not.toBe(PHASE_JEU)
    expect(h.jeu()!.scores[0] + h.jeu()!.scores[1]).toBe(1)
  })

  it('les deux dehors au même pas : personne ne marque, on rejoue', () => {
    const h = enJeu()
    lance(h, 0, -900)
    lance(h, 1, 900)
    jusquaLaFin(h, 360)
    expect(sumo(h).phase).toBe(PHASE_BUT)
    expect(h.jeu()).toMatchObject({ scores: [0, 0], buteur: -1 })
  })

  it('l’anneau se resserre : rester immobile finit par mettre dehors', () => {
    const h = enJeu()
    const s = sumo(h)
    pas(h, 600)
    // cinq secondes : il a perdu un sixième de sa course
    expect(s.anneau).toBeCloseTo(RAYON_ANNEAU - ((RAYON_ANNEAU - RAYON_FINAL) * 5) / DUREE_MANCHE, 0)
    expect(s.phase).toBe(PHASE_JEU)
    // on saute à la fin de la manche : l'anneau est à sa taille finale, et
    // les deux corps, restés à 230 u du centre, sont encore dedans de peu
    s.chrono = 0.05
    pas(h, 12)
    expect(s.anneau).toBe(RAYON_FINAL)
    expect(RAYON_FINAL).toBeGreaterThan(230)
    expect(s.phase).toBe(PHASE_JEU)
  })

  it('le premier à trois manches gagne, et RECOMMENCER remet tout à zéro', () => {
    const h = enJeu()
    for (let k = 0; k < MANCHES_POUR_GAGNER; k++) {
      lance(h, 1, 700)
      jusquaLaFin(h, 360)
      if (sumo(h).phase === PHASE_FINI) break
      pas(h, 200)
      sumo(h).decompte = 0
      pas(h, 1)
    }
    expect(sumo(h).phase).toBe(PHASE_FINI)
    expect(h.jeu()).toMatchObject({ scores: [MANCHES_POUR_GAGNER, 0], buteur: 0 })
    h.recommence()
    expect(h.jeu()).toMatchObject({ scores: [0, 0], phase: PHASE_DECOMPTE })
  })
})

describe('sumo — ce qui voyage', () => {
  it('le mode et l’anneau font l’aller-retour, et l’invité apprend l’arène', () => {
    const h = enJeu()
    pas(h, 120)
    const morceaux = h.image()
    expect(modeTrame(morceaux[0])).toBe(MODE_SUMO)
    const m = new Miroir()
    for (const morceau of morceaux) m.recoit(morceau, 1000)
    expect(m.mode).toBe(MODE_SUMO)
    expect(m.salle).toBe(ARENE)
    expect(m.jeu(1000)).toMatchObject({ mode: MODE_SUMO, scores: [0, 0], paletActif: false })
    expect(m.jeu(1000)!.anneau).toBeCloseTo(sumo(h).anneau, 0)
    expect(m.vue(1000).n).toBe(h.sim.count)
  })

  it('un état de sumo écrit à la main se relit tel quel', () => {
    const etat = { ...new Sumo().etat(), scores: [2, 1] as [number, number], anneau: 333.3, buteur: 1, phase: PHASE_BUT }
    const e = litEnteteEtat(encodeEtat(1, 0, ARENE, [], particulesVides(1), etat)[0], ARENE)!
    expect(e.jeu).toMatchObject({ mode: MODE_SUMO, scores: [2, 1], buteur: 1, phase: PHASE_BUT })
    expect(e.jeu!.anneau).toBeCloseTo(333.3, 1)
  })
})
