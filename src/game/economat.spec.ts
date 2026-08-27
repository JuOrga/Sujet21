// L'Économat : la salle du Semblable est saine — l'étal complet, les
// alcôves franches, le départ dégagé, le sas accessible.
import { describe, expect, it } from 'vitest'
import {
  CODE_ECONOMAT,
  ETAL_ECONOMAT,
  TABLEAU_ECONOMAT,
  estEconomat,
} from './economat'
import { TABLEAU_HUB } from './hub'
import { dansForme, type FormeBox } from './formes'

const libre = (x: number, y: number): boolean =>
  TABLEAU_ECONOMAT.boxes.every(
    (b) => !dansForme(b as unknown as FormeBox, x, y),
  )

describe('l’Économat — la salle du Semblable', () => {
  it('se reconnaît à son code, et lui seul', () => {
    expect(TABLEAU_ECONOMAT.code).toBe(CODE_ECONOMAT)
    expect(estEconomat(TABLEAU_ECONOMAT)).toBe(true)
    expect(estEconomat(TABLEAU_HUB)).toBe(false)
  })

  it('l’étal est complet : cinq articles, uniques, payants, étiquetés', () => {
    expect(ETAL_ECONOMAT.length).toBe(5)
    const ids = new Set(ETAL_ECONOMAT.map((a) => a.id))
    expect(ids.size).toBe(5)
    for (const a of ETAL_ECONOMAT) {
      expect(a.prix).toBeGreaterThan(0)
      // chaque article a sa pancarte, prix affiché
      const pancarte = TABLEAU_ECONOMAT.labels.find((l) =>
        l.text.includes(`${a.prix} cL`),
      )
      expect(pancarte, a.nom).toBeDefined()
    }
  })

  it('les alcôves sont dans la cuve, disjointes, et franches au centre', () => {
    const b = TABLEAU_ECONOMAT.bounds
    for (const a of ETAL_ECONOMAT) {
      expect(a.plot.minX).toBeGreaterThanOrEqual(b.minX)
      expect(a.plot.maxX).toBeLessThanOrEqual(b.maxX)
      expect(a.plot.minY).toBeGreaterThanOrEqual(b.minY)
      expect(a.plot.maxY).toBeLessThanOrEqual(b.maxY)
      // le centre de l'alcôve est libre : le corps peut s'y glisser
      const cx = (a.plot.minX + a.plot.maxX) / 2
      const cy = (a.plot.minY + a.plot.maxY) / 2
      expect(libre(cx, cy), a.nom).toBe(true)
      // deux alcôves ne se recouvrent pas
      for (const autre of ETAL_ECONOMAT) {
        if (autre === a) continue
        const recouvre =
          a.plot.minX < autre.plot.maxX &&
          a.plot.maxX > autre.plot.minX &&
          a.plot.minY < autre.plot.maxY &&
          a.plot.maxY > autre.plot.minY
        expect(recouvre).toBe(false)
      }
    }
  })

  it('le départ est dégagé (120 u) et le sas est franc', () => {
    const s = TABLEAU_ECONOMAT.spawn
    for (const [dx, dy] of [
      [0, 0],
      [120, 0],
      [-120, 0],
      [0, 120],
      [0, -120],
    ] as const) {
      expect(libre(s.x + dx, s.y + dy)).toBe(true)
    }
    const e = TABLEAU_ECONOMAT.exit
    expect(libre((e.minX + e.maxX) / 2, (e.minY + e.maxY) / 2)).toBe(true)
    const b = TABLEAU_ECONOMAT.bounds
    expect(e.maxX).toBeLessThanOrEqual(b.maxX)
  })

  it('le Semblable vit derrière une GRILLE — on se voit, on ne se rejoint pas', () => {
    // une grille sépare bien la chambre nord du reste
    const grille = TABLEAU_ECONOMAT.boxes.find((b) => b.material === 5)
    expect(grille).toBeDefined()
    // et la masse du Sujet 12 est bien derrière (plus haut que la grille)
    const masse = TABLEAU_ECONOMAT.boxes.find((b) => b.forme === 2)
    expect(masse).toBeDefined()
    expect(masse!.minY).toBeGreaterThan(grille!.maxY)
  })
})
