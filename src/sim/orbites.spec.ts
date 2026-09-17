import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER } from './solver'
import { avanceOrbites, ETAT_ORBITES_NEUF, noteOrbites, REGLES_ORBITES, tableauOrbites } from '../game/minijeux'

// LA GARDE DU VRAI SOLVEUR : le lancer gelé dans REGLES_ORBITES a été trouvé
// sur le point-masse puis rejoué par le corps ; ici le CORPS entier (900
// particules) refait toute la salle comme le jeu la joue — le plan large de
// l'entrée immobile, le lancer, les puits, la machine des anneaux sur son
// centre — et doit passer les trois anneaux, finir dans le croissant, et y
// arriver ENTIER : le meilleur verdict doit être atteignable sans un geste.
// La revue du 17/09 : avant, ce test s'arrêtait au deuxième anneau et le
// lancer gelé laissait 8 % du corps au croissant — un verdict PERDU sur le
// chemin idéal. Si ce test tombe, on refait la recherche (la physique ou le
// lancer), jamais on ne déplace un anneau ni un palier à la main.
describe('les orbites — le corps entier suit le lancer, passe tout et arrive entier', () => {
  it('trois anneaux, le croissant, et au moins le premier palier de volume gardé — sans toucher à rien', () => {
    const lv = tableauOrbites()
    const r = REGLES_ORBITES
    const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
    s.setLevel(lv.boxes, lv.sponges)
    s.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n, KIND_PLAYER)
    const dt = s.params.dt
    for (let t = 0; t < 2.6; t += dt) s.step(dt) // le plan large : les puits se taisent
    const a = (r.depart.impulsion.angle * Math.PI) / 180
    s.lanceCorps(Math.cos(a) * r.depart.impulsion.vitesse, Math.sin(a) * r.depart.impulsion.vitesse)
    let e = ETAT_ORBITES_NEUF
    let partMin = 1
    let k = 0
    for (let t = 0; t < r.dureeMax && !e.fini; t += dt, k++) {
      s.applyPuits(lv.puits!, dt)
      s.step(dt)
      s.updatePlayerStats()
      e = avanceOrbites(e, { t, x: s.stats.centroidX, y: s.stats.centroidY }, r)
      if (k % 30 === 0) {
        s.relabel()
        partMin = Math.min(partMin, s.playerCount / s.baseVolume)
      }
    }
    s.relabel()
    const part = s.playerCount / s.baseVolume
    expect(s.dispersed).toBe(false)
    expect(e.anneauxPasses).toBe(3)
    expect(e.fin).toBe('cible')
    expect(part).toBeGreaterThanOrEqual(r.paliers[0])
    expect(partMin).toBeGreaterThanOrEqual(r.paliers[0])
    expect(noteOrbites(part, e.anneauxPasses, e.fin, r).verdict).toBe('juste')
  }, 60000)
})
