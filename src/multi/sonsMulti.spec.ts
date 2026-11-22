import { describe, expect, it } from 'vitest'
import { RAYON_PALET, TERRAIN } from './hockey'
import { SALLE } from './partie'
import { SonsMulti, chiffreDecompte, entend, type Instantane } from './sonsMulti'
import { PHASE_BUT, PHASE_DECOMPTE, PHASE_FINI, PHASE_JEU, type CorpsTrame, type JeuTrame } from './trame'

const corps = (x: number, y: number, plus: Partial<CorpsTrame> = {}): CorpsTrame => ({
  compte: 900, prets: 0, base: 900, x, y, disperse: false, pousse: false, ouvert: false, viseeX: 0, viseeY: 0, ...plus,
})
const jeu = (plus: Partial<JeuTrame> = {}): JeuTrame => ({
  mode: 1, anneau: 0, paletActif: true, paletX: 1440, paletY: 810, paletVx: 0, paletVy: 0, tenuPar: -1, charge: 0, scores: [0, 0], phase: PHASE_JEU, buteur: -1, chrono: 180, decompte: 0, enOr: false, ...plus,
})
const hockey = (t: number, j: JeuTrame, c: CorpsTrame[] = [corps(720, 810), corps(2160, 810)]): Instantane => ({ t, corps: c, jeu: j, salle: TERRAIN, rayonPalet: RAYON_PALET })
const libre = (t: number, c: CorpsTrame[]): Instantane => ({ t, corps: c, jeu: null, salle: SALLE, rayonPalet: 0 })
const types = (avant: Instantane | null, apres: Instantane, moi = 0): string[] => entend(avant, apres, moi).map((s) => s.type)

describe('sons du multi — ce qu’on entend', () => {
  it('rien en arrivant, et rien quand rien ne change', () => {
    const a = hockey(1, jeu())
    expect(types(null, a)).toEqual([])
    expect(types(a, hockey(1.02, jeu()))).toEqual([])
  })

  it('le palet sur la paroi : un choc sec, d’autant plus fort qu’il allait vite', () => {
    const avant = hockey(1, jeu({ paletX: 2820, paletVx: 900 }))
    const sons = entend(avant, hockey(1.02, jeu({ paletX: 2830, paletVx: -765 })), 0)
    expect(sons.map((s) => s.type)).toEqual(['paroi'])
    expect(sons[0].force).toBeCloseTo(0.75, 2)
    // en haut aussi
    expect(types(hockey(1, jeu({ paletY: 60, paletVy: -400 })), hockey(1.02, jeu({ paletY: 50, paletVy: 340 })))).toEqual(['paroi'])
  })

  it('le palet contre un corps, loin des parois : un choc mat', () => {
    expect(types(hockey(1, jeu({ paletVx: 800 })), hockey(1.02, jeu({ paletVx: 300 })))).toEqual(['choc-palet'])
  })

  it('la glace qui le freine ne sonne pas', () => {
    expect(types(hockey(1, jeu({ paletVx: 800 })), hockey(1.02, jeu({ paletVx: 797 })))).toEqual([])
  })

  it('avalé, lancé : chacun son son, et l’on sait à qui il est', () => {
    const libreAvant = hockey(1, jeu())
    const tenu = hockey(1.02, jeu({ tenuPar: 1 }))
    expect(entend(libreAvant, tenu, 1)).toMatchObject([{ type: 'prise', mien: true }])
    expect(entend(libreAvant, tenu, 0)).toMatchObject([{ type: 'prise', mien: false }])
    const lance = entend(tenu, hockey(1.04, jeu({ tenuPar: -1, paletVx: -1500 })), 1)
    expect(lance).toMatchObject([{ type: 'lancer', mien: true }])
    expect(lance[0].force).toBeCloseTo(1, 2)
    // le saut de vitesse d'un lancer n'est pas pris pour un choc
    expect(lance.length).toBe(1)
  })

  it('un but : pour qui marque ou contre qui encaisse ; puis l’engagement', () => {
    const avant = hockey(1, jeu({ paletX: 20, paletVx: -900 }))
    const but = hockey(1.02, jeu({ paletActif: false, scores: [0, 1], phase: PHASE_BUT, buteur: 1 }))
    expect(entend(avant, but, 1)).toMatchObject([{ type: 'but', mien: true }])
    expect(entend(avant, but, 0)).toMatchObject([{ type: 'but', mien: false }])
    expect(types(but, hockey(3.1, jeu({ scores: [0, 1], buteur: 1 })))).toEqual(['engagement'])
  })

  it('le dernier but sonne la fin', () => {
    const avant = hockey(1, jeu({ scores: [4, 2] }))
    expect(types(avant, hockey(1.02, jeu({ paletActif: false, scores: [5, 2], phase: PHASE_FINI, buteur: 0 })))).toEqual(['fin'])
  })

  it('s’ouvrir et se refermer s’entendent, le sien plus fort que celui de l’autre', () => {
    const a = libre(1, [corps(900, 1000), corps(2900, 1000)])
    const b = libre(1.02, [corps(900, 1000, { ouvert: true }), corps(2900, 1000)])
    expect(entend(a, b, 0)).toMatchObject([{ type: 'ouvre', mien: true, force: 1 }])
    expect(entend(a, b, 1)).toMatchObject([{ type: 'ouvre', mien: false, force: 0.4 }])
    expect(types(b, libre(1.04, [corps(900, 1000), corps(2900, 1000)]))).toEqual(['ferme'])
  })

  it('deux corps fermés qui se heurtent : un seul son, à l’entrée au contact', () => {
    // deux corps de 900 particules : ~103 u de rayon chacun, au contact vers 220 u
    const loin = libre(1, [corps(1000, 1000), corps(1240, 1000)])
    const contact = libre(1.05, [corps(1012, 1000), corps(1228, 1000)])
    const sons = entend(loin, contact, 0)
    expect(sons.map((s) => s.type)).toEqual(['contact'])
    // 24 u de moins en 0,05 s : 480 u/s d'approche, le son est à pleine force
    expect(sons[0].force).toBe(1)
    // collés, ils ne sonnent plus
    expect(types(contact, libre(1.1, [corps(1014, 1000), corps(1226, 1000)]))).toEqual([])
  })

  it('deux corps OUVERTS qui se rejoignent fusionnent sans bruit de choc', () => {
    const o = { ouvert: true }
    expect(types(libre(1, [corps(1000, 1000, o), corps(1240, 1000, o)]), libre(1.05, [corps(1012, 1000, o), corps(1228, 1000, o)]))).toEqual([])
  })

  it('le décompte de l’engagement : un tic par chiffre, puis le « partez »', () => {
    const d = (t: number, decompte: number): Instantane => hockey(t, jeu({ phase: PHASE_DECOMPTE, decompte }))
    // on entre dans le décompte (après un but) : le « 3 »
    expect(types(hockey(1, jeu({ phase: PHASE_BUT, paletActif: false })), d(1.02, 2.1))).toEqual(['tic'])
    // tant que le chiffre ne change pas, rien
    expect(types(d(1.02, 2.1), d(1.3, 1.8))).toEqual([])
    // le « 2 », le « 1 »
    expect(types(d(1.6, 1.42), d(1.62, 1.39))).toEqual(['tic'])
    expect(types(d(2.3, 0.71), d(2.32, 0.69))).toEqual(['tic'])
    // et le départ
    expect(types(d(3, 0.02), hockey(3.02, jeu()))).toEqual(['engagement'])
  })

  it('le décompte n’affiche jamais « 4 »', () => {
    expect(chiffreDecompte(2.1)).toBe(3)
    expect(chiffreDecompte(1.41)).toBe(3)
    expect(chiffreDecompte(1.39)).toBe(2)
    expect(chiffreDecompte(0.01)).toBe(1)
  })

  it('la fin au temps, sans but, sonne aussi', () => {
    expect(types(hockey(1, jeu({ scores: [2, 1] })), hockey(1.02, jeu({ scores: [2, 1], phase: PHASE_FINI, paletActif: false, buteur: 0 })))).toEqual(['fin'])
  })

  it('le dash s’entend, à l’endroit du corps', () => {
    const a = libre(1, [corps(900, 1000), corps(2900, 1200)])
    const b = libre(1.02, [corps(900, 1000), corps(2900, 1200, { dash: true })])
    expect(entend(a, b, 1)).toMatchObject([{ type: 'dash', mien: true, x: 2900, y: 1200 }])
    // tant qu'il dure, il ne sonne qu'une fois
    expect(types(b, libre(1.04, [corps(900, 1000), corps(2900, 1200, { dash: true })]))).toEqual([])
  })

  it('des chocs en rafale ne sonnent qu’une fois : le palet coincé ne mitraille pas', () => {
    const s = new SonsMulti()
    const choc = { type: 'choc-palet' as const, force: 1, x: 0, y: 0, mien: true }
    expect(s.joue(choc, 0, 1000)).toBe(true)
    expect(s.joue(choc, 0, 1016)).toBe(false)
    expect(s.joue(choc, 0, 1100)).toBe(false)
    expect(s.joue(choc, 0, 1150)).toBe(true)
    // un autre type n'est pas retenu par celui-là, et un but ne l'est jamais
    expect(s.joue({ ...choc, type: 'paroi' }, 0, 1151)).toBe(true)
    expect(s.joue({ ...choc, type: 'but' }, 0, 1152)).toBe(true)
    expect(s.joue({ ...choc, type: 'but' }, 0, 1153)).toBe(true)
    expect(s.joues['choc-palet']).toBe(2)
  })

  it('sans audio (un test, un vieux navigateur), jouer ne casse rien et se compte', () => {
    const s = new SonsMulti()
    s.reveille()
    s.joue({ type: 'paroi', force: 1, x: 0, y: 0, mien: true })
    s.continu(1, 0.5)
    s.silence()
    s.ferme()
    expect(s.joues.paroi).toBe(1)
  })
})
