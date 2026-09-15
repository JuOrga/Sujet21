// La matérialisation d'une porte : un rectangle tronqué par le front qui
// avance. Ce que le solveur reçoit, ce qu'on dessine et le temps que ça
// prend doivent raconter la même chose — c'est ici qu'on le tient.
import { describe, expect, it } from 'vitest'
import {
  PORTE_ALLURE_DEFAUT,
  PORTE_SENS_DEFAUT,
  type PorteDef,
} from './level'
import { dansForme, formeContact, type FormeContact } from './formes'
import {
  porteAvance,
  porteBoite,
  porteCharniere,
  porteCourse,
  porteCoupe,
  porteDuree,
  portePolygone,
} from './porte'

// une porte debout : 40 de large, 300 de haut, centrée à l'origine
const PORTE: PorteDef = { minX: -20, minY: -150, maxX: 20, maxY: 150, canal: 1 }
const RIDEAU: PorteDef = { ...PORTE, materialisation: 'rideau' }
const EVENTAIL: PorteDef = { ...PORTE, materialisation: 'eventail' }

const out: FormeContact = { dist: 0, nx: 0, ny: 1 }

describe('porte — le rideau', () => {
  it('par défaut il tombe du haut vers le bas : à mi-course, la moitié HAUTE existe', () => {
    expect(PORTE_SENS_DEFAUT).toBe(-90)
    const b = porteBoite(RIDEAU, 0.5)!
    expect(b.coupe).toBeDefined()
    expect(dansForme(b, 0, 75)).toBe(true) // en haut : déjà là
    expect(dansForme(b, 0, -75)).toBe(false) // en bas : pas encore
    // le front est horizontal, au milieu
    const { front } = portePolygone(RIDEAU, 0.5)
    expect(front.length).toBe(2)
    expect(front[0].y).toBeCloseTo(0, 6)
    expect(front[1].y).toBeCloseTo(0, 6)
  })

  it('une particule prise juste derrière le front est poussée DANS LE SENS du front, pas vers le bord', () => {
    const b = porteBoite(RIDEAU, 0.5)!
    // à 3 u au-dessus du front (dans la part matérialisée), mais à 17 u du
    // bord gauche : sans la coupe, le rectangle l'expulserait par la gauche
    // (la face la plus proche) — avec elle, vers le bas, devant le front
    formeContact(-3, 3, b, out)
    expect(out.dist).toBeLessThan(0)
    expect(out.nx).toBeCloseTo(0, 6)
    expect(out.ny).toBeCloseTo(-1, 6)
  })

  it('le sens se règle : à 0°, le front va d’ouest en est', () => {
    const b = porteBoite({ ...RIDEAU, sens: 0 }, 0.5)!
    expect(dansForme(b, -10, 0)).toBe(true)
    expect(dansForme(b, 10, 0)).toBe(false)
    const k = porteCoupe({ ...RIDEAU, sens: 0 }, 0.5)
    expect(k.nx).toBeCloseTo(1, 6)
    expect(k.ny).toBeCloseTo(0, 6)
  })

  it('la course est l’étendue du rectangle dans la direction du front', () => {
    expect(porteCourse(RIDEAU)).toBeCloseTo(300, 6)
    expect(porteCourse({ ...RIDEAU, sens: 0 })).toBeCloseTo(40, 6)
    // en oblique : la projection des coins
    expect(porteCourse({ ...RIDEAU, sens: 45 })).toBeCloseTo((40 + 300) / Math.SQRT2, 6)
  })

  it('la durée suit l’allure : 300 u à 300 u/s, une seconde — et deux fois moins vite, deux fois plus', () => {
    expect(PORTE_ALLURE_DEFAUT).toBe(300)
    expect(porteDuree(RIDEAU)).toBeCloseTo(1, 6)
    expect(porteDuree({ ...RIDEAU, allure: 150 })).toBeCloseTo(2, 6)
  })
})

describe('porte — l’éventail', () => {
  it('depuis un coin, un quart de tour ; depuis le milieu d’un côté, un demi-tour', () => {
    const so = porteCharniere(PORTE, 0)
    expect(so).toMatchObject({ x: -20, y: -150 })
    expect(so.a1 - so.a0).toBeCloseTo(Math.PI / 2, 9)
    const sud = porteCharniere(PORTE, 1)
    expect(sud).toMatchObject({ x: 0, y: -150 })
    expect(sud.a1 - sud.a0).toBeCloseTo(Math.PI, 9)
  })

  it('sur le coin sud-ouest, trigonométrique : à mi-course le front est à 45°, ce qui est sous lui existe', () => {
    const b = porteBoite(EVENTAIL, 0.5)!
    // sous la diagonale issue du coin (angle < 45°) : matérialisé
    expect(dansForme(b, 10, -140)).toBe(true)
    // au-dessus (angle > 45°) : pas encore
    expect(dansForme(b, -10, 100)).toBe(false)
  })

  it('horaire : le même front, parcouru à rebours', () => {
    const b = porteBoite({ ...EVENTAIL, horaire: true }, 0.5)!
    expect(dansForme(b, 10, -140)).toBe(false)
    expect(dansForme(b, -10, 100)).toBe(true)
  })

  it('la course est l’arc du bout le plus lointain — deux portes de même allure se ferment au même rythme', () => {
    const rMax = Math.hypot(40, 300)
    expect(porteCourse(EVENTAIL)).toBeCloseTo((Math.PI / 2) * rMax, 6)
    expect(porteCourse({ ...EVENTAIL, pivot: 1 })).toBeCloseTo(Math.PI * Math.hypot(20, 300), 6)
  })
})

describe('porte — la boîte, le polygone, l’avancement', () => {
  it('rien à 0, le rectangle plein (sans coupe) à 1, tronqué entre les deux', () => {
    expect(porteBoite(RIDEAU, 0)).toBeNull()
    expect(porteBoite(RIDEAU, 1)!.coupe).toBeUndefined()
    expect(porteBoite(RIDEAU, 0.3)!.coupe).toBeDefined()
    // une porte D'UN COUP n'est jamais tronquée
    expect(porteBoite(PORTE, 0.3)!.coupe).toBeUndefined()
  })

  it('le polygone dessiné est exactement la part matérialisée', () => {
    const { contour, front } = portePolygone(RIDEAU, 0.25)
    expect(contour.length).toBe(4)
    for (const q of contour) expect(q.y).toBeGreaterThanOrEqual(75 - 1e-9)
    expect(front.length).toBe(2)
    expect(portePolygone(RIDEAU, 1).contour.length).toBe(4)
    expect(portePolygone(RIDEAU, 1).front.length).toBe(0)
    expect(portePolygone(RIDEAU, 0).contour.length).toBe(0)
  })

  it('l’avancement court vers sa cible au temps de jeu, et n’avance pas à l’arrêt', () => {
    let s = 0
    s = porteAvance(RIDEAU, s, false, 0.25)
    expect(s).toBeCloseTo(0.25, 9)
    s = porteAvance(RIDEAU, s, false, 0) // pause
    expect(s).toBeCloseTo(0.25, 9)
    s = porteAvance(RIDEAU, s, false, 5)
    expect(s).toBe(1)
    // l'ouverture : le même geste à rebours
    s = porteAvance(RIDEAU, s, true, 0.5)
    expect(s).toBeCloseTo(0.5, 9)
  })

  it('une porte d’un coup saute à sa cible, quel que soit le temps écoulé', () => {
    expect(porteAvance(PORTE, 0, false, 0)).toBe(1)
    expect(porteAvance(PORTE, 1, true, 0)).toBe(0)
    expect(porteDuree(PORTE)).toBe(0)
  })
})
