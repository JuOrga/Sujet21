import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LIEUX_ACCUEIL,
  LIEUX_PREMIER_LANCEMENT,
  PICTOS_ACCUEIL,
  valeursLieux,
  verbeAccueil,
  type EtatLieux,
} from './accueil'

// L'ACCUEIL — le poste d'observation. Ce que la fiche dit se décide dans
// game/accueil.ts ; index.html et main.ts ne se parlent que par des
// identifiants en toutes lettres. Ces gardes tombent sur un libellé
// recopié en dur, un bouton renommé, ou un reste de l'ancienne fiche.

const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

describe('le verbe de l’accueil', () => {
  it('commence quand rien n’attend', () => {
    expect(verbeAccueil({ pause: false, enDescente: false, rang: null, total: 30 })).toEqual({
      nom: 'COMMENCER',
      detail: '',
    })
  })

  it('reprend la descente sauvée, et dit à quelle salle', () => {
    expect(verbeAccueil({ pause: false, enDescente: false, rang: 8, total: 30 })).toEqual({
      nom: 'REPRENDRE',
      detail: 'salle 9 / 30',
    })
  })

  it('en pause dans une descente, reprend et situe la salle', () => {
    expect(verbeAccueil({ pause: true, enDescente: true, rang: 0, total: 27 }).detail).toBe('salle 1 / 27')
  })

  it('en pause au hub ou dans un essai, reprend sans rien situer', () => {
    expect(verbeAccueil({ pause: true, enDescente: false, rang: 4, total: 30 })).toEqual({
      nom: 'REPRENDRE',
      detail: '',
    })
  })

  it('ne dépasse jamais la dernière salle, même si le plan a raccourci', () => {
    expect(verbeAccueil({ pause: false, enDescente: false, rang: 31, total: 27 }).detail).toBe('salle 27 / 27')
  })
})

describe('les valeurs des lieux', () => {
  const base: EtatLieux = {
    orbes: 0,
    fiolesEquipees: 1,
    fiolesLogements: 2,
    codexConnues: 21,
    codexTotal: 33,
    codexVu: 21,
    module: 'CONDUITS',
    recordSalles: 0,
    emplacement: 2,
  }

  it('a une valeur pour chaque lieu du rail', () => {
    expect(Object.keys(valeursLieux(base)).sort()).toEqual([...LIEUX_ACCUEIL].sort())
  })

  it('allume les mémoires quand un orbe attend d’être tissé', () => {
    expect(valeursLieux(base)['home-cycle']).toEqual({ val: '', neuf: false })
    expect(valeursLieux({ ...base, orbes: 1 })['home-cycle']).toEqual({ val: '1 orbe', neuf: true })
    expect(valeursLieux({ ...base, orbes: 2 })['home-cycle'].val).toBe('2 orbes')
  })

  it('allume le codex sur une fiche découverte depuis la dernière ouverture', () => {
    expect(valeursLieux(base)['home-codex']).toEqual({ val: '21 / 33', neuf: false })
    expect(valeursLieux({ ...base, codexConnues: 22 })['home-codex'].neuf).toBe(true)
  })

  it('dit le module, l’emplacement et le record en peu de mots', () => {
    const v = valeursLieux({ ...base, recordSalles: 12 })
    expect(v['home-station'].val).toBe('conduits')
    expect(v['home-sauvegardes'].val).toBe('n° 2')
    expect(v['home-records'].val).toBe('12 salles')
    expect(v['home-fioles'].val).toBe('1 / 2')
  })

  it('laisse les sauvegardes au premier lancement, et seulement elles', () => {
    expect(LIEUX_PREMIER_LANCEMENT).toEqual(['home-sauvegardes'])
  })
})

describe('la fiche dans index.html et main.ts', () => {
  it('porte chaque bouton que main.ts va chercher', () => {
    for (const id of [
      'start',
      'home-restart',
      'start-abandon',
      ...LIEUX_ACCUEIL,
      'home-regie',
      'home-livraisons',
      'home-cmds',
      'home-params',
      'home-mute',
      'home-plein',
      'acc-verbe-nom',
      'acc-verbe-detail',
      'acc-devise',
      'accueil-releve',
      'home-volume',
      'version-jeu',
      'rec-name', // le champ du nom attend, caché, que requireName le montre
      'sv-operateur', // et se change dans SAUVEGARDES
      'home-ecoute', // le lecteur vit dans PARAMÈTRES
    ])
      expect(HTML, `id="${id}" manque à index.html`).toContain(`id="${id}"`)
  })

  it('n’écrit plus le verbe en dur : majAccueil est la seule source', () => {
    expect(MAIN).not.toMatch(/startBtn\.textContent\s*=/)
    expect(MAIN).not.toContain("REPRENDRE L'ESSAI")
    expect(MAIN).toContain('verbeAccueil(')
  })

  it('a quitté l’ancienne fiche : ni tuiles, ni relevé de six cases, ni figure', () => {
    for (const reste of ['home-duo', 'home-readout', 'home-figure', 'home-pitch', 'home-particles', 'home-state', 'home-seq'])
      expect(HTML, `${reste} traîne encore dans index.html`).not.toContain(reste)
    expect(MAIN).not.toContain("'home-particles'")
  })

  it('range le lecteur dans PARAMÈTRES, pas sur la fiche', () => {
    const fiche = HTML.slice(HTML.indexOf('<aside id="home"'), HTML.indexOf('</aside>', HTML.indexOf('<aside id="home"')))
    expect(fiche).not.toContain('id="home-ecoute"')
    const params = HTML.slice(HTML.indexOf('<div id="params"'))
    expect(params).toContain('id="home-ecoute"')
  })

  it('dessine ses réglages en pictogrammes à un trait', () => {
    for (const picto of Object.values(PICTOS_ACCUEIL)) {
      expect(picto.startsWith('<svg viewBox="0 0 24 24"')).toBe(true)
      expect(picto).toContain('aria-hidden="true"')
    }
  })
})
