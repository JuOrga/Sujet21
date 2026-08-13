import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './solver'

// Salle assez vaste pour que rien ne touche les parois pendant les tests
// (le contact paroi absorbe légitimement de la quantité de mouvement).
const OPEN_SPACE: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  const params: SimParams = { ...DEFAULT_PARAMS, ...overrides }
  return new FluidSim(params, OPEN_SPACE, 2048)
}

describe('FluidSim — invariants physiques', () => {
  it('conserve la quantité de mouvement au repos', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 200, KIND_PLAYER)
    for (let s = 0; s < 60; s++) sim.step(sim.params.dt)
    const { px, py } = sim.totalMomentum()
    expect(Math.abs(px)).toBeLessThan(0.5)
    expect(Math.abs(py)).toBeLessThan(0.5)
  })

  it("conserve la quantité de mouvement pendant l'éjection (§3.3)", () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 300, KIND_PLAYER)
    // 1 seconde de poussée continue vers la droite
    const steps = 120
    for (let s = 0; s < steps; s++) {
      sim.eject(500, 0, sim.params.dt)
      sim.step(sim.params.dt)
    }
    const { px, py } = sim.totalMomentum()
    // La somme corps + gouttelettes éjectées reste nulle
    expect(Math.abs(px)).toBeLessThan(5)
    expect(Math.abs(py)).toBeLessThan(5)
    // Le corps, lui, est bien parti à l'opposé du point visé
    expect(sim.stats.velX).toBeLessThan(-10)
  })

  it("l'éjection entraîne le liquide voisin : le corps se creuse au départ", () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 300, KIND_PLAYER)
    sim.eject(500, 0, 1 / sim.params.ejectRate) // exactement une éjection
    let maxVx = -Infinity
    let sumVx = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      maxVx = Math.max(maxVx, sim.velX[i])
      sumVx += sim.velX[i]
    }
    // les voisines du point de départ filent vers la sortie (creusement)…
    expect(maxVx).toBeGreaterThan(60)
    // …tandis que le corps dans son ensemble recule (réaction, §3.3)
    expect(sumVx).toBeLessThan(0)
  })

  it('le recul localisé déforme : le côté éjection recule plus que le côté opposé', () => {
    // entraînement coupé pour isoler le recul pur
    const sim = makeSim({ recoilLocality: 1, ejectEntrain: 0 })
    sim.spawnDisc(0, 0, 300, KIND_PLAYER)
    sim.eject(500, 0, 1 / sim.params.ejectRate) // une éjection vers +x
    let nearVx = 0
    let nearN = 0
    let farVx = 0
    let farN = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      if (sim.posX[i] > 20) {
        nearVx += sim.velX[i]
        nearN++
      } else if (sim.posX[i] < -20) {
        farVx += sim.velX[i]
        farN++
      }
    }
    // le côté éjection (près du point de départ) encaisse le recul…
    expect(nearVx / nearN).toBeLessThan(-10)
    // …bien plus que le côté opposé : c'est un fluide, pas un solide
    expect(nearVx / nearN).toBeLessThan((farVx / Math.max(1, farN)) - 10)
  })

  it('éjecter coûte du volume : se déplacer, c’est rétrécir (§1)', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 300, KIND_PLAYER)
    const before = sim.playerCount
    for (let s = 0; s < 120; s++) {
      sim.eject(500, 0, sim.params.dt)
      sim.step(sim.params.dt)
    }
    expect(sim.playerCount).toBeLessThan(before)
  })

  it('le corps reste cohésif en apesanteur (§2.1)', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 300, KIND_PLAYER)
    sim.updatePlayerStats()
    const r0 = sim.stats.rmsRadius
    for (let s = 0; s < 240; s++) sim.step(sim.params.dt)
    sim.updatePlayerStats()
    expect(sim.stats.rmsRadius).toBeLessThan(r0 * 1.6)
  })

  it('deux masses en contact fusionnent (§3.1)', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 200, KIND_PLAYER)
    // Masse libre juste à côté, en contact avec le corps
    const spacing = sim.params.particleSpacing
    sim.spawnDisc(spacing * 9, 0, 60, KIND_FREE)
    sim.relabel()
    expect(sim.playerCount).toBe(260)
  })

  it('une masse détachée ne fusionne pas', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 200, KIND_PLAYER)
    sim.spawnDisc(500, 0, 60, KIND_FREE) // loin du corps
    sim.relabel()
    expect(sim.playerCount).toBe(200)
  })

  it('sous le volume critique, le corps est signalé mais NE MEURT PAS (§3.1)', () => {
    // Refonte 2026 : il n'y a plus de minimum à ramener. Le seuil annonce la
    // dernière impulsion — c'est le jeu qui conclut, à l'arrêt du corps.
    const sim = makeSim({
      criticalVolumeLiters: 0.5, // 100 particules : la moitié des 200 du départ
      ejectRate: 2000,
      reabsorbCooldown: 10,
      dispersalGrace: 0.1,
    })
    sim.spawnDisc(0, 0, 200, KIND_PLAYER)
    sim.relabel()
    expect(sim.dispersed).toBe(false)
    // Sur-éjection massive : plus de la moitié du volume part en gouttelettes
    for (let s = 0; s < 10; s++) {
      sim.eject(500, 0, sim.params.dt)
      sim.step(sim.params.dt)
    }
    for (let s = 0; s < 60; s++) sim.step(sim.params.dt)
    expect(sim.belowCritical).toBe(true) // le manque est constaté…
    expect(sim.dispersed).toBe(false) // …mais l'essai continue
  })

  it('se rassembler resserre un corps étalé, gratuitement et sans le pousser', () => {
    const sim = makeSim()
    sim.spawnDisc(0, 0, 300, KIND_PLAYER)
    // on étale le corps : chaque particule reçoit une vitesse de fuite radiale
    for (let i = 0; i < sim.count; i++) {
      const d = Math.hypot(sim.posX[i], sim.posY[i]) || 1
      sim.velX[i] = (sim.posX[i] / d) * 220
      sim.velY[i] = (sim.posY[i] / d) * 220
    }
    for (let s = 0; s < 60; s++) sim.step(sim.params.dt) // un demi-seconde d'étalement
    sim.updatePlayerStats()
    const rEtale = sim.stats.rmsRadius
    const before = sim.playerCount
    const avant = sim.totalMomentum()
    // une seconde de rassemblement maintenu
    for (let s = 0; s < 120; s++) {
      sim.rassemble(sim.params.dt)
      sim.step(sim.params.dt)
    }
    sim.updatePlayerStats()
    // le corps s'est resserré…
    expect(sim.stats.rmsRadius).toBeLessThan(rEtale * 0.75)
    // …sans payer une seule goutte — au contraire, des gouttes détachées par
    // l'étalement peuvent revenir au corps qui se recompose…
    expect(sim.playerCount).toBeGreaterThanOrEqual(before)
    // …et sans se faire pousser : le rappel est interne, la quantité de
    // mouvement d'ensemble est celle d'avant (la dérive reste une trajectoire)
    const apres = sim.totalMomentum()
    expect(Math.abs(apres.px - avant.px)).toBeLessThan(5)
    expect(Math.abs(apres.py - avant.py)).toBeLessThan(5)
  })

  it('une gouttelette éjectée respecte son délai de réabsorption', () => {
    const sim = makeSim({ reabsorbCooldown: 60 })
    sim.spawnDisc(0, 0, 200, KIND_PLAYER)
    sim.updatePlayerStats()
    sim.eject(sim.stats.centroidX + 1000, sim.stats.centroidY, 1 / sim.params.ejectRate + 1e-6)
    expect(sim.playerCount).toBe(199)
    // Même si elle touche encore le corps, elle n'est pas reprise tant que
    // le cooldown court
    sim.relabel()
    expect(sim.playerCount).toBeLessThan(200)
  })
})
