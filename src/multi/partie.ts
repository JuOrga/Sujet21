// LA PARTIE À DEUX — l'hôte qui simule, le miroir qui affiche.
//
// Ce module ne connaît ni le réseau ni l'écran : l'HÔTE reçoit des
// commandes et rend des trames, le MIROIR reçoit des trames et rend des
// particules. C'est ce qui permet de jouer toute une partie en test, d'un
// bout à l'autre, sans navigateur — et à l'écran de brancher dessous
// n'importe quel tuyau.

import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import type { NoyauxWasm } from '../sim/wasm'
import { FixedLoop } from '../game/loop'
import { FluidSimMulti, KIND_PLAYER, SANS_PROPRIO } from './solveurMulti'
import {
  attributs,
  decodeParticules,
  encodeEtat,
  litEnteteEtat,
  particulesVides,
  type Bornes,
  type Commande,
  type CorpsTrame,
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
/** La cadence d'envoi de l'état, en images par seconde. Le solveur tourne
 *  à 120 pas par seconde ; l'invité prolonge chaque image avec les vitesses
 *  jusqu'à la suivante. */
export const CADENCE_ETAT = 30
/** La cadence quand la partie passe par le RELAIS : moitié moins. Le relais
 *  est un service public et gratuit — on y fait passer 165 Ko/s au lieu de
 *  330, et l'invité prolonge chaque image deux fois plus longtemps. */
export const CADENCE_RELAIS = 15

export class Hote {
  sim: FluidSimMulti
  readonly params: SimParams
  /** La dernière commande connue de chaque joueur. */
  readonly commandes: Commande[]
  /** Le temps simulé depuis le début de la manche (s). */
  tSim = 0
  private readonly joueurs: number
  private readonly boucle = new FixedLoop()
  private seq = 0
  private noyaux: NoyauxWasm | null = null
  private readonly tampon = particulesVides(CAPACITE)

  constructor(joueurs = 2, params: SimParams = { ...DEFAULT_PARAMS }) {
    this.joueurs = joueurs
    this.params = params
    this.commandes = []
    for (let j = 0; j < joueurs; j++) this.commandes.push({ pousse: false, x: 0, y: 0 })
    this.sim = this.naissance()
  }

  private naissance(): FluidSimMulti {
    const sim = new FluidSimMulti(this.params, SALLE, CAPACITE, this.joueurs)
    for (let j = 0; j < this.joueurs; j++) {
      sim.courant = j
      const d = DEPARTS[j % DEPARTS.length]
      sim.spawnDisc(d.x, d.y, VOLUME_DEPART, KIND_PLAYER)
    }
    sim.courant = 0
    sim.relabel()
    sim.noyauxWasm = this.noyaux
    sim.moteurWasm = this.noyaux !== null
    return sim
  }

  /** Branche les noyaux compilés (plus rapides) ; sans eux, le moteur JS. */
  poseNoyaux(n: NoyauxWasm | null): void {
    this.noyaux = n
    this.sim.noyauxWasm = n
    this.sim.moteurWasm = n !== null
  }

  /** Une manche neuve : les deux corps reviennent à leur départ. */
  recommence(): void {
    this.sim = this.naissance()
    this.tSim = 0
    this.boucle.reset()
    for (const c of this.commandes) c.pousse = false
  }

  /** Pose la commande d'un joueur. La visée est ramenée dans la salle : ce
   *  qui vient du réseau n'a pas à sortir le point de visée du monde. */
  commande(j: number, c: Commande): void {
    const cible = this.commandes[j]
    if (!cible) return
    cible.pousse = c.pousse
    cible.x = Math.min(SALLE.maxX, Math.max(SALLE.minX, c.x))
    cible.y = Math.min(SALLE.maxY, Math.max(SALLE.minY, c.y))
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
          if (!c.pousse) continue
          this.sim.courant = j
          this.sim.eject(c.x, c.y, dt)
        }
        this.sim.courant = 0
        this.sim.step(dt)
        this.tSim += dt
      },
      budgetMs,
    )
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
      viseeX: this.commandes[j].x,
      viseeY: this.commandes[j].y,
    }))
  }

  /** L'image courante, en morceaux prêts à partir. */
  image(): Uint8Array[] {
    return encodeEtat(this.seq++, this.tSim, SALLE, this.corps(), this.vue())
  }
}

/** Au-delà de ce délai sans image, l'invité cesse de prolonger le
 *  mouvement : une liaison qui hoquette ne doit pas envoyer les particules
 *  à travers les murs. */
const PROLONGE_MAX_S = 0.12

export class Miroir {
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
    const e = litEnteteEtat(octets, SALLE)
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
    decodeParticules(octets, e, SALLE, this.enCours)
    this.recuEnCours += e.nombre
    this.corpsEnCours = e.corps
    this.tSimEnCours = e.tSim
    if (this.recuEnCours < e.total) return false
    // complète : elle devient l'image affichée, l'ancienne sert de brouillon
    const ancienne = this.affichee
    this.affichee = this.enCours
    this.enCours = ancienne
    this.corps = this.corpsEnCours
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

  /** Les particules à dessiner MAINTENANT : la dernière image, prolongée
   *  par ses vitesses du temps écoulé depuis. En apesanteur une goutte en
   *  vol va tout droit : la prolongation est exacte pour elle, et à peine
   *  fausse pour un corps qui dérive. */
  vue(maintenant: number): Particules {
    const a = this.affichee
    const s = this.sortie
    const dt = Math.min(PROLONGE_MAX_S, Math.max(0, this.age(maintenant)))
    const n = this.seq < 0 ? 0 : a.n
    s.n = n
    for (let i = 0; i < n; i++) {
      const x = a.x[i] + a.vx[i] * dt
      const y = a.y[i] + a.vy[i] * dt
      s.x[i] = x < SALLE.minX ? SALLE.minX : x > SALLE.maxX ? SALLE.maxX : x
      s.y[i] = y < SALLE.minY ? SALLE.minY : y > SALLE.maxY ? SALLE.maxY : y
      s.vx[i] = a.vx[i]
      s.vy[i] = a.vy[i]
      s.attr[i] = a.attr[i]
    }
    return s
  }
}
