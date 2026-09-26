import { describe, expect, it } from 'vitest'
import { boutsEnMur, formePhysique, formesPhysiques } from './conduite'
import {
  BOUT_MUR_POS,
  CHAUDIERE,
  CHAUDIERE_ATLAS,
  FORME_CHAUDIERE,
  FORME_DISQUE,
  BOUT_MUR_NEG,
  SENS_VERTICAL,
  finsChaudiere,
  dansForme,
  formeContact,
  jointsChaudiere,
  modeChaudiere,
  piecesChaudiere,
  type FormeContact,
} from './formes'
import { MAT_CHAUD, MAT_WALL, type ObstacleBox } from './level'
import { FluidSim } from '../sim/solver'
import { DEFAULT_PARAMS } from '../sim/params'

// La forme PHYSIQUE de la chaudière : ce que la physique et le laser lisent
// doit être ce que l'on voit — le carter à ailettes, un peu moins large que
// le bloc, le capot, le boîtier et la plaque où plonge son câble.
const box = (minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material,
})

const out: FormeContact = { dist: 0, nx: 0, ny: 1 }
function dist(b: ObstacleBox, x: number, y: number): number {
  formeContact(x, y, formePhysique(b), out)
  return out.dist
}

describe('chaudière — forme physique', () => {
  it('une chaudière rectangulaire prend la forme de chaudière, sans toucher la salle', () => {
    const b = box(0, 0, 400, 120, MAT_CHAUD)
    expect(formePhysique(b).forme).toBe(FORME_CHAUDIERE)
    expect(b.forme).toBeUndefined()
  })

  it('une chaudière à forme la garde : la même boîte, sans copie', () => {
    const disque = { ...box(0, 0, 100, 100, MAT_CHAUD), forme: FORME_DISQUE }
    expect(formePhysique(disque)).toBe(disque)
  })

  it('les chaudières des tableaux (2,5 à 3,3 fois plus longues que larges) sont courtes ou longues, jamais compactes', () => {
    // mesuré le 26/09 dans ops/seed-levels.json : 160×60, 200×80, 400×120
    expect(modeChaudiere(160, 60)).toBe('courte')
    expect(modeChaudiere(200, 80)).toBe('courte')
    expect(modeChaudiere(400, 120)).toBe('longue')
    expect(modeChaudiere(100, 90)).toBe('compacte')
  })

  it('le carter est moins large que le bloc : son bord est DEHORS, son axe dedans', () => {
    const b = box(0, 0, 160, 60, MAT_CHAUD) // courte
    expect(dist(b, 80, 30)).toBeLessThan(0)
    // 2 u sous le bord haut du bloc : le carter (81 %) n'y va pas
    expect(dist(b, 80, 58)).toBeGreaterThan(0)
  })

  it('une longue rampe : boîtier et plaque à l’arrivée, moins larges que le carter', () => {
    const b = box(0, 0, 400, 120, MAT_CHAUD)
    const T = 120
    // au milieu du boîtier, juste au-dessus de sa demi-largeur : dehors
    const sBoitier = 400 - ((CHAUDIERE.boitier[0] + CHAUDIERE.boitier[1]) / 2) * T
    expect(dist(b, sBoitier, 60 + CHAUDIERE.boitier[2] * T - 3)).toBeLessThan(0)
    expect(dist(b, sBoitier, 60 + CHAUDIERE.boitier[2] * T + 3)).toBeGreaterThan(0)
    // le câble, plus mince encore
    const sCable = 400 - ((CHAUDIERE.cable[0] + CHAUDIERE.cable[1]) / 2) * T
    expect(dist(b, sCable, 60 + CHAUDIERE.cable[2] * T + 3)).toBeGreaterThan(0)
  })

  it('UNE seule arrivée de courant : l’autre bout est fermé d’un capot, le carter y va jusqu’au bout', () => {
    // au-dessus de la plaque de sol (0,28 T), sous le bord du carter (0,41 T)
    const b = box(0, 0, 400, 120, MAT_CHAUD)
    const y = 60 + 0.34 * 120
    expect(dist(b, 400 - 0.28 * 120, y)).toBeGreaterThan(0) // l'arrivée : la plaque, plus étroite
    expect(dist(b, 0.28 * 120, y)).toBeLessThan(0) // le capot : le carter plein
  })

  it('un bout dans un mur y prend le courant : l’autre bout garde son capot', () => {
    expect(finsChaudiere(BOUT_MUR_POS)).toEqual({ neg: 1, pos: 0 })
    expect(finsChaudiere(BOUT_MUR_NEG)).toEqual({ neg: 0, pos: 1 })
    expect(finsChaudiere(0)).toEqual({ neg: 1, pos: 2 })
  })

  it('les pièces tiennent dans le bloc, à chaque place', () => {
    for (const [L, T] of [
      [100, 90],
      [60, 50],
      [160, 60],
      [200, 80],
      [400, 120],
      [2000, 100],
    ]) {
      for (const bouts of [0, 1, 2, 3]) {
        for (const [s0, s1, e] of piecesChaudiere(L, T, bouts)) {
          expect(s0).toBeGreaterThanOrEqual(-L / 2 - 1e-9)
          expect(s1).toBeLessThanOrEqual(L / 2 + 1e-9)
          expect(e).toBeLessThanOrEqual(T / 2 + 1e-9)
        }
      }
    }
  })

  it('la compacte est RONDE : le coin du bloc est dehors, le bord du disque dedans', () => {
    const b = box(0, 0, 100, 90, MAT_CHAUD)
    expect(dist(b, 50, 45)).toBeLessThan(0)
    expect(dist(b, 50 + 43, 45)).toBeLessThan(0)
    expect(dist(b, 50 + 42, 45 + 42)).toBeGreaterThan(0) // vers le coin
  })

  it('sous 80 u, le brûleur est carré : le coin est dedans', () => {
    const b = box(0, 0, 60, 50, MAT_CHAUD)
    expect(dist(b, 30 + 23, 25 + 23)).toBeLessThan(0)
  })

  it('le sens imposé change la forme, collision comprise', () => {
    const b = box(0, 0, 200, 80, MAT_CHAUD)
    const debout = { ...b, sens: SENS_VERTICAL }
    // couchée, le milieu du bord haut est hors du carter ; debout (T = 200),
    // la « rampe » fait 80 de long : elle est compacte, un disque de 80
    expect(dansForme(formePhysique(b), 100, 79)).toBe(false)
    expect(modeChaudiere(80, 200)).toBe('compacte')
    expect(dansForme(formePhysique(debout), 100, 40)).toBe(true)
  })

  it('pas de joint sur les rampes des tableaux ; au pas sur une très longue', () => {
    expect(jointsChaudiere(400, 120)).toEqual([])
    expect(jointsChaudiere(2000, 100).length).toBeGreaterThan(1)
  })

  it('le solveur lit la chaudière à sa forme', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -500, minY: -500, maxX: 900, maxY: 500 })
    s.setLevel([box(0, 0, 160, 60, MAT_CHAUD)], [])
    formeContact(80, 58, s.boxes[0], out)
    expect(out.dist).toBeGreaterThan(0)
  })
})

describe('chaudière — les bouts dans le mur', () => {
  it('un bout contre un mur y plonge : la rampe file jusqu’au bord, sans boîtier', () => {
    const b = box(0, 0, 400, 120, MAT_CHAUD)
    const mur = box(400, -100, 460, 300, MAT_WALL)
    expect(boutsEnMur(b, [b, mur], null)).toBe(BOUT_MUR_POS)
    const f = formePhysique(b, [b, mur], null)
    // au ras du mur, sur le bord du carter : plein (le boîtier, lui, aurait
    // laissé du sol visible là)
    formeContact(398, 60 + CHAUDIERE.corps * 120 - 3, f, out)
    expect(out.dist).toBeLessThan(0)
  })

  it('contre une AUTRE chaudière, seul son carter compte', () => {
    const a = box(0, 0, 400, 120, MAT_CHAUD)
    const voisine = box(400, 0, 800, 120, MAT_CHAUD)
    expect(boutsEnMur(a, [a, voisine], null)).toBe(BOUT_MUR_POS)
  })

  it('les formes d’une salle avec une chaudière sont recalculées, pas la liste telle quelle', () => {
    const boxes = [box(0, 0, 400, 120, MAT_CHAUD)]
    expect(formesPhysiques(boxes, null)).not.toBe(boxes)
  })
})

// LES JUMEAUX : le shader reçoit les constantes de CHAUDIERE telles quelles ;
// l'atlas est fabriqué par un script dont les cadres doivent être CEUX que
// lit le shader.
describe('chaudière — les jumeaux', () => {
  it('le shader interpole CHAUDIERE et CHAUDIERE_ATLAS, sans copie à la main', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/const float CH_CORPS = \$\{f\(C\.corps\)\};/)
    expect(src).toMatch(/const vec3 CH_BOITIER = \$\{v3\(C\.boitier\)\};/)
    expect(src).toMatch(/const vec4 CH_CADRE_BOUT = \$\{v4\(A\.bout\)\};/)
    // injecté dans la composition ET dans le cuiseur de lumière
    expect((src.match(/\$\{CHAUDIERE_GLSL\}/g) ?? []).length).toBe(2)
    // et c'est bien l'atlas qu'on charge
    expect(src).toContain("'/assets/chaudiere-atlas.webp'")
  })

  it('les cadres de l’atlas sont ceux du script qui le fabrique', async () => {
    const { readFileSync } = await import('node:fs')
    const py = readFileSync(new URL('../../tools/images/chaudiere_atlas.py', import.meta.url), 'utf8')
    const cadre = (nom: string) =>
      py.match(new RegExp(`CADRE_${nom} = \\((\\d+), (\\d+), (\\d+), (\\d+)\\)`))!.slice(1).map(Number)
    expect(cadre('CORPS')).toEqual(CHAUDIERE_ATLAS.corps)
    expect(cadre('BOUT')).toEqual(CHAUDIERE_ATLAS.bout)
    expect(cadre('JOINT')).toEqual(CHAUDIERE_ATLAS.joint)
    expect(cadre('BRULEUR')).toEqual(CHAUDIERE_ATLAS.bruleur)
    expect(cadre('COMPACTE')).toEqual(CHAUDIERE_ATLAS.compacte)
    expect(cadre('SOL')).toEqual(CHAUDIERE_ATLAS.sol)
    expect(Number(py.match(/^TAILLE = (\d+)/m)![1])).toBe(CHAUDIERE_ATLAS.taille)
  })
})
