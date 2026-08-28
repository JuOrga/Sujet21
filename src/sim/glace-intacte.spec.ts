import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import type { SpongeDef } from '../game/level'
import { INSTRUMENTS } from '../game/instruments'

// LA RÈGLE : LA GLACE NE PERD JAMAIS DE VOLUME AU CONTACT.
// Un bloc gelé glisse, bute, rebondit — il ne se fait grignoter par rien.
// C'est une règle de conception, pas un détail d'implémentation : elle
// tient la lisibilité de l'état (geler, c'est parier sur une trajectoire,
// pas se sacrifier), et elle doit survivre à toutes les récompenses à
// venir. D'où ce garde-fou : la mécanique d'un côté, le catalogue de
// l'autre.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

// Une éponge large, posée en travers de la route du palet
const EPONGE: SpongeDef = {
  minX: -200,
  minY: -400,
  cols: 20,
  rows: 40,
  cellSize: 20,
  capacityPerCell: 2,
}

function run(sim: FluidSim, seconds: number): void {
  const dt = sim.params.dt
  for (let s = 0; s < Math.round(seconds / dt); s++) sim.step(dt)
}

describe('La glace ne perd jamais de volume au contact', () => {
  it('un palet lancé dans une éponge en ressort entier', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sim.setLevel([], [EPONGE])
    sim.spawnDisc(-700, 0, 120, KIND_PLAYER)
    // on gèle, puis on pousse le bloc à travers le feutre
    sim.freezeIntent = true
    run(sim, 2)
    const gele = sim.count
    for (let i = 0; i < sim.count; i++) sim.velX[i] = 320
    run(sim, 4)
    // il a bien traversé la zone de l'éponge, et il est entier
    expect(sim.count).toBe(gele)
    expect(sim.spongeBites).toBe(0)
  })

  it('le même corps LIQUIDE, lui, se fait boire — la règle n’est pas un hasard', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sim.setLevel([], [EPONGE])
    sim.spawnDisc(-700, 0, 120, KIND_PLAYER)
    run(sim, 0.5)
    for (let i = 0; i < sim.count; i++) sim.velX[i] = 320
    const avant = sim.count
    run(sim, 4)
    expect(sim.count).toBeLessThan(avant)
    expect(sim.spongeBites).toBeGreaterThan(0)
  })

  it('aucune récompense ne prétend le contraire', () => {
    // Un levier qui ferait fondre la glace au contact n'existe pas : les
    // pertes du jeu sont toutes VAPEUR (nuage au repos, mailles d'évent,
    // aura de chaleur) ou LIQUIDE (éponge). Si une carte venait à parler
    // de perte de glace, c'est ce test qui le dirait.
    for (const d of INSTRUMENTS) {
      const texte = `${d.nom} ${d.desc}`.toLowerCase()
      const parleDePerteDeGlace =
        /(glace|palet|gel)/.test(texte) &&
        /(perd|perte|fond|grignot|absorb|boit|évapor)/.test(texte)
      expect(parleDePerteDeGlace).toBe(false)
    }
  })
})
