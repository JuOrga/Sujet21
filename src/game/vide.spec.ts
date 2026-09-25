import { describe, expect, it } from 'vitest'
import { MAT_VIDE, MAT_WALL, type ObstacleBox } from './level'
import { FORME_DISQUE } from './formes'
import {
  audessusDuVide,
  blocsVide,
  forceVide,
  majVide,
  menaceVide,
  nouvelEtatVide,
  remiseVide,
  VIDE_DELAI,
  VIDE_MONTEE,
} from './vide'

const boite = (material: number, extra: Partial<ObstacleBox> = {}): ObstacleBox => ({
  minX: -100,
  minY: -100,
  maxX: 100,
  maxY: 100,
  material,
  ...extra,
})

/** `secondes` de minuterie au pas de 1/60, dessus ou non. */
function attend(e: ReturnType<typeof nouvelEtatVide>, dessus: boolean, secondes: number): boolean {
  let prise = false
  for (let t = 0; t < Math.round(secondes * 60); t++) {
    if (majVide(e, dessus, 5, 7, 1 / 60)) prise = true
  }
  return prise
}

describe('le vide qui aspire — la minuterie', () => {
  it('seuls les blocs de VIDE comptent, toute forme comprise', () => {
    const vides = blocsVide([boite(MAT_WALL), boite(MAT_VIDE, { minX: 300, maxX: 500, forme: FORME_DISQUE })])
    expect(vides).toHaveLength(1)
    expect(audessusDuVide(vides, 400, 0)).toBe(true)
    expect(audessusDuVide(vides, 0, 0)).toBe(false) // le mur n'est pas un vide
    expect(audessusDuVide(vides, 305, 95)).toBe(false) // hors du disque, dans la boîte
  })

  it('le corps est pris au bout de VIDE_DELAI secondes, là où il était', () => {
    const e = nouvelEtatVide()
    expect(attend(e, true, VIDE_DELAI - 0.1)).toBe(false)
    expect(menaceVide(e)).toBeGreaterThan(0.9)
    expect(forceVide(e)).toBe(0)
    expect(attend(e, true, 0.2)).toBe(true)
    expect(e.prise).toBe(true)
    expect([e.oeilX, e.oeilY]).toEqual([5, 7])
  })

  it('ressortir à temps sauve, et le compte redescend deux fois plus vite', () => {
    const e = nouvelEtatVide()
    attend(e, true, 2)
    attend(e, false, 0.5)
    expect(e.expo).toBeCloseTo(1, 1)
    expect(menaceVide(e)).toBe(0) // plus dessus : plus d'alerte
    attend(e, false, 1)
    expect(e.expo).toBe(0)
    expect(e.prise).toBe(false)
  })

  it('la prise est sans retour, et le courant monte en VIDE_MONTEE', () => {
    const e = nouvelEtatVide()
    attend(e, true, VIDE_DELAI + 0.05)
    attend(e, false, VIDE_MONTEE / 2)
    expect(e.prise).toBe(true)
    expect(forceVide(e)).toBeGreaterThan(0.3)
    expect(forceVide(e)).toBeLessThan(0.7)
    attend(e, false, VIDE_MONTEE)
    expect(forceVide(e)).toBe(1)
    remiseVide(e)
    expect(e.prise).toBe(false)
    expect(forceVide(e)).toBe(0)
  })
})
