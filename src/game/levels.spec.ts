import { describe, expect, it } from 'vitest'
import { TABLEAUX } from './level'

// Garde-fous du level design : chaque tableau doit être un problème fermé
// bien formé — l'expédition entière en dépend.
describe('TABLEAUX — validité structurelle', () => {
  it('l’expédition fait 7 tableaux, aux codes uniques', () => {
    expect(TABLEAUX.length).toBe(7)
    const codes = TABLEAUX.map((t) => t.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('spawn et sas sont dans les bornes, et distincts', () => {
    for (const t of TABLEAUX) {
      const b = t.bounds
      expect(t.spawn.x).toBeGreaterThan(b.minX)
      expect(t.spawn.x).toBeLessThan(b.maxX)
      expect(t.spawn.y).toBeGreaterThan(b.minY)
      expect(t.spawn.y).toBeLessThan(b.maxY)
      expect(t.exit.minX).toBeGreaterThanOrEqual(b.minX)
      expect(t.exit.maxX).toBeLessThanOrEqual(b.maxX)
      expect(t.exit.minY).toBeGreaterThanOrEqual(b.minY)
      expect(t.exit.maxY).toBeLessThanOrEqual(b.maxY)
      // le sas n'est pas sur le spawn : il y a une traversée à faire
      const cx = (t.exit.minX + t.exit.maxX) / 2
      expect(Math.abs(cx - t.spawn.x)).toBeGreaterThan(800)
    }
  })

  it('le spawn ne naît pas dans un obstacle', () => {
    for (const t of TABLEAUX) {
      for (const box of t.boxes) {
        const inside =
          t.spawn.x > box.minX - 120 &&
          t.spawn.x < box.maxX + 120 &&
          t.spawn.y > box.minY - 120 &&
          t.spawn.y < box.maxY + 120
        expect(inside, `${t.code} : spawn trop près d'un obstacle`).toBe(false)
      }
    }
  })

  it('chaque tableau a un journal, des étiquettes et une étiquette SAS', () => {
    for (const t of TABLEAUX) {
      expect(t.journal.length).toBeGreaterThan(40)
      expect(t.labels.length).toBeGreaterThanOrEqual(3)
      expect(t.labels.some((l) => l.tone === 'sas')).toBe(true)
    }
  })
})
