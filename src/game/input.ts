// Entrées : maintenir le pointeur = éjecter vers ce point (§3.3).
// , et . règlent le time warp par crans ; espace = pause ; R = recommencer.
// Molette : zoom manuel. Clic droit MAINTENU : déplacer la caméra (on
// « attrape » le monde) ; clic droit bref : vortex de regroupement (sandbox).
// Le bouton ⌖ recadre sur le corps (zoom et caméra automatiques).
//
// Tactile : un doigt = éjecter ; deux doigts = pincer pour zoomer ET glisser
// pour déplacer la caméra. Pas de clavier : la barre tactile (main.ts) arme
// le vortex et couvre pause / time warp / recommencer.

export const TIME_WARP_STEPS = [0.25, 0.5, 1, 2, 4]

export class Input {
  aimActive = false
  aimClientX = 0
  aimClientY = 0
  paused = false
  // commandes gelées : la prise en main (onboarding) fige TOUTES les
  // commandes de jeu — clavier ici, manette et pointeurs côté main
  gelees = false
  vortexArmed = false // prochain toucher = vortex au lieu d'éjecter
  freezeIntent = false // F (ou ❄) : le corps se change en glace, re-presser dégèle
  gasIntent = false // G (ou 💨) : le corps se change en vapeur, re-presser condense
  /** La visée en cours a été ANNULÉE (second doigt posé pour pincer) : elle
   *  ne doit rien déclencher en la quittant — ni dash, ni éjection. */
  aimAnnulee = false

  toggleFreeze(): void {
    this.freezeIntent = !this.freezeIntent
    if (this.freezeIntent) this.gasIntent = false // un seul état à la fois
  }

  toggleGas(): void {
    this.gasIntent = !this.gasIntent
    if (this.gasIntent) this.freezeIntent = false
  }
  onReset: (() => void) | null = null
  onTimeWarpChange: ((warp: number) => void) | null = null
  // le zoom porte son ANCRE (centre du pincement, curseur de la molette) :
  // le point du monde sous les doigts doit rester sous les doigts
  onZoom: ((factor: number, clientX: number, clientY: number) => void) | null = null
  onPan: ((dxPx: number, dyPx: number) => void) | null = null
  // fin de glissement, avec l'élan du geste (px/s) : la carte continue
  onPanEnd: ((vxPx: number, vyPx: number) => void) | null = null
  onVortex: ((clientX: number, clientY: number) => void) | null = null
  private warpIndex = 2
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private pinchDist: number | null = null
  private pinchCenter: { x: number; y: number } | null = null
  // Clic droit maintenu : déplacement de caméra ; relâché sans avoir bougé,
  // c'est le vortex (l'outil sandbox garde son geste historique)
  private rightDrag: { id: number; x: number; y: number; moved: number } | null = null
  // élan du glissement en cours (px/s, moyenne mobile) — sert au lancer
  private panVx = 0
  private panVy = 0
  private panLastT = 0

  private lanceElan(): void {
    const age = performance.now() / 1000 - this.panLastT
    // un geste qui s'était arrêté avant le relâcher ne lance rien
    if (age < 0.09 && Math.hypot(this.panVx, this.panVy) > 60) {
      this.onPanEnd?.(this.panVx, this.panVy)
    }
    this.panVx = 0
    this.panVy = 0
  }

  private suitElan(dx: number, dy: number): void {
    const now = performance.now() / 1000
    const dt = now - this.panLastT
    this.panLastT = now
    if (dt <= 0 || dt > 0.1) return // premier point ou geste interrompu
    const a = Math.min(1, dt * 12) // moyenne mobile ~80 ms
    this.panVx += (dx / dt - this.panVx) * a
    this.panVy += (dy / dt - this.panVy) * a
  }

  togglePause(): void {
    this.paused = !this.paused
  }

  /** Doigts (ou souris) réellement posés — la manette s'efface devant eux. */
  get touchCount(): number {
    return this.pointers.size
  }

  /** Dernier signe de vie du pointeur (s) : bouger la souris reprend la
   * main sur la manette immédiatement, sans attendre un clic. */
  lastPointerAt = 0

  /** Dernier survol SOURIS ou stylet (s) — jamais le doigt : un doigt levé
   * ne survole pas, sa dernière position ne doit pas retenir le regard. */
  sourisAt = -1e9

  stepWarp(dir: number): void {
    this.warpIndex = Math.min(TIME_WARP_STEPS.length - 1, Math.max(0, this.warpIndex + dir))
    this.onTimeWarpChange?.(TIME_WARP_STEPS[this.warpIndex])
  }

  private pinchDistance(): number | null {
    if (this.pointers.size < 2) return null
    const [a, b] = [...this.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  private pinchCentroid(): { x: number; y: number } | null {
    if (this.pointers.size < 2) return null
    const [a, b] = [...this.pointers.values()]
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 }
  }

  attach(target: HTMLElement): void {
    const vie = (): void => {
      this.lastPointerAt = performance.now() / 1000
    }
    target.addEventListener('pointermove', vie)
    target.addEventListener('pointerdown', vie)
    // La fiche (ou tout autre écran) a la main : les commandes de jeu se
    // taisent tant que la partie n'est pas au premier plan.
    const enJeu = (): boolean => document.body.classList.contains('playing')
    target.addEventListener('pointerdown', (e) => {
      if (!enJeu() || this.gelees) return
      if (e.button === 2) {
        // Maintenu : déplacement de caméra ; bref : vortex (au relâchement)
        this.rightDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
        this.panVx = 0
        this.panVy = 0
        this.panLastT = performance.now() / 1000
        try {
          target.setPointerCapture(e.pointerId)
        } catch {
          // pointeur déjà disparu (ou événement synthétique) : sans gravité
        }
        return
      }
      if (e.button !== 0) return
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // pointeur déjà disparu (ou événement synthétique) : sans gravité
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (this.pointers.size >= 2) {
        // Deuxième doigt : on passe en pincement/glissement, l'éjection s'arrête
        // — et la visée en cours est ANNULÉE, pas relâchée : sans ce drapeau,
        // poser le second doigt pour dézoomer lâchait le dash de vapeur.
        if (this.aimActive) this.aimAnnulee = true
        this.aimActive = false
        this.pinchDist = this.pinchDistance()
        this.pinchCenter = this.pinchCentroid()
        this.panVx = 0
        this.panVy = 0
        this.panLastT = performance.now() / 1000
        return
      }
      if (this.vortexArmed) {
        this.vortexArmed = false
        this.onVortex?.(e.clientX, e.clientY)
        return
      }
      this.aimActive = true
      this.aimAnnulee = false // une visée neuve : elle pourra conclure
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })

    target.addEventListener('pointermove', (e) => {
      if (this.gelees) return
      if (this.rightDrag && e.pointerId === this.rightDrag.id) {
        const dx = e.clientX - this.rightDrag.x
        const dy = e.clientY - this.rightDrag.y
        this.rightDrag.x = e.clientX
        this.rightDrag.y = e.clientY
        this.rightDrag.moved += Math.abs(dx) + Math.abs(dy)
        if (dx !== 0 || dy !== 0) {
          this.onPan?.(dx, dy)
          this.suitElan(dx, dy)
        }
        return
      }
      const p = this.pointers.get(e.pointerId)
      if (p) {
        p.x = e.clientX
        p.y = e.clientY
      }
      if (this.pinchDist !== null) {
        // Deux doigts : l'écart zoome (ancré au centre du pincement — le
        // monde reste collé aux doigts), le centre déplace la caméra
        const d = this.pinchDistance()
        const c = this.pinchCentroid()
        if (d !== null && c !== null && this.pinchDist > 1e-3) {
          this.onZoom?.(d / this.pinchDist, c.x, c.y)
          this.pinchDist = d
        }
        if (c !== null && this.pinchCenter !== null) {
          const dx = c.x - this.pinchCenter.x
          const dy = c.y - this.pinchCenter.y
          if (dx !== 0 || dy !== 0) {
            this.onPan?.(dx, dy)
            this.suitElan(dx, dy)
          }
        }
        this.pinchCenter = c
        return
      }
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
      if (e.pointerType !== 'touch') this.sourisAt = performance.now() / 1000
    })

    const release = (e: PointerEvent) => {
      if (this.rightDrag && e.pointerId === this.rightDrag.id) {
        // Relâché sans avoir (presque) bougé : c'était un clic, donc le vortex
        if (this.rightDrag.moved < 6) this.onVortex?.(e.clientX, e.clientY)
        else this.lanceElan()
        this.rightDrag = null
        return
      }
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2 && this.pinchDist !== null) {
        this.pinchDist = null
        this.pinchCenter = null
        this.lanceElan() // les doigts partent en mouvement : la carte suit l'élan
      }
      this.aimActive = false
    }
    target.addEventListener('pointerup', release)
    target.addEventListener('pointercancel', release)
    target.addEventListener('contextmenu', (e) => e.preventDefault())

    target.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        // ancré au curseur : on zoome VERS ce qu'on regarde. Delta normalisé
        // (lignes/pages → pixels) et borné : Firefox en mode « lignes »
        // envoyait ±3 — un zoom quasi immobile ; les molettes libres, des
        // rafales géantes — un zoom qui saute.
        const brut = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1)
        const pas = Math.max(-3, Math.min(3, brut / 100))
        if (pas !== 0) this.onZoom?.(Math.pow(1.1, -pas), e.clientX, e.clientY)
      },
      { passive: false },
    )

    window.addEventListener('keydown', (e) => {
      // Ne pas voler les touches des champs de texte (présets du banc),
      // ni agir quand la partie n'est pas au premier plan (fiche ouverte)
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (!enJeu()) return
      // commandes gelées (prise en main à l'écran) : aucune touche de jeu
      // ne passe — le voile bloque les pointeurs, ceci bloque le clavier
      if (this.gelees) return
      if (e.key === ' ') {
        this.togglePause()
        e.preventDefault()
      } else if (e.key === 'r' || e.key === 'R') {
        this.onReset?.()
      } else if (e.key === ',' || e.key === '<') {
        this.stepWarp(-1)
      } else if (e.key === '.' || e.key === '>') {
        this.stepWarp(1)
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFreeze()
      } else if (e.key === 'g' || e.key === 'G') {
        this.toggleGas()
      }
    })
  }
}
