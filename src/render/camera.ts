// Caméra à zoom automatique (§11) : le corps est cadré à une fraction
// constante de l'écran — grossir se ressent par un dézoom.

import type { SimParams } from '../sim/params'

export class Camera {
  x = 0
  y = 0
  zoom = 1 // pixels CSS par unité monde

  snapTo(x: number, y: number, zoom: number): void {
    this.x = x
    this.y = y
    this.zoom = zoom
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
