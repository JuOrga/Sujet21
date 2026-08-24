import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { MAT_CHAUD, MAT_FROID } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

// Radiateur horizontal centré en y = 0, la particule posée juste au-dessus
const RADIATOR = { minX: -200, minY: -40, maxX: 200, maxY: 0, material: MAT_CHAUD }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([RADIATOR], [])
  return sim
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  const steps = Math.round(seconds / dt)
  for (let s = 0; s < steps; s++) sim.step(dt)
}

describe('FluidSim — le radiateur : la chaleur vaporise, dégèle, évapore', () => {
  it("un corps LIQUIDE qui glisse vers la chaudière y RESTE — plus de catapulte du rappel de condensation", () => {
    // Le bogue signalé : « impossible de s'approcher d'une chaudière en
    // liquide ». Le bord du corps qui chauffait (vapeur montante ~0,98 sans
    // intention) était happé vers le centre par le rappel de condensation ;
    // le front comprimé se détendait d'un coup et la chaudière CATAPULTAIT
    // le corps à travers la cuve (constaté : centroïde éjecté à −900 u).
    // Dans l'aura, on BOUT, on ne condense pas : le corps doit pouvoir
    // venir au contact, y rester, et se faire vaporiser.
    const sim = makeSim({ heatLossRate: 0 })
    sim.setLevel(
      [{ minX: 300, minY: -260, maxX: 360, maxY: 260, material: MAT_CHAUD }],
      [],
    )
    // 300 particules : la catapulte ne mordait qu'à partir d'un corps
    // charnu — un petit disque de test passait sans encombre
    sim.spawnDisc(60, 0, 300, KIND_PLAYER)
    // un élan modéré vers la chaudière — le geste du joueur — puis on glisse
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] === KIND_PLAYER) sim.velX[i] = 150
    }
    run(sim, 3)
    expect(sim.chauffeFrac).toBeGreaterThan(0.9) // arrivé au contact
    run(sim, 3)
    // trois secondes plus tard il y est ENCORE (avant : catapulté, 0 %)
    expect(sim.chauffeFrac).toBeGreaterThan(0.7)
    expect(sim.stats.centroidX).toBeGreaterThan(180)
  })

  it("l'échauffement du corps est un effet VISUEL : il chauffe, il ne bascule pas seul", () => {
    const sim = makeSim({ heatLossRate: 0 }) // pas de perte : on isole la vaporisation
    const i = sim.addParticle(0, 8, KIND_PLAYER)
    expect(sim.gaseous[i]).toBe(0)
    run(sim, DEFAULT_PARAMS.boilTime * 2.5)
    // la particule fume et frémit (vapeur ≈ 0,98)… mais reste au corps :
    // la transformation se décide à 95 % de présence, côté jeu
    expect(sim.vapor[i]).toBeGreaterThan(0.9)
    expect(sim.gaseous[i]).toBe(0)
    // le jeu déclenche : l'intention posée, la bascule est immédiate
    sim.gasIntent = true
    run(sim, 0.2)
    expect(sim.gaseous[i]).toBe(1)
  })

  it('chauffeFrac mesure la PRÉSENCE du corps actif dans l’aura', () => {
    const sim = makeSim()
    sim.addParticle(0, 8, KIND_PLAYER) // dans l'aura
    sim.addParticle(0, 1200, KIND_PLAYER) // à l'abri
    sim.step(sim.params.dt)
    expect(sim.chauffeFrac).toBeCloseTo(0.5, 1)
  })

  it("l'eau loin de l'aura reste liquide", () => {
    const sim = makeSim()
    const i = sim.addParticle(0, 800, KIND_PLAYER)
    run(sim, 3)
    expect(sim.gaseous[i]).toBe(0)
  })

  it('la glace exposée à la chaleur dégèle, et bien plus vite qu’à l’air libre', () => {
    const sim = makeSim({ heatLossRate: 0, boilTime: 50 }) // on isole le dégel
    const i = sim.addParticle(0, 8, KIND_PLAYER)
    sim.frost[i] = 1
    sim.frozen[i] = 1
    run(sim, DEFAULT_PARAMS.heatThawTime * 4)
    expect(sim.frozen[i]).toBe(0)
  })

  it('la vapeur qui s’attarde dans l’aura s’évapore — perte définitive', () => {
    // expansion et turbulence coupées : le nuage reste dans l'aura, on isole
    // la perte par évaporation
    const sim = makeSim({ heatLossRate: 12, gasExpand: 0, gasTurb: 0, gasDrag: 12 })
    // gouttes espacées (hors portée du noyau) au-dessus du radiateur,
    // plus deux gouttes à l'abri
    for (let k = 0; k < 8; k++) sim.addParticle(-105 + k * 30, 10, KIND_PLAYER)
    sim.addParticle(0, 1200, KIND_PLAYER)
    sim.addParticle(20, 1200, KIND_PLAYER)
    const before = sim.count
    run(sim, 4)
    expect(sim.count).toBeLessThan(before)
    // le garde-fou laisse toujours un reste d'échantillon
    expect(sim.playerCount).toBeGreaterThanOrEqual(2)
  })

  it('le refroidissement du vaisseau affaiblit le radiateur (§5)', () => {
    // goutte à mi-aura : tiède elle bout ; vaisseau glacial, l'aura
    // rétractée ne l'atteint même plus
    const y = DEFAULT_PARAMS.heatBand * 0.55
    const warm = makeSim({ heatLossRate: 0 })
    const iw = warm.addParticle(0, y, KIND_PLAYER)
    run(warm, DEFAULT_PARAMS.boilTime * 4)
    expect(warm.vapor[iw]).toBeGreaterThan(0.9) // tiède : elle bout (visuel)

    const cold = makeSim({ heatLossRate: 0 })
    cold.chill = 1
    const ic = cold.addParticle(0, y, KIND_PLAYER)
    run(cold, DEFAULT_PARAMS.boilTime * 4)
    expect(cold.vapor[ic]).toBeLessThan(0.3) // glacial : l'aura ne l'atteint plus
  })

  it('le refroidissement étend l’aura des plaques froides', () => {
    const plate = { minX: -200, minY: -40, maxX: 200, maxY: 0, material: MAT_FROID }
    // particule posée au-delà de l'aura tiède, mais dans l'aura étendue
    const y = 8 + DEFAULT_PARAMS.coldBand * 1.1
    const warm = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    warm.setLevel([plate], [])
    const iw = warm.addParticle(0, y, KIND_PLAYER)
    run(warm, 6)
    expect(warm.frozen[iw]).toBe(0)

    const cold = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    cold.setLevel([plate], [])
    cold.chill = 1
    const ic = cold.addParticle(0, y, KIND_PLAYER)
    run(cold, 6)
    expect(cold.frozen[ic]).toBe(1)
  })

  it('l’eau qui givre s’engourdit : la vitesse fond avec le givre', () => {
    const sim = makeSim({ heatLossRate: 0 })
    sim.setLevel([], [])
    const slow = sim.addParticle(0, 800, KIND_PLAYER)
    sim.frost[slow] = 0.9
    sim.velX[slow] = 200
    const ref = sim.addParticle(600, 800, KIND_PLAYER)
    sim.velX[ref] = 200
    run(sim, 0.5)
    expect(Math.abs(sim.velX[slow])).toBeLessThan(Math.abs(sim.velX[ref]) * 0.6)
  })

  it('l’eau qui chauffe frémit : agitation avant l’ébullition', () => {
    // le frémissement oscille : c'est la vitesse crête qui le mesure
    const peak = (sim: FluidSim, i: number, seconds: number): number => {
      const dt = sim.params.dt
      let vMax = 0
      for (let s = 0; s < Math.round(seconds / dt); s++) {
        sim.step(dt)
        vMax = Math.max(vMax, Math.hypot(sim.velX[i], sim.velY[i]))
      }
      return vMax
    }
    const calm = makeSim({ heatLossRate: 0, heatAgitation: 0, boilTime: 60 })
    const ic = calm.addParticle(0, 8, KIND_PLAYER)
    const vCalm = peak(calm, ic, 1.5)

    const hot = makeSim({ heatLossRate: 0, heatAgitation: 400, boilTime: 60 })
    const ih = hot.addParticle(0, 8, KIND_PLAYER)
    const vHot = peak(hot, ih, 1.5)
    expect(vHot).toBeGreaterThan(vCalm + 15)
  })

  it('le froid garde la priorité : plaque froide contre radiateur, l’eau ne bout pas', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS, heatLossRate: 0 }, OPEN, 2048)
    // radiateur et plaque froide superposés : cas limite, le froid condense
    sim.setLevel(
      [RADIATOR, { minX: -200, minY: 0, maxX: 200, maxY: 40, material: MAT_FROID }],
      [],
    )
    const i = sim.addParticle(0, 8, KIND_PLAYER)
    run(sim, 2)
    expect(sim.gaseous[i]).toBe(0)
  })
})
