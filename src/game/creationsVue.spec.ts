// L'ÉCRAN CRÉATIONS (lot 6) : ce qu'il montre, sans DOM — la liste d'un
// onglet, les dates en mots, les classements, le bilan d'une partie ; et
// son câblage dans main.ts (lu dans la source, comme main-salleHub.spec.ts).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bilanPartie, libelleMeilleur, lignesClassement, listeAffichee, quandRelatif } from './creationsVue'
import type { CreationListee } from './netCreations'

const c = (id: string, majLe: string): CreationListee => ({
  id, code: `J-${id}`, nom: id, auteur: 'X', creeLe: majLe, majLe, empreinte: 'e',
})

describe('la liste d’un onglet', () => {
  const toutes = [c('a', '2026-11-20T10:00:00Z'), c('b', '2026-11-24T10:00:00Z'), c('d', '2026-11-22T10:00:00Z')]

  it('les plus récemment retouchées d’abord', () => {
    expect(listeAffichee(toutes, 'recentes', []).map((x) => x.id)).toEqual(['b', 'd', 'a'])
  })

  it('« Mes créations » : celles publiées depuis ce poste seulement', () => {
    expect(listeAffichee(toutes, 'miennes', ['a', 'd', 'zz']).map((x) => x.id)).toEqual(['d', 'a'])
    expect(listeAffichee(toutes, 'miennes', [])).toEqual([])
  })

  it('ne touche pas à la liste reçue', () => {
    listeAffichee(toutes, 'recentes', [])
    expect(toutes.map((x) => x.id)).toEqual(['a', 'b', 'd'])
  })
})

describe('les dates dites en mots', () => {
  const maintenant = new Date(2026, 10, 24, 1, 0) // le 24/11 à 1 h, heure locale

  it('aujourd’hui, hier, il y a N jours, puis la date', () => {
    expect(quandRelatif(new Date(2026, 10, 24, 0, 30).toISOString(), maintenant)).toBe('aujourd’hui')
    // publiée la veille à 23 h, lue à 1 h : c'était hier, pas « aujourd'hui »
    expect(quandRelatif(new Date(2026, 10, 23, 23, 0).toISOString(), maintenant)).toBe('hier')
    expect(quandRelatif(new Date(2026, 10, 20, 12, 0).toISOString(), maintenant)).toBe('il y a 4 jours')
    expect(quandRelatif(new Date(2026, 9, 2, 12, 0).toISOString(), maintenant)).toContain('octobre')
    expect(quandRelatif('n’importe quoi', maintenant)).toBe('')
  })
})

describe('les records', () => {
  it('la ligne d’une carte', () => {
    expect(libelleMeilleur({ nom: 'AMI', litres: 0.61, temps: 42 })).toBe('Record : 0,61 L par AMI')
    expect(libelleMeilleur(undefined)).toBe('Aucun record : à vous')
  })

  it('un classement vide invite à jouer ; la ligne du joueur de ce poste se surligne', () => {
    expect(lignesClassement([], 'volume', 'JULIAN')).toEqual([{ rang: '—', nom: 'Personne encore : à vous', valeur: '', moi: false }])
    const lignes = lignesClassement(
      [
        { nom: 'AMI', litres: 0.7, temps: 40, quand: '' },
        { nom: 'JULIAN', litres: 0.61, temps: 42.6, quand: '' },
      ],
      'chrono',
      'JULIAN',
    )
    expect(lignes.map((l) => [l.rang, l.valeur, l.moi])).toEqual([
      ['1', '40,0 s', false],
      ['2', '42,6 s', true],
    ])
    // sans nom d'opérateur, personne n'est « moi »
    expect(lignesClassement([{ nom: '', litres: 1, temps: 1, quand: '' }], 'volume', '')[0].moi).toBe(false)
  })

  it('le bilan d’une partie : record battu, partie simple, ou dépôt manqué', () => {
    const records = {
      empreinte: 'e',
      volume: [{ nom: 'AMI', litres: 0.7, temps: 40, quand: '' }],
      chrono: [{ nom: 'AMI', litres: 0.7, temps: 40, quand: '' }],
    }
    expect(bilanPartie(true, records, 0.7, 40).titre).toBe('NOUVEAU RECORD')
    const simple = bilanPartie(false, records, 0.5, 50)
    expect(simple.titre).toBe('SORTIE ATTEINTE')
    expect(simple.texte).toContain('0,70 L (AMI)')
    expect(bilanPartie(null, null, 0.5, 50).texte).toContain('n’a pas pu être déposé')
  })
})

describe('le câblage de l’écran (main.ts, index.html)', () => {
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')

  it('la porte CRÉATIONS ouvre l’écran', () => {
    expect(HTML).toMatch(/<div id="creations" hidden/)
    expect(HTML).toMatch(/id="home-creations"/)
    expect(MAIN).toMatch(/home-creations'\)\?\.addEventListener\('click', \(\) => ecranCreations\.open\(\)\)/)
  })

  it('tout départ d’essai désarme le retour aux créations ; seul JOUER le ré-arme', () => {
    expect(MAIN.match(/fromCreation = null/g)?.length).toBeGreaterThanOrEqual(3)
    expect(MAIN).toMatch(/startTest\(\[lvl\]\)[\s\S]{0,300}fromCreation = c/)
  })

  it('une salle à soi se rouvre dans l’atelier', () => {
    const ECRAN = readFileSync(new URL('./ecranCreations.ts', import.meta.url), 'utf-8')
    expect(ECRAN).toContain('id="cr-modifier"')
    expect(MAIN).toMatch(/modifier: \(lvl, id\) => \{[\s\S]{0,200}openEditor\('joueur'\)\.then\(\(ed\) => ed\?\.ouvreCreation\(id, lvl\)\)/)
  })

  it('la sortie atteinte dépose le record ; le retour ramène à l’écran', () => {
    expect(MAIN).toMatch(/if \(fromCreation && testLevel\) \{[\s\S]{0,200}recordDepuisCreation\(fromCreation, surplus, run\.tableauTime\)/)
    expect(MAIN).toMatch(/if \(fromCreation\) \{[\s\S]{0,400}ecranCreations\.open\(\)/)
  })
})
