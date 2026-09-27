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

// La forme PHYSIQUE du surchauffeur : ce qui arrête l'eau doit être ce
// qu'on voit — le tube de verre entre ses rails, un peu moins large que le
// bloc, et ses têtes d'acier.
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

  it('les surchauffeurs des tableaux, du hub et des figures : longs, courts, jamais en dôme', () => {
    // mesuré le 26/09 : 60×200 (La halte), 140×80 et 140×60 (hub), 70×260 (figures)
    expect(modeSurchauffeur(200, 60)).toBe('longue')
    expect(modeSurchauffeur(140, 80)).toBe('courte')
    expect(modeSurchauffeur(140, 60)).toBe('courte')
    expect(modeSurchauffeur(260, 70)).toBe('longue')
    expect(modeSurchauffeur(100, 90)).toBe('dome')
  })

  it('le tube est moins large que le bloc : son bord est DEHORS, son axe dedans', () => {
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

  it('le dôme est ROND : le coin est dehors, le bord du disque dedans', () => {
    const b = box(0, 0, 100, 90, MAT_SURCHAUFFEUR)
    expect(dist(b, 50 + 40, 45)).toBeLessThan(0)
    expect(dist(b, 50 + 42, 45 + 42)).toBeGreaterThan(0)
  })

  it('un bout contre un mur NE plonge PAS : la borne garde ses têtes, encastrée dans la ligne de mur', () => {
    // la ligne de mur des figures : un mur, le surchauffeur, un autre mur
    const b = box(0, 0, 60, 200, MAT_SURCHAUFFEUR)
    const murHaut = box(-100, 200, 200, 260, MAT_WALL)
    const murBas = box(-100, -60, 200, 0, MAT_WALL)
    expect(boutsEnMur(b, [b, murHaut, murBas], null)).toBe(0)
    // le tambour de la tête, de toute la largeur, est bien là au ras du mur
    const T = 60
    const s = 200 - ((SURCHAUFFEUR.tambourB[0] + SURCHAUFFEUR.tambourB[1]) / 2) * T
    expect(dist(b, 58, s, [b, murHaut, murBas])).toBeLessThan(0)
  })

  it('le solveur lit le surchauffeur à sa forme : l’eau bute sur le tube, pas sur la boîte', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -500, minY: -500, maxX: 900, maxY: 500 })
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    expect(s.boxes[0].forme).toBe(FORME_SURCHAUFFEUR)
    formeContact(58, 100, s.boxes[0], out)
    expect(out.dist).toBeGreaterThan(0)
  })
})

// LE FRÔLEMENT : la vapeur prend le dash à moins de deux espacements de
// particule (13,2 u) du surchauffeur. Il se mesure au RECTANGLE du bloc,
// comme avant la refonte : mesuré depuis le tube (86 % de l'épaisseur), il
// fallait passer 4 u plus près sur un bloc de 60.
describe('surchauffeur — le frôlement garde sa portée', () => {
  const frole = (s: FluidSim, x: number, y: number): number =>
    (s as unknown as { surchauffeurFrole(x: number, y: number): number }).surchauffeurFrole(x, y)
  const salle = { minX: -500, minY: -500, maxX: 900, maxY: 500 }

  it('à 10 u du bord du bloc, le long du tube, la vapeur frôle', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    // le tube s'arrête à 30 + 0,4294 · 60 ≈ 56 : ce point en est à 14 u
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

// LE RENDU RECONNAÎT LE SURCHAUFFEUR VIDÉ À SA BOÎTE. Les indices de
// surchauffesVides comptent les boîtes du solveur, qui écarte le sas, le vide
// et la baie ; le rendu numérote toutes celles du tableau. Une baie posée
// avant le surchauffeur décalait tout : on vidait l'un, un autre s'éteignait.
describe('surchauffeur — reconnu à sa boîte', () => {
  const salle = { minX: -500, minY: -500, maxX: 900, maxY: 500 }
  it('une baie avant le surchauffeur ne décale rien', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    const baie = box(-400, -400, -300, -300, 12) // MAT_BAIE : sans physique
    const a = box(0, 0, 60, 200, MAT_SURCHAUFFEUR)
    const b = box(200, 0, 260, 200, MAT_SURCHAUFFEUR)
    s.setLevel([baie, a, b], [])
    s.surchauffesVides.add(0) // l'indice du solveur de `a` (la baie écartée)
    expect(s.surchauffeurVide(a)).toBe(true)
    expect(s.surchauffeurVide(b)).toBe(false)
  })

  it('chaque chargement de salle avance le compteur', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    const g0 = s.generation
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    s.setLevel([box(0, 0, 60, 200, MAT_SURCHAUFFEUR)], [])
    expect(s.generation).toBe(g0 + 2)
  })
})

describe('surchauffeur — les jumeaux', () => {
  it('le shader interpole SURCHAUFFEUR et SURCHAUFFEUR_ATLAS, et décode la charge', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/const float SU_CORPS = \$\{f\(C\.corps\)\};/)
    expect(src).toMatch(/const vec4 SU_CADRE_BOUT = \$\{v4\(A\.bout\)\};/)
    expect((src.match(/\$\{SURCHAUFFEUR_GLSL\}/g) ?? []).length).toBe(2)
    // aux.z = charge + 2 · sens (le surchauffeur n'a jamais de bout dans un
    // mur) ; le shader décode charge + 2 · (sens + 4 · bouts), bouts nuls
    expect(src).toMatch(/this\.chargeLissee\(bx, sim\.surchauffeurVide\(bx\) \? 0 : 1, timeSec\) \+ 2 \* \(bx\.sens \?\? 0\)/)
    expect(src).toMatch(/float surchCharge\(float z\) \{ return clamp\(z - 2\.0 \* surchCode\(z\), 0\.0, 1\.0\); \}/)
  })

  it('les cadres de l’atlas sont ceux du script qui le fabrique', async () => {
    const { readFileSync } = await import('node:fs')
    const py = readFileSync(new URL('../../tools/images/chaudiere_atlas.py', import.meta.url), 'utf8')
    const cadre = (nom: string) =>
      py.match(new RegExp(`CADRE_${nom} = \\((\\d+), (\\d+), (\\d+), (\\d+)\\)`))!.slice(1).map(Number)
    expect(cadre('S_CORPS')).toEqual(SURCHAUFFEUR_ATLAS.corps)
    expect(cadre('S_BOUT')).toEqual(SURCHAUFFEUR_ATLAS.bout)
    expect(cadre('S_DOME')).toEqual(SURCHAUFFEUR_ATLAS.dome)
    expect(Number(py.match(/^HAUTEUR = (\d+)/m)![1])).toBe(2048)
  })
})
