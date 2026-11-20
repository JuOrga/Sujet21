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

import { KIND_PLAYER, type FluidSimMulti } from './solveurMulti'
import { PHASE_BUT, PHASE_DECOMPTE, PHASE_FINI, PHASE_JEU, type Bornes, type Commande, type JeuTrame } from './trame'

/** LE TERRAIN : plus petit que la salle libre (3840 × 2160). Se déplacer
 *  coûte de la matière ; sur un terrain trop long on arrive devant la cage
 *  avec la moitié de son corps. */
export const TERRAIN: Bornes = { minX: 0, minY: 0, maxX: 2880, maxY: 1620 }
/** La hauteur de l'ouverture d'une cage : un tiers de la paroi. */
export const CAGE = 540
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
        return null
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

  /** Les parois et les cages. Le joueur 0 garde la cage de GAUCHE. */
  private parois(p: FluidSimMulti['palet']): Evenement {
    const r = p.rayon
    if (p.y - r < TERRAIN.minY) {
      p.y = TERRAIN.minY + r
      if (p.vy < 0) p.vy = -p.vy * RESTITUTION_PAROI
    } else if (p.y + r > TERRAIN.maxY) {
      p.y = TERRAIN.maxY - r
      if (p.vy > 0) p.vy = -p.vy * RESTITUTION_PAROI
    }
    const milieu = (TERRAIN.minY + TERRAIN.maxY) / 2
    // dans l'axe de la cage : le palet entier passe entre les poteaux
    const dansLAxe = Math.abs(p.y - milieu) < CAGE / 2 - r
    if (p.x - r < TERRAIN.minX) {
      if (dansLAxe) {
        if (p.x < TERRAIN.minX) return this.but(p, 1)
      } else {
        p.x = TERRAIN.minX + r
        if (p.vx < 0) p.vx = -p.vx * RESTITUTION_PAROI
      }
    } else if (p.x + r > TERRAIN.maxX) {
      if (dansLAxe) {
        if (p.x > TERRAIN.maxX) return this.but(p, 0)
      } else {
        p.x = TERRAIN.maxX - r
        if (p.vx > 0) p.vx = -p.vx * RESTITUTION_PAROI
      }
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
