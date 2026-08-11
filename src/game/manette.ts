// La manette — Steam Deck, Xbox, DualSense : l'API Gamepad standard.
//
// Philosophie : la manette pilote LE MÊME pointeur que le doigt. Le stick
// gauche pose un curseur en orbite autour du corps (direction = stick,
// distance = inclinaison — pleine inclinaison = plein dash) ; la gâchette
// droite (ou A) est le doigt posé. Tout le reste du jeu — éjection, dash,
// ligne de visée, coût annoncé — suit sans rien savoir de la manette.
//
// Schéma (disposition standard) :
//   stick gauche   viser (direction + puissance)
//   RT ou A        agir : éjecter (eau) · viser puis relâcher = dash (vapeur)
//   LB             glace (bascule)        RB       vapeur (bascule)
//   X              retour à l'eau
//   stick droit    caméra                 croix ↕  zoom
//   croix ↔        ralenti / accéléré
//   Start          pause                  Select   recommencer
//   A (menus)      valider le bouton principal visible

export const BOUTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  HAUT: 12,
  BAS: 13,
  GAUCHE: 14,
  DROITE: 15,
} as const

const MORT = 0.18 // zone morte radiale des sticks

export class Manette {
  connectee = false
  /** Une entrée récente : la manette a la main, le réticule se montre. */
  active = false
  /** Le « doigt » manette est posé (RT ou A maintenu). */
  agit = false
  /** Direction de visée mémorisée (unitaire, y écran vers le bas) — le
   * stick relâché la garde : la visée ne saute pas à zéro. */
  dirX = 1
  dirY = 0
  /** Inclinaison du stick de visée, 0..1 après zone morte. */
  force = 0
  /** Stick droit (caméra), après zone morte. */
  panX = 0
  panY = 0
  /** Croix ↕ maintenue : zoom continu. */
  zoomAvant = false
  zoomArriere = false

  private fronts = new Set<number>()
  private prec: boolean[] = []
  private derniereVie = -1e9

  /** Dernier signe de vie (s) — comparé au pointeur pour savoir qui a la main. */
  get lastActivity(): number {
    return this.derniereVie
  }

  private pad(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? []
    for (const gp of pads) if (gp?.connected && gp.mapping === 'standard') return gp
    for (const gp of pads) if (gp?.connected) return gp // à défaut, le premier venu
    return null
  }

  /** Front montant du bouton CETTE image (voir BOUTON). */
  edge(i: number): boolean {
    return this.fronts.has(i)
  }

  poll(now: number): void {
    this.fronts.clear()
    const gp = this.pad()
    if (!gp) {
      this.connectee = false
      this.active = false
      this.agit = false
      this.force = 0
      this.panX = 0
      this.panY = 0
      return
    }
    this.connectee = true
    const presse = (i: number): boolean => {
      const b = gp.buttons[i]
      return b ? b.pressed || b.value > 0.5 : false
    }
    for (let i = 0; i < gp.buttons.length; i++) {
      const p = presse(i)
      if (p && !this.prec[i]) this.fronts.add(i)
      if (p) this.derniereVie = now
      this.prec[i] = p
    }
    // stick gauche : direction (mémorisée) + force
    const ax = gp.axes[0] ?? 0
    const ay = gp.axes[1] ?? 0
    const mag = Math.hypot(ax, ay)
    if (mag > MORT) {
      this.force = Math.min(1, (mag - MORT) / (1 - MORT))
      this.dirX = ax / mag
      this.dirY = ay / mag
      this.derniereVie = now
    } else {
      this.force = 0
    }
    // stick droit : caméra
    const rx = gp.axes[2] ?? 0
    const ry = gp.axes[3] ?? 0
    const rmag = Math.hypot(rx, ry)
    if (rmag > MORT) {
      const k = (rmag - MORT) / (1 - MORT) / rmag
      this.panX = rx * k
      this.panY = ry * k
      this.derniereVie = now
    } else {
      this.panX = 0
      this.panY = 0
    }
    this.zoomAvant = presse(BOUTON.HAUT)
    this.zoomArriere = presse(BOUTON.BAS)
    this.agit = presse(BOUTON.RT) || presse(BOUTON.A)
    this.active = now - this.derniereVie < 6
  }

  /** Une secousse brève — le dash, la dernière impulsion. Sans garantie :
   * tous les navigateurs ne vibrent pas, et ce n'est jamais grave. */
  rumble(force: number, dureeMs: number): void {
    const gp = this.pad() as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null
    try {
      void gp?.vibrationActuator?.playEffect?.('dual-rumble', {
        duration: dureeMs,
        strongMagnitude: Math.min(1, force),
        weakMagnitude: Math.min(1, force * 0.6),
      })
    } catch {
      // pas d'actuateur : silence
    }
  }
}
