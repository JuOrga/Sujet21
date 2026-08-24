import { describe, expect, it } from 'vitest'
import {
  AMBIANTE_DEFAUT,
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
  TABLEAUX_ECOLE,
  TABLEAUX_GAMME,
  TABLEAUX_PALIERS,
  TABLEAU_G5,
  TABLEAU_G6,
  TABLEAU_G7,
  TABLEAU_G8,
  TABLEAU_G9,
  TABLEAU_G10,
  TABLEAU_G11,
  TABLEAU_10,
  TABLEAU_11,
  TABLEAU_12,
  TABLEAU_13,
  TABLEAU_1BIS,
  TABLEAU_8,
  TABLEAU_9,
  TABLEAUX,
  subtractBox,
  subtractSponge,
  type SpongeDef,
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
    for (const lv of [
      TABLEAU_8,
      TABLEAU_9,
      TABLEAU_10,
      TABLEAU_11,
      TABLEAU_12,
      TABLEAU_13,
    ]) {
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
      const t = traceLaser(
        TABLEAU_8.lasers![0],
        mondeDe(TABLEAU_8, { iceNormal: palet(cx, -116, 104) }),
      )
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
        dedans: (x: number, y: number): boolean =>
          Math.hypot(x - centre.x, y - centre.y) < 104,
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
    const nuage = (x: number, y: number): boolean =>
      Math.hypot(x + 240, y - 140) < 90
    const t = traceLaser(
      TABLEAU_10.lasers![0],
      mondeDe(TABLEAU_10, { vapeur: nuage }),
    )
    expect(t.touchees).toEqual([0])
    // sans nuage, le faisceau meurt sur le mur : vérifié par le test « à vide »
  })

  it('21-K : chaque verrou se tient — gelé sur le berceau, puis liquide sur l’étagère', () => {
    // verrou I : palet gelé sur le berceau (dessus y = −220, centre y = −116)
    let miroir = false
    for (let cx = -20; cx <= 100 && !miroir; cx += 10) {
      const t = traceLaser(
        TABLEAU_11.lasers![0],
        mondeDe(TABLEAU_11, { iceNormal: palet(cx, -116, 104) }),
      )
      if (t.touchees.includes(0)) miroir = true
    }
    expect(miroir).toBe(true)
    // verrou II : corps liquide sur l'étagère (dessus y = 330, centre y = 434)
    let prisme = false
    for (let cx = 60; cx <= 220 && !prisme; cx += 10) {
      const centre = { x: cx, y: 434 }
      const eau = {
        dedans: (x: number, y: number): boolean =>
          Math.hypot(x - centre.x, y - centre.y) < 104,
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
    const nuage = (x: number, y: number): boolean =>
      Math.hypot(x + 200, y - 100) < 90
    const t = traceLaser(
      TABLEAU_12.lasers![0],
      mondeDe(TABLEAU_12, { vapeur: nuage }),
    )
    expect(t.touchees).toEqual([0])
  })

  it('21-M : les trois chambres se résolvent, chacune avec son état', () => {
    // chambre I — miroir : palet gelé sur le berceau (dessus y = −220)
    let miroir = false
    for (let cx = -540; cx <= -440 && !miroir; cx += 10) {
      const t = traceLaser(
        TABLEAU_13.lasers![0],
        mondeDe(TABLEAU_13, { iceNormal: palet(cx, -116, 104) }),
      )
      if (t.touchees.includes(0)) miroir = true
    }
    expect(miroir).toBe(true)
    // chambre II — prisme : corps liquide sur l'étagère (dessus y = 130),
    // le faisceau plié vient mourir sur le récepteur scellé à la porte
    let prisme = false
    for (let cx = -140; cx <= 40 && !prisme; cx += 10) {
      const centre = { x: cx, y: 234 }
      const eau = {
        dedans: (x: number, y: number): boolean =>
          Math.hypot(x - centre.x, y - centre.y) < 104,
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
    const nuage = (x: number, y: number): boolean =>
      Math.hypot(x - 600, y - 140) < 90
    const t = traceLaser(
      TABLEAU_13.lasers![2],
      mondeDe(TABLEAU_13, { vapeur: nuage }),
    )
    expect(t.touchees).toEqual([2])
  })
})

describe('subtractBox — la découpe ronge les parois', () => {
  const boite = { minX: 0, minY: 0, maxX: 100, maxY: 100, material: MAT_WALL }

  it('sans recouvrement, la boîte reste entière (le même objet)', () => {
    const out = subtractBox(boite, {
      minX: 200,
      minY: 0,
      maxX: 300,
      maxY: 100,
    })
    expect(out).toEqual([boite])
    expect(out[0]).toBe(boite)
  })

  it('une découpe au centre laisse 4 morceaux qui recouvrent le reste sans trou', () => {
    const out = subtractBox(boite, { minX: 30, minY: 30, maxX: 70, maxY: 70 })
    expect(out.length).toBe(4)
    const aire = out.reduce(
      (s, b) => s + (b.maxX - b.minX) * (b.maxY - b.minY),
      0,
    )
    expect(aire).toBe(100 * 100 - 40 * 40) // l'aire rongée manque, rien d'autre
    for (const b of out) expect(b.material).toBe(MAT_WALL)
  })

  it('une découpe qui traverse de part en part coupe la boîte en deux', () => {
    const out = subtractBox(boite, {
      minX: 40,
      minY: -10,
      maxX: 60,
      maxY: 110,
    })
    expect(out.length).toBe(2)
    expect(out[0].maxX).toBe(40)
    expect(out[1].minX).toBe(60)
  })

  it('une découpe qui engloutit tout ne laisse rien', () => {
    expect(
      subtractBox(boite, { minX: -10, minY: -10, maxX: 110, maxY: 110 }),
    ).toEqual([])
  })

  it('les éclats de moins d’une unité sont balayés', () => {
    const out = subtractBox(boite, {
      minX: 0.5,
      minY: -10,
      maxX: 110,
      maxY: 110,
    })
    expect(out).toEqual([]) // le ruban de 0,5 u à gauche ne survit pas
  })
})

// Garde-fous du level design : chaque tableau doit être un problème fermé
// bien formé — l'expédition entière en dépend. Le prototype 21-A bis suit
// les mêmes règles, même hors expédition.
const ALL = [...TABLEAUX, TABLEAU_1BIS, ...TABLEAUX_ECOLE]

describe('TABLEAUX — validité structurelle', () => {
  it('l’expédition fait 24 tableaux, aux codes uniques (le bis à part)', () => {
    expect(TABLEAUX.length).toBe(24)
    const codes = ALL.map((t) => t.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(TABLEAUX).not.toContain(TABLEAU_1BIS)
  })

  it('la dent de scie : chaque leçon se place juste avant le tableau qui l’exige', () => {
    // l'ordre COMPLET de l'expédition est un choix de conception — le
    // verrouiller documente la stratégie et empêche un remaniement muet
    expect(TABLEAUX.map((t) => t.code)).toEqual([
      '21-01', // le corps seul
      '21-02', // le rebond (hydrophobe)
      '21-03', // l'ancrage (hydrophile)
      '21-04', // le premier gel (froid)
      '21-05', // le premier souffle (vapeur)
      '21-06', // l'éponge — juste avant que Le sas l'exige
      '21-A', // le premier examen : tout le vocabulaire de la gamme
      '21-B', // la chambre froide
      '21-07', // la membrane — le contraste après tant de gel
      '21-C', // le conduit (vapeur obligatoire)
      '21-08', // le rideau — le contraste après la vapeur
      '21-09', // les régimes imposés
      '21-E', // la serre (composition)
      '21-10', // la halte (bornes) — avant le tableau le plus gourmand en dashs
      '21-F', // le dépôt de givre
      '21-D', // la cuve thermique : l'examen des trois routes
      '21-11', // la voie lumineuse — la respiration avant les lasers
      '21-H',
      '21-I',
      '21-J',
      '21-K',
      '21-L',
      '21-M',
      '21-G', // la dérive : la maîtrise pure
    ])
  })

  it('la gamme ouvre l’expédition : cinq cellules, en sortie du hub, dans l’ordre', () => {
    expect(TABLEAUX_GAMME.length).toBe(5)
    expect(TABLEAUX.slice(0, 5)).toEqual(TABLEAUX_GAMME)
    expect(TABLEAUX_GAMME.map((t) => t.code)).toEqual([
      '21-01',
      '21-02',
      '21-03',
      '21-04',
      '21-05',
    ])
  })

  it('la gamme respecte la règle d’or : une nouveauté par salle, jamais deux', () => {
    // le vocabulaire autorisé de chaque cellule : ce qu'elle introduit, plus
    // ce que les cellules PRÉCÉDENTES ont déjà introduit — rien d'autre
    const autorises = [
      [MAT_WALL],
      [MAT_WALL, MAT_HYDROPHOBE],
      [MAT_WALL, MAT_HYDROPHILE],
      [MAT_WALL, MAT_FROID],
      [MAT_WALL, MAT_FROID, MAT_CHAUD, MAT_GRILLE],
    ]
    TABLEAUX_GAMME.forEach((t, i) => {
      for (const b of t.boxes) {
        expect(
          autorises[i],
          `${t.code} : matériau ${b.material} hors vocabulaire`,
        ).toContain(b.material)
      }
      // pas d'éponge, pas de laser, pas de porte, pas de zone : trop tôt
      expect(t.sponges).toHaveLength(0)
      expect(t.lasers ?? []).toHaveLength(0)
      expect(t.portes ?? []).toHaveLength(0)
      expect(t.zones ?? []).toHaveLength(0)
    })
  })

  it('la gamme est lisible et éclairée : picto à la première rencontre, lampes, par', () => {
    for (const t of TABLEAUX_GAMME) {
      // le plafond de maîtrise existe (par) et la lumière est conçue —
      // avec la balise verte du sas, le repère commun à toutes les cellules
      expect(t.par, `${t.code} : par manquant`).toBeGreaterThan(0)
      expect(t.lumieres?.length ?? 0, `${t.code} : lampes`).toBeGreaterThan(1)
      expect(
        t.lumieres?.some((l) => l.couleur === '#3fd69b'),
        `${t.code} : balise verte du sas`,
      ).toBe(true)
    }
    // chaque surface nouvelle porte son pictogramme d'état (rangées
    // EAU/GLACE/VAPEUR) sur l'étiquette de première rencontre
    for (const t of TABLEAUX_GAMME.slice(1)) {
      expect(
        t.labels.some((l) => l.picto),
        `${t.code} : pictogramme manquant`,
      ).toBe(true)
    }
    // la première brume du jeu est dans la cellule vapeur — et nulle part avant
    expect(TABLEAU_G5.brume ?? 0).toBeGreaterThan(0)
    for (const t of TABLEAUX_GAMME.slice(0, 4)) {
      expect(t.brume ?? 0).toBe(0)
    }
  })

  it('les paliers gardent la règle d’or : le vocabulaire de chaque salle est fermé', () => {
    // même contrat que la gamme : chaque palier n'utilise que sa nouveauté
    // et ce qui a déjà été enseigné avant lui dans l'expédition
    const autorisesPaliers: [LevelDef, number[]][] = [
      [TABLEAU_G6, [MAT_WALL]], // l'éponge vit dans `sponges`, pas dans `boxes`
      [TABLEAU_G7, [MAT_WALL, MAT_MEMBRANE, MAT_FROID]],
      [TABLEAU_G8, [MAT_WALL, MAT_RIDEAU, MAT_FROID]],
      [TABLEAU_G9, [MAT_WALL, MAT_GRILLE]],
      [TABLEAU_G10, [MAT_WALL, MAT_CHAUD, MAT_SURCHAUFFEUR, MAT_FROID]],
      [TABLEAU_G11, [MAT_WALL, MAT_HYDROPHILE]],
    ]
    for (const [t, mats] of autorisesPaliers) {
      for (const b of t.boxes) {
        expect(
          mats,
          `${t.code} : matériau ${b.material} hors vocabulaire`,
        ).toContain(b.material)
      }
      // pas de laser ni de porte : l'optique reste le chapitre suivant
      expect(t.lasers ?? []).toHaveLength(0)
      expect(t.portes ?? []).toHaveLength(0)
    }
    // la buveuse enseigne l'éponge : le bloc d'essai, le péage, la fine
    expect(TABLEAU_G6.sponges.length).toBe(3)
    // les régimes enseignent les zones : glace, vapeur — et rien d'autre avant
    const forces = (TABLEAU_G9.zones ?? []).map((z) => z.force)
    expect(forces).toContain('glace')
    expect(forces).toContain('vapeur')
    for (const t of [
      TABLEAU_G6,
      TABLEAU_G7,
      TABLEAU_G8,
      TABLEAU_G10,
      TABLEAU_G11,
    ]) {
      expect(t.zones ?? []).toHaveLength(0)
    }
  })

  it('les paliers sont lisibles et éclairés : picto neuf, balise verte, par', () => {
    for (const t of TABLEAUX_PALIERS) {
      expect(t.par, `${t.code} : par manquant`).toBeGreaterThan(0)
      expect(t.lumieres?.length ?? 0, `${t.code} : lampes`).toBeGreaterThan(1)
      expect((t.lumieres?.length ?? 0) <= 4, `${t.code} : trop de lampes`).toBe(
        true,
      )
      expect(
        t.lumieres?.some((l) => l.couleur === '#3fd69b'),
        `${t.code} : balise verte du sas`,
      ).toBe(true)
    }
    // chaque surface NOUVELLE porte son pictogramme (les régimes, eux,
    // s'annoncent par leurs zones nommées — pas de matière neuve à picto)
    for (const t of [TABLEAU_G6, TABLEAU_G7, TABLEAU_G8, TABLEAU_G10]) {
      expect(
        t.labels.some((l) => l.picto),
        `${t.code} : pictogramme manquant`,
      ).toBe(true)
    }
    // la voie lumineuse est la leçon d'atmosphère : la salle est éteinte,
    // les quatre lampes font le chemin
    expect(TABLEAU_G11.ambiante ?? AMBIANTE_DEFAUT).toBeLessThan(0.3)
    expect(TABLEAU_G11.lumieres?.length).toBe(4)
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
    expect(
      subtractBox(paroi(), { minX: -10, minY: -10, maxX: 110, maxY: 110 }),
    ).toEqual([])
  })

  it('une paroi à cheval est rognée, le reste survit', () => {
    const morceaux = subtractBox(paroi(), {
      minX: 60,
      minY: -10,
      maxX: 200,
      maxY: 200,
    })
    expect(morceaux).toHaveLength(1)
    expect(morceaux[0]).toMatchObject({
      minX: 0,
      maxX: 60,
      minY: 0,
      maxY: 100,
    })
  })

  it('une zone qui ne touche pas la paroi la laisse entière', () => {
    const b = paroi()
    expect(
      subtractBox(b, { minX: 300, minY: 300, maxX: 400, maxY: 400 }),
    ).toEqual([b])
  })

  it('une FORME ne se découpe pas : la gomme l’efface entière ou l’épargne', () => {
    const disque = { ...paroi(), forme: 1 }
    expect(
      subtractBox(disque, { minX: 40, minY: 40, maxX: 200, maxY: 200 }),
    ).toEqual([disque])
  })
})

describe('subtractSponge — ronger une éponge, cellule par cellule', () => {
  // une éponge 10 × 4 de cellules de 24 u, coin bas-gauche à (0, 0)
  const ep = (): SpongeDef => ({
    minX: 0,
    minY: 0,
    cols: 10,
    rows: 4,
    cellSize: 24,
    capacityPerCell: 5,
  })

  it('un rectangle qui ne la touche pas la laisse entière', () => {
    const sp = ep()
    expect(
      subtractSponge(sp, { minX: 500, minY: 500, maxX: 600, maxY: 600 }),
    ).toEqual([sp])
  })

  it('entièrement couverte, il ne reste rien', () => {
    expect(
      subtractSponge(ep(), { minX: -50, minY: -50, maxX: 500, maxY: 500 }),
    ).toEqual([])
  })

  it('rognée par la droite : les colonnes restantes sont calées sur la trame', () => {
    // on retire à partir de x = 120 (la colonne 5 commence à 120)
    const out = subtractSponge(ep(), {
      minX: 120,
      minY: -10,
      maxX: 400,
      maxY: 400,
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      minX: 0,
      minY: 0,
      cols: 5,
      rows: 4,
      cellSize: 24,
    })
  })

  it('mordue en plein milieu : elle se redit en plusieurs morceaux', () => {
    const out = subtractSponge(ep(), {
      minX: 72,
      minY: 24,
      maxX: 168,
      maxY: 72,
    })
    // gauche (3 colonnes), droite (3 colonnes), dessous et dessus du trou
    expect(out.length).toBeGreaterThanOrEqual(3)
    const cellules = out.reduce((a, s) => a + s.cols * s.rows, 0)
    expect(cellules).toBeLessThan(40) // des cellules ont bien disparu
    expect(cellules).toBeGreaterThan(20)
    for (const s of out) {
      // toutes les pièces restent sur la trame d'origine
      expect((s.minX - 0) % 24).toBe(0)
      expect((s.minY - 0) % 24).toBe(0)
      expect(s.capacityPerCell).toBe(5)
    }
  })

  it('un rectangle trop fin, passé entre deux centres, ne retire rien', () => {
    const sp = ep()
    expect(
      subtractSponge(sp, { minX: 47, minY: -10, maxX: 49, maxY: 400 }),
    ).toEqual([sp])
  })
})
