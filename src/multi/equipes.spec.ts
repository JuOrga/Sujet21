// LE 2 CONTRE 2 — la grande piste, quatre corps, deux équipes, et les robots
// équipiers. (Le duel a ses tests : hockey.spec.ts, robot.spec.ts. Ceux-ci
// disent ce que le passage à quatre change, et ce qu'il ne doit pas casser.)

import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import {
  ECHELLE_EQUIPES,
  Hockey,
  PATINOIRE_DUEL,
  PATINOIRE_EQUIPES,
  RAYON_POTEAU,
  TERRAIN,
  paroisCages,
  patinoireDe,
  poteauxDe,
  type Paroi,
} from './hockey'
import { Hote, Miroir, VOLUME_EQUIPES } from './partie'
import { ECLAIRCI_EQUIPIER, PALETTE, teintesDeLaPartie } from './profil'
import { Robot } from './robot'
import { FluidSimMulti, KIND_PLAYER } from './solveurMulti'
import { entend, type Instantane } from './sonsMulti'
import { MODE_HOCKEY, PHASE_JEU, encodeEtat, equipe, litEnteteEtat, particulesVides, type Commande, type CorpsTrame, type JeuTrame } from './trame'

const graine = (g: number) => (): number => {
  g = (g * 1664525 + 1013904223) >>> 0
  return g / 4294967296
}
const pas = (h: Hote, n: number, robots: Robot[] = []): void => {
  for (let s = 0; s < n; s++) {
    for (const r of robots) h.commande(r.joueur, r.commande(h, h.params.dt))
    h.avance(h.params.dt, 1e9)
  }
}
/** Le rayon du rond de n particules (solveurMulti.ts, RAYON_ROND). */
const rayonCorps = (n: number): number => 0.5222 * 6.6 * Math.sqrt(n)
/** De combien le point est enfoncé dans une paroi (négatif : dehors). */
const enfoncement = (b: Paroi, x: number, y: number): number => {
  const rad = (b.angle * Math.PI) / 180
  const lx = (x - b.cx) * Math.cos(rad) + (y - b.cy) * Math.sin(rad)
  const ly = -(x - b.cx) * Math.sin(rad) + (y - b.cy) * Math.cos(rad)
  return Math.min(b.demiL - Math.abs(lx), b.demiE - Math.abs(ly))
}
/** Déplace tout le corps j pour que son cœur soit en (x, y), immobile. */
const pose = (h: Hote, j: number, x: number, y: number): void => {
  const s = h.sim
  let cx = 0
  let cy = 0
  let m = 0
  for (let i = 0; i < s.count; i++) {
    if (s.kind[i] !== KIND_PLAYER || s.proprio[i] !== j) continue
    cx += s.posX[i]
    cy += s.posY[i]
    m++
  }
  cx /= m
  cy /= m
  for (let i = 0; i < s.count; i++) {
    if (s.kind[i] !== KIND_PLAYER || s.proprio[i] !== j) continue
    s.posX[i] += x - cx
    s.posY[i] += y - cy
    s.velX[i] = 0
    s.velY[i] = 0
  }
}
/** Une partie à quatre dont le décompte est passé. */
const aQuatre = (): Hote => {
  const h = new Hote(4, undefined, MODE_HOCKEY)
  pas(h, 30)
  h.hockey!.decompte = 0
  pas(h, 1)
  return h
}

describe('2 contre 2 — la grande piste', () => {
  it('15 % plus grande, aux proportions d’une patinoire ; les cages, elles, ne changent pas', () => {
    const t = PATINOIRE_EQUIPES.terrain
    expect(ECHELLE_EQUIPES).toBe(1.15)
    expect(t.maxX - t.minX).toBe(3312)
    expect(t.maxY - t.minY).toBe(1403)
    expect(PATINOIRE_EQUIPES.coins).toBe(460)
    // un corps de 500 passe encore derrière la cage
    expect(PATINOIRE_EQUIPES.ligneBut - 140).toBeGreaterThan(2 * rayonCorps(VOLUME_EQUIPES) + 40)
    // les poteaux restent dans la zone neutre, entre les lignes bleues
    expect(PATINOIRE_EQUIPES.ecartPoteau + RAYON_POTEAU).toBeLessThan(PATINOIRE_EQUIPES.ligneBleue)
    expect(patinoireDe(2)).toBe(PATINOIRE_DUEL)
    expect(patinoireDe(4)).toBe(PATINOIRE_EQUIPES)
    expect(PATINOIRE_DUEL.terrain).toBe(TERRAIN)
  })

  it('l’hôte à quatre : la grande piste, quatre corps de 500 — pas plus de matière qu’au duel, à 10 % près', () => {
    const h = new Hote(4, undefined, MODE_HOCKEY)
    expect(h.salle).toBe(PATINOIRE_EQUIPES.terrain)
    expect(h.sim.corps.map((c) => c.playerCount)).toEqual([500, 500, 500, 500])
    const duel = new Hote(2, undefined, MODE_HOCKEY)
    expect(h.sim.count / duel.sim.count).toBeLessThan(1.12)
  })

  it('chaque équipe engage de son côté : 0 et 2 à gauche du palet, 1 et 3 à droite', () => {
    const h = new Hote(4, undefined, MODE_HOCKEY)
    const px = h.sim.palet.x
    const c = h.sim.corps.map((k) => k.stats.centroidX)
    expect(c[0]).toBeLessThan(px)
    expect(c[2]).toBeLessThan(px)
    expect(c[1]).toBeGreaterThan(px)
    expect(c[3]).toBeGreaterThan(px)
    expect([0, 1, 2, 3].map(equipe)).toEqual([0, 1, 0, 1])
  })

  it('à TOUS les engagements, personne ne naît dans une paroi, sur un poteau, ni sur un autre', () => {
    const pat = PATINOIRE_EQUIPES
    const t = pat.terrain
    const sim = new FluidSimMulti({ ...DEFAULT_PARAMS }, t, 1024, 4)
    const jeu = new Hockey(pat)
    jeu.engage(sim)
    const r = rayonCorps(VOLUME_EQUIPES) + 12
    const cages = paroisCages(pat)
    const poteaux = poteauxDe(pat)
    const verifie = (): void => {
      const d = [0, 1, 2, 3].map((j) => jeu.depart(j))
      for (const [j, p] of d.entries()) {
        // dans la piste, coins compris
        expect(p.x - r).toBeGreaterThan(t.minX)
        expect(p.x + r).toBeLessThan(t.maxX)
        expect(p.y - r).toBeGreaterThan(t.minY)
        expect(p.y + r).toBeLessThan(t.maxY)
        const cx = Math.min(Math.max(p.x, t.minX + pat.coins), t.maxX - pat.coins)
        const cy = Math.min(Math.max(p.y, t.minY + pat.coins), t.maxY - pat.coins)
        expect(Math.hypot(p.x - cx, p.y - cy) + r).toBeLessThan(pat.coins + 1e-6)
        // loin des cages (un disque contre une paroi : on sonde son pourtour)
        for (const b of cages) for (let a = 0; a < 16; a++) expect(enfoncement(b, p.x + r * Math.cos((a * Math.PI) / 8), p.y + r * Math.sin((a * Math.PI) / 8))).toBeLessThan(0)
        for (const q of poteaux) expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(r + RAYON_POTEAU)
        for (let k = j + 1; k < 4; k++) expect(Math.hypot(p.x - d[k].x, p.y - d[k].y)).toBeGreaterThan(2 * r)
      }
    }
    verifie()
    // les buts font engager sur les quatre cercles de zone, l'un après l'autre
    const p = sim.palet
    for (const [cage, fois] of [[0, 2], [1, 2]] as const) {
      for (let n = 0; n < fois; n++) {
        jeu.decompte = 0
        jeu.apres(sim, [], sim.params.dt)
        p.x = cage === 0 ? t.minX + pat.ligneBut - 60 : t.maxX - pat.ligneBut + 60
        p.y = (t.minY + t.maxY) / 2
        p.vx = cage === 0 ? -50 : 50
        p.vy = 0
        expect(jeu.apres(sim, [], sim.params.dt)).toBe('but')
        jeu.scores[0] = jeu.scores[1] = 0
        jeu.engage(sim)
        verifie()
      }
    }
  })
})

describe('2 contre 2 — la règle en équipes', () => {
  /** Le joueur 1 tient le palet au milieu de la piste ; les autres sont
   *  écartés, sauf `voleur`, posé fermé à sa gauche, prêt à foncer. */
  const porteurEt = (voleur: number): Hote => {
    const h = aQuatre()
    const t = h.salle
    const mx = (t.minX + t.maxX) / 2
    const my = (t.minY + t.maxY) / 2
    for (const j of [0, 2, 3]) if (j !== voleur) pose(h, j, j === 3 ? t.maxX - 700 : t.minX + 700, j === 2 ? t.minY + 250 : t.maxY - 250)
    pose(h, 1, mx, my)
    h.commande(1, { pousse: false, ouvert: true, x: t.maxX, y: my })
    const p = h.sim.palet
    p.x = mx
    p.y = my
    p.vx = 0
    p.vy = 0
    for (let s = 0; s < 120 && h.hockey!.tenuPar !== 1; s++) pas(h, 1)
    expect(h.hockey!.tenuPar).toBe(1)
    pose(h, voleur, h.sim.corps[1].stats.centroidX - 230, my)
    pas(h, 2)
    for (let i = 0; i < h.sim.count; i++) if (h.sim.kind[i] === KIND_PLAYER && h.sim.proprio[i] === voleur) h.sim.velX[i] += 320
    return h
  }
  const tientToujours = (h: Hote, n: number): boolean => {
    for (let s = 0; s < n; s++) {
      pas(h, 1)
      if (h.hockey!.tenuPar !== 1) return false
    }
    return true
  }

  it('l’ÉQUIPIER qui percute le porteur ne lui fait pas lâcher le palet', () => {
    expect(tientToujours(porteurEt(3), 90)).toBe(true)
  })

  it('un ADVERSAIRE qui le percute de même, si', () => {
    expect(tientToujours(porteurEt(2), 90)).toBe(false)
  })

  /** La règle seule, sur la grande piste, avec quatre petits corps. */
  const regle = (): { sim: FluidSimMulti; jeu: Hockey; commandes: Commande[]; avance: (n: number) => string[] } => {
    const pat = PATINOIRE_EQUIPES
    const t = pat.terrain
    const sim = new FluidSimMulti({ ...DEFAULT_PARAMS }, t, 1024, 4)
    const lieux = [
      [500, 200],
      [t.maxX - 500, 200],
      [500, t.maxY - 200],
      [t.maxX - 500, t.maxY - 200],
    ]
    for (const [j, [x, y]] of lieux.entries()) {
      sim.courant = j
      sim.spawnDisc(x, y, 60, KIND_PLAYER)
    }
    sim.courant = 0
    sim.relabel()
    const jeu = new Hockey(pat)
    jeu.engage(sim)
    jeu.decompte = 0
    jeu.apres(sim, [], sim.params.dt)
    const commandes: Commande[] = [0, 1, 2, 3].map(() => ({ pousse: false, ouvert: false, x: 0, y: 0 }))
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
  /** Le corps j prend le palet (ouvert, le palet posé sur lui), puis se
   *  referme : le palet part, et l'on retient qu'il l'a eu. */
  const aEuLePalet = (r: ReturnType<typeof regle>, j: number): void => {
    const c = r.sim.corps[j]
    c.ouvert = true
    r.sim.palet.x = c.stats.centroidX
    r.sim.palet.y = c.stats.centroidY
    r.sim.palet.vx = 0
    r.sim.palet.vy = 0
    r.avance(2)
    expect(r.jeu.tenuPar).toBe(j)
    c.ouvert = false
    r.avance(1)
    expect(r.jeu.tenuPar).toBe(-1)
  }
  /** Le palet glisse dans la cage de ce côté. */
  const dansLaCage = (r: ReturnType<typeof regle>, cote: 0 | 1): string[] => {
    const t = r.sim.palet
    const pat = PATINOIRE_EQUIPES
    t.x = cote === 0 ? pat.terrain.minX + pat.ligneBut + 80 : pat.terrain.maxX - pat.ligneBut - 80
    t.y = (pat.terrain.minY + pat.terrain.maxY) / 2
    t.vx = cote === 0 ? -600 : 600
    t.vy = 0
    return r.avance(60)
  }

  it('le but compte pour l’ÉQUIPE, et l’on sait QUI l’a marqué', () => {
    const r = regle()
    aEuLePalet(r, 2)
    expect(dansLaCage(r, 1)).toContain('but')
    expect(r.jeu.scores).toEqual([1, 0])
    expect(r.jeu.buteur).toBe(0)
    expect(r.jeu.marqueur).toBe(2)
    expect(r.jeu.etat(r.sim).marqueur).toBe(2)
  })

  it('CONTRE SON CAMP : il compte pour l’autre équipe, et le marqueur reste celui qui l’a eu', () => {
    const r = regle()
    aEuLePalet(r, 2)
    expect(dansLaCage(r, 0)).toContain('but')
    expect(r.jeu.scores).toEqual([0, 1])
    expect(r.jeu.buteur).toBe(1)
    expect(r.jeu.marqueur).toBe(2)
  })

  it('relâché sans visée, le palet part vers la cage de l’ÉQUIPE adverse', () => {
    for (const j of [2, 3]) {
      const r = regle()
      const c = r.sim.corps[j]
      c.ouvert = true
      r.sim.palet.x = c.stats.centroidX
      r.sim.palet.y = c.stats.centroidY
      r.avance(2)
      // la visée posée sur le palet lui-même : pas de direction
      r.commandes[j] = { pousse: false, ouvert: false, x: r.sim.palet.x, y: r.sim.palet.y }
      c.ouvert = false
      r.avance(1)
      expect(Math.sign(r.sim.palet.vx)).toBe(equipe(j) === 0 ? 1 : -1)
    }
  })
})

describe('2 contre 2 — ce qui voyage', () => {
  it('l’invité reconnaît la grande piste au nombre de corps, et y place les particules', () => {
    const h = aQuatre()
    // un corps au bout de la piste, plus loin que le bout de celle du duel
    pose(h, 3, h.salle.maxX - 150, 400)
    const m = new Miroir()
    for (const morceau of h.image()) m.recoit(morceau, 1000)
    expect(m.corps.length).toBe(4)
    expect(m.salle).toBe(PATINOIRE_EQUIPES.terrain)
    const vue = m.vue(1000)
    expect(vue.n).toBe(h.sim.count)
    // une particule du bout de la piste revient là où l'hôte l'a vue (12
    // bits par axe : moins d'une unité d'écart)
    let i = 0
    for (let k = 0; k < h.sim.count; k++) if (h.sim.posX[k] > h.sim.posX[i]) i = k
    expect(h.sim.posX[i]).toBeGreaterThan(TERRAIN.maxX + 200)
    expect(Math.abs(vue.x[i] - h.sim.posX[i])).toBeLessThan(1)
  })

  it('le marqueur fait l’aller-retour dans la trame', () => {
    const jeu: JeuTrame = { mode: MODE_HOCKEY, anneau: 0, paletActif: true, paletX: 1, paletY: 2, paletVx: 0, paletVy: 0, tenuPar: -1, charge: 0, scores: [2, 1], phase: PHASE_JEU, buteur: 1, marqueur: 3, chrono: 90, decompte: 0, enOr: false }
    const corps: CorpsTrame[] = [0, 1, 2, 3].map(() => ({ compte: 500, prets: 0, base: 500, x: 10, y: 10, disperse: false, pousse: false, ouvert: false, viseeX: 0, viseeY: 0 }))
    const [morceau] = encodeEtat(1, 0, PATINOIRE_EQUIPES.terrain, corps, particulesVides(4), jeu)
    const lu = litEnteteEtat(morceau, PATINOIRE_EQUIPES.terrain)!
    expect(lu.jeu!.marqueur).toBe(3)
    expect(lu.corps.length).toBe(4)
    const sans = litEnteteEtat(encodeEtat(1, 0, PATINOIRE_EQUIPES.terrain, corps, particulesVides(4), { ...jeu, marqueur: -1 })[0], PATINOIRE_EQUIPES.terrain)!
    expect(sans.jeu!.marqueur).toBe(-1)
  })

  it('le but de mon ÉQUIPIER sonne comme le mien', () => {
    const corps: CorpsTrame[] = [0, 1, 2, 3].map(() => ({ compte: 500, prets: 0, base: 500, x: 0, y: 0, disperse: false, pousse: false, ouvert: false, viseeX: 0, viseeY: 0 }))
    const jeu = (s: [number, number], buteur: number): JeuTrame => ({ mode: MODE_HOCKEY, anneau: 0, paletActif: true, paletX: 0, paletY: 0, paletVx: 0, paletVy: 0, tenuPar: -1, charge: 0, scores: s, phase: PHASE_JEU, buteur, marqueur: 2, chrono: 90, decompte: 0, enOr: false })
    const instant = (t: number, j: JeuTrame): Instantane => ({ t, corps, jeu: j, salle: PATINOIRE_EQUIPES.terrain, rayonPalet: 48 })
    const avant = instant(0, jeu([0, 0], -1))
    const apres = instant(0.05, jeu([1, 0], 0))
    // je suis le joueur 0 : le but de mon équipe est le mien ; l'invité
    // (joueur 1), lui, l'encaisse
    expect(entend(avant, apres, 0).find((s) => s.type === 'but')?.mien).toBe(true)
    expect(entend(avant, apres, 1).find((s) => s.type === 'but')?.mien).toBe(false)
  })

  it('les chocs s’entendent entre n’importe quels corps, pas seulement 0 et 1', () => {
    const corps = (x3: number): CorpsTrame[] =>
      [0, 1, 2, 3].map((j) => ({ compte: 500, prets: 0, base: 500, x: j === 3 ? x3 : j === 2 ? 1000 : j * 2500, y: 500, disperse: false, pousse: false, ouvert: false, viseeX: 0, viseeY: 0 }))
    const s = entend({ t: 0, corps: corps(1400), jeu: null, salle: PATINOIRE_EQUIPES.terrain, rayonPalet: 0 }, { t: 0.05, corps: corps(1150), jeu: null, salle: PATINOIRE_EQUIPES.terrain, rayonPalet: 0 }, 0)
    expect(s.some((x) => x.type === 'contact')).toBe(true)
  })
})

describe('2 contre 2 — les couleurs', () => {
  it('chaque équipier porte la couleur de son équipe, éclaircie ; au duel, rien ne change', () => {
    const t = teintesDeLaPartie([0, 3], 4)
    expect(t[0]).toEqual(PALETTE[0])
    expect(t[1]).toEqual(PALETTE[3])
    for (const [j, base] of [[2, PALETTE[0]], [3, PALETTE[3]]] as const) {
      for (let c = 0; c < 3; c++) expect(t[j][c]).toBeCloseTo(base[c] + (1 - base[c]) * ECLAIRCI_EQUIPIER, 6)
    }
    expect(teintesDeLaPartie([0, 3], 2)).toEqual([PALETTE[0], PALETTE[3], PALETTE[2], PALETTE[3]])
  })
})

describe('2 contre 2 — les robots jouent en équipe', () => {
  it('deux robots équipiers ne courent pas tous les deux au palet : l’un y va, l’autre se démarque', () => {
    const h = new Hote(4, undefined, MODE_HOCKEY)
    const robots = [new Robot(0, graine(1)), new Robot(2, graine(2))]
    const depart2 = { x: h.sim.corps[2].stats.centroidX, y: h.sim.corps[2].stats.centroidY }
    // le décompte, puis six secondes de jeu, les adversaires immobiles
    pas(h, 260, robots)
    let ensemble = 0
    let images = 0
    let prisPar0 = false
    for (let s = 0; s < 720; s++) {
      pas(h, 1, robots)
      const p = h.sim.palet
      const d = (j: number): number => Math.hypot(h.sim.corps[j].stats.centroidX - p.x, h.sim.corps[j].stats.centroidY - p.y)
      images++
      if (d(0) < 220 && d(2) < 220) ensemble++
      if (h.jeu()!.tenuPar === 0) prisPar0 = true
    }
    // l'avant (le plus près au départ) l'a eu ; les deux n'ont presque
    // jamais été ensemble sur lui (mesuré : jamais) ; et l'équipier n'est
    // pas resté planté — il s'est porté en soutien
    expect(prisPar0).toBe(true)
    expect(ensemble / images).toBeLessThan(0.05)
    const c2 = h.sim.corps[2].stats
    expect(Math.hypot(c2.centroidX - depart2.x, c2.centroidY - depart2.y)).toBeGreaterThan(300)
  })

  it('quand l’autre équipe a le palet, l’un presse le porteur, l’autre se replie devant sa cage', () => {
    const h = aQuatre()
    const t = h.salle
    const my = (t.minY + t.maxY) / 2
    // le joueur 1 tient le palet, au milieu, sans bouger
    const mx = (t.minX + t.maxX) / 2
    pose(h, 1, mx, my)
    pose(h, 3, t.maxX - 600, t.maxY - 250)
    // 2 est le plus près (450 u) : il presse ; 0, en haut, se replie
    pose(h, 2, mx - 450, my)
    pose(h, 0, mx + 200, t.minY + 200)
    h.commande(1, { pousse: false, ouvert: true, x: t.minX, y: my })
    const p = h.sim.palet
    // (posé sur le corps : ses statistiques ne sont pas encore à jour)
    p.x = mx
    p.y = my
    p.vx = 0
    pas(h, 10)
    expect(h.jeu()!.tenuPar).toBe(1)
    const robots = [new Robot(0, graine(3)), new Robot(2, graine(4))]
    const maCage = t.minX + PATINOIRE_EQUIPES.ligneBut
    const x0 = mx + 200
    let auPlusPres = Infinity
    let s = 0
    for (; s < 300 && h.jeu()!.tenuPar === 1; s++) {
      pas(h, 1, robots)
      const c2 = h.sim.corps[2].stats
      const c1 = h.sim.corps[1].stats
      auPlusPres = Math.min(auPlusPres, Math.hypot(c2.centroidX - c1.centroidX, c2.centroidY - c1.centroidY))
    }
    const r = h.sim.corps[0].stats
    // le défenseur a reculé vers sa cage, et reste entre elle et le porteur
    expect(x0 - r.centroidX).toBeGreaterThan(250)
    expect(r.centroidX).toBeGreaterThan(maCage)
    expect(r.centroidX).toBeLessThan(h.sim.corps[1].stats.centroidX)
    // OUVERT : un tir qui lui arrive dessus, il le prend
    expect(h.sim.corps[0].ouvert).toBe(true)
    // l'autre est venu au contact du porteur
    expect(auPlusPres).toBeLessThan(rayonCorps(500) * 2 + 40)
  })

  it('menacé, le robot PASSE à son équipier démarqué, qui le prend', () => {
    const h = aQuatre()
    const t = h.salle
    const mx = (t.minX + t.maxX) / 2
    const my = (t.minY + t.maxY) / 2
    // le robot 0 a le palet, au milieu, l'adversaire 1 tout contre lui ; son
    // équipier 2 est seul, en retrait en haut, l'adversaire 3 loin dans son
    // coin (mesuré : la passe part à 0,4 s, l'équipier la prend à 1 s)
    pose(h, 0, mx - 300, my)
    pose(h, 2, mx - 700, t.minY + 250)
    pose(h, 3, t.maxX - 600, t.maxY - 250)
    pose(h, 1, mx + 20, my)
    h.commande(0, { pousse: false, ouvert: true, x: t.maxX, y: my })
    const p = h.sim.palet
    p.x = mx - 300
    p.y = my
    p.vx = 0
    pas(h, 10)
    expect(h.jeu()!.tenuPar).toBe(0)
    const robots = [new Robot(0, graine(5)), new Robot(2, graine(6))]
    // l'adversaire 1 fonce sur le porteur, fermé
    let vu2 = false
    let vuAdverse = false
    for (let s = 0; s < 480 && !vu2; s++) {
      const c = h.sim.corps[1].stats
      const q = h.sim.corps[0].stats
      h.commande(1, { pousse: true, ouvert: false, x: c.centroidX - (q.centroidX - c.centroidX), y: c.centroidY - (q.centroidY - c.centroidY) })
      pas(h, 1, robots)
      const tenu = h.jeu()!.tenuPar
      if (tenu === 2) vu2 = true
      if (tenu === 1 || tenu === 3) vuAdverse = true
    }
    expect(vuAdverse).toBe(false)
    expect(vu2).toBe(true)
  })
})
