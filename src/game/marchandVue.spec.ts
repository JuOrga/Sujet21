import { describe, expect, it } from 'vitest'
import { ARTICLES_COMPTOIR } from './hub'
import { AMELIORATIONS, orbesEnVente } from './marchand'
import {
  RAYONS_MARCHAND,
  achetable,
  apresAchat,
  articlesDuRayon,
  badge,
  compteRayon,
  etatCourt,
  filtre,
  filtreSuivant,
  libelleBouton,
  tenu,
  type EtatRegistres,
} from './marchandVue'

const vide: EtatRegistres = {
  memoire: 0,
  orbes: [],
  tissees: [],
  verrous: [],
  ameliorations: [],
  servies: [],
}
const riche = { ...vide, memoire: 1000 }

describe('les rayons du marchand', () => {
  it('vendent exactement ce que le catalogue vend — les orbes non mystères, les améliorations, les provisions', () => {
    expect(RAYONS_MARCHAND.map((r) => r.id)).toEqual(['orbes', 'ameliorations', 'provisions'])
    expect(articlesDuRayon('orbes', vide).map((a) => a.id)).toEqual(orbesEnVente().map((o) => o.id))
    expect(articlesDuRayon('ameliorations', vide).map((a) => a.id)).toEqual(AMELIORATIONS.map((a) => a.id))
    expect(articlesDuRayon('provisions', vide).map((a) => a.id)).toEqual(ARTICLES_COMPTOIR.map((a) => a.id))
    // aucun orbe mystère n'est à l'étal
    expect(articlesDuRayon('orbes', vide).some((a) => a.nom.includes('???'))).toBe(false)
  })

  it('un orbe se lit dans l’ordre : tissé, en poche, offert d’origine, sinon à vendre', () => {
    const etat = (s: Partial<EtatRegistres>, id: string) =>
      articlesDuRayon('orbes', { ...riche, ...s }).find((a) => a.id === id)!.etat
    expect(etat({ tissees: ['solidification'] }, 'solidification')).toBe('tissee')
    expect(etat({ orbes: ['solidification'] }, 'solidification')).toBe('en-poche')
    expect(etat({}, 'solidification')).toBe('a-vendre')
    // la fusion est offerte d'origine — sauf verrou du scénario
    expect(etat({}, 'fusion')).toBe('offerte')
    expect(etat({ verrous: ['fusion'] }, 'fusion')).toBe('a-vendre')
    expect(etat({ verrous: ['fusion'], orbes: ['fusion'] }, 'fusion')).toBe('en-poche')
  })

  it('la mémoire décide entre à vendre et trop cher', () => {
    const a = articlesDuRayon('ameliorations', { ...vide, memoire: AMELIORATIONS[0].prix })
    expect(a[0].etat).toBe('a-vendre')
    expect(articlesDuRayon('ameliorations', vide)[0].etat).toBe('trop-cher')
    expect(articlesDuRayon('ameliorations', { ...riche, ameliorations: [AMELIORATIONS[0].id] })[0].etat).toBe('acquise')
    expect(articlesDuRayon('provisions', { ...riche, servies: ['clef'] }).find((a) => a.id === 'clef')!.etat).toBe('servie')
  })
})

describe('les filtres et les mots', () => {
  const liste = articlesDuRayon('provisions', { ...vide, memoire: 4, servies: ['sac'] })

  it('ABORDABLES garde ce qui se paie, ACQUIS ce qu’on a déjà', () => {
    expect(filtre(liste, 'tous')).toHaveLength(liste.length)
    expect(filtre(liste, 'ok').every(achetable)).toBe(true)
    expect(filtre(liste, 'ok').map((a) => a.id)).toEqual(['viatique', 'clef'])
    expect(filtre(liste, 'tenus').map((a) => a.id)).toEqual(['sac'])
    expect(filtre(liste, 'tenus').every(tenu)).toBe(true)
  })

  it('le filtre tourne en boucle', () => {
    expect(filtreSuivant('tous')).toBe('ok')
    expect(filtreSuivant('ok')).toBe('tenus')
    expect(filtreSuivant('tenus')).toBe('tous')
  })

  it('les libellés disent l’état sans se contredire', () => {
    const sac = liste.find((a) => a.id === 'sac')!
    const secours = liste.find((a) => a.id === 'secours')!
    const clef = liste.find((a) => a.id === 'clef')!
    expect(badge(sac)).toBe('DÉJÀ SERVIE')
    expect(badge(clef)).toBe('')
    expect(etatCourt(sac)).toBe('DÉJÀ SERVIE')
    expect(etatCourt(secours)).toBe('TROP CHER')
    expect(etatCourt(clef)).toBe('PROCHAINE DESCENTE')
    expect(libelleBouton(clef)).toBe('ACHETER — 4 MÉMOIRE')
    expect(libelleBouton(secours)).toBe('MÉMOIRE INSUFFISANTE')
    expect(libelleBouton(sac)).toContain('SERVIE')
    expect(apresAchat(clef, 4)).toBe('reste 0 mémoire')
    expect(apresAchat(secours, 4)).toBe('manque 4 mémoire')
    expect(apresAchat(sac, 4)).toBe('déjà à vous')
    expect(compteRayon(liste)).toBe('1 acquis · 4')
    expect(compteRayon(filtre(liste, 'ok'))).toBe('2 articles')
  })
})
