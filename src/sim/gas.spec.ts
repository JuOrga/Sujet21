import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'
import { MAT_FROID, MAT_GRILLE, MAT_SURCHAUFFEUR } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  return new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) sim.step(dt)
}

function gasify(sim: FluidSim): void {
  for (let i = 0; i < sim.count; i++) {
    sim.vapor[i] = 1
    sim.gaseous[i] = 1
  }
}

describe('FluidSim — la vapeur : se déplacer en gaz (tableau 3)', () => {
  it('vaporisation volontaire (G) : le corps entier passe en vapeur', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 40, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2)
    for (let i = 0; i < sim.count; i++) {
      expect(sim.gaseous[i]).toBe(1)
    }
    expect(sim.dispersed).toBe(false)
  })

  it('le nuage distendu reste un seul corps (pas de fausse dispersion)', () => {
    const sim = makeSim({ gasIdleLossRate: 0 }) // on mesure la connexité, pas le coût d'état
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 3) // vaporisation puis expansion
    expect(sim.dispersed).toBe(false)
    expect(sim.playerCount).toBeGreaterThanOrEqual(59) // au pire une égarée du bord
  })

  it('le dash SOUFFLE sa charge : le nuage fuse, sa queue part en arrière', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2) // vaporisation complète
    sim.dashBudget = 3 // la bascule a rendu ses dashs (transfoVapeur)
    const before = sim.playerCount
    const spent = sim.gasDash(600, 0)
    expect(spent).toBe(1)
    // On avance parce qu'on REJETTE : une part du nuage cesse d'appartenir
    // au corps (elle ne compte plus dans playerCount) et part vers l'arrière.
    expect(sim.playerCount).toBeLessThan(before)
    expect(sim.playerCount).toBeGreaterThan(before * 0.7) // jamais dissous
    let souffleArriere = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER && sim.gaseous[i] === 1 && sim.velX[i] < 0) souffleArriere++
    }
    expect(souffleArriere).toBeGreaterThan(0)
    // l'impulsion : le nuage fuse vers la cible
    run(sim, 0.6)
    sim.updatePlayerStats()
    expect(sim.stats.centroidX).toBeGreaterThan(120)
  })

  it('le souffle PERLE sur la première paroi touchée (et n’est pas repris)', () => {
    const sim = makeSim()
    // un mur DERRIÈRE le corps : le souffle du dash va s'y déposer
    sim.setLevel([{ minX: -400, minY: -600, maxX: -340, maxY: 600, material: 0 }], [])
    sim.spawnDisc(0, 0, 60, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2)
    sim.dashBudget = 3
    expect(sim.gasDash(600, 0)).toBe(1) // on vise à DROITE : le souffle part à gauche
    run(sim, 1.4) // le temps que le souffle atteigne le mur
    let rosee = 0
    for (let i = 0; i < sim.count; i++) {
      // une goutte : plus gazeuse, plus au corps, et posée près du mur
      if (sim.kind[i] !== KIND_PLAYER && sim.gaseous[i] === 0 && sim.frozen[i] === 0 && sim.posX[i] < -300) {
        rosee++
      }
    }
    expect(rosee).toBeGreaterThan(0) // la vapeur qui n'est plus à vous s'est condensée
  })

  it('la puissance du dash suit la distance du pointeur : à mi-portée, mi-vitesse', () => {
    const faire = (dist: number): number => {
      const sim = makeSim()
      sim.setLevel([], [])
      sim.spawnDisc(0, 0, 60, KIND_PLAYER)
      sim.gasIntent = true
      run(sim, 1.2)
      sim.dashBudget = 9
      sim.updatePlayerStats()
      sim.gasDash(sim.stats.centroidX + dist, sim.stats.centroidY)
      sim.updatePlayerStats()
      return Math.hypot(sim.stats.velX, sim.stats.velY)
    }
    const pleine = faire(sim0RangePlus())
    const moitie = faire(DEFAULT_PARAMS.gasDashRange / 2)
    expect(pleine).toBeGreaterThan(DEFAULT_PARAMS.gasDashSpeed * 0.85)
    expect(moitie).toBeGreaterThan(DEFAULT_PARAMS.gasDashSpeed * 0.35)
    expect(moitie).toBeLessThan(DEFAULT_PARAMS.gasDashSpeed * 0.65)
    // au-delà de la portée, rien de plus : viser à deux kilomètres est inutile
    const tresLoin = faire(DEFAULT_PARAMS.gasDashRange * 8)
    expect(Math.abs(tresLoin - pleine)).toBeLessThan(DEFAULT_PARAMS.gasDashSpeed * 0.1)

    function sim0RangePlus(): number {
      return DEFAULT_PARAMS.gasDashRange * 1.2
    }
  })

  it('les dashs sont COMPTÉS : le budget s’épuise, quel que soit le volume', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 90, KIND_PLAYER)
    sim.gasIntent = true
    run(sim, 1.2)
    sim.dashBudget = 2
    expect(sim.gasDash(600, 0)).toBe(1)
    expect(sim.dashBudget).toBe(1)
    expect(sim.gasDash(600, 0)).toBe(1)
    expect(sim.dashBudget).toBe(0)
    expect(sim.gasDash(600, 0)).toBe(0) // à sec : plus d'impulsion
    // le budget reste la limite DURE (deux dashs, pas trois) — et chaque
    // dash a soufflé sa charge : le corps a maigri sans se dissoudre
    expect(sim.playerCount).toBeLessThan(90)
    expect(sim.playerCount).toBeGreaterThan(40)
  })

  it('la TRANSFORMATION en vapeur : péage de 20 % en gouttes — le compteur de dashs ne bouge PAS', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 300, KIND_PLAYER)
    sim.relabel()
    sim.dashBudgetMax = 3
    sim.dashBudget = 2 // un dash déjà dépensé dans le tableau
    const before = sim.playerCount
    const avant = sim.totalMomentum()
    sim.transfoVapeur()
    // 20 % du corps part en gouttes LIBRES, éjectées en étoile…
    expect(sim.playerCount).toBe(before - Math.floor(before * sim.params.vaporTollFrac))
    // …récupérables : elles existent toujours, sous délai de réabsorption
    let libres = 0
    let rapides = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_FREE) continue
      libres++
      if (Math.hypot(sim.velX[i], sim.velY[i]) > sim.params.ejectSpeed * 0.5) rapides++
    }
    expect(libres).toBe(before - sim.playerCount)
    expect(rapides).toBe(libres) // la gerbe part à grande vitesse
    // le compteur de dashs n'a pas bougé (la réserve est au TABLEAU, pas à
    // la bascule), et la quantité de mouvement est conservée
    expect(sim.dashBudget).toBe(2)
    const apres = sim.totalMomentum()
    expect(Math.abs(apres.px - avant.px)).toBeLessThan(5)
    expect(Math.abs(apres.py - avant.py)).toBeLessThan(5)
    // se RE-transformer repaie le péage — et ne rend toujours RIEN : la
    // chaudière n'est pas une ferme à dashs
    sim.dashBudget = 0
    const encore = sim.playerCount
    sim.transfoVapeur()
    expect(sim.playerCount).toBeLessThan(encore)
    expect(sim.dashBudget).toBe(0)
  })

  it('le SURCHAUFFEUR frôlé en vapeur rend UN dash — une seule fois par appareil', () => {
    const sim = makeSim()
    sim.setLevel(
      [
        { minX: -400, minY: -60, maxX: -340, maxY: 60, material: MAT_SURCHAUFFEUR },
        { minX: 340, minY: -60, maxX: 400, maxY: 60, material: MAT_SURCHAUFFEUR },
      ],
      [],
    )
    sim.spawnDisc(-320, 0, 60, KIND_PLAYER) // au contact du premier
    gasify(sim)
    sim.dashBudget = 0
    run(sim, 0.3)
    expect(sim.dashBudget).toBe(1) // le serpentin a rendu son dash
    expect(sim.surchauffesVides.size).toBe(1)
    run(sim, 0.5) // rester collé n'en rend pas un deuxième
    expect(sim.dashBudget).toBe(1)
    // l'eau, elle, n'interagit pas : le second surchauffeur reste plein
    expect(sim.surchauffesVides.has(0)).toBe(true)
    expect(sim.surchauffesVides.has(1)).toBe(false)
  })

  it('le surchauffeur ne recharge JAMAIS au-delà de la réserve — et reste chargé en attendant', () => {
    const sim = makeSim()
    sim.setLevel(
      [{ minX: -400, minY: -600, maxX: -340, maxY: 600, material: MAT_SURCHAUFFEUR }],
      [],
    )
    sim.spawnDisc(-320, 0, 60, KIND_PLAYER) // au contact du serpentin
    gasify(sim)
    sim.dashBudgetMax = 3
    sim.dashBudget = 3 // réserve pleine
    run(sim, 0.15)
    expect(sim.dashBudget).toBe(3) // rien au-delà du max
    expect(sim.surchauffesVides.size).toBe(0) // le serpentin ne s'est PAS vidé pour rien
    // un dash dépensé : la borne peut enfin donner — on recolle le nuage
    // au serpentin (la dynamique l'a fait dériver pendant la 1re phase)
    sim.dashBudget = 2
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      sim.posX[i] = -336
      sim.posY[i] = (i % 40) * 6 - 120
      sim.velX[i] = 0
      sim.velY[i] = 0
    }
    run(sim, 0.15)
    expect(sim.dashBudget).toBe(3)
    expect(sim.surchauffesVides.size).toBe(1) // déchargé, une seule fois
  })

  it('la vapeur traverse l’évent, le liquide s’y écrase', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: 0, minY: -500, maxX: 40, maxY: 500, material: MAT_GRILLE }], [])
    const liq = sim.addParticle(-30, 100, KIND_FREE)
    sim.velX[liq] = 250
    const gas = sim.addParticle(-30, -100, KIND_FREE)
    sim.vapor[gas] = 1
    sim.gaseous[gas] = 1
    sim.velX[gas] = 250
    run(sim, 1)
    expect(sim.posX[liq]).toBeLessThan(5) // bloqué devant la grille
    expect(sim.posX[gas]).toBeGreaterThan(45) // passé au travers
  })

  it('le froid condense la vapeur (pas de gel direct du gaz)', () => {
    const sim = makeSim()
    sim.setLevel([{ minX: -60, minY: -300, maxX: 0, maxY: 300, material: MAT_FROID }], [])
    const i = sim.addParticle(10, 0, KIND_FREE) // en pleine aura
    sim.vapor[i] = 1
    sim.gaseous[i] = 1
    run(sim, 0.8)
    expect(sim.gaseous[i]).toBe(0) // condensée
    run(sim, 2)
    expect(sim.frozen[i]).toBe(1) // puis, restée dans l'aura : gelée
  })

  it('en vapeur, l’éjection ne trouve rien à expulser', () => {
    const sim = makeSim()
    sim.setLevel([], [])
    sim.spawnDisc(0, 0, 20, KIND_PLAYER)
    gasify(sim)
    sim.updatePlayerStats()
    sim.eject(200, 0, 1 / sim.params.ejectRate)
    expect(sim.playerCount).toBe(20) // rien n'est parti
  })
})
