import { describe, expect, it } from 'vitest'
import { checkLevel, parseLevel, serializeLevel } from './levelIO'
import { TABLEAU_1BIS, TABLEAUX, zoneForceAt, type LevelDef } from './level'

describe('levelIO — aller-retour JSON', () => {
  it('un tableau livré se sérialise et se relit à l’identique', () => {
    for (const t of [...TABLEAUX, TABLEAU_1BIS]) {
      const { level, rejets } = parseLevel(JSON.parse(serializeLevel(t)))
      expect(rejets, `${t.code} : rejets inattendus`).toEqual([])
      expect(level).not.toBeNull()
      expect(level!.code).toBe(t.code)
      expect(level!.boxes).toEqual(t.boxes)
      expect(level!.sponges).toEqual(t.sponges)
      expect(level!.labels).toEqual(t.labels)
      expect(level!.spawn).toEqual(t.spawn)
      expect(level!.exit).toEqual(t.exit)
    }
  })

  it('normalise les boîtes retournées et écarte les pièces cassées', () => {
    const { level, rejets } = parseLevel({
      name: 'Essai',
      bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
      boxes: [
        { minX: 200, minY: 100, maxX: 60, maxY: 20, material: 0 }, // retournée
        { minX: 0, minY: 0, maxX: 10, maxY: 10, material: 99 }, // matériau inconnu
        { minX: 0, minY: 0, maxX: 0, maxY: 50, material: 0 }, // épaisseur nulle
      ],
    })
    expect(level!.boxes).toHaveLength(1)
    expect(level!.boxes[0]).toEqual({ minX: 60, minY: 20, maxX: 200, maxY: 100, material: 0 })
    expect(rejets).toHaveLength(2)
  })

  it('refuse un document qui n’est pas un tableau', () => {
    expect(parseLevel('bonjour').level).toBeNull()
    expect(parseLevel({ bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 } }).level).toBeNull()
  })

  it('conserve les zones et le par', () => {
    const src = {
      name: 'Zoné',
      bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
      par: 3,
      zones: [{ minX: -200, minY: -200, maxX: 200, maxY: 200, force: 'vapeur', label: 'Le conduit' }],
    }
    const { level } = parseLevel(src)
    expect(level!.par).toBe(3)
    expect(level!.zones).toHaveLength(1)
    expect(zoneForceAt(level!, 0, 0)).toBe('vapeur')
    expect(zoneForceAt(level!, 900, 0)).toBe('libre')
    // une force inconnue retombe sur « libre » au lieu de casser le chargement
    const { level: l2 } = parseLevel({
      ...src,
      zones: [{ minX: -10, minY: -10, maxX: 10, maxY: 10, force: 'plasma' }],
    })
    expect(zoneForceAt(l2!, 0, 0)).toBe('libre')
  })
})

describe('levelIO — garde-fous du level design', () => {
  const base = (): LevelDef => ({
    name: 'Essai',
    code: '21-Z',
    journal: 'Une entrée de journal suffisamment longue pour passer le seuil des quarante signes.',
    bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
    spawn: { x: -950, y: 0, n: 900 },
    exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
    boxes: [{ minX: -100, minY: -400, maxX: -40, maxY: 400, material: 1 }],
    sponges: [],
    labels: [{ x: 1110, y: 0, text: 'SAS', tone: 'sas' }],
  })

  it('un tableau bien formé ne lève rien', () => {
    expect(checkLevel(base())).toEqual([])
  })

  it('signale un départ né dans une surface', () => {
    const l = base()
    l.boxes.push({ minX: -1000, minY: -100, maxX: -900, maxY: 100, material: 0 })
    const v = checkLevel(l)
    expect(v.some((x) => x.niveau === 'erreur' && /départ naît/.test(x.message))).toBe(true)
  })

  it('signale un sas hors cuve et un sas trop proche du départ', () => {
    const l = base()
    l.exit = { minX: 1150, minY: -60, maxX: 1400, maxY: 60 }
    expect(checkLevel(l).some((x) => x.niveau === 'erreur' && /déborde/.test(x.message))).toBe(true)
    const l2 = base()
    l2.exit = { minX: -600, minY: -60, maxX: -400, maxY: 60 }
    expect(checkLevel(l2).some((x) => /800 u/.test(x.message))).toBe(true)
  })

  it('signale une grille sans moyen de la franchir', () => {
    const l = base()
    l.boxes.push({ minX: 0, minY: -750, maxX: 40, maxY: 750, material: 5 })
    expect(checkLevel(l).some((x) => /grille barre/.test(x.message))).toBe(true)
    // avec une zone vapeur, l'avertissement disparaît
    l.zones = [{ minX: -400, minY: -300, maxX: -200, maxY: 300, force: 'vapeur' }]
    expect(checkLevel(l).some((x) => /grille barre/.test(x.message))).toBe(false)
  })
})

it('conserve le lit musical choisi pour le tableau', () => {
  const src = { ...TABLEAUX[0], ambiance: 'zone-hublot' }
  const { level } = parseLevel(JSON.parse(serializeLevel(src)))
  expect(level!.ambiance).toBe('zone-hublot')
  // sans valeur, le tableau suit la cuve : le champ ne doit pas apparaître
  const nu = parseLevel(JSON.parse(serializeLevel({ ...TABLEAUX[0], ambiance: undefined })))
  expect(nu.level!.ambiance).toBeUndefined()
  expect(serializeLevel(TABLEAUX[0])).not.toContain('ambiance')
})

it('le rayon d’action d’une zone est arrondi et irrégulier, inscrit dans son rectangle', () => {
  const z = { minX: -300, minY: -200, maxX: 300, maxY: 200, force: 'glace' as const }
  const lvl: LevelDef = {
    ...TABLEAUX[0],
    zones: [z],
  }
  // le centre est dedans, les COINS du rectangle sont dehors : la forme est
  // une lisière arrondie, pas le rectangle lui-même
  expect(zoneForceAt(lvl, 0, 0)).toBe('glace')
  expect(zoneForceAt(lvl, -295, -195)).toBe('libre')
  expect(zoneForceAt(lvl, 295, 195)).toBe('libre')
  // la lisière ondule : le rayon effectif varie selon la direction
  const rayon = (angle: number): number => {
    for (let r = 0; r < 1.4; r += 0.004) {
      const x = Math.cos(angle) * r * 300
      const y = Math.sin(angle) * r * 200
      if (zoneForceAt(lvl, x, y) === 'libre') return r
    }
    return 1.4
  }
  const rayons = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8].map(rayon)
  const min = Math.min(...rayons)
  const max = Math.max(...rayons)
  expect(max - min).toBeGreaterThan(0.04) // irrégulière…
  expect(min).toBeGreaterThan(0.6) // …mais jamais rachitique
  expect(max).toBeLessThanOrEqual(1.0) // et toujours inscrite dans le rectangle
})

it('conserve les décals au passage par l’éditeur (aller-retour JSON)', () => {
  const src = {
    ...TABLEAUX[0],
    decals: [
      { x: 500, y: 400, w: 320, h: 200, kind: 'tuyaux' as const },
      { x: 700, y: -400, w: 180, h: 180, kind: 'vanne' as const, flip: true, fade: 0.7 },
    ],
  }
  const { level, rejets } = parseLevel(JSON.parse(serializeLevel(src)))
  expect(rejets).toEqual([])
  expect(level!.decals).toHaveLength(2)
  expect(level!.decals![0].kind).toBe('tuyaux')
  expect(level!.decals![1]).toMatchObject({ kind: 'vanne', flip: true, fade: 0.7 })
  // un décal cassé est écarté sans faire tomber le tableau
  const { level: l2, rejets: r2 } = parseLevel({ ...src, decals: [{ x: 0, y: 0, w: 0, h: 10, kind: 'tuyaux' }] })
  expect(l2!.decals).toBeUndefined()
  expect(r2.length).toBe(1)
})

it('conserve les mécanismes laser (émetteurs, cibles, portes) à l’aller-retour', () => {
  const src = {
    ...TABLEAUX[0],
    lasers: [{ x: -600, y: 200, angle: 315 }],
    cibles: [{ x: 700, y: -300, r: 30 }],
    portes: [{ minX: 100, minY: -200, maxX: 140, maxY: 200, cible: 0 }],
  }
  const { level, rejets } = parseLevel(JSON.parse(serializeLevel(src)))
  expect(rejets).toEqual([])
  expect(level!.lasers).toEqual(src.lasers)
  expect(level!.cibles).toEqual(src.cibles)
  expect(level!.portes).toEqual(src.portes)
  // une porte asservie à une cible fantôme est signalée par le contrôle
  const verdicts = checkLevel({ ...level!, portes: [{ ...src.portes[0], cible: 4 }] })
  expect(verdicts.some((v) => v.niveau === 'erreur' && v.message.includes('cible nº 5'))).toBe(true)
})

it('conserve les rails magnétiques et écarte les moignons', () => {
  const src = {
    ...TABLEAUX[0],
    lasers: [{ x: -600, y: 0, angle: 0 }],
    cibles: [{ x: 700, y: -300, r: 30 }],
    rails: [{ points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }] }],
  }
  const { level, rejets } = parseLevel(JSON.parse(serializeLevel(src)))
  expect(rejets).toEqual([])
  expect(level!.rails).toEqual(src.rails)
  // un rail d'un seul point est écarté sans faire tomber le tableau
  const { level: l2, rejets: r2 } = parseLevel({ ...src, rails: [{ points: [{ x: 0, y: 0 }] }] })
  expect(l2!.rails).toBeUndefined()
  expect(r2.length).toBe(1)
  // un rail sans émetteur laser mérite un avertissement
  const verdicts = checkLevel({ ...level!, lasers: [] })
  expect(verdicts.some((v) => v.niveau === 'avertissement' && v.message.includes('rail'))).toBe(true)
})
