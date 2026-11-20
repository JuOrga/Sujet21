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
    // le don est un geste du RECEVEUR : il s'ouvre, et boit ce qu'on lui tire
    sim.corps[1].ouvert = true
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
    sim.corps[0].ouvert = true
    sim.corps[1].ouvert = true
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
    // sa MATIÈRE est intacte (le recul du premier lui envoie une particule,
    // qui rebondit sur lui en détachant deux ou trois gouttes : le corps
    // compte 297, la matière 300)
    let matiere = 0
    for (let i = 0; i < sim.count; i++) if (sim.proprio[i] === 1) matiere++
    expect(matiere).toBe(300)
    expect(sim.corps[1].playerCount).toBeGreaterThan(290)
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

describe('solveur du multi — les gestes : ouvert, fermé', () => {
  /** Les amas (étiquettes) où un joueur a des particules de corps. */
  const amasDe = (sim: FluidSimMulti, j: number): Set<number> => {
    const a = new Set<number>()
    for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_PLAYER && sim.proprio[i] === j) a.add(sim.labels[i])
    return a
  }
  const communs = (sim: FluidSimMulti): number => {
    const a = amasDe(sim, 0)
    return [...amasDe(sim, 1)].filter((x) => a.has(x)).length
  }
  const matiere = (sim: FluidSimMulti, j: number): number => {
    let c = 0
    for (let i = 0; i < sim.count; i++) if (sim.proprio[i] === j) c++
    return c
  }
  /** La plus petite distance entre une particule de l'un et une de l'autre. */
  const plusProche = (sim: FluidSimMulti): number => {
    let d = Infinity
    for (let i = 0; i < sim.count; i++) {
      if (sim.proprio[i] !== 0) continue
      for (let j = 0; j < sim.count; j++) {
        if (sim.proprio[j] !== 1) continue
        const r = Math.hypot(sim.posX[i] - sim.posX[j], sim.posY[i] - sim.posY[j])
        if (r < d) d = r
      }
    }
    return d
  }

  it('un corps naît FERMÉ', () => {
    const sim = duo(100, 800)
    expect(sim.corps[0].ouvert).toBe(false)
    expect(sim.corps[1].ouvert).toBe(false)
  })

  it('deux corps FERMÉS qui se percutent ne se mêlent pas : ni amas commun, ni matière passée, ni particule de l’un parmi celles de l’autre', () => {
    // le défaut noté au premier essai à deux : « deux corps qui se touchent
    // se mêlent sans qu'on l'ait choisi »
    const sim = duo(300, 300)
    const dt = sim.params.dt
    sim.courant = 0
    sim.lanceCorps(120, 0)
    let pire = Infinity
    for (let s = 0; s < 480; s++) {
      sim.step(dt)
      if (s % 20 === 0 && s > 60) pire = Math.min(pire, plusProche(sim))
    }
    sim.relabel()
    expect(communs(sim)).toBe(0)
    expect(matiere(sim, 0)).toBe(300)
    expect(matiere(sim, 1)).toBe(300)
    // ils se sont bien touchés (la pression porte à un rayon de noyau)…
    expect(pire).toBeLessThan(sim.params.kernelRadius)
    // …sans jamais s'interpénétrer : toujours plus d'un pas de particule
    expect(pire).toBeGreaterThan(sim.params.particleSpacing)
    // et le choc s'est transmis : le second est parti, le premier a ralenti
    expect(sim.corps[1].stats.velX).toBeGreaterThan(15)
    expect(sim.corps[0].stats.velX).toBeLessThan(105)
  })

  it('le choc de deux corps fermés conserve la quantité de mouvement', () => {
    const sim = duo(300, 300)
    const dt = sim.params.dt
    sim.courant = 0
    sim.lanceCorps(120, 0)
    const avant = sim.totalMomentum()
    for (let s = 0; s < 360; s++) sim.step(dt)
    const apres = sim.totalMomentum()
    expect(Math.abs(apres.px - avant.px)).toBeLessThan(avant.px * 0.001)
    expect(Math.abs(apres.py)).toBeLessThan(5)
  })

  it('un seul des deux ouvert : pas de fusion — c’est un PACTE', () => {
    const sim = duo(300, 300)
    const dt = sim.params.dt
    sim.corps[1].ouvert = true
    sim.courant = 0
    sim.lanceCorps(120, 0)
    for (let s = 0; s < 480; s++) sim.step(dt)
    sim.relabel()
    expect(communs(sim)).toBe(0)
    expect(matiere(sim, 0)).toBe(300)
    expect(matiere(sim, 1)).toBe(300)
  })

  it('les DEUX ouverts : ils fusionnent en un seul amas, et chacun garde les siennes', () => {
    const sim = duo(300, 300)
    const dt = sim.params.dt
    sim.corps[0].ouvert = true
    sim.corps[1].ouvert = true
    sim.courant = 0
    sim.lanceCorps(120, 0)
    for (let s = 0; s < 480; s++) sim.step(dt)
    sim.relabel()
    expect(communs(sim)).toBe(1)
    expect(sim.corps[0].playerCount + sim.corps[0].enPretCount).toBe(300)
    expect(sim.corps[1].playerCount + sim.corps[1].enPretCount).toBe(300)
  })

  it('SE REFERMER sépare : plus d’amas commun, les corps s’écartent, et rien n’explose', () => {
    const sim = duo(300, 300)
    const dt = sim.params.dt
    sim.corps[0].ouvert = true
    sim.corps[1].ouvert = true
    sim.courant = 0
    sim.lanceCorps(120, 0)
    for (let s = 0; s < 480; s++) sim.step(dt)
    sim.relabel()
    expect(communs(sim)).toBe(1)
    const ecartAvant = sim.corps[1].stats.centroidX - sim.corps[0].stats.centroidX
    // le joueur 0 se referme
    sim.corps[0].ouvert = false
    let vmax = 0
    for (let s = 0; s < 240; s++) {
      sim.step(dt)
      for (let i = 0; i < sim.count; i++) vmax = Math.max(vmax, Math.hypot(sim.velX[i], sim.velY[i]))
    }
    sim.relabel()
    expect(communs(sim)).toBe(0)
    expect(sim.corps[1].stats.centroidX - sim.corps[0].stats.centroidX).toBeGreaterThan(ecartAvant)
    // la séparation pousse, elle ne catapulte pas (un jet part à 1 400 u/s)
    expect(vmax).toBeLessThan(700)
    // la matière qui change de main à la séparation reste marginale
    expect(Math.abs(matiere(sim, 0) - 300)).toBeLessThan(30)
    expect(matiere(sim, 0) + matiere(sim, 1)).toBe(600)
  })

  it('le jet tiré dans un corps FERMÉ ne lui donne rien : il le bouscule', () => {
    const sim = duo(300, 700)
    const dt = sim.params.dt
    for (let s = 0; s < 480; s++) {
      sim.courant = 0
      if (s < 120) sim.eject(350, 0, dt)
      sim.step(dt)
    }
    sim.relabel()
    expect(matiere(sim, 1)).toBe(300)
    expect(matiere(sim, 0)).toBe(300)
    expect(sim.corps[1].stats.velX).toBeGreaterThan(5)
  })

  it('un corps OUVERT boit ce qu’on lui tire, pas les morceaux de l’autre', () => {
    // le défaut vu à l'écran : dans une fusion brouillonne, le plus gros
    // avalait les fragments de l'autre (851 particules, puis 332)
    const sim = duo(300, 420)
    const dt = sim.params.dt
    sim.corps[0].ouvert = true
    // vingt particules du joueur 1 se DÉTACHENT de son corps et viennent se
    // poser contre le joueur 0 — des fragments, pas un jet
    const a = sim.corps[0].stats
    let prises = 0
    for (let i = 0; i < sim.count && prises < 20; i++) {
      if (sim.kind[i] !== KIND_PLAYER || sim.proprio[i] !== 1) continue
      const angle = (prises / 20) * Math.PI - Math.PI / 2
      sim.posX[i] = a.centroidX + Math.cos(angle) * 72
      sim.posY[i] = a.centroidY + Math.sin(angle) * 72
      sim.velX[i] = 0
      sim.velY[i] = 0
      prises++
    }
    for (let s = 0; s < 360; s++) sim.step(dt)
    sim.relabel()
    expect(matiere(sim, 1)).toBe(300)
    expect(matiere(sim, 0)).toBe(300)
    // et le corps ouvert n'a pas grossi de la matière des autres
    expect(sim.corps[0].playerCount + sim.corps[0].enPretCount).toBeLessThanOrEqual(300)
  })

  it('un corps fermé ne boit rien d’étranger, même collé à l’un de ses fragments', () => {
    // la fuite trouvée en écrivant les cloisons : une goutte de l'autre,
    // collée à un fragment du corps fermé, revenait AVEC lui au relabel
    const sim = duo(300, 700)
    const dt = sim.params.dt
    for (let s = 0; s < 720; s++) {
      sim.courant = 0
      if (s < 180) sim.eject(350, 0, dt)
      sim.step(dt)
    }
    sim.relabel()
    let etrangeres = 0
    for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_PLAYER && sim.proprio[i] === 1) etrangeres++
    expect(etrangeres).toBe(sim.corps[1].playerCount)
    expect(matiere(sim, 1)).toBe(300)
  })
})

