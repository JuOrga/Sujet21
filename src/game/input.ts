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
  vortexArmed = false // prochain toucher = vortex au lieu d'éjecter
  freezeIntent = false // F (ou ❄) : le corps se change en glace, re-presser dégèle
  gasIntent = false // G (ou 💨) : le corps se change en vapeur, re-presser condense

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
  onZoom: ((factor: number) => void) | null = null
  onPan: ((dxPx: number, dyPx: number) => void) | null = null
  onVortex: ((clientX: number, clientY: number) => void) | null = null
  private warpIndex = 2
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private pinchDist: number | null = null
  private pinchCenter: { x: number; y: number } | null = null
  // Clic droit maintenu : déplacement de caméra ; relâché sans avoir bougé,
  // c'est le vortex (l'outil sandbox garde son geste historique)
  private rightDrag: { id: number; x: number; y: number; moved: number } | null = null

  togglePause(): void {
    this.paused = !this.paused
  }

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
    target.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        // Maintenu : déplacement de caméra ; bref : vortex (au relâchement)
        this.rightDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
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
        this.aimActive = false
        this.pinchDist = this.pinchDistance()
        this.pinchCenter = this.pinchCentroid()
        return
      }
      if (this.vortexArmed) {
        this.vortexArmed = false
        this.onVortex?.(e.clientX, e.clientY)
        return
      }
      this.aimActive = true
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })

    target.addEventListener('pointermove', (e) => {
      if (this.rightDrag && e.pointerId === this.rightDrag.id) {
        const dx = e.clientX - this.rightDrag.x
        const dy = e.clientY - this.rightDrag.y
        this.rightDrag.x = e.clientX
        this.rightDrag.y = e.clientY
        this.rightDrag.moved += Math.abs(dx) + Math.abs(dy)
        if (dx !== 0 || dy !== 0) this.onPan?.(dx, dy)
        return
      }
      const p = this.pointers.get(e.pointerId)
      if (p) {
        p.x = e.clientX
        p.y = e.clientY
      }
      if (this.pinchDist !== null) {
        // Deux doigts : l'écart zoome, le centre déplace la caméra
        const d = this.pinchDistance()
        if (d !== null && this.pinchDist > 1e-3) {
          this.onZoom?.(d / this.pinchDist)
          this.pinchDist = d
        }
        const c = this.pinchCentroid()
        if (c !== null && this.pinchCenter !== null) {
          const dx = c.x - this.pinchCenter.x
          const dy = c.y - this.pinchCenter.y
          if (dx !== 0 || dy !== 0) this.onPan?.(dx, dy)
        }
        this.pinchCenter = c
        return
      }
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })

    const release = (e: PointerEvent) => {
      if (this.rightDrag && e.pointerId === this.rightDrag.id) {
        // Relâché sans avoir (presque) bougé : c'était un clic, donc le vortex
        if (this.rightDrag.moved < 6) this.onVortex?.(e.clientX, e.clientY)
        this.rightDrag = null
        return
      }
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) {
        this.pinchDist = null
        this.pinchCenter = null
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
        this.onZoom?.(Math.pow(1.1, -e.deltaY / 100))
      },
      { passive: false },
    )

    window.addEventListener('keydown', (e) => {
      // Ne pas voler les touches des champs de texte (présets du banc)
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
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
