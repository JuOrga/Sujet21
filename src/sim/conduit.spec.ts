import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { MAT_WALL, type ObstacleBox } from '../game/level'

// LE CONDUIT — un rail devenu raccourci, mais qui se MÉRITE.
//
// La promesse tient en une phrase : au PLASMA on traverse la paroi, dans
// tout autre cas on bute dessus. Plasma = vapeur DANS un tube dont l'arc
// est engagé — la vapeur seule ne suffit pas, et c'est tout l'intérêt : le
// raccourci est la récompense de l'énigme, pas son contournement.
//
// Ces tests le vérifient dans les deux sens, parce qu'une moitié seule n'a
// aucune valeur — un tube qui laisse passer tout le monde n'est pas un
// raccourci, c'est un trou.
//
// Le montage est le même partout : une paroi pleine en travers de la route,
// et un conduit qui la perce de part en part. On lance le corps dessus et
// l'on regarde de quel côté il finit.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

/** Une paroi verticale pleine, de x=−20 à x=+20. */
const PAROI: ObstacleBox = {
  minX: -20,
  minY: -400,
  maxX: 20,
  maxY: 400,
  material: MAT_WALL,
}

/** Le conduit : une ligne droite qui perce la paroi, de gauche à droite. */
const LIGNE = [
  { x: -300, y: 0 },
  { x: 300, y: 0 },
]

/** `arc` : l'arc ionisé circule-t-il sur le rail ? C'est lui qui ouvre le
 *  tube — en jeu, il vient du traceur de faisceau (railsEngages). */
function monte(
  conduit: boolean,
  arc = true,
  overrides: Partial<SimParams> = {},
): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([PAROI], [])
  sim.setConduits([{ points: LIGNE, conduit }], DEFAULT_PARAMS.plasmaRailRadius * 2.5)
  sim.setConduitsActifs(arc ? new Set([0]) : new Set<number>())
  return sim
}

/** Avance la simulation, en convoyant le conduit comme le fait le jeu. */
function joue(sim: FluidSim, secondes: number, convoie = true): void {
  const dt = sim.params.dt
  for (let s = 0; s < Math.round(secondes / dt); s++) {
    if (convoie)
      sim.railConvoy(
        LIGNE,
        DEFAULT_PARAMS.plasmaRailRadius * 2.5,
        DEFAULT_PARAMS.plasmaConvoy,
        dt,
      )
    sim.step(dt)
  }
}

/** Le corps posé à gauche de la paroi, sur l'axe du conduit. */
function poseAGauche(sim: FluidSim, n = 40): void {
  sim.spawnDisc(-200, 0, n, KIND_PLAYER)
}

/** L'abscisse moyenne du corps — de quel côté de la paroi est-il ? */
function centreX(sim: FluidSim): number {
  let sx = 0
  let n = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER) continue
    sx += sim.posX[i]
    n++
  }
  return n === 0 ? NaN : sx / n
}

/** Combien de particules ont franchi la paroi (x > 20). */
function passees(sim: FluidSim): number {
  let n = 0
  for (let i = 0; i < sim.count; i++)
    if (sim.kind[i] === KIND_PLAYER && sim.posX[i] > 20) n++
  return n
}

describe('Le conduit — au plasma c’est un passage', () => {
  it('le nuage traverse la paroi et ressort de l’autre côté', () => {
    const sim = monte(true)
    poseAGauche(sim)
    sim.gasIntent = true // le joueur TIENT l'état vapeur, comme en jeu
    sim.naitEnVapeur() // le corps EST un nuage tout de suite
    joue(sim, 3)
    // il ne s'agit pas de « quelques gouttes ont fui » : le corps est passé
    expect(passees(sim)).toBeGreaterThan(10)
    expect(centreX(sim)).toBeGreaterThan(20)
  })

  it('sans le drapeau conduit, le MÊME rail ne fait pas traverser', () => {
    // La règle n'est pas un hasard de montage : c'est bien `conduit` qui
    // ouvre le passage, et un rail de guidage ordinaire reste sans corps.
    const sim = monte(false, true)
    poseAGauche(sim)
    sim.gasIntent = true // le joueur TIENT l'état vapeur, comme en jeu
    sim.naitEnVapeur()
    joue(sim, 3)
    expect(passees(sim)).toBe(0)
    expect(centreX(sim)).toBeLessThan(0)
  })
})

describe('Le conduit — ATTEIGNABLE : la vapeur peut venir l’allumer', () => {
  it('la vapeur ENTRE dans un tube fermé, assez près pour ioniser', () => {
    // LE VERROU D'ORIGINE. Un tube fermé qui expulsait aussi la vapeur la
    // mettait hors d'atteinte du faisceau : la capture du rail se fait à
    // `plasmaRailRadius` (30 u) de l'axe, or l'expulsion la jetait au-delà
    // du rayon du tube (75 u) — mesuré, à plus de deux mille unités. Le
    // conduit ne pouvait donc JAMAIS s'ouvrir en jouant, et seuls les tests,
    // qui lèvent le champ à la main, le voyaient marcher.
    const sim = monte(true, false) // FERMÉ
    sim.spawnDisc(-200, 0, 40, KIND_PLAYER) // sur l'axe, à l'écart de la paroi
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 1.5, false)
    let mini = Infinity
    for (let i = 0; i < sim.count; i++)
      if (sim.kind[i] === KIND_PLAYER && sim.posX[i] > -300 && sim.posX[i] < -20)
        mini = Math.min(mini, Math.abs(sim.posY[i]))
    // il DOIT rester de la vapeur dans le rayon de capture du faisceau
    expect(mini).toBeLessThan(DEFAULT_PARAMS.plasmaRailRadius)
  })

  it('mais l’EAU, elle, reste dehors — le tube est bien une paroi', () => {
    const sim = monte(true, false)
    sim.spawnDisc(-200, 0, 40, KIND_PLAYER) // sur l'axe, en liquide
    joue(sim, 1.5, false)
    let mini = Infinity
    for (let i = 0; i < sim.count; i++)
      if (sim.kind[i] === KIND_PLAYER && sim.posX[i] > -300 && sim.posX[i] < -20)
        mini = Math.min(mini, Math.abs(sim.posY[i]))
    expect(mini).toBeGreaterThan(DEFAULT_PARAMS.plasmaRailRadius)
  })
})

describe('Le conduit — sans l’arc, la vapeur ne suffit pas', () => {
  it('le MÊME nuage, tube fermé, reste du mauvais côté de la paroi', () => {
    // C'est la règle demandée : plasma = vapeur + laser. Un corps qui s'est
    // vaporisé LOIN du faisceau n'a rien ionisé, donc rien ouvert.
    const sim = monte(true, false) // conduit posé, mais aucun arc dessus
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 3)
    expect(passees(sim)).toBe(0)
    expect(centreX(sim)).toBeLessThan(0)
  })

  it('le tube fermé laisse ENTRER la vapeur, mais elle n’y gagne RIEN', () => {
    // La règle a changé sciemment : expulser la vapeur d'un tube fermé la
    // mettait hors d'atteinte du faisceau et rendait le conduit inouvrable
    // (voir le groupe ATTEIGNABLE). Elle entre donc — et bute quand même sur
    // la paroi, faute d'arc. Entrer n'est pas traverser.
    const sim = monte(true, false)
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 3)
    expect(passees(sim)).toBe(0)
  })

  it('l’arc levé, le même montage laisse enfin passer', () => {
    // La différence tient au SEUL engagement de l'arc, rien d'autre.
    const sim = monte(true, true)
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 3)
    expect(passees(sim)).toBeGreaterThan(10)
  })
})

describe('Le conduit — dans tout autre état c’est une paroi', () => {
  it('l’EAU ne s’y engage pas : elle est expulsée du tube', () => {
    const sim = monte(true)
    poseAGauche(sim)
    joue(sim, 3) // liquide, jamais vaporisé
    expect(passees(sim)).toBe(0)
    expect(centreX(sim)).toBeLessThan(0)
  })

  it('l’eau posée SUR l’axe du tube en est chassée, sans y rester coincée', () => {
    const sim = monte(true)
    sim.spawnDisc(-200, 0, 30, KIND_PLAYER)
    joue(sim, 2)
    const rayon = DEFAULT_PARAMS.plasmaRailRadius * 2.5
    // aucune particule liquide ne doit dormir au cœur du tube
    let dedans = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      if (Math.abs(sim.posY[i]) < rayon * 0.5 && Math.abs(sim.posX[i]) < 300)
        dedans++
    }
    expect(dedans).toBe(0)
  })

  it('la GLACE non plus ne passe pas — un palet n’est pas un nuage', () => {
    const sim = monte(true)
    poseAGauche(sim)
    for (let i = 0; i < sim.count; i++) sim.frost[i] = 1
    joue(sim, 3)
    expect(passees(sim)).toBe(0)
  })
})

describe('Le conduit — ce qu’il ne change pas', () => {
  it('un tableau sans conduit se comporte exactement comme avant', () => {
    // Le coût et le comportement doivent être nuls quand personne n'en pose :
    // c'est ce qui garantit qu'aucun tableau existant ne bouge.
    const avec = monte(false)
    const sans = new FluidSim({ ...DEFAULT_PARAMS }, OPEN, 2048)
    sans.setLevel([PAROI], [])
    for (const s of [avec, sans]) s.spawnDisc(-200, 0, 40, KIND_PLAYER)
    for (const s of [avec, sans]) {
      const dt = s.params.dt
      for (let k = 0; k < Math.round(2 / dt); k++) s.step(dt)
    }
    expect(centreX(avec)).toBeCloseTo(centreX(sans), 6)
  })

  it('la vapeur HORS du tube bute sur la paroi comme n’importe quoi', () => {
    // Le laissez-passer est celui du TUBE, pas celui de l'état : une vapeur
    // qui n'est pas dedans reste soumise au décor.
    const sim = monte(true)
    sim.spawnDisc(-200, 300, 40, KIND_PLAYER) // loin au-dessus de la ligne
    sim.gasIntent = true // le joueur TIENT l'état vapeur, comme en jeu
    sim.naitEnVapeur()
    joue(sim, 3, false) // aucun convoyage : rien ne l'attire vers le tube
    expect(passees(sim)).toBe(0)
  })
})
