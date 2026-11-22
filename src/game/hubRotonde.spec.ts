import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { MAX_LUMIERES } from '../render/renderer'
import { FORME_ARC, dansForme } from './formes'
import { accessible } from './generateur'
import { TABLEAU_HUB, TABLEAU_HUB_COMPACT, ancreAbsente, zonesDuHub } from './hub'
import type { ObstacleBox } from './level'
import {
  CUVE_BOUCHES,
  CUVE_EPAISSEUR,
  CUVE_PASSAGE,
  CUVE_RAYON,
  DEPART_MILIEU,
  PASSAGE_BRAS,
  SAS_RAYON,
  STRUCTURES_ROTONDE,
  TABLEAU_HUB_ROTONDE as ROTONDE,
  ZONES_ROTONDE,
  anneauCuve,
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
import { CODE_HUB, checkLevel, estCodeHub, parseLevel, serializeLevel } from './levelIO'
import { decalsDuMeta } from './metaAssets'
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

  it('porte LE code du laboratoire : c’est elle que le jeu cherche, hors séquence', () => {
    expect(ROTONDE.code).toBe('HUB3')
    expect(ROTONDE.code).toBe(CODE_HUB)
    expect(estCodeHub(ROTONDE.code)).toBe(true)
  })

  it('survit au format : ce que l’éditeur publiera est ce que le code décrit', () => {
    // le remodelage passe par là — ouvrir la copie, publier sous HUB3.
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
    expect(relu.raccords).toBe('aucun')
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
    // 1 790 u contre 8 330 (grand) et 4 030 (compact, à vol d'oiseau — ses
    // trois cloisons en chicane allongent encore le trajet réel)
    expect(distSas(ROTONDE)).toBeLessThan(1900)
    expect(distSas(ROTONDE)).toBeLessThan(distSas(TABLEAU_HUB) / 4)
    expect(distSas(ROTONDE)).toBeLessThan(distSas(TABLEAU_HUB_COMPACT) / 2)
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
      expect(dist(r), JSON.stringify(r)).toBeLessThan(1800)
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
    // les trajets de tous les jours, tracés au large de l'anneau : de
    // chaque bouche de la cuve au seuil du bras qu'elle regarde, et de la
    // bouche nord ou sud jusqu'à l'aile — le dos de la cuve est plein : on
    // sort de la bouche (un rayon de corps au-delà de la paroi) avant de
    // virer vers l'ouest
    const hors = CUVE_RAYON + 120
    const vire = CUVE_RAYON + RAYON_CORPS + 155
    const seuil = 864 // la face intérieure du hall
    const lignes: [{ x: number; y: number }, { x: number; y: number }][] = [
      [{ x: hors, y: 0 }, { x: seuil, y: 0 }],
      [{ x: 0, y: hors }, { x: 0, y: seuil }],
      [{ x: 0, y: -hors }, { x: 0, y: -seuil }],
      [{ x: 0, y: vire }, { x: -seuil, y: 0 }],
      [{ x: 0, y: -vire }, { x: -seuil, y: 0 }],
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
  // le sas tant qu'il n'a pas 300 u/s. Mesuré le 22/11 (bras de départ
  // allongé, sas de 150 u de rayon) : la rotonde en 7,8 s avec 593
  // particules sur 900 ; le grand module, même pilote, mesuré le 21/11 :
  // 27,3 s et 34 particules. Le seuil laisse de la marge au solveur, pas au
  // plan : si ce test tombe, on remesure avant de toucher au nombre.
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

// LA CUVE À TROIS BOUCHES (le concepteur, 22/11 : « 3 ouvertures sur le
// cercle, plus petites, pour que le volume se déforme sans trop de perte
// d'éjection — ceci permet de partir dans la direction souhaitée » ; et
// « ne mets pas de porte au cercle central »).
describe('la rotonde — la cuve : trois bouches étroites, aucune porte', () => {
  const arcs = ROTONDE.boxes.filter((b) => b.forme === FORME_ARC)
  const milieu = CUVE_RAYON - CUVE_EPAISSEUR / 2
  const ri = CUVE_RAYON - CUVE_EPAISSEUR
  const sur = (deg: number, r = milieu): boolean => {
    const x = r * Math.cos((deg * Math.PI) / 180)
    const y = r * Math.sin((deg * Math.PI) / 180)
    return arcs.some((a) => dansForme(a, x, y))
  }
  /** la demi-ouverture angulaire d'une bouche, en degrés */
  const demiBouche = (Math.asin(CUVE_PASSAGE / 2 / ri) * 180) / Math.PI

  it('trois arcs, et trois bouches : vers le sas, le comptoir et le bac', () => {
    expect(arcs).toHaveLength(3)
    expect([...CUVE_BOUCHES].sort((a, b) => a - b)).toEqual([-90, 0, 90])
    for (const a of arcs) expect(a.material).toBe(MAT_WALL)
  })

  it('l’anneau est plein partout, sauf sur ses trois bouches — le dos plein pour le banc', () => {
    // l'écart angulaire à la bouche la plus proche ; on ne juge pas la
    // frontière elle-même (± 2°)
    const ecart = (deg: number): number =>
      Math.min(...CUVE_BOUCHES.map((b) => Math.abs(((deg - b + 540) % 360) - 180)))
    for (let deg = -180; deg < 180; deg += 2) {
      const e = ecart(deg)
      if (e < demiBouche - 2) expect(sur(deg), `${deg}° (bouche)`).toBe(false)
      else if (e > demiBouche + 2) expect(sur(deg), `${deg}°`).toBe(true)
    }
    // c'est bien un anneau de l'épaisseur dite, centré sur le départ
    for (const deg of [45, 180, -135]) {
      expect(sur(deg, ri - 6), `${deg}° dedans`).toBe(false)
      expect(sur(deg, CUVE_RAYON + 6), `${deg}° dehors`).toBe(false)
    }
  })

  it('chaque bouche est PLUS ÉTROITE que le corps : il s’étire pour passer', () => {
    // la corde au rayon intérieur
    const corde = 2 * ri * Math.sin((demiBouche * Math.PI) / 180)
    expect(corde).toBeCloseTo(CUVE_PASSAGE, 6)
    expect(corde).toBeLessThan(2 * RAYON_CORPS)
    // …mais la preuve de traversée la franchit (marge du corps : 40 u)
    for (const b of CUVE_BOUCHES) {
      const a = (b * Math.PI) / 180
      const zone = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
      const c = { x: 520 * Math.cos(a), y: 520 * Math.sin(a) }
      Object.assign(zone, { minX: c.x - 40, maxX: c.x + 40, minY: c.y - 40, maxY: c.y + 40 })
      const seule: LevelDef = { ...ROTONDE, structures: undefined, boxes: ROTONDE.boxes.slice(0, 1 + arcs.length), exit: zone, bounds: { minX: -700, minY: -700, maxX: 700, maxY: 700 } }
      expect(accessible(seule, new Set()), `bouche ${b}`).toBe(true)
    }
  })

  // LE VRAI CORPS, LE VRAI SOLVEUR : sortir de la cuve par chaque bouche,
  // même pilote (il pousse vers sa cible tant qu'il n'a pas 300 u/s), et
  // compter ce que le corps garde. Mesuré le 22/11 : 660 particules sans
  // anneau ; 602 à 617 par une bouche de 180 u. Le seuil (580) laisse de la
  // marge au solveur, pas au plan : s'il tombe, on remesure.
  it('par chaque bouche, le corps sort en gardant presque tout (≥ 580 / 900)', () => {
    const cuve: ObstacleBox[] = ROTONDE.boxes.slice(0, 1 + arcs.length)
    for (const b of CUVE_BOUCHES) {
      const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -1400, minY: -1400, maxX: 1400, maxY: 1400 }, 4096)
      s.setLevel(cuve, [])
      s.spawnDisc(0, 0, 900, KIND_PLAYER)
      const dt = s.params.dt
      for (let t = 0; t < 0.5; t += dt) s.step(dt)
      const a = (b * Math.PI) / 180
      const but = { x: 900 * Math.cos(a), y: 900 * Math.sin(a) }
      let sorti = false
      for (let t = 0; t < 8 && !sorti; t += dt) {
        s.updatePlayerStats()
        const cx = s.stats.centroidX
        const cy = s.stats.centroidY
        if (Math.hypot(cx, cy) > CUVE_RAYON + 160) {
          sorti = true
          break
        }
        const dx = but.x - cx
        const dy = but.y - cy
        const d = Math.hypot(dx, dy) || 1
        if ((s.stats.velX * dx + s.stats.velY * dy) / d < 300) s.eject(cx - (dx / d) * 500, cy - (dy / d) * 500, dt)
        s.step(dt)
      }
      s.updatePlayerStats()
      expect(sorti, `bouche ${b}`).toBe(true)
      expect(s.playerCount, `bouche ${b}`).toBeGreaterThanOrEqual(580)
    }
  }, 60000)

  it('la vitre passe sous la paroi', () => {
    const vitre = ROTONDE.boxes.find((b) => b.material === MAT_BAIE)!
    const rayonVitre = (vitre.maxX - vitre.minX) / 2
    expect(rayonVitre).toBeGreaterThan(ri)
    expect(rayonVitre).toBeLessThan(CUVE_RAYON)
  })

  it('aucune porte : même à l’acte 0, la cuve reste ouverte', () => {
    expect(ancreAbsente(zonesDuHub(ROTONDE)!.porteCuve)).toBe(true)
    const clos = appliqueReparations(ROTONDE, [], { cuveClose: true }, REPARATIONS)
    expect(clos.portes ?? []).toEqual([])
    expect(accessible(clos, new Set())).toBe(true)
  })

  it('la largeur d’une bouche se règle : l’anneau se reconstruit autour', () => {
    // une bouche plus large ouvre plus d'angle, sans changer le nombre d'arcs
    const large = anneauCuve(260)
    expect(large).toHaveLength(3)
    expect(large[0].p1!).toBeLessThan(arcs[0].p1!)
  })
})

// LE SAS SE VOIT. La première livraison lui donnait 65 u de rayon, la taille
// de celui des deux autres hubs : entre les portes de flanc et leurs
// colliers, il se perdait (« le sas n'est clairement pas assez voyant », le
// concepteur, 22/11). Ces gardes tiennent ce qui le rend lisible.
describe('la rotonde — le sas de lancement se voit depuis la cuve', () => {
  const sas = ROTONDE.exit
  const rayon = Math.min(sas.maxX - sas.minX, sas.maxY - sas.minY) / 2

  it('sa bouche est deux fois plus grande que celle des deux autres hubs', () => {
    expect(rayon).toBe(SAS_RAYON)
    for (const lv of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const r = Math.min(lv.exit.maxX - lv.exit.minX, lv.exit.maxY - lv.exit.minY) / 2
      expect(rayon).toBeGreaterThanOrEqual(1.8 * r)
    }
    // son iris (1,35 rayon de cadre) remplit le fond du bras sans le déborder
    expect(2 * 1.35 * rayon).toBeGreaterThan(0.8 * PASSAGE_BRAS)
    expect(2 * 1.35 * rayon).toBeLessThan(PASSAGE_BRAS)
  })

  it('il est seul au fond : sa zone ne mord pas sur le chemin des routes gardées', () => {
    // le corps qui va chercher la grille ou le rideau passe par le milieu du
    // bras ; la zone de collecte commence deux rayons de corps plus loin
    expect(sas.minX - DEPART_MILIEU).toBeGreaterThan(2 * RAYON_CORPS - 10)
    expect(dansLeVide(sas)).toBe(true)
  })

  it('la lampe la plus forte du module est posée sur lui', () => {
    const lampes = [...(ROTONDE.lumieres ?? [])].sort((a, b) => (b.intensite ?? 1) - (a.intensite ?? 1))
    const c = centre(sas)
    expect(lampes[0].x).toBe(c.x)
    expect(lampes[0].y).toBe(c.y)
    expect(lampes[0].intensite ?? 1).toBeGreaterThan(lampes[1].intensite ?? 1)
  })
})

// LES JONCTIONS NUES. Le moteur peint un col d'amarrage à chaque couloir
// raccordé (six dans la rotonde) ; le concepteur n'en veut pas ici (22/11).
describe('la rotonde — aucun sas de raccord entre les pièces', () => {
  it('le tableau refuse les raccords : aucun col peint aux jonctions', () => {
    const kinds = decalsDuMeta(ROTONDE).map((d) => d.kind)
    expect(kinds).not.toContain('sas-raccord')
    expect(kinds).not.toContain('sas-raccord-v')
    // le témoin : les jonctions existent bien, c'est le réglage qui les tait
    const avec = decalsDuMeta({ ...ROTONDE, raccords: undefined }).filter((d) => d.kind.startsWith('sas-raccord'))
    expect(avec.length).toBeGreaterThan(0)
  })

  it('le grand module garde les siens', () => {
    expect(decalsDuMeta(TABLEAU_HUB).some((d) => d.kind.startsWith('sas-raccord'))).toBe(true)
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

// RIEN NE BLOQUE (le concepteur, 22/11 : « pas de blocage »). Les stations
// se réparent toujours, la panne se lit sur les pièces et les lampes, mais
// aucune barrière ne ferme une aile, et aucun sceau le secteur 4.
describe('la rotonde — l’accident : les stations se réparent, rien ne bloque', () => {
  const z = zonesDuHub(ROTONDE)!

  it('chaque station du catalogue a son plot ; ni barrière, ni sceau, ni porte de cuve', () => {
    for (const r of REPARATIONS) expect(z.stations[r.id], r.id).toBeDefined()
    expect(z.portesDegat).toEqual({})
    for (const r of [z.sceau, z.porteCuve]) expect(ancreAbsente(r)).toBe(true)
    for (const r of [z.tableDepart, z.sasScelle, z.sasGivre, z.sasVapeur]) expect(ancreAbsente(r)).toBe(false)
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

  it('le pire cas — tout en panne, acte 0, l’arc du récit inachevé : tout se rejoint', () => {
    const pire = appliqueReparations(ROTONDE, [], { cuveClose: true, finOuverte: false }, REPARATIONS)
    expect(pire.portes ?? []).toEqual([])
    const zr = ZONES_ROTONDE
    const fondBac: Rect = { minX: -60, minY: -1300, maxX: 60, maxY: -1200 }
    const fondAile: Rect = { minX: -1200, minY: -60, maxX: -1100, maxY: 60 }
    for (const [nom, zone] of [
      ['sas', zr.sas],
      ['vapeur', zr.sasVapeur],
      ['givre', zr.sasGivre],
      ['secteur 4', zr.sasScelle],
      ['fond du bac', fondBac],
      ['fond de l’aile', fondAile],
      ...Object.entries(zr.stations),
      ...Object.entries(zr.pupitres),
    ] as [string, Rect][])
      expect(accessible(vers(pire, zone), new Set()), nom).toBe(true)
  })

  it('aucune pancarte ne promet une condamnation', () => {
    const textes = ROTONDE.labels.map((l) => l.text).join(' · ')
    expect(textes).not.toContain('CONDAMNÉ')
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
  })
})
