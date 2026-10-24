import { describe, expect, it } from 'vitest'
import { bornerAspiration, bornerSeuil, capaciteCoupelle, champCoupelle, COUPELLE_COURANT, sourcesCoupelles } from './coupelle'
import { canalActif, creerEtatRecepteurs, avancerRecepteurs } from './laser'
import { COUPELLE_ASPIRATION_DEFAUT, COUPELLE_SEUIL_MAX, COUPELLE_SEUIL_MIN } from './level'

describe('la coupelle — le trait en part du corps', () => {
  it('le trait est borné : ni une goutte, ni le corps entier', () => {
    expect(bornerSeuil(0.15)).toBe(0.15)
    expect(bornerSeuil(0)).toBe(COUPELLE_SEUIL_MIN)
    expect(bornerSeuil(2)).toBe(COUPELLE_SEUIL_MAX)
    expect(bornerSeuil(Number.NaN)).toBe(COUPELLE_SEUIL_MIN)
  })

  it('la capacité est le trait × la masse de référence, arrondi au-dessus, jamais nulle', () => {
    expect(capaciteCoupelle(0.1, 900)).toBe(90)
    expect(capaciteCoupelle(0.1, 905)).toBe(91) // 90,5 : on paie la goutte entamée
    expect(capaciteCoupelle(0.1, 0)).toBe(1) // même le corps le plus maigre paie
    // la même coupelle coûte la même PART à un corps gros ou maigre
    expect(capaciteCoupelle(0.2, 400) / 400).toBe(capaciteCoupelle(0.2, 1200) / 1200)
  })

  it('pleine, elle alimente son canal ; vide, non', () => {
    const defs = [
      { x: 0, y: 0, r: 60, seuil: 0.1, canal: 2 },
      { x: 300, y: 0, r: 60, seuil: 0.1, canal: 3 },
    ]
    expect(sourcesCoupelles(defs, [true, false])).toEqual([
      { canal: 2, active: true },
      { canal: 3, active: false },
    ])
  })
})

describe('le champ d’aspiration', () => {
  it('l’aspiration est bornée à 0..1, absente elle prend le défaut', () => {
    expect(bornerAspiration(undefined)).toBe(COUPELLE_ASPIRATION_DEFAUT)
    expect(bornerAspiration(Number.NaN)).toBe(COUPELLE_ASPIRATION_DEFAUT)
    expect(bornerAspiration(-1)).toBe(0)
    expect(bornerAspiration(3)).toBe(1)
  })

  it('à 0 il ne porte que dans la bouche, doucement ; à 1, à trois rayons et à plein courant', () => {
    expect(champCoupelle(60, 0)).toEqual({ portee: 60, courant: COUPELLE_COURANT * 0.25 })
    expect(champCoupelle(60, 1)).toEqual({ portee: 180, courant: COUPELLE_COURANT })
    // plus d'aspiration, c'est plus loin ET plus fort
    const doux = champCoupelle(60, 0.3)
    const fort = champCoupelle(60, 0.7)
    expect(fort.portee).toBeGreaterThan(doux.portee)
    expect(fort.courant).toBeGreaterThan(doux.courant)
  })
})

describe('le canal d’une coupelle se mêle aux pastilles du même numéro', () => {
  it('OU : une coupelle pleine suffit, sans aucune pastille', () => {
    const etat = creerEtatRecepteurs(0)
    expect(canalActif([], 4, undefined, etat, 0, [{ canal: 4, active: false }])).toBe(false)
    expect(canalActif([], 4, undefined, etat, 0, [{ canal: 4, active: true }])).toBe(true)
    // une source d'un autre numéro ne compte pas
    expect(canalActif([], 4, undefined, etat, 0, [{ canal: 5, active: true }])).toBe(false)
  })

  it('ET : la porte attend la pastille ET la coupelle qui portent son numéro', () => {
    const cibles = [{ canal: 1 }]
    const etat = creerEtatRecepteurs(1)
    const pleine = [{ canal: 1, active: true }]
    expect(canalActif(cibles, 1, 'et', etat, 0, pleine)).toBe(false) // la pastille manque
    avancerRecepteurs(cibles, [0], etat, 1)
    expect(canalActif(cibles, 1, 'et', etat, 1, [{ canal: 1, active: false }])).toBe(false) // la coupelle manque
    expect(canalActif(cibles, 1, 'et', etat, 1, pleine)).toBe(true)
  })

  it('canal négatif ou sans source : jamais ouvert, même en ET', () => {
    const etat = creerEtatRecepteurs(0)
    expect(canalActif([], -1, undefined, etat, 0, [{ canal: -1, active: true }])).toBe(false)
    expect(canalActif([], 7, 'et', etat, 0, [])).toBe(false)
  })
})
