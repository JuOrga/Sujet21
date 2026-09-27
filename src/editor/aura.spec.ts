import { describe, expect, it } from 'vitest'
import { contourAura } from './aura'
import { formePhysique } from '../game/conduite'
import { formeContact, type FormeContact } from '../game/formes'
import { MAT_CHAUD, MAT_FROID, MAT_SURCHAUFFEUR, type ObstacleBox } from '../game/level'

// L'aura tracée par l'éditeur doit être celle que le solveur mesure :
// l'iso-distance de la FORME PHYSIQUE, pas le rectangle arrondi de la boîte
// (qui débordait de ~11 u le long d'une rampe de chaudière, et bien plus
// aux coins d'une chaudière compacte, ronde).
const box = (minX: number, minY: number, maxX: number, maxY: number, material: number, angle = 0): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material,
  ...(angle ? { angle } : {}),
})

const c: FormeContact = { dist: 0, nx: 0, ny: 1 }

/** L'écart le plus grand entre la distance réelle d'un point du contour à
 *  la forme physique et la portée voulue. */
function ecartMax(b: ObstacleBox, portee: number): number {
  const f = formePhysique(b)
  const contours = contourAura(f, portee)
  expect(contours.length).toBeGreaterThan(0)
  let pire = 0
  for (const boucle of contours)
    for (const p of boucle) {
      formeContact(p.x, p.y, f, c)
      pire = Math.max(pire, Math.abs(c.dist - portee))
    }
  return pire
}

describe('aura de l’éditeur — l’iso-distance de la forme physique', () => {
  it.each([
    ['chaudière longue', box(0, 0, 600, 60, MAT_CHAUD)],
    ['chaudière courte', box(0, 0, 150, 60, MAT_CHAUD)],
    ['chaudière compacte (ronde)', box(0, 0, 90, 90, MAT_CHAUD)],
    ['chaudière oblique', box(0, 0, 400, 60, MAT_CHAUD, 30)],
    ['conduite d’ammoniac', box(0, 0, 500, 50, MAT_FROID)],
    ['surchauffeur', box(0, 0, 300, 60, MAT_SURCHAUFFEUR)],
  ])('%s : chaque point du contour est à la portée de la forme', (_n, b) => {
    expect(ecartMax(b, 130)).toBeLessThan(1)
  })

  it('le long d’une rampe, l’aura part du carter, pas du bord du bloc', () => {
    // le carter ne remplit que 81 % de l'épaisseur du bloc : entre deux
    // joints (x = 100, loin du joint central et des brides), l'aura
    // s'arrête à la portée comptée depuis le CARTER — 5,6 u avant celle
    // comptée depuis le bord du bloc, où l'ancien tracé la mettait
    const b = box(0, 0, 600, 60, MAT_CHAUD)
    const haut = Math.max(
      ...contourAura(formePhysique(b), 130)
        .flat()
        .filter((p) => Math.abs(p.x - 100) < 20)
        .map((p) => p.y),
    )
    expect(haut).toBeCloseTo(30 + 24.366 + 130, 0)
  })

  it('un contour par forme, fermé : pas de morceaux épars', () => {
    const contours = contourAura(formePhysique(box(0, 0, 600, 60, MAT_CHAUD)), 130)
    expect(contours).toHaveLength(1)
    const boucle = contours[0]
    const a = boucle[0]
    const z = boucle[boucle.length - 1]
    // le dernier point rejoint le premier à un pas de maillage près
    expect(Math.hypot(a.x - z.x, a.y - z.y)).toBeLessThan(30)
  })
})
