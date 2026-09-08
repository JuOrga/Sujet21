// La CHASSE : un courant de poussée dans un rectangle — ce qui éjecte le
// corps d'une salle sans le déchirer. Un champ de vitesses, pas une paroi :
// tout ce qui est dedans part du même côté, ce qui est dehors ne sent rien.
import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { CHASSE_ALLURE_DEFAUT } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const CHASSE = { minX: -200, minY: -200, maxX: 200, maxY: 200, angle: 0 }

function sim(): FluidSim {
  const s = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
  s.setLevel([], [])
  s.baseVolume = 1
  return s
}

describe('FluidSim.applyChasse — le courant de poussée', () => {
  it('une goutte au repos dans la chasse est balayée dans sa direction, et sort du rectangle', () => {
    const s = sim()
    const i = s.addParticle(0, 0, KIND_PLAYER)
    for (let k = 0; k < 90; k++) {
      s.applyChasse(CHASSE, s.params.dt)
      s.step(s.params.dt)
    }
    expect(s.posX[i]).toBeGreaterThan(200) // sortie par l'est
    expect(Math.abs(s.posY[i])).toBeLessThan(20) // sans dévier
  })

  it('la direction est trigonométrique : 90° pousse vers le nord (+y)', () => {
    const s = sim()
    const i = s.addParticle(0, 0, KIND_PLAYER)
    for (let k = 0; k < 90; k++) {
      s.applyChasse({ ...CHASSE, angle: 90 }, s.params.dt)
      s.step(s.params.dt)
    }
    expect(s.posY[i]).toBeGreaterThan(200)
    expect(Math.abs(s.posX[i])).toBeLessThan(20)
  })

  it('l’entraînement l’emporte sur l’élan : une goutte lancée CONTRE le courant fait demi-tour', () => {
    const s = sim()
    const i = s.addParticle(150, 0, KIND_PLAYER)
    s.velX[i] = -400
    for (let k = 0; k < 120; k++) {
      s.applyChasse(CHASSE, s.params.dt)
      s.step(s.params.dt)
    }
    expect(s.velX[i]).toBeGreaterThan(0)
    expect(s.posX[i]).toBeGreaterThan(200)
  })

  it('hors du rectangle, rien : une goutte voisine ne bouge pas', () => {
    const s = sim()
    const i = s.addParticle(0, 400, KIND_PLAYER)
    for (let k = 0; k < 60; k++) {
      s.applyChasse(CHASSE, s.params.dt)
      s.step(s.params.dt)
    }
    expect(Math.abs(s.posX[i])).toBeLessThan(1)
    expect(Math.abs(s.posY[i] - 400)).toBeLessThan(1)
  })

  it('l’allure se règle, et le défaut est celui du code', () => {
    const s = sim()
    const i = s.addParticle(0, 0, KIND_PLAYER)
    s.applyChasse(CHASSE, 10) // un pas immense : la vitesse converge sur la cible
    expect(s.velX[i]).toBeCloseTo(CHASSE_ALLURE_DEFAUT, 0)
    s.velX[i] = 0
    s.applyChasse({ ...CHASSE, allure: 250 }, 10)
    expect(s.velX[i]).toBeCloseTo(250, 0)
  })

  it('la glace est entraînée aussi, avec l’inertie d’un bloc (plus lente à prendre le courant)', () => {
    const s = sim()
    const eau = s.addParticle(0, 0, KIND_PLAYER)
    const glace = s.addParticle(0, 100, KIND_PLAYER)
    s.frozen[glace] = 1
    s.applyChasse(CHASSE, s.params.dt)
    expect(s.velX[glace]).toBeGreaterThan(0)
    expect(s.velX[glace]).toBeLessThan(s.velX[eau])
  })
})

describe('la LISIÈRE de la chasse — un corps à cheval sur son bord n’est pas déchiré', () => {
  // Constaté au navigateur : un corps né à cheval sur le bord du rectangle
  // partait à moitié (700 u/s dedans, rien dehors), se déchirait en deux et
  // l'essai était perdu par dispersion. Le courant monte donc en douceur
  // sur une lisière : ce qui frôle le bord n'est couplé qu'à moitié.
  it('à cheval sur le bord aval, le corps reste un corps et part d’un bloc', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    s.setLevel([], [])
    s.spawnDisc(-650, 0, 400, KIND_PLAYER) // centré sur le bord est du rectangle
    s.relabel()
    const avant = s.playerCount
    expect(avant).toBeGreaterThan(300)
    const rect = { minX: -1150, minY: -260, maxX: -650, maxY: 260, angle: 0 }
    for (let k = 0; k < 180; k++) {
      s.applyChasse(rect, s.params.dt)
      s.step(s.params.dt)
    }
    expect(s.dispersed).toBe(false)
    expect(s.playerCount).toBeGreaterThan(avant * 0.9) // rien d'égaré
    expect(s.stats.centroidX).toBeGreaterThan(-500) // et il est bien parti vers l'est
  })
})
