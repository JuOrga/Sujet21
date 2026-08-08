// Caméra à zoom automatique (§11) : le corps est cadré à une fraction
// constante de l'écran — grossir se ressent par un dézoom.

import type { SimParams } from '../sim/params'

// Le zoom manuel (molette) peut sortir des bornes du zoom automatique
const MANUAL_MIN_FACTOR = 0.2
const MANUAL_MAX_FACTOR = 5

export class Camera {
  x = 0
  y = 0
  zoom = 1 // pixels CSS par unité monde
  manualZoom: number | null = null // non nul : la molette a pris la main

  // Zoom d'ouverture : au début d'un tableau, la caméra le montre en entier
  // puis plonge vers le corps — le niveau se lit d'un coup d'œil, et le
  // joueur découvre que le zoom existe. Le moindre geste (visée, molette)
  // rend la main immédiatement.
  private introTimer = 0
  private introTotal = 0
  private introHold = 0
  private introX = 0
  private introY = 0
  private introZoom = 1

  startIntro(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    viewportW: number,
    viewportH: number,
    hold = 0.9,
    dive = 1.7,
  ): void {
    this.introX = (bounds.minX + bounds.maxX) * 0.5
    this.introY = (bounds.minY + bounds.maxY) * 0.5
    this.introZoom =
      Math.min(viewportW / (bounds.maxX - bounds.minX), viewportH / (bounds.maxY - bounds.minY)) *
      0.92
    this.introHold = hold
    this.introTotal = hold + dive
    this.introTimer = this.introTotal
    this.manualZoom = null
    this.snapTo(this.introX, this.introY, this.introZoom)
  }

  cancelIntro(): void {
    this.introTimer = 0
  }

  snapTo(x: number, y: number, zoom: number): void {
    this.x = x
    this.y = y
    this.zoom = zoom
  }

  zoomBy(factor: number, p: SimParams): void {
    this.introTimer = 0 // la molette reprend la main sur le zoom d'ouverture
    const base = this.manualZoom ?? this.zoom
    this.manualZoom = Math.min(
      p.cameraMaxZoom * MANUAL_MAX_FACTOR,
      Math.max(p.cameraMinZoom * MANUAL_MIN_FACTOR, base * factor),
    )
  }

  resetAutoZoom(): void {
    this.manualZoom = null
  }

  update(
    dtReal: number,
    targetX: number,
    targetY: number,
    bodyRmsRadius: number,
    viewportW: number,
    viewportH: number,
    p: SimParams,
  ): void {
    // le rayon RMS sous-estime l'étendue visuelle : facteur empirique 1.8
    const apparentDiameter = Math.max(bodyRmsRadius * 1.8 * 2, 24)
    let targetZoom = (p.cameraFraction * Math.min(viewportW, viewportH)) / apparentDiameter
    targetZoom = Math.min(p.cameraMaxZoom, Math.max(p.cameraMinZoom, targetZoom))
    if (this.manualZoom !== null) targetZoom = this.manualZoom

    // Zoom d'ouverture : plan large tenu, puis plongée adoucie vers le corps
    if (this.introTimer > 0) {
      this.introTimer -= dtReal
      const elapsed = this.introTotal - this.introTimer
      const t = Math.min(1, Math.max(0, (elapsed - this.introHold) / (this.introTotal - this.introHold)))
      const e = t * t * (3 - 2 * t)
      this.x = this.introX + (targetX - this.introX) * e
      this.y = this.introY + (targetY - this.introY) * e
      this.zoom = Math.exp(Math.log(this.introZoom) + (Math.log(targetZoom) - Math.log(this.introZoom)) * e)
      return
    }

    const k = 1 - Math.exp(-p.cameraSmoothing * dtReal)
    this.x += (targetX - this.x) * k
    this.y += (targetY - this.y) * k
    this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(targetZoom) - Math.log(this.zoom)) * k)
  }

  screenToWorld(clientX: number, clientY: number, viewportW: number, viewportH: number): { x: number; y: number } {
    return {
      x: this.x + (clientX - viewportW * 0.5) / this.zoom,
      y: this.y - (clientY - viewportH * 0.5) / this.zoom,
    }
  }
}
