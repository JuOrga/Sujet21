import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER } from './solver'
import { periodeCoeur } from '../game/puits'
import {
  avanceMetronome,
  ETAT_METRONOME_NEUF,
  noteMetronome,
  REGLAGES_METRONOME,
  REGLES_METRONOME,
  tableauMetronome,
  type EtatMetronome,
} from '../game/minijeux'

// LA GARDE DU VRAI SOLVEUR : le métronome a été dessiné sur le point-masse
// (l'isochronie du cœur, le coût d'un Δv) ; ici le CORPS entier (900
// particules) joue la salle comme le jeu la joue — le plan large de l'entrée
// immobile, le lancer, le puits, les éponges, la machine des anneaux sur
// son centre — et TROIS JOUEURS la jouent : celui qui pousse EN CADENCE
// (dans la fenêtre du centre, dans le sens de la marche), celui qui pousse
// SANS ARRÊT, et celui qui ne fait rien. Le premier doit atteindre le
// meilleur verdict ; le deuxième doit y arriver aussi, mais sous le premier
// palier — la cadence doit payer ; le troisième ne doit rien atteindre,
// garder tout, et battre à la demi-période du cœur quelle que soit son
// amplitude : c'est la propriété que le jeu vend. Si ce test tombe, on
// remesure (la physique, les réglages, la salle), jamais on ne déplace un
// palier à la main.
//
// LA PART se compte comme en jeu : ce qui fait corps ET ce qui est en prêt
// dans le halo (une poussée laisse des miettes derrière soi que le rappel
// ramène : les compter mortes à l'instant du dernier anneau mentait de 8 %).

type Joueur = 'cadence' | 'toujours' | 'rien'

function joue(joueur: Joueur): { e: EtatMetronome; part: number; t: number; disperse: boolean; passages: number[]; ejections: number } {
  const lv = tableauMetronome()
  const r = REGLES_METRONOME
  const s = new FluidSim({ ...DEFAULT_PARAMS, ...REGLAGES_METRONOME }, lv.bounds, 4096)
  s.setLevel(lv.boxes, lv.sponges)
  s.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n, KIND_PLAYER)
  const dt = s.params.dt
  for (let t = 0; t < 2.6; t += dt) s.step(dt) // le plan large : le puits se tait
  const a = (r.depart.impulsion.angle * Math.PI) / 180
  s.lanceCorps(Math.cos(a) * r.depart.impulsion.vitesse, Math.sin(a) * r.depart.impulsion.vitesse)
  let e = ETAT_METRONOME_NEUF
  let t = 0
  let ejections = 0
  const passages: number[] = []
  // pas de relabel forcé : le solveur identifie lui-même ses amas tous les
  // componentEvery pas, comme en jeu — un relabel de plus à contretemps
  // changeait la mesure de 8 % (mesuré le 19/09)
  for (; t < r.dureeMax + 1 && !e.fini && !s.dispersed; t += dt) {
    const d = Math.hypot(s.stats.centroidX - r.puits.x, s.stats.centroidY - r.puits.y)
    const v = Math.hypot(s.stats.velX, s.stats.velY)
    const pousse = joueur === 'toujours' || (joueur === 'cadence' && d <= r.fenetre)
    if (pousse && v > 1) {
      // le doigt DERRIÈRE le corps, à l'opposé de la marche et hors de lui
      // (un doigt posé dans la masse la laboure) : la matière part en
      // arrière, le corps gagne dans le sens où il va
      ejections += s.params.ejectRate * dt
      s.eject(s.stats.centroidX - (s.stats.velX / v) * 300, s.stats.centroidY - (s.stats.velY / v) * 300, dt)
    }
    s.applyPuits(lv.puits!, dt)
    s.step(dt)
    s.updatePlayerStats()
    const avant = e
    e = avanceMetronome(e, { t, x: s.stats.centroidX, y: s.stats.centroidY }, r)
    if (e.passages > avant.passages) passages.push(t)
  }
  return { e, part: (s.playerCount + s.enPretCount) / s.baseVolume, t, disperse: s.dispersed, passages, ejections }
}

describe('le métronome — le corps entier pompe dans le puits', () => {
  const r = REGLES_METRONOME

  it('EN CADENCE : les trois anneaux bien avant la durée, et au moins le premier palier de volume gardé', () => {
    const j = joue('cadence')
    expect(j.disperse).toBe(false)
    expect(j.e.anneauxPasses).toBe(3)
    expect(j.e.fin).toBe('anneaux')
    expect(j.t).toBeLessThan(r.dureeMax * 0.7)
    expect(j.part).toBeGreaterThanOrEqual(r.paliers[0])
    // le prix : ce qu'on éjecte, et autant de miettes semées au recul (voir REGLES_METRONOME)
    expect(1 - j.part).toBeLessThan(j.ejections / 900 + 0.2)
    expect(noteMetronome(j.part, j.e.anneauxPasses, r).verdict).toBe('juste')
  }, 120000)

  it('SANS ARRÊT : les trois anneaux aussi, plus vite, mais sous le premier palier — la cadence paie', () => {
    const j = joue('toujours')
    expect(j.disperse).toBe(false)
    expect(j.e.anneauxPasses).toBe(3)
    expect(j.part).toBeLessThan(r.paliers[0])
    expect(j.part).toBeGreaterThanOrEqual(r.paliers[2])
    expect(noteMetronome(j.part, j.e.anneauxPasses, r).verdict).not.toBe('juste')
  }, 120000)

  it('RIEN : le corps ne passe aucun anneau, garde tout, et bat à la demi-période du cœur', () => {
    const j = joue('rien')
    const T = periodeCoeur(r.puits)
    expect(j.disperse).toBe(false)
    expect(j.e.anneauxPasses).toBe(0)
    expect(j.e.fin).toBe('temps')
    expect(j.part).toBeGreaterThan(0.97)
    expect(noteMetronome(j.part, j.e.anneauxPasses, r).verdict).toBe('rate')
    // l'amplitude du lancer : v / ω, à 15 % près (le corps n'est pas un point)
    const omega = (2 * Math.PI) / T
    expect(j.e.apogee).toBeGreaterThan((r.depart.impulsion.vitesse / omega) * 0.85)
    expect(j.e.apogee).toBeLessThan((r.depart.impulsion.vitesse / omega) * 1.15)
    // les passages, à la demi-période, à 2,5 % près — l'isochronie
    expect(j.passages.length).toBeGreaterThanOrEqual(Math.floor(r.dureeMax / (T / 2)) - 1)
    for (let i = 1; i < j.passages.length; i++) {
      const ecart = j.passages[i] - j.passages[i - 1]
      expect(Math.abs(ecart - T / 2)).toBeLessThan(T * 0.025)
    }
  }, 120000)
})
