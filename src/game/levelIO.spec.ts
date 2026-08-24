import { describe, expect, it } from 'vitest'
import { checkLevel, estCodeHub, parseLevel, serializeLevel } from './levelIO'
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

  it('les formes survivent à l’aller-retour, bornées, défauts effacés', () => {
    const { level, rejets } = parseLevel({
      name: 'Formes',
      bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
      boxes: [
        { minX: 0, minY: 0, maxX: 100, maxY: 100, material: 0, forme: 1 }, // disque
        { minX: 0, minY: 0, maxX: 100, maxY: 100, material: 4, forme: 4, p0: 0.5, p1: 120 }, // arc réglé
        { minX: 0, minY: 0, maxX: 100, maxY: 100, material: 2, forme: 3, p0: 2 }, // coin orienté
        { minX: 0, minY: 0, maxX: 100, maxY: 100, material: 0, forme: 4, p0: 0.35, p1: 90 }, // arc aux défauts
        { minX: 0, minY: 0, maxX: 100, maxY: 100, material: 0, forme: 99, p0: 7 }, // forme inconnue
        { minX: 0, minY: 0, maxX: 100, maxY: 100, material: 0, forme: 2, skin: 3 }, // le skin est rect-only
      ],
    })
    expect(rejets).toEqual([])
    const bx = level!.boxes
    expect(bx[0]).toMatchObject({ forme: 1 })
    expect(bx[0].p0).toBeUndefined()
    expect(bx[1]).toMatchObject({ forme: 4, p0: 0.5, p1: 120 })
    expect(bx[2]).toMatchObject({ forme: 3, p0: 2 })
    // les défauts d'arc n'encombrent pas le fichier
    expect(bx[3].forme).toBe(4)
    expect(bx[3].p0).toBeUndefined()
    expect(bx[3].p1).toBeUndefined()
    // forme inconnue : retour au rectangle, paramètres balayés
    expect(bx[4].forme).toBeUndefined()
    expect(bx[4].p0).toBeUndefined()
    // l'habillage est calé sur la boîte : une forme n'en porte pas
    expect(bx[5].forme).toBe(2)
    expect(bx[5].skin).toBeUndefined()
    // et l'aller-retour est stable
    const again = parseLevel(JSON.parse(serializeLevel(level!)))
    expect(again.level!.boxes).toEqual(bx)
  })

  it('les lampes survivent à l’aller-retour, bornées, défauts effacés', () => {
    const { level, rejets } = parseLevel({
      name: 'Lampes',
      bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
      boxes: [],
      lumieres: [
        { x: 0, y: 100 }, // tout au défaut
        { x: -300, y: 0, h: 150, portee: 900, intensite: 1.4, couleur: '#FF8A3C' },
        { x: 300, y: 0, h: 9999, intensite: 99, couleur: 'rouge' }, // hors bornes
        { x: 0, y: -100, couleur: '#ffffff' }, // le blanc neutre s'efface
      ],
    })
    expect(rejets).toEqual([])
    const lm = level!.lumieres!
    expect(lm[0]).toEqual({ x: 0, y: 100 })
    // la couleur se normalise en minuscules ; une couleur illisible s'efface
    expect(lm[1]).toEqual({ x: -300, y: 0, h: 150, portee: 900, intensite: 1.4, couleur: '#ff8a3c' })
    expect(lm[2].h).toBe(2000)
    expect(lm[2].intensite).toBe(2)
    expect(lm[2].couleur).toBeUndefined()
    expect(lm[3]).toEqual({ x: 0, y: -100 })
    const again = parseLevel(JSON.parse(serializeLevel(level!)))
    expect(again.level!.lumieres).toEqual(lm)
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

  it('signale un évent sans moyen de le franchir', () => {
    const l = base()
    l.boxes.push({ minX: 0, minY: -750, maxX: 40, maxY: 750, material: 5 })
    expect(checkLevel(l).some((x) => /évent barre/.test(x.message))).toBe(true)
    // avec une zone vapeur, l'avertissement disparaît
    l.zones = [{ minX: -400, minY: -300, maxX: -200, maxY: 300, force: 'vapeur' }]
    expect(checkLevel(l).some((x) => /évent barre/.test(x.message))).toBe(false)
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

it('le rayon d’action d’une zone couvre TOUT son rectangle — murs et coins compris', () => {
  const z = { minX: -300, minY: -200, maxX: 300, maxY: 200, force: 'glace' as const }
  const lvl: LevelDef = {
    ...TABLEAUX[0],
    zones: [z],
  }
  // toute la zone répond : le centre, les bords ET les coins — l'eau
  // plaquée contre une paroi posée au ras de la zone compte comme dedans
  // (régression : la lisière ondulée inscrite laissait une bande morte le
  // long des murs, et le seuil des 95 % devenait inatteignable)
  expect(zoneForceAt(lvl, 0, 0)).toBe('glace')
  expect(zoneForceAt(lvl, 270, 0)).toBe('glace')
  expect(zoneForceAt(lvl, -270, 0)).toBe('glace')
  expect(zoneForceAt(lvl, 0, 178)).toBe('glace')
  expect(zoneForceAt(lvl, 0, -178)).toBe('glace')
  expect(zoneForceAt(lvl, -298, -198)).toBe('glace') // coin : plus de bande morte
  expect(zoneForceAt(lvl, 298, 198)).toBe('glace')
  expect(zoneForceAt(lvl, 299.9, 0)).toBe('glace') // au ras du mur : dedans
  // et rien ne déborde du rectangle déclaré
  expect(zoneForceAt(lvl, 305, 0)).toBe('libre')
  expect(zoneForceAt(lvl, 0, 205)).toBe('libre')
  expect(zoneForceAt(lvl, -301, -201)).toBe('libre')
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
    portes: [{ minX: 100, minY: -200, maxX: 140, maxY: 200, canal: 1 }],
  }
  const { level, rejets } = parseLevel(JSON.parse(serializeLevel(src)))
  expect(rejets).toEqual([])
  expect(level!.lasers).toEqual(src.lasers)
  expect(level!.cibles).toEqual(src.cibles)
  expect(level!.portes).toEqual(src.portes)
  // une porte asservie à un canal fantôme est signalée par le contrôle
  const verdicts = checkLevel({ ...level!, portes: [{ ...src.portes[0], canal: 5 }] })
  expect(verdicts.some((v) => v.niveau === 'erreur' && v.message.includes('canal nº 5'))).toBe(true)
})

it('canaux : le n° d’une cible survit, l’héritage porte.cible (indice) se traduit', () => {
  const src = {
    ...TABLEAUX[0],
    lasers: [{ x: -600, y: 200, angle: 315 }],
    // deux pastilles qui PARTAGENT le n° 1, une troisième à son propre n°
    cibles: [
      { x: 700, y: -300, r: 30 },
      { x: 700, y: 300, r: 30, canal: 1 },
      { x: 500, y: 0, r: 26, canal: 7 },
    ],
    portes: [
      { minX: 100, minY: -200, maxX: 140, maxY: 200, canal: 1, regle: 'et' as const },
      { minX: 200, minY: -200, maxX: 240, maxY: 200, canal: 7 },
    ],
  }
  const again = parseLevel(JSON.parse(serializeLevel(src)))
  expect(again.rejets).toEqual([])
  expect(again.level!.cibles).toEqual(src.cibles)
  expect(again.level!.portes).toEqual(src.portes)
  // un canal égal à la position reste implicite dans le fichier
  const brut = JSON.parse(serializeLevel(src)) as { cibles: Record<string, unknown>[] }
  expect(brut.cibles[0].canal).toBeUndefined()
  expect(brut.cibles[1].canal).toBe(1)
  // héritage : un vieux fichier où `cible` était un INDICE — la porte se
  // rattache au n° logique de la pastille désignée
  const vieux = parseLevel({
    ...JSON.parse(serializeLevel(TABLEAUX[0])),
    cibles: [{ x: 0, y: 0, r: 26 }, { x: 40, y: 0, r: 26, canal: 5 }],
    portes: [
      { minX: 10, minY: -30, maxX: 14, maxY: 30, cible: 1 },
      { minX: 20, minY: -30, maxX: 24, maxY: 30, cible: -1 },
    ],
  })
  expect(vieux.level!.portes![0].canal).toBe(5)
  expect(vieux.level!.portes![1].canal).toBe(-1) // scénarisée, conservée
  // le contrôle accepte un canal partagé et une porte scénarisée
  expect(checkLevel(vieux.level!).some((v) => v.message.includes('canal'))).toBe(false)
})

it('conserve les cachettes (pans voilés) et écarte celles de taille nulle', () => {
  const src = {
    ...TABLEAUX[0],
    caches: [{ minX: 100, minY: -200, maxX: 400, maxY: 100 }],
  }
  const { level, rejets } = parseLevel(JSON.parse(serializeLevel(src)))
  expect(rejets).toEqual([])
  expect(level!.caches).toEqual(src.caches)
  // bornes inversées : normalisées ; taille nulle : écartée avec un rejet
  const tordu = parseLevel({
    ...JSON.parse(serializeLevel(TABLEAUX[0])),
    caches: [
      { minX: 400, minY: 100, maxX: 100, maxY: -200 },
      { minX: 0, minY: 0, maxX: 0, maxY: 50 },
    ],
  })
  expect(tordu.level!.caches).toEqual([{ minX: 100, minY: -200, maxX: 400, maxY: 100 }])
  expect(tordu.rejets.length).toBe(1)
})

it('cachettes : style paroi, formes et rotation survivent à l’aller-retour', () => {
  const src = {
    ...TABLEAUX[0],
    caches: [
      { minX: 0, minY: 0, maxX: 200, maxY: 150, style: 'paroi' as const },
      { minX: -300, minY: -200, maxX: -100, maxY: 0, forme: 1, angle: 30 },
      { minX: 300, minY: 0, maxX: 500, maxY: 200, forme: 4, p0: 0.5, p1: 60 },
    ],
  }
  const { level, rejets } = parseLevel(JSON.parse(serializeLevel(src)))
  expect(rejets).toEqual([])
  expect(level!.caches).toEqual(src.caches)
  // un style inconnu ou une forme hors bornes s'effacent sans casser
  const brut = parseLevel({
    ...JSON.parse(serializeLevel(TABLEAUX[0])),
    caches: [{ minX: 0, minY: 0, maxX: 100, maxY: 100, style: 'x', forme: 9 }],
  })
  expect(brut.level!.caches).toEqual([{ minX: 0, minY: 0, maxX: 100, maxY: 100 }])
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

describe('levelIO — boîtes obliques', () => {
  it('l’angle d’une boîte survit à l’aller-retour JSON', () => {
    const src = JSON.parse(serializeLevel(TABLEAUX[0])) as Record<string, unknown>
    ;(src.boxes as Record<string, unknown>[])[0].angle = 30
    const { level } = parseLevel(src)
    expect(level?.boxes[0].angle).toBe(30)
    // et repart tel quel à la sérialisation
    const rejoue = parseLevel(JSON.parse(serializeLevel(level!)))
    expect(rejoue.level?.boxes[0].angle).toBe(30)
  })
})

describe('levelIO — mode des récepteurs (TOR/NOR)', () => {
  it('le mode nor survit à l’aller-retour, le TOR reste implicite', () => {
    const src = {
      bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
      spawn: { x: 0, y: 0, n: 100 },
      exit: { minX: 50, minY: -20, maxX: 90, maxY: 20 },
      boxes: [],
      lasers: [{ x: -90, y: 0, angle: 0 }],
      cibles: [
        { x: 0, y: 0, r: 26 },
        { x: 40, y: 0, r: 26, mode: 'nor' },
      ],
      portes: [{ minX: 10, minY: -30, maxX: 14, maxY: 30, canal: 2 }],
    }
    const { level } = parseLevel(src)
    expect(level).not.toBeNull()
    expect(level!.cibles![0].mode).toBeUndefined()
    expect(level!.cibles![1].mode).toBe('nor')
    const again = parseLevel(JSON.parse(serializeLevel(level!))).level
    expect(again!.cibles![0].mode).toBeUndefined()
    expect(again!.cibles![1].mode).toBe('nor')
  })

  it('lumière générale : sérialisée, relue, bornée à 0..1', () => {
    const base = (): LevelDef => ({
      name: 'Essai',
      code: '21-Z',
      journal: 'Une entrée de journal suffisamment longue pour passer le seuil des quarante signes.',
      bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
      spawn: { x: -950, y: 0, n: 900 },
      exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
      boxes: [],
      sponges: [],
      labels: [],
    })
    const relit = (l: unknown): LevelDef => parseLevel(l as object).level as LevelDef
    const lvl = relit(JSON.parse(serializeLevel({ ...base(), ambiante: 0.06 })))
    expect(lvl.ambiante).toBeCloseTo(0.06)
    // absente : elle le reste (le tableau garde le niveau historique)
    expect(relit(JSON.parse(serializeLevel(base()))).ambiante).toBeUndefined()
    // bornée : un fichier étranger ne peut pas injecter n'importe quoi
    expect(relit({ ...JSON.parse(serializeLevel(base())), ambiante: 7 }).ambiante).toBe(1)
  })

  it('cinématiques ancrées : avant/après et zone déclencheuse font le voyage', () => {
    const base = (): LevelDef => ({
      name: 'Essai',
      code: '21-Z',
      journal: 'Une entrée de journal suffisamment longue pour passer le seuil des quarante signes.',
      bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
      spawn: { x: -950, y: 0, n: 900 },
      exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
      boxes: [],
      sponges: [],
      labels: [],
    })
    const relit = (l: unknown): LevelDef => parseLevel(l as object).level as LevelDef
    const lvl = relit(
      JSON.parse(
        serializeLevel({
          ...base(),
          cineAvant: 'OUVERTURE',
          cineApres: 'FIN-21Z',
          zones: [{ minX: 0, minY: 0, maxX: 300, maxY: 200, force: 'libre', cine: 'SURPRISE' }],
        }),
      ),
    )
    expect(lvl.cineAvant).toBe('OUVERTURE')
    expect(lvl.cineApres).toBe('FIN-21Z')
    expect(lvl.zones![0].cine).toBe('SURPRISE')
    // absents : ils le restent — et un code démesuré est tronqué, pas gardé
    const nu = relit(JSON.parse(serializeLevel(base())))
    expect(nu.cineAvant).toBeUndefined()
    expect(nu.cineApres).toBeUndefined()
    const long = relit({ ...JSON.parse(serializeLevel(base())), cineAvant: 'X'.repeat(60) })
    expect(long.cineAvant).toHaveLength(24)
  })
})

describe('le code HUB : un mot-clé, pas une casse à deviner', () => {
  const nu = (code: string) => ({
    name: 'H',
    code,
    bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
    boxes: [],
  })
  it('canonise « hub », « Hub », «  HUB  » vers HUB', () => {
    for (const forme of ['hub', 'Hub', 'HUB', '  hUb  ']) {
      expect(parseLevel(nu(forme)).level!.code).toBe('HUB')
    }
  })
  it('ne touche pas aux autres codes', () => {
    expect(parseLevel(nu('21-A bis')).level!.code).toBe('21-A bis')
    expect(parseLevel(nu('21-hub')).level!.code).toBe('21-hub')
  })
  it('la famille des chantiers (hub2…) se canonise aussi', () => {
    expect(parseLevel(nu('hub2')).level!.code).toBe('HUB2')
    expect(parseLevel(nu(' Hub2 ')).level!.code).toBe('HUB2')
  })
  it('estCodeHub reconnaît toute la famille — et elle seule', () => {
    for (const oui of ['HUB', 'hub', ' Hub ', 'HUB2', 'hub2', 'HUB13']) {
      expect(estCodeHub(oui)).toBe(true)
    }
    // le hublot n'est pas un hub, ni les codes de salle ordinaires
    for (const non of ['HUBLOT', '21-A', '21-hub', 'HUB-2', '']) {
      expect(estCodeHub(non)).toBe(false)
    }
  })
})
