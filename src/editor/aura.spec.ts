import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { contourAura, porteesAura } from './aura'
import { formePhysique } from '../game/conduite'
import { FORME_ARC, formeContact, type FormeContact } from '../game/formes'
import { MAT_CHAUD, MAT_FROID, MAT_HYDROPHILE, MAT_SURCHAUFFEUR, MAT_WALL, type ObstacleBox } from '../game/level'
import { DEFAULT_PARAMS } from '../sim/params'

// L'aura tracée par l'éditeur doit être celle que le solveur mesure :
// l'iso-distance de la FORME PHYSIQUE, depuis le centre des grains — pas le
// rectangle arrondi de la boîte (qui débordait de 5,6 u le long d'une rampe
// de chaudière, bloc de 60 à portée 130, et bien plus aux coins d'une
// chaudière compacte, ronde).
const box = (minX: number, minY: number, maxX: number, maxY: number, material: number, angle = 0): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material,
  ...(angle ? { angle } : {}),
})

const c: FormeContact = { dist: 0, nx: 0, ny: 1 }
const dist = (f: ObstacleBox, x: number, y: number) => {
  formeContact(x, y, f, c)
  return c.dist
}

const CAS: [string, ObstacleBox, number][] = [
  ['chaudière longue', box(0, 0, 600, 60, MAT_CHAUD), 130],
  ['chaudière courte', box(0, 0, 150, 60, MAT_CHAUD), 130],
  ['chaudière compacte (ronde)', box(0, 0, 90, 90, MAT_CHAUD), 130],
  ['chaudière oblique', box(0, 0, 400, 60, MAT_CHAUD, 30), 130],
  ['conduite d’ammoniac', box(0, 0, 500, 50, MAT_FROID), 85],
  // les longues pièces : la méthode par grille y dérivait de 2,3 u (revue)
  ['conduite de 3000', box(0, 0, 3000, 50, MAT_FROID), 85],
  ['chaudière de 3000, portée à froid', box(0, 0, 3000, 60, MAT_CHAUD), 52],
  ['conduite debout', box(0, 0, 50, 500, MAT_FROID), 85],
  ['surchauffeur', box(0, 0, 300, 60, MAT_SURCHAUFFEUR), 60],
]

describe('aura de l’éditeur — l’iso-distance exacte des pièces', () => {
  it.each(CAS)('%s : chaque point tracé est À la portée de la forme', (_n, b, portee) => {
    const f = formePhysique(b)
    const a = contourAura(f, portee)!
    expect(a.morceaux.length).toBeGreaterThan(0)
    let pire = 0
    for (const m of a.morceaux) for (const p of m.points) pire = Math.max(pire, Math.abs(dist(f, p.x, p.y) - portee))
    expect(pire).toBeLessThan(1e-6)
  })

  it.each(CAS)('%s : tout le tour est tracé, sans trou', (_n, b, portee) => {
    // 360 rayons depuis le centre ; sur chacun, le point à la portée
    // (dichotomie) doit avoir un point tracé à moins d'un pas
    const f = formePhysique(b)
    const pts = contourAura(f, portee, 2)!.morceaux.flatMap((m) => m.points)
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    let pire = 0
    for (let k = 0; k < 360; k++) {
      const ux = Math.cos((k * Math.PI) / 180)
      const uy = Math.sin((k * Math.PI) / 180)
      let lo = 0
      let hi = 4000
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2
        if (dist(f, cx + ux * mid, cy + uy * mid) < portee) lo = mid
        else hi = mid
      }
      const x = cx + ux * lo
      const y = cy + uy * lo
      let proche = Infinity
      for (const p of pts) proche = Math.min(proche, Math.hypot(p.x - x, p.y - y))
      pire = Math.max(pire, proche)
    }
    expect(pire).toBeLessThan(2)
  })

  it('le long d’une rampe, l’aura part du carter, pas du bord du bloc', () => {
    // le carter ne remplit que 81 % de l'épaisseur du bloc : entre deux
    // joints (x = 100, loin du joint central et des brides), l'aura
    // s'arrête à la portée comptée depuis le CARTER — 5,6 u avant celle
    // comptée depuis le bord du bloc, où l'ancien tracé la mettait
    const a = contourAura(formePhysique(box(0, 0, 600, 60, MAT_CHAUD)), 130)!
    const haut = Math.max(
      ...a.morceaux
        .flatMap((m) => m.points)
        .filter((p) => Math.abs(p.x - 100) < 2)
        .map((p) => p.y),
    )
    expect(haut).toBeCloseTo(30 + 24.366 + 130, 1)
  })

  it('un arc ouvert n’est jamais refermé : seul le bord entier d’une pièce l’est', () => {
    const a = contourAura(formePhysique(box(0, 0, 600, 60, MAT_CHAUD)), 130)!
    for (const m of a.morceaux) {
      if (!m.ferme) continue
      // un bord entier : ses deux bouts sont voisins
      const p0 = m.points[0]
      const p1 = m.points[m.points.length - 1]
      expect(Math.hypot(p0.x - p1.x, p0.y - p1.y)).toBeLessThan(5)
    }
    // la rampe longue a des pièces qui se recouvrent : des arcs ouverts
    expect(a.morceaux.some((m) => !m.ferme)).toBe(true)
  })

  it('une forme sans pièces (arc, disque…) n’a pas de contour de pièces : l’éditeur garde son tracé', () => {
    const arc = { ...box(0, 0, 300, 200, MAT_HYDROPHILE), forme: FORME_ARC, p0: 0.3, p1: 60 }
    expect(contourAura(formePhysique(arc), 80)).toBeNull()
  })
})

describe('aura de l’éditeur — les portées tracées', () => {
  const P = DEFAULT_PARAMS
  const rp = P.particleSpacing * 0.5

  it('la portée réelle compte le rayon d’un grain, comme le solveur (dist − rayon)', () => {
    const [a] = porteesAura({ material: MAT_HYDROPHILE }, P)
    expect(a.portee).toBeCloseTo(P.hydroBand + rp, 9)
  })

  it('la chaudière : sa propre aura, et sa portée rétrécie à froid', () => {
    const [a, b] = porteesAura({ material: MAT_CHAUD, aura: 1.3 }, P)
    expect(a.portee).toBeCloseTo(P.heatBand * 1.3 + rp, 9)
    expect(b.portee).toBeCloseTo(P.heatBand * 1.3 * (1 - P.chillHeatFade) + rp, 9)
    expect(b.fond).toBe('')
  })

  it('la plaque froide : sa portée étendue à froid complet', () => {
    const [, b] = porteesAura({ material: MAT_FROID }, P)
    expect(b.portee).toBeCloseTo(P.coldBand * (1 + P.chillColdGrowth) + rp, 9)
  })

  it('une paroi n’a pas d’aura', () => {
    expect(porteesAura({ material: MAT_WALL }, P)).toEqual([])
  })
})

// Le branchement dans l'éditeur (le dessin ne tourne pas sous vitest) : on
// lit la SOURCE, comme budgets.spec.ts. Remettre l'ancien tracé autour de
// la boîte fait tomber ces tests.
describe('aura de l’éditeur — le branchement', () => {
  const src = readFileSync(new URL('./editor.ts', import.meta.url), 'utf8')
  const debut = src.indexOf("// Zones d'effet des surfaces")
  const bloc = src.slice(debut, src.indexOf('// LES STRUCTURES DE COQUE', debut))

  it('les formes physiques UNE fois par tracé, pas une par aura', () => {
    expect(bloc).toMatch(/const formes = formesPhysiques\(this\.level\.boxes, this\.level\.bounds\)/)
    expect(bloc).not.toMatch(/formePhysique\(/)
  })

  it('une forme à pièces trace son contour exact ; les portées viennent de porteesAura', () => {
    expect(bloc).toMatch(/for \(const a of porteesAura\(box, P\)\)/)
    expect(bloc).toMatch(/aPieces\(box\) \? this\.contourAuraCache\(/)
    expect(bloc).toMatch(/if \(m\.ferme\) g\.closePath\(\)/)
  })
})
