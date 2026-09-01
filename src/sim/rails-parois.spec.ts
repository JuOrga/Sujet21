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

/** Le même corps, mais gazeux. */
function lanceVapeur(sim: FluidSim, vitesse = 700): void {
  sim.spawnDisc(-220, 0, 40, KIND_PLAYER)
  sim.gasIntent = true
  sim.naitEnVapeur()
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

  it('et la VAPEUR ORDINAIRE non plus : seul le PLASMA franchit', () => {
    // Être gazeux ne suffit pas. Le plasma, c'est de la vapeur sur une ligne
    // de champ ALLUMÉE — un nuage qui n'a rien ionisé bute comme le reste.
    const sim = monte(false, false)
    lanceVapeur(sim)
    joue(sim, 1.5)
    expect(passees(sim)).toBe(0)
  })

  it('mais le PLASMA passe : l’arc engagé, le même nuage franchit', () => {
    const sim = monte(false, true) // l'arc court sur ce rail
    lanceVapeur(sim)
    joue(sim, 1.5)
    expect(passees(sim)).toBeGreaterThan(20)
  })
})

// LE VERROU DE #304, À SURVEILLER POUR TOUJOURS. Pour allumer un rail il
// faut ioniser le faisceau à moins de `plasmaRailRadius` de sa ligne. Si la
// vapeur ordinaire était repoussée jusqu'à ce rayon-là, on ne pourrait plus
// JAMAIS allumer ce qu'on veut franchir. Le gaz bute donc sur un CŒUR plus
// mince, et il doit rester de la vapeur dans le rayon de capture.
describe('Un rail barré reste ALLUMABLE', () => {
  it('la vapeur repoussée reste à portée d’ionisation', () => {
    const sim = monte()
    sim.spawnDisc(0, 0, 40, KIND_PLAYER) // pile sur l'axe
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 2)
    // le rail est VERTICAL (x = 0) : la distance à son axe, c'est |x|
    let mini = Infinity
    for (let i = 0; i < sim.count; i++)
      if (sim.kind[i] === KIND_PLAYER) mini = Math.min(mini, Math.abs(sim.posX[i]))
    expect(mini).toBeLessThan(R)
  })

  it('le cœur BARRE sans CHASSER : la vapeur n’est pas propulsée', () => {
    // La vitesse se lit (prd − pos)/dt : repousser la seule position prédite
    // ajoute de la vitesse, et le répéter à chaque pas la pompe — mesuré, la
    // vapeur finissait à 37,8 u de l'axe, hors de portée d'allumage. On
    // translate donc aussi la position d'origine : arrêtée, pas éjectée.
    const sim = monte()
    sim.spawnDisc(0, 0, 40, KIND_PLAYER)
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 2)
    let vmax = 0
    for (let i = 0; i < sim.count; i++)
      if (sim.kind[i] === KIND_PLAYER)
        vmax = Math.max(vmax, Math.hypot(sim.velX[i], sim.velY[i]))
    expect(vmax).toBeLessThan(140) // le nuage flotte, il n'est pas soufflé
  })
})

// LA SORTIE DE L'ÉTAT PLASMA — le moment délicat. Le nuage voyage SUR l'axe,
// donc dans la paroi, et l'instant où l'arc tombe il redevient de la vapeur
// ordinaire, que la ligne de champ refuse. Ce qu'on exige alors : que rien
// ne soit soufflé, et que le corps ne se retrouve pas de l'autre côté par
// accident. Il reste où il est, à cheval sur la ligne, et il ne la franchit
// plus — la paroi ARRÊTE, elle ne catapulte pas.
describe('Quand on sort du plasma sur la ligne', () => {
  it('rien n’est soufflé : aucune bourrasque à la coupure de l’arc', () => {
    const sim = monte(false, true) // arc engagé : le nuage est du plasma
    lanceVapeur(sim, 0)
    joue(sim, 0.4) // il s'installe sur la ligne
    sim.setConduitsActifs(new Set<number>()) // l'arc tombe
    const dt = sim.params.dt
    let pic = 0
    for (let s = 0; s < Math.round(1.5 / dt); s++) {
      sim.step(dt)
      for (let i = 0; i < sim.count; i++)
        if (sim.kind[i] === KIND_PLAYER)
          pic = Math.max(pic, Math.hypot(sim.velX[i], sim.velY[i]))
    }
    expect(pic).toBeLessThan(200)
  })

  it('et le corps ne franchit plus la ligne', () => {
    // Lancé vers la ligne EN PLASMA, il la traverserait. L'arc coupé juste
    // avant, il doit rester du côté d'où il vient.
    const sim = monte(false, true)
    lanceVapeur(sim, 700)
    joue(sim, 0.15) // il approche, encore du bon côté
    sim.setConduitsActifs(new Set<number>()) // l'arc tombe avant la ligne
    joue(sim, 1.5)
    expect(passees(sim)).toBe(0)
  })

  it('et s’il se CONDENSE dessus, la paroi le remet dehors sans le catapulter', () => {
    // L'autre sortie d'état : le joueur lâche la touche pendant le voyage.
    // Le corps devient de la matière condensée DANS la ligne de champ — et
    // là, ce n'est plus un arrêt, c'est une expulsion. Elle est bornée par
    // plasmaSortie, comme celle d'un conduit (cf. la livraison au terminus).
    const sim = monte(false, true) // arc engagé : le nuage peut être DANS l'axe
    sim.spawnDisc(0, 0, 40, KIND_PLAYER) // pile sur la ligne, en plasma
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 0.3)
    sim.setConduitsActifs(new Set<number>()) // l'arc tombe
    sim.gasIntent = false // et le corps se condense sur place
    const dt = sim.params.dt
    let pic = 0
    for (let s = 0; s < Math.round(2 / dt); s++) {
      sim.step(dt)
      for (let i = 0; i < sim.count; i++)
        if (sim.kind[i] === KIND_PLAYER)
          pic = Math.max(pic, Math.hypot(sim.velX[i], sim.velY[i]))
    }
    // très loin des 2861 u/s que l'expulsion non bornée produisait
    expect(pic).toBeLessThan(1400)
    // et il est bien SORTI de la paroi : condensé, on ne reste pas dedans.
    // Le rail est VERTICAL (x = 0) : la distance à l'axe, c'est |x|.
    let dedans = 0
    for (let i = 0; i < sim.count; i++)
      if (sim.kind[i] === KIND_PLAYER && sim.gaseous[i] === 0 && Math.abs(sim.posX[i]) < R * 0.6)
        dedans++
    expect(dedans).toBe(0)
  })
})
