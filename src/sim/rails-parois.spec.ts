import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'

// UN RAIL EST UNE PAROI — pour ce qui est CONDENSÉ, et pour cela seulement.
//
// Une ligne de champ magnétique n'est pas un décalque. De l'eau ou de la
// glace ne la traverse pas : elle bute dessus comme sur un mur. Seul le gaz
// passe, parce que seul le gaz s'ionise — c'est ce qui fait du rail une
// mécanique plutôt qu'un dessin. Avant, un rail ordinaire n'avait AUCUNE
// physique et le corps le traversait sans rien sentir.
//
// Ce qui distingue le RACCOURCI (`conduit`) reste entier : lui seul, arc
// engagé, laisse la vapeur ignorer le DÉCOR. Un rail ordinaire barre, il
// n'ouvre jamais rien — et ces tests le gravent aussi, parce que confondre
// les deux ferait de chaque rail un contournement d'énigme.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
/** Un rail VERTICAL en travers de la route, sans le moindre décor autour. */
const RAIL = [
  { x: 0, y: -500 },
  { x: 0, y: 500 },
]
const R = DEFAULT_PARAMS.plasmaRailRadius
const BANDE = R * 2.5

function monte(
  conduit = false,
  arc = false,
  overrides: Partial<SimParams> = {},
): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([], []) // aucun décor : ce qui arrête, c'est le rail seul
  sim.setConduits([{ points: RAIL, conduit }], BANDE, R)
  sim.setConduitsActifs(arc ? new Set([0]) : new Set<number>())
  return sim
}

/** Le corps lancé vers la droite, à gauche du rail. */
function lance(sim: FluidSim, vitesse = 700): void {
  sim.spawnDisc(-220, 0, 40, KIND_PLAYER)
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER) continue
    sim.velX[i] = vitesse
  }
}

function joue(sim: FluidSim, secondes: number): void {
  const dt = sim.params.dt
  for (let s = 0; s < Math.round(secondes / dt); s++) sim.step(dt)
}

/** Combien de particules ont franchi la ligne du rail (x > 0). */
function passees(sim: FluidSim): number {
  let n = 0
  for (let i = 0; i < sim.count; i++)
    if (sim.kind[i] === KIND_PLAYER && sim.posX[i] > 0) n++
  return n
}

describe('Le rail est une PAROI pour l’eau et la glace', () => {
  it('l’eau bute dessus : elle ne le traverse pas', () => {
    const sim = monte()
    lance(sim)
    joue(sim, 1.5)
    expect(passees(sim)).toBe(0)
  })

  it('la glace non plus — un palet n’est pas un nuage', () => {
    const sim = monte()
    lance(sim)
    sim.freezeIntent = true
    joue(sim, 0.6) // le temps que le gel prenne
    sim.freezeIntent = true
    joue(sim, 1.5)
    expect(passees(sim)).toBe(0)
  })

  it('mais la VAPEUR passe : seul le gaz s’ionise, seul le gaz franchit', () => {
    const sim = monte()
    sim.spawnDisc(-220, 0, 40, KIND_PLAYER)
    sim.gasIntent = true
    sim.naitEnVapeur()
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      sim.velX[i] = 700
    }
    joue(sim, 1.5)
    expect(passees(sim)).toBeGreaterThan(20)
  })
})

describe('Un rail ordinaire BARRE, il n’ouvre jamais de passage', () => {
  it('même son arc engagé, il ne fait pas traverser le décor', () => {
    // C'est la ligne de partage avec le conduit. Si un rail ordinaire
    // ouvrait le décor dès qu'un arc le suit, chaque rail deviendrait un
    // contournement d'énigme — et le raccourci ne se mériterait plus.
    const sim = monte(false, true)
    sim.spawnDisc(-220, 0, 40, KIND_PLAYER)
    sim.gasIntent = true
    sim.naitEnVapeur()
    // une paroi PLEINE posée juste derrière le rail : franchir le rail est
    // permis (c'est du gaz), franchir le mur ne l'est pas
    sim.setLevel(
      [{ minX: 60, minY: -500, maxX: 100, maxY: 500, material: 0 }],
      [],
    )
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      sim.velX[i] = 900
    }
    joue(sim, 1.5)
    let auDela = 0
    for (let i = 0; i < sim.count; i++)
      if (sim.kind[i] === KIND_PLAYER && sim.posX[i] > 100) auDela++
    expect(auDela).toBe(0)
  })
})

describe('Le corps d’un rail est CE QU’ON DESSINE', () => {
  it('épouse la bande de capture, pas la bande de convoyage', () => {
    // Le dépôt s'est fait avoir une fois dans l'autre sens — « le tube
    // mentait sur sa taille », collision sur 150, dessiné sur 60. Une
    // particule posée entre les deux rayons doit rester LIBRE.
    const sim = monte()
    const entreLesDeux = (R + BANDE) / 2 // 52,5 : hors du rail, dans la bande
    sim.spawnDisc(entreLesDeux, 0, 1, KIND_PLAYER)
    const avant = sim.posX[0]
    joue(sim, 0.5)
    // rien ne l'a poussée : elle n'est pas dans le corps du rail
    expect(Math.abs(sim.posX[0] - avant)).toBeLessThan(12)
  })
})
