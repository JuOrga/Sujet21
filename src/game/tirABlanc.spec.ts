import { describe, expect, it } from 'vitest'
import { JOURNAL_LIVRE, poseSeuil } from './journal'
import { SCENARIO_LIVRE, scenarioVierge } from './scenario'
import { reperesTirABlanc, tirABlanc } from './tirABlanc'

describe('le tir à blanc du système de run', () => {
  it('avec le journal et le scénario livrés : un fragment par run, la fin à la première, la révélation à la dixième', () => {
    const t = tirABlanc(JOURNAL_LIVRE, SCENARIO_LIVRE, 12)
    expect(t.length).toBe(13)
    expect(t[0]).toMatchObject({ run: 0, fragment: null, fin: null, revelation: false })
    // le premier lancement joue l'ouverture, puis le départ (première partie)
    expect(t[0].cines.map((c) => c.cine)).toEqual(['ESSAI', 'DEPART'])
    expect(t[1]).toMatchObject({ run: 1, fragment: 'recit-livraison', fin: 'fin-miroir', finsVues: 1, denouement: true, revelation: false })
    expect(t[9].revelation).toBe(false)
    expect(t[10]).toMatchObject({ run: 10, fragment: 'recit-le-choix', fragmentsVus: 10, revelation: true })
    // la révélation se joue une fois, au retour au hub de la dixième run
    expect(t[10].cines).toEqual([{ moment: 'avant-hub', cine: 'REVELATION', regle: 'livre-revelation' }])
    expect(t[11].cines).toEqual([])
    expect(t[11].fragment).toBeNull()
    expect(t[12].fin).toBeNull()
  })

  it('un seuil de révélation abaissé avance la révélation d’autant', () => {
    const t = tirABlanc(poseSeuil(JOURNAL_LIVRE, 'revelationApres', 3), SCENARIO_LIVRE, 5)
    expect(t.find((r) => r.revelation)?.run).toBe(3)
  })

  it('sans scénario, rien ne se joue ; le nombre se borne', () => {
    const t = tirABlanc(JOURNAL_LIVRE, scenarioVierge(), 3)
    expect(t.every((r) => r.cines.length === 0)).toBe(true)
    expect(tirABlanc(JOURNAL_LIVRE, scenarioVierge(), -4).length).toBe(1)
    expect(tirABlanc(JOURNAL_LIVRE, scenarioVierge(), 9999).length).toBe(201)
  })

  it('les repères disent à quelle run tombe quoi', () => {
    const r = reperesTirABlanc(tirABlanc(JOURNAL_LIVRE, SCENARIO_LIVRE, 12))
    expect(r[0]).toContain('run 10')
    expect(r[1]).toContain('run 1')
    expect(r.some((x) => x.includes('REVELATION'))).toBe(true)
    const court = reperesTirABlanc(tirABlanc(JOURNAL_LIVRE, SCENARIO_LIVRE, 4))
    expect(court[0]).toContain('ne tombe pas en 4 runs')
  })
})
