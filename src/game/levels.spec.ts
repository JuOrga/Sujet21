import { describe, expect, it } from 'vitest'
import {
  MAT_WALL,
  TABLEAU_10,
  TABLEAU_1BIS,
  TABLEAU_8,
  TABLEAU_9,
  TABLEAUX,
  subtractBox,
  type LevelDef,
} from './level'
import { traceLaser, type TraceMonde } from './laser'

// Le monde optique d'un tableau, tel que le jeu le construit — sans corps
// par défaut, toutes portes closes (rien n'est encore allumé).
function mondeDe(lv: LevelDef, sur: Partial<TraceMonde> = {}): TraceMonde {
  return {
    bounds: lv.bounds,
    boxes: lv.boxes,
    portesFermees: lv.portes ?? [],
    cibles: lv.cibles ?? [],
    iceNormal: null,
    eau: null,
    vapeur: null,
    rails: lv.rails ?? [],
    ...sur,
  }
}

/** Un palet circulaire analytique : la normale radiale d'un corps gelé. */
function palet(cx: number, cy: number, r: number) {
  return (x: number, y: number): { nx: number; ny: number } | null => {
    const dx = x - cx
    const dy = y - cy
    const d = Math.hypot(dx, dy)
    if (d > r) return null
    if (d < 1e-6) return { nx: 0, ny: 1 }
    return { nx: dx / d, ny: dy / d }
  }
}

describe('Tableaux laser — les énigmes tiennent leurs promesses', () => {
  it('aucun tableau laser ne se résout tout seul : à vide, rien ne s’allume', () => {
    for (const lv of [TABLEAU_8, TABLEAU_9, TABLEAU_10]) {
      for (const em of lv.lasers ?? []) {
        expect(traceLaser(em, mondeDe(lv)).touchees).toEqual([])
      }
    }
  })

  it('21-H : un palet gelé posé sur le berceau renvoie le faisceau au récepteur', () => {
    // corps de 900 particules ≈ rayon 104, posé sur le berceau (dessus à
    // y = −220) : centre vers (−30, −116). Le joueur règle l'angle en
    // glissant le long du berceau — on vérifie qu'une position raisonnable
    // du berceau résout l'énigme.
    let ok = false
    for (let cx = -120; cx <= 160 && !ok; cx += 10) {
      const t = traceLaser(TABLEAU_8.lasers![0], mondeDe(TABLEAU_8, { iceNormal: palet(cx, -116, 104) }))
      if (t.touchees.includes(0)) ok = true
    }
    expect(ok).toBe(true)
  })

  it('21-I : un corps liquide collé à l’étagère plie le faisceau vers le récepteur', () => {
    // corps rond posé sur l'étagère (dessus à y = 130) : centre ≈ (x, 234).
    // La lentille dévie la ligne droite vers le bas — une des positions de
    // mouillage doit allumer le récepteur.
    let ok = false
    for (let cx = 60; cx <= 380 && !ok; cx += 10) {
      const centre = { x: cx, y: 234 }
      const eau = {
        dedans: (x: number, y: number): boolean => Math.hypot(x - centre.x, y - centre.y) < 104,
        normale: (x: number, y: number): { nx: number; ny: number } => {
          const d = Math.hypot(x - centre.x, y - centre.y) || 1
          return { nx: (x - centre.x) / d, ny: (y - centre.y) / d }
        },
      }
      const t = traceLaser(TABLEAU_9.lasers![0], mondeDe(TABLEAU_9, { eau }))
      if (t.touchees.includes(0)) ok = true
    }
    expect(ok).toBe(true)
  })

  it('21-J : ionisé au pied du rail, l’arc franchit le mur et allume le récepteur', () => {
    // le nuage de vapeur au pied du rail (là où le faisceau le croise)
    const nuage = (x: number, y: number): boolean => Math.hypot(x + 240, y - 140) < 90
    const t = traceLaser(TABLEAU_10.lasers![0], mondeDe(TABLEAU_10, { vapeur: nuage }))
    expect(t.touchees).toEqual([0])
    // sans nuage, le faisceau meurt sur le mur : vérifié par le test « à vide »
  })
})

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
  it('l’expédition fait 10 tableaux, aux codes uniques (le bis à part)', () => {
    expect(TABLEAUX.length).toBe(10)
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
