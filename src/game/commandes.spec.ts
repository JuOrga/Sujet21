// LA TABLE DES COMMANDES : ce que le joueur redéfinit doit tenir — la
// commande est exclusive, les manœuvres fixes refusent, et tout se remet
// à l'origine d'un geste.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  MANOEUVRES,
  actionDeBouton,
  actionDeTouche,
  boutonDe,
  nomBouton,
  nomTouche,
  poseSourisInverse,
  redefinie,
  redefinis,
  reinitialise,
  sections,
  sourisInverse,
  toucheDe,
} from './commandes'

// le banc tourne sans navigateur : un stockage local de fortune suffit —
// le module s'en sert exactement comme dans le jeu
const memoire = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => void memoire.set(k, v),
  removeItem: (k: string) => void memoire.delete(k),
  clear: () => memoire.clear(),
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() {
    return memoire.size
  },
} as Storage

// chaque test repart d'une table vierge
beforeEach(() => {
  localStorage.clear()
  reinitialise()
})

describe('commandes — les défauts', () => {
  it('donnent le jeu tel qu’il se joue', () => {
    expect(toucheDe('glace')).toBe('f')
    expect(toucheDe('vapeur')).toBe('g')
    expect(toucheDe('verser')).toBe('v')
    expect(boutonDe('glace')).toBe(2) // X
    expect(boutonDe('verser')).toBe(12) // croix ↑
    expect(actionDeTouche('f')).toBe('glace')
    expect(actionDeTouche('F')).toBe('glace') // la casse ne compte pas
    expect(actionDeBouton(3)).toBe('vapeur') // Y
    expect(actionDeTouche('k')).toBeNull()
  })

  it('rangent les manœuvres en sections, sans en perdre une', () => {
    const total = sections().reduce((n, s) => n + s.manoeuvres.length, 0)
    expect(total).toBe(MANOEUVRES.length)
    expect(sections()[0].titre).toBe('Le geste')
  })
})

describe('commandes — redéfinir', () => {
  it('la nouvelle touche agit, l’ancienne ne fait plus rien', () => {
    redefinis('glace', 'clavier', 'k')
    expect(toucheDe('glace')).toBe('k')
    expect(actionDeTouche('k')).toBe('glace')
    expect(actionDeTouche('f')).toBeNull()
    expect(redefinie('glace')).toBe(true)
  })

  it('la commande est EXCLUSIVE : elle est libérée de sa manœuvre d’avant', () => {
    // « g » sert à la vapeur : la donner à la glace la retire à la vapeur
    const libere = redefinis('glace', 'clavier', 'g')
    expect(libere).toBe('vapeur')
    expect(actionDeTouche('g')).toBe('glace')
    expect(toucheDe('vapeur')).toBeNull()
    // même règle à la manette
    expect(redefinis('verser', 'manette', 2)).toBe('glace') // X était à la glace
    expect(actionDeBouton(2)).toBe('verser')
    expect(boutonDe('glace')).toBeNull()
  })

  it('efface une commande sans en poser d’autre', () => {
    redefinis('verser', 'clavier', null)
    expect(toucheDe('verser')).toBeNull()
    expect(actionDeTouche('v')).toBeNull()
  })

  it('refuse de toucher aux manœuvres FIXES — on ne s’enferme pas', () => {
    expect(redefinis('fiche', 'clavier', 'p')).toBeNull()
    expect(toucheDe('fiche')).toBe('Escape')
    expect(redefinis('agir', 'manette', 5)).toBeNull()
    expect(boutonDe('agir')).toBe(0) // A
    // et une manœuvre fixe ne se fait jamais déposséder par une autre
    redefinis('glace', 'clavier', 'Escape')
    expect(toucheDe('fiche')).toBe('Escape')
  })

  it('remet tout à l’origine — d’une manœuvre ou du tableau entier', () => {
    redefinis('glace', 'clavier', 'k')
    redefinis('vapeur', 'manette', 7)
    poseSourisInverse(true)
    reinitialise('glace')
    expect(toucheDe('glace')).toBe('f')
    expect(boutonDe('vapeur')).toBe(7) // l'autre n'a pas bougé
    reinitialise()
    expect(boutonDe('vapeur')).toBe(3)
    expect(sourisInverse()).toBe(false)
    expect(redefinie('vapeur')).toBe(false)
  })

  it('retient le réglage d’une séance à l’autre (stockage local)', () => {
    redefinis('glace', 'clavier', 'k')
    poseSourisInverse(true)
    const brut = localStorage.getItem('projet21.commandes.v1') ?? ''
    expect(brut).toContain('"k"')
    expect(JSON.parse(brut).sourisInversee).toBe(true)
  })
})

describe('commandes — les noms lisibles', () => {
  it('disent la touche et le bouton en clair', () => {
    expect(nomTouche(' ')).toBe('ESPACE')
    expect(nomTouche('Escape')).toBe('ÉCHAP')
    expect(nomTouche('f')).toBe('F')
    expect(nomTouche(null)).toBe('—')
    expect(nomBouton(0)).toBe('A')
    expect(nomBouton(12)).toBe('croix ↑')
    expect(nomBouton(null)).toBe('—')
  })
})
