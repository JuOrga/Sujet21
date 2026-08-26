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
  manualPan = false // vrai : la caméra tient la position choisie au lieu de suivre le corps

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

  // La petite dimension de la SALLE courante (posée par startIntro) : le
  // zoom automatique s'en sert pour ne jamais cadrer trop serré — la vue
  // montre toujours une part du niveau, pas seulement le corps.
  private nivMin = 0

  startIntro(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    viewportW: number,
    viewportH: number,
    hold = 0.9,
    dive = 1.7,
  ): void {
    this.nivMin = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
    this.introX = (bounds.minX + bounds.maxX) * 0.5
    this.introY = (bounds.minY + bounds.maxY) * 0.5
    this.introZoom =
      Math.min(
        viewportW / (bounds.maxX - bounds.minX),
        viewportH / (bounds.maxY - bounds.minY),
      ) * 0.92
    this.introHold = hold
    this.introTotal = hold + dive
    this.introTimer = this.introTotal
    this.manualZoom = null
    this.manualPan = false
    this.snapTo(this.introX, this.introY, this.introZoom)
  }

  // Déplacement manuel (clic droit maintenu, glissement à deux doigts) : on
  // « attrape » le monde — le doigt part à droite, la caméra part à gauche.
  // La caméra tient ensuite la position jusqu'au recadrage (⌖).
  panBy(dxPx: number, dyPx: number): void {
    this.introTimer = 0
    this.manualPan = true
    this.glideVx = 0 // la main posée arrête toute glissade en cours
    this.glideVy = 0
    this.x -= dxPx / this.zoom
    this.y += dyPx / this.zoom // l'axe écran descend, l'axe monde monte
  }

  // Inertie de glissement : les doigts quittent l'écran en mouvement, la
  // carte continue sur son élan et s'amortit — le geste des cartes qu'on a
  // dans la main. Vitesse en px écran/s, amortie exponentiellement.
  private glideVx = 0
  private glideVy = 0
  flingBy(vxPx: number, vyPx: number): void {
    if (!this.manualPan) return // pas de glissade si on n'a pas attrapé la carte
    this.glideVx = vxPx
    this.glideVy = vyPx
  }

  // Zoom ANCRÉ (pincement, molette) : le point du monde sous les doigts
  // reste sous les doigts — manipulation directe, immédiate. C'est la
  // différence entre « zoomer la carte » et « écarter le monde ».
  zoomAt(
    factor: number,
    clientX: number,
    clientY: number,
    viewportW: number,
    viewportH: number,
    p: SimParams,
  ): void {
    this.introTimer = 0
    const avant = this.screenToWorld(clientX, clientY, viewportW, viewportH)
    const base = this.manualZoom ?? this.zoom
    const z = Math.min(
      p.cameraMaxZoom * MANUAL_MAX_FACTOR,
      Math.max(p.cameraMinZoom * MANUAL_MIN_FACTOR, base * factor),
    )
    this.manualZoom = z
    this.zoom = z
    this.manualPan = true // ancrer fige aussi le suivi du corps
    this.x = avant.x - (clientX - viewportW * 0.5) / z
    this.y = avant.y + (clientY - viewportH * 0.5) / z
  }

  cancelIntro(): void {
    this.introTimer = 0
  }

  /** Le plan large d'ouverture joue encore ? (l'éveil attend sa fin) */
  get introEnCours(): boolean {
    return this.introTimer > 0
  }

  snapTo(x: number, y: number, zoom: number): void {
    this.x = x
    this.y = y
    this.zoom = zoom
    this.manualPan = false
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
    this.manualPan = false
    this.glideVx = 0
    this.glideVy = 0
  }

  // Rayon apparent LISSÉ : le rayon RMS saute quand le corps éclate (gerbe,
  // éclaboussure) et le zoom automatique pompait au rythme des éclats. Le
  // cadrage suit une version amortie — la caméra respire, elle ne sursaute pas.
  private radiusSmoothed = 0

  update(
    dtReal: number,
    targetX: number,
    targetY: number,
    bodyRmsRadius: number,
    viewportW: number,
    viewportH: number,
    p: SimParams,
  ): void {
    // le rayon RMS sous-estime l'étendue visuelle : facteur empirique 1.8.
    // Lissé à 3/s : les sauts d'étendue (gerbe de vaporisation, éclats)
    // n'imposent plus leurs à-coups au zoom automatique.
    if (this.radiusSmoothed <= 0) this.radiusSmoothed = bodyRmsRadius
    const kR = 1 - Math.exp(-3 * dtReal)
    this.radiusSmoothed += (bodyRmsRadius - this.radiusSmoothed) * kR
    const apparentDiameter = Math.max(this.radiusSmoothed * 1.8 * 2, 24)
    let targetZoom =
      (p.cameraFraction * Math.min(viewportW, viewportH)) / apparentDiameter
    targetZoom = Math.min(
      p.cameraMaxZoom,
      Math.max(p.cameraMinZoom, targetZoom),
    )
    // Le PLAFOND DU NIVEAU : quel que soit le rayon du corps (il rétrécit
    // au fil de la run et la caméra plongeait avec lui), la vue montre au
    // moins la PETITE DIMENSION ENTIÈRE de la salle — le niveau se lit
    // toujours en entier dans un sens. Borné à 1600 u pour les salles
    // géantes (hub) : le corps y resterait sinon une tête d'épingle.
    if (this.nivMin > 0) {
      const vueMin = Math.min(1600, this.nivMin)
      targetZoom = Math.min(targetZoom, Math.min(viewportW, viewportH) / vueMin)
    }
    if (this.manualZoom !== null) targetZoom = this.manualZoom

    // Zoom d'ouverture : plan large tenu, puis plongée adoucie vers le corps
    if (this.introTimer > 0) {
      this.introTimer -= dtReal
      const elapsed = this.introTotal - this.introTimer
      const t = Math.min(
        1,
        Math.max(
          0,
          (elapsed - this.introHold) / (this.introTotal - this.introHold),
        ),
      )
      const e = t * t * (3 - 2 * t)
      this.x = this.introX + (targetX - this.introX) * e
      this.y = this.introY + (targetY - this.introY) * e
      this.zoom = Math.exp(
        Math.log(this.introZoom) +
          (Math.log(targetZoom) - Math.log(this.introZoom)) * e,
      )
      return
    }

    const k = 1 - Math.exp(-p.cameraSmoothing * dtReal)
    if (!this.manualPan) {
      this.x += (targetX - this.x) * k
      this.y += (targetY - this.y) * k
    } else if (this.glideVx !== 0 || this.glideVy !== 0) {
      // la glissade : l'élan du geste, amorti en ~0,4 s
      this.x -= (this.glideVx * dtReal) / this.zoom
      this.y += (this.glideVy * dtReal) / this.zoom
      const damp = Math.exp(-5 * dtReal)
      this.glideVx *= damp
      this.glideVy *= damp
      if (Math.hypot(this.glideVx, this.glideVy) < 10) {
        this.glideVx = 0
        this.glideVy = 0
      }
    }
    this.zoom = Math.exp(
      Math.log(this.zoom) + (Math.log(targetZoom) - Math.log(this.zoom)) * k,
    )
  }

  screenToWorld(
    clientX: number,
    clientY: number,
    viewportW: number,
    viewportH: number,
  ): { x: number; y: number } {
    return {
      x: this.x + (clientX - viewportW * 0.5) / this.zoom,
      y: this.y - (clientY - viewportH * 0.5) / this.zoom,
    }
  }
}
