// LE CIEL EN CALQUE : deux calculs à graver — le défilement sans fin des
// tuiles d'étoiles, et la pose de la galaxie à l'écran.

import { describe, expect, it } from 'vitest'
import { decalageTuile, rectGalaxie } from './cielCalque'
import { cadrePlaque } from './parallaxe'

describe('ciel en calque — les tuiles d’étoiles', () => {
  it('le décalage reste dans une période, même caméra très loin', () => {
    for (const monde of [-1e9, -12345.6, -1, 0, 0.5, 777, 1e9])
      for (const t of [443.5, 512, 590.5]) {
        const d = decalageTuile(monde, 0.3, 0.06, t)
        expect(d).toBeLessThanOrEqual(0)
        expect(d).toBeGreaterThan(-t)
      }
  })

  it('suit le monde à sa vitesse : un petit pas donne un petit décalage', () => {
    const a = decalageTuile(1000, 0.3, 0.06, 512)
    const b = decalageTuile(1010, 0.3, 0.06, 512)
    // 10 unités × zoom 0,3 × vitesse 0,06 = 0,18 px, vers la gauche
    expect(a - b).toBeCloseTo(0.18, 6)
  })
})

describe('ciel en calque — la galaxie', () => {
  it('le point visé de l’image tombe au centre de l’écran', () => {
    const c = cadrePlaque(800, -300, 0.3, 1280, 720, 2, 1254)
    const r = rectGalaxie(c, 1280, 720)
    // le point (cx, cy) de l'image, y vers le haut, dans le repère écran
    expect(r.x + c.cx * r.largeur).toBeCloseTo(640, 6)
    expect(r.y + (1 - c.cy) * r.largeur).toBeCloseTo(360, 6)
  })
})
