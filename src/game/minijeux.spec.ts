import { describe, expect, it } from 'vitest'
import { aleaDeGraine } from './voie'
import { BAREME_PESEE, CODE_PESEE, estMiniJeu, notePesee, tableauPesee, tirePesee } from './minijeux'

describe('la pesée — le trait et le barème', () => {
  it('la cible est une part du volume de départ, entre 35 et 70 %, au décilitre', () => {
    for (let i = 0; i < 50; i++) {
      const alea = aleaDeGraine(`p${i}`)
      const c = tirePesee(4, alea)
      expect(c).toBeGreaterThanOrEqual(1.4 - 1e-9)
      expect(c).toBeLessThanOrEqual(2.8 + 1e-9)
      expect(Math.round(c * 10) / 10).toBeCloseTo(c)
    }
    expect(tirePesee(4, () => 0)).toBeCloseTo(1.4)
    expect(tirePesee(4, () => 1)).toBeCloseTo(2.8)
    expect(tirePesee(0.1, () => 0)).toBeGreaterThanOrEqual(0.1) // jamais un trait à zéro
  })

  it('juste au trait la mémoire triple, proche elle vaut, loin la moitié, ratée rien', () => {
    expect(notePesee(2, 2)).toEqual({ ecart: 0, verdict: 'juste', memoire: 15 })
    expect(notePesee(2.1, 2).verdict).toBe('juste') // 5 %
    expect(notePesee(2.3, 2)).toMatchObject({ verdict: 'proche', memoire: 5 })
    expect(notePesee(1.5, 2)).toMatchObject({ verdict: 'loin', memoire: 3 }) // 25 %, 2,5 arrondi à 3
    expect(notePesee(0.5, 2)).toMatchObject({ verdict: 'rate', memoire: 0 })
    expect(notePesee(4, 2).verdict).toBe('rate') // trop, c'est raté aussi
    // le barème se règle
    expect(notePesee(2, 2, { ...BAREME_PESEE, base: 10 }).memoire).toBe(30)
  })

  it('la salle porte son trait, son sas et sa nature de mini-jeu', () => {
    const lv = tableauPesee(1.7)
    expect(lv.code).toBe(CODE_PESEE)
    expect(estMiniJeu(lv)).toBe(true)
    expect(estMiniJeu({ code: '21AC-100' })).toBe(false)
    expect(lv.minijeu).toEqual({ type: 'pesee', cible: 1.7 })
    expect(lv.journal).toContain('1,7 L')
    // le sas est dans les bornes, et le départ n'est dans aucune boîte
    expect(lv.exit.maxX).toBeLessThanOrEqual(lv.bounds.maxX)
    for (const b of lv.boxes)
      expect(lv.spawn.x >= b.minX && lv.spawn.x <= b.maxX && lv.spawn.y >= b.minY && lv.spawn.y <= b.maxY).toBe(false)
  })
})
