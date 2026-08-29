import { SCENARIO_LIVRE, avecScenarioLivre } from './scenario'
import { describe, expect, it } from 'vitest'
import {
  type EtatScenario,
  type RegleScenario,
  type ScenarioDef,
  choisitRegle,
  parseScenario,
  regleVierge,
  serializeScenario,
} from './scenario'

function etat(p: Partial<EtatScenario> = {}): EtatScenario {
  return {
    runs: 0,
    salleMax: 0,
    condensat: 0,
    trophee: () => false,
    ...p,
  }
}

function regle(p: Partial<RegleScenario> & { id: string }): RegleScenario {
  return { ...regleVierge(p.id), ...p }
}

describe('le scénario — la règle qui gagne', () => {
  it('PREMIER MATCH GAGNE : l’ordre EST la priorité', () => {
    const s: ScenarioDef = {
      regles: [
        regle({ id: 'r1', condition: 'runs-min', valeur: 3, cine: 'MIROIR' }),
        regle({ id: 'r2', condition: 'toujours', cine: 'ORDINAIRE' }),
      ],
    }
    // 3 runs : la spécifique passe devant la générique
    expect(choisitRegle(s, 'avant-hub', etat({ runs: 3 }), new Set())?.cine).toBe('MIROIR')
    // 1 run : la spécifique ne s'applique pas, la générique prend
    expect(choisitRegle(s, 'avant-hub', etat({ runs: 1 }), new Set())?.cine).toBe('ORDINAIRE')
  })

  it('« une seule fois » : jouée une fois, la règle laisse la main à la suivante', () => {
    const s: ScenarioDef = {
      regles: [
        regle({ id: 'ouv', condition: 'premiere-partie', cine: 'OUVERTURE', uneFois: true }),
        regle({ id: 'gen', condition: 'toujours', cine: 'RETOUR' }),
      ],
    }
    const neuf = etat({ runs: 0 })
    expect(choisitRegle(s, 'avant-hub', neuf, new Set())?.cine).toBe('OUVERTURE')
    // la mémoire retient l'identifiant : au deuxième passage, c'est RETOUR
    expect(choisitRegle(s, 'avant-hub', neuf, new Set(['ouv']))?.cine).toBe('RETOUR')
  })

  it('une règle SANS « une seule fois » se rejoue indéfiniment', () => {
    const s: ScenarioDef = { regles: [regle({ id: 'sas', cine: 'SAS', uneFois: false })] }
    expect(choisitRegle(s, 'avant-hub', etat(), new Set(['sas']))?.cine).toBe('SAS')
  })

  it('le MOMENT trie : une règle d’un autre moment ne répond jamais', () => {
    const s: ScenarioDef = {
      regles: [
        regle({ id: 'a', moment: 'run-perdue', condition: 'toujours', cine: 'DEFAITE' }),
        regle({ id: 'b', moment: 'avant-hub', condition: 'toujours', cine: 'HUB' }),
      ],
    }
    expect(choisitRegle(s, 'avant-hub', etat(), new Set())?.cine).toBe('HUB')
    expect(choisitRegle(s, 'run-perdue', etat(), new Set())?.cine).toBe('DEFAITE')
    expect(choisitRegle(s, 'expedition-achevee', etat(), new Set())).toBeNull()
  })

  it('les règles éteintes ou sans cinématique sont ignorées', () => {
    const s: ScenarioDef = {
      regles: [
        regle({ id: 'off', condition: 'toujours', cine: 'JAMAIS', actif: false }),
        regle({ id: 'vide', condition: 'toujours', cine: '' }),
        regle({ id: 'ok', condition: 'toujours', cine: 'BONNE' }),
      ],
    }
    expect(choisitRegle(s, 'avant-hub', etat(), new Set())?.cine).toBe('BONNE')
  })

  it('chaque condition lit le bon compteur', () => {
    const seuil = (p: Partial<RegleScenario>): RegleScenario =>
      regle({ id: 'x', cine: 'C', ...p })
    const av = (r: RegleScenario, e: EtatScenario): boolean =>
      choisitRegle({ regles: [r] }, 'avant-hub', e, new Set()) !== null

    expect(av(seuil({ condition: 'premiere-partie' }), etat({ runs: 0 }))).toBe(true)
    expect(av(seuil({ condition: 'premiere-partie' }), etat({ runs: 1 }))).toBe(false)

    expect(av(seuil({ condition: 'runs-min', valeur: 5 }), etat({ runs: 5 }))).toBe(true)
    expect(av(seuil({ condition: 'runs-min', valeur: 5 }), etat({ runs: 4 }))).toBe(false)

    expect(av(seuil({ condition: 'salle-min', valeur: 3 }), etat({ salleMax: 4 }))).toBe(true)
    expect(av(seuil({ condition: 'salle-min', valeur: 3 }), etat({ salleMax: 2 }))).toBe(false)

    expect(av(seuil({ condition: 'condensat-min', valeur: 200 }), etat({ condensat: 200 }))).toBe(true)
    expect(av(seuil({ condition: 'condensat-min', valeur: 200 }), etat({ condensat: 199 }))).toBe(false)

    const gagne = etat({ trophee: (id) => id === 'integrale' })
    expect(av(seuil({ condition: 'trophee', trophee: 'integrale' }), gagne)).toBe(true)
    expect(av(seuil({ condition: 'trophee', trophee: 'miroir-vivant' }), gagne)).toBe(false)
    // condition « trophee » sans trophée nommé : elle ne déclenche rien
    expect(av(seuil({ condition: 'trophee', trophee: '' }), gagne)).toBe(false)
  })

  it('LE SCÉNARIO ROGUELIKE : trois arrivées au hub, trois cinématiques différentes', () => {
    const s: ScenarioDef = {
      regles: [
        regle({ id: 'ouv', condition: 'premiere-partie', cine: 'OUVERTURE', uneFois: true }),
        regle({ id: 'mir', condition: 'runs-min', valeur: 3, cine: 'MIROIR', uneFois: true }),
        regle({ id: 'ord', condition: 'toujours', cine: 'ORDINAIRE', uneFois: false }),
      ],
    }
    const vues = new Set<string>()
    const passe = (e: EtatScenario): string => {
      const r = choisitRegle(s, 'avant-hub', e, vues)
      if (r?.uneFois) vues.add(r.id)
      return r?.cine ?? '—'
    }
    expect(passe(etat({ runs: 0 }))).toBe('OUVERTURE') // la naissance
    expect(passe(etat({ runs: 1 }))).toBe('ORDINAIRE') // retour banal
    expect(passe(etat({ runs: 2 }))).toBe('ORDINAIRE')
    expect(passe(etat({ runs: 3 }))).toBe('MIROIR') // la révélation
    expect(passe(etat({ runs: 4 }))).toBe('ORDINAIRE') // et jamais deux fois
    expect(passe(etat({ runs: 9 }))).toBe('ORDINAIRE')
  })
})

describe('le scénario — le format de données', () => {
  it('sérialise puis relit à l’identique', () => {
    const s: ScenarioDef = {
      regles: [
        regle({ id: 'ouv', moment: 'premier-lancement', condition: 'premiere-partie', cine: 'OUVERTURE' }),
        regle({ id: 'fin', moment: 'expedition-achevee', condition: 'trophee', trophee: 'integrale', cine: 'EPILOGUE' }),
      ],
    }
    expect(parseScenario(JSON.parse(serializeScenario(s)))).toEqual(s)
  })

  it('refuse ce qui n’est pas un scénario, et borne les valeurs', () => {
    expect(parseScenario(null)).toBeNull()
    expect(parseScenario({ regles: 'non' })).toBeNull()
    const s = parseScenario({
      regles: [
        { id: 'a', moment: 'nulle-part', condition: 'au-pif', valeur: 9999, cine: 'C' },
        'pas un objet',
      ],
    })!
    expect(s.regles).toHaveLength(1)
    expect(s.regles[0].moment).toBe('avant-hub') // le défaut, pas l'inconnu
    expect(s.regles[0].condition).toBe('toujours')
    expect(s.regles[0].valeur).toBe(999)
  })

  it('deux règles ne partagent jamais un identifiant (la mémoire les confondrait)', () => {
    const s = parseScenario({
      regles: [
        { id: 'meme', cine: 'A' },
        { id: 'meme', cine: 'B' },
      ],
    })!
    expect(s.regles).toHaveLength(2)
    expect(s.regles[0].id).not.toBe(s.regles[1].id)
  })
})

describe('le scénario LIVRÉ — le filet sous la bibliothèque', () => {
  it('les règles livrées parsent et survivent au tour de sérialisation', () => {
    const r = parseScenario(JSON.parse(JSON.stringify(SCENARIO_LIVRE)))
    expect(r?.regles.map((x) => x.id)).toEqual(['livre-ouverture', 'livre-depart'])
    expect(r?.regles[0].cine).toBe('ESSAI')
    expect(r?.regles.every((x) => x.uneFois && x.actif)).toBe(true)
  })

  it('la fusion : les règles reçues priment, les livrées font filet', () => {
    // un scénario vide (installation fraîche) reçoit tout le filet
    expect(avecScenarioLivre({ regles: [] }).regles.length).toBe(2)
    // une règle publiée sous le même id REMPLACE la livrée
    const publie = {
      regles: [
        { ...SCENARIO_LIVRE.regles[0], cine: 'AUTRE' },
      ],
    }
    const fusion = avecScenarioLivre(publie)
    expect(fusion.regles.length).toBe(2)
    expect(fusion.regles[0].cine).toBe('AUTRE') // la publiée d'abord
    expect(fusion.regles[1].id).toBe('livre-depart')
  })
})
