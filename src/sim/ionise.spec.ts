import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, etatRendu, type Bounds } from './solver'

// L'IONISATION VISIBLE — l'état de rendu qui distingue le PLASMA de la
// vapeur. Le défaut rapporté : « le plasma ressemble beaucoup trop à la
// vapeur ». L'état qui ouvre les conduits doit se voir d'un coup d'œil.
// Rien ici ne pèse sur la physique : ionise n'est lu que par le rendu.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const BAND = DEFAULT_PARAMS.plasmaRailRadius * 2.5
const LIGNE = [
  { x: -600, y: 0 },
  { x: 600, y: 0 },
]

function nuage(): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
  sim.setLevel([], [])
  sim.spawnDisc(-450, 0, 60, KIND_PLAYER)
  sim.gasIntent = true // le joueur TIENT l'état vapeur, comme en jeu
  sim.naitEnVapeur()
  return sim
}

function ioniseMoyenne(sim: FluidSim): number {
  let s = 0
  let n = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.gaseous[i] !== 1) continue
    s += sim.ionise[i]
    n++
  }
  return n > 0 ? s / n : 0
}

describe('L’ionisation — ce qui voyage dans la bande devient du plasma', () => {
  it('monte vers 1 pendant le convoyage, en une fraction de seconde', () => {
    const sim = nuage()
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(0.5 / dt); s++) {
      sim.railConvoy(LIGNE, BAND, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
    }
    expect(ioniseMoyenne(sim)).toBeGreaterThan(0.8)
  })

  it('retombe en ~0,5 s quand le champ se coupe — sans à-coup, pas d’interrupteur', () => {
    const sim = nuage()
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(0.5 / dt); s++) {
      sim.railConvoy(LIGNE, BAND, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
    }
    // champ coupé : plus aucun convoyage
    for (let s = 0; s < Math.round(0.3 / dt); s++) sim.step(dt)
    const mi = ioniseMoyenne(sim)
    expect(mi).toBeLessThan(0.7) // ça retombe…
    expect(mi).toBeGreaterThan(0.1) // …mais pas d'un coup
    for (let s = 0; s < Math.round(1.5 / dt); s++) sim.step(dt)
    expect(ioniseMoyenne(sim)).toBeLessThan(0.05)
  })

  it('une particule qui n’est plus gazeuse perd son ionisation immédiatement', () => {
    const sim = nuage()
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(0.5 / dt); s++) {
      sim.railConvoy(LIGNE, BAND, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
    }
    // le joueur relâche : la condensation reprend ses droits
    sim.gasIntent = false
    for (let s = 0; s < Math.round(3 / dt); s++) sim.step(dt)
    // toute particule redevenue liquide est purgée — sans cette règle, une
    // goutte garderait son ionisation en silence et renaîtrait violette à
    // sa prochaine vaporisation, des tableaux plus tard
    for (let i = 0; i < sim.count; i++) {
      if (sim.gaseous[i] !== 1) expect(sim.ionise[i]).toBe(0)
    }
  })

  it('l’eau et la glace n’ionisent jamais : le champ ne parle qu’au gaz', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sim.setLevel([], [])
    sim.spawnDisc(-450, 0, 60, KIND_PLAYER) // liquide, sur la ligne
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(1 / dt); s++) {
      sim.railConvoy(LIGNE, BAND, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
    }
    for (let i = 0; i < sim.count; i++) expect(sim.ionise[i]).toBe(0)
  })
})

describe('etatRendu — l’encodage que les shaders décodent', () => {
  it('givre en positif, vapeur en négatif, plasma au-delà de −1', () => {
    expect(etatRendu(1, 0, 0)).toBe(1) // glace
    expect(etatRendu(0, 0, 0)).toBe(0) // eau
    expect(etatRendu(0, 1, 0)).toBe(-1) // vapeur
    expect(etatRendu(0, 1, 1)).toBe(-2) // plasma plein
    expect(etatRendu(0, 1, 0.5)).toBe(-1.5) // plasma en train de monter
  })

  it('les décodages des shaders retrouvent leurs parts', () => {
    // gas = clamp(-état, 0, 1) : SATURÉ, donc le plasma reste une vapeur
    // pleine pour tout ce qui ne connaît pas le plasma (taille des sprites,
    // pondération du champ) — c'est ce qui rend l'encodage rétro-compatible.
    const gas = (e: number): number => Math.min(1, Math.max(0, -e))
    const plasma = (e: number): number => Math.min(1, Math.max(0, -e - 1))
    expect(gas(etatRendu(0, 1, 1))).toBe(1)
    expect(gas(etatRendu(0, 1, 0))).toBe(1)
    expect(plasma(etatRendu(0, 1, 0))).toBe(0)
    expect(plasma(etatRendu(0, 1, 1))).toBe(1)
    expect(plasma(etatRendu(0, 0.5, 1))).toBe(0) // en pleine condensation, la robe suit la vapeur
  })
})
