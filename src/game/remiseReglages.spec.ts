import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CLE_REMISE_REGLAGES,
  CLE_REMISE_RELIEF_FORT,
  REGLAGES_REMIS,
  remetReglagesParDefaut,
  type StockageReglages,
} from './remiseReglages'

// Le symptôme évité (16/11) : le relief passe LÉGER par défaut, mais le
// joueur qui avait cliqué OFF pendant l'essai garde OFF — le nouveau défaut
// ne joint que les appareils vierges. La remise à zéro efface les quatre
// réglages une fois, et une fois seulement.

function faux(depart: Record<string, string>): StockageReglages & { d: Map<string, string> } {
  const d = new Map(Object.entries(depart))
  return {
    d,
    getItem: (c) => d.get(c) ?? null,
    setItem: (c, v) => void d.set(c, v),
    removeItem: (c) => void d.delete(c),
  }
}

describe('la remise à zéro des réglages graphiques', () => {
  it('efface les quatre réglages et eux seuls', () => {
    const s = faux({
      'sujet21-relief': 'off',
      'sujet21-eau': 'sobre',
      'sujet21-lumiere': 'off',
      'sujet21-lumiere-eau': 'off',
      'sujet21-decor': 'sobre',
      'sujet21-simhz': '60',
    })
    expect(remetReglagesParDefaut(s)).toBe(true)
    for (const cle of REGLAGES_REMIS) expect(s.getItem(cle)).toBeNull()
    // les autres réglages ne sont pas de cette demande
    expect(s.getItem('sujet21-decor')).toBe('sobre')
    expect(s.getItem('sujet21-simhz')).toBe('60')
  })

  it('ne passe qu’une fois : le réglage refait ensuite par le joueur tient', () => {
    const s = faux({ 'sujet21-eau': 'sobre', [CLE_REMISE_RELIEF_FORT]: '1' })
    remetReglagesParDefaut(s)
    s.setItem('sujet21-eau', 'sobre') // la machine rame : le joueur revient à SOBRE
    s.setItem('sujet21-relief', 'off')
    expect(remetReglagesParDefaut(s)).toBe(false)
    expect(s.getItem('sujet21-eau')).toBe('sobre')
    expect(s.getItem('sujet21-relief')).toBe('off')
  })

  it('pose son témoin même sur un appareil vierge', () => {
    const s = faux({})
    expect(remetReglagesParDefaut(s)).toBe(true)
    expect(s.getItem(CLE_REMISE_REGLAGES)).not.toBeNull()
  })

  it('témoin refusé (stockage plein ou interdit) : rien n’est effacé, sinon la remise recommencerait à chaque lancement', () => {
    const s = faux({ 'sujet21-eau': 'sobre' })
    s.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(remetReglagesParDefaut(s)).toBe(false)
    expect(s.getItem('sujet21-eau')).toBe('sobre')
  })
})

describe('main.ts remet les réglages AVANT de les lire', () => {
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8')

  it('l’appel précède la lecture de chacun des quatre réglages', () => {
    const appel = main.indexOf('remetReglagesParDefaut(localStorage)')
    expect(appel).toBeGreaterThan(-1)
    for (const cle of REGLAGES_REMIS) {
      const lecture = main.indexOf(`localStorage.getItem('${cle}')`)
      expect(lecture, cle).toBeGreaterThan(appel)
    }
  })
})

// Le relief passe FORT par défaut (17/11) : la première remise avait fait
// LÉGER de tous les appareils, et le choix s'écrit dès qu'on touche au bouton.
describe('la seconde remise : le relief FORT pour tout le monde', () => {
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8')

  it('le défaut est FORT', () => {
    expect(main).toContain("let reliefChoix = (localStorage.getItem('sujet21-relief') ?? 'fort') as")
  })

  it('un appareil déjà remis une fois perd son LÉGER, et lui seul', () => {
    const s = faux({ [CLE_REMISE_REGLAGES]: '1', 'sujet21-relief': 'leger', 'sujet21-eau': 'sobre' })
    expect(remetReglagesParDefaut(s)).toBe(true)
    expect(s.getItem('sujet21-relief')).toBeNull()
    expect(s.getItem('sujet21-eau')).toBe('sobre')
    expect(s.getItem(CLE_REMISE_RELIEF_FORT)).not.toBeNull()
  })

  it('une fois seulement : le LÉGER choisi ensuite tient', () => {
    const s = faux({ [CLE_REMISE_REGLAGES]: '1' })
    remetReglagesParDefaut(s)
    s.setItem('sujet21-relief', 'leger')
    expect(remetReglagesParDefaut(s)).toBe(false)
    expect(s.getItem('sujet21-relief')).toBe('leger')
  })

  it('un appareil jamais remis passe les deux remises d’un coup', () => {
    const s = faux({ 'sujet21-relief': 'off' })
    expect(remetReglagesParDefaut(s)).toBe(true)
    expect(s.getItem('sujet21-relief')).toBeNull()
    expect(s.getItem(CLE_REMISE_REGLAGES)).not.toBeNull()
    expect(s.getItem(CLE_REMISE_RELIEF_FORT)).not.toBeNull()
  })
})
