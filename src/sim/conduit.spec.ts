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

// ——— L'ARRIVÉE ————————————————————————————————————————————————————————
//
// LE DÉFAUT VÉCU : « à la fin du circuit, le volume explose puis se
// regroupe ». Le convoyage GARAIT le nuage sur le dernier point du rail —
// donc DANS le tube — et l'y tenait par un rappel. Reprendre la main
// voulait dire l'y laisser se condenser ; or la paroi d'un conduit expulse
// ce qui est condensé, et elle le faisait d'un seul pas de temps : une
// particule enfoncée de tout le rayon ressortait à rayon/dt. Mesuré sur ce
// montage : pic à 2861 u/s et le corps projeté à 680 u de son arrivée,
// contre 611 u/s pour le même nuage qui se condense en plein air.
//
// L'arrivée est désormais une LIVRAISON : le champ pousse le nuage hors de
// la bouche à allure de livraison, puis le lâche — c'est une vapeur
// ordinaire, dirigeable, que le joueur condensera où il voudra.

/** Le centre du corps, et la vitesse la plus grande qu'il porte. */
function corps(sim: FluidSim): { cx: number; cy: number; vmax: number; n: number } {
  let cx = 0, cy = 0, vmax = 0, n = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER) continue
    cx += sim.posX[i]
    cy += sim.posY[i]
    vmax = Math.max(vmax, Math.hypot(sim.velX[i], sim.velY[i]))
    n++
  }
  return { cx: cx / n, cy: cy / n, vmax, n }
}

/** Le voyage entier, puis le lâcher de touche — en rendant le pic de
 *  vitesse traversé pendant la condensation. `convoie` reproduit le jeu :
 *  le champ se relâche quand la bande se vide. */
function voyageEtLache(sim: FluidSim, apres = 2.5): { pic: number; fin: ReturnType<typeof corps> } {
  const dt = sim.params.dt
  joue(sim, 3)
  sim.gasIntent = false
  let pic = 0
  for (let s = 0; s < Math.round(apres / dt); s++) {
    const nb = sim.railConvoy(LIGNE, DEFAULT_PARAMS.plasmaRailRadius * 2.5, DEFAULT_PARAMS.plasmaConvoy, dt)
    if (nb === 0) sim.setConduitsActifs(new Set<number>())
    sim.step(dt)
    pic = Math.max(pic, corps(sim).vmax)
  }
  return { pic, fin: corps(sim) }
}

describe('Le conduit — l’arrivée LIVRE, elle ne gare pas', () => {
  const BANDE = DEFAULT_PARAMS.plasmaRailRadius * 2.5
  const BOUT = LIGNE[LIGNE.length - 1].x

  it('dépose le nuage HORS du tube, passé la bouche', () => {
    const sim = monte(true)
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    joue(sim, 3)
    // le tube est une capsule de rayon BANDE autour de la ligne : sortir
    // vraiment, c'est dépasser le bout de plus que ce rayon
    expect(corps(sim).cx).toBeGreaterThan(BOUT + BANDE)
  })

  it('puis LÂCHE : la bande ne compte plus le nuage livré', () => {
    const sim = monte(true)
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    // le joueur TIENT toujours la touche : rien de ce qui suit ne vient de
    // lui. C'est le champ qui, tout seul, finit par n'avoir plus rien à
    // porter — et donc à se relâcher. Avant, il tenait le nuage garé sur le
    // terminus indéfiniment : ce compte ne retombait JAMAIS à zéro.
    const dt = sim.params.dt
    let reste = -1
    for (let s = 0; s < Math.round(6 / dt); s++) {
      reste = sim.railConvoy(LIGNE, BANDE, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
      if (reste === 0) break
    }
    expect(reste).toBe(0)
  })

  it('et le volume libéré se condense SANS exploser', () => {
    const sim = monte(true)
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    const { pic, fin } = voyageEtLache(sim)
    // le pic reste de l'ordre d'une condensation ordinaire (611 u/s sur le
    // même nuage en plein air), très loin des 2861 u/s de l'expulsion
    expect(pic).toBeLessThan(1200)
    // et le corps se reforme LÀ, pas à six cents unités de travers
    expect(Math.abs(fin.cy)).toBeLessThan(200)
  })
})

describe('Le conduit — sa paroi POUSSE, elle ne catapulte pas', () => {
  it('borne la sortie de ce qui se condense en plein tube', () => {
    // Le joueur lâche la touche AU MILIEU du tunnel : le tube doit le
    // remettre dehors — c'est la règle, on ne se faufile pas condensé dans
    // une ligne de champ — mais en le poussant, pas en le catapultant.
    const sim = monte(true)
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(0.8 / dt); s++) {
      sim.railConvoy(LIGNE, DEFAULT_PARAMS.plasmaRailRadius * 2.5, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
    }
    sim.gasIntent = false
    let pic = 0
    for (let s = 0; s < Math.round(2 / dt); s++) {
      sim.railConvoy(LIGNE, DEFAULT_PARAMS.plasmaRailRadius * 2.5, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
      pic = Math.max(pic, corps(sim).vmax)
    }
    // sans borne : 2909 u/s, et le corps à 758 u de travers
    expect(pic).toBeLessThan(2200)
    expect(Math.abs(corps(sim).cy)).toBeLessThan(600)
  })

  it('mais il le remet DEHORS : condensé, on ne reste pas dans le tube', () => {
    const sim = monte(true)
    poseAGauche(sim)
    sim.gasIntent = true
    sim.naitEnVapeur()
    const dt = sim.params.dt
    for (let s = 0; s < Math.round(0.8 / dt); s++) {
      sim.railConvoy(LIGNE, DEFAULT_PARAMS.plasmaRailRadius * 2.5, DEFAULT_PARAMS.plasmaConvoy, dt)
      sim.step(dt)
    }
    sim.gasIntent = false
    for (let s = 0; s < Math.round(2 / dt); s++) sim.step(dt)
    // le tube fait 75 u de rayon autour de y = 0 : dehors, c'est au-delà
    expect(Math.abs(corps(sim).cy)).toBeGreaterThan(DEFAULT_PARAMS.plasmaRailRadius * 2.5)
  })
})
