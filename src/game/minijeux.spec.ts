import { describe, expect, it } from 'vitest'
import { aleaDeGraine } from './voie'
import { MAT_HYDROPHILE, MAT_HYDROPHOBE } from './level'
import {
  BAREME_TRAIT,
  CODE_COUPERET,
  COL_COUPERET,
  compteAuDela,
  estMiniJeu,
  noteTrait,
  phaseCouperet,
  tableauCouperet,
  tireTrait,
} from './minijeux'

describe('le trait et le barème', () => {
  it('le trait est une part du volume de départ, entre 35 et 70 %, au décilitre', () => {
    for (let i = 0; i < 50; i++) {
      const alea = aleaDeGraine(`p${i}`)
      const c = tireTrait(4, alea)
      expect(c).toBeGreaterThanOrEqual(1.4 - 1e-9)
      expect(c).toBeLessThanOrEqual(2.8 + 1e-9)
      expect(Math.round(c * 10) / 10).toBeCloseTo(c)
    }
    expect(tireTrait(4, () => 0)).toBeCloseTo(1.4)
    expect(tireTrait(4, () => 1)).toBeCloseTo(2.8)
    expect(tireTrait(0.1, () => 0)).toBeGreaterThanOrEqual(0.1) // jamais un trait à zéro
  })

  it('juste au trait la mémoire triple, proche elle vaut, loin la moitié, ratée rien', () => {
    expect(noteTrait(2, 2)).toEqual({ ecart: 0, verdict: 'juste', memoire: 15 })
    expect(noteTrait(2.1, 2).verdict).toBe('juste') // 5 %
    expect(noteTrait(2.3, 2)).toMatchObject({ verdict: 'proche', memoire: 5 })
    expect(noteTrait(1.5, 2)).toMatchObject({ verdict: 'loin', memoire: 3 }) // 25 %, 2,5 arrondi à 3
    expect(noteTrait(0.5, 2)).toMatchObject({ verdict: 'rate', memoire: 0 })
    expect(noteTrait(4, 2).verdict).toBe('rate') // trop, c'est raté aussi
    // le barème se règle
    expect(noteTrait(2, 2, { ...BAREME_TRAIT, base: 10 }).memoire).toBe(30)
  })
})

describe('le couperet — la lame et la pesée du corps', () => {
  it('la lame attend une période entière, puis tombe en rythme et reste baissée le temps de garde', () => {
    const r = { periode: 4, garde: 1 }
    expect(phaseCouperet(0, r)).toEqual({ tombee: false, avant: 4 })
    expect(phaseCouperet(3.5, r)).toEqual({ tombee: false, avant: 0.5 })
    expect(phaseCouperet(4, r)).toEqual({ tombee: true, avant: 0 })
    expect(phaseCouperet(4.9, r)).toEqual({ tombee: true, avant: 0 })
    expect(phaseCouperet(5, r).tombee).toBe(false)
    expect(phaseCouperet(5, r).avant).toBeCloseTo(3)
    expect(phaseCouperet(8, r).tombee).toBe(true) // la deuxième chute
    expect(phaseCouperet(12.5, r).tombee).toBe(true)
    // une garde plus longue que la période ne bloque jamais la lame en bas
    expect(phaseCouperet(4.95, { periode: 1, garde: 5 }).tombee).toBe(false)
  })

  it('seul ce qui fait corps au-delà du trait se pèse — les gouttes libres ne comptent pas', () => {
    const posX = [100, 700, 650, 900, 610]
    const corps = [true, true, false, true, true]
    expect(compteAuDela(posX.length, posX, 620, (i) => corps[i])).toBe(2) // 700 et 900 ; 650 est une goutte, 610 est en deçà
    expect(compteAuDela(0, [], 620, () => true)).toBe(0)
  })

  it('la salle porte son trait, sa lame sur le col, sa cuve et sa nature de mini-jeu', () => {
    const lv = tableauCouperet(1.7)
    expect(lv.code).toBe(CODE_COUPERET)
    expect(estMiniJeu(lv)).toBe(true)
    expect(estMiniJeu({ code: '21AC-100' })).toBe(false)
    expect(lv.minijeu).toMatchObject({ type: 'couperet', cible: 1.7, trait: COL_COUPERET.trait })
    expect(lv.journal).toContain('1,7 L')
    expect(lv.journal).toContain('4 secondes')
    // la lame est une porte scénarisée (aucun faisceau ne l'ouvre), centrée sur le trait, entre les montants
    expect(lv.portes).toHaveLength(1)
    const lame = lv.portes![0]
    expect(lame.canal).toBeLessThan(0)
    expect((lame.minX + lame.maxX) / 2).toBe(COL_COUPERET.trait)
    expect(lame.minY).toBe(-COL_COUPERET.demiHauteur)
    expect(lame.maxY).toBe(COL_COUPERET.demiHauteur)
    // le pad hydrophile est derrière le trait ; pas de sas : la sortie exigée
    // par LevelDef est hors des bornes, hors de portée du corps
    const pad = lv.boxes.find((b) => b.material === MAT_HYDROPHILE)!
    expect(pad.minX).toBeGreaterThan(COL_COUPERET.trait)
    expect(lv.exit.minX).toBeGreaterThan(lv.bounds.maxX)
    // la consigne est dans la salle, en trois pancartes numérotées
    expect(lv.labels.filter((l) => /^[123] · /.test(l.text))).toHaveLength(3)
    expect(lv.labels.some((l) => l.text.includes('1,7 L À DROITE'))).toBe(true)
    // le départ est en deçà du trait et dans aucune boîte
    expect(lv.spawn.x).toBeLessThan(COL_COUPERET.trait)
    for (const b of lv.boxes)
      expect(lv.spawn.x >= b.minX && lv.spawn.x <= b.maxX && lv.spawn.y >= b.minY && lv.spawn.y <= b.maxY).toBe(false)
  })
})

import {
  avancePalet,
  ETAT_PALET_NEUF,
  meilleurLancer,
  MINI_JEUX,
  notePalet,
  REGLAGES_PALET,
  REGLES_PALET,
  tableauPalet,
  tireMiniJeu,
  VERDICTS_PALET,
  type ObservationPalet,
} from './minijeux'

describe('le palet — les lancers et la maison', () => {
  const r = { ...REGLES_PALET, ligne: -400, maison: { x: 900, y: 0 }, rayons: [110, 250, 420] as [number, number, number], lancers: 3, reposVitesse: 25, reposDuree: 0.6, dureeMax: 14, partGel: 0.8 }
  const obs = (t: number, gele: boolean, x: number, vitesse: number, y = 0): ObservationPalet => ({ t, gele, x, y, vitesse })

  it('le verdict d’un lancer suit les trois cercles, au barème du trait', () => {
    expect(notePalet(50, r.rayons)).toMatchObject({ verdict: 'juste', memoire: 15 })
    expect(notePalet(200, r.rayons)).toMatchObject({ verdict: 'proche', memoire: 5 })
    expect(notePalet(400, r.rayons)).toMatchObject({ verdict: 'loin', memoire: 3 })
    expect(notePalet(800, r.rayons)).toMatchObject({ verdict: 'rate', memoire: 0 })
    expect(VERDICTS_PALET.juste).toBe('AU CENTRE')
  })

  it('le corps derrière la ligne arme ; la franchir lance ; la glace prise qui s’arrête finit le lancer', () => {
    let e = ETAT_PALET_NEUF
    expect(e.arme).toBe(false)
    e = avancePalet(e, obs(0, false, -1000, 0), r)
    expect(e.arme).toBe(true)
    e = avancePalet(e, obs(0.5, false, -380, 500), r) // la ligne est franchie : le lancer part, le gel est ordonné
    expect(e.enCours).toMatchObject({ debut: 0.5, pris: false })
    expect(e.arme).toBe(false)
    e = avancePalet(e, obs(0.6, false, -330, 500), r) // la glace n'a pas encore pris : pas un dégel
    expect(e.enCours).not.toBeNull()
    e = avancePalet(e, obs(0.8, true, -230, 480), r)
    expect(e.enCours?.pris).toBe(true)
    e = avancePalet(e, obs(2, true, 700, 60), r) // elle glisse encore
    expect(e.lancers).toHaveLength(0)
    e = avancePalet(e, obs(3, true, 860, 10), r) // presque arrêtée
    e = avancePalet(e, obs(3.4, true, 862, 8), r) // 0,4 s au repos : pas encore
    expect(e.lancers).toHaveLength(0)
    e = avancePalet(e, obs(3.7, true, 862, 8), r) // 0,7 s : le lancer est fini
    expect(e.lancers).toHaveLength(1)
    expect(e.lancers[0]).toMatchObject({ fin: 'repos', verdict: 'juste' })
    expect(e.lancers[0].distance).toBeCloseTo(38)
    expect(e.enCours).toBeNull()
    expect(e.fini).toBe(false)
    // rester à droite ne relance rien : il faut repasser derrière la ligne
    e = avancePalet(e, obs(4, false, 500, 0), r)
    expect(e.enCours).toBeNull()
    expect(e.arme).toBe(false)
    e = avancePalet(e, obs(5, false, -600, 0), r)
    expect(e.arme).toBe(true)
  })

  it('se dégeler en route ou traîner finit le lancer là où la glace est', () => {
    let e = avancePalet(ETAT_PALET_NEUF, obs(0, false, -600, 0), r)
    e = avancePalet(e, obs(1, true, -300, 400), r)
    expect(e.enCours?.pris).toBe(true)
    // dégelée en route : le lancer finit là où elle est
    e = avancePalet(e, obs(5, false, 500, 300), r)
    expect(e.lancers[0]).toMatchObject({ fin: 'degel' })
    expect(e.lancers[0].distance).toBeCloseTo(400)
    // le temps : quatorze secondes de glisse sans repos
    e = avancePalet(e, obs(6, false, -700, 200), r)
    e = avancePalet(e, obs(7, true, -300, 200), r)
    e = avancePalet(e, obs(21, true, 1200, 200), r)
    expect(e.lancers[1]).toMatchObject({ fin: 'temps' })
  })

  it('après le dernier lancer c’est fini, et le meilleur est le plus près du centre', () => {
    let e = ETAT_PALET_NEUF
    for (const x of [300, 880, 1400]) {
      e = avancePalet(e, obs(0, false, -900, 0), r)
      e = avancePalet(e, obs(1, true, -300, 500), r)
      e = avancePalet(e, obs(2, true, x, 0), r)
      e = avancePalet(e, obs(3, true, x, 0), r)
    }
    expect(e.lancers).toHaveLength(3)
    expect(e.fini).toBe(true)
    expect(meilleurLancer(e)!.distance).toBeCloseTo(20)
    expect(avancePalet(e, obs(4, false, -900, 0), r)).toBe(e) // plus rien ne bouge
    expect(meilleurLancer(ETAT_PALET_NEUF)).toBeNull()
  })

  it('la piste porte sa ligne, sa maison, ses réglages, ses pancartes — et pas de sas', () => {
    const lv = tableauPalet()
    expect(lv.minijeu?.type).toBe('palet')
    expect(lv.minijeu?.reglages).toEqual(REGLAGES_PALET)
    expect(REGLAGES_PALET.iceSlideDrag).toBeGreaterThan(0)
    expect(REGLAGES_PALET.ejectSpeed).toBeGreaterThan(1400) // l'élan se prend sans se vider
    expect(lv.spawn.x).toBeLessThan(REGLES_PALET.ligne)
    expect(REGLES_PALET.ligne).toBeLessThan(REGLES_PALET.maison.x)
    expect(lv.exit.minX).toBeGreaterThan(lv.bounds.maxX)
    expect(lv.labels.filter((l) => /^[12] · /.test(l.text))).toHaveLength(2)
    for (const b of lv.boxes)
      expect(lv.spawn.x >= b.minX && lv.spawn.x <= b.maxX && lv.spawn.y >= b.minY && lv.spawn.y <= b.maxY).toBe(false)
  })

  it('le tirage au catalogue rend chaque mini-jeu, et jamais autre chose', () => {
    expect(tireMiniJeu(() => 0)).toBe('couperet')
    expect(tireMiniJeu(() => 0.25)).toBe('palet')
    expect(tireMiniJeu(() => 0.45)).toBe('rafales')
    expect(tireMiniJeu(() => 0.65)).toBe('orbites')
    expect(tireMiniJeu(() => 0.99)).toBe('cibles')
    expect(tireMiniJeu(() => 1)).toBe('cibles')
    const vus = new Set<string>()
    for (let i = 0; i < 40; i++) vus.add(tireMiniJeu(aleaDeGraine(`m${i}`)))
    expect([...vus].sort()).toEqual([...MINI_JEUX].sort())
  })
})

import { arriveRafales, noteRafales, REGLES_RAFALES, tableauRafales, VERDICTS_RAFALES } from './minijeux'

describe('les rafales — la traversée et ce qu’il en reste', () => {
  it('le verdict suit la part gardée, au barème du trait', () => {
    const p = REGLES_RAFALES.paliers
    expect(noteRafales(1, p)).toMatchObject({ verdict: 'juste', memoire: 15 })
    expect(noteRafales(0.9, p).verdict).toBe('juste')
    expect(noteRafales(0.8, p)).toMatchObject({ verdict: 'proche', memoire: 5 })
    expect(noteRafales(0.5, p)).toMatchObject({ verdict: 'loin', memoire: 3 })
    expect(noteRafales(0.3, p)).toMatchObject({ verdict: 'rate', memoire: 0 })
    expect(VERDICTS_RAFALES.juste).toBe('INTACT')
  })

  it('l’arrivée se reconnaît au centre du corps', () => {
    expect(arriveRafales(1500, 0)).toBe(true)
    expect(arriveRafales(1300, 0)).toBe(false)
    expect(arriveRafales(1500, 700)).toBe(false)
  })

  it('le couloir : trois souffles scénarisés en alternance, des éponges sur les deux bords de chaque tronçon, l’arrivée à droite — et pas de sas', () => {
    const lv = tableauRafales()
    expect(lv.minijeu?.type).toBe('rafales')
    expect(lv.chasses).toHaveLength(3)
    expect(lv.chasses!.map((c) => c.angle)).toEqual([90, -90, 90])
    for (const c of lv.chasses!) expect(c.canal).toBeLessThan(0)
    // les tronçons se suivent sans se chevaucher, de gauche à droite
    for (let i = 1; i < 3; i++) expect(lv.chasses![i].minX).toBeGreaterThanOrEqual(lv.chasses![i - 1].maxX)
    expect(lv.sponges).toHaveLength(6)
    // chaque tronçon a son éponge en haut et en bas
    for (const c of lv.chasses!) {
      const dedans = lv.sponges.filter((sp) => sp.minX >= c.minX - 1 && sp.minX < c.maxX)
      expect(dedans.map((sp) => sp.minY).sort((a, b) => a - b)).toEqual([-600, 552])
    }
    expect(REGLES_RAFALES.arrivee.minX).toBeGreaterThan(lv.chasses![2].maxX - 1)
    expect(lv.spawn.x).toBeLessThan(lv.chasses![0].minX)
    expect(lv.exit.minX).toBeGreaterThan(lv.bounds.maxX)
    expect(lv.labels.filter((l) => /^[12] · /.test(l.text))).toHaveLength(2)
  })
})

import {
  avanceOrbites,
  CROISSANT_ORBITES_ANGLE,
  croissantOrbites,
  ETAT_ORBITES_NEUF,
  noteOrbites,
  REGLES_ORBITES,
  tableauOrbites,
  VERDICTS_ORBITES,
} from './minijeux'
import { traceTrajectoire } from './trajectoire'

describe('les orbites — trois puits, trois anneaux, un croissant', () => {
  const r = REGLES_ORBITES

  it('LA GARDE : le point-masse lancé comme le tableau le dit passe les trois anneaux dans l’ordre et finit dans la cible avant la durée', () => {
    const lv = tableauOrbites()
    const a = (r.depart.impulsion.angle * Math.PI) / 180
    const tr = traceTrajectoire(
      { x: r.depart.x, y: r.depart.y, vx: Math.cos(a) * r.depart.impulsion.vitesse, vy: Math.sin(a) * r.depart.impulsion.vitesse },
      { bounds: lv.bounds, boxes: lv.boxes, puits: r.puits, rayonCorps: 75, duree: r.dureeMax },
    )
    let e = ETAT_ORBITES_NEUF
    for (const p of tr.points) {
      e = avanceOrbites(e, { t: p.t, x: p.x, y: p.y }, r)
      if (e.fini) break
    }
    expect(e.anneauxPasses).toBe(3)
    expect(e.fin).toBe('cible')
    // un rebond de bord avant la cible trahirait un lancer qui sort de la salle
    const tCible = tr.points.find((p) => Math.hypot(p.x - r.cible.x, p.y - r.cible.y) <= r.cible.r)!.t
    expect(tr.evenements.filter((ev) => ev.type === 'bord' && ev.t < tCible)).toEqual([])
    expect(tCible).toBeLessThan(13)
  })

  it('les anneaux se passent dans l’ordre seulement ; la cible conclut ; le temps aussi', () => {
    let e = avanceOrbites(ETAT_ORBITES_NEUF, { t: 0, x: r.anneaux[1].x, y: r.anneaux[1].y }, r) // le deuxième avant le premier : rien
    expect(e.anneauxPasses).toBe(0)
    e = avanceOrbites(e, { t: 1, x: r.anneaux[0].x, y: r.anneaux[0].y }, r)
    expect(e.anneauxPasses).toBe(1)
    e = avanceOrbites(e, { t: 2, x: r.anneaux[0].x, y: r.anneaux[0].y }, r) // le même deux fois : une fois
    expect(e.anneauxPasses).toBe(1)
    e = avanceOrbites(e, { t: 3, x: r.cible.x, y: r.cible.y }, r)
    expect(e).toEqual({ anneauxPasses: 1, fini: true, fin: 'cible' })
    expect(avanceOrbites(e, { t: 4, x: 0, y: 0 }, r)).toBe(e)
    expect(avanceOrbites(ETAT_ORBITES_NEUF, { t: r.dureeMax, x: 0, y: 0 }, r)).toEqual({ anneauxPasses: 0, fini: true, fin: 'temps' })
  })

  it('le verdict : la part gardée dit le palier, chaque anneau manqué en retire un, pas de croissant vaut rien', () => {
    expect(noteOrbites(0.95, 3, 'cible', r)).toMatchObject({ verdict: 'juste', memoire: 15 })
    expect(noteOrbites(0.95, 2, 'cible', r)).toMatchObject({ verdict: 'proche', memoire: 5 })
    expect(noteOrbites(0.8, 2, 'cible', r)).toMatchObject({ verdict: 'loin', memoire: 3 })
    expect(noteOrbites(0.95, 0, 'cible', r)).toMatchObject({ verdict: 'rate', memoire: 0 })
    expect(noteOrbites(1, 3, 'temps', r)).toMatchObject({ verdict: 'rate', memoire: 0 })
    expect(VERDICTS_ORBITES.juste).toBe('EN ORBITE')
  })

  it('la salle : trois puits en quinconce au cœur de 450 (le vrai corps déchire à 300), le départ lancé, le croissant hydrophile au rayon de la cible, ouvert vers le corps — et pas de sas', () => {
    const lv = tableauOrbites()
    expect(lv.minijeu?.type).toBe('orbites')
    expect(lv.puits).toHaveLength(3)
    expect(lv.puits!.map((p) => Math.sign(p.x))).toEqual([-1, 1, -1])
    expect(lv.puits!.map((p) => p.rayon)).toEqual([450, 450, 450])
    expect(lv.spawn.impulsion).toEqual(r.depart.impulsion)
    const c = croissantOrbites(r.cible, CROISSANT_ORBITES_ANGLE)
    expect(lv.boxes).toEqual([c])
    expect(c.maxX - c.minX).toBe(2 * r.cible.r)
    expect(c.minX).toBeGreaterThan(lv.bounds.minX)
    expect(lv.exit.minX).toBeGreaterThan(lv.bounds.maxX)
    expect(lv.labels.filter((l) => /^[123] · /.test(l.text))).toHaveLength(3)
    // les cœurs ne se recouvrent pas
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++) expect(Math.hypot(lv.puits![i].x - lv.puits![j].x, lv.puits![i].y - lv.puits![j].y)).toBeGreaterThan(2 * lv.puits![i].rayon!)
  })
})

import {
  avanceCibles,
  ETAT_CIBLES_NEUF,
  MIRES_CIBLES,
  noteCibles,
  pointsTouche,
  REGLAGES_CIBLES,
  REGLES_CIBLES,
  tableauCibles,
  VERDICTS_CIBLES,
} from './minijeux'
import { sansSas } from './ronde'

describe('les cibles — des éclats de glace, des mires, trente secondes', () => {
  const r = REGLES_CIBLES
  const mires = MIRES_CIBLES

  it('une touche vaut les points de la mire au prorata de la taille : le premier éclat 100 %, un amas jusqu’au double, une miette au prorata', () => {
    // corps de départ 900, référence 10 % : un éclat de 90 vaut plein
    expect(pointsTouche(mires[0], 90, 900, r)).toBe(10)
    expect(pointsTouche(mires[0], 45, 900, r)).toBe(5)
    expect(pointsTouche(mires[0], 9, 900, r)).toBe(1)
    expect(pointsTouche(mires[0], 180, 900, r)).toBe(20)
    expect(pointsTouche(mires[0], 900, 900, r)).toBe(20) // le plafond
    expect(pointsTouche(mires[1], 90, 900, r)).toBe(5)
  })

  it('les touches s’ajoutent, la mire reste, le temps conclut', () => {
    let e = avanceCibles(ETAT_CIBLES_NEUF, 1, [], mires, 900, r)
    expect(e).toBe(ETAT_CIBLES_NEUF) // rien ne change : le même état
    e = avanceCibles(e, 2, [{ mire: 0, taille: 90 }], mires, 900, r)
    expect(e).toEqual({ points: 10, touches: 1, fini: false })
    e = avanceCibles(e, 3, [{ mire: 0, taille: 90 }, { mire: 2, taille: 45 }], mires, 900, r) // la même mire, encore
    expect(e).toEqual({ points: 25, touches: 3, fini: false })
    e = avanceCibles(e, 4, [{ mire: 7, taille: 90 }], mires, 900, r) // une mire qui n'existe pas : rien
    expect(e.points).toBe(25)
    const fin = avanceCibles(e, r.duree, [{ mire: 1, taille: 90 }], mires, 900, r)
    expect(fin).toEqual({ points: 30, touches: 4, fini: true })
    expect(avanceCibles(fin, 40, [{ mire: 1, taille: 90 }], mires, 900, r)).toBe(fin)
  })

  it('le verdict aux paliers', () => {
    expect(noteCibles(60, r)).toMatchObject({ verdict: 'juste', memoire: 15 })
    expect(noteCibles(35, r)).toMatchObject({ verdict: 'proche', memoire: 5 })
    expect(noteCibles(10, r)).toMatchObject({ verdict: 'loin', memoire: 3 })
    expect(noteCibles(0, r)).toMatchObject({ verdict: 'rate', memoire: 0 })
    expect(VERDICTS_CIBLES.juste).toBe('EN PLEIN')
  })

  it('la salle : la ronde couchée, toute en glace, les trois mires du croquis sous leurs arcs, le sol qui renvoie, le tir activé par ses réglages, pas de sas', () => {
    const lv = tableauCibles()
    expect(lv.minijeu?.type).toBe('cibles')
    expect(lv.puits!.map((p) => p.y)).toEqual([350, 350, 350])
    expect(lv.spawn.impulsion).toEqual(r.depart.impulsion)
    expect(lv.mires!.map((m) => m.points)).toEqual([10, 5, 10])
    for (const m of lv.mires!) expect(m.y).toBeLessThan(lv.puits![0].y - 350)
    expect(lv.zones![0].force).toBe('glace')
    expect(lv.reglages).toBe(REGLAGES_CIBLES)
    expect(REGLAGES_CIBLES.glaceTir).toBeGreaterThan(0)
    expect(lv.boxes.filter((b) => b.material === MAT_HYDROPHOBE).length).toBeGreaterThanOrEqual(3)
    expect(lv.boxes.every((b) => b.maxY < lv.puits![0].y - 350)).toBe(true) // rien ne barre la ronde
    expect(sansSas(lv)).toBe(true)
    expect(lv.labels.filter((l) => /^[123] · /.test(l.text))).toHaveLength(3)
  })
})
