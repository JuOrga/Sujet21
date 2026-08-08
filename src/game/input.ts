// Entrées : maintenir le pointeur = éjecter vers ce point (§3.3).
// , et . règlent le time warp par crans ; espace = pause ; R = recommencer.

export const TIME_WARP_STEPS = [0.25, 0.5, 1, 2, 4]

export class Input {
  aimActive = false
  aimClientX = 0
  aimClientY = 0
  paused = false
  onReset: (() => void) | null = null
  onTimeWarpChange: ((warp: number) => void) | null = null
  private warpIndex = 2

  attach(target: HTMLElement): void {
    target.addEventListener('pointerdown', (e) => {
      target.setPointerCapture(e.pointerId)
      this.aimActive = true
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })
    target.addEventListener('pointermove', (e) => {
      this.aimClientX = e.clientX
      this.aimClientY = e.clientY
    })
    const release = () => {
      this.aimActive = false
    }
    target.addEventListener('pointerup', release)
    target.addEventListener('pointercancel', release)

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
