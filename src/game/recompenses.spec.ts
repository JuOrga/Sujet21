import { beforeEach, describe, expect, it } from 'vitest'
import {
  brouillonRecompensesActif,
  catalogueRecompenses,
  documentRecompenses,
  poseConcepteurRecompenses,
  poseRecompensesPubliees,
  recompensesJouees,
  reprendRecompensesPubliees,
  exporteRecompenses,
  idDepuisNom,
  importeRecompenses,
  poseRecompense,
  recompensesPerso,
  retireRecompense,
  valideRecompense,
  videAtelier,
} from './recompenses'
import { INSTRUMENTS, levier } from './instruments'
import { LEVIERS, valeurLevier } from './leviers'

const carte = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  nom: 'Membrane de tension',
  icone: '🪺',
  desc: '',
  effets: [{ levier: 'seuilDispersion', valeur: 0.75 }],
  ...over,
})

describe('L’atelier des récompenses', () => {
  beforeEach(() => videAtelier())

  it('fabrique une carte, qui rejoint le catalogue et agit comme les autres', () => {
    expect(poseRecompense(carte())).toEqual([])
    const faite = recompensesPerso()[0]
    expect(faite.perso).toBe(true)
    expect(faite.id).toBe('membrane-de-tension')
    // le catalogue complet la porte, et le jeu la lit PAR LEVIER — c'est
    // toute la promesse de l'écran : une carte d'atelier n'est pas une
    // maquette, elle vaut une carte gravée
    expect(catalogueRecompenses()).toHaveLength(INSTRUMENTS.length + 1)
    expect(
      levier([faite.id], 'seuilDispersion', catalogueRecompenses()),
    ).toBeCloseTo(0.75)
  })

  it('refuse ce qui ne se joue pas : sans nom, sans effet, hors plage, en double', () => {
    expect(valideRecompense(carte({ nom: 'ab' })).length).toBeGreaterThan(0)
    expect(valideRecompense(carte({ effets: [] })).length).toBeGreaterThan(0)
    expect(valideRecompense(carte({ icone: '' })).length).toBeGreaterThan(0)
    // hors plage du levier
    expect(
      valideRecompense(
        carte({ effets: [{ levier: 'seuilDispersion', valeur: 12 }] }),
      ).length,
    ).toBeGreaterThan(0)
    // valeur neutre : la carte ne ferait rien
    expect(
      valideRecompense(carte({ effets: [{ levier: 'sasPortee', valeur: 1 }] }))
        .length,
    ).toBeGreaterThan(0)
    // deux fois le même levier sur une carte
    expect(
      valideRecompense(
        carte({
          effets: [
            { levier: 'sasPortee', valeur: 1.4 },
            { levier: 'sasPortee', valeur: 1.2 },
          ],
        }),
      ).length,
    ).toBeGreaterThan(0)
    // levier inventé
    expect(
      valideRecompense(carte({ effets: [{ levier: 'nawak', valeur: 2 }] }))
        .length,
    ).toBeGreaterThan(0)
  })

  it('interdit de doubler une carte LIVRÉE — même identifiant, même icône', () => {
    const gravee = INSTRUMENTS[0]
    expect(valideRecompense(carte({ id: gravee.id })).length).toBeGreaterThan(0)
    expect(
      valideRecompense(carte({ icone: gravee.icone })).length,
    ).toBeGreaterThan(0)
  })

  it('se reprend et se retire', () => {
    poseRecompense(carte())
    // retouche : même identifiant, l'atelier n'en garde qu'une
    expect(
      poseRecompense(
        carte({ nom: 'Membrane de tension', icone: '🪺', desc: 'retouchée' }),
        'membrane-de-tension',
      ),
    ).toEqual([])
    expect(recompensesPerso()).toHaveLength(1)
    expect(recompensesPerso()[0].desc).toBe('retouchée')
    expect(retireRecompense('membrane-de-tension')).toBe(true)
    expect(recompensesPerso()).toHaveLength(0)
  })

  it('l’export se relit : le JSON est le pont vers le code', () => {
    poseRecompense(carte())
    poseRecompense(carte({ nom: 'Écope', icone: '🥄', effets: [{ levier: 'bonbonne', valeur: 2 }] }))
    const json = exporteRecompenses()
    videAtelier()
    expect(recompensesPerso()).toHaveLength(0)
    expect(importeRecompenses(json)).toBe(2)
    expect(recompensesPerso()).toHaveLength(2)
    expect(importeRecompenses('ceci n’est pas du JSON')).toBe(-1)
  })

  it('l’identifiant se déduit du nom, lisible dans un fichier', () => {
    expect(idDepuisNom('Écope à condensat')).toBe('ecope-a-condensat')
    expect(idDepuisNom('   ')).toBe('carte')
  })

  it('les leviers se cumulent : les facteurs se multiplient, les ajouts s’ajoutent', () => {
    const effets = [
      { levier: 'sasPortee' as const, valeur: 1.5 },
      { levier: 'sasPortee' as const, valeur: 2 },
      { levier: 'bonbonne' as const, valeur: 3 },
      { levier: 'bonbonne' as const, valeur: 2 },
    ]
    expect(valeurLevier(effets, 'sasPortee')).toBeCloseTo(3)
    expect(valeurLevier(effets, 'bonbonne')).toBe(5)
    // un levier qu'aucune carte ne touche vaut sa valeur NEUTRE
    expect(valeurLevier(effets, 'peageVapeur')).toBe(1)
    expect(valeurLevier(effets, 'dashs')).toBe(0)
  })

  it('chaque levier sait se raconter, sur toute sa plage', () => {
    for (const l of LEVIERS) {
      for (const v of [l.min, (l.min + l.max) / 2, l.max]) {
        const p = l.phrase(v)
        expect(p.length).toBeGreaterThan(8)
        expect(p).not.toContain('NaN')
        expect(p).not.toContain('undefined')
      }
    }
  })
})

describe('Les récompenses publiées — qui joue quoi', () => {
  beforeEach(() => {
    videAtelier()
    poseRecompensesPubliees(null)
    poseConcepteurRecompenses(false)
  })

  it('un joueur joue les publiées, jamais un brouillon qui traînerait sur son poste', () => {
    expect(poseRecompense(carte())).toEqual([])
    // tant que rien n'est publié, le brouillon joue : rien ne change hors-ligne
    expect(recompensesJouees().map((c) => c.id)).toEqual(['membrane-de-tension'])
    expect(brouillonRecompensesActif()).toBe(true)
    poseRecompensesPubliees({ cartes: [carte({ id: 'publiee', nom: 'Publiée', icone: '🧿' })] })
    expect(recompensesJouees().map((c) => c.id)).toEqual(['publiee'])
    expect(catalogueRecompenses().length).toBe(INSTRUMENTS.length + 1)
    expect(brouillonRecompensesActif()).toBe(false)
  })

  it('un concepteur joue son brouillon s’il en a un, sinon les publiées', () => {
    poseConcepteurRecompenses(true)
    poseRecompensesPubliees({ cartes: [carte({ id: 'publiee', nom: 'Publiée', icone: '🧿' })] })
    expect(recompensesJouees().map((c) => c.id)).toEqual(['publiee'])
    expect(poseRecompense(carte())).toEqual([])
    expect(recompensesJouees().map((c) => c.id)).toEqual(['membrane-de-tension'])
    expect(brouillonRecompensesActif()).toBe(true)
  })

  it('le document publié se relit propre, et se reprend comme brouillon', () => {
    poseRecompensesPubliees({ cartes: [carte({ id: 'publiee', nom: 'Publiée', icone: '🧿' }), { id: 'cassee' }] })
    expect(recompensesJouees().map((c) => c.id)).toEqual(['publiee'])
    expect(reprendRecompensesPubliees()).toBe(1)
    expect(recompensesPerso().map((c) => c.id)).toEqual(['publiee'])
    expect(documentRecompenses().cartes.map((c) => c.id)).toEqual(['publiee'])
    // un document sans forme ne publie rien
    expect(poseRecompensesPubliees('rien')).toBeNull()
  })
})
