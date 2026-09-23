import { describe, expect, it } from 'vitest'
import { Historique, type Pas } from './historique'

const pas = (snap: string, openId: string, base = snap): Pas => ({ snap, openId, base })

describe('historique de l’éditeur : un pas emporte son entrée', () => {
  it('le 28/08 : ouvrir, annuler, enregistrer ne vise plus le tableau qu’on vient de quitter', () => {
    // « Les 3 voies » ouverte, puis clic sur « echangette »
    const h = new Historique(pas('3-voies', 'les-3-voies'))
    h.note(pas('echangette', 'echangette'))
    // annuler ramène les 3 voies — et c'est les-3-voies qu'ENREGISTRER vise
    const r = h.annule()
    expect(r).toEqual(pas('3-voies', 'les-3-voies'))
  })

  it('rétablir rouvre l’entrée qu’on avait quittée en annulant', () => {
    const h = new Historique(pas('3-voies', 'les-3-voies'))
    h.note(pas('echangette', 'echangette'))
    h.annule()
    expect(h.retablit()).toEqual(pas('echangette', 'echangette'))
  })

  it('un enregistrement noue le lien sans faire de pas : l’annulation suivante le garde', () => {
    // brouillon détaché, retouché, puis « Enregistrer sous » → id neuf
    const h = new Historique(pas('vierge', ''))
    h.note(pas('retouche', '', 'vierge'))
    h.note(pas('retouche', 'mon-tableau', 'retouche')) // même contenu : pas de pas
    h.note(pas('retouche-2', 'mon-tableau', 'retouche'))
    // annuler la retouche d'après l'enregistrement : on reste sur mon-tableau
    expect(h.annule()).toEqual(pas('retouche', 'mon-tableau', 'retouche'))
    // et avant la première retouche, le brouillon vierge était détaché
    expect(h.annule()).toEqual(pas('vierge', ''))
  })

  it('un contenu inchangé ne fait pas de pas', () => {
    const h = new Historique(pas('a', 'x'))
    h.note(pas('a', 'x'))
    expect(h.peutAnnuler).toBe(false)
  })

  it('une action nouvelle coupe le futur', () => {
    const h = new Historique(pas('a', 'x'))
    h.note(pas('b', 'x'))
    h.annule()
    expect(h.peutRetablir).toBe(true)
    h.note(pas('c', 'x'))
    expect(h.peutRetablir).toBe(false)
  })

  it('relier change l’entrée du pas courant sans empiler', () => {
    const h = new Historique(pas('a', ''))
    h.relie({ openId: 'x', base: 'a' })
    h.note(pas('b', 'x', 'a'))
    expect(h.annule()).toEqual(pas('a', 'x', 'a'))
  })

  it('la profondeur reste bornée à 100 pas', () => {
    const h = new Historique(pas('0', 'x'))
    for (let i = 1; i <= 150; i++) h.note(pas(String(i), 'x'))
    let n = 0
    while (h.annule()) n++
    expect(n).toBe(100)
  })
})
