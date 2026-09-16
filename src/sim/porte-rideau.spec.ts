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

  it('MÊME TRÈS VITE, le front n’abandonne personne derrière lui', () => {
    // Mesuré le 15/09/2026 : un amas de 5×5 au milieu de la porte, rideau
    // tombant. À 150, 300, 500, 800, 1200, 2000 et 4000 u/s, les 25
    // particules ressortent PAR LE BAS — aucune ne reste au-dessus. Le
    // demi-plan y est pour tout : une particule rattrapée par le front est
    // DANS la part matérialisée, et le champ l'y pousse vers le front (la
    // coupe est plus proche que la face opposée), si vite qu'il aille.
    // 4000 u/s, c'est 33 u par sous-pas, cinq fois l'espacement du réseau.
    const s = sim()
    const idx: number[] = []
    for (let a = -2; a <= 2; a++)
      for (let b = -2; b <= 2; b++) idx.push(s.addParticle(a * 6.6, b * 6.6, KIND_PLAYER))
    const porte: PorteDef = { ...PORTE, materialisation: 'rideau', allure: 4000 }
    let avance = 0
    for (let k = 0; k < 120; k++) {
      avance = porteAvance(porte, avance, false, s.params.dt)
      const b = porteBoite(porte, avance)
      s.setDoors(b ? [b] : [])
      s.step(s.params.dt)
    }
    expect(avance).toBe(1)
    for (const i of idx) expect(s.posY[i]).toBeLessThan(-60)
  })

  it('LA POUSSÉE NE DÉPEND PAS DE LA CADENCE : le front doit avancer au sous-pas, pas par image', () => {
    // Le front avançait d'un coup de toute l'image, puis la physique
    // jouait ses sous-pas sur une porte figée : le saut était encaissé par
    // un seul sous-pas, et PBD traduit une position corrigée en vitesse
    // (v = déplacement / dt). La propulsion valait donc l'allure
    // multipliée par le nombre de sous-pas — elle changeait avec la
    // cadence de la machine. Mesuré le 15/09/2026 à 300 u/s : 488 u/s au
    // sous-pas quelle que soit la cadence, contre 488 / 559 / 1 480 /
    // 2 243 par image à 1, 2, 4 et 8 sous-pas. Pour mémoire, la note de
    // CHASSE_ALLURE_DEFAUT : à 700 u/s le corps s'écrase et se disperse.
    const porte: PorteDef = { ...PORTE, materialisation: 'rideau' }
    const joue = (sousPas: number, parSousPas: boolean): number => {
      const s = sim()
      const idx: number[] = []
      for (let a = -2; a <= 2; a++)
        for (let b = -2; b <= 2; b++) idx.push(s.addParticle(a * 6.6, b * 6.6, KIND_PLAYER))
      let av = 0
      let crete = 0
      const pose = (dt: number): void => {
        av = porteAvance(porte, av, false, dt)
        const b = porteBoite(porte, av)
        s.setDoors(b ? [b] : [])
      }
      for (let image = 0; image < 200 && av < 1; image++) {
        if (!parSousPas) pose(sousPas * s.params.dt)
        for (let k = 0; k < sousPas; k++) {
          if (parSousPas) pose(s.params.dt)
          s.step(s.params.dt)
          for (const i of idx) crete = Math.max(crete, Math.abs(s.velY[i]))
        }
      }
      return crete
    }
    const auSousPas = [1, 2, 4, 8].map((n) => joue(n, true))
    // la même poussée aux quatre cadences, à 5 % près
    for (const v of auSousPas) expect(v).toBeCloseTo(auSousPas[0], -1.5)
    for (const v of auSousPas) expect(v).toBeLessThan(700)
    // et le piège, gardé sous les yeux : par image, la poussée s'envole
    expect(joue(8, false)).toBeGreaterThan(2 * auSousPas[0])
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
