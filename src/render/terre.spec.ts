// LA TERRE VUE DE L'ISS : ce qui doit être VRAI, même si la phase de
// l'orbite est arbitraire — le Soleil de l'instant, les latitudes survolées,
// la période, et le cadre : le sol devant, l'horizon en haut, le noir
// au-dessus.

import { describe, expect, it } from 'vitest'
import {
  RAYON_TERRE_KM,
  TERRE_DEFAUTS,
  cadreTerre,
  latLon,
  periodeS,
  rayonPixel,
  soleil,
  station,
} from './terre'

describe('terre — le Soleil de l’instant', () => {
  it('au solstice de juin, midi sur l’Europe de l’Ouest : sous le tropique du Cancer', () => {
    const { lat, lon } = latLon(soleil(Date.UTC(2026, 5, 21, 12)))
    expect(lat).toBeCloseTo(23.44, 0)
    // midi UTC : près de Greenwich, à l'équation du temps près (±4°)
    expect(Math.abs(lon)).toBeLessThan(4)
  })

  it('au solstice de décembre : sous le tropique du Capricorne', () => {
    expect(latLon(soleil(Date.UTC(2026, 11, 21, 12))).lat).toBeCloseTo(-23.44, 0)
  })

  it('à l’équinoxe : sur l’équateur ; et à 18 h UTC, au-dessus des Amériques', () => {
    const { lat, lon } = latLon(soleil(Date.UTC(2026, 2, 20, 18)))
    expect(Math.abs(lat)).toBeLessThan(0.5)
    expect(lon).toBeGreaterThan(-95)
    expect(lon).toBeLessThan(-85)
  })
})

describe('terre — l’orbite de la station', () => {
  it('fait un tour en ~92,8 minutes, à 420 km', () => {
    expect(periodeS() / 60).toBeGreaterThan(92.5)
    expect(periodeS() / 60).toBeLessThan(93.1)
  })

  it('reste à son altitude et ne sort jamais des ±51,64° de latitude', () => {
    let max = 0
    for (let m = 0; m < 24 * 60; m += 3) {
      const { pos } = station(Date.UTC(2026, 8, 29) + m * 60000)
      expect(Math.hypot(...pos)).toBeCloseTo(1 + 420 / RAYON_TERRE_KM, 6)
      max = Math.max(max, Math.abs(latLon(pos).lat))
    }
    expect(max).toBeLessThanOrEqual(51.64 + 1e-6)
    expect(max).toBeGreaterThan(51)
  })

  it('vole à ~7,2 km/s au-dessus du sol (la vitesse sol vraie de l’ISS)', () => {
    const t = Date.UTC(2026, 8, 29, 10)
    const a = station(t).pos
    const b = station(t + 1000).pos
    const lA = latLon(a)
    const lB = latLon(b)
    // distance sur la sphère, au sol
    const r = (x: number) => (x * Math.PI) / 180
    const c =
      Math.sin(r(lA.lat)) * Math.sin(r(lB.lat)) +
      Math.cos(r(lA.lat)) * Math.cos(r(lB.lat)) * Math.cos(r(lB.lon - lA.lon))
    const km = Math.acos(Math.min(1, c)) * RAYON_TERRE_KM
    expect(km).toBeGreaterThan(6.8)
    expect(km).toBeLessThan(7.6)
  })

  it('la direction du vol est perpendiculaire au rayon (orbite circulaire)', () => {
    const { pos, vol } = station(Date.UTC(2026, 8, 29, 7, 13))
    expect(pos[0] * vol[0] + pos[1] * vol[1] + pos[2] * vol[2]).toBeCloseTo(0, 6)
  })
})

describe('terre — le cadre : le sol devant, l’horizon en haut', () => {
  const W = 1280
  const H = 800
  const c = new Float32Array(16)
  const t = Date.UTC(2026, 8, 29, 16, 30)
  cadreTerre(t, 0, 0, W, H, c)

  it('le centre de l’écran regarde le sol, devant la station', () => {
    const p = rayonPixel(c, W / 2, H / 2)
    expect(p).not.toBeNull()
    const { pos, vol } = station(t)
    // devant : le point visé est du côté du vol
    const d = [p![0] - pos[0], p![1] - pos[1], p![2] - pos[2]]
    expect(d[0] * vol[0] + d[1] * vol[1] + d[2] * vol[2]).toBeGreaterThan(0)
  })

  it('le bas de l’écran est la Terre ; le haut est le noir, au-dessus de l’horizon', () => {
    expect(rayonPixel(c, W / 2, 0)).not.toBeNull()
    expect(rayonPixel(c, W / 2, H)).toBeNull()
    // l'horizon entre 65 % et 90 % de la hauteur, là où on l'a voulu
    let yH = 0
    for (let y = 0; y <= H; y++) if (rayonPixel(c, W / 2, y)) yH = y
    expect(yH / H).toBeGreaterThan(0.65)
    expect(yH / H).toBeLessThan(0.9)
  })

  it('sur un téléphone en portrait aussi, l’horizon reste dans l’écran', () => {
    const p = new Float32Array(16)
    cadreTerre(t, 0, 0, 390, 844, p)
    expect(rayonPixel(p, 195, 0)).not.toBeNull()
    expect(rayonPixel(p, 195, 844)).toBeNull()
  })

  it('la dérive avec la caméra sature : la vue ne part jamais', () => {
    const loin = new Float32Array(16)
    cadreTerre(t, 1e9, 1e9, W, H, loin)
    // même loin, le bas de l'écran est encore la Terre et le haut le noir
    expect(rayonPixel(loin, W / 2, 0)).not.toBeNull()
    expect(rayonPixel(loin, W / 2, H)).toBeNull()
  })

  it('porte le Soleil unitaire et la force dans les quatrièmes composantes', () => {
    expect(Math.hypot(c[3], c[7], c[11])).toBeCloseTo(1, 5)
    expect(c[15]).toBeCloseTo(TERRE_DEFAUTS.force, 6)
  })

  it('le décalage d’horloge déplace la station, pas le cadrage', () => {
    const d = new Float32Array(16)
    cadreTerre(t, 0, 0, W, H, d, { ...TERRE_DEFAUTS, decalageMin: 46 })
    // une demi-orbite plus tard, la station est presque aux antipodes
    const a = latLon([c[12], c[13], c[14]])
    const b = latLon([d[12], d[13], d[14]])
    expect(Math.abs(a.lat + b.lat)).toBeLessThan(3)
  })
})
