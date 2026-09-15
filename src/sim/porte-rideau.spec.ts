// LE SYMPTÔME : une porte qui se ferme D'UN COUP apparaît sur le corps —
// chaque particule est repoussée vers la face la plus proche, et un corps
// au milieu est coupé en deux. LE CORRECTIF : un front qui avance (le
// rideau de porte.ts) ne matérialise la paroi que derrière lui, et pousse
// tout ce qu'il rencontre du même côté — le corps est propulsé, entier.
import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import type { PorteDef } from '../game/level'
import { porteAvance, porteBoite } from '../game/porte'

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
// une porte couchée en travers d'un couloir : 400 de large, 120 de haut
const PORTE: PorteDef = { minX: -200, minY: -60, maxX: 200, maxY: 60, canal: 1 }

function sim(): FluidSim {
  const s = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
  s.setLevel([], [])
  s.baseVolume = 1
  return s
}

describe('FluidSim.setDoors — la matérialisation d’une porte', () => {
  it('D’UN COUP : deux gouttes de part et d’autre du milieu sont chassées chacune de son côté — le corps est coupé', () => {
    const s = sim()
    const haut = s.addParticle(0, 20, KIND_PLAYER)
    const bas = s.addParticle(0, -20, KIND_PLAYER)
    s.setDoors([porteBoite(PORTE, 1)!])
    for (let k = 0; k < 60; k++) s.step(s.params.dt)
    expect(s.posY[haut]).toBeGreaterThan(60)
    expect(s.posY[bas]).toBeLessThan(-60)
  })

  it('EN RIDEAU (du haut vers le bas) : les deux gouttes sortent PAR LE BAS, ensemble, poussées par le front', () => {
    const s = sim()
    const haut = s.addParticle(0, 20, KIND_PLAYER)
    const bas = s.addParticle(0, -20, KIND_PLAYER)
    const porte: PorteDef = { ...PORTE, materialisation: 'rideau' }
    let avance = 0
    let vMin = 0
    for (let k = 0; k < 120; k++) {
      avance = porteAvance(porte, avance, false, s.params.dt)
      const b = porteBoite(porte, avance)
      s.setDoors(b ? [b] : [])
      s.step(s.params.dt)
      vMin = Math.min(vMin, s.velY[haut])
    }
    expect(avance).toBe(1)
    expect(s.posY[haut]).toBeLessThan(-60)
    expect(s.posY[bas]).toBeLessThan(-60)
    // le front a bien PROPULSÉ la goutte : elle est descendue au moins à
    // l'allure du front (120 u en 0,4 s)
    expect(vMin).toBeLessThan(-200)
    // et le corps reste groupé : pas dispersé de part et d'autre
    expect(Math.abs(s.posY[haut] - s.posY[bas])).toBeLessThan(60)
  })

  it('une goutte hors de la porte ne sent rien passer', () => {
    const s = sim()
    const i = s.addParticle(0, 200, KIND_PLAYER)
    const porte: PorteDef = { ...PORTE, materialisation: 'rideau' }
    let avance = 0
    for (let k = 0; k < 120; k++) {
      avance = porteAvance(porte, avance, false, s.params.dt)
      const b = porteBoite(porte, avance)
      s.setDoors(b ? [b] : [])
      s.step(s.params.dt)
    }
    expect(Math.abs(s.posY[i] - 200)).toBeLessThan(5)
  })
})
