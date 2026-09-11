// Le contrat de l'avis sur une musique : un avis par personne et par
// piste, le total en face, le neutre qui retire le sien et rien d'autre —
// et un document d'ailleurs ne casse rien : seules les pistes connues, à
// +1 ou −1, sous un nom non vide, survivent à la relecture.
import { describe, expect, it } from 'vitest'
import {
  auteurAvis,
  avisDe,
  bilanAvis,
  ligneAvis,
  ligneBilan,
  lisAvisEcoute,
  memesAvis,
  poseAvis,
  totalDe,
} from './ecouteAvis'
import { PISTES_ECOUTE, type PisteEcoute } from './jukebox'

const pistes: PisteEcoute[] = [
  { fichier: 'a', titre: 'A', famille: 'lit', enJeu: true },
  { fichier: 'b', titre: 'B', famille: 'lit', enJeu: false },
  { fichier: 'c', titre: 'C', famille: 'ambiance', enJeu: false },
]

describe('L’avis sur une musique de l’écoute', () => {
  it('un document neuf n’a d’avis sur rien ; chacun pose le sien, et le total les somme', () => {
    const vide = lisAvisEcoute(null, pistes)
    expect(vide.avis).toEqual({})
    expect(avisDe(vide, 'a', 'JULIEN')).toBe(0)
    expect(totalDe(vide, 'a')).toEqual({ pour: 0, contre: 0, total: 0 })

    const d1 = poseAvis(vide, 'a', 1, 'JULIEN', 'd1')
    expect(avisDe(d1, 'a', 'JULIEN')).toBe(1)
    expect(avisDe(d1, 'a', 'MARIE')).toBe(0)
    // l'ancien document n'est pas touché : le lecteur garde ce qu'il a
    expect(avisDe(vide, 'a', 'JULIEN')).toBe(0)

    const d2 = poseAvis(poseAvis(d1, 'a', 1, 'MARIE', 'd2'), 'a', -1, 'PAUL', 'd3')
    expect(totalDe(d2, 'a')).toEqual({ pour: 2, contre: 1, total: 1 })
    // changer d'avis remplace le sien, sans toucher aux autres
    const d3 = poseAvis(d2, 'a', -1, 'JULIEN', 'd4')
    expect(avisDe(d3, 'a', 'JULIEN')).toBe(-1)
    expect(d3.avis.a.JULIEN).toEqual({ avis: -1, date: 'd4' })
    expect(totalDe(d3, 'a')).toEqual({ pour: 1, contre: 2, total: -1 })
  })

  it('le neutre retire SON avis et rien d’autre ; la dernière ligne partie, la piste disparaît du document', () => {
    let d = poseAvis(poseAvis(lisAvisEcoute(null, pistes), 'a', 1, 'JULIEN', 'x'), 'a', -1, 'MARIE', 'x')
    d = poseAvis(d, 'a', 0, 'JULIEN', 'x')
    expect(avisDe(d, 'a', 'JULIEN')).toBe(0)
    expect(avisDe(d, 'a', 'MARIE')).toBe(-1)
    expect('JULIEN' in d.avis.a).toBe(false)
    d = poseAvis(d, 'a', 0, 'MARIE', 'x')
    expect('a' in d.avis).toBe(false)
    // se remettre au neutre sans avoir d'avis ne crée rien
    expect(poseAvis(d, 'b', 0, 'JULIEN', 'x').avis).toEqual({})
  })

  it('sans nom de borne, l’avis se range sous « anonyme » — et tous les anonymes ne font qu’un', () => {
    expect(auteurAvis('')).toBe('anonyme')
    expect(auteurAvis('  ')).toBe('anonyme')
    expect(auteurAvis(' JULIEN ')).toBe('JULIEN')
    expect(auteurAvis('X'.repeat(60))).toBe('X'.repeat(40))
    const d = poseAvis(poseAvis(lisAvisEcoute(null, pistes), 'a', 1, '', 'x'), 'a', -1, '   ', 'y')
    expect(d.avis.a).toEqual({ anonyme: { avis: -1, date: 'y' } })
    expect(avisDe(d, 'a', '')).toBe(-1)
  })

  it('la relecture ramène le document dans ses bornes : pistes connues, auteurs non vides, +1 ou −1', () => {
    const d = lisAvisEcoute(
      {
        avis: {
          a: {
            JULIEN: { avis: 1, date: '2026-09-10' },
            ['  ' + 'X'.repeat(60) + '  ']: { avis: -1, date: 7 }, // nom trop long, date absurde
            '   ': { avis: 1, date: 'x' }, // nom vide
            MARIE: { avis: 0, date: 'x' }, // le neutre ne se range pas
            PAUL: { avis: 'oui' }, // pas un avis
            LUC: 1, // pas une entrée
          },
          b: { MARIE: { avis: 0 } }, // plus aucune ligne valable : la piste s'efface
          disparue: { JULIEN: { avis: -1, date: 'x' } }, // piste inconnue
        },
      },
      pistes,
    )
    expect(Object.keys(d.avis)).toEqual(['a'])
    expect(d.avis.a).toEqual({
      JULIEN: { avis: 1, date: '2026-09-10' },
      ['X'.repeat(40)]: { avis: -1, date: '' },
    })
    for (const brut of [undefined, 42, 'avis', [], { avis: [] }, { avis: 'a' }, { avis: { a: 1 } }, { avis: { a: null } }, { avis: { a: [] } }]) {
      expect(lisAvisEcoute(brut, pistes).avis).toEqual({})
    }
  })

  it('un avis posé se relit à l’identique après un aller-retour JSON', () => {
    const f0 = PISTES_ECOUTE[0].fichier
    const f6 = PISTES_ECOUTE[6].fichier
    const d = poseAvis(poseAvis(lisAvisEcoute(null), f0, 1, 'JULIEN', 'd1'), f6, -1, 'MARIE', 'd2')
    const relu = lisAvisEcoute(JSON.parse(JSON.stringify(d)))
    expect(relu).toEqual(d)
    expect(memesAvis(relu, d)).toBe(true)
    // les dates ne comptent pas, les avis si
    expect(memesAvis(relu, poseAvis(d, f6, -1, 'MARIE', 'd3'))).toBe(true)
    expect(memesAvis(relu, poseAvis(d, f6, 1, 'MARIE', 'd3'))).toBe(false)
    expect(memesAvis(relu, poseAvis(d, f6, -1, 'PAUL', 'd3'))).toBe(false)
    expect(memesAvis(relu, poseAvis(d, f6, 0, 'MARIE', 'd3'))).toBe(false)
  })

  it('le bilan classe les pistes (retenue, écartée, partagée) et les lignes du titre disent qui pense quoi', () => {
    let d = lisAvisEcoute(null, pistes)
    expect(bilanAvis(d)).toEqual({ retenues: 0, ecartees: 0, partagees: 0 })
    expect(ligneBilan(d)).toBe('')
    expect(ligneAvis(d, 'a')).toBe('')
    d = poseAvis(d, 'a', 1, 'JULIEN', 'x')
    d = poseAvis(d, 'a', 1, 'MARIE', 'x')
    d = poseAvis(d, 'a', -1, 'PAUL', 'x')
    d = poseAvis(d, 'b', -1, '', 'x')
    d = poseAvis(d, 'c', 1, 'JULIEN', 'x')
    d = poseAvis(d, 'c', -1, 'MARIE', 'x')
    expect(bilanAvis(d)).toEqual({ retenues: 1, ecartees: 1, partagees: 1 })
    expect(ligneBilan(d)).toBe('1 retenue, 1 écartée, 1 partagée')
    // la somme d'abord, puis les pour, puis les contre, par nom
    expect(ligneAvis(d, 'a')).toBe('+1 · JULIEN +1, MARIE +1, PAUL −1')
    expect(ligneAvis(d, 'b')).toBe('−1 · anonyme −1')
    expect(ligneAvis(d, 'c')).toBe('±0 · JULIEN +1, MARIE −1')
    d = poseAvis(d, 'a', 1, 'PAUL', 'x')
    expect(ligneBilan(poseAvis(d, 'a', 1, 'ZOÉ', 'x'))).toBe('1 retenue, 1 écartée, 1 partagée')
    expect(ligneAvis(d, 'a')).toBe('+3 · JULIEN +1, MARIE +1, PAUL +1')
  })
})
