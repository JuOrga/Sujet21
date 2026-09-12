import { describe, expect, it } from 'vitest'
import { AGONIE_DUREE, agonie, clignement, intervalleClignement } from './paupiere'

describe('le clignement', () => {
  it('est fermé à mi-course, ouvert avant et après', () => {
    expect(clignement(-0.01)).toBe(0)
    expect(clignement(0.05)).toBeCloseTo(1)
    expect(clignement(0.1)).toBe(0)
    expect(clignement(0.5)).toBe(0)
  })
  it('revient plus souvent sous la peur', () => {
    const milieu = (): number => 0.5
    expect(intervalleClignement(0, milieu)).toBeCloseTo(7)
    expect(intervalleClignement(1, milieu)).toBeCloseTo(2.25)
    expect(intervalleClignement(0.5, milieu)).toBeCloseTo(4.625)
  })
})

describe("l'agonie", () => {
  it("cherche d'abord, la lueur pleine", () => {
    const a = agonie(0.2)
    expect(a.cherche).toBe(true)
    expect(a.int).toBeCloseTo(1)
    expect(a.taille).toBeCloseTo(1)
    expect(a.cligne).toBe(0)
  })
  it('se resserre en un point avant de fermer', () => {
    const a = agonie(1.0)
    expect(a.cherche).toBe(false)
    expect(a.taille).toBeLessThan(0.5)
    expect(a.cligne).toBe(0)
  })
  it('finit fermée, éteinte', () => {
    const a = agonie(AGONIE_DUREE)
    expect(a.cligne).toBeCloseTo(1)
    expect(a.int).toBeCloseTo(0)
    expect(a.finie).toBe(true)
  })
})
