// Entrées : maintenir le pointeur = éjecter vers ce point (§3.3).
// , et . règlent le time warp par crans ; espace = pause ; R = recommencer.
// Molette : zoom manuel (le banc a un bouton pour revenir en automatique).
// Clic droit : vortex de regroupement au point cliqué.
//
// Tactile : un doigt = éjecter, pincement à deux doigts = zoom. Pas de clic
// droit ni de clavier : la barre tactile (main.ts) arme le vortex (le toucher
// suivant le déclenche) et couvre pause / time warp / recommencer.

export const TIME_WARP_STEPS = [0.25, 0.5, 1, 2, 4]

export class Input {
  aimActive = false
  aimClientX = 0
  aimClientY = 0
  paused = false
  vortexArmed = false // prochain toucher = vortex au lieu d'éjecter
  onReset: (() => void) | null = null
  onTimeWarpChange: ((warp: number) => void) | null = null
  onZoom: ((factor: number) => void) | null = null
  onVortex: ((clientX: number, clientY: number) => void) | null = null
  private warpIndex = 2
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private pinchDist: number | null = null

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

  attach(target: HTMLElement): void {
    target.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        this.onVortex?.(e.clientX, e.clientY)
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
        // Deuxième doigt : on passe en pincement, l'éjection s'arrête
        this.aimActive = false
        this.pinchDist = this.pinchDistance()
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
      const p = this.pointers.get(e.pointerId)
      if (p) {
        p.x = e.clientX
        p.y = e.clientY
      }
      if (this.pinchDist !== null) {
        const d = this.pinchDistance()
        if (d !== null && this.pinchDist > 1e-3) {
          this.onZoom?.(d / this.pinchDist)
          this.pinchDist = d
        }
        return
      }
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })

    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.pinchDist = null
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
      if (e.key === ' ') {
        this.togglePause()
        e.preventDefault()
      } else if (e.key === 'r' || e.key === 'R') {
        this.onReset?.()
      } else if (e.key === ',' || e.key === '<') {
        this.stepWarp(-1)
      } else if (e.key === '.' || e.key === '>') {
        this.stepWarp(1)
      }
    })
  }
}
