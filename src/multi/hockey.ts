// LE HOCKEY — la règle du jeu autour du palet.
//
// L'idée est du concepteur (20/11) : « un terrain de hockey vu du dessus, un
// volume par camp et un palet assez gros qui rebondit sur les parois ; le but
// est d'aller le mettre dans la cage adverse. Si on n'ouvre pas le volume, le
// palet rebondit dessus — pas comme un glaçon, il y a un amorti, une
// déformation du liquide. Si on ouvre, on absorbe le palet, et quand on
// relâche, on le lance. »
//
// Le solveur ne connaît du palet que son contact avec l'eau (solveurMulti.ts,
// PaletSim). Tout le reste est ici : sa course, les parois et les cages, qui
// le tient, comment il part, le score. Ce module ne connaît ni le réseau ni
// l'écran — on y joue un match entier en test.
//
// LA VISÉE : le palet part vers le POINTEUR au moment où l'on se referme.
// C'est le pointeur qui dirige déjà le jet ; il n'y a qu'un geste de visée à
// apprendre. Et comme on avance en tirant derrière soi, viser la cage oblige
// à se retourner : c'est le temps que l'adversaire a pour venir bousculer.

import { MAT_WALL } from '../game/level'
import { KIND_PLAYER, type FluidSimMulti } from './solveurMulti'
import { PHASE_BUT, PHASE_DECOMPTE, PHASE_FINI, PHASE_JEU, type Bornes, type Commande, type JeuTrame } from './trame'

// LE TERRAIN est une PATINOIRE, sur le modèle des vraies (« prends vraiment
// l'exemple de la forme d'un terrain de hockey : les bords du terrain
// arrondis, cage similaire », le concepteur, 21/11). Une patinoire fait
// 200 pieds sur 85, ses coins sont des quarts de cercle de 28 pieds, la
// cage est posée en retrait du fond et l'on passe derrière.
//
// Les PROPORTIONS du terrain sont les vraies (2,36 de long pour 1 de large,
// des coins d'un tiers de la largeur). Les cages, non : à l'échelle elles
// feraient 86 u d'ouverture, moins que le palet — elles gardent la FORME des
// vraies (un trapèze, plus étroit au fond) à la taille de ce jeu, et il
// reste derrière elles de quoi faire passer un corps.

/** Le terrain : plus court que la salle libre (3840 × 2160) — se déplacer
 *  coûte de la matière —, et de la longueur qu'il faut pour remplir l'écran
 *  avec le score au-dessus et l'aide au-dessous. */
export const TERRAIN: Bornes = { minX: 0, minY: 0, maxX: 2880, maxY: 1220 }
/** Le rayon des coins : un tiers de la largeur, comme sur une patinoire. */
export const RAYON_COINS = 400
/** La distance de la ligne de but à la paroi du fond. */
export const LIGNE_BUT = 440
/** La profondeur d'une cage, de sa ligne de but à son fond. Derrière il
 *  reste 270 u jusqu'au bord : un corps de 900 particules (~210 u de large)
 *  y passe. */
export const PROFONDEUR_CAGE = 140
/** La demi-largeur de la cage à son ouverture, puis à son fond. */
export const DEMI_OUVERTURE = 200
export const DEMI_FOND = 130
/** L'épaisseur de ses parois. Une goutte tirée fait 12 u par pas : à 30 u
 *  elle ne les traverse pas. */
export const EPAISSEUR_CAGE = 30

/** UNE PAROI : un rectangle tourné. `angle` en degrés, dans le sens du
 *  solveur (game/formes.ts) : l'axe long de la paroi pointe vers
 *  (cos, sin) de l'angle, y vers le bas. */
export interface Paroi {
  cx: number
  cy: number
  demiL: number
  demiE: number
  angle: number
}

/** La paroi posée le long du segment A → B, du côté opposé au point
 *  `dedans` : c'est ce côté-là qui est le jeu. */
function paroiLeLong(ax: number, ay: number, bx: number, by: number, dedansX: number, dedansY: number, epaisseur: number, rallonge: number): Paroi {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const lx = bx - ax
  const ly = by - ay
  const l = Math.hypot(lx, ly)
  // la normale, tournée vers le dehors
  let nx = -ly / l
  let ny = lx / l
  if ((dedansX - mx) * nx + (dedansY - my) * ny > 0) {
    nx = -nx
    ny = -ny
  }
  return { cx: mx + (nx * epaisseur) / 2, cy: my + (ny * epaisseur) / 2, demiL: l / 2 + rallonge, demiE: epaisseur / 2, angle: (Math.atan2(ly, lx) * 180) / Math.PI }
}

/** Les parois des deux cages : pour chacune un fond et deux côtés penchés. */
export function paroisCages(): Paroi[] {
  const my = (TERRAIN.minY + TERRAIN.maxY) / 2
  const parois: Paroi[] = []
  for (const cote of [0, 1]) {
    // x compté depuis le fond de SON côté du terrain, puis remis en monde
    const x = (d: number): number => (cote === 0 ? TERRAIN.minX + d : TERRAIN.maxX - d)
    const ligne = x(LIGNE_BUT)
    const fond = x(LIGNE_BUT - PROFONDEUR_CAGE)
    const coeur = x(LIGNE_BUT - PROFONDEUR_CAGE / 2)
    parois.push(paroiLeLong(fond, my - DEMI_FOND, fond, my + DEMI_FOND, coeur, my, EPAISSEUR_CAGE, EPAISSEUR_CAGE))
    for (const s of [-1, 1]) parois.push(paroiLeLong(ligne, my + s * DEMI_OUVERTURE, fond, my + s * DEMI_FOND, coeur, my, EPAISSEUR_CAGE, 6))
  }
  return parois
}

/** Les COINS du terrain, pour l'eau : chaque quart de cercle est fait de six
 *  parois droites posées bout à bout (l'écart au vrai cercle est de 3,4 u).
 *  Le palet, lui, suit le vrai cercle. */
export function paroisCoins(): Paroi[] {
  const SEGMENTS = 6
  const EPAISSEUR = 90
  const parois: Paroi[] = []
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = sx < 0 ? TERRAIN.minX + RAYON_COINS : TERRAIN.maxX - RAYON_COINS
    const cy = sy < 0 ? TERRAIN.minY + RAYON_COINS : TERRAIN.maxY - RAYON_COINS
    // du bord vertical au bord horizontal du coin
    const point = (k: number): [number, number] => {
      const t = ((k / SEGMENTS) * Math.PI) / 2
      return [cx + sx * RAYON_COINS * Math.cos(t), cy + sy * RAYON_COINS * Math.sin(t)]
    }
    for (let k = 0; k < SEGMENTS; k++) {
      const [ax, ay] = point(k)
      const [bx, by] = point(k + 1)
      parois.push(paroiLeLong(ax, ay, bx, by, cx, cy, EPAISSEUR, 14))
    }
  }
  return parois
}

const PAROIS_CAGES = paroisCages()
const PAROIS_EAU = [...PAROIS_CAGES, ...paroisCoins()]
/** Une paroi telle que le solveur la reçoit. */
const pourLeSolveur = (p: Paroi): { minX: number; minY: number; maxX: number; maxY: number; material: number; angle: number } => ({
  minX: p.cx - p.demiL,
  maxX: p.cx + p.demiL,
  minY: p.cy - p.demiE,
  maxY: p.cy + p.demiE,
  material: MAT_WALL,
  angle: p.angle,
})
/** Le rayon du palet : un corps de 900 particules fait ~105 u de rayon. */
export const RAYON_PALET = 48
/** Sa masse, en particules. Lourd, il ne se laisserait pas arrêter ; léger,
 *  un jet l'enverrait au bout du terrain. */
export const MASSE_PALET = 120
/** Ce que le palet garde de sa vitesse en touchant une paroi. */
const RESTITUTION_PAROI = 0.85
/** Le frottement de la glace, en s⁻¹ : lancé à 1 000 u/s, il en garde la
 *  moitié au bout de trois secondes et demie. */
const FROTTEMENT = 0.2
/** Aucun palet ne va plus vite : au-delà il traverserait un corps en un pas. */
const VITESSE_MAX_PALET = 2200
/** Un corps OUVERT prend le palet dès qu'il le TOUCHE : ce nombre de ses
 *  particules au contact suffit (trois, pour qu'une goutte du bord égarée
 *  n'y suffise pas). La première règle demandait que le corps recouvre la
 *  moitié du palet : frôlé, il passait à travers le corps ouvert sans être
 *  pris — « quand le volume touche le palet et qu'on est ouvert, le volume
 *  doit absorber le palet » (le concepteur, 20/11). Une fois pris, il est
 *  aspiré vers le cœur du corps. */
const TOUCHE_PRISE = 3
/** On ne garde pas le palet : au bout de ce délai il s'échappe. */
export const TENUE_MAX = 3
/** Le temps qu'il faut le tenir pour le lancer à pleine force. */
export const CHARGE_PLEINE = 1.2
/** La vitesse du lancer, relâché aussitôt pris, puis à pleine charge. */
const LANCER_MIN = 500
const LANCER_MAX = 1500
/** Échappé faute de l'avoir lancé, il tombe mollement. */
const LANCER_ECHAPPE = 220
/** Le délai avant qu'une goutte tirée puisse revenir, en part de celui du
 *  jeu (1,2 s). */
const DELAI_RETOUR = 0.5
/** Qui a laissé ÉCHAPPER le palet ne peut pas le reprendre aussitôt : sans
 *  ce repos, rester ouvert suffirait à le garder indéfiniment, par tranches
 *  de trois secondes. */
const REPOS_ECHAPPE = 1.5
/** La pause après un but, avant que chacun retourne à sa place. */
const PAUSE_BUT = 1.2
/** LE DÉCOMPTE de l'engagement : « 3, 2, 1 », sept dixièmes chacun. Pendant
 *  ce temps personne ne pousse, et le palet attend. */
export const DECOMPTE = 2.1
/** La durée d'un match. À la fin, le meilleur score gagne ; à égalité, le
 *  prochain but (le « but en or »). */
export const DUREE_MATCH = 180
/** Après un but, le palet est rendu à celui qui vient d'ENCAISSER : posé de
 *  son côté, à cette distance du centre. Au premier engagement, au centre. */
const DECALAGE_ENGAGEMENT = 380
/** LE VOL. Un corps FERMÉ qui percute le porteur lui fait lâcher le palet,
 *  s'il arrive assez vite (u/s, vitesse de rapprochement des deux cœurs).
 *  Sans cela il n'y avait rien à faire contre le porteur, qu'attendre. Une
 *  poussée soutenue y arrive ; un dash, à coup sûr. */
const VITESSE_VOL = 130
/** Les deux corps se touchent quand leurs cœurs sont à moins que la somme de
 *  leurs rayons, plus cette marge (u). */
const MARGE_VOL = 18
/** La vitesse à laquelle le palet volé s'échappe, à l'opposé de celui qui a
 *  frappé (u/s). */
const SORTIE_VOL = 380
/** Le rayon du rond qu'occupent n particules (solveurMulti.ts, RAYON_ROND). */
const rayonCorps = (n: number): number => 0.5222 * 6.6 * Math.sqrt(Math.max(0, n))
/** Le premier à ce score gagne. */
export const BUTS_POUR_GAGNER = 5

/** Ce que rend un pas de la règle : rien, ou ce qui vient d'arriver. */
export type Evenement = null | 'but' | 'engagement' | 'fini'

export class Hockey {
  readonly scores: [number, number] = [0, 0]
  /** Qui tient le palet (−1 : personne), et depuis combien de temps. */
  tenuPar = -1
  tenuDepuis = 0
  /** Le corps que le palet est en train de QUITTER après un lancer : il le
   *  traverse encore, et ce joueur ne peut pas le reprendre au passage. */
  sortDe = -1
  phase: number = PHASE_JEU
  buteur = -1
  private pause = 0
  /** Le joueur au repos après avoir laissé échapper le palet, et pour
   *  combien de temps encore. */
  private auRepos = -1
  private repos = 0
  /** Le temps de jeu qui reste (s), ce qui reste du décompte, et si l'on
   *  joue le but en or. */
  chrono = DUREE_MATCH
  decompte = 0
  enOr = false
  /** À qui rendre le palet au prochain engagement (−1 : au centre). */
  private pour = -1

  /** Pendant le décompte, personne ne pousse. */
  get gele(): boolean {
    return this.phase === PHASE_DECOMPTE
  }

  /** L'engagement : le palet posé, immobile, et le décompte qui part. */
  engage(sim: FluidSimMulti): void {
    const p = sim.palet
    // la matière tirée revient à son corps d'où qu'elle soit : au hockey on
    // pousse sans cesse, et on ne va pas ramasser ses gouttes
    sim.rappelSansLimite = true
    // …et elle n'attend pas : dans le jeu une goutte éjectée n'est
    // rappelable qu'au bout de 1,2 s ; ici la moitié. Le jet porte encore à
    // 720 u (mesuré : il donne au palet la même vitesse, 77 u/s, que le
    // délai soit entier ou réduit).
    sim.reabsorbFactor = DELAI_RETOUR
    // les cages et les coins arrondis : des parois pour l'eau aussi
    sim.setLevel(PAROIS_EAU.map(pourLeSolveur), [])
    // posé, mais pas encore en jeu : il le sera à la fin du décompte
    p.actif = false
    p.rayon = RAYON_PALET
    p.masse = MASSE_PALET
    p.x = (TERRAIN.minX + TERRAIN.maxX) / 2 + (this.pour < 0 ? 0 : this.pour === 0 ? -DECALAGE_ENGAGEMENT : DECALAGE_ENGAGEMENT)
    p.y = (TERRAIN.minY + TERRAIN.maxY) / 2
    p.vx = 0
    p.vy = 0
    p.traverse = 0
    p.recuX = 0
    p.recuY = 0
    this.tenuPar = -1
    this.tenuDepuis = 0
    this.sortDe = -1
    this.auRepos = -1
    this.repos = 0
    this.phase = PHASE_DECOMPTE
    this.decompte = DECOMPTE
  }

  /** Un match neuf. */
  recommence(sim: FluidSimMulti): void {
    this.scores[0] = 0
    this.scores[1] = 0
    this.buteur = -1
    this.chrono = DUREE_MATCH
    this.enOr = false
    this.pour = -1
    this.engage(sim)
  }

  /** AVANT le pas du solveur : dire au palet quels corps il traverse. */
  avant(sim: FluidSimMulti): void {
    let bits = 0
    // celui qui le TIENT aussi : le pas où il se referme, le palet est encore
    // au cœur de son corps — sans ce bit, le noyau dur chassait d'un coup les
    // deux cents particules posées sur lui (mesuré : 900 particules, 351
    // restaient au corps après le lancer)
    for (let j = 0; j < sim.corps.length; j++) {
      if (sim.corps[j].ouvert || j === this.sortDe || j === this.tenuPar) bits |= 1 << j
    }
    sim.palet.traverse = bits
  }

  /** APRÈS le pas du solveur : le palet reçoit ce que l'eau lui a rendu,
   *  avance, rebondit, se fait prendre ou lancer, et marque. */
  apres(sim: FluidSimMulti, commandes: readonly Commande[], dt: number): Evenement {
    const p = sim.palet
    if (this.phase === PHASE_FINI) return null
    if (this.phase === PHASE_BUT) {
      this.pause -= dt
      if (this.pause > 0) return null
      return 'engagement'
    }
    if (this.phase === PHASE_DECOMPTE) {
      this.decompte -= dt
      if (this.decompte > 0) return null
      this.decompte = 0
      this.phase = PHASE_JEU
      p.actif = true
      return null
    }
    // le temps de jeu : il ne court que quand on joue
    if (!this.enOr) {
      this.chrono -= dt
      if (this.chrono <= 0) {
        this.chrono = 0
        if (this.scores[0] === this.scores[1]) {
          this.enOr = true
        } else {
          // au temps : le meilleur score gagne
          this.buteur = this.scores[0] > this.scores[1] ? 0 : 1
          this.phase = PHASE_FINI
          p.actif = false
          this.tenuPar = -1
          return 'fini'
        }
      }
    }

    if (this.repos > 0) this.repos -= dt
    if (this.tenuPar >= 0) {
      const j = this.tenuPar
      const c = sim.corps[j]
      this.tenuDepuis += dt
      const lache = !c.ouvert || c.dispersed || c.playerCount < 12
      const voleur = lache ? -1 : this.voleur(sim, j)
      if (voleur >= 0) {
        this.vole(sim, j, voleur)
      } else if (lache || this.tenuDepuis >= TENUE_MAX) {
        this.lance(sim, j, commandes[j], !lache || c.dispersed)
      } else {
        // porté : il suit le cœur du corps
        const suit = Math.min(1, 14 * dt)
        p.x += (c.stats.centroidX - p.x) * suit
        p.y += (c.stats.centroidY - p.y) * suit
        p.vx = c.stats.velX
        p.vy = c.stats.velY
        // porté jusque dans une cage : c'est un but aussi
        return this.dansUneCage(p)
      }
    } else {
      // libre : ce que l'eau lui a rendu pendant le pas
      p.vx += p.recuX / p.masse
      p.vy += p.recuY / p.masse
    }

    // la glace freine un peu, et rien ne file plus vite que le plafond
    const frein = Math.exp(-FROTTEMENT * dt)
    p.vx *= frein
    p.vy *= frein
    const v = Math.hypot(p.vx, p.vy)
    if (v > VITESSE_MAX_PALET) {
      p.vx *= VITESSE_MAX_PALET / v
      p.vy *= VITESSE_MAX_PALET / v
    }
    p.x += p.vx * dt
    p.y += p.vy * dt

    // sorti du corps qui l'a lancé (il ne le touche plus du tout) : il
    // redevient un obstacle pour lui, et celui-ci peut le reprendre
    if (this.sortDe >= 0 && p.touche[this.sortDe] === 0) this.sortDe = -1

    // pris par un corps OUVERT qui le touche — et si les deux le touchent
    // ensemble, par celui qui le touche le plus
    let preneur = -1
    for (let j = 0; j < sim.corps.length; j++) {
      const c = sim.corps[j]
      if (!c.ouvert || j === this.sortDe || c.dispersed) continue
      if (j === this.auRepos && this.repos > 0) continue
      if (p.touche[j] < TOUCHE_PRISE) continue
      if (preneur < 0 || p.touche[j] > p.touche[preneur]) preneur = j
    }
    if (preneur >= 0) this.prend(sim, preneur)

    return this.parois(p)
  }

  /** Qui fait lâcher le palet au porteur j : un corps FERMÉ au contact, qui
   *  arrive assez vite. −1 si personne. */
  private voleur(sim: FluidSimMulti, j: number): number {
    const c = sim.corps[j]
    for (let k = 0; k < sim.corps.length; k++) {
      if (k === j) continue
      const a = sim.corps[k]
      if (a.ouvert || a.dispersed || a.playerCount < 12) continue
      const dx = c.stats.centroidX - a.stats.centroidX
      const dy = c.stats.centroidY - a.stats.centroidY
      const d = Math.hypot(dx, dy)
      if (d < 1 || d > rayonCorps(c.playerCount) + rayonCorps(a.playerCount) + MARGE_VOL) continue
      // la vitesse à laquelle les deux se rapprochent, et la part qu'y prend
      // le corps k : c'est LUI qui doit foncer. Vu à l'essai avec la seule
      // vitesse de rapprochement — le porteur qui venait buter sur un
      // adversaire immobile se faisait « voler » le palet par lui.
      const approche = ((a.stats.velX - c.stats.velX) * dx + (a.stats.velY - c.stats.velY) * dy) / d
      const elan = (a.stats.velX * dx + a.stats.velY * dy) / d
      if (approche > VITESSE_VOL && elan > approche / 2) return k
    }
    return -1
  }

  /** Le palet est arraché au porteur j par le choc du corps k : il file à
   *  l'opposé de celui qui a frappé, et le porteur ne le reprend pas aussitôt. */
  private vole(sim: FluidSimMulti, j: number, k: number): void {
    const p = sim.palet
    const c = sim.corps[j]
    const a = sim.corps[k]
    const dx = c.stats.centroidX - a.stats.centroidX
    const dy = c.stats.centroidY - a.stats.centroidY
    const d = Math.hypot(dx, dy) || 1
    p.vx = c.stats.velX + (dx / d) * SORTIE_VOL
    p.vy = c.stats.velY + (dy / d) * SORTIE_VOL
    this.tenuPar = -1
    this.tenuDepuis = 0
    this.sortDe = j
    this.auRepos = j
    this.repos = REPOS_ECHAPPE
  }

  /** Le corps j prend le palet : il en encaisse l'élan (c'est l'amorti). */
  private prend(sim: FluidSimMulti, j: number): void {
    const p = sim.palet
    const c = sim.corps[j]
    const n = c.playerCount
    if (n <= 0) return
    const part = p.masse / (n + p.masse)
    this.pousse(sim, j, (p.vx - c.stats.velX) * part, (p.vy - c.stats.velY) * part)
    this.tenuPar = j
    this.tenuDepuis = 0
    this.sortDe = -1
  }

  /** Le lancer : vers le pointeur, d'autant plus fort qu'on a tenu. */
  private lance(sim: FluidSimMulti, j: number, commande: Commande | undefined, echappe: boolean): void {
    const p = sim.palet
    const c = sim.corps[j]
    let dx = (commande?.x ?? p.x) - p.x
    let dy = (commande?.y ?? p.y) - p.y
    let d = Math.hypot(dx, dy)
    if (d < 1) {
      // pas de visée : droit vers la cage adverse
      dx = j === 0 ? 1 : -1
      dy = 0
      d = 1
    }
    const charge = Math.min(1, this.tenuDepuis / CHARGE_PLEINE)
    const vitesse = echappe ? LANCER_ECHAPPE : LANCER_MIN + (LANCER_MAX - LANCER_MIN) * charge
    const lx = (dx / d) * vitesse
    const ly = (dy / d) * vitesse
    p.vx = c.stats.velX + lx
    p.vy = c.stats.velY + ly
    // le recul : ce que le palet emporte, le corps le perd
    const n = c.playerCount
    if (n > 0) this.pousse(sim, j, (-lx * p.masse) / n, (-ly * p.masse) / n)
    this.tenuPar = -1
    this.tenuDepuis = 0
    this.sortDe = j
    if (echappe) {
      this.auRepos = j
      this.repos = REPOS_ECHAPPE
    }
  }

  /** Ajoute une vitesse à tout le corps j. */
  private pousse(sim: FluidSimMulti, j: number, dvx: number, dvy: number): void {
    for (let i = 0; i < sim.count; i++) {
      if (sim.kind[i] !== KIND_PLAYER || sim.proprio[i] !== j) continue
      sim.velX[i] += dvx
      sim.velY[i] += dvy
    }
  }

  /** Le tour du terrain (ses coins sont ronds), les parois des cages, et
   *  le but. */
  private parois(p: FluidSimMulti['palet']): Evenement {
    const r = p.rayon
    // ---- le tour : dans un coin, le palet suit le quart de cercle
    const cx = p.x < TERRAIN.minX + RAYON_COINS ? TERRAIN.minX + RAYON_COINS : p.x > TERRAIN.maxX - RAYON_COINS ? TERRAIN.maxX - RAYON_COINS : NaN
    const cy = p.y < TERRAIN.minY + RAYON_COINS ? TERRAIN.minY + RAYON_COINS : p.y > TERRAIN.maxY - RAYON_COINS ? TERRAIN.maxY - RAYON_COINS : NaN
    if (cx === cx && cy === cy) {
      const dx = p.x - cx
      const dy = p.y - cy
      const d = Math.hypot(dx, dy)
      const libre = RAYON_COINS - r
      if (d > libre) {
        // la normale pointe vers le centre du coin
        const nx = -dx / d
        const ny = -dy / d
        p.x = cx - nx * libre
        p.y = cy - ny * libre
        const vn = p.vx * nx + p.vy * ny
        if (vn < 0) {
          p.vx -= (1 + RESTITUTION_PAROI) * vn * nx
          p.vy -= (1 + RESTITUTION_PAROI) * vn * ny
        }
      }
    } else {
      if (p.y - r < TERRAIN.minY) {
        p.y = TERRAIN.minY + r
        if (p.vy < 0) p.vy = -p.vy * RESTITUTION_PAROI
      } else if (p.y + r > TERRAIN.maxY) {
        p.y = TERRAIN.maxY - r
        if (p.vy > 0) p.vy = -p.vy * RESTITUTION_PAROI
      }
      if (p.x - r < TERRAIN.minX) {
        p.x = TERRAIN.minX + r
        if (p.vx < 0) p.vx = -p.vx * RESTITUTION_PAROI
      } else if (p.x + r > TERRAIN.maxX) {
        p.x = TERRAIN.maxX - r
        if (p.vx > 0) p.vx = -p.vx * RESTITUTION_PAROI
      }
    }
    // ---- les parois des cages : un disque contre un rectangle tourné
    for (const b of PAROIS_CAGES) {
      const rad = (b.angle * Math.PI) / 180
      const ca = Math.cos(rad)
      const sa = Math.sin(rad)
      // le palet, vu de la paroi (son axe long sur x)
      const lx = (p.x - b.cx) * ca + (p.y - b.cy) * sa
      const ly = -(p.x - b.cx) * sa + (p.y - b.cy) * ca
      const qx = lx < -b.demiL ? -b.demiL : lx > b.demiL ? b.demiL : lx
      const qy = ly < -b.demiE ? -b.demiE : ly > b.demiE ? b.demiE : ly
      let nx = lx - qx
      let ny = ly - qy
      const d2 = nx * nx + ny * ny
      if (d2 >= r * r) continue
      let recul: number
      const d = Math.sqrt(d2)
      if (d < 1e-6) {
        // son centre est DANS la paroi : il ressort par le plus court
        const versBord = b.demiE - Math.abs(ly)
        nx = 0
        ny = ly < 0 ? -1 : 1
        recul = versBord + r
      } else {
        nx /= d
        ny /= d
        recul = r - d
      }
      // la normale, remise en monde
      const wx = nx * ca - ny * sa
      const wy = nx * sa + ny * ca
      p.x += wx * recul
      p.y += wy * recul
      const vn = p.vx * wx + p.vy * wy
      if (vn < 0) {
        p.vx -= (1 + RESTITUTION_PAROI) * vn * wx
        p.vy -= (1 + RESTITUTION_PAROI) * vn * wy
      }
    }
    return this.dansUneCage(p)
  }

  /** LE BUT : le palet a franchi la ligne d'une cage — plus qu'à moitié
   *  dedans. Les parois ne laissent entrer que par devant ; porté par un
   *  joueur, il compte aussi. Le joueur 0 garde la cage de GAUCHE. */
  private dansUneCage(p: FluidSimMulti['palet']): Evenement {
    const ecart = Math.abs(p.y - (TERRAIN.minY + TERRAIN.maxY) / 2)
    for (const cote of [0, 1]) {
      // la distance au fond de ce côté-là du terrain
      const duFond = cote === 0 ? p.x - TERRAIN.minX : TERRAIN.maxX - p.x
      const creux = LIGNE_BUT - PROFONDEUR_CAGE
      if (duFond <= creux || duFond >= LIGNE_BUT - p.rayon * 0.5) continue
      // la cage se resserre vers le fond
      const large = DEMI_FOND + ((DEMI_OUVERTURE - DEMI_FOND) * (duFond - creux)) / PROFONDEUR_CAGE
      if (ecart < large) return this.but(p, 1 - cote)
    }
    return null
  }

  private but(p: FluidSimMulti['palet'], buteur: number): Evenement {
    this.scores[buteur]++
    this.buteur = buteur
    p.actif = false
    p.vx = 0
    p.vy = 0
    this.tenuPar = -1
    this.sortDe = -1
    // le palet sera rendu à celui qui encaisse
    this.pour = 1 - buteur
    if (this.enOr || this.scores[buteur] >= BUTS_POUR_GAGNER) {
      this.phase = PHASE_FINI
      return 'fini'
    }
    this.phase = PHASE_BUT
    this.pause = PAUSE_BUT
    return 'but'
  }

  /** L'état du jeu, tel qu'il part dans la trame. */
  etat(sim: FluidSimMulti): JeuTrame {
    const p = sim.palet
    return {
      // pendant le décompte il est posé, donc visible, sans être en jeu
      paletActif: p.actif || this.phase === PHASE_DECOMPTE,
      paletX: p.x,
      paletY: p.y,
      paletVx: p.vx,
      paletVy: p.vy,
      tenuPar: this.tenuPar,
      charge: this.tenuPar >= 0 ? Math.min(1, this.tenuDepuis / CHARGE_PLEINE) : 0,
      scores: [this.scores[0], this.scores[1]],
      phase: this.phase,
      buteur: this.buteur,
      chrono: this.chrono,
      decompte: this.phase === PHASE_DECOMPTE ? this.decompte : 0,
      enOr: this.enOr,
    }
  }
}
