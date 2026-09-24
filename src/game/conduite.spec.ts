import { describe, expect, it } from 'vitest'
import { formePhysique } from './conduite'
import { FORME_CAPSULE, FORME_DISQUE, formeContact, type FormeContact } from './formes'
import { MAT_FROID, MAT_WALL, type ObstacleBox } from './level'
import { FluidSim } from '../sim/solver'
import { DEFAULT_PARAMS } from '../sim/params'

// La forme PHYSIQUE de la conduite d'ammoniac : ce que la physique et le
// laser lisent doit être la silhouette dessinée, pas la boîte.
const box = (minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material,
})

describe('conduite — forme physique', () => {
  it('une plaque froide rectangulaire prend la forme du tuyau (pilule), sans toucher la salle', () => {
    const b = box(0, 0, 400, 60, MAT_FROID)
    const p = formePhysique(b)
    expect(p.forme).toBe(FORME_CAPSULE)
    expect(b.forme).toBeUndefined()
  })

  it('le reste passe tel quel — la même boîte, sans copie', () => {
    const mur = box(0, 0, 400, 60, MAT_WALL)
    expect(formePhysique(mur)).toBe(mur)
    const disque = { ...box(0, 0, 100, 100, MAT_FROID), forme: FORME_DISQUE }
    expect(formePhysique(disque)).toBe(disque)
  })

  // La panne vécue : le dessin ne peignait que le tuyau, la physique lisait
  // la BOÎTE — l'eau butait dans les coins où l'on ne voyait que le sol.
  it('le solveur lit la conduite à sa forme : ses coins ne retiennent plus l’eau', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -500, minY: -500, maxX: 500, maxY: 500 })
    s.setLevel([box(0, 0, 400, 60, MAT_FROID)], [])
    const out: FormeContact = { dist: 0, nx: 0, ny: 1 }
    // à 3 u du coin, dans la boîte : hors du tuyau
    formeContact(3, 3, s.boxes[0], out)
    expect(out.dist).toBeGreaterThan(0)
    // le flanc du tuyau, lui, est celui de la boîte
    formeContact(200, 65, s.boxes[0], out)
    expect(out.dist).toBeCloseTo(5, 9)
    // la calotte : un demi-cercle de rayon 30 centré à 30 u du bout
    formeContact(400 + 10, 30, s.boxes[0], out)
    expect(out.dist).toBeCloseTo(10, 9)
  })
})

// LE JUMEAU GLSL : le shader dessine le tuyau et projette son ombre à la
// même forme que la physique — une pilule de rayon la demi-épaisseur.
// Deux copies vivent dans renderer.ts (rayonConduite pour le dessin, le
// cuiseur d'ombres qui n'y a pas accès).
describe('conduite — le jumeau du shader', () => {
  it('le dessin et l’ombre arrondissent comme la capsule de la physique', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/float rayonConduite\(vec2 bsize\) \{\s*return 0\.5 \* min\(bsize\.x, bsize\.y\);/)
    expect(src).toMatch(/float r = min\(hb\.x, hb\.y\); \/\/ la pilule/)
    // le tuyau est dessiné à la demi-épaisseur (au liseré près)
    expect(src).toMatch(/float rad = max\(T \* 0\.5 - 0\.75, 1\.0\);/)
  })
})
