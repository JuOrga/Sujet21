// Entrées : maintenir le pointeur = éjecter vers ce point (§3.3).
// , et . règlent le time warp par crans ; espace = pause ; R = recommencer.
// Molette : zoom manuel (le banc a un bouton pour revenir en automatique).
// Clic droit : vortex de regroupement au point cliqué.

export const TIME_WARP_STEPS = [0.25, 0.5, 1, 2, 4]

export class Input {
  aimActive = false
  aimClientX = 0
  aimClientY = 0
  paused = false
  onReset: (() => void) | null = null
  onTimeWarpChange: ((warp: number) => void) | null = null
  onZoom: ((factor: number) => void) | null = null
  onVortex: ((clientX: number, clientY: number) => void) | null = null
  private warpIndex = 2

  attach(target: HTMLElement): void {
    target.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        this.onVortex?.(e.clientX, e.clientY)
        return
      }
      if (e.button !== 0) return
      target.setPointerCapture(e.pointerId)
      this.aimActive = true
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })
    target.addEventListener('contextmenu', (e) => e.preventDefault())
    target.addEventListener('pointermove', (e) => {
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })
    const release = () => {
      this.aimActive = false
    }
    target.addEventListener('pointerup', release)
    target.addEventListener('pointercancel', release)

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
        this.paused = !this.paused
        e.preventDefault()
      } else if (e.key === 'r' || e.key === 'R') {
        this.onReset?.()
      } else if (e.key === ',' || e.key === '<') {
        this.warpIndex = Math.max(0, this.warpIndex - 1)
        this.onTimeWarpChange?.(TIME_WARP_STEPS[this.warpIndex])
      } else if (e.key === '.' || e.key === '>') {
        this.warpIndex = Math.min(TIME_WARP_STEPS.length - 1, this.warpIndex + 1)
        this.onTimeWarpChange?.(TIME_WARP_STEPS[this.warpIndex])
      }
    })
  }
}
