import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { MAX_LUMIERES } from '../render/renderer'
import { FORME_ARC, dansForme } from './formes'
import { accessible } from './generateur'
import { TABLEAU_HUB, TABLEAU_HUB_COMPACT, ancreAbsente, zonesDuHub } from './hub'
import {
  CUVE_BOUCHE,
  CUVE_EPAISSEUR,
  CUVE_RAYON,
  DEPART_MILIEU,
  PASSAGE_BRAS,
  STRUCTURES_ROTONDE,
  TABLEAU_HUB_ROTONDE as ROTONDE,
  ZONES_ROTONDE,
} from './hubRotonde'
import {
  MAT_BAIE,
  MAT_GRILLE,
  MAT_RIDEAU,
  MAT_WALL,
  dansBoite,
  sansPhysique,
  type LevelDef,
} from './level'
import { checkLevel, estCodeHub, parseLevel, serializeLevel } from './levelIO'
import { REPARATIONS, appliqueReparations } from './reparations'
import { niveauExpanse } from './structures'

type Rect = { minX: number; minY: number; maxX: number; maxY: number }
const dedans = (r: Rect, b: Rect): boolean =>
  r.minX >= b.minX && r.maxX <= b.maxX && r.minY >= b.minY && r.maxY <= b.maxY
const chevauche = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
const centre = (r: Rect): { x: number; y: number } => ({
  x: (r.minX + r.maxX) / 2,
  y: (r.minY + r.maxY) / 2,
})
const aire = (r: Rect): number => (r.maxX - r.minX) * (r.maxY - r.minY)

/** Le rayon du corps à 900 particules (params.ts : « le corps fait ~110 u
 *  de rayon ») — la marge que les lignes de trajet doivent aux consoles. */
const RAYON_CORPS = 105

/** Les parois que le SOLVEUR voit : les coques, le mobilier, sans les fonds. */
const murs = niveauExpanse(ROTONDE).boxes.filter((b) => !sansPhysique(b.material))

/** La zone est-elle dans le VIDE ? Ses quatre coins et son centre, hors de
 *  toute paroi — c'est le champ de la forme qui tranche, pas sa boîte. */
function dansLeVide(r: Rect): boolean {
  const c = centre(r)
  const points: [number, number][] = [
    [r.minX, r.minY],
    [r.maxX, r.minY],
    [r.minX, r.maxY],
    [r.maxX, r.maxY],
    [c.x, c.y],
  ]
  return points.every(([x, y]) => murs.every((b) => !dansBoite(b, x, y)))
}

/** La plus courte distance d'un segment à un rectangle (0 s'il le touche). */
function distanceSegmentRect(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect): number {
  let mini = Infinity
  const pas = 200
  for (let k = 0; k <= pas; k++) {
    const x = a.x + ((b.x - a.x) * k) / pas
    const y = a.y + ((b.y - a.y) * k) / pas
    const dx = Math.max(r.minX - x, 0, x - r.maxX)
    const dy = Math.max(r.minY - y, 0, y - r.maxY)
    mini = Math.min(mini, Math.hypot(dx, dy))
  }
  return mini
}

const toutRepare = REPARATIONS.map((r) => r.id)
/** La rotonde, avec le sas déplacé sur une zone : accessible() dit alors si
 *  CETTE zone se rejoint depuis la cuve. */
const vers = (lv: LevelDef, zone: Rect): LevelDef => ({ ...lv, exit: zone })

describe('la rotonde — un tableau valide, que la bibliothèque sait porter', () => {
  it('aucune erreur, et le sas se rejoint depuis la cuve', () => {
    expect(checkLevel(ROTONDE).filter((v) => v.niveau === 'erreur').map((v) => v.message)).toEqual([])
    expect(accessible(ROTONDE, new Set())).toBe(true)
  })

  it('porte un code de la famille du hub : jamais dans la séquence de l’expédition', () => {
    expect(ROTONDE.code).toBe('HUB3')
    expect(estCodeHub(ROTONDE.code)).toBe(true)
  })

  it('survit au format : ce que l’éditeur publiera est ce que le code décrit', () => {
    // la bascule passe par là — ouvrir la copie, la recoder HUB, publier.
    // Un champ que le format perdrait (une ancre, un pupitre, l'arc de la
    // cuve) ferait un hub publié différent du hub essayé.
    const relu = parseLevel(JSON.parse(serializeLevel(ROTONDE))).level!
    expect(relu.structures).toEqual(ROTONDE.structures)
    expect(relu.boxes).toEqual(ROTONDE.boxes)
    expect(relu.ancres).toEqual(ROTONDE.ancres)
    expect(relu.pupitres).toEqual(ROTONDE.pupitres)
    expect(relu.bancMemoires).toEqual(ROTONDE.bancMemoires)
    expect(relu.marchand).toEqual(ROTONDE.marchand)
    expect(relu.lumieres).toEqual(ROTONDE.lumieres)
    expect(relu.decals).toEqual(ROTONDE.decals)
    expect(relu.labels).toEqual(ROTONDE.labels)
    expect(relu.coque).toBe('structures')
    expect(relu.spawn).toEqual(ROTONDE.spawn)
    expect(relu.exit).toEqual(ROTONDE.exit)
  })
})

describe('la rotonde — LÉGÈRE : moins de pièces que les deux hubs livrés', () => {
  it('sept coques, et moins de blocs que le grand comme que le compact', () => {
    expect(STRUCTURES_ROTONDE).toHaveLength(7)
    const blocs = niveauExpanse(ROTONDE).boxes.length
    // mesuré le 21/11 : 19 blocs, contre 38 (grand) et 29 (compact)
    expect(blocs).toBeLessThan(niveauExpanse(TABLEAU_HUB).boxes.length * 0.6)
    expect(blocs).toBeLessThan(niveauExpanse(TABLEAU_HUB_COMPACT).boxes.length * 0.75)
  })

  it('une fonction, une console : aucun plot d’achat, un pupitre « marchand »', () => {
    expect(ROTONDE.plots).toBeUndefined()
    expect((ROTONDE.pupitres ?? []).map((q) => q.ecran)).toEqual([
      'records',
      'reparations',
      'station',
      'marchand',
    ])
    expect(ROTONDE.marchand).toBeDefined()
  })

  it('moins de pancartes que le grand module', () => {
    // mesuré le 21/11 : 24 contre 31 — dont huit pour les surfaces du bac
    expect(ROTONDE.labels.length).toBeLessThan(TABLEAU_HUB.labels.length)
  })

  it('n’allume pas plus de lampes que le moteur n’en tient, et le bandeau n’a pas de corps', () => {
    const lampes = ROTONDE.lumieres ?? []
    expect(lampes.length).toBeLessThanOrEqual(MAX_LUMIERES)
    for (const l of lampes.filter((x) => x.forme === 'bandeau')) expect(l.taille).toBe(0)
  })
})

describe('la rotonde — RAPIDE : tout est à une impulsion de la cuve', () => {
  const depart = ROTONDE.spawn
  const dist = (r: Rect): number => Math.hypot(centre(r).x - depart.x, centre(r).y - depart.y)
  const distSas = (lv: LevelDef): number =>
    Math.hypot(centre(lv.exit).x - lv.spawn.x, centre(lv.exit).y - lv.spawn.y)

  it('de la naissance au sas : cinq fois moins loin que dans le grand module', () => {
    // 1 505 u contre 8 330 (grand) et 4 030 (compact, à vol d'oiseau — ses
    // trois cloisons en chicane allongent encore le trajet réel)
    expect(distSas(ROTONDE)).toBeLessThan(1600)
    expect(distSas(ROTONDE)).toBeLessThan(distSas(TABLEAU_HUB) / 5)
    expect(distSas(ROTONDE)).toBeLessThan(distSas(TABLEAU_HUB_COMPACT) / 2.5)
  })

  it('aucun rendez-vous à plus de 2 000 u de la cuve', () => {
    const z = ZONES_ROTONDE
    const rendezVous: Rect[] = [
      z.sas,
      z.sasVapeur,
      z.sasGivre,
      z.sasScelle,
      z.banc,
      ...Object.values(z.stations),
      ...Object.values(z.pupitres),
    ]
    for (const r of rendezVous) expect(dist(r), JSON.stringify(r)).toBeLessThan(2000)
    // et les rendez-vous de CHAQUE visite (le sas, le marchand, le banc, les
    // trois consoles) tiennent dans 1 600 u
    for (const r of [z.sas, z.banc, ...Object.values(z.pupitres)])
      expect(dist(r), JSON.stringify(r)).toBeLessThan(1600)
  })

  it('RÈGLE 1 — l’axe du départ est libre : aucun écran ne s’ouvre de la cuve au sas', () => {
    const a = { x: depart.x, y: depart.y }
    const b = centre(ROTONDE.exit)
    for (const q of [...(ROTONDE.pupitres ?? []), ROTONDE.bancMemoires!])
      expect(distanceSegmentRect(a, b, q), JSON.stringify(q)).toBeGreaterThan(RAYON_CORPS)
    // la seule station sur l'axe est la table de départ — un toast, rien à
    // fermer — et c'est voulu : on la franchit pour partir
    const surAxe = Object.entries(ZONES_ROTONDE.stations)
      .filter(([, r]) => distanceSegmentRect(a, b, r) === 0)
      .map(([id]) => id)
    expect(surAxe).toEqual(['table-depart'])
    // et l'axe ne rencontre aucune paroi : la bouche de la cuve regarde le sas
    for (let k = 0; k <= 100; k++) {
      const x = a.x + ((b.x - a.x) * k) / 100
      const y = a.y + ((b.y - a.y) * k) / 100
      expect(murs.every((m) => !dansBoite(m, x, y)), `mur sur l’axe en x=${x}`).toBe(true)
    }
  })

  it('RÈGLE 2 — ce qui ouvre un écran se VISE : aucune console sur les lignes de la cuve aux bras', () => {
    // les trajets de tous les jours, tracés au large de l'anneau : de la
    // bouche de la cuve au seuil de chaque bras (l'aile se rejoint par le
    // nord ou par le sud de la cuve)
    const bouche = { x: CUVE_RAYON + 120, y: 0 }
    const seuil = 864 // la face intérieure du hall
    const lignes: [{ x: number; y: number }, { x: number; y: number }][] = [
      [bouche, { x: seuil, y: 0 }],
      [bouche, { x: 0, y: seuil }],
      [bouche, { x: 0, y: -seuil }],
      [{ x: 0, y: 560 }, { x: -seuil, y: 0 }],
      [{ x: 0, y: -560 }, { x: -seuil, y: 0 }],
    ]
    // le marchand est AU FOND de son bras : on y va exprès, il n'est sur le
    // chemin de rien — les trois consoles du hall et le banc, eux, bordent
    // des passages
    const z = ZONES_ROTONDE
    for (const q of [z.banc, z.pupitres.records, z.pupitres.reparations, z.pupitres.station])
      for (const [a, b] of lignes)
        expect(distanceSegmentRect(a, b, q), JSON.stringify(q)).toBeGreaterThan(RAYON_CORPS)
  })

  // LE VRAI CORPS, LE VRAI SOLVEUR. Un pilote sans finesse : il pousse vers
  // le sas tant qu'il n'a pas 300 u/s. Mesuré le 21/11 : la rotonde en 7,2 s
  // avec 583 particules sur 900 ; le grand module, même pilote, en 27,3 s
  // avec 34 particules (zz : 21,3 s et 394 à 450 u/s d'allure, contre 6,6 s
  // et 487). Le seuil laisse de la marge au solveur, pas au plan : si ce
  // test tombe, on remesure avant de toucher au nombre.
  it('de la naissance au sas en moins de 10 s, le corps aux trois cinquièmes au moins', () => {
    const ex = niveauExpanse(ROTONDE)
    const s = new FluidSim({ ...DEFAULT_PARAMS }, ROTONDE.bounds, 4096)
    s.setLevel(ex.boxes, ex.sponges)
    s.spawnDisc(ROTONDE.spawn.x, ROTONDE.spawn.y, ROTONDE.spawn.n, KIND_PLAYER)
    const dt = s.params.dt
    for (let t = 0; t < 0.5; t += dt) s.step(dt) // le corps se pose
    const but = centre(ROTONDE.exit)
    let arrive = -1
    for (let t = 0; t < 10 && arrive < 0; t += dt) {
      s.updatePlayerStats()
      const cx = s.stats.centroidX
      const cy = s.stats.centroidY
      if (cx > ROTONDE.exit.minX && cx < ROTONDE.exit.maxX && cy > ROTONDE.exit.minY && cy < ROTONDE.exit.maxY) {
        arrive = t
        break
      }
      const dx = but.x - cx
      const dy = but.y - cy
      const d = Math.hypot(dx, dy) || 1
      const allure = (s.stats.velX * dx + s.stats.velY * dy) / d
      // on éjecte À L'OPPOSÉ du but : le corps part vers lui
      if (allure < 300) s.eject(cx - (dx / d) * 500, cy - (dy / d) * 500, dt)
      s.step(dt)
    }
    expect(arrive).toBeGreaterThan(0)
    expect(arrive).toBeLessThan(10)
    expect(s.playerCount).toBeGreaterThanOrEqual(540)
  }, 60000)
})

describe('la rotonde — la cuve : l’anneau du menu, une bouche vers le sas', () => {
  const anneau = ROTONDE.boxes.find((b) => b.forme === FORME_ARC)!
  const milieu = CUVE_RAYON - CUVE_EPAISSEUR / 2
  const sur = (deg: number, r = milieu): boolean =>
    dansForme(anneau, r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180))

  it('l’anneau est plein partout, sauf sur sa bouche — à l’est', () => {
    for (let deg = CUVE_BOUCHE + 4; deg <= 360 - CUVE_BOUCHE - 4; deg += 4) expect(sur(deg), `${deg}°`).toBe(true)
    for (let deg = -CUVE_BOUCHE + 4; deg <= CUVE_BOUCHE - 4; deg += 4) expect(sur(deg), `${deg}°`).toBe(false)
    // c'est bien un anneau de l'épaisseur dite, centré sur le départ
    expect(sur(180, CUVE_RAYON - CUVE_EPAISSEUR - 6)).toBe(false)
    expect(sur(180, CUVE_RAYON + 6)).toBe(false)
    expect(anneau.material).toBe(MAT_WALL)
  })

  it('la bouche laisse passer le corps, et la vitre passe sous la paroi', () => {
    const corde = 2 * (CUVE_RAYON - CUVE_EPAISSEUR) * Math.sin((CUVE_BOUCHE * Math.PI) / 180)
    expect(corde).toBeGreaterThan(2 * RAYON_CORPS + 80)
    const vitre = ROTONDE.boxes.find((b) => b.material === MAT_BAIE)!
    const rayonVitre = (vitre.maxX - vitre.minX) / 2
    expect(rayonVitre).toBeGreaterThan(CUVE_RAYON - CUVE_EPAISSEUR)
    expect(rayonVitre).toBeLessThan(CUVE_RAYON)
  })

  it('acte 0 — le sujet naît ENFERMÉ : la porte de la cuve la clôt, et elle est la première', () => {
    const clos = appliqueReparations(ROTONDE, toutRepare, { cuveClose: true }, REPARATIONS)
    // la séquence ALERTE crève la brèche d'index 0
    expect(clos.portes![0]).toMatchObject(ZONES_ROTONDE.porteCuve)
    expect(accessible(clos, new Set())).toBe(false)
    expect(accessible(appliqueReparations(ROTONDE, toutRepare, {}, REPARATIONS), new Set())).toBe(true)
  })
})

describe('la rotonde — les trois routes : la matière garde les deux petites', () => {
  it('les trois passages du bras de départ coïncident avec leurs sorties', () => {
    const ex = niveauExpanse(ROTONDE).boxes
    const grille = ex.find((b) => b.material === MAT_GRILLE && b.maxX > 900)!
    const rideau = ex.find((b) => b.material === MAT_RIDEAU && b.maxX > 900)!
    for (const lame of [grille, rideau]) {
      expect((lame.minX + lame.maxX) / 2).toBe(DEPART_MILIEU)
      expect(lame.maxX - lame.minX).toBe(PASSAGE_BRAS)
    }
    // le gaz au nord, la glace au sud — comme dans les deux autres modules
    expect(grille.minY).toBeGreaterThan(0)
    expect(rideau.maxY).toBeLessThan(0)
    expect(ZONES_ROTONDE.sasVapeur.minY).toBeGreaterThan(grille.maxY)
    expect(ZONES_ROTONDE.sasGivre.maxY).toBeLessThan(rideau.minY)
  })

  it('sans fente : la lame murée, la sortie ne se rejoint plus', () => {
    // accessible() compte grille et rideau passants (un état les traverse).
    // Si la sortie se rejoignait encore une fois sa lame changée en paroi,
    // c'est qu'un jour la contourne : la matière ne garderait rien.
    for (const [mat, zone] of [
      [MAT_GRILLE, ZONES_ROTONDE.sasVapeur],
      [MAT_RIDEAU, ZONES_ROTONDE.sasGivre],
    ] as const) {
      expect(accessible(vers(ROTONDE, zone), new Set())).toBe(true)
      const ex = niveauExpanse(ROTONDE)
      const mure: LevelDef = {
        ...ex,
        structures: undefined,
        exit: zone,
        boxes: ex.boxes.map((b) => (b.material === mat && b.maxX > 900 ? { ...b, material: MAT_WALL } : b)),
      }
      expect(accessible(mure, new Set())).toBe(false)
    }
  })
})

describe('la rotonde — l’accident : les ancres posées, les ailes condamnées', () => {
  const z = zonesDuHub(ROTONDE)!

  it('chaque station du catalogue a son plot, chaque aile sa barrière', () => {
    for (const r of REPARATIONS) {
      expect(z.stations[r.id], r.id).toBeDefined()
      if (r.porte) expect((z.portesDegat[r.id] ?? []).length, r.id).toBeGreaterThan(0)
    }
    for (const r of [z.tableDepart, z.sasScelle, z.sceau, z.porteCuve, z.sasGivre, z.sasVapeur])
      expect(ancreAbsente(r)).toBe(false)
    expect(z.banc).toEqual(ZONES_ROTONDE.banc)
  })

  it('tous les rendez-vous tiennent dans les bornes, dans le VIDE', () => {
    const zr = ZONES_ROTONDE
    const zones: Rect[] = [
      zr.sas,
      zr.sasVapeur,
      zr.sasGivre,
      zr.sasScelle,
      zr.banc,
      zr.tableDepart,
      ...Object.values(zr.stations),
      ...Object.values(zr.pupitres),
    ]
    for (const r of zones) {
      expect(dedans(r, ROTONDE.bounds), JSON.stringify(r)).toBe(true)
      expect(dansLeVide(r), JSON.stringify(r)).toBe(true)
    }
  })

  it('en panne, le DÉPART reste ouvert — on ne condamne pas la sortie du jeu', () => {
    const accidente = appliqueReparations(ROTONDE, [], {}, REPARATIONS)
    expect(accessible(accidente, new Set())).toBe(true)
    expect(accessible(vers(accidente, ZONES_ROTONDE.sasVapeur), new Set())).toBe(true)
    expect(accessible(vers(accidente, ZONES_ROTONDE.sasGivre), new Set())).toBe(true)
  })

  it('le bac et l’aile sont CONDAMNÉS tant que leur station est en panne, ouverts ensuite', () => {
    const fondBac: Rect = { minX: -60, minY: -1300, maxX: 60, maxY: -1200 }
    const fondAile: Rect = { minX: -1200, minY: -60, maxX: -1100, maxY: 60 }
    for (const [id, zone] of [
      ['bac-sable', fondBac],
      ['aile-endormis', fondAile],
    ] as const) {
      const sans = appliqueReparations(ROTONDE, toutRepare.filter((x) => x !== id), {}, REPARATIONS)
      expect(accessible(vers(sans, zone), new Set()), `${id} en panne`).toBe(false)
      const avec = appliqueReparations(ROTONDE, toutRepare, {}, REPARATIONS)
      expect(accessible(vers(avec, zone), new Set()), `${id} réparé`).toBe(true)
    }
  })

  it('le secteur 4 : la passerelle PUIS le sceau — seule la fin de l’arc l’ouvre', () => {
    const scelle = ZONES_ROTONDE.sasScelle
    const sansPasserelle = appliqueReparations(ROTONDE, toutRepare.filter((x) => x !== 'passerelle-4'), { finOuverte: true }, REPARATIONS)
    expect(accessible(vers(sansPasserelle, scelle), new Set())).toBe(false)
    const sousSceau = appliqueReparations(ROTONDE, toutRepare, {}, REPARATIONS)
    expect(accessible(vers(sousSceau, scelle), new Set())).toBe(false)
    const ouvert = appliqueReparations(ROTONDE, toutRepare, { finOuverte: true }, REPARATIONS)
    expect(accessible(vers(ouvert, scelle), new Set())).toBe(true)
    // et l'ordre des prix est celui du plan : l'aile (50) se paie avant la
    // passerelle (60), dont le plot est AU FOND de l'aile
    const prix = (id: string): number => REPARATIONS.find((r) => r.id === id)!.prix
    expect(prix('aile-endormis')).toBeLessThan(prix('passerelle-4'))
    expect(ZONES_ROTONDE.stations['passerelle-4'].maxX).toBeLessThan(ZONES_ROTONDE.portesDegat['aile-endormis'][0].minX)
  })

  it('les plots où l’on PAIE sont devant leur barrière, jamais derrière', () => {
    const accidente = appliqueReparations(ROTONDE, [], {}, REPARATIONS)
    for (const id of ['eclairage', 'table-depart', 'mur-records', 'bac-sable', 'distillateur', 'aile-endormis'])
      expect(accessible(vers(accidente, ZONES_ROTONDE.stations[id]), new Set()), id).toBe(true)
  })
})

describe('la rotonde — les consoles et le décor des stations', () => {
  const consoles = ROTONDE.pupitres ?? []
  const stations = ZONES_ROTONDE.stations

  it('deux consoles ne se recouvrent pas, et aucune ne touche le banc', () => {
    const toutes: Rect[] = [...consoles, ROTONDE.bancMemoires!]
    for (let i = 0; i < toutes.length; i++)
      for (let k = i + 1; k < toutes.length; k++) expect(chevauche(toutes[i], toutes[k])).toBe(false)
  })

  it('le mur des records : la console DANS le plot de sa station, sans le couvrir', () => {
    const rec = consoles.find((q) => q.ecran === 'records')!
    expect(dedans(rec, stations['mur-records'])).toBe(true)
    expect(aire(rec) / aire(stations['mur-records'])).toBeLessThan(0.75)
    // en panne elle disparaît — et elle seule
    const sans = appliqueReparations(ROTONDE, toutRepare.filter((x) => x !== 'mur-records'), {}, REPARATIONS)
    expect((sans.pupitres ?? []).map((q) => q.ecran)).toEqual(['reparations', 'station', 'marchand'])
  })

  it('le banc s’adosse à la cuve : le corps posé contre l’anneau a son centre dedans', () => {
    const banc = ROTONDE.bancMemoires!
    expect(banc.maxX).toBeLessThan(-CUVE_RAYON)
    expect(banc.minX).toBeLessThan(-(CUVE_RAYON + RAYON_CORPS + 40))
    expect(banc.minY).toBeLessThan(0)
    expect(banc.maxY).toBeGreaterThan(0)
  })

  // LA PLAQUE « EN PANNE » se pose au centre du plot de sa station. Deux
  // plots sur une même ligne, à moins d'une plaque d'écart, et l'une masque
  // l'autre (les pancartes ne se chevauchent jamais : la seconde cède). Vu
  // sur le plan du module accidenté : le mur des records, d'abord posé au
  // dos de la cuve, tombait à 330 u de l'aile des endormis, sur le même axe.
  it('en panne, deux plaques ne tombent jamais sur la même ligne à moins de 400 u', () => {
    const plots = Object.entries(stations)
    for (let i = 0; i < plots.length; i++)
      for (let k = i + 1; k < plots.length; k++) {
        const a = centre(plots[i][1])
        const b = centre(plots[k][1])
        const memeLigne = Math.abs(a.y - b.y) < 200
        if (memeLigne) expect(Math.abs(a.x - b.x), `${plots[i][0]} / ${plots[k][0]}`).toBeGreaterThan(400)
      }
  })

  it('le tableau des avaries ne dépend d’AUCUNE station', () => {
    const av = consoles.find((q) => q.ecran === 'reparations')!
    for (const [id, r] of Object.entries(stations)) expect(chevauche(av, r), id).toBe(false)
    // ni lui ni le plan, ni le marchand ne s'éteignent quand TOUT est en panne
    const accidente = appliqueReparations(ROTONDE, [], {}, REPARATIONS)
    expect((accidente.pupitres ?? []).map((q) => q.ecran)).toEqual(['reparations', 'station', 'marchand'])
  })

  it('chaque pièce de station ne s’assombrit que pour SA station', () => {
    const pieces: Record<string, string> = {
      eclairage: 'hub-eclairage',
      distillateur: 'hub-distillateur',
      'table-depart': 'hub-table-depart',
      'bac-sable': 'hub-bac-sable',
      'mur-records': 'hub-mur-records',
    }
    for (const r of REPARATIONS) {
      const sans = appliqueReparations(ROTONDE, toutRepare.filter((x) => x !== r.id), {}, REPARATIONS)
      const sombres = (sans.decals ?? []).filter((d) => d.panne).map((d) => d.kind)
      expect(sombres, r.id).toEqual(pieces[r.id] ? [pieces[r.id]] : [])
    }
  })

  it('l’écran du mur des records s’éteint avec lui, et avec lui seul', () => {
    for (const r of REPARATIONS) {
      const sans = appliqueReparations(ROTONDE, toutRepare.filter((x) => x !== r.id), {}, REPARATIONS)
      const eteints = (sans.decals ?? []).filter((d) => d.kind === 'ecran-off').length
      expect(eteints, r.id).toBe(r.id === 'mur-records' ? 1 : 0)
    }
  })

  it('la signalétique dit les lieux et les routes', () => {
    const textes = ROTONDE.labels.map((l) => l.text).join(' · ')
    for (const t of [
      'MODULE MÉDUSE|LA CUVE',
      'PROTOCOLE 21|SAS DE LANCEMENT',
      'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE',
      'SORTIE DE VAPEUR|LA DESCENTE DU JOUR',
      'LE BANC DES MÉMOIRES|TISSER LES LIENS',
      'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE',
      'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR',
      'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ',
      'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU',
      'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS',
      'LE DISTILLATEUR|LA PRIME DU RETOUR',
    ])
      expect(textes).toContain(t)
    // les pancartes que la panne retire portent une CLÉ, pas seulement un texte
    const cles = new Set(ROTONDE.labels.map((l) => l.cle).filter(Boolean))
    for (const r of REPARATIONS) for (const cle of r.labelsCaches) expect(cles.has(cle), cle).toBe(true)
    expect(cles.has('hub.secteur-scelle')).toBe(true)
    expect(cles.has('hub.acces-condamne')).toBe(true)
  })
})
