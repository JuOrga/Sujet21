// Le contrat de l'avis sur une musique : un verdict par piste, le dernier
// fait foi, le neutre retire la ligne, et un document d'ailleurs ne casse
// rien — seules les pistes connues, à +1 ou −1, survivent à la relecture.
import { describe, expect, it } from 'vitest'
import {
  avisDe,
  bilanAvis,
  ligneAvis,
  ligneBilan,
  lisAvisEcoute,
  memesAvis,
  poseAvis,
} from './ecouteAvis'
import { PISTES_ECOUTE, type PisteEcoute } from './jukebox'

const pistes: PisteEcoute[] = [
  { fichier: 'a', titre: 'A', famille: 'lit', enJeu: true },
  { fichier: 'b', titre: 'B', famille: 'lit', enJeu: false },
  { fichier: 'c', titre: 'C', famille: 'ambiance', enJeu: false },
]

describe('L’avis sur une musique de l’écoute', () => {
  it('un document neuf n’a d’avis sur rien ; +1 et −1 se posent, le neutre retire la ligne', () => {
    const vide = lisAvisEcoute(null, pistes)
    expect(vide.avis).toEqual({})
    expect(avisDe(vide, 'a')).toBeNull()

    const d1 = poseAvis(vide, 'a', 1, 'JULIEN', '2026-09-10T20:00:00Z')
    expect(avisDe(d1, 'a')).toEqual({ avis: 1, auteur: 'JULIEN', date: '2026-09-10T20:00:00Z' })
    // l'ancien document n'est pas touché : le lecteur garde ce qu'il a
    expect(avisDe(vide, 'a')).toBeNull()

    const d2 = poseAvis(d1, 'b', -1, 'JULIEN', '2026-09-10T20:01:00Z')
    expect(avisDe(d2, 'b')!.avis).toBe(-1)
    expect(avisDe(d2, 'a')!.avis).toBe(1)

    const d3 = poseAvis(d2, 'a', 0, 'JULIEN', '2026-09-10T20:02:00Z')
    expect(avisDe(d3, 'a')).toBeNull()
    expect('a' in d3.avis).toBe(false)
    expect(avisDe(d3, 'b')!.avis).toBe(-1)
  })

  it('le dernier avis fait foi, signé de son auteur', () => {
    const d = poseAvis(
      poseAvis(lisAvisEcoute(null, pistes), 'a', 1, 'JULIEN', '2026-09-10T20:00:00Z'),
      'a',
      -1,
      'MARIE',
      '2026-09-11T08:00:00Z',
    )
    expect(avisDe(d, 'a')).toEqual({ avis: -1, auteur: 'MARIE', date: '2026-09-11T08:00:00Z' })
  })

  it('la relecture ramène le document dans ses bornes : pistes connues, +1 ou −1, auteur court', () => {
    const d = lisAvisEcoute(
      {
        avis: {
          a: { avis: 1, auteur: '  ' + 'X'.repeat(60) + '  ', date: '2026-09-10' },
          b: { avis: 0, auteur: 'JULIEN', date: '2026-09-10' }, // le neutre ne se range pas
          c: { avis: 'oui', auteur: 'JULIEN' }, // pas un avis
          disparue: { avis: -1, auteur: 'JULIEN', date: '2026-09-10' }, // piste inconnue
        },
      },
      pistes,
    )
    expect(Object.keys(d.avis)).toEqual(['a'])
    expect(d.avis.a.auteur).toBe('X'.repeat(40))
    expect(d.avis.a.date).toBe('2026-09-10')
    // un champ absent ou absurde ne casse rien
    expect(lisAvisEcoute({ avis: { a: { avis: -1 } } }, pistes).avis.a).toEqual({ avis: -1, auteur: '', date: '' })
    for (const brut of [undefined, 42, 'avis', [], { avis: [] }, { avis: 'a' }, { avis: { a: 1 } }, { avis: { a: null } }]) {
      expect(lisAvisEcoute(brut, pistes).avis).toEqual({})
    }
  })

  it('un avis posé se relit à l’identique après un aller-retour JSON', () => {
    const d = poseAvis(poseAvis(lisAvisEcoute(null), PISTES_ECOUTE[0].fichier, 1, 'JULIEN', 'd1'), PISTES_ECOUTE[6].fichier, -1, 'JULIEN', 'd2')
    const relu = lisAvisEcoute(JSON.parse(JSON.stringify(d)))
    expect(relu).toEqual(d)
    expect(memesAvis(relu, d)).toBe(true)
    expect(memesAvis(relu, poseAvis(d, PISTES_ECOUTE[6].fichier, 1, 'JULIEN', 'd3'))).toBe(false)
    expect(memesAvis(relu, poseAvis(d, PISTES_ECOUTE[6].fichier, 0, 'JULIEN', 'd3'))).toBe(false)
  })

  it('le bilan compte les retenues et les écartées, et les lignes du titre le disent', () => {
    let d = lisAvisEcoute(null, pistes)
    expect(bilanAvis(d)).toEqual({ retenues: 0, ecartees: 0 })
    expect(ligneBilan(d)).toBe('')
    expect(ligneAvis(null)).toBe('')
    d = poseAvis(d, 'a', 1, 'JULIEN', 'x')
    d = poseAvis(d, 'b', 1, '', 'x')
    d = poseAvis(d, 'c', -1, 'MARIE', 'x')
    expect(bilanAvis(d)).toEqual({ retenues: 2, ecartees: 1 })
    expect(ligneBilan(d)).toBe('2 retenues, 1 écartée')
    expect(ligneAvis(avisDe(d, 'a'))).toBe('retenue par JULIEN')
    expect(ligneAvis(avisDe(d, 'b'))).toBe('retenue par anonyme')
    expect(ligneAvis(avisDe(d, 'c'))).toBe('écartée par MARIE')
  })
})
