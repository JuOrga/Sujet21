import { describe, expect, it } from 'vitest'
import { formePhysique } from './conduite'
import {
  CONDUITE,
  CONDUITE_ATLAS,
  FORME_CONDUITE,
  FORME_DISQUE,
  conduiteLongue,
  formeContact,
  jointsConduite,
  piecesConduite,
  type FormeContact,
} from './formes'
import { MAT_FROID, MAT_WALL, type ObstacleBox } from './level'
import { FluidSim } from '../sim/solver'
import { DEFAULT_PARAMS } from '../sim/params'

// La forme PHYSIQUE de la conduite d'ammoniac : ce que la physique et le
// laser lisent doit être ce que l'on voit — le tuyau givré, plus mince que
// le bloc, et ses brides de toute la largeur, aux bouts et aux joints.
const box = (minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material,
})

const out: FormeContact = { dist: 0, nx: 0, ny: 1 }
function contact(b: ObstacleBox, x: number, y: number): FormeContact {
  formeContact(x, y, formePhysique(b), out)
  return { ...out }
}

describe('conduite — forme physique', () => {
  it('une plaque froide rectangulaire prend la forme de conduite, sans toucher la salle', () => {
    const b = box(0, 0, 400, 60, MAT_FROID)
    expect(formePhysique(b).forme).toBe(FORME_CONDUITE)
    expect(b.forme).toBeUndefined()
  })

  it('le reste passe tel quel — la même boîte, sans copie', () => {
    const mur = box(0, 0, 400, 60, MAT_WALL)
    expect(formePhysique(mur)).toBe(mur)
    const disque = { ...box(0, 0, 100, 100, MAT_FROID), forme: FORME_DISQUE }
    expect(formePhysique(disque)).toBe(disque)
  })

  it('une longue conduite : brides aux bouts, joints au pas, à l’écart des bouts', () => {
    expect(conduiteLongue(670, 60)).toBe(true)
    expect(conduiteLongue(100, 100)).toBe(false)
    expect(jointsConduite(100, 100)).toEqual([0]) // un plot : un joint au milieu
    const j = jointsConduite(1200, 60)
    expect(j).toContain(0)
    expect(Math.max(...j) + CONDUITE.jointDemi * 60).toBeLessThanOrEqual(600 - CONDUITE.bout * 60)
    // trois pièces au moins : le tuyau et ses deux brides de bout
    expect(piecesConduite(670, 60).length).toBeGreaterThanOrEqual(3)
  })

  const b = box(0, 0, 670, 60, MAT_FROID) // la porte froide de la chambre froide

  it('entre les brides, le tuyau est plus mince que le bloc : le bord du bloc est DEHORS', () => {
    // à mi-longueur (hors joint), 3 u sous le bord haut du bloc
    const s = 170
    expect(jointsConduite(670, 60).some((x) => Math.abs(x + 335 - s) < CONDUITE.brideJoint * 60)).toBe(false)
    const c = contact(b, s, 57)
    expect(c.dist).toBeGreaterThan(0)
    expect(c.ny).toBeCloseTo(1, 9)
    // et le tuyau lui-même est plein
    expect(contact(b, s, 30).dist).toBeLessThan(0)
    // sa surface est à la demi-épaisseur du tuyau
    expect(contact(b, s, 30 + CONDUITE.tuyau * 60 + 4).dist).toBeCloseTo(4, 9)
  })

  it('la bride de bout, elle, fait toute la largeur du bloc', () => {
    const s = 670 - ((CONDUITE.brideDe + CONDUITE.brideA) / 2) * 60
    expect(contact(b, s, 58).dist).toBeLessThan(0)
    expect(contact(b, s, 63).dist).toBeCloseTo(3, 9)
  })

  it('un bloc debout se lit dans son sens long', () => {
    const debout = box(0, 0, 60, 670, MAT_FROID)
    expect(contact(debout, 57, 170).dist).toBeGreaterThan(0)
    expect(contact(debout, 57, 170).nx).toBeCloseTo(1, 9)
  })

  // La panne vécue : le dessin ne peignait que la conduite, la physique
  // lisait la BOÎTE — l'eau butait sur du sol visible.
  it('le solveur lit la conduite à sa forme', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -500, minY: -500, maxX: 900, maxY: 500 })
    s.setLevel([box(0, 0, 670, 60, MAT_FROID)], [])
    formeContact(170, 57, s.boxes[0], out)
    expect(out.dist).toBeGreaterThan(0)
  })
})

// LES JUMEAUX : le shader reçoit les constantes de CONDUITE telles quelles
// (renderer.ts les interpole) ; l'atlas, lui, est fabriqué par un script
// Python dont les cadres doivent être CEUX que lit le shader.
describe('conduite — les jumeaux', () => {
  it('le shader interpole CONDUITE et CONDUITE_ATLAS, sans copie à la main', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/const float CN_TUYAU = \$\{f\(C\.tuyau\)\};/)
    expect(src).toMatch(/const vec4 CN_CADRE_BOUT = \$\{v4\(A\.bout\)\};/)
    // injecté dans la composition ET dans le cuiseur de lumière
    expect((src.match(/\$\{CONDUITE_GLSL\}/g) ?? []).length).toBe(2)
  })

  it('les cadres de l’atlas sont ceux du script qui le fabrique', async () => {
    const { readFileSync } = await import('node:fs')
    const py = readFileSync(new URL('../../tools/images/conduite_atlas.py', import.meta.url), 'utf8')
    const cadre = (nom: string) =>
      py.match(new RegExp(`CADRE_${nom} = \\((\\d+), (\\d+), (\\d+), (\\d+)\\)`))!.slice(1).map(Number)
    expect(cadre('CORPS')).toEqual(CONDUITE_ATLAS.corps)
    expect(cadre('BOUT')).toEqual(CONDUITE_ATLAS.bout)
    expect(cadre('JOINT')).toEqual(CONDUITE_ATLAS.joint)
    expect(cadre('GIVRE')).toEqual(CONDUITE_ATLAS.givre)
    expect(Number(py.match(/^TAILLE = (\d+)/m)![1])).toBe(CONDUITE_ATLAS.taille)
  })
})
