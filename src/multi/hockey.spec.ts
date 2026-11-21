import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { BUTS_POUR_GAGNER, CERCLE_DECALAGE, CERCLE_ECART, CHARGE_PLEINE, DECOMPTE, DEMI_FOND, DEMI_OUVERTURE, DUREE_MATCH, EPAISSEUR_CAGE, Hockey, LIGNE_BUT, PROFONDEUR_CAGE, RAYON_COINS, RAYON_PALET, RECUL_ENGAGEMENT, TENUE_MAX, TERRAIN, paroisCages, paroisCoins, type Paroi } from './hockey'
import { Hote, Miroir, SALLE } from './partie'
import { FluidSimMulti, KIND_PLAYER } from './solveurMulti'
import { MODE_HOCKEY, MODE_LIBRE, PHASE_BUT, PHASE_DECOMPTE, PHASE_FINI, PHASE_JEU, encodeEtat, litEnteteEtat, modeTrame, particulesVides, type Commande, type JeuTrame } from './trame'

const pas = (h: Hote, n: number): void => {
  for (let s = 0; s < n; s++) h.avance(h.params.dt, 1e9)
}
/** Une partie de hockey dont le décompte de l'engagement est passé : les
 *  corps ont eu une demi-seconde pour se poser, le palet est en jeu. Les
 *  corps sont ÉCARTÉS au quart et aux trois quarts du terrain (à
 *  l'engagement ils sont tout contre le palet) : ces tests veulent de la
 *  place entre le palet et les corps. */
const enJeu = (): Hote => {
  const h = new Hote(2, undefined, MODE_HOCKEY)
  const s = h.sim
  for (let i = 0; i < s.count; i++) s.posX[i] += s.proprio[i] === 0 ? -505 : 505
  pas(h, 60)
  h.hockey!.decompte = 0
  pas(h, 1)
  return h
}
/** La vitesse moyenne du corps j, lue sur ses particules (les statistiques
 *  du corps ne sont rafraîchies que de loin en loin). */
const vitesse = (h: Hote, j: number): { x: number; y: number } => {
  const s = h.sim
  let x = 0
  let y = 0
  let m = 0
  for (let i = 0; i < s.count; i++) {
    if (s.kind[i] !== KIND_PLAYER || s.proprio[i] !== j) continue
    x += s.velX[i]
    y += s.velY[i]
    m++
  }
  return { x: x / m, y: y / m }
}

/** De combien le point (x, y) est enfoncé dans une paroi (négatif : dehors). */
const enfoncement = (b: Paroi, x: number, y: number): number => {
  const rad = (b.angle * Math.PI) / 180
  const lx = (x - b.cx) * Math.cos(rad) + (y - b.cy) * Math.sin(rad)
  const ly = -(x - b.cx) * Math.sin(rad) + (y - b.cy) * Math.cos(rad)
  return Math.min(b.demiL - Math.abs(lx), b.demiE - Math.abs(ly))
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
  it('à l’engagement : le palet posé au centre, chacun dans son camp, et un DÉCOMPTE avant de jouer', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    const p = h.sim.palet
    // pendant le décompte : le palet est posé (on le voit) mais pas en jeu,
    // et pousser ne fait pas bouger
    h.commande(0, { pousse: true, ouvert: false, x: 0, y: MILIEU_Y })
    pas(h, 120)
    expect(h.jeu()).toMatchObject({ scores: [0, 0], phase: PHASE_DECOMPTE, tenuPar: -1, paletActif: true })
    expect(h.jeu()!.decompte).toBeCloseTo(DECOMPTE - 1, 1)
    expect(p.actif).toBe(false)
    expect(h.sim.corps[0].playerCount).toBe(900)
    expect(Math.abs(h.sim.corps[0].stats.velX)).toBeLessThan(5)
    expect(h.jeu()!.chrono).toBe(DUREE_MATCH)
    // le décompte fini : on joue, le chrono court
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y })
    pas(h, Math.ceil((DECOMPTE - 1) * 120) + 2)
    expect(h.jeu()!.phase).toBe(PHASE_JEU)
    expect(p.actif).toBe(true)
    expect(p.x).toBeCloseTo(MILIEU_X, 3)
    expect(p.y).toBeCloseTo(MILIEU_Y, 3)
    expect(Math.hypot(p.vx, p.vy)).toBeLessThan(1)
    // chacun face au palet, de son côté du cercle central, sans le toucher
    expect(h.sim.corps[0].stats.centroidX).toBeCloseTo(MILIEU_X - RECUL_ENGAGEMENT, -1)
    expect(h.sim.corps[1].stats.centroidX).toBeCloseTo(MILIEU_X + RECUL_ENGAGEMENT, -1)
    expect(h.sim.corps[0].stats.centroidY).toBeCloseTo(MILIEU_Y, -1)
    expect(p.touche[0] + p.touche[1]).toBe(0)
    pas(h, 60)
    expect(h.jeu()!.chrono).toBeLessThan(DUREE_MATCH - 0.4)
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
    const h = enJeu()
    const p = h.sim.palet
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
    const h = enJeu()
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
      if (h.hockey) {
        // le décompte passé, et le palet hors du chemin
        h.hockey.decompte = 0
        pas(h, 1)
        h.sim.palet.y = 200
      }
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
    const h = enJeu()
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
    const h = enJeu()
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
    const h = enJeu()
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
    const avant = vitesse(h, 1).x
    // on vise à gauche, et on se referme
    h.commande(1, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y })
    pas(h, 1)
    const p = h.sim.palet
    expect(h.hockey!.tenuPar).toBe(-1)
    expect(p.vx).toBeLessThan(-1300)
    expect(Math.abs(p.vy)).toBeLessThan(60)
    // le recul : le corps est reparti à l'opposé du lancer (mesuré : +200 u/s)
    // — lu aussitôt : une seconde plus tard il a filé jusque dans sa cage
    expect(vitesse(h, 1).x).toBeGreaterThan(avant + 120)
    let pire = 900
    for (let s = 0; s < 120; s++) {
      pas(h, 1)
      pire = Math.min(pire, h.sim.corps[1].playerCount)
    }
    // le défaut vu à la première version : le pas où le porteur se refermait,
    // le palet au cœur de son corps en chassait la matière (351 sur 900)
    expect(pire).toBe(900)
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

describe('hockey — voler le palet, dasher', () => {
  /** Le joueur 1, ouvert, tient le palet ; le joueur 0 est amené tout près,
   *  fermé, à gauche de lui. */
  const faceAFace = (): Hote => {
    const h = enJeu()
    h.commande(1, { pousse: false, ouvert: true, x: TERRAIN.maxX, y: MILIEU_Y })
    h.sim.palet.vx = 600
    for (let s = 0; s < 360 && h.hockey!.tenuPar !== 1; s++) pas(h, 1)
    pas(h, 30)
    // on rapproche le corps 0 : ses particules, d'un bloc
    const s = h.sim
    const ecart = s.corps[1].stats.centroidX - s.corps[0].stats.centroidX - 300
    for (let i = 0; i < s.count; i++) if (s.proprio[i] === 0) s.posX[i] += ecart
    pas(h, 2)
    return h
  }
  /** Donne une vitesse à tout le corps j. */
  const lance = (h: Hote, j: number, vx: number): void => {
    const s = h.sim
    for (let i = 0; i < s.count; i++) if (s.kind[i] === KIND_PLAYER && s.proprio[i] === j) s.velX[i] += vx
  }

  it('un corps FERMÉ qui percute le porteur lui fait lâcher le palet', () => {
    // avant, il n'y avait rien à faire contre le porteur, qu'attendre
    const h = faceAFace()
    expect(h.hockey!.tenuPar).toBe(1)
    lance(h, 0, 300)
    let lache = -1
    for (let s = 0; s < 240 && lache < 0; s++) {
      pas(h, 1)
      if (h.hockey!.tenuPar < 0) lache = s
    }
    expect(lache).toBeGreaterThanOrEqual(0)
    // le palet file à l'opposé de celui qui a frappé (vers la droite)
    expect(h.sim.palet.vx).toBeGreaterThan(250)
    // et le porteur, toujours ouvert, ne le reprend pas aussitôt
    pas(h, 20)
    expect(h.sim.corps[1].ouvert).toBe(true)
    expect(h.hockey!.tenuPar).toBe(-1)
  })

  it('le porteur qui vient lui-même buter sur un corps fermé IMMOBILE garde le palet', () => {
    // vu à l'essai : avec la seule vitesse de rapprochement, c'est le
    // défenseur immobile qui « volait » le palet
    const h = faceAFace()
    lance(h, 1, -300)
    for (let s = 0; s < 200; s++) {
      pas(h, 1)
      if (h.hockey!.tenuDepuis > 2.6) break
      expect(h.hockey!.tenuPar).toBe(1)
    }
  })

  it('venir le toucher doucement ne suffit pas', () => {
    const h = faceAFace()
    lance(h, 0, 60)
    for (let s = 0; s < 300; s++) {
      pas(h, 1)
      expect(h.hockey!.tenuPar).toBe(1)
      if (h.hockey!.tenuDepuis > 2.6) break
    }
  })

  it('un corps OUVERT ne vole rien, même lancé fort', () => {
    const h = faceAFace()
    h.commande(0, { pousse: false, ouvert: true, x: 0, y: MILIEU_Y })
    pas(h, 1)
    lance(h, 0, 300)
    for (let s = 0; s < 120; s++) {
      pas(h, 1)
      if (h.hockey!.tenuDepuis > 2.6) break
      expect(h.hockey!.tenuPar).toBe(1)
    }
  })

  it('LE DASH : un appui, une brusque accélération à l’opposé du pointeur, puis une recharge', () => {
    const h = enJeu()
    const c = (): number => vitesse(h, 0).x
    expect(h.corps()[0].dashPret).toBe(true)
    // le pointeur à gauche : comme une poussée, le dash envoie à droite
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y, dash: true })
    pas(h, 2)
    expect(c()).toBeGreaterThan(350)
    expect(h.corps()[0]).toMatchObject({ dashPret: false, dash: true })
    // tenu, il ne repart pas ; relâché puis repressé trop tôt, non plus
    const v1 = c()
    pas(h, 30)
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y, dash: false })
    pas(h, 2)
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y, dash: true })
    pas(h, 2)
    expect(c()).toBeLessThanOrEqual(v1 + 1)
    expect(h.corps()[0].dash).toBe(false)
    // rechargé (2,2 s), un nouvel appui le relance
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y, dash: false })
    pas(h, 270)
    expect(h.corps()[0].dashPret).toBe(true)
    const v2 = c()
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y, dash: true })
    pas(h, 2)
    expect(c()).toBeGreaterThan(v2 + 350)
    expect(h.sim.corps[0].playerCount).toBe(900)
  })

  it('à la manette, le dash va du côté du stick', () => {
    const h = enJeu()
    const s = h.sim.corps[0].stats
    h.commande(0, { pousse: false, ouvert: false, x: s.centroidX, y: s.centroidY - 300, aller: true, dash: true })
    pas(h, 2)
    expect(vitesse(h, 0).y).toBeLessThan(-350)
  })

  it('pendant le décompte de l’engagement, on ne dashe pas', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 30)
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y, dash: true })
    pas(h, 5)
    expect(Math.abs(vitesse(h, 0).x)).toBeLessThan(10)
    expect(h.corps()[0].dashPret).toBe(true)
  })

  it('un dash sur le porteur lui prend le palet', () => {
    const h = faceAFace()
    // le pointeur à gauche du corps 0 : il dashe vers la droite, sur le porteur
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: MILIEU_Y, dash: true })
    let lache = false
    for (let s = 0; s < 120 && !lache; s++) {
      pas(h, 1)
      lache = h.hockey!.tenuPar < 0
    }
    expect(lache).toBe(true)
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
    // la règle seule : le décompte est passé, on joue
    jeu.decompte = 0
    jeu.apres(sim, [], sim.params.dt)
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
        // (comme l'hôte : l'engagement repose le palet et lance le décompte)
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

  it('le fond du terrain renvoie partout : la cage n’y est plus', () => {
    const { sim, jeu, avance } = petit()
    const p = sim.palet
    // derrière la cage de gauche, dans son axe : avant, c'était un but
    p.x = 150
    p.y = MILIEU_Y
    p.vx = -900
    const vus = avance(20)
    expect(vus).toEqual([])
    expect(jeu.scores).toEqual([0, 0])
    expect(p.vx).toBeGreaterThan(0)
  })

  it('PAR DERRIÈRE, le fond de la cage renvoie le palet : pas de but', () => {
    const { sim, jeu, avance } = petit()
    const p = sim.palet
    p.x = 120
    p.y = MILIEU_Y
    p.vx = 900
    let plusLoin = 0
    const vus: string[] = []
    for (let s = 0; s < 60; s++) {
      vus.push(...avance(1))
      plusLoin = Math.max(plusLoin, p.x)
    }
    expect(vus).toEqual([])
    expect(jeu.scores).toEqual([0, 0])
    // il n'a jamais dépassé le dos de la cage…
    const dos = LIGNE_BUT - PROFONDEUR_CAGE - EPAISSEUR_CAGE
    expect(plusLoin + RAYON_PALET).toBeLessThanOrEqual(dos + 1)
    // …qu'il a bien touché
    expect(plusLoin + RAYON_PALET).toBeGreaterThan(dos - 12)
  })

  it('PAR LE CÔTÉ non plus : la paroi le renvoie', () => {
    const { sim, jeu, avance } = petit()
    const p = sim.palet
    p.x = LIGNE_BUT - PROFONDEUR_CAGE / 2
    p.y = MILIEU_Y - DEMI_OUVERTURE - 300
    p.vy = 900
    let plusBas = 0
    const vus: string[] = []
    for (let s = 0; s < 60; s++) {
      vus.push(...avance(1))
      plusBas = Math.max(plusBas, p.y)
    }
    expect(vus).toEqual([])
    expect(jeu.scores).toEqual([0, 0])
    // il n'est jamais entré : son centre est resté au-dessus du côté de la cage
    expect(plusBas).toBeLessThan(MILIEU_Y - DEMI_FOND)
  })

  it('on PASSE DERRIÈRE la cage : le palet y file d’un bord à l’autre', () => {
    const { sim, avance } = petit()
    const p = sim.palet
    // entre le fond du terrain et le dos de la cage, là où le bord est droit
    p.x = 140
    p.y = MILIEU_Y - DEMI_FOND - 60
    p.vy = 900
    avance(62)
    // il a longé tout le dos de la cage, sans dévier
    expect(p.y).toBeGreaterThan(MILIEU_Y + DEMI_FOND + 60)
    expect(p.x).toBeCloseTo(140, 3)
    expect(p.vy).toBeGreaterThan(0)
  })

  it('l’eau bute sur les parois de la cage : rien ne les traverse', () => {
    const h = enJeu()
    // le corps 0 est lancé dans sa propre cage, par devant
    const sim = h.sim
    for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_PLAYER && sim.proprio[i] === 0) sim.velX[i] -= 500
    const parois = paroisCages()
    let enfonce = 0
    let derriere = 0
    for (let s = 0; s < 300; s++) {
      pas(h, 1)
      if (s % 10 !== 9) continue
      for (let i = 0; i < sim.count; i++) {
        if (sim.proprio[i] !== 0) continue
        const x = sim.posX[i]
        const y = sim.posY[i]
        // de combien elle est enfoncée dans une paroi (0 : dehors)
        for (const b of parois) enfonce = Math.max(enfonce, enfoncement(b, x, y))
        // derrière le dos de la cage, dans son axe : il aurait fallu le traverser
        if (x < LIGNE_BUT - PROFONDEUR_CAGE - EPAISSEUR_CAGE - 3 && Math.abs(y - MILIEU_Y) < DEMI_FOND - 20) derriere++
      }
    }
    // une particule lancée à 500 u/s s'y enfonce à peine (mesuré : 3,3 u au
    // pire, pour une paroi de 30 u)
    expect(enfonce).toBeLessThan(8)
    expect(derriere).toBe(0)
    // le corps est bien entré dans la cage (c'est de l'eau, il s'y loge)
    expect(sim.corps[0].stats.centroidX).toBeLessThan(LIGNE_BUT + 60)
  })

  it('LES COINS SONT RONDS : le palet y suit le quart de cercle, sans jamais sortir', () => {
    const { sim, avance } = petit()
    const p = sim.palet
    // lancé dans le coin du haut à gauche, en passant au-dessus de la cage
    p.x = 700
    p.y = 250
    p.vx = -900
    p.vy = -300
    const centre = { x: TERRAIN.minX + RAYON_COINS, y: TERRAIN.minY + RAYON_COINS }
    let auPlusLoin = 0
    for (let s = 0; s < 120; s++) {
      avance(1)
      if (p.x < centre.x && p.y < centre.y) auPlusLoin = Math.max(auPlusLoin, Math.hypot(p.x - centre.x, p.y - centre.y))
    }
    // il a touché l'arrondi, et n'est jamais allé au-delà (un angle droit
    // l'aurait laissé à 498 u du centre du coin)
    expect(auPlusLoin).toBeGreaterThan(RAYON_COINS - RAYON_PALET - 5)
    expect(auPlusLoin).toBeLessThanOrEqual(RAYON_COINS - RAYON_PALET + 1e-6)
  })

  it('l’eau aussi suit l’arrondi des coins', () => {
    const h = enJeu()
    const sim = h.sim
    // le corps 0 est lancé dans le coin du haut à gauche
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER || sim.proprio[i] !== 0) continue
      sim.velX[i] -= 420
      sim.velY[i] -= 420
    }
    const centre = { x: TERRAIN.minX + RAYON_COINS, y: TERRAIN.minY + RAYON_COINS }
    let dehors = 0
    let auPlusLoin = 0
    for (let s = 0; s < 360; s++) {
      pas(h, 1)
      if (s % 10 !== 9) continue
      for (let i = 0; i < sim.count; i++) {
        if (sim.proprio[i] !== 0) continue
        const x = sim.posX[i]
        const y = sim.posY[i]
        if (x >= centre.x || y >= centre.y) continue
        const d = Math.hypot(x - centre.x, y - centre.y)
        auPlusLoin = Math.max(auPlusLoin, d)
        if (d > RAYON_COINS + 8) dehors++
      }
    }
    // le corps est bien allé au fond du coin, et rien n'a passé l'arrondi
    expect(auPlusLoin).toBeGreaterThan(RAYON_COINS - 30)
    expect(dehors).toBe(0)
  })

  it('les parois des coins se rejoignent : pas de fente entre deux', () => {
    const coins = paroisCoins()
    expect(coins.length).toBe(24)
    // tout point juste derrière l'arrondi est DANS une paroi
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = sx < 0 ? TERRAIN.minX + RAYON_COINS : TERRAIN.maxX - RAYON_COINS
      const cy = sy < 0 ? TERRAIN.minY + RAYON_COINS : TERRAIN.maxY - RAYON_COINS
      for (let k = 0; k <= 90; k++) {
        const t = (k / 90) * (Math.PI / 2)
        const x = cx + sx * (RAYON_COINS + 12) * Math.cos(t)
        const y = cy + sy * (RAYON_COINS + 12) * Math.sin(t)
        expect(Math.max(...coins.map((b) => enfoncement(b, x, y)))).toBeGreaterThan(0)
      }
    }
  })

  it('porté jusque dans la cage adverse, le palet compte aussi', () => {
    const { sim, jeu, commandes, avance } = petit()
    // le petit corps 1 (à droite) est ouvert, le palet posé sur lui : il le tient
    commandes[1].ouvert = true
    sim.corps[1].ouvert = true
    const c = sim.corps[1].stats
    sim.palet.x = c.centroidX
    sim.palet.y = c.centroidY
    avance(5)
    expect(jeu.tenuPar).toBe(1)
    // on dépose le corps (et donc le palet) dans la cage de gauche
    const dx = LIGNE_BUT - 90 - c.centroidX
    const dy = MILIEU_Y - c.centroidY
    for (let i = 0; i < sim.count; i++) {
      if (sim.proprio[i] !== 1) continue
      sim.posX[i] += dx
      sim.posY[i] += dy
    }
    const vus = avance(80)
    expect(vus).toContain('but')
    expect(jeu.scores).toEqual([0, 1])
  })

  it('dans la cage de GAUCHE : un but pour le joueur 1, une pause, puis l’engagement', () => {
    const { sim, jeu, avance } = petit()
    const p = sim.palet
    // par DEVANT, dans l'ouverture de la cage
    p.x = 700
    p.y = MILIEU_Y + 40
    p.vx = -900
    const vus = avance(60)
    expect(vus).toEqual(['but'])
    expect(jeu.scores).toEqual([0, 1])
    expect(jeu.phase).toBe(PHASE_BUT)
    expect(jeu.buteur).toBe(1)
    expect(p.actif).toBe(false)
    // la pause, puis l'engagement : sur un cercle de la zone du BUTEUR (le
    // joueur 1, à droite) — celui qui a encaissé repart en attaque
    expect(avance(200)).toEqual(['engagement'])
    expect(jeu.phase).toBe(PHASE_DECOMPTE)
    expect(p.actif).toBe(false)
    expect(p.x).toBeCloseTo(TERRAIN.maxX - LIGNE_BUT - CERCLE_DECALAGE, 6)
    expect(Math.abs(p.y - MILIEU_Y)).toBeCloseTo(CERCLE_ECART, 6)
    // le décompte fini, on rejoue
    expect(avance(Math.ceil(DECOMPTE * 120) + 2)).toEqual([])
    expect(jeu.phase).toBe(PHASE_JEU)
    expect(p.actif).toBe(true)
    expect(Math.hypot(p.vx, p.vy)).toBeLessThan(1)
  })

  it('dans la cage de DROITE : un but pour le joueur 0', () => {
    const { sim, jeu, avance } = petit()
    sim.palet.x = TERRAIN.maxX - 700
    sim.palet.vx = 900
    expect(avance(60)).toEqual(['but'])
    expect(jeu.scores).toEqual([1, 0])
  })

  it('le premier au score dit gagne : la partie s’arrête, RECOMMENCER la relance', () => {
    const { sim, jeu, avance } = petit()
    const vus: string[] = []
    for (let k = 0; k < BUTS_POUR_GAGNER; k++) {
      sim.palet.x = TERRAIN.maxX - 700
      sim.palet.y = MILIEU_Y
      sim.palet.vx = 900
      // le but, la pause, l'engagement, le décompte : plus de trois secondes
      vus.push(...avance(60))
      if (jeu.phase !== PHASE_FINI) {
        vus.push(...avance(200))
        jeu.decompte = 0
        avance(1)
      }
    }
    expect(vus.filter((e) => e === 'but').length).toBe(BUTS_POUR_GAGNER - 1)
    expect(vus.filter((e) => e === 'engagement').length).toBe(BUTS_POUR_GAGNER - 1)
    expect(vus[vus.length - 1]).toBe('fini')
    expect(jeu.scores).toEqual([BUTS_POUR_GAGNER, 0])
    expect(jeu.phase).toBe(PHASE_FINI)
    // fini : plus rien ne bouge au score
    expect(avance(300)).toEqual([])
    // un match neuf : le score et le chrono repartent, et l'on engage
    jeu.recommence(sim)
    expect(jeu.scores).toEqual([0, 0])
    expect(jeu.chrono).toBe(DUREE_MATCH)
    expect(jeu.phase).toBe(PHASE_DECOMPTE)
    expect(sim.palet.x).toBeCloseTo(MILIEU_X, 3)
  })

  it('après un but, l’hôte remet chacun à sa place et garde le score', () => {
    const h = enJeu()
    h.commande(0, { pousse: true, ouvert: false, x: 0, y: 0 })
    pas(h, 120)
    h.commande(0, { pousse: false, ouvert: false, x: 0, y: 0 })
    h.sim.palet.x = 620
    h.sim.palet.y = MILIEU_Y
    h.sim.palet.vx = -900
    pas(h, 60)
    expect(h.jeu()!.scores).toEqual([0, 1])
    pas(h, 200)
    expect(h.jeu()!.phase).toBe(PHASE_DECOMPTE)
    expect(h.sim.corps[0].playerCount).toBe(900)
    // l'engagement est sur un cercle de la zone du buteur (le joueur 1, à
    // droite) : le palet sur son point, un joueur de chaque côté
    const cercle = TERRAIN.maxX - LIGNE_BUT - CERCLE_DECALAGE
    expect(h.sim.palet.x).toBeCloseTo(cercle, 6)
    expect(h.sim.corps[0].stats.centroidX).toBeCloseTo(cercle - RECUL_ENGAGEMENT, -1)
    expect(h.sim.corps[1].stats.centroidX).toBeCloseTo(cercle + RECUL_ENGAGEMENT, -1)
    expect(Math.abs(h.sim.corps[0].stats.centroidY - h.sim.palet.y)).toBeLessThan(5)
    expect(h.jeu()!.scores).toEqual([0, 1])
  })

  it('les deux cercles d’une zone servent à tour de rôle, et un match neuf repart du centre', () => {
    const { sim, jeu, avance } = petit()
    const lieux: number[] = []
    for (let k = 0; k < 2; k++) {
      // le joueur 0 marque à droite, deux fois
      sim.palet.x = TERRAIN.maxX - 700
      sim.palet.y = MILIEU_Y
      sim.palet.vx = 900
      sim.palet.vy = 0
      avance(60)
      avance(200)
      expect(jeu.phase).toBe(PHASE_DECOMPTE)
      // dans SA zone, à gauche
      expect(sim.palet.x).toBeCloseTo(TERRAIN.minX + LIGNE_BUT + CERCLE_DECALAGE, 6)
      lieux.push(sim.palet.y)
      jeu.decompte = 0
      avance(1)
    }
    expect(lieux[0]).toBeCloseTo(MILIEU_Y - CERCLE_ECART, 6)
    expect(lieux[1]).toBeCloseTo(MILIEU_Y + CERCLE_ECART, 6)
    jeu.recommence(sim)
    expect(sim.palet.x).toBeCloseTo(MILIEU_X, 6)
    expect(sim.palet.y).toBeCloseTo(MILIEU_Y, 6)
    expect(jeu.depart(0)).toEqual({ x: MILIEU_X - RECUL_ENGAGEMENT, y: MILIEU_Y })
    expect(jeu.depart(1)).toEqual({ x: MILIEU_X + RECUL_ENGAGEMENT, y: MILIEU_Y })
  })

  it('LE TEMPS : à la fin le meilleur score gagne', () => {
    const { sim, jeu, avance } = petit()
    sim.palet.x = TERRAIN.maxX - 700
    sim.palet.vx = 900
    avance(60)
    expect(jeu.scores).toEqual([1, 0])
    avance(200)
    jeu.decompte = 0
    avance(1)
    jeu.chrono = 0.05
    expect(avance(20)).toEqual(['fini'])
    expect(jeu.phase).toBe(PHASE_FINI)
    expect(jeu.buteur).toBe(0)
  })

  it('LE TEMPS : à égalité, le prochain but gagne', () => {
    const { sim, jeu, avance } = petit()
    jeu.chrono = 0.05
    expect(avance(20)).toEqual([])
    expect(jeu.enOr).toBe(true)
    expect(jeu.phase).toBe(PHASE_JEU)
    sim.palet.x = 700
    sim.palet.vx = -900
    expect(avance(60)).toEqual(['fini'])
    expect(jeu.scores).toEqual([0, 1])
    expect(jeu.buteur).toBe(1)
  })

  it('le chrono ne court ni pendant le décompte ni pendant la pause d’un but', () => {
    const { sim, jeu, avance } = petit()
    avance(120)
    const t = jeu.chrono
    expect(t).toBeCloseTo(DUREE_MATCH - 1, 1)
    sim.palet.x = 700
    sim.palet.vx = -900
    avance(60)
    expect(jeu.phase).toBe(PHASE_BUT)
    const auBut = jeu.chrono
    expect(auBut).toBeLessThan(t)
    avance(300)
    expect(jeu.phase).toBe(PHASE_DECOMPTE)
    expect(jeu.chrono).toBe(auBut)
  })
})

describe('hockey — ce qui voyage', () => {
  const JEU: JeuTrame = { mode: MODE_HOCKEY, anneau: 0, paletActif: true, paletX: 1234.5, paletY: 678.25, paletVx: -910, paletVy: 42, tenuPar: 1, charge: 0.6, scores: [3, 4], phase: PHASE_BUT, buteur: 0, chrono: 123.4, decompte: 1.4, enOr: true }

  it('l’état du hockey fait l’aller-retour dans la trame', () => {
    const morceaux = encodeEtat(7, 1.5, TERRAIN, [], particulesVides(4), JEU)
    expect(modeTrame(morceaux[0])).toBe(MODE_HOCKEY)
    const e = litEnteteEtat(morceaux[0], TERRAIN)!
    expect(e.jeu).toMatchObject({ ...JEU, charge: expect.closeTo(0.6, 2), chrono: expect.closeTo(123.4, 3), decompte: expect.closeTo(1.4, 3) })
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
    h.hockey!.decompte = 0
    pas(h, 1)
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
