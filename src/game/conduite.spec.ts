import { describe, expect, it } from 'vitest'
import { formePhysique } from './conduite'
import { FORME_CONDUITE, FORME_DISQUE, formeContact, type FormeContact } from './formes'
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
  it('une plaque froide rectangulaire prend la forme de conduite, sans toucher la salle', () => {
    const b = box(0, 0, 400, 60, MAT_FROID)
    const p = formePhysique(b)
    expect(p.forme).toBe(FORME_CONDUITE)
    expect(b.forme).toBeUndefined()
  })

  it('le reste passe tel quel — la même boîte, sans copie', () => {
    const mur = box(0, 0, 400, 60, MAT_WALL)
    expect(formePhysique(mur)).toBe(mur)
    const disque = { ...box(0, 0, 100, 100, MAT_FROID), forme: FORME_DISQUE }
    expect(formePhysique(disque)).toBe(disque)
  })

  it('le solveur lit la conduite à sa forme : son coin arrondi ne retient plus l’eau', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -500, minY: -500, maxX: 500, maxY: 500 })
    s.setLevel([box(0, 0, 400, 60, MAT_FROID)], [])
    const out: FormeContact = { dist: 0, nx: 0, ny: 1 }
    formeContact(3, 3, s.boxes[0], out)
    expect(out.dist).toBeGreaterThan(0)
  })
})

// LE JUMEAU GLSL : le shader dessine la conduite et projette son ombre avec
// le même rayon que la physique. Deux copies du calcul vivent dans
// renderer.ts (rayonConduite pour le dessin, le cuiseur d'ombres qui n'y a
// pas accès) : toutes deux doivent porter les constantes de formes.ts.
describe('conduite — le jumeau du shader', () => {
  it('le dessin et l’ombre comptent les voies et arrondissent comme la physique', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')
    const voies = src.match(/clamp\(floor\(T\w* \/ 34\.0 \+ 0\.5\), 1\.0, 4\.0\)/g) ?? []
    // conduiteNH3, rayonConduite, et le cuiseur d'ombres
    expect(voies.length).toBeGreaterThanOrEqual(3)
    const rayons = src.match(/2\.05 \* 0\.45 \* \(T\w* \/ n\w*\)/g) ?? []
    expect(rayons.length).toBe(2)
    expect(src).toMatch(/float rad = lw \* 0\.45;/)
  })
})
