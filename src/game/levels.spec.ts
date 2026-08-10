import { describe, expect, it } from 'vitest'
import { MAT_WALL, TABLEAU_1BIS, TABLEAUX, subtractBox } from './level'

describe('subtractBox — la découpe ronge les parois', () => {
  const boite = { minX: 0, minY: 0, maxX: 100, maxY: 100, material: MAT_WALL }

  it('sans recouvrement, la boîte reste entière (le même objet)', () => {
    const out = subtractBox(boite, { minX: 200, minY: 0, maxX: 300, maxY: 100 })
    expect(out).toEqual([boite])
    expect(out[0]).toBe(boite)
  })

  it('une découpe au centre laisse 4 morceaux qui recouvrent le reste sans trou', () => {
    const out = subtractBox(boite, { minX: 30, minY: 30, maxX: 70, maxY: 70 })
    expect(out.length).toBe(4)
    const aire = out.reduce((s, b) => s + (b.maxX - b.minX) * (b.maxY - b.minY), 0)
    expect(aire).toBe(100 * 100 - 40 * 40) // l'aire rongée manque, rien d'autre
    for (const b of out) expect(b.material).toBe(MAT_WALL)
  })

  it('une découpe qui traverse de part en part coupe la boîte en deux', () => {
    const out = subtractBox(boite, { minX: 40, minY: -10, maxX: 60, maxY: 110 })
    expect(out.length).toBe(2)
    expect(out[0].maxX).toBe(40)
    expect(out[1].minX).toBe(60)
  })

  it('une découpe qui engloutit tout ne laisse rien', () => {
    expect(subtractBox(boite, { minX: -10, minY: -10, maxX: 110, maxY: 110 })).toEqual([])
  })

  it('les éclats de moins d’une unité sont balayés', () => {
    const out = subtractBox(boite, { minX: 0.5, minY: -10, maxX: 110, maxY: 110 })
    expect(out).toEqual([]) // le ruban de 0,5 u à gauche ne survit pas
  })
})

// Garde-fous du level design : chaque tableau doit être un problème fermé
// bien formé — l'expédition entière en dépend. Le prototype 21-A bis suit
// les mêmes règles, même hors expédition.
const ALL = [...TABLEAUX, TABLEAU_1BIS]

describe('TABLEAUX — validité structurelle', () => {
  it('l’expédition fait 7 tableaux, aux codes uniques (le bis à part)', () => {
    expect(TABLEAUX.length).toBe(7)
    const codes = ALL.map((t) => t.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(TABLEAUX).not.toContain(TABLEAU_1BIS)
  })

  it('le prototype 21-A bis est un tableau « eau seule » : ni froid, ni chaud, ni grille, ni éponge', () => {
    const mats = new Set(TABLEAU_1BIS.boxes.map((b) => b.material))
    expect(mats.has(4)).toBe(false) // MAT_FROID
    expect(mats.has(5)).toBe(false) // MAT_GRILLE
    expect(mats.has(6)).toBe(false) // MAT_CHAUD
    expect(TABLEAU_1BIS.sponges.length).toBe(0)
  })

  it('spawn et sas sont dans les bornes, et distincts', () => {
    for (const t of ALL) {
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
    for (const t of ALL) {
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
    for (const t of ALL) {
      expect(t.journal.length).toBeGreaterThan(40)
      expect(t.labels.length).toBeGreaterThanOrEqual(3)
      expect(t.labels.some((l) => l.tone === 'sas')).toBe(true)
    }
  })
})
