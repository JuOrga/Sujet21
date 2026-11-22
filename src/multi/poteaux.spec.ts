import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { CERCLE_DECALAGE, CERCLE_ECART, ECART_POTEAU, Hockey, LIGNE_BUT, POTEAUX, RAYON_PALET, RAYON_POTEAU, RECUL_ENGAGEMENT, TERRAIN } from './hockey'
import { Hote, JET_MULTI } from './partie'
import { FluidSimMulti, KIND_PLAYER } from './solveurMulti'
import { entend, type Instantane } from './sonsMulti'
import { MODE_HOCKEY, MODE_LIBRE, PHASE_JEU, type CorpsTrame, type JeuTrame } from './trame'

// LES POTEAUX DU HOCKEY et LE JET DU MULTI (le concepteur, 22/11) : « une
// propulsion un peu plus efficace » ; « quatre poteaux métalliques, deux fois
// plus petits que le palet, répartis équitablement, majoritairement sur le
// centre du terrain, une matière qui fait rebondir le palet ».

const MILIEU_X = (TERRAIN.minX + TERRAIN.maxX) / 2
const MILIEU_Y = (TERRAIN.minY + TERRAIN.maxY) / 2
/** Le rayon d'un corps de 900 particules (RAYON_ROND × pas × √900). */
const RAYON_CORPS = 0.5222 * 6.6 * 30

const pas = (h: Hote, n: number): void => {
  for (let s = 0; s < n; s++) h.avance(h.params.dt, 1e9)
}
/** Une partie de hockey en jeu, les corps ÉCARTÉS au fond de leur camp. */
const enJeu = (): Hote => {
  const h = new Hote(2, undefined, MODE_HOCKEY)
  const s = h.sim
  for (let i = 0; i < s.count; i++) s.posX[i] += s.proprio[i] === 0 ? -505 : 505
  pas(h, 60)
  h.hockey!.decompte = 0
  pas(h, 1)
  return h
}

describe('le jet du multi', () => {
  it('pousse plus fort que celui du jeu, pour la même matière', () => {
    const essai = (vitesse: number): { v: number; reste: number } => {
      const h = new Hote(2, undefined, MODE_LIBRE)
      h.params.ejectSpeed = vitesse
      const c = h.sim.corps[0].stats
      pas(h, 30)
      h.commande(0, { pousse: true, ouvert: false, x: c.centroidX - 400, y: c.centroidY })
      pas(h, 120)
      const v = h.sim.corps[0].stats.velX
      h.commande(0, { pousse: false, ouvert: false, x: 0, y: 0 })
      pas(h, 240)
      return { v, reste: h.sim.corps[0].playerCount }
    }
    // c'est bien le jet de l'hôte du multi, pas celui du jeu
    expect(new Hote(2, undefined, MODE_LIBRE).params.ejectSpeed).toBe(JET_MULTI)
    expect(DEFAULT_PARAMS.ejectSpeed).toBe(1400)
    const jeu = essai(DEFAULT_PARAMS.ejectSpeed)
    const multi = essai(JET_MULTI)
    // mesuré : 54 u/s contre 64 après une seconde de poussée…
    expect(multi.v).toBeGreaterThan(jeu.v * 1.1)
    // …et la même matière au corps deux secondes plus tard (839 et 841)
    expect(Math.abs(multi.reste - jeu.reste)).toBeLessThan(15)
  })
})

describe('les poteaux du hockey — leur place', () => {
  it('quatre, deux fois plus petits que le palet, en carré autour du centre', () => {
    expect(POTEAUX.length).toBe(4)
    expect(RAYON_POTEAU * 2).toBe(RAYON_PALET)
    for (const q of POTEAUX) {
      expect(Math.abs(Math.abs(q.x - MILIEU_X) - ECART_POTEAU)).toBeLessThan(1e-9)
      expect(Math.abs(Math.abs(q.y - MILIEU_Y) - ECART_POTEAU)).toBeLessThan(1e-9)
    }
    // un de chaque côté, en haut et en bas : répartis également
    expect(new Set(POTEAUX.map((q) => `${Math.sign(q.x - MILIEU_X)},${Math.sign(q.y - MILIEU_Y)}`)).size).toBe(4)
  })

  it('sur le centre : entre les lignes bleues, hors du cercle central, et le couloir de l’axe libre', () => {
    for (const q of POTEAUX) {
      // les lignes bleues sont à 430 u du centre
      expect(Math.abs(q.x - MILIEU_X) + RAYON_POTEAU).toBeLessThan(430)
      // le cercle central fait 200 u
      expect(Math.hypot(q.x - MILIEU_X, q.y - MILIEU_Y) - RAYON_POTEAU).toBeGreaterThan(200)
      // un corps passe sur l'axe sans les toucher
      expect(Math.abs(q.y - MILIEU_Y) - RAYON_POTEAU).toBeGreaterThan(RAYON_CORPS)
      // et entre un poteau et la bande aussi
      expect(Math.min(q.y - TERRAIN.minY, TERRAIN.maxY - q.y) - RAYON_POTEAU).toBeGreaterThan(2 * RAYON_CORPS)
    }
  })

  it('aucun ne gêne un engagement, au centre comme aux cercles de zone', () => {
    // chaque point d'engagement, et les deux corps posés de part et d'autre
    const points = [{ x: MILIEU_X, y: MILIEU_Y }]
    for (const cote of [0, 1]) {
      const duFond = LIGNE_BUT + CERCLE_DECALAGE
      for (const s of [-1, 1]) points.push({ x: cote === 0 ? TERRAIN.minX + duFond : TERRAIN.maxX - duFond, y: MILIEU_Y + s * CERCLE_ECART })
    }
    for (const pt of points) {
      for (const dx of [-RECUL_ENGAGEMENT, RECUL_ENGAGEMENT]) {
        for (const q of POTEAUX) expect(Math.hypot(pt.x + dx - q.x, pt.y - q.y)).toBeGreaterThan(RAYON_CORPS + RAYON_POTEAU + 20)
      }
      for (const q of POTEAUX) expect(Math.hypot(pt.x - q.x, pt.y - q.y)).toBeGreaterThan(RAYON_PALET + RAYON_POTEAU + 20)
    }
  })
})

describe('les poteaux du hockey — le palet', () => {
  /** Le palet lancé droit sur le premier poteau, son bord à `ecart` u du
   *  poteau, à `vitesse` : sa vitesse radiale (positive : il s'en éloigne)
   *  une demi-seconde plus tard, et la plus courte distance au poteau. */
  const ricoche = (vitesse: number, ecart = 128): { radiale: number; vitesse: number; auPlusPres: number } => {
    const h = enJeu()
    const p = h.sim.palet
    const q = POTEAUX[0]
    // il arrive du centre, en biais vers le poteau
    const ux = (q.x - MILIEU_X) / Math.hypot(q.x - MILIEU_X, q.y - MILIEU_Y)
    const uy = (q.y - MILIEU_Y) / Math.hypot(q.x - MILIEU_X, q.y - MILIEU_Y)
    p.x = q.x - ux * (RAYON_PALET + RAYON_POTEAU + ecart)
    p.y = q.y - uy * (RAYON_PALET + RAYON_POTEAU + ecart)
    p.vx = ux * vitesse
    p.vy = uy * vitesse
    let auPlusPres = Infinity
    for (let s = 0; s < 60; s++) {
      pas(h, 1)
      auPlusPres = Math.min(auPlusPres, Math.hypot(p.x - q.x, p.y - q.y))
    }
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    return { radiale: (p.vx * (p.x - q.x) + p.vy * (p.y - q.y)) / d, vitesse: Math.hypot(p.vx, p.vy), auPlusPres }
  }

  it('le métal renvoie le palet sans rien lui prendre (la bande en garde 85 %)', () => {
    const r = ricoche(700)
    expect(r.radiale).toBeGreaterThan(0)
    // seul le frottement de la glace lui a pris quelque chose en route : une
    // demi-seconde à 0,2 s⁻¹, e^−0,1 — 633 u/s mesurés, exactement cela.
    // Une bande, qui en garde 85 %, l'aurait rendu à 538.
    expect(r.vitesse).toBeGreaterThan(700 * Math.exp(-0.1) * 0.99)
    // et il n'est jamais entré dans le poteau
    expect(r.auPlusPres).toBeGreaterThanOrEqual(RAYON_PALET + RAYON_POTEAU - 1e-6)
  })

  it('un palet qui arrive mollement en repart d’un coup sec', () => {
    // (posé tout contre, il arrive à 120 u/s)
    const r = ricoche(120, 10)
    expect(r.radiale).toBeGreaterThan(280)
  })
})

describe('les poteaux du hockey — l’eau et la glace', () => {
  /** Un corps lancé droit sur le premier poteau : combien de ses particules
   *  sont entrées dans le poteau, au pire, et sa vitesse x à la fin. */
  const fonce = (glace: boolean): { dedans: number; vx: number } => {
    const sim = new FluidSimMulti({ ...DEFAULT_PARAMS }, TERRAIN, 2048, 1)
    const q = POTEAUX[0]
    sim.spawnDisc(q.x - 300, q.y, 400, KIND_PLAYER)
    sim.relabel()
    new Hockey().engage(sim)
    sim.freezeIntent = glace
    for (let s = 0; s < 80; s++) sim.step(sim.params.dt)
    for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_PLAYER) sim.velX[i] += 400
    let dedans = 0
    for (let s = 0; s < 150; s++) {
      sim.step(sim.params.dt)
      let n = 0
      for (let i = 0; i < sim.count; i++) if (Math.hypot(sim.posX[i] - q.x, sim.posY[i] - q.y) < RAYON_POTEAU - 3) n++
      dedans = Math.max(dedans, n)
    }
    let vx = 0
    let m = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER) continue
      vx += sim.velX[i]
      m++
    }
    return { dedans, vx: vx / m }
  }

  it('l’eau ne traverse pas un poteau : elle s’y écrase et le contourne', () => {
    const r = fonce(false)
    expect(r.dedans).toBe(0)
    // un poteau mince n'arrête pas un corps : l'eau s'y fend et passe de
    // part et d'autre, en y laissant un peu de son élan (mesuré : 400 → 355)
    expect(r.vx).toBeLessThan(390)
    expect(r.vx).toBeGreaterThan(0)
  })

  it('un bloc de glace y ricoche', () => {
    const r = fonce(true)
    expect(r.dedans).toBe(0)
    expect(r.vx).toBeLessThan(0)
  })
})

describe('les poteaux du hockey — le son', () => {
  const corps = (x: number): CorpsTrame => ({ compte: 900, prets: 0, base: 900, x, y: 200, disperse: false, pousse: false, ouvert: false, viseeX: 0, viseeY: 0 })
  const jeu = (x: number, y: number, vx: number, vy: number): JeuTrame => ({
    mode: MODE_HOCKEY, anneau: 0, paletActif: true, paletX: x, paletY: y, paletVx: vx, paletVy: vy, tenuPar: -1, charge: 0, scores: [0, 0], phase: PHASE_JEU, buteur: -1, chrono: 100, decompte: 0, enOr: false,
  })
  const poteaux = POTEAUX.map((q) => ({ x: q.x, y: q.y, rayon: RAYON_POTEAU }))
  const image = (t: number, j: JeuTrame): Instantane => ({ t, corps: [corps(400), corps(2400)], jeu: j, salle: TERRAIN, rayonPalet: RAYON_PALET, poteaux })

  it('le palet sur un poteau tinte ; ailleurs, le même saut est un choc contre l’eau', () => {
    const q = POTEAUX[0]
    const pres = q.x + RAYON_POTEAU + RAYON_PALET
    expect(entend(image(1, jeu(pres, q.y, -600, 0)), image(1.02, jeu(pres, q.y, 600, 0)), 0).map((s) => s.type)).toEqual(['poteau'])
    expect(entend(image(1, jeu(MILIEU_X, MILIEU_Y, -600, 0)), image(1.02, jeu(MILIEU_X, MILIEU_Y, 600, 0)), 0).map((s) => s.type)).toEqual(['choc-palet'])
  })
})
