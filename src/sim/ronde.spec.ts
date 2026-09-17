import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER } from './solver'
import { REGLES_RONDE, tableauRonde } from '../game/ronde'

// LA GARDE DE LA RONDE : le vrai bloc de glace (900 particules), lancé comme
// le tableau le dit, doit REPASSER PAR SON POINT DE DÉPART à chaque tour —
// c'est la définition de « tourne non stop ». Six tours ici (le temps du
// test) ; mesuré le 17/09 : trente tours, même écart. Si ce test tombe, on
// refait la recherche (ronde.recherche.spec.ts), jamais on ne retouche un
// nombre à la main.
describe('la ronde — le bloc de glace repasse par son départ à chaque tour', () => {
  it('six tours : à chaque retour sur y = 0, à moins de 6 u du départ, la vitesse droite, le bloc entier et de même taille', () => {
    const lv = tableauRonde()
    const r = REGLES_RONDE
    const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
    s.setLevel(lv.boxes, lv.sponges)
    s.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n, KIND_PLAYER)
    s.freezeIntent = true // la zone impose la glace
    const dt = s.params.dt
    for (let t = 0; t < 2.6; t += dt) s.step(dt) // le plan large : le gel prend
    s.updatePlayerStats()
    const rms0 = s.stats.rmsRadius
    const a = (r.depart.impulsion.angle * Math.PI) / 180
    const v = r.depart.impulsion.vitesse
    s.lanceCorps(Math.cos(a) * v, Math.sin(a) * v)
    let prevY = 0
    let tPrec = 0
    let tours = 0
    for (let t = 0; tours < 6 && t < 8 * r.periode; t += dt) {
      s.applyPuits(lv.puits!, dt)
      s.step(dt)
      s.updatePlayerStats()
      const { centroidX: x, centroidY: y, velX, velY } = s.stats
      if (t > 1 && prevY < 0 && y >= 0 && x < 0) {
        tours++
        expect(Math.abs(x - r.depart.x)).toBeLessThan(6)
        expect(Math.abs(velX)).toBeLessThan(10)
        expect(velY).toBeCloseTo(v, -1)
        expect(t - tPrec).toBeCloseTo(r.periode, 1)
        tPrec = t
      }
      prevY = y
    }
    expect(tours).toBe(6)
    s.relabel()
    expect(s.dispersed).toBe(false)
    expect(s.playerCount).toBe(s.baseVolume)
    expect(Math.abs(s.stats.rmsRadius - rms0)).toBeLessThan(1)
  }, 120000)
})
