import { describe, expect, it } from 'vitest'
import { boutsEnMur, formePhysique } from './conduite'
import {
  BOUT_MUR_NEG,
  BOUT_MUR_POS,
  FORME_SURCHAUFFEUR,
  SURCHAUFFEUR,
  SURCHAUFFEUR_ATLAS,
  finsSurchauffeur,
  formeContact,
  modeSurchauffeur,
  piecesSurchauffeur,
  type FormeContact,
} from './formes'
import { MAT_SURCHAUFFEUR, MAT_WALL, type ObstacleBox } from './level'
import { FluidSim } from '../sim/solver'
import { DEFAULT_PARAMS } from '../sim/params'

// La forme PHYSIQUE du surchauffeur : ce que la vapeur frôle et ce qui
// arrête l'eau doit être ce qu'on voit — le serpentin entre ses rails, un
// peu moins large que le bloc, et ses collecteurs.
const box = (minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material,
})
const out: FormeContact = { dist: 0, nx: 0, ny: 1 }
function dist(b: ObstacleBox, x: number, y: number, boxes: ObstacleBox[] = [], bornes = null): number {
  formeContact(x, y, formePhysique(b, boxes, bornes), out)
  return out.dist
}

describe('surchauffeur — forme physique', () => {
  it('un surchauffeur rectangulaire prend sa forme, sans toucher la salle', () => {
    const b = box(0, 0, 60, 200, MAT_SURCHAUFFEUR)
    expect(formePhysique(b).forme).toBe(FORME_SURCHAUFFEUR)
    expect(b.forme).toBeUndefined()
  })

  it('les surchauffeurs des tableaux, du hub et des figures : longs, courts, jamais en spirale', () => {
    // mesuré le 26/09 : 60×200 (La halte), 140×80 et 140×60 (hub), 70×260 (figures)
    expect(modeSurchauffeur(200, 60)).toBe('longue')
    expect(modeSurchauffeur(140, 80)).toBe('courte')
    expect(modeSurchauffeur(140, 60)).toBe('courte')
    expect(modeSurchauffeur(260, 70)).toBe('longue')
    expect(modeSurchauffeur(100, 90)).toBe('spirale')
  })

  it('le serpentin est moins large que le bloc : son bord est DEHORS, son axe dedans', () => {
    const b = box(0, 0, 60, 200, MAT_SURCHAUFFEUR) // debout
    expect(dist(b, 30, 100)).toBeLessThan(0)
    expect(dist(b, 58, 100)).toBeGreaterThan(0)
  })

  it('le tambour du collecteur, lui, fait toute la largeur', () => {
    const b = box(0, 0, 60, 200, MAT_SURCHAUFFEUR)
    const T = 60
    const s = 200 - ((SURCHAUFFEUR.tambourB[0] + SURCHAUFFEUR.tambourB[1]) / 2) * T
    expect(dist(b, 58, s)).toBeLessThan(0)
  })

  it('une courte : un collecteur au bout positif, une plaque à l’autre ; un mur y fait passer le collecteur', () => {
    expect(finsSurchauffeur(140, 60, 0)).toEqual({ neg: 1, pos: 2 })
    expect(finsSurchauffeur(140, 60, BOUT_MUR_POS)).toEqual({ neg: 2, pos: 0 })
    expect(finsSurchauffeur(200, 60, 0)).toEqual({ neg: 2, pos: 2 })
    expect(finsSurchauffeur(200, 60, BOUT_MUR_NEG)).toEqual({ neg: 0, pos: 2 })
  })

  it('les pièces tiennent dans le bloc, à chaque place', () => {
    for (const [L, T] of [
      [100, 90],
      [140, 80],
      [140, 60],
      [200, 60],
      [260, 70],
      [900, 80],
    ]) {
      for (const bouts of [0, 1, 2, 3]) {
        for (const [s0, s1, e] of piecesSurchauffeur(L, T, bouts)) {
          expect(s0).toBeGreaterThanOrEqual(-L / 2 - 1e-9)
          expect(s1).toBeLessThanOrEqual(L / 2 + 1e-9)
          expect(e).toBeLessThanOrEqual(T / 2 + 1e-9)
        }
      }
    }
  })

  it('la spirale est RONDE : le coin est dehors, le bord du disque dedans', () => {
    const b = box(0, 0, 100, 90, MAT_SURCHAUFFEUR)
    expect(dist(b, 50 + 40, 45)).toBeLessThan(0)
    expect(dist(b, 50 + 42, 45 + 42)).toBeGreaterThan(0)
  })

  it('un bout contre un mur y plonge', () => {
    const b = box(0, 0, 60, 200, MAT_SURCHAUFFEUR)
    const mur = box(-100, 200, 200, 260, MAT_WALL)
    expect(boutsEnMur(b, [b, mur], null)).toBe(BOUT_MUR_POS)
  })

  it('le solveur lit le surchauffeur à sa forme : le frôlement suit le serpentin', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -500, minY: -500, maxX: 900, maxY: 500 })
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    expect(s.boxes[0].forme).toBe(FORME_SURCHAUFFEUR)
    formeContact(58, 100, s.boxes[0], out)
    expect(out.dist).toBeGreaterThan(0)
  })
})

// LE FRÔLEMENT : la vapeur prend le dash à moins de deux espacements de
// particule (13,2 u) du surchauffeur. Il se mesure au RECTANGLE du bloc,
// comme avant le serpentin : mesuré depuis le serpentin (81 % de
// l'épaisseur), il fallait passer 6 u plus près sur un bloc de 60.
describe('surchauffeur — le frôlement garde sa portée', () => {
  const frole = (s: FluidSim, x: number, y: number): number =>
    (s as unknown as { surchauffeurFrole(x: number, y: number): number }).surchauffeurFrole(x, y)
  const salle = { minX: -500, minY: -500, maxX: 900, maxY: 500 }

  it('à 10 u du bord du bloc, le long du serpentin, la vapeur frôle', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    // le serpentin s'arrête à 30 + 0,4028 · 60 ≈ 54 : ce point en est à 16 u
    expect(frole(s, 70, 100)).toBe(0)
  })

  it('au-delà de la portée, non', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    expect(frole(s, 76, 100)).toBe(-1)
  })

  it('la copie de prévision (setLevel sur les formes déjà posées) frôle pareil', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    const c = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    c.setLevel(s.boxes, [])
    expect(frole(c, 70, 100)).toBe(0)
  })
})

describe('surchauffeur — les jumeaux', () => {
  it('le shader interpole SURCHAUFFEUR et SURCHAUFFEUR_ATLAS, et décode la charge', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/const float SU_CORPS = \$\{f\(C\.corps\)\};/)
    expect(src).toMatch(/const vec4 SU_CADRE_BOUT = \$\{v4\(A\.bout\)\};/)
    expect((src.match(/\$\{SURCHAUFFEUR_GLSL\}/g) ?? []).length).toBe(2)
    // aux.z = charge + 2 · (sens + 4 · bouts), côté moteur comme côté shader
    expect(src).toMatch(/this\.chargeLissee\(bx, [^\n]*timeSec\) \+\s*2 \* \(\(bx\.sens \?\? 0\) \+ 4 \* this\.boutsDe/)
    expect(src).toMatch(/float surchCharge\(float z\) \{ return clamp\(z - 2\.0 \* surchCode\(z\), 0\.0, 1\.0\); \}/)
  })

  it('les cadres de l’atlas sont ceux du script qui le fabrique', async () => {
    const { readFileSync } = await import('node:fs')
    const py = readFileSync(new URL('../../tools/images/chaudiere_atlas.py', import.meta.url), 'utf8')
    const cadre = (nom: string) =>
      py.match(new RegExp(`CADRE_${nom} = \\((\\d+), (\\d+), (\\d+), (\\d+)\\)`))!.slice(1).map(Number)
    expect(cadre('S_CORPS')).toEqual(SURCHAUFFEUR_ATLAS.corps)
    expect(cadre('S_BOUT')).toEqual(SURCHAUFFEUR_ATLAS.bout)
    expect(cadre('S_SPIRALE')).toEqual(SURCHAUFFEUR_ATLAS.spirale)
    expect(Number(py.match(/^HAUTEUR = (\d+)/m)![1])).toBe(2048)
  })
})
