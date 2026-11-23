// LE ROBOT — un adversaire piloté par la machine.
//
// Un jeu à deux où il faut être deux pour jouer ne se lance jamais : on
// l'essaie seul d'abord. Le robot tient la place de l'autre — au hockey, au
// sumo — et sert aussi de partenaire d'entraînement.
//
// Il joue avec les MÊMES commandes qu'un joueur (pousser, s'ouvrir, dasher,
// viser), posées chez l'hôte comme celles d'une manette : il ne triche pas,
// il ne lit de la partie que ce qu'on en voit à l'écran — les corps, le
// palet, l'anneau. Il réfléchit à cadence humaine (huit fois par seconde) et
// vise avec un peu d'erreur ; ce sont ces deux réglages qui feront plus tard
// ses niveaux de difficulté.
//
// À QUATRE (le 2 contre 2), il joue en équipe avec un humain ou un autre
// robot : il ne dispute pas le palet à son équipier, se replie devant sa
// cage quand l'autre équipe attaque, se démarque quand la sienne a le
// palet, et PASSE quand on vient le lui prendre. Au duel, tout cela se tait :
// il n'a pas d'équipier, et il joue comme avant.

import { DEMI_OUVERTURE, PATINOIRE_DUEL, equipe } from './hockey'
import type { Hote } from './partie'
import { MODE_HOCKEY, MODE_SUMO, PHASE_JEU, type Commande } from './trame'

/** Le temps entre deux décisions (s). */
const REFLEXION = 0.12
/** La distance à laquelle il pose sa visée, depuis le cœur de son corps :
 *  au-delà du corps, sinon pousser rassemblerait (voir manetteMulti.ts). */
const PORTEE = 320
/** Sa vitesse de croisière, et celle qu'il s'autorise par unité de distance
 *  au but : il ralentit en arrivant au lieu de dépasser. */
const ALLURE = 330
const FREIN = 2.4
/** Sous cet écart entre la vitesse voulue et la sienne, il ne pousse pas
 *  (il économise sa matière). */
const TOLERANCE = 28
/** L'erreur de visée d'un tir, en radians (± la moitié). */
const ERREUR_TIR = 0.16
/** LA FRAPPE DE GLACE : jusqu'où il la tente (u), l'alignement qu'il exige
 *  entre lui, le palet et la cage (un cosinus), et le temps qu'il tient sa
 *  glace (s) — un dash couvre ~350 u dans ce temps. */
const FRAPPE_PORTEE = 360
/** …et à quelle distance de la cage adverse, au plus, le palet doit être. */
const FRAPPE_ZONE = 900
const FRAPPE_ALIGNE = 0.92
const FRAPPE_DUREE = 0.8
// LE JEU D'ÉQUIPE (le 2 contre 2). Un robot qui n'a pas le palet ne fonce
// pas dessus si un équipier en est plus près — deux corps sur le même palet,
// c'est une cage vide derrière eux. Le plus près y va, l'autre se place.
/** LA PASSE : le porteur menacé (un adversaire fermé à moins de cette
 *  distance) cherche un équipier plus dégagé que lui… */
const PASSE_MENACE = 380
/** …d'au moins cette marge (son adversaire le plus proche est plus loin
 *  que le mien de cela, en u)… */
const PASSE_MARGE = 220
/** …et la lâche à cette charge : une passe part moins fort qu'un tir
 *  (500 + 1 000 × 0,3 = 800 u/s), pour être prise et non renvoyée. */
const PASSE_CHARGE = 0.3
/** LE REPLI : le défenseur se tient sur la ligne entre sa cage et la
 *  menace, à cette part du chemin depuis sa cage. */
const REPLI = 0.3
/** …et, s'il en est à plus de cette distance (u), il y file au DASH : sans
 *  lui un corps de 500 ne recule que d'une centaine d'unités en une seconde
 *  (mesuré : 99 u en 1,2 s) — il arrivait devant sa cage après le tir. */
const REPLI_DASH = 450
/** LES RÔLES TIENNENT : on garde le sien (aller au palet ou au porteur, ou
 *  se placer) tant que l'équipier n'est pas plus près que soi d'au moins
 *  cela (u). Sans cette marge, le défenseur qui reculait au dash passait
 *  plus près du porteur que le presseur — et les deux échangeaient leurs
 *  rôles à chaque réflexion, sans plus rien faire ni l'un ni l'autre. */
const MARGE_ROLE = 150
/** LE SOUTIEN : l'équipier sans palet se poste à cette distance de la cage
 *  qu'on attaque, de l'autre côté de l'axe que le porteur — un angle de
 *  passe, et un tir tout prêt. */
const SOUTIEN_CAGE = 750
const SOUTIEN_ECART = 300

export class Robot {
  private attente = 0
  /** Le plan en cours : où aller, s'ouvrir ou non, et si la visée est un tir
   *  (alors elle ne se corrige pas de la vitesse du corps). */
  private cibleX = 0
  private cibleY = 0
  private allure = ALLURE
  private ouvert = false
  private tire = false
  private dash = false
  private dashDonne = false
  /** LA FRAPPE DE GLACE : ce qui reste du coup en cours (s). Tant qu'il
   *  dure, le robot tient sa glace et ne change pas de plan. */
  private frappe = 0
  /** SON RÔLE, à quatre : c'est lui qui va au palet libre (ou au porteur
   *  adverse), ou il se place. null : à décider, sans marge. */
  private auPalet: boolean | null = null
  private auPorteur: boolean | null = null

  /** `hasard` rend un nombre dans [0, 1[ (les tests en donnent un fixe). */
  constructor(
    readonly joueur: number,
    private readonly hasard: () => number = Math.random,
  ) {}

  /** La commande du robot pour ce pas. À poser chez l'hôte comme celle d'un
   *  joueur : `hote.commande(robot.joueur, robot.commande(hote, dt))`. */
  commande(h: Hote, dt: number): Commande {
    const moi = h.sim.corps[this.joueur]
    const jeu = h.jeu()
    const cx = moi.stats.centroidX
    const cy = moi.stats.centroidY
    if (!jeu || jeu.phase !== PHASE_JEU || moi.dispersed) {
      this.attente = 0
      this.frappe = 0
      return { pousse: false, ouvert: false, x: cx, y: cy, aller: true, dash: false }
    }
    this.attente -= dt
    if (this.frappe > 0) this.frappe -= dt
    if (this.attente <= 0 && this.frappe <= 0) {
      this.attente = REFLEXION
      this.dash = false
      if (jeu.mode === MODE_HOCKEY) this.penseHockey(h)
      else if (jeu.mode === MODE_SUMO) this.penseSumo(h)
    }
    // ---- aller à la cible : la vitesse qu'il voudrait, moins celle qu'il a
    const dx = this.cibleX - cx
    const dy = this.cibleY - cy
    const d = Math.hypot(dx, dy) || 1
    const voulue = Math.min(this.allure, FREIN * d)
    const ex = (dx / d) * voulue - moi.stats.velX
    const ey = (dy / d) * voulue - moi.stats.velY
    const e = Math.hypot(ex, ey)
    // le dash part sur un APPUI : vrai un pas, puis relâché
    const dash = this.dash && !this.dashDonne
    this.dashDonne = this.dash
    if (this.tire) {
      // il tient le palet : la visée EST le tir, il avance vers elle
      return { pousse: e > TOLERANCE, ouvert: this.ouvert, x: cx + (dx / d) * PORTEE, y: cy + (dy / d) * PORTEE, aller: true, dash }
    }
    // en pleine frappe : il vise droit devant (le dash part vers la cible),
    // sans corriger — un bloc de glace ne se pilote pas
    if (this.frappe > 0) return { pousse: false, ouvert: false, x: cx + (dx / d) * PORTEE, y: cy + (dy / d) * PORTEE, aller: true, dash, glace: true }
    if (e <= TOLERANCE) return { pousse: false, ouvert: this.ouvert, x: cx + (dx / d) * PORTEE, y: cy + (dy / d) * PORTEE, aller: true, dash }
    return { pousse: true, ouvert: this.ouvert, x: cx + (ex / e) * PORTEE, y: cy + (ey / e) * PORTEE, aller: true, dash }
  }

  private va(x: number, y: number, allure = ALLURE): void {
    this.cibleX = x
    this.cibleY = y
    this.allure = allure
  }

  // ---- LE HOCKEY -------------------------------------------------------------
  private penseHockey(h: Hote): void {
    const jeu = h.jeu()!
    const s = h.salle
    const pat = h.hockey?.pat ?? PATINOIRE_DUEL
    const corps = h.sim.corps
    const moi = corps[this.joueur]
    const mon = equipe(this.joueur)
    const mx = moi.stats.centroidX
    const my = moi.stats.centroidY
    const milieuY = (s.minY + s.maxY) / 2
    // la cage qu'il ATTAQUE : celle de l'autre équipe (l'équipe 0 garde à
    // gauche), et celle qu'il DÉFEND
    const cageX = mon === 0 ? s.maxX - pat.ligneBut : s.minX + pat.ligneBut
    const maCageX = mon === 0 ? s.minX + pat.ligneBut : s.maxX - pat.ligneBut
    const versCage = mon === 0 ? 1 : -1
    // les autres, par camp ; un corps dispersé ne compte pas
    const adversaires: number[] = []
    const equipiers: number[] = []
    for (let k = 0; k < corps.length; k++) {
      if (k === this.joueur || corps[k].dispersed) continue
      ;(equipe(k) === mon ? equipiers : adversaires).push(k)
    }
    const dist = (k: number, x: number, y: number): number => Math.hypot(corps[k].stats.centroidX - x, corps[k].stats.centroidY - y)
    /** Parmi `qui`, le plus proche du point (−1 si personne). */
    const plusProche = (qui: readonly number[], x: number, y: number): number => {
      let m = -1
      for (const k of qui) if (m < 0 || dist(k, x, y) < dist(m, x, y)) m = k
      return m
    }
    /** Est-ce à MOI d'y aller, plutôt qu'à un équipier ? (Le rôle d'avant
     *  tient, à MARGE_ROLE près ; sans équipier, c'est toujours moi.) */
    const aMoi = (avant: boolean | null, x: number, y: number): boolean => {
      const moiD = Math.hypot(mx - x, my - y)
      const eux = equipiers.reduce((m, k) => Math.min(m, dist(k, x, y)), Infinity)
      if (avant === null) return moiD <= eux
      return avant ? moiD <= eux + MARGE_ROLE : moiD < eux - MARGE_ROLE
    }
    // l'adversaire le plus proche : au duel, c'est « l'autre »
    const lui = plusProche(adversaires, mx, my)
    const distLui = lui >= 0 ? dist(lui, mx, my) : Infinity
    this.tire = false

    // un rôle ne vaut que dans sa situation : on le redécide en y revenant
    const adverse = jeu.tenuPar >= 0 && equipe(jeu.tenuPar) !== mon
    if (!adverse) this.auPorteur = null
    if (jeu.tenuPar >= 0) this.auPalet = null
    if (jeu.tenuPar === this.joueur) {
      // IL A LE PALET. Menacé, avec un équipier mieux dégagé que lui : il
      // PASSE — une visée sur l'équipier, là où il sera, lâchée tôt.
      const menace = lui >= 0 && distLui < PASSE_MENACE && !corps[lui].ouvert
      if (menace) {
        let cible = -1
        let marge = PASSE_MARGE
        for (const k of equipiers) {
          const e = corps[k].stats
          const libre = adversaires.reduce((m, a) => Math.min(m, dist(a, e.centroidX, e.centroidY)), Infinity)
          if (libre - distLui > marge) {
            cible = k
            marge = libre - distLui
          }
        }
        if (cible >= 0) {
          const e = corps[cible].stats
          const erreur = (this.hasard() - 0.5) * ERREUR_TIR
          const angle = Math.atan2(e.centroidY + e.velY * 0.4 - my, e.centroidX + e.velX * 0.4 - mx) + erreur
          this.va(mx + Math.cos(angle) * 600, my + Math.sin(angle) * 600, 200)
          this.tire = true
          this.ouvert = jeu.charge < PASSE_CHARGE
          return
        }
      }
      // Sinon il TIRE : il vise un coin de la cage, loin du gardien, avance
      // en chargeant, et lâche quand le tir est mûr — ou qu'on vient le lui
      // prendre. (Le gardien : l'adversaire le plus près de sa cage.)
      const gardien = plusProche(adversaires, cageX, milieuY)
      const coin = gardien >= 0 && corps[gardien].stats.centroidY > milieuY ? -1 : 1
      const erreur = (this.hasard() - 0.5) * ERREUR_TIR
      const bx = cageX + versCage * 60 - mx
      const by = milieuY + coin * DEMI_OUVERTURE * 0.5 - my
      const angle = Math.atan2(by, bx) + erreur
      this.va(mx + Math.cos(angle) * 600, my + Math.sin(angle) * 600, 200)
      this.tire = true
      const pres = Math.abs(cageX - mx) < 900 * pat.echelle
      // (lâché tôt si on vient le lui prendre : à 330 u, le seuil du duel)
      const presse = lui >= 0 && distLui < 330 && !corps[lui].ouvert
      this.ouvert = !(jeu.charge >= 0.85 && pres) && !(jeu.charge >= 0.35 && presse) && jeu.charge < 0.98
      return
    }
    if (jeu.tenuPar >= 0 && equipe(jeu.tenuPar) !== mon) {
      // L'AUTRE ÉQUIPE L'A. Le plus proche du porteur de son équipe fonce
      // le lui prendre, fermé, au dash s'il est à portée ; l'autre se replie
      // devant sa cage, OUVERT : un tir qui lui arrive dessus, il le prend.
      const porteur = corps[jeu.tenuPar].stats
      this.auPorteur = aMoi(this.auPorteur, porteur.centroidX, porteur.centroidY)
      if (this.auPorteur) {
        this.ouvert = false
        this.va(porteur.centroidX, porteur.centroidY, 420)
        this.dash = dist(jeu.tenuPar, mx, my) < 420 && h.corps()[this.joueur].dashPret === true
      } else {
        this.replie(h, maCageX, milieuY, porteur.centroidX, porteur.centroidY)
        this.ouvert = true
      }
      return
    }
    if (jeu.tenuPar >= 0) {
      // SON ÉQUIPE L'A : il se démarque — en avant, de l'autre côté de
      // l'axe que le porteur —, fermé : on n'attrape pas le palet de son
      // équipier.
      const porteur = corps[jeu.tenuPar].stats
      const cote = porteur.centroidY > milieuY ? -1 : 1
      this.va(cageX - versCage * SOUTIEN_CAGE * pat.echelle, milieuY + cote * SOUTIEN_ECART * pat.echelle, 380)
      this.ouvert = false
      return
    }
    // LE PALET EST LIBRE : le plus près de son équipe y va ; s'il y a un
    // équipier plus près, lui se place — en repli si le palet est dans sa
    // moitié, en soutien sinon.
    const px = jeu.paletX + jeu.paletVx * 0.3
    const py = jeu.paletY + jeu.paletVy * 0.3
    const dPalet = Math.hypot(jeu.paletX - mx, jeu.paletY - my)
    this.auPalet = aMoi(this.auPalet, px, py)
    if (!this.auPalet) {
      const chezMoi = (jeu.paletX - (s.minX + s.maxX) / 2) * versCage < 0
      if (chezMoi) {
        this.replie(h, maCageX, milieuY, px, py)
        // le palet qui vient vers lui, il le cueille
        this.ouvert = dPalet < 300
      } else {
        const cote = py > milieuY ? -1 : 1
        this.va(cageX - versCage * SOUTIEN_CAGE * pat.echelle, milieuY + cote * SOUTIEN_ECART * pat.echelle, 380)
        this.ouvert = dPalet < 300
      }
      return
    }
    // il y va : là où le palet SERA, et il s'ouvre en arrivant
    // LA FRAPPE DE GLACE : le palet presque posé, à portée de dash, et la
    // cage adverse dans son prolongement — plutôt que de le prendre, de
    // charger et de lancer (le temps de se le faire voler), il se gèle et
    // le percute : le bloc l'envoie d'un coup.
    const etat = h.corps()[this.joueur]
    const allurePalet = Math.hypot(jeu.paletVx, jeu.paletVy)
    // (dans la zone d'attaque seulement : du milieu du terrain le palet
    // arriverait essoufflé — à l'engagement, il le prend comme avant)
    const zone = Math.abs(cageX - jeu.paletX) < FRAPPE_ZONE
    if (zone && etat.dashPret === true && etat.glacePrete === true && allurePalet < 220 && dPalet > 120 && dPalet < FRAPPE_PORTEE) {
      const ux = (jeu.paletX - mx) / dPalet
      const uy = (jeu.paletY - my) / dPalet
      const bx = cageX - jeu.paletX
      const by = milieuY - jeu.paletY
      const b = Math.hypot(bx, by) || 1
      if ((ux * bx + uy * by) / b > FRAPPE_ALIGNE) {
        this.va(jeu.paletX + ux * 400, jeu.paletY + uy * 400, 460)
        this.ouvert = false
        this.dash = true
        this.frappe = FRAPPE_DUREE
        return
      }
    }
    this.va(px, py, 380)
    this.ouvert = dPalet < 300
  }

  /** LE REPLI : sur la ligne qui va de sa cage à la menace, près de sa cage
   *  — au dash s'il en est loin. */
  private replie(h: Hote, cageX: number, cageY: number, x: number, y: number): void {
    this.va(cageX + (x - cageX) * REPLI, cageY + (y - cageY) * REPLI, 400)
    const c = h.sim.corps[this.joueur].stats
    this.dash = Math.hypot(this.cibleX - c.centroidX, this.cibleY - c.centroidY) > REPLI_DASH && h.corps()[this.joueur].dashPret === true
  }

  // ---- LE SUMO ---------------------------------------------------------------
  private penseSumo(h: Hote): void {
    const jeu = h.jeu()!
    const s = h.salle
    const moi = h.sim.corps[this.joueur]
    const lui = h.sim.corps[1 - this.joueur]
    const ox = (s.minX + s.maxX) / 2
    const oy = (s.minY + s.maxY) / 2
    const mx = moi.stats.centroidX - ox
    const my = moi.stats.centroidY - oy
    const lx = lui.stats.centroidX - ox
    const ly = lui.stats.centroidY - oy
    const dMoi = Math.hypot(mx, my)
    const dLui = Math.hypot(lx, ly) || 1
    this.ouvert = false
    this.tire = false
    // trop près du bord : d'abord revenir vers le centre
    if (dMoi > jeu.anneau - 150) {
      this.va(ox, oy, 420)
      return
    }
    // se placer ENTRE le centre et l'autre, puis le pousser vers le dehors
    const ecart = Math.hypot(lx - mx, ly - my) || 1
    const dehorsX = lx / dLui
    const dehorsY = ly / dLui
    const aligne = ((lx - mx) / ecart) * dehorsX + ((ly - my) / ecart) * dehorsY
    if (dMoi < dLui && aligne > 0.35) {
      // bien placé : droit sur lui, et au dash dès qu'il est à portée
      this.va(lui.stats.centroidX + dehorsX * 120, lui.stats.centroidY + dehorsY * 120, 460)
      this.dash = ecart < 380 && aligne > 0.6 && h.corps()[this.joueur].dashPret === true
    } else {
      // mal placé : passer du côté du centre
      this.va(ox + lx * 0.35, oy + ly * 0.35, 380)
    }
  }
}
