import { describe, expect, it } from 'vitest'
import { aleaDeGraine } from './voie'
import { MAT_HYDROPHILE } from './level'
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
