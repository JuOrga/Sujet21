// LES ÉTAGES : le sol a une hauteur par endroit, et son pourtour est une
// MARCHE. Les tests gravent la règle des deux sens : d'en bas, la marche est
// une paroi sauf poussée dirigée ; d'en haut, le rebord retient, déborde
// sous l'élan, et se saute d'un geste. Et le déclencheur : une fosse pleine
// alimente son canal.

import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { MAT_PLATEAU, MAT_WALL, type ObstacleBox } from '../game/level'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

function makeSim(overrides: Partial<SimParams> = {}): FluidSim {
  return new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
}

/** Une estrade carrée à l'est de l'origine. */
const ESTRADE: ObstacleBox = {
  minX: 100,
  minY: -200,
  maxX: 500,
  maxY: 200,
  material: MAT_PLATEAU,
  hauteur: 80,
}

/** Une fosse au sud. */
const FOSSE: ObstacleBox = {
  minX: -200,
  minY: 300,
  maxX: 200,
  maxY: 700,
  material: MAT_PLATEAU,
  hauteur: -60,
  canal: 3,
  seuilL: 0.01,
}

/** Une particule lancée vers +x, posée juste à l'ouest de l'estrade. */
function lanceVersEstrade(sim: FluidSim, vitesse: number): number {
  const i = sim.addParticle(94, 0, KIND_PLAYER)
  sim.velX[i] = vitesse
  return i
}

describe('étages — le sol et la naissance', () => {
  it('sans étage posé, tout le monde est au sol zéro et rien ne coûte', () => {
    const sim = makeSim()
    const i = sim.addParticle(50, 50, KIND_PLAYER)
    expect(sim.etage[i]).toBe(0)
    expect(sim.solA(50, 50)).toBe(0)
    sim.step(DEFAULT_PARAMS.dt) // ne jette pas, ne change rien
    expect(sim.etage[i]).toBe(0)
  })

  it('une goutte née SUR l’estrade porte la hauteur de l’estrade', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    const i = sim.addParticle(300, 0, KIND_PLAYER)
    expect(sim.etage[i]).toBe(80)
    expect(sim.solA(300, 0)).toBe(80)
    expect(sim.solA(0, 0)).toBe(0)
  })

  it('changer le décor re-sole les particules existantes (éditeur en direct)', () => {
    const sim = makeSim()
    const i = sim.addParticle(300, 0, KIND_PLAYER)
    expect(sim.etage[i]).toBe(0)
    sim.setLevel([ESTRADE], [])
    expect(sim.etage[i]).toBe(80)
  })
})

describe('étages — la marche montante', () => {
  it('SANS poussée, la marche est une paroi : on ne monte pas', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    const i = lanceVersEstrade(sim, 300)
    for (let k = 0; k < 60; k++) sim.step(DEFAULT_PARAMS.dt)
    expect(sim.etage[i]).toBe(0)
    expect(sim.posX[i]).toBeLessThan(ESTRADE.minX + 6)
  })

  it('AVEC la poussée et l’élan, on monte — et l’étage est pris', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    const i = lanceVersEstrade(sim, 300)
    for (let k = 0; k < 60; k++) {
      sim.armePoussee()
      sim.velX[i] = Math.max(sim.velX[i], 120) // le geste entretient l'élan
      sim.step(DEFAULT_PARAMS.dt)
      if (sim.etage[i] === 80) break
    }
    expect(sim.etage[i]).toBe(80)
    expect(sim.posX[i]).toBeGreaterThan(ESTRADE.minX)
  })

  it('une marche plus haute que « marche max » reste infranchissable', () => {
    const sim = makeSim()
    sim.setLevel([{ ...ESTRADE, hauteur: 500 }], [])
    const i = lanceVersEstrade(sim, 300)
    for (let k = 0; k < 60; k++) {
      sim.armePoussee()
      sim.velX[i] = Math.max(sim.velX[i], 120)
      sim.step(DEFAULT_PARAMS.dt)
    }
    expect(sim.etage[i]).toBe(0)
    expect(sim.posX[i]).toBeLessThan(ESTRADE.minX + 6)
  })

  it('sans élan suffisant, la poussée seule ne suffit pas', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    const i = sim.addParticle(96, 0, KIND_PLAYER)
    for (let k = 0; k < 40; k++) {
      sim.armePoussee()
      sim.velX[i] = 6 // une dérive, pas un élan
      sim.step(DEFAULT_PARAMS.dt)
    }
    expect(sim.etage[i]).toBe(0)
  })
})

describe('étages — le geste arme la poussée', () => {
  it('l’ÉJECTION elle-même ouvre la fenêtre : pas besoin de la sonde', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    // un petit corps pour que l'éjection soit permise
    for (let k = 0; k < 12; k++) sim.addParticle(70 + (k % 4) * 7, -40 + Math.floor(k / 4) * 7, KIND_PLAYER)
    const i = lanceVersEstrade(sim, 300)
    for (let k = 0; k < 60; k++) {
      sim.eject(-400, 0, DEFAULT_PARAMS.dt) // le VRAI geste, visé à l'ouest
      sim.velX[i] = Math.max(sim.velX[i], 120)
      sim.step(DEFAULT_PARAMS.dt)
      if (sim.etage[i] === 80) break
    }
    expect(sim.etage[i]).toBe(80)
  })
})

describe('étages — le rebord', () => {
  /** Une goutte posée sur l'estrade, près du bord ouest, poussée dehors. */
  function surLeBord(sim: FluidSim, vitesse: number): number {
    const i = sim.addParticle(110, 0, KIND_PLAYER)
    expect(sim.etage[i]).toBe(80)
    sim.velX[i] = -vitesse
    return i
  }

  it('sans geste, le rebord RETIENT : la goutte s’arrête au bord', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    const i = surLeBord(sim, 60)
    for (let k = 0; k < 60; k++) {
      sim.velX[i] = Math.min(sim.velX[i], -40)
      sim.step(DEFAULT_PARAMS.dt)
    }
    expect(sim.etage[i]).toBe(80)
    expect(sim.posX[i]).toBeGreaterThan(ESTRADE.minX - 8)
  })

  it('l’élan qui dépasse le débordement passe par-dessus bord', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    const i = surLeBord(sim, 400) // bien au-delà du seuil de débordement
    for (let k = 0; k < 30; k++) sim.step(DEFAULT_PARAMS.dt)
    expect(sim.etage[i]).toBe(0)
    expect(sim.posX[i]).toBeLessThan(ESTRADE.minX)
  })

  it('la descente VOULUE : poussée + direction, même sans grand élan', () => {
    const sim = makeSim()
    sim.setLevel([ESTRADE], [])
    const i = surLeBord(sim, 60)
    for (let k = 0; k < 60; k++) {
      sim.armePoussee()
      sim.velX[i] = Math.min(sim.velX[i], -60)
      sim.step(DEFAULT_PARAMS.dt)
      if (sim.etage[i] === 0) break
    }
    expect(sim.etage[i]).toBe(0)
  })
})

describe('étages — la fosse et son déclencheur', () => {
  it('le bord de fosse retient aussi — et se franchit d’un geste', () => {
    const sim = makeSim()
    sim.setLevel([FOSSE], [])
    const i = sim.addParticle(0, 290, KIND_PLAYER)
    expect(sim.etage[i]).toBe(0)
    // dérive douce vers la fosse, sans geste : retenue au bord
    for (let k = 0; k < 40; k++) {
      sim.velY[i] = Math.max(sim.velY[i], 40)
      sim.step(DEFAULT_PARAMS.dt)
    }
    expect(sim.etage[i]).toBe(0)
    // le geste : on y descend
    for (let k = 0; k < 60; k++) {
      sim.armePoussee()
      sim.velY[i] = Math.max(sim.velY[i], 60)
      sim.step(DEFAULT_PARAMS.dt)
      if (sim.etage[i] === -60) break
    }
    expect(sim.etage[i]).toBe(-60)
    // la fenêtre du geste est encore chaude : on la laisse expirer, immobile
    for (let k = 0; k < 30; k++) {
      sim.velX[i] = 0
      sim.velY[i] = 0
      sim.step(DEFAULT_PARAMS.dt)
    }
    // remonter est une marche de 60 : poussée + élan exigés
    for (let k = 0; k < 40; k++) {
      sim.velY[i] = Math.min(sim.velY[i], -120)
      sim.step(DEFAULT_PARAMS.dt) // sans geste : mur
    }
    expect(sim.etage[i]).toBe(-60)
    for (let k = 0; k < 80; k++) {
      sim.armePoussee()
      sim.velY[i] = Math.min(sim.velY[i], -120)
      sim.step(DEFAULT_PARAMS.dt)
      if (sim.etage[i] === 0) break
    }
    expect(sim.etage[i]).toBe(0)
  })

  it('litresFosse compte ce qui est AU FOND, pas ce qui passe à côté', () => {
    const sim = makeSim()
    sim.setLevel([FOSSE], [])
    // trois gouttes nées au fond, une au sol à côté
    sim.addParticle(0, 500, KIND_PLAYER)
    sim.addParticle(20, 520, KIND_PLAYER)
    sim.addParticle(-20, 480, KIND_PLAYER)
    sim.addParticle(0, 100, KIND_PLAYER)
    const litres = sim.litresFosse(FOSSE)
    expect(litres).toBeCloseTo(3 * DEFAULT_PARAMS.litersPerParticle, 6)
    expect(litres).toBeGreaterThanOrEqual(FOSSE.seuilL ?? 0.5)
  })

  it('la vapeur SURVOLE : son étage suit le sol mais ne compte pas au fond', () => {
    const sim = makeSim()
    sim.setLevel([FOSSE], [])
    const i = sim.addParticle(0, 200, KIND_PLAYER)
    sim.gaseous[i] = 1
    sim.vapor[i] = 1
    sim.gasIntent = true // le nuage est VOULU : sans l'intention, il se recondense en vol
    sim.velY[i] = 200
    for (let k = 0; k < 240; k++) {
      sim.velY[i] = 200
      sim.step(DEFAULT_PARAMS.dt)
      if (sim.posY[i] > 400) break
    }
    expect(sim.posY[i]).toBeGreaterThan(300) // entrée sans retenue
    expect(sim.litresFosse(FOSSE)).toBe(0)
  })
})

describe('étages — naître au fond', () => {
  it('un paquet téléporté au fond y RESTE et alimente le compteur', () => {
    // le chemin des apparitions : fonte au-dessus d'une fosse, téléport de
    // sonde, spawn posé dedans — « né dedans » n'est pas un franchissement
    const sim = makeSim()
    sim.setLevel([FOSSE], [])
    for (let k = 0; k < 200; k++)
      sim.addParticle(-650 + (k % 20) * 8, (k / 20) * 10 - 50, KIND_PLAYER)
    for (let k = 0; k < 10; k++) sim.step(DEFAULT_PARAMS.dt)
    for (let i = 0; i < 200; i++) {
      sim.posX[i] = -80 + (i % 20) * 8
      sim.posY[i] = 380 + Math.floor(i / 20) * 12
      sim.prdX[i] = sim.posX[i]
      sim.prdY[i] = sim.posY[i]
      sim.velX[i] = 0
      sim.velY[i] = 0
    }
    for (let k = 0; k < 30; k++) sim.step(DEFAULT_PARAMS.dt)
    let auFond = 0
    for (let i = 0; i < sim.count; i++) if (sim.etage[i] === -60) auFond++
    expect(auFond).toBeGreaterThan(150)
    expect(sim.litresFosse(FOSSE)).toBeGreaterThanOrEqual(FOSSE.seuilL ?? 0.5)
  })
})

describe('étages — la glace ponte', () => {
  it('un bloc gelé glisse PAR-DESSUS la fosse sans y tomber', () => {
    const sim = makeSim()
    sim.setLevel([FOSSE], [])
    const i = sim.addParticle(0, 250, KIND_PLAYER)
    sim.frozen[i] = 1
    sim.frost[i] = 1
    sim.velY[i] = 300
    for (let k = 0; k < 90; k++) sim.step(DEFAULT_PARAMS.dt)
    expect(sim.etage[i]).toBe(0) // jamais descendu : le palet ponte
  })
})

describe('étages — un mur ordinaire reste un mur', () => {
  it('poussée ou pas, une paroi MAT_WALL bloque comme avant', () => {
    const sim = makeSim()
    sim.setLevel(
      [{ minX: 100, minY: -200, maxX: 500, maxY: 200, material: MAT_WALL }],
      [],
    )
    const i = lanceVersEstrade(sim, 300)
    for (let k = 0; k < 60; k++) {
      sim.armePoussee()
      sim.velX[i] = Math.max(sim.velX[i], 120)
      sim.step(DEFAULT_PARAMS.dt)
    }
    expect(sim.posX[i]).toBeLessThan(100)
  })
})
