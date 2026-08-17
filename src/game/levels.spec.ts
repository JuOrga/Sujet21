import { describe, expect, it } from 'vitest'
import {
  MAT_GRILLE,
  MAT_WALL,
  TABLEAUX_ECOLE,
  TABLEAU_10,
  TABLEAU_11,
  TABLEAU_12,
  TABLEAU_13,
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
    for (const lv of [TABLEAU_8, TABLEAU_9, TABLEAU_10, TABLEAU_11, TABLEAU_12, TABLEAU_13]) {
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

  it('21-K : chaque verrou se tient — gelé sur le berceau, puis liquide sur l’étagère', () => {
    // verrou I : palet gelé sur le berceau (dessus y = −220, centre y = −116)
    let miroir = false
    for (let cx = -20; cx <= 100 && !miroir; cx += 10) {
      const t = traceLaser(TABLEAU_11.lasers![0], mondeDe(TABLEAU_11, { iceNormal: palet(cx, -116, 104) }))
      if (t.touchees.includes(0)) miroir = true
    }
    expect(miroir).toBe(true)
    // verrou II : corps liquide sur l'étagère (dessus y = 330, centre y = 434)
    let prisme = false
    for (let cx = 60; cx <= 220 && !prisme; cx += 10) {
      const centre = { x: cx, y: 434 }
      const eau = {
        dedans: (x: number, y: number): boolean => Math.hypot(x - centre.x, y - centre.y) < 104,
        normale: (x: number, y: number): { nx: number; ny: number } => {
          const d = Math.hypot(x - centre.x, y - centre.y) || 1
          return { nx: (x - centre.x) / d, ny: (y - centre.y) / d }
        },
      }
      const t = traceLaser(TABLEAU_11.lasers![1], mondeDe(TABLEAU_11, { eau }))
      if (t.touchees.includes(1)) prisme = true
    }
    expect(prisme).toBe(true)
  })

  it('21-L : l’évent barre toute la hauteur — et l’arc porte la solution de l’autre côté', () => {
    // l'évent est infranchissable pour l'eau : toute la hauteur de la cuve
    const event = TABLEAU_12.boxes.find((b) => b.material === MAT_GRILLE)!
    expect(event.minY).toBeLessThanOrEqual(TABLEAU_12.bounds.minY)
    expect(event.maxY).toBeGreaterThanOrEqual(TABLEAU_12.bounds.maxY)
    // vaporisé dans le faisceau au pied du rail : l'arc traverse et allume
    const nuage = (x: number, y: number): boolean => Math.hypot(x + 200, y - 100) < 90
    const t = traceLaser(TABLEAU_12.lasers![0], mondeDe(TABLEAU_12, { vapeur: nuage }))
    expect(t.touchees).toEqual([0])
  })

  it('21-M : les trois chambres se résolvent, chacune avec son état', () => {
    // chambre I — miroir : palet gelé sur le berceau (dessus y = −220)
    let miroir = false
    for (let cx = -540; cx <= -440 && !miroir; cx += 10) {
      const t = traceLaser(TABLEAU_13.lasers![0], mondeDe(TABLEAU_13, { iceNormal: palet(cx, -116, 104) }))
      if (t.touchees.includes(0)) miroir = true
    }
    expect(miroir).toBe(true)
    // chambre II — prisme : corps liquide sur l'étagère (dessus y = 130),
    // le faisceau plié vient mourir sur le récepteur scellé à la porte
    let prisme = false
    for (let cx = -140; cx <= 40 && !prisme; cx += 10) {
      const centre = { x: cx, y: 234 }
      const eau = {
        dedans: (x: number, y: number): boolean => Math.hypot(x - centre.x, y - centre.y) < 104,
        normale: (x: number, y: number): { nx: number; ny: number } => {
          const d = Math.hypot(x - centre.x, y - centre.y) || 1
          return { nx: (x - centre.x) / d, ny: (y - centre.y) / d }
        },
      }
      const t = traceLaser(TABLEAU_13.lasers![1], mondeDe(TABLEAU_13, { eau }))
      if (t.touchees.includes(1)) prisme = true
    }
    expect(prisme).toBe(true)
    // chambre III — arc : nuage au pied du rail, l'arc grimpe et redescend
    const nuage = (x: number, y: number): boolean => Math.hypot(x - 600, y - 140) < 90
    const t = traceLaser(TABLEAU_13.lasers![2], mondeDe(TABLEAU_13, { vapeur: nuage }))
    expect(t.touchees).toEqual([2])
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
const ALL = [...TABLEAUX, TABLEAU_1BIS, ...TABLEAUX_ECOLE]

describe('TABLEAUX — validité structurelle', () => {
  it('l’expédition fait 13 tableaux, aux codes uniques (le bis à part)', () => {
    expect(TABLEAUX.length).toBe(13)
    const codes = ALL.map((t) => t.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(TABLEAUX).not.toContain(TABLEAU_1BIS)
  })

  it('l’école fait trois leçons : sans laser, sans porte — on traverse, on comprend', () => {
    expect(TABLEAUX_ECOLE.length).toBe(3)
    for (const t of TABLEAUX_ECOLE) {
      expect(t.lasers ?? []).toHaveLength(0)
      expect(t.portes ?? []).toHaveLength(0)
      expect(TABLEAUX).not.toContain(t) // hors expédition : c'est une école
    }
    // la troisième leçon enseigne les zones imposées ET la zone libre
    const forces = (TABLEAUX_ECOLE[2].zones ?? []).map((z) => z.force)
    expect(forces).toContain('glace')
    expect(forces).toContain('vapeur')
    expect(forces).toContain('libre')
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

describe('la gomme : effacer la matière d’une zone', () => {
  // La gomme s'appuie sur subtractBox — on vérifie ici le contrat qu'elle
  // utilise : couverture totale, rognage partiel, et refus des formes.
  const paroi = () => ({ minX: 0, minY: 0, maxX: 100, maxY: 100, material: 0 })

  it('une paroi entièrement couverte ne laisse aucun morceau', () => {
    expect(subtractBox(paroi(), { minX: -10, minY: -10, maxX: 110, maxY: 110 })).toEqual([])
  })

  it('une paroi à cheval est rognée, le reste survit', () => {
    const morceaux = subtractBox(paroi(), { minX: 60, minY: -10, maxX: 200, maxY: 200 })
    expect(morceaux).toHaveLength(1)
    expect(morceaux[0]).toMatchObject({ minX: 0, maxX: 60, minY: 0, maxY: 100 })
  })

  it('une zone qui ne touche pas la paroi la laisse entière', () => {
    const b = paroi()
    expect(subtractBox(b, { minX: 300, minY: 300, maxX: 400, maxY: 400 })).toEqual([b])
  })

  it('une FORME ne se découpe pas : la gomme l’efface entière ou l’épargne', () => {
    const disque = { ...paroi(), forme: 1 }
    expect(subtractBox(disque, { minX: 40, minY: 40, maxX: 200, maxY: 200 })).toEqual([disque])
  })
})
