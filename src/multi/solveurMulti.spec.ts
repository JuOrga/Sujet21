import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import { FluidSim, KIND_PLAYER as KIND_PLAYER_JEU, type Bounds } from '../sim/solver'
import { FluidSimMulti, KIND_FREE, KIND_PLAYER } from './solveurMulti'

// Salle assez vaste pour que rien ne touche les parois (le contact paroi
// absorbe légitimement de la quantité de mouvement).
const VIDE: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function fabrique(joueurs: number, bornes: Bounds = VIDE, surcharge: Partial<SimParams> = {}): FluidSimMulti {
  return new FluidSimMulti({ ...DEFAULT_PARAMS, ...surcharge }, bornes, 2048, joueurs)
}

/** Deux corps de `n` particules, à `ecart` l'un de l'autre sur l'axe x. */
function duo(n: number, ecart: number): FluidSimMulti {
  const sim = fabrique(2)
  sim.courant = 0
  sim.spawnDisc(-ecart / 2, 0, n, KIND_PLAYER)
  sim.courant = 1
  sim.spawnDisc(ecart / 2, 0, n, KIND_PLAYER)
  sim.relabel()
  return sim
}

function compteCorps(sim: FluidSimMulti, j: number): number {
  let c = 0
  for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_PLAYER && sim.proprio[i] === j) c++
  return c
}

describe('solveur du multi — la copie à UN joueur est le solveur du jeu', () => {
  // LE FILET DE LA COPIE. Sur une même machine la simulation n'a aucun aléa :
  // les mêmes gestes donnent les mêmes nombres. La copie réglée sur un seul
  // joueur doit donc rendre, au bit près, ce que rend le solveur du jeu —
  // parois, éjections, re-tri des particules et relabel compris. Si ce test
  // tombe, c'est que la copie a changé la PHYSIQUE, pas seulement appris à
  // compter deux corps.
  it('mêmes gestes, mêmes nombres, au bit près — parois comprises', () => {
    const salle: Bounds = { minX: -260, minY: -180, maxX: 260, maxY: 180 }
    const jeu = new FluidSim({ ...DEFAULT_PARAMS }, salle, 2048)
    const multi = new FluidSimMulti({ ...DEFAULT_PARAMS }, salle, 2048, 1)
    jeu.spawnDisc(0, 0, 300, KIND_PLAYER_JEU)
    multi.spawnDisc(0, 0, 300, KIND_PLAYER)
    const dt = DEFAULT_PARAMS.dt
    // 6 s : le corps est lancé contre les quatre parois tour à tour, avec
    // des temps morts où les gouttes reviennent
    const visees: [number, number][] = [[900, 0], [0, 900], [-900, 200], [300, -900]]
    for (let s = 0; s < 720; s++) {
      const v = visees[Math.floor(s / 180)]
      if (s % 180 < 110) {
        jeu.eject(v[0], v[1], dt)
        multi.eject(v[0], v[1], dt)
      }
      jeu.step(dt)
      multi.step(dt)
    }
    expect(multi.count).toBe(jeu.count)
    const n = jeu.count
    expect(Array.from(multi.posX.subarray(0, n))).toEqual(Array.from(jeu.posX.subarray(0, n)))
    expect(Array.from(multi.posY.subarray(0, n))).toEqual(Array.from(jeu.posY.subarray(0, n)))
    expect(Array.from(multi.velX.subarray(0, n))).toEqual(Array.from(jeu.velX.subarray(0, n)))
    expect(Array.from(multi.velY.subarray(0, n))).toEqual(Array.from(jeu.velY.subarray(0, n)))
    expect(Array.from(multi.kind.subarray(0, n))).toEqual(Array.from(jeu.kind.subarray(0, n)))
    expect(Array.from(multi.duCorps.subarray(0, n))).toEqual(Array.from(jeu.duCorps.subarray(0, n)))
    expect(multi.playerCount).toBe(jeu.playerCount)
    expect(multi.enPretCount).toBe(jeu.enPretCount)
    expect(multi.stats).toEqual(jeu.stats)
    expect(multi.liters()).toBe(jeu.liters())
    // et le scénario a bien éprouvé quelque chose : le corps a tiré, des
    // gouttes sont dehors
    expect(jeu.playerCount).toBeLessThan(300)
  })
})

describe('solveur du multi — deux corps', () => {
  it('chacun naît avec les siennes', () => {
    const sim = duo(300, 800)
    expect(sim.nbJoueurs).toBe(2)
    expect(sim.corps[0].playerCount).toBe(300)
    expect(sim.corps[1].playerCount).toBe(300)
    expect(compteCorps(sim, 0)).toBe(300)
    expect(compteCorps(sim, 1)).toBe(300)
    expect(sim.corps[0].stats.centroidX).toBeCloseTo(-400, 0)
    expect(sim.corps[1].stats.centroidX).toBeCloseTo(400, 0)
  })

  it('le jet de l’un ne meut que lui', () => {
    const sim = duo(300, 1600)
    const dt = sim.params.dt
    for (let s = 0; s < 120; s++) {
      sim.courant = 0
      sim.eject(-3000, 0, dt) // le joueur 0 tire vers la gauche : il part à droite
      sim.step(dt)
    }
    expect(sim.corps[0].stats.velX).toBeGreaterThan(10)
    expect(Math.abs(sim.corps[1].stats.velX)).toBeLessThan(0.5)
    expect(sim.corps[1].playerCount).toBe(300)
    expect(sim.corps[0].playerCount).toBeLessThan(300)
  })

  it('deux jets à la fois : la quantité de mouvement d’ensemble reste nulle', () => {
    const sim = duo(300, 1600)
    const dt = sim.params.dt
    for (let s = 0; s < 120; s++) {
      sim.courant = 0
      sim.eject(-3000, 500, dt)
      sim.courant = 1
      sim.eject(3000, -200, dt)
      sim.step(dt)
    }
    const { px, py } = sim.totalMomentum()
    expect(Math.abs(px)).toBeLessThan(5)
    expect(Math.abs(py)).toBeLessThan(5)
    // chacun est parti à l'opposé de SA visée
    expect(sim.corps[0].stats.velX).toBeGreaterThan(10)
    expect(sim.corps[1].stats.velX).toBeLessThan(-10)
  })

  it('le compte de chaque corps est celui de ses particules', () => {
    const sim = duo(250, 900)
    const dt = sim.params.dt
    for (let s = 0; s < 240; s++) {
      sim.courant = 0
      if (s < 90) sim.eject(-3000, 0, dt)
      sim.courant = 1
      if (s > 60 && s < 150) sim.eject(0, 3000, dt)
      sim.step(dt)
    }
    sim.relabel()
    expect(sim.corps[0].playerCount).toBe(compteCorps(sim, 0))
    expect(sim.corps[1].playerCount).toBe(compteCorps(sim, 1))
    // rien ne se crée ni ne se perd : corps + gouttes = la matière de départ
    let libres = 0
    for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_FREE) libres++
    expect(sim.corps[0].playerCount + sim.corps[1].playerCount + libres).toBe(500)
  })

  it('LE DON : la matière tirée dans l’autre devient la sienne', () => {
    const sim = duo(300, 700)
    const dt = sim.params.dt
    // le joueur 0 tire en plein dans le joueur 1 pendant une seconde, puis
    // on laisse les gouttes arriver et leur délai se purger
    for (let s = 0; s < 480; s++) {
      sim.courant = 0
      if (s < 120) sim.eject(350, 0, dt)
      sim.step(dt)
    }
    sim.relabel()
    // On compte la MATIÈRE de chacun (corps + gouttes à lui), pas le corps
    // seul : un jet à 1 400 u/s LABOURE celui qui le reçoit, et le corps du
    // receveur se rassemble pendant plusieurs secondes — mesuré, il vaut 284
    // à 4 s puis 310 à 5 s, alors que sa matière, elle, n'a fait que monter.
    const matiere = (j: number): number => {
      let c = 0
      for (let i = 0; i < sim.count; i++) if (sim.proprio[i] === j) c++
      return c
    }
    expect(matiere(1)).toBeGreaterThan(320)
    expect(matiere(0)).toBeLessThan(280)
    expect(matiere(0) + matiere(1)).toBe(600)
    expect(compteCorps(sim, 1)).toBe(sim.corps[1].playerCount)
  })

  it('la goutte d’un autre ne vient pas à moi à l’aimant', () => {
    // Le joueur 0 tire À CÔTÉ du joueur 1 : ses gouttes passent dans le halo
    // de l'autre sans le toucher. Le rappel des égarées ne doit pas les lui
    // donner — sinon frôler suffirait à voler.
    const sim = duo(300, 900)
    const dt = sim.params.dt
    for (let s = 0; s < 60; s++) {
      sim.courant = 0
      sim.eject(450, 2600, dt) // loin au-dessus du joueur 1
      sim.step(dt)
    }
    for (let s = 0; s < 120; s++) sim.step(dt)
    expect(sim.corps[1].playerCount).toBe(300)
  })

  it('deux corps au contact gardent chacun leur matière', () => {
    // côte à côte, ils ne forment qu'UN amas : sans la règle « chacun garde
    // les siennes », le plus gros avalerait l'autre au premier relabel
    const sim = duo(300, 150)
    const dt = sim.params.dt
    for (let s = 0; s < 240; s++) sim.step(dt)
    sim.relabel()
    expect(sim.corps[0].playerCount + sim.corps[0].enPretCount).toBe(300)
    expect(sim.corps[1].playerCount + sim.corps[1].enPretCount).toBe(300)
    expect(sim.corps[0].dispersed).toBe(false)
    expect(sim.corps[1].dispersed).toBe(false)
  })

  it('la dispersion de l’un n’est pas celle de l’autre', () => {
    const sim = fabrique(2)
    sim.courant = 0
    sim.spawnDisc(-600, 0, 2, KIND_PLAYER)
    sim.courant = 1
    sim.spawnDisc(600, 0, 300, KIND_PLAYER)
    const dt = sim.params.dt
    for (let s = 0; s < 240; s++) {
      sim.courant = 0
      sim.eject(-3000, 0, dt)
      sim.step(dt)
    }
    expect(sim.corps[0].dispersed).toBe(true)
    expect(sim.corps[1].dispersed).toBe(false)
    expect(sim.corps[1].playerCount).toBe(300)
  })

  it('le pas rend la parole à qui l’avait', () => {
    const sim = duo(100, 800)
    sim.courant = 1
    sim.step(sim.params.dt)
    sim.relabel()
    expect(sim.courant).toBe(1)
  })

  it('la copie de prévision emporte les deux corps', () => {
    const sim = duo(120, 800)
    const c = sim.copiePourPrevision()
    expect(c.nbJoueurs).toBe(2)
    expect(c.corps[0].playerCount).toBe(120)
    expect(c.corps[1].playerCount).toBe(120)
    expect(Array.from(c.proprio.subarray(0, c.count))).toEqual(Array.from(sim.proprio.subarray(0, sim.count)))
  })
})
