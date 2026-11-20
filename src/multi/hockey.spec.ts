import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { BUTS_POUR_GAGNER, CAGE, CHARGE_PLEINE, Hockey, RAYON_PALET, TENUE_MAX, TERRAIN } from './hockey'
import { Hote, Miroir, SALLE } from './partie'
import { FluidSimMulti, KIND_PLAYER } from './solveurMulti'
import { MODE_HOCKEY, MODE_LIBRE, PHASE_BUT, PHASE_FINI, PHASE_JEU, encodeEtat, litEnteteEtat, modeTrame, particulesVides, type Commande, type JeuTrame } from './trame'

const pas = (h: Hote, n: number): void => {
  for (let s = 0; s < n; s++) h.avance(h.params.dt, 1e9)
}
const MILIEU_X = (TERRAIN.minX + TERRAIN.maxX) / 2
const MILIEU_Y = (TERRAIN.minY + TERRAIN.maxY) / 2
/** Largeur sur hauteur du corps j : 1 pour un rond. */
const aplati = (sim: FluidSimMulti, j: number): number => {
  let cx = 0
  let cy = 0
  let m = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER || sim.proprio[i] !== j) continue
    cx += sim.posX[i]
    cy += sim.posY[i]
    m++
  }
  cx /= m
  cy /= m
  let sx = 0
  let sy = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER || sim.proprio[i] !== j) continue
    sx += (sim.posX[i] - cx) ** 2
    sy += (sim.posY[i] - cy) ** 2
  }
  return Math.sqrt(sx / sy)
}

describe('hockey — le palet et l’eau', () => {
  it('à l’engagement : le palet au centre, immobile, chacun dans son camp', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 120)
    const p = h.sim.palet
    expect(p.actif).toBe(true)
    expect(p.x).toBeCloseTo(MILIEU_X, 3)
    expect(p.y).toBeCloseTo(MILIEU_Y, 3)
    expect(Math.hypot(p.vx, p.vy)).toBeLessThan(1)
    expect(h.sim.corps[0].stats.centroidX).toBeLessThan(MILIEU_X - 500)
    expect(h.sim.corps[1].stats.centroidX).toBeGreaterThan(MILIEU_X + 500)
    expect(h.jeu()).toMatchObject({ scores: [0, 0], phase: PHASE_JEU, tenuPar: -1 })
  })

  it('en partie libre, il n’y a ni palet ni retour de loin', () => {
    const h = new Hote(2, undefined, MODE_LIBRE)
    expect(h.sim.palet.actif).toBe(false)
    expect(h.sim.rappelSansLimite).toBe(false)
    expect(h.jeu()).toBeNull()
    expect(h.salle).toBe(SALLE)
  })

  it('un corps FERMÉ amortit le palet : il s’écrase, le renvoie, et rien n’y entre', () => {
    // la demande : « si on n'ouvre pas le volume, le palet rebondit dessus —
    // pas comme un glaçon, il y a un amorti, une déformation du liquide »
    const h = new Hote(2, undefined, MODE_HOCKEY)
    const p = h.sim.palet
    pas(h, 60)
    p.vx = 800
    let ecrase = 1
    let auCoeur = 0
    for (let s = 0; s < 400; s++) {
      pas(h, 1)
      ecrase = Math.min(ecrase, aplati(h.sim, 1))
      // aucune particule du corps au CŒUR du palet (à moins d'un demi-rayon
      // de son centre) : le bord, lui, est repris à chaque pas
      for (let i = 0; i < h.sim.count; i++) {
        if (h.sim.proprio[i] === 1 && Math.hypot(h.sim.posX[i] - p.x, h.sim.posY[i] - p.y) < RAYON_PALET / 2) auCoeur++
      }
    }
    const c = h.sim.corps[1]
    // il ne l'a pas traversé, et repart vers d'où il vient (mesuré : −37 u/s)
    expect(p.x).toBeLessThan(c.stats.centroidX)
    expect(p.vx).toBeLessThan(0)
    // amorti : il rend bien moins qu'il n'a reçu
    expect(Math.abs(p.vx)).toBeLessThan(300)
    // le corps a encaissé (mesuré : 99 u/s), s'est écrasé (0,78), est revenu rond
    expect(c.stats.velX).toBeGreaterThan(50)
    expect(ecrase).toBeLessThan(0.88)
    expect(aplati(h.sim, 1)).toBeGreaterThan(0.94)
    expect(aplati(h.sim, 1)).toBeLessThan(1.06)
    expect(c.playerCount).toBe(900)
    expect(auCoeur).toBe(0)
  })

  it('le jet POUSSE le palet', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 60)
    h.commande(0, { pousse: true, ouvert: false, x: MILIEU_X, y: MILIEU_Y })
    pas(h, 120)
    h.commande(0, { pousse: false, ouvert: false, x: MILIEU_X, y: MILIEU_Y })
    pas(h, 120)
    // mesuré : 94 u/s après une seconde de jet, 131 une seconde plus tard
    expect(h.sim.palet.vx).toBeGreaterThan(50)
  })

  it('la matière tirée REVIENT au corps, et vite, sans le freiner', () => {
    // sans ce retour, un corps arrivait au palet avec 593 particules sur 900
    const mesure = (mode: number): { pendant: number; vitesse: number; apres: number } => {
      const h = new Hote(2, undefined, mode)
      pas(h, 60)
      if (h.hockey) h.sim.palet.y = 200 // le palet hors du chemin
      // on pousse quatre secondes en biais…
      h.commande(0, { pousse: true, ouvert: false, x: 0, y: h.salle.maxY / 2 + 500 })
      pas(h, 480)
      const pendant = h.sim.corps[0].playerCount
      const vitesse = h.sim.corps[0].stats.velX
      // …puis on laisse filer deux secondes
      h.commande(0, { pousse: false, ouvert: false, x: 0, y: h.salle.maxY / 2 + 500 })
      pas(h, 240)
      return { pendant, vitesse, apres: h.sim.corps[0].playerCount }
    }
    const libre = mesure(MODE_LIBRE)
    const hockey = mesure(MODE_HOCKEY)
    // en partie libre la matière tirée est perdue (mesuré : 639 puis 626)
    expect(libre.apres).toBeLessThan(700)
    // au hockey le corps reste gros PENDANT la poussée (mesuré : ~840 ; 628
    // avec le premier réglage du retour, qui laissait les gouttes traîner)…
    expect(hockey.pendant).toBeGreaterThan(780)
    // …et il est presque entier deux secondes après (mesuré : 890 à 900)
    expect(hockey.apres).toBeGreaterThan(870)
    // le retour n'est pas un frein ; il pousse un peu (mesuré : 255 u/s
    // contre 213, les gouttes qui rentrent arrivent par l'arrière)
    expect(hockey.vitesse).toBeGreaterThan(libre.vitesse * 0.9)
    expect(hockey.vitesse).toBeLessThan(libre.vitesse * 1.4)
  })
})

describe('hockey — avaler, porter, lancer', () => {
  /** Le joueur 1 s'ouvre, le palet lui arrive dessus : il le tient. */
  const prise = (): Hote => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 60)
    h.commande(1, { pousse: false, ouvert: true, x: 0, y: MILIEU_Y })
    h.sim.palet.vx = 600
    for (let s = 0; s < 360 && h.hockey!.tenuPar !== 1; s++) pas(h, 1)
    return h
  }

  it('un corps OUVERT avale le palet, en encaisse l’élan, et le porte', () => {
    const h = prise()
    expect(h.hockey!.tenuPar).toBe(1)
    pas(h, 120)
    const c = h.sim.corps[1]
    const p = h.sim.palet
    expect(Math.hypot(p.x - c.stats.centroidX, p.y - c.stats.centroidY)).toBeLessThan(20)
    // l'amorti : le corps est parti avec lui (mesuré : 56 u/s)
    expect(c.stats.velX).toBeGreaterThan(30)
    expect(c.playerCount).toBe(900)
  })

  it('il suffit de le TOUCHER, ouvert, pour l’absorber : frôlé au bord, il est pris et aspiré au cœur', () => {
    // la première règle voulait le palet à moitié recouvert : frôlé, il
    // traversait le corps ouvert sans être pris
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 60)
    const c = h.sim.corps[1]
    h.commande(1, { pousse: false, ouvert: true, x: 0, y: MILIEU_Y })
    // le palet passe AU BORD du corps : son centre à 135 u au-dessus du cœur
    // (le corps fait ~103 u de rayon, le palet 48 : ils se recouvrent de 16 u)
    const p = h.sim.palet
    p.y = MILIEU_Y - 135
    p.vx = 500
    let prisA = -1
    for (let s = 0; s < 300 && prisA < 0; s++) {
      pas(h, 1)
      if (h.hockey!.tenuPar === 1) prisA = Math.hypot(p.x - c.stats.centroidX, p.y - c.stats.centroidY)
    }
    // pris alors qu'il n'était qu'au bord, loin du cœur…
    expect(h.hockey!.tenuPar).toBe(1)
    expect(prisA).toBeGreaterThan(100)
    // …puis aspiré : une demi-seconde après, il est au cœur du corps
    pas(h, 60)
    expect(Math.hypot(p.x - h.sim.corps[1].stats.centroidX, p.y - h.sim.corps[1].stats.centroidY)).toBeLessThan(15)
  })

  it('FERMÉ, le toucher ne l’absorbe pas', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 60)
    const p = h.sim.palet
    p.y = MILIEU_Y - 135
    p.vx = 500
    for (let s = 0; s < 300; s++) {
      pas(h, 1)
      expect(h.hockey!.tenuPar).toBe(-1)
    }
  })

  it('se refermer LANCE le palet vers le pointeur, sans rien arracher au corps', () => {
    const h = prise()
    pas(h, Math.ceil(CHARGE_PLEINE * 120) + 10)
    expect(h.jeu()!.charge).toBe(1)
    const avant = h.sim.corps[1].stats.velX
    // on vise à gauche, et on se referme
    h.commande(1, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y })
    pas(h, 1)
    const p = h.sim.palet
    expect(h.hockey!.tenuPar).toBe(-1)
    expect(p.vx).toBeLessThan(-1300)
    expect(Math.abs(p.vy)).toBeLessThan(60)
    let pire = 900
    for (let s = 0; s < 120; s++) {
      pas(h, 1)
      pire = Math.min(pire, h.sim.corps[1].playerCount)
    }
    // le défaut vu à la première version : le pas où le porteur se refermait,
    // le palet au cœur de son corps en chassait la matière (351 sur 900)
    expect(pire).toBe(900)
    // le recul : le corps est reparti à l'opposé du lancer (mesuré : +200 u/s)
    expect(h.sim.corps[1].stats.velX).toBeGreaterThan(avant + 120)
    // et le palet est bien SORTI du corps, vers la gauche
    expect(p.x).toBeLessThan(h.sim.corps[1].stats.centroidX - 200)
  })

  it('relâché aussitôt, il part moins fort', () => {
    const h = prise()
    pas(h, 6)
    h.commande(1, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y })
    pas(h, 1)
    expect(h.sim.palet.vx).toBeLessThan(-400)
    expect(h.sim.palet.vx).toBeGreaterThan(-800)
  })

  it('on ne le garde pas : au bout du délai il s’échappe, et ne se reprend pas aussitôt', () => {
    const h = prise()
    pas(h, Math.ceil(TENUE_MAX * 120) + 2)
    expect(h.hockey!.tenuPar).toBe(-1)
    // toujours ouvert, le palet encore sur lui : il ne le reprend pas
    pas(h, 100)
    expect(h.sim.corps[1].ouvert).toBe(true)
    expect(h.hockey!.tenuPar).toBe(-1)
  })
})

describe('hockey — les parois, les cages, le score', () => {
  /** Un terrain léger pour la règle seule : deux petits corps loin du palet. */
  const petit = (): { sim: FluidSimMulti; jeu: Hockey; commandes: Commande[]; avance: (n: number) => string[] } => {
    const sim = new FluidSimMulti({ ...DEFAULT_PARAMS }, TERRAIN, 1024, 2)
    sim.courant = 0
    sim.spawnDisc(400, 200, 60, KIND_PLAYER)
    sim.courant = 1
    sim.spawnDisc(TERRAIN.maxX - 400, 200, 60, KIND_PLAYER)
    sim.courant = 0
    sim.relabel()
    const jeu = new Hockey()
    jeu.engage(sim)
    const commandes: Commande[] = [
      { pousse: false, ouvert: false, x: 0, y: 0 },
      { pousse: false, ouvert: false, x: 0, y: 0 },
    ]
    const avance = (n: number): string[] => {
      const vus: string[] = []
      for (let s = 0; s < n; s++) {
        jeu.avant(sim)
        sim.step(sim.params.dt)
        const e = jeu.apres(sim, commandes, sim.params.dt)
        if (e === 'engagement') jeu.engage(sim)
        if (e) vus.push(e)
      }
      return vus
    }
    return { sim, jeu, commandes, avance }
  }

  it('le palet rebondit sur les parois et reste sur le terrain', () => {
    const { sim, avance } = petit()
    const p = sim.palet
    // de haut en bas, loin des cages : il fait plusieurs allers-retours
    p.vy = -1200
    let rebonds = 0
    let sens = -1
    for (let s = 0; s < 480; s++) {
      avance(1)
      expect(p.y - RAYON_PALET).toBeGreaterThanOrEqual(TERRAIN.minY - 1e-6)
      expect(p.y + RAYON_PALET).toBeLessThanOrEqual(TERRAIN.maxY + 1e-6)
      if (Math.sign(p.vy) !== sens) {
        sens = Math.sign(p.vy)
        rebonds++
      }
    }
    expect(rebonds).toBeGreaterThanOrEqual(2)
    // chaque paroi lui prend un peu de vitesse, la glace aussi
    expect(Math.abs(p.vy)).toBeLessThan(1200)
    expect(Math.abs(p.vy)).toBeGreaterThan(300)
  })

  it('à côté de la cage, la paroi renvoie : pas de but', () => {
    const { sim, jeu, avance } = petit()
    const p = sim.palet
    p.x = 300
    p.y = MILIEU_Y - CAGE / 2 - 150
    p.vx = -900
    const vus = avance(120)
    expect(vus).toEqual([])
    expect(jeu.scores).toEqual([0, 0])
    expect(p.vx).toBeGreaterThan(0)
  })

  it('dans la cage de GAUCHE : un but pour le joueur 1, une pause, puis l’engagement', () => {
    const { sim, jeu, avance } = petit()
    const p = sim.palet
    p.x = 300
    p.y = MILIEU_Y + 40
    p.vx = -900
    const vus = avance(60)
    expect(vus).toEqual(['but'])
    expect(jeu.scores).toEqual([0, 1])
    expect(jeu.phase).toBe(PHASE_BUT)
    expect(jeu.buteur).toBe(1)
    expect(p.actif).toBe(false)
    // deux secondes plus tard, le palet est remis au centre
    expect(avance(300)).toEqual(['engagement'])
    expect(jeu.phase).toBe(PHASE_JEU)
    expect(p.actif).toBe(true)
    expect(p.x).toBeCloseTo(MILIEU_X, 3)
    expect(Math.hypot(p.vx, p.vy)).toBeLessThan(1)
  })

  it('dans la cage de DROITE : un but pour le joueur 0', () => {
    const { sim, jeu, avance } = petit()
    sim.palet.x = TERRAIN.maxX - 300
    sim.palet.vx = 900
    expect(avance(60)).toEqual(['but'])
    expect(jeu.scores).toEqual([1, 0])
  })

  it('le premier au score dit gagne : la partie s’arrête, RECOMMENCER la relance', () => {
    const { sim, jeu, avance } = petit()
    const vus: string[] = []
    for (let k = 0; k < BUTS_POUR_GAGNER; k++) {
      sim.palet.x = TERRAIN.maxX - 300
      sim.palet.y = MILIEU_Y
      sim.palet.vx = 900
      vus.push(...avance(320))
    }
    expect(vus.filter((e) => e === 'but').length).toBe(BUTS_POUR_GAGNER - 1)
    expect(vus[vus.length - 1]).toBe('fini')
    expect(jeu.scores).toEqual([BUTS_POUR_GAGNER, 0])
    expect(jeu.phase).toBe(PHASE_FINI)
    // fini : plus rien ne bouge au score
    expect(avance(300)).toEqual([])
    jeu.recommence(sim)
    expect(jeu.scores).toEqual([0, 0])
    expect(jeu.phase).toBe(PHASE_JEU)
    expect(sim.palet.actif).toBe(true)
  })

  it('après un but, l’hôte remet chacun à sa place', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 30)
    h.commande(0, { pousse: true, ouvert: false, x: 0, y: 0 })
    pas(h, 120)
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: 0 })
    h.sim.palet.x = 200
    h.sim.palet.y = MILIEU_Y
    h.sim.palet.vx = -900
    pas(h, 60)
    expect(h.jeu()!.scores).toEqual([0, 1])
    pas(h, 300)
    expect(h.jeu()!.phase).toBe(PHASE_JEU)
    expect(h.sim.corps[0].playerCount).toBe(900)
    expect(h.sim.corps[0].stats.centroidX).toBeCloseTo(TERRAIN.maxX * 0.25, -1)
    expect(h.sim.palet.x).toBeCloseTo(MILIEU_X, 3)
    // le score, lui, est gardé
    expect(h.jeu()!.scores).toEqual([0, 1])
  })
})

describe('hockey — ce qui voyage', () => {
  const JEU: JeuTrame = { paletActif: true, paletX: 1234.5, paletY: 678.25, paletVx: -910, paletVy: 42, tenuPar: 1, charge: 0.6, scores: [3, 4], phase: PHASE_BUT, buteur: 0 }

  it('l’état du hockey fait l’aller-retour dans la trame', () => {
    const morceaux = encodeEtat(7, 1.5, TERRAIN, [], particulesVides(4), JEU)
    expect(modeTrame(morceaux[0])).toBe(MODE_HOCKEY)
    const e = litEnteteEtat(morceaux[0], TERRAIN)!
    expect(e.jeu).toMatchObject({ ...JEU, charge: expect.closeTo(0.6, 2) })
  })

  it('une partie libre n’en porte pas', () => {
    const morceaux = encodeEtat(7, 1.5, SALLE, [], particulesVides(4))
    expect(modeTrame(morceaux[0])).toBe(MODE_LIBRE)
    expect(litEnteteEtat(morceaux[0], SALLE)!.jeu).toBeNull()
  })

  it('l’invité apprend le mode, le terrain et le palet de l’hôte', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    const m = new Miroir()
    expect(m.salle).toBe(SALLE)
    pas(h, 10)
    h.sim.palet.vx = 300
    pas(h, 1)
    for (const morceau of h.image()) m.recoit(morceau, 1000)
    expect(m.mode).toBe(MODE_HOCKEY)
    expect(m.salle).toBe(TERRAIN)
    expect(m.vue(1000).n).toBe(h.sim.count)
    const j = m.jeu(1000)!
    expect(j.paletX).toBeCloseTo(h.sim.palet.x, 1)
    // entre deux images, le palet libre est prolongé par sa vitesse
    expect(m.jeu(1050)!.paletX).toBeGreaterThan(j.paletX + 10)
    // une particule du corps 1 est bien décodée dans le terrain du hockey
    expect(m.corps[1].x).toBeCloseTo(h.sim.corps[1].stats.centroidX, 0)
  })
})
