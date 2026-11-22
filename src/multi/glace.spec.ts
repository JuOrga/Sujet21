import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER as KIND_PLAYER_JEU, type Bounds } from '../sim/solver'
import { TERRAIN } from './hockey'
import { commandeManette, litManette, nouvelEtatManette, type PadLu } from './manetteMulti'
import { DASH_VITESSE, GLACE_MAX, GLACE_REPOS, Hote, SALLE } from './partie'
import { Robot } from './robot'
import { FluidSimMulti, KIND_PLAYER } from './solveurMulti'
import { entend, type Instantane } from './sonsMulti'
import { MODE_HOCKEY, MODE_LIBRE, MODE_SUMO, PHASE_JEU, decodeCommande, encodeCommande, encodeEtat, litEnteteEtat, particulesVides, type Commande, type CorpsTrame } from './trame'

// LA GLACE À DEUX. Dans le solveur du jeu, geler est l'affaire d'un seul
// corps ; la copie du multi en portait le code, endormi. Ces tests disent ce
// que « réveillé » veut dire : chacun gèle pour soi, deux blocs restent deux
// blocs, un bloc a une masse (il reçoit autant qu'il donne), le palet du
// hockey rebondit dessus — et, à un seul joueur, rien n'a bougé d'un bit.

const VIDE: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const dt = DEFAULT_PARAMS.dt

/** Deux corps de `n` particules, à `ecart` l'un de l'autre sur l'axe x. */
function duo(n: number, ecart: number): FluidSimMulti {
  const sim = new FluidSimMulti({ ...DEFAULT_PARAMS }, VIDE, 2048, 2)
  sim.courant = 0
  sim.spawnDisc(-ecart / 2, 0, n, KIND_PLAYER)
  sim.courant = 1
  sim.spawnDisc(ecart / 2, 0, n, KIND_PLAYER)
  sim.courant = 0
  sim.relabel()
  return sim
}
/** Ce qu'on mesure d'un corps sur ses particules : combien, combien de
 *  gelées, sa vitesse moyenne et son rayon quadratique. */
function mesure(sim: FluidSimMulti, j: number): { n: number; gelees: number; x: number; vx: number; vy: number; rayon: number } {
  let n = 0
  let gelees = 0
  let x = 0
  let y = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER || sim.proprio[i] !== j) continue
    n++
    if (sim.frozen[i] === 1) gelees++
    x += sim.posX[i]
    y += sim.posY[i]
    vx += sim.velX[i]
    vy += sim.velY[i]
  }
  x /= n
  y /= n
  let r = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER || sim.proprio[i] !== j) continue
    r += (sim.posX[i] - x) ** 2 + (sim.posY[i] - y) ** 2
  }
  return { n, gelees, x, vx: vx / n, vy: vy / n, rayon: Math.sqrt(r / n) }
}
function lance(sim: FluidSimMulti, j: number, vx: number): void {
  for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_PLAYER && sim.proprio[i] === j) sim.velX[i] += vx
}
/** L'élan d'ensemble sur x, toutes particules comprises. */
function elan(sim: FluidSimMulti): number {
  let e = 0
  for (let i = 0; i < sim.count; i++) e += sim.velX[i]
  return e
}
const avance = (sim: FluidSimMulti, n: number): void => {
  for (let s = 0; s < n; s++) sim.step(dt)
}

describe('glace — le solveur à deux corps', () => {
  it('à UN joueur, geler et fondre donnent les nombres du jeu, au bit près', () => {
    // le filet de la copie (voir solveurMulti.spec.ts), étendu à la glace :
    // l'intention de gel est passée d'un champ unique à un état par corps,
    // et la passe de glace a appris les blocs étrangers et le palet — à un
    // seul corps, sans palet, rien de tout cela ne doit se lire
    const salle: Bounds = { minX: -260, minY: -180, maxX: 260, maxY: 180 }
    const jeu = new FluidSim({ ...DEFAULT_PARAMS }, salle, 2048)
    const multi = new FluidSimMulti({ ...DEFAULT_PARAMS }, salle, 2048, 1)
    jeu.spawnDisc(0, 0, 300, KIND_PLAYER_JEU)
    multi.spawnDisc(0, 0, 300, KIND_PLAYER)
    let gelees = 0
    for (let s = 0; s < 720; s++) {
      // lancé vers une paroi, gelé en vol (le bloc y rebondit), puis fondu
      if (s < 90) {
        jeu.eject(-900, -300, dt)
        multi.eject(-900, -300, dt)
      }
      jeu.freezeIntent = s >= 90 && s < 420
      multi.freezeIntent = s >= 90 && s < 420
      jeu.step(dt)
      multi.step(dt)
      if (s === 300) for (let i = 0; i < multi.count; i++) gelees += multi.frozen[i]
    }
    // (le test ne vaut que si la glace a bien pris : mesuré, les 240
    // particules restées au corps après son jet)
    expect(gelees).toBeGreaterThan(200)
    expect(multi.count).toBe(jeu.count)
    const n = jeu.count
    expect(Array.from(multi.posX.subarray(0, n))).toEqual(Array.from(jeu.posX.subarray(0, n)))
    expect(Array.from(multi.posY.subarray(0, n))).toEqual(Array.from(jeu.posY.subarray(0, n)))
    expect(Array.from(multi.velX.subarray(0, n))).toEqual(Array.from(jeu.velX.subarray(0, n)))
    expect(Array.from(multi.frozen.subarray(0, n))).toEqual(Array.from(jeu.frozen.subarray(0, n)))
  })

  it('chacun gèle pour soi', () => {
    const sim = duo(300, 500)
    sim.corps[1].gel = true
    avance(sim, 80)
    expect(mesure(sim, 1).gelees).toBe(300)
    expect(mesure(sim, 0).gelees).toBe(0)
    // et `freezeIntent` parle du joueur courant, comme le reste
    sim.courant = 0
    expect(sim.freezeIntent).toBe(false)
    sim.courant = 1
    expect(sim.freezeIntent).toBe(true)
  })

  it('deux corps gelés qui se heurtent restent DEUX blocs : l’un s’arrête, l’autre repart avec son élan', () => {
    // (soudés en un seul amas, comme les blocs du jeu qui se touchent, ils
    // repartaient ensemble à la vitesse moyenne — collés jusqu'au dégel)
    const sim = duo(300, 400)
    sim.corps[0].gel = true
    sim.corps[1].gel = true
    avance(sim, 80)
    const rayon = mesure(sim, 0).rayon
    lance(sim, 1, -300)
    const avant = elan(sim)
    avance(sim, 240)
    const a = mesure(sim, 0)
    const b = mesure(sim, 1)
    expect(a.gelees).toBe(300)
    expect(b.gelees).toBe(300)
    // mesuré : −300,8 et +0,8 pour deux blocs de 900
    expect(a.vx).toBeLessThan(-270)
    expect(Math.abs(b.vx)).toBeLessThan(30)
    expect(a.x).toBeLessThan(b.x - 2 * rayon)
    expect(elan(sim)).toBeCloseTo(avant, -1)
    // rigides : aucun des deux n'a changé de forme (mesuré : 0,06 u d'écart
    // sur 42 ; un corps d'eau en prend 4 au même choc)
    expect(Math.abs(a.rayon - rayon)).toBeLessThan(0.5)
    expect(Math.abs(b.rayon - rayon)).toBeLessThan(0.5)
  })

  it('un bloc a une MASSE : heurté par un corps d’eau, il part, et l’élan d’ensemble est conservé', () => {
    // (la glace était sautée par le rebond des corps : elle repoussait
    // l'autre sans rien recevoir — un mur. Et la pression de tout près
    // écartait l'eau sans rien rendre au bloc : ±4 % d'élan sur ce choc.)
    const sim = duo(300, 400)
    sim.corps[0].gel = true
    avance(sim, 80)
    lance(sim, 1, -300)
    const avant = elan(sim)
    avance(sim, 240)
    const glace = mesure(sim, 0)
    expect(glace.gelees).toBe(300)
    expect(glace.vx).toBeLessThan(-100)
    expect(Math.abs(elan(sim) - avant)).toBeLessThan(Math.abs(avant) * 0.002)
    // et dans l'autre sens : c'est le bloc qui arrive
    const sim2 = duo(300, 400)
    sim2.corps[1].gel = true
    avance(sim2, 80)
    lance(sim2, 1, -300)
    const avant2 = elan(sim2)
    avance(sim2, 240)
    expect(mesure(sim2, 0).vx).toBeLessThan(-100)
    expect(Math.abs(elan(sim2) - avant2)).toBeLessThan(Math.abs(avant2) * 0.002)
  })
})

const pas = (h: Hote, n: number): void => {
  for (let s = 0; s < n; s++) h.avance(h.params.dt, 1e9)
}
const neutre = (plus: Partial<Commande> = {}): Commande => ({ pousse: false, ouvert: false, x: 0, y: 0, ...plus })
/** Une partie de hockey en jeu, les corps écartés du palet (voir hockey.spec.ts). */
const enJeu = (ecart0 = -505): Hote => {
  const h = new Hote(2, undefined, MODE_HOCKEY)
  const s = h.sim
  for (let i = 0; i < s.count; i++) s.posX[i] += s.proprio[i] === 0 ? ecart0 : 505
  pas(h, 60)
  h.hockey!.decompte = 0
  pas(h, 1)
  return h
}

describe('glace — le pouvoir, chez l’hôte', () => {
  it('l’APPUI fait prendre le corps ; il tient tant qu’on tient, GLACE_MAX au plus, puis se recharge', () => {
    const h = new Hote(2, undefined, MODE_LIBRE)
    pas(h, 30)
    expect(h.corps()[0]).toMatchObject({ glace: false, glacePrete: true })
    h.commande(0, neutre({ glace: true }))
    pas(h, 36)
    // pris en un tiers de seconde, tout entier, et lui seul
    expect(h.corps()[0]).toMatchObject({ glace: true, glacePrete: false })
    expect(mesure(h.sim, 0).gelees).toBe(900)
    expect(mesure(h.sim, 1).gelees).toBe(0)
    expect(h.corps()[1].glace).toBe(false)
    // toujours tenu : il lâche de lui-même à GLACE_MAX
    pas(h, Math.round(GLACE_MAX * 120) - 36 + 2)
    expect(h.corps()[0]).toMatchObject({ glace: false, glacePrete: false })
    // fondu peu après
    pas(h, 40)
    expect(mesure(h.sim, 0).gelees).toBe(0)
    // la recharge court ; le bouton RESTÉ tenu ne regèle pas à son terme
    pas(h, Math.round(GLACE_REPOS * 120))
    expect(h.corps()[0]).toMatchObject({ glace: false, glacePrete: true })
    // il faut un nouvel appui
    h.commande(0, neutre())
    pas(h, 2)
    h.commande(0, neutre({ glace: true }))
    pas(h, 2)
    expect(h.corps()[0].glace).toBe(true)
  })

  it('relâcher fait fondre, et la glace n’est pas prête aussitôt', () => {
    const h = new Hote(2, undefined, MODE_LIBRE)
    h.commande(0, neutre({ glace: true }))
    pas(h, 60)
    expect(mesure(h.sim, 0).gelees).toBe(900)
    h.commande(0, neutre())
    pas(h, 40)
    expect(mesure(h.sim, 0).gelees).toBe(0)
    expect(h.corps()[0]).toMatchObject({ glace: false, glacePrete: false })
    // un appui pendant la recharge ne fait rien
    h.commande(0, neutre({ glace: true }))
    pas(h, 30)
    expect(h.corps()[0].glace).toBe(false)
    expect(mesure(h.sim, 0).gelees).toBe(0)
  })

  it('un bloc est FERMÉ et ne pousse plus : il file tout droit — mais le dash part encore', () => {
    const h = new Hote(2, undefined, MODE_LIBRE)
    const c = h.sim.corps[0].stats
    // lancé vers la droite (le jet part à gauche), puis gelé en route
    h.commande(0, neutre({ pousse: true, x: c.centroidX - 400, y: c.centroidY }))
    pas(h, 120)
    h.commande(0, neutre({ pousse: true, ouvert: true, x: c.centroidX - 400, y: c.centroidY, glace: true }))
    pas(h, 40)
    expect(h.sim.corps[0].ouvert).toBe(false)
    expect(h.corps()[0].ouvert).toBe(false)
    const v0 = mesure(h.sim, 0)
    expect(v0.gelees).toBeGreaterThan(800)
    expect(v0.vx).toBeGreaterThan(40)
    // une seconde à pousser : rien ne part du bloc, il n'accélère pas
    pas(h, 120)
    const v1 = mesure(h.sim, 0)
    expect(v1.n).toBeGreaterThanOrEqual(v0.n)
    expect(v1.vx).toBeCloseTo(v0.vx, 0)
    // le dash : d'un coup, dans le sens du mouvement
    h.commande(0, neutre({ x: c.centroidX - 400, y: c.centroidY, glace: true, dash: true }))
    pas(h, 3)
    expect(mesure(h.sim, 0).vx).toBeGreaterThan(v1.vx + DASH_VITESSE * 0.9)
    expect(mesure(h.sim, 0).gelees).toBe(v1.gelees)
  })

  it('au sumo on ne se prend pas en glace', () => {
    const h = new Hote(2, undefined, MODE_SUMO)
    pas(h, 60)
    h.regle!.apres(h.sim, h.commandes, 0)
    for (let k = 0; k < 400 && h.jeu()!.phase !== PHASE_JEU; k++) pas(h, 1)
    expect(h.jeu()!.phase).toBe(PHASE_JEU)
    h.commande(0, neutre({ glace: true }))
    pas(h, 60)
    expect(h.corps()[0].glace).toBe(false)
    expect(mesure(h.sim, 0).gelees).toBe(0)
  })

  it('pendant le décompte de l’engagement, personne ne gèle ; et un engagement neuf défait la glace', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    h.commande(0, neutre({ glace: true }))
    pas(h, 60)
    expect(h.corps()[0].glace).toBe(false)
    expect(mesure(h.sim, 0).gelees).toBe(0)
    // en jeu, gelé ; puis on recommence : les corps reviennent liquides
    const j = enJeu()
    j.commande(0, neutre({ glace: true }))
    pas(j, 40)
    expect(j.corps()[0].glace).toBe(true)
    j.recommence()
    expect(j.corps()[0]).toMatchObject({ glace: false, glacePrete: true })
    expect(mesure(j.sim, 0).gelees).toBe(0)
  })
})

describe('glace — au hockey', () => {
  /** Le palet lancé à 800 u/s sur le corps 0 au repos : sa vitesse une
   *  seconde et demie plus tard. */
  const renvoi = (glace: boolean): number => {
    const h = enJeu()
    h.commande(0, neutre({ glace }))
    pas(h, 60)
    h.sim.palet.vx = -800
    pas(h, 180)
    return h.sim.palet.vx
  }
  it('l’eau AMORTIT le palet, la glace le RENVOIE', () => {
    const eau = renvoi(false)
    const glace = renvoi(true)
    // mesuré : +44 sur l'eau, +374 sur la glace (il arrive à ~700)
    expect(Math.abs(eau)).toBeLessThan(100)
    expect(glace).toBeGreaterThan(280)
  })

  /** Le corps 0, lancé à 420 u/s sur le palet au repos : la vitesse que
   *  prend le palet. */
  const frappe = (glace: boolean): number => {
    const h = enJeu(-305)
    h.commande(0, neutre({ glace }))
    pas(h, 60)
    lance(h.sim, 0, 420)
    pas(h, 120)
    return h.sim.palet.vx
  }
  it('un bloc de glace FRAPPE plus fort qu’un corps d’eau', () => {
    const eau = frappe(false)
    const glace = frappe(true)
    // mesuré : 521 contre 662
    expect(eau).toBeGreaterThan(350)
    expect(glace).toBeGreaterThan(eau * 1.15)
  })

  it('le palet ne reste pas dans la glace : il en ressort', () => {
    const h = enJeu()
    h.commande(0, neutre({ glace: true }))
    pas(h, 60)
    const p = h.sim.palet
    // posé d'autorité AU BORD du bloc, à moitié dedans
    const c = mesure(h.sim, 0)
    p.x = c.x + 100
    p.y = h.sim.corps[0].stats.centroidY
    p.vx = 0
    p.vy = 0
    pas(h, 30)
    let dessous = 0
    for (let i = 0; i < h.sim.count; i++) {
      if (h.sim.frozen[i] !== 1) continue
      if (Math.hypot(h.sim.posX[i] - p.x, h.sim.posY[i] - p.y) < p.rayon - 1) dessous++
    }
    expect(dessous).toBe(0)
    expect(mesure(h.sim, 0).gelees).toBeGreaterThan(890)
  })

  it('celui qui TIENT le palet ne gèle pas ; et en glace on ne le prend pas', () => {
    const h = enJeu()
    const p = h.sim.palet
    // le corps 0 s'ouvre, le palet lui arrive : il le tient
    h.commande(0, neutre({ ouvert: true }))
    p.vx = -700
    for (let k = 0; k < 400 && h.jeu()!.tenuPar !== 0; k++) pas(h, 1)
    expect(h.jeu()!.tenuPar).toBe(0)
    h.commande(0, neutre({ ouvert: true, glace: true }))
    pas(h, 40)
    expect(h.corps()[0].glace).toBe(false)
    expect(h.jeu()!.tenuPar).toBe(0)
    expect(mesure(h.sim, 0).gelees).toBe(0)

    // l'inverse : gelé d'abord, puis « ouvert » demandé — le palet rebondit
    const g = enJeu()
    g.commande(0, neutre({ glace: true }))
    pas(g, 40)
    g.commande(0, neutre({ ouvert: true, glace: true }))
    g.sim.palet.vx = -700
    pas(g, 150)
    expect(g.jeu()!.tenuPar).toBe(-1)
    expect(g.sim.palet.vx).toBeGreaterThan(200)
  })
})

describe('glace — ce qui voyage, ce qu’on entend, ce qu’on tient', () => {
  it('la commande porte la glace, sans la confondre avec le dash', () => {
    const c = decodeCommande(encodeCommande(4, { pousse: false, ouvert: false, x: 10, y: 20, glace: true }))!.commande
    expect(c).toMatchObject({ glace: true, dash: false, ouvert: false, pousse: false })
    const d = decodeCommande(encodeCommande(5, { pousse: true, ouvert: false, x: 10, y: 20, dash: true }))!.commande
    expect(d).toMatchObject({ glace: false, dash: true, pousse: true })
  })

  it('l’état d’un corps dit s’il est en glace, et si elle est prête', () => {
    const corps: CorpsTrame[] = [
      { compte: 900, prets: 0, base: 900, x: 100, y: 100, disperse: false, pousse: false, ouvert: false, dashPret: true, dash: false, glace: true, glacePrete: false, viseeX: 0, viseeY: 0 },
      { compte: 900, prets: 0, base: 900, x: 300, y: 100, disperse: false, pousse: false, ouvert: true, dashPret: false, dash: false, glace: false, glacePrete: true, viseeX: 0, viseeY: 0 },
    ]
    const e = litEnteteEtat(encodeEtat(1, 0, SALLE, corps, particulesVides(4))[0], SALLE)!
    expect(e.corps[0]).toMatchObject({ glace: true, glacePrete: false, ouvert: false, dashPret: true })
    expect(e.corps[1]).toMatchObject({ glace: false, glacePrete: true, ouvert: true, dashPret: false })
  })

  it('geler et fondre s’entendent, une fois chacun', () => {
    const corps = (glace: boolean): CorpsTrame[] => [
      { compte: 900, prets: 0, base: 900, x: 700, y: 600, disperse: false, pousse: false, ouvert: false, glace, viseeX: 0, viseeY: 0 },
      { compte: 900, prets: 0, base: 900, x: 2100, y: 600, disperse: false, pousse: false, ouvert: false, viseeX: 0, viseeY: 0 },
    ]
    const image = (t: number, glace: boolean): Instantane => ({ t, corps: corps(glace), jeu: null, salle: TERRAIN, rayonPalet: 0 })
    expect(entend(image(1, false), image(1.02, true), 0)).toMatchObject([{ type: 'gel', mien: true, x: 700 }])
    expect(entend(image(1.02, true), image(1.04, true), 0)).toEqual([])
    expect(entend(image(1.04, true), image(1.06, false), 1)).toMatchObject([{ type: 'degel', mien: false }])
  })

  it('X ou Y, à la manette : la glace, tenue tant que le bouton l’est', () => {
    const pad = (...tenus: number[]): PadLu => ({
      axes: [1, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: tenus.includes(i), value: tenus.includes(i) ? 1 : 0 })),
    })
    const e = nouvelEtatManette()
    for (const b of [2, 3]) {
      litManette(pad(b), e)
      expect(e.glace).toBe(true)
      expect(e.vie).toBe(true)
      expect(commandeManette(e, 0, 0)).toMatchObject({ glace: true, dash: false })
    }
    litManette(pad(), e)
    expect(commandeManette(e, 0, 0).glace).toBe(false)
    // débranchée : plus rien n'est tenu
    litManette(pad(2), e)
    litManette(null, e)
    expect(e.glace).toBe(false)
  })
})

describe('glace — le robot', () => {
  it('le palet posé entre lui et la cage adverse : il se gèle et le FRAPPE vers elle', () => {
    // le robot (joueur 1, qui attaque à gauche) est placé à droite du palet,
    // à portée de dash, dans la zone d'attaque : il ne s'ouvre pas pour le
    // prendre, il le percute. (L'autre corps est écarté de l'axe du tir.)
    const h = new Hote(2, undefined, MODE_HOCKEY)
    const s = h.sim
    for (let i = 0; i < s.count; i++) {
      if (s.proprio[i] === 0) s.posY[i] += 380
      else s.posX[i] -= 260
    }
    pas(h, 60)
    h.hockey!.decompte = 0
    pas(h, 1)
    h.sim.palet.x = 1100
    const r = new Robot(1, () => 0.5)
    let gele = false
    let dash = false
    let vMin = 0
    for (let k = 0; k < 240; k++) {
      const c = r.commande(h, h.params.dt)
      if (c.glace) expect(c.ouvert).toBe(false)
      dash ||= c.dash === true
      h.commande(1, c)
      h.avance(h.params.dt, 1e9)
      gele ||= h.corps()[1].glace === true
      vMin = Math.min(vMin, h.sim.palet.vx)
    }
    expect(dash).toBe(true)
    expect(gele).toBe(true)
    expect(h.jeu()!.tenuPar).toBe(-1)
    // mesuré : le palet part à −684 (un corps d'eau lancé à la vitesse du
    // dash l'envoie à ~520 : voir plus haut)
    expect(vMin).toBeLessThan(-560)
  })
})
