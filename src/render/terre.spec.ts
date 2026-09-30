// LA TERRE VUE DE L'ISS : ce qui doit être VRAI, même si la phase de
// l'orbite est arbitraire — le Soleil de l'instant, les latitudes survolées,
// la période, et le cadre : le sol devant, l'horizon en haut, le noir
// au-dessus.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  RAYON_TERRE_KM,
  TERRE_DEFAUTS,
  cadreTerre,
  latLon,
  lumiereStation,
  lune,
  periodeS,
  pointLagrange,
  rayonPixel,
  soleil,
  station,
  type ReglagesTerre,
} from './terre'

const ISS: ReglagesTerre = { ...TERRE_DEFAUTS, vue: 'iss' }

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

describe('terre — le cadre depuis l’ISS : le sol devant, l’horizon en haut', () => {
  const W = 1280
  const H = 800
  const c = new Float32Array(16)
  const t = Date.UTC(2026, 8, 29, 16, 30)
  cadreTerre(t, 0, 0, W, H, c, ISS)

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
    cadreTerre(t, 0, 0, 390, 844, p, ISS)
    expect(rayonPixel(p, 195, 0)).not.toBeNull()
    expect(rayonPixel(p, 195, 844)).toBeNull()
  })

  it('la dérive avec la caméra sature : la vue ne part jamais', () => {
    const loin = new Float32Array(16)
    cadreTerre(t, 1e9, 1e9, W, H, loin, ISS)
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
    cadreTerre(t, 0, 0, W, H, d, { ...ISS, decalageMin: 46 })
    // une demi-orbite plus tard, la station est presque aux antipodes
    const a = latLon([c[12], c[13], c[14]])
    const b = latLon([d[12], d[13], d[14]])
    expect(Math.abs(a.lat + b.lat)).toBeLessThan(3)
  })
})

describe('terre — la Lune, qui place L1 Terre–Lune', () => {
  // janvier 2024 : nouvelle Lune le 11 à 11 h 57 UTC, pleine Lune le 25 à
  // 17 h 54 UTC (éphémérides publiées)
  const ecart = (ms: number): number => {
    const a = lune(ms).dir
    const b = soleil(ms)
    return (Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 180) / Math.PI
  }

  it('à la nouvelle Lune, elle est du côté du Soleil ; à la pleine, à l’opposé', () => {
    expect(ecart(Date.UTC(2024, 0, 11, 12))).toBeLessThan(8)
    expect(ecart(Date.UTC(2024, 0, 25, 18))).toBeGreaterThan(172)
  })

  it('reste entre le périgée et l’apogée', () => {
    for (let j = 0; j < 60; j++) {
      const km = lune(Date.UTC(2026, 8, 1) + j * 86400000).km
      expect(km).toBeGreaterThan(355000)
      expect(km).toBeLessThan(407500)
    }
  })
})

describe('terre — vue d’un point de Lagrange : un disque entier, nord en haut', () => {
  const W = 1280
  const H = 800
  const r: ReglagesTerre = { ...TERRE_DEFAUTS, vue: 'l1-lune' }

  it('L1 Terre–Lune est à ~323 000 km ; L1 Soleil–Terre à 1,5 million', () => {
    const t = Date.UTC(2026, 8, 29, 12)
    expect(Math.hypot(...pointLagrange(t, 'l1-lune')) * RAYON_TERRE_KM).toBeGreaterThan(298000)
    expect(Math.hypot(...pointLagrange(t, 'l1-lune')) * RAYON_TERRE_KM).toBeLessThan(343000)
    expect(Math.hypot(...pointLagrange(t, 'l1-soleil')) * RAYON_TERRE_KM).toBeCloseTo(1.5e6, -3)
  })

  for (const vue of ['l1-lune', 'l1-soleil'] as const) {
    it(`${vue} : le disque a le rayon voulu, à l’endroit voulu`, () => {
      const c = cadreTerre(Date.UTC(2026, 8, 29, 12), 0, 0, W, H, new Float32Array(16), { ...r, vue })
      const cx = W * r.centreX
      const cy = H * r.centreY
      const rayon = r.disque * H
      expect(rayonPixel(c, cx, cy)).not.toBeNull()
      // le bord, au pixel près
      expect(rayonPixel(c, cx + rayon - 2, cy)).not.toBeNull()
      expect(rayonPixel(c, cx + rayon + 2, cy)).toBeNull()
      expect(rayonPixel(c, cx, cy + rayon + 2)).toBeNull()
      // le nord en haut
      expect(latLon(rayonPixel(c, cx, cy + rayon * 0.8)!).lat).toBeGreaterThan(
        latLon(rayonPixel(c, cx, cy - rayon * 0.8)!).lat,
      )
    })
  }

  it('L1 Terre–Lune : pleine Terre à la nouvelle Lune, Terre de nuit à la pleine Lune', () => {
    const eclaire = (ms: number): number => {
      const c = cadreTerre(ms, 0, 0, W, H, new Float32Array(16), r)
      const p = rayonPixel(c, W * r.centreX, H * r.centreY)!
      const n = Math.hypot(...p)
      return (p[0] * c[3] + p[1] * c[7] + p[2] * c[11]) / n
    }
    expect(eclaire(Date.UTC(2024, 0, 11, 12))).toBeGreaterThan(0.95)
    expect(eclaire(Date.UTC(2024, 0, 25, 18))).toBeLessThan(-0.95)
  })

  it('L1 Soleil–Terre : la Terre toujours pleine, de face au jour (la vue d’EPIC)', () => {
    for (const ms of [Date.UTC(2026, 2, 1), Date.UTC(2026, 6, 14, 5), Date.UTC(2026, 11, 3, 20)]) {
      const c = cadreTerre(ms, 0, 0, W, H, new Float32Array(16), { ...r, vue: 'l1-soleil' })
      const p = rayonPixel(c, W * r.centreX, H * r.centreY)!
      expect((p[0] * c[3] + p[1] * c[7] + p[2] * c[11]) / Math.hypot(...p)).toBeGreaterThan(0.99)
    }
  })
})

// LE CIEL DERRIÈRE LA TERRE. Les étoiles sont infiniment plus loin que la
// Terre : quand la caméra se déplace ou zoome, elles doivent bouger MOINS
// qu'elle — donc pas du tout. Les premières étoiles de ce mode étaient
// indexées par `world` : collées au plan de jeu, elles défilaient à la
// vitesse de la station et grossissaient au zoom, pendant que la Terre ne
// bougeait presque pas — la profondeur à l'envers (« ça fait bizarre quand
// on déplace »). Le test lit la branche Terre du shader de composition.
describe('terre — les étoiles sont derrière la Terre, pas collées au jeu', () => {
  const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
  const debut = source.indexOf('if (uCielMode > 2.5) {')
  const fin = source.indexOf('} else if (uCielMode > 1.5) {', debut)
  const branche = source.slice(debut, fin)

  it('la branche Terre existe', () => {
    expect(debut).toBeGreaterThan(0)
    expect(fin).toBeGreaterThan(debut)
  })

  it('aucune couche d’étoiles n’y dépend de la position ni du zoom de la caméra', () => {
    expect(branche).not.toMatch(/\bworld\b/)
    expect(branche).not.toMatch(/\buZoom\b/)
    expect(branche).not.toMatch(/\bspecks\s*\(/)
  })

  it('ses étoiles sont les étoiles nettes, mesurées en pixels de l’écran', () => {
    expect(branche).toMatch(/etoilesCouche\s*\(/)
  })

  it('la Terre cache les étoiles par sa FORME (l’alpha de terre()), pas par sa luminosité', () => {
    // la face de nuit est presque noire : un masque de luminosité seul y
    // laissait passer les étoiles, à travers la planète
    expect(branche).toMatch(/noir\s*=\s*\(1\.0\s*-\s*planete\.a\)/)
  })
})

describe('terre — la lumière de la scène sur la station', () => {
  const W = 1280
  const H = 800
  const lumiere = (ms: number, r: ReglagesTerre) => {
    const c = cadreTerre(ms, 0, 0, W, H, new Float32Array(16), r)
    return lumiereStation(c, W, H, new Float32Array(8), r)
  }
  const L1 = { ...TERRE_DEFAUTS, vue: 'l1-lune' as const }

  it('L1 Terre–Lune, nouvelle Lune : Soleil de face, Terre pleine et lumineuse', () => {
    const l = lumiere(Date.UTC(2024, 0, 11, 12), L1)
    expect(l[2]).toBeGreaterThan(0.9)
    expect(l[6]).toBeGreaterThan(0.65)
    expect(l[3]).toBe(1)
  })

  it('L1 Terre–Lune, pleine Lune : la station à contre-jour, la Terre éteinte', () => {
    const l = lumiere(Date.UTC(2024, 0, 25, 18), L1)
    expect(l[2]).toBeLessThan(-0.9)
    expect(l[6]).toBeLessThan(0.02)
  })

  it('la part du Soleil dans le plan de l’écran complète celle de face', () => {
    for (const ms of [Date.UTC(2026, 2, 1), Date.UTC(2026, 8, 30, 12), Date.UTC(2026, 10, 7, 3)]) {
      const l = lumiere(ms, L1)
      expect(Math.hypot(l[0], l[1], l[2])).toBeCloseTo(1, 5)
    }
  })

  it('la Terre est du côté de son disque à l’écran (L1 : à droite, un peu en haut)', () => {
    const l = lumiere(Date.UTC(2026, 8, 30, 12), L1)
    const attendu = [L1.centreX - 0.5, L1.centreY - 0.5].map((v, i) => v * (i ? H : W))
    const n = Math.hypot(attendu[0], attendu[1])
    expect(l[4]).toBeCloseTo(attendu[0] / n, 4)
    expect(l[5]).toBeCloseTo(attendu[1] / n, 4)
  })

  it('depuis l’ISS, la Terre est EN DESSOUS, et sa lueur est pleine de jour', () => {
    const iss = { ...TERRE_DEFAUTS, vue: 'iss' as const }
    let jour = 0
    for (let m = 0; m < 93; m += 3) {
      const l = lumiere(Date.UTC(2026, 8, 30, 12) + m * 60000, iss)
      expect(l[5]).toBeLessThan(-0.99)
      jour = Math.max(jour, l[6])
    }
    expect(jour).toBeGreaterThan(0.95)
  })
})

describe('terre — la lumière de scène ne change rien hors du ciel TERRE', () => {
  const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
  const glsl = source.slice(source.indexOf('const LUMIERE_SCENE_GLSL'), source.indexOf('const COMPOSE_FS'))

  it('inactive, la face garde son facteur 1 et l’arête ne reçoit rien', () => {
    expect(glsl).toMatch(/uLumSoleil\.w > 0\.5 \? [^:]+: 1\.0;/)
    expect(glsl).toMatch(/if \(uLumSoleil\.w < 0\.5\) return vec3\(0\.0\);/)
  })

  it('la composition et la passe de coque la reçoivent toutes deux', () => {
    for (const nom of ['COMPOSE_FS', 'HULL_FS']) {
      const debut = source.indexOf(`const ${nom} = \``)
      const fin = source.indexOf('\n`', debut)
      expect(source.slice(debut, fin)).toContain('${LUMIERE_SCENE_GLSL}')
    }
  })

  it('les pièces dessinées prennent le soleil de la Terre, le soleil fixe n’est que le repli', () => {
    expect(source).toMatch(/uLumSoleil\.w > 0\.5[^;]*\? normalize\(uLumSoleil\.xy\) : vec2\(-0\.6, 0\.8\)/)
    expect(source).not.toMatch(/ca \* -0\.6 \+ sa \* 0\.8/)
  })
})
