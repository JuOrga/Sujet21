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

import { DEMI_OUVERTURE, LIGNE_BUT } from './hockey'
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
      return { pousse: false, ouvert: false, x: cx, y: cy, aller: true, dash: false }
    }
    this.attente -= dt
    if (this.attente <= 0) {
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
    const moi = h.sim.corps[this.joueur]
    const lui = h.sim.corps[1 - this.joueur]
    const mx = moi.stats.centroidX
    const my = moi.stats.centroidY
    const milieuY = (s.minY + s.maxY) / 2
    // la cage qu'il ATTAQUE : celle de l'autre (le joueur 0 garde à gauche)
    const cageX = this.joueur === 0 ? s.maxX - LIGNE_BUT : s.minX + LIGNE_BUT
    const versCage = this.joueur === 0 ? 1 : -1
    const distLui = Math.hypot(lui.stats.centroidX - mx, lui.stats.centroidY - my)
    this.tire = false

    if (jeu.tenuPar === this.joueur) {
      // IL A LE PALET : il vise un coin de la cage, loin du gardien, avance
      // en chargeant, et lâche quand le tir est mûr — ou qu'on vient le lui
      // prendre.
      const coin = lui.stats.centroidY > milieuY ? -1 : 1
      const erreur = (this.hasard() - 0.5) * ERREUR_TIR
      const bx = cageX + versCage * 60 - mx
      const by = milieuY + coin * DEMI_OUVERTURE * 0.5 - my
      const angle = Math.atan2(by, bx) + erreur
      this.va(mx + Math.cos(angle) * 600, my + Math.sin(angle) * 600, 200)
      this.tire = true
      const pres = Math.abs(cageX - mx) < 900
      const menace = distLui < 330 && !lui.ouvert
      this.ouvert = !(jeu.charge >= 0.85 && pres) && !(jeu.charge >= 0.35 && menace) && jeu.charge < 0.98
      return
    }
    if (jeu.tenuPar === 1 - this.joueur) {
      // L'AUTRE L'A : fermé, il fonce le lui prendre, au dash s'il est à portée
      this.ouvert = false
      this.va(lui.stats.centroidX, lui.stats.centroidY, 420)
      this.dash = distLui < 420 && h.corps()[this.joueur].dashPret === true
      return
    }
    // LE PALET EST LIBRE : il va là où le palet SERA, et s'ouvre en arrivant
    const px = jeu.paletX + jeu.paletVx * 0.3
    const py = jeu.paletY + jeu.paletVy * 0.3
    const dPalet = Math.hypot(jeu.paletX - mx, jeu.paletY - my)
    this.va(px, py, 380)
    this.ouvert = dPalet < 300
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
