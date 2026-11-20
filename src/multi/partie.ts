// LA PARTIE À DEUX — l'hôte qui simule, le miroir qui affiche.
//
// Ce module ne connaît ni le réseau ni l'écran : l'HÔTE reçoit des
// commandes et rend des trames, le MIROIR reçoit des trames et rend des
// particules. C'est ce qui permet de jouer toute une partie en test, d'un
// bout à l'autre, sans navigateur — et à l'écran de brancher dessous
// n'importe quel tuyau.

import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import { FixedLoop } from '../game/loop'
import { FluidSimMulti, KIND_PLAYER, SANS_PROPRIO } from './solveurMulti'
import { Hockey, TERRAIN } from './hockey'
import {
  MODE_HOCKEY,
  MODE_LIBRE,
  attributs,
  decodeParticules,
  encodeEtat,
  litEnteteEtat,
  modeTrame,
  particulesVides,
  type Bornes,
  type Commande,
  type CorpsTrame,
  type JeuTrame,
  type Particules,
} from './trame'

/** LA SALLE : vide, close, seize neuvièmes. Un corps de 900 particules y
 *  fait ~220 u de large : la salle en fait dix-sept de long et dix de haut
 *  — de quoi se chercher, se fuir et se viser (le concepteur, 19/11 : « assez
 *  grand pour qu'on puisse se déplacer tous les deux »). */
export const SALLE: Bornes = { minX: 0, minY: 0, maxX: 3840, maxY: 2160 }
/** Le corps de départ : celui du jeu (900 particules), pour que le jet, le
 *  recul et la cohésion soient ceux qu'on connaît. */
export const VOLUME_DEPART = 900
export const CAPACITE = 4096
/** Où naît chaque joueur : face à face, à mi-hauteur. */
export const DEPARTS: readonly { x: number; y: number }[] = [
  { x: SALLE.minX + (SALLE.maxX - SALLE.minX) * 0.25, y: (SALLE.minY + SALLE.maxY) / 2 },
  { x: SALLE.minX + (SALLE.maxX - SALLE.minX) * 0.75, y: (SALLE.minY + SALLE.maxY) / 2 },
]
/** La salle d'un mode : le hockey a son terrain, plus court. */
export function salleDe(mode: number): Bornes {
  return mode === MODE_HOCKEY ? TERRAIN : SALLE
}
/** Où naît le joueur j dans une salle : face à face, à mi-hauteur, au quart
 *  et aux trois quarts de la longueur. */
export function departDe(salle: Bornes, j: number): { x: number; y: number } {
  const part = j % 2 === 0 ? 0.25 : 0.75
  return { x: salle.minX + (salle.maxX - salle.minX) * part, y: (salle.minY + salle.maxY) / 2 }
}
/** LE DASH : la vitesse qu'il ajoute d'un coup au corps (u/s) — une longue
 *  poussée en donne ~60 par seconde —, le temps qu'il met à se recharger, et
 *  la durée pendant laquelle on le dit « en cours » (l'éclat, le son). */
export const DASH_VITESSE = 420
export const DASH_REPOS = 2.2
const DASH_VU = 0.25
/** La cadence d'envoi de l'état, en images par seconde. Le solveur tourne
 *  à 120 pas par seconde ; l'invité prolonge chaque image avec les vitesses
 *  jusqu'à la suivante. Vingt, et non plus trente : la partie passe par le
 *  relais (relais.ts), dont le palier gratuit compte chaque octet dans les
 *  deux sens — à 10,9 Ko l'image, vingt par seconde font 218 Ko/s. */
export const CADENCE_ETAT = 20

export class Hote {
  sim: FluidSimMulti
  readonly params: SimParams
  /** La dernière commande connue de chaque joueur. */
  readonly commandes: Commande[]
  /** Le temps simulé depuis le début de la manche (s). */
  tSim = 0
  /** Le mode de la partie, sa salle, et la règle du hockey s'il y a lieu. */
  readonly mode: number
  readonly salle: Bornes
  readonly hockey: Hockey | null
  private readonly joueurs: number
  // LE DASH, par joueur : ce qui reste avant qu'il soit rechargé, s'il vient
  // de partir (pour l'éclat et le son), et si son bouton était déjà tenu.
  private readonly dashRepos: number[] = []
  private readonly dashVu: number[] = []
  private readonly dashTenu: boolean[] = []
  private readonly boucle = new FixedLoop()
  private seq = 0
  private readonly tampon = particulesVides(CAPACITE)

  constructor(joueurs = 2, params: SimParams = { ...DEFAULT_PARAMS }, mode: number = MODE_LIBRE) {
    this.joueurs = joueurs
    this.params = params
    this.mode = mode
    this.salle = salleDe(mode)
    this.hockey = mode === MODE_HOCKEY ? new Hockey() : null
    this.commandes = []
    for (let j = 0; j < joueurs; j++) {
      this.commandes.push({ pousse: false, ouvert: false, x: 0, y: 0 })
      this.dashRepos.push(0)
      this.dashVu.push(0)
      this.dashTenu.push(false)
    }
    this.sim = this.naissance()
  }

  private naissance(): FluidSimMulti {
    const sim = new FluidSimMulti(this.params, this.salle, CAPACITE, this.joueurs)
    for (let j = 0; j < this.joueurs; j++) {
      sim.courant = j
      const d = departDe(this.salle, j)
      sim.spawnDisc(d.x, d.y, VOLUME_DEPART, KIND_PLAYER)
    }
    sim.courant = 0
    sim.relabel()
    this.hockey?.engage(sim)
    return sim
  }

  /** Une manche neuve : les deux corps reviennent à leur départ. */
  recommence(): void {
    this.sim = this.naissance()
    this.hockey?.recommence(this.sim)
    this.tSim = 0
    this.boucle.reset()
    for (const c of this.commandes) {
      c.pousse = false
      c.ouvert = false
      c.aller = false
      c.dash = false
    }
    this.dashRepos.fill(0)
    this.dashVu.fill(0)
  }

  /** Pose la commande d'un joueur. La visée est ramenée dans la salle : ce
   *  qui vient du réseau n'a pas à sortir le point de visée du monde. */
  commande(j: number, c: Commande): void {
    const cible = this.commandes[j]
    if (!cible) return
    cible.pousse = c.pousse
    cible.ouvert = c.ouvert
    cible.aller = c.aller === true
    cible.dash = c.dash === true
    cible.x = Math.min(this.salle.maxX, Math.max(this.salle.minX, c.x))
    cible.y = Math.min(this.salle.maxY, Math.max(this.salle.minY, c.y))
  }

  /** Avance la simulation du temps réel écoulé. Rend le nombre de pas. */
  avance(dtReel: number, budgetMs = 12): number {
    const dt = this.params.dt
    return this.boucle.advance(
      dtReel,
      1,
      dt,
      () => {
        for (let j = 0; j < this.joueurs; j++) {
          const c = this.commandes[j]
          // ouvert ou fermé : c'est le pas qui pose les cloisons
          this.sim.corps[j].ouvert = c.ouvert
          // pendant le décompte de l'engagement, personne ne bouge
          const gele = this.hockey?.gele === true
          this.dash(j, c, dt, gele)
          if (!c.pousse || gele) continue
          this.sim.courant = j
          // Le geste du jeu, tel quel : le pointeur posé SUR son corps le
          // RASSEMBLE là (rien ne part, rien ne se paie) ; ailleurs, il
          // éjecte. À deux c'est le seul remède aux chocs : un corps bousculé
          // s'étale, et ne se reforme pas tout seul.
          if (this.surSonCorps(j, c.x, c.y)) this.sim.rassemble(dt, c.x, c.y)
          else if (c.aller) {
            // la manette dit où ALLER : le jet part à l'opposé, de l'autre
            // côté du cœur du corps
            const s = this.sim.corps[j].stats
            this.sim.eject(2 * s.centroidX - c.x, 2 * s.centroidY - c.y, dt)
          } else this.sim.eject(c.x, c.y, dt)
        }
        this.sim.courant = 0
        this.hockey?.avant(this.sim)
        this.sim.step(dt)
        this.tSim += dt
        // après un but et sa pause : tout le monde retourne à son départ,
        // le palet au centre
        if (this.hockey?.apres(this.sim, this.commandes, dt) === 'engagement') this.sim = this.naissance()
      },
      budgetMs,
    )
  }

  /** LE DASH : une brusque accélération dans le sens où une poussée
   *  enverrait le corps — à l'opposé du pointeur à la souris, du côté du
   *  stick à la manette. C'est l'APPUI qui le déclenche, et il se recharge. */
  private dash(j: number, c: Commande, dt: number, gele: boolean): void {
    if (this.dashRepos[j] > 0) this.dashRepos[j] -= dt
    if (this.dashVu[j] > 0) this.dashVu[j] -= dt
    const appui = c.dash === true && !this.dashTenu[j]
    this.dashTenu[j] = c.dash === true
    const corps = this.sim.corps[j]
    if (!appui || gele || this.dashRepos[j] > 0 || corps.dispersed || corps.playerCount < 12) return
    let dx = c.x - corps.stats.centroidX
    let dy = c.y - corps.stats.centroidY
    if (!c.aller) {
      dx = -dx
      dy = -dy
    }
    const d = Math.hypot(dx, dy)
    if (d < 1) return
    const s = this.sim
    const vx = (dx / d) * DASH_VITESSE
    const vy = (dy / d) * DASH_VITESSE
    for (let i = 0; i < s.count; i++) {
      if (s.kind[i] !== KIND_PLAYER || s.proprio[i] !== j) continue
      s.velX[i] += vx
      s.velY[i] += vy
    }
    this.dashRepos[j] = DASH_REPOS
    this.dashVu[j] = DASH_VU
  }

  /** Le point visé est-il sur le corps de ce joueur ? (La règle du jeu :
   *  main.ts, corpsSousLePointeur — une particule du corps à moins de 1,6
   *  rayon de noyau.) */
  private surSonCorps(j: number, x: number, y: number): boolean {
    const s = this.sim
    const r = this.params.kernelRadius * 1.6
    const r2 = r * r
    for (let i = 0; i < s.count; i++) {
      if (s.kind[i] !== KIND_PLAYER || s.proprio[i] !== j) continue
      const dx = s.posX[i] - x
      const dy = s.posY[i] - y
      if (dx * dx + dy * dy < r2) return true
    }
    return false
  }

  /** Les particules telles que le rendu les lit (l'hôte se regarde en
   *  direct, sans passer par ses propres trames). */
  vue(): Particules {
    const s = this.sim
    const p = this.tampon
    const n = s.count
    p.n = n
    p.x.set(s.posX.subarray(0, n))
    p.y.set(s.posY.subarray(0, n))
    p.vx.set(s.velX.subarray(0, n))
    p.vy.set(s.velY.subarray(0, n))
    for (let i = 0; i < n; i++) {
      p.attr[i] = attributs(
        s.proprio[i] === SANS_PROPRIO ? 4 : s.proprio[i],
        s.kind[i] === KIND_PLAYER,
        s.duCorps[i],
      )
    }
    return p
  }

  corps(): CorpsTrame[] {
    return this.sim.corps.map((c, j) => ({
      compte: c.playerCount,
      prets: c.enPretCount,
      base: c.baseVolume,
      x: c.stats.centroidX,
      y: c.stats.centroidY,
      disperse: c.dispersed,
      pousse: this.commandes[j].pousse && !c.dispersed,
      ouvert: c.ouvert,
      dashPret: this.dashRepos[j] <= 0,
      dash: this.dashVu[j] > 0,
      viseeX: this.commandes[j].x,
      viseeY: this.commandes[j].y,
    }))
  }

  /** L'état du hockey (le palet, le score), ou null en partie libre. */
  jeu(): JeuTrame | null {
    return this.hockey ? this.hockey.etat(this.sim) : null
  }

  /** L'image courante, en morceaux prêts à partir. */
  image(): Uint8Array[] {
    return encodeEtat(this.seq++, this.tSim, this.salle, this.corps(), this.vue(), this.jeu())
  }
}

/** Au-delà de ce délai sans image, l'invité cesse de prolonger le
 *  mouvement : une liaison qui hoquette ne doit pas envoyer les particules
 *  à travers les murs. */
const PROLONGE_MAX_S = 0.12

export class Miroir {
  /** Le mode et la salle : c'est l'hôte qui les annonce, dans chaque image. */
  mode: number = MODE_LIBRE
  salle: Bornes = SALLE
  /** L'état du hockey de la dernière image complète, ou null. */
  private jeuRecu: JeuTrame | null = null
  private jeuEnCours: JeuTrame | null = null
  /** Les corps de la dernière image complète. */
  corps: CorpsTrame[] = []
  /** Le temps simulé de la dernière image complète. */
  tSim = 0
  /** Le numéro de la dernière image complète (−1 : aucune encore). */
  seq = -1
  /** Les images complètes reçues, et celles abandonnées en route. */
  recues = 0
  perdues = 0
  private affichee = particulesVides(CAPACITE)
  private enCours = particulesVides(CAPACITE)
  private seqEnCours = -1
  private recuEnCours = 0
  private corpsEnCours: CorpsTrame[] = []
  private tSimEnCours = 0
  private dateImage = 0
  private readonly sortie = particulesVides(CAPACITE)

  /** Reçoit un morceau. `maintenant` est une horloge en millisecondes
   *  (performance.now). Rend true si une image vient d'être complétée. */
  recoit(octets: Uint8Array, maintenant: number): boolean {
    const mode = modeTrame(octets)
    if (mode < 0) return false
    if (mode !== this.mode) {
      this.mode = mode
      this.salle = salleDe(mode)
    }
    const e = litEnteteEtat(octets, this.salle)
    if (!e) return false
    // en retard : une image plus récente est déjà là, ou en cours
    if (e.seq <= this.seq || e.seq < this.seqEnCours) return false
    if (e.seq > this.seqEnCours) {
      // une image neuve commence : celle qu'on assemblait ne se finira pas
      if (this.seqEnCours >= 0 && this.recuEnCours > 0) this.perdues++
      this.seqEnCours = e.seq
      this.recuEnCours = 0
      this.enCours.n = Math.min(e.total, CAPACITE)
    }
    decodeParticules(octets, e, this.salle, this.enCours)
    this.recuEnCours += e.nombre
    this.corpsEnCours = e.corps
    this.jeuEnCours = e.jeu
    this.tSimEnCours = e.tSim
    if (this.recuEnCours < e.total) return false
    // complète : elle devient l'image affichée, l'ancienne sert de brouillon
    const ancienne = this.affichee
    this.affichee = this.enCours
    this.enCours = ancienne
    this.corps = this.corpsEnCours
    this.jeuRecu = this.jeuEnCours
    this.tSim = this.tSimEnCours
    this.seq = e.seq
    this.seqEnCours = -1
    this.recuEnCours = 0
    this.dateImage = maintenant
    this.recues++
    return true
  }

  /** L'âge de la dernière image, en secondes (Infinity avant la première). */
  age(maintenant: number): number {
    return this.seq < 0 ? Infinity : (maintenant - this.dateImage) / 1000
  }

  /** L'état du hockey à dessiner MAINTENANT : le palet libre est prolongé
   *  par sa vitesse, comme une goutte en vol. */
  jeu(maintenant: number): JeuTrame | null {
    const j = this.jeuRecu
    if (!j) return null
    const dt = Math.min(PROLONGE_MAX_S, Math.max(0, this.age(maintenant)))
    return { ...j, paletX: j.paletX + j.paletVx * dt, paletY: j.paletY + j.paletVy * dt }
  }

  /** Les particules à dessiner MAINTENANT : la dernière image, prolongée
   *  par ses vitesses du temps écoulé depuis. En apesanteur une goutte en
   *  vol va tout droit : la prolongation est exacte pour elle, et à peine
   *  fausse pour un corps qui dérive. */
  vue(maintenant: number): Particules {
    const a = this.affichee
    const s = this.sortie
    const salle = this.salle
    const dt = Math.min(PROLONGE_MAX_S, Math.max(0, this.age(maintenant)))
    const n = this.seq < 0 ? 0 : a.n
    s.n = n
    for (let i = 0; i < n; i++) {
      const x = a.x[i] + a.vx[i] * dt
      const y = a.y[i] + a.vy[i] * dt
      s.x[i] = x < salle.minX ? salle.minX : x > salle.maxX ? salle.maxX : x
      s.y[i] = y < salle.minY ? salle.minY : y > salle.maxY ? salle.maxY : y
      s.vx[i] = a.vx[i]
      s.vy[i] = a.vy[i]
      s.attr[i] = a.attr[i]
    }
    return s
  }
}
