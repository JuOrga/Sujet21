import { describe, expect, it } from 'vitest'
import {
  FILTRES_AVARIES,
  SECTEURS,
  apresReparation,
  badge,
  compteSecteur,
  consigne,
  effetsPanne,
  etatCourt,
  filtre,
  filtreSuivant,
  imageDe,
  partRetablie,
  retablie,
  secteurDe,
  stations,
  stationsDuSecteur,
  type EtatAvaries,
} from './avariesVue'
import { REPARATIONS } from './reparations'

const ruine: EtatAvaries = { memoire: 0, faites: [] }
const riche: EtatAvaries = { memoire: 1000, faites: [] }

describe('les secteurs du tableau des avaries', () => {
  it('rangent chaque station du catalogue dans exactement un secteur, et le rail les couvre tous', () => {
    const ids = SECTEURS.map((s) => s.id)
    expect(ids[0]).toBe('tout')
    for (const r of REPARATIONS) expect(ids).toContain(secteurDe(r))
    // la réunion des trois secteurs est le catalogue entier, sans doublon
    const parSecteur = SECTEURS.filter((s) => s.id !== 'tout').flatMap((s) => stationsDuSecteur(s.id, ruine).map((st) => st.id))
    expect([...parSecteur].sort()).toEqual(REPARATIONS.map((r) => r.id).sort())
    expect(stationsDuSecteur('tout', ruine).map((st) => st.id)).toEqual(REPARATIONS.map((r) => r.id))
  })

  it('se déduisent de ce que la panne fait : la porte d’abord, puis les écrans, sinon l’énergie', () => {
    const base = { id: 'x', nom: 'X', detail: '', icone: '', prix: 1, labelsCaches: [] }
    expect(secteurDe({ ...base, porte: true, eteintEcrans: true })).toBe('acces')
    expect(secteurDe({ ...base, eteintEcrans: true })).toBe('consoles')
    expect(secteurDe({ ...base, assombrit: true })).toBe('energie')
    expect(secteurDe(base)).toBe('energie')
    // les stations vécues du module
    expect(stationsDuSecteur('acces', ruine).map((st) => st.id)).toEqual(['bac-sable', 'aile-endormis', 'passerelle-4'])
    expect(stationsDuSecteur('consoles', ruine).map((st) => st.id)).toEqual(['table-depart', 'mur-records'])
    expect(stationsDuSecteur('energie', ruine).map((st) => st.id)).toEqual(['eclairage', 'distillateur'])
  })
})

describe('l’état d’une station', () => {
  it('se lit dans l’ordre : rétablie, payable au plot, sinon solde court', () => {
    const eclairage = REPARATIONS[0]
    const lit = (s: EtatAvaries) => stations(s).find((st) => st.id === eclairage.id)!
    expect(lit({ memoire: 0, faites: [eclairage.id] }).etat).toBe('retablie')
    expect(lit({ memoire: eclairage.prix, faites: [] }).etat).toBe('payable')
    expect(lit({ memoire: eclairage.prix - 1, faites: [] }).etat).toBe('solde-court')
  })

  it('porte son rang du catalogue et ses effets de panne', () => {
    const toutes = stations(ruine)
    expect(toutes.map((st) => st.rang)).toEqual(toutes.map((_, i) => i + 1))
    for (const st of toutes) expect(st.effets.length).toBeGreaterThan(0)
  })

  it('les effets de panne suivent les drapeaux — et une station sans drapeau a quand même une ligne', () => {
    const base = { id: 'x', nom: 'X', detail: '', icone: '', prix: 1, labelsCaches: [] }
    expect(effetsPanne(base)).toHaveLength(1)
    expect(effetsPanne({ ...base, assombrit: true, eteintEcrans: true, porte: true })).toHaveLength(3)
    expect(effetsPanne({ ...base, porte: true })[0]).toMatch(/porte d’énergie/)
  })
})

describe('les filtres', () => {
  it('TOUTES garde tout, EN PANNE et RÉTABLIES se partagent la liste', () => {
    const s: EtatAvaries = { memoire: 20, faites: ['eclairage', 'mur-records'] }
    const toutes = stations(s)
    expect(filtre(toutes, 'toutes')).toHaveLength(toutes.length)
    const pannes = filtre(toutes, 'pannes')
    const faites = filtre(toutes, 'retablies')
    expect(pannes.length + faites.length).toBe(toutes.length)
    expect(faites.map((st) => st.id)).toEqual(['eclairage', 'mur-records'])
    expect(pannes.every((st) => !retablie(st))).toBe(true)
  })

  it('X fait le tour des filtres et revient au premier', () => {
    let f = FILTRES_AVARIES[0][0]
    const vus = [f]
    for (let i = 1; i < FILTRES_AVARIES.length; i++) {
      f = filtreSuivant(f)
      vus.push(f)
    }
    expect(vus).toEqual(FILTRES_AVARIES.map(([id]) => id))
    expect(filtreSuivant(f)).toBe(FILTRES_AVARIES[0][0])
  })
})

describe('les libellés', () => {
  const st = (etat: 'retablie' | 'payable' | 'solde-court') => ({
    ...stations(ruine)[0],
    etat,
  })

  it('le badge, la ligne du bas et la consigne disent le même état, dans trois registres', () => {
    expect(badge(st('retablie'))).toBe('RÉTABLIE')
    expect(etatCourt(st('retablie'))).toBe('DEBOUT')
    expect(consigne(st('retablie'), 0).titre).toMatch(/RÉTABLIE/)
    expect(badge(st('payable'))).toBe('EN PANNE')
    expect(etatCourt(st('payable'))).toBe('PAYABLE AU PLOT')
    expect(consigne(st('payable'), 100).titre).toBe(`RÉPARER AU PLOT — ${st('payable').prix} MÉMOIRE`)
    expect(badge(st('solde-court'))).toMatch(/SOLDE COURT/)
    expect(etatCourt(st('solde-court'))).toBe('SOLDE COURT')
    // ce qui manque se chiffre : le joueur sait combien il lui reste à gagner
    expect(consigne(st('solde-court'), 4).titre).toBe(`SOLDE COURT — MANQUE ${st('solde-court').prix - 4} MÉMOIRE`)
  })

  it('le solde après réparation dit ce qui reste ou ce qui manque, et rien à payer une fois rétablie', () => {
    const prix = st('payable').prix
    expect(apresReparation(st('payable'), prix + 5)).toBe('reste 5 mémoire')
    expect(apresReparation(st('solde-court'), prix - 3)).toBe('manque 3 mémoire')
    expect(apresReparation(st('retablie'), 0)).toBe('rien à payer')
  })

  it('le compte et l’anneau du rail suivent les stations rétablies', () => {
    const liste = stations({ memoire: 0, faites: ['eclairage', 'table-depart'] })
    expect(compteSecteur(liste)).toBe(`2 / ${liste.length} rétablies`)
    expect(partRetablie(liste)).toBeCloseTo(2 / liste.length)
    expect(compteSecteur(stations(riche))).toBe(`0 / ${liste.length} rétablie`)
    expect(partRetablie([])).toBe(0)
  })

  it('l’illustration se nomme par l’id de la station, sous assets/avaries', () => {
    expect(imageDe('eclairage')).toBe('/assets/avaries/eclairage.webp')
  })
})
