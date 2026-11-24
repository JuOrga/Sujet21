import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LIEUX_ACCUEIL,
  LIEUX_PREMIER_LANCEMENT,
  PICTOS_ACCUEIL,
  SOUS_LIEUX_COMMUNAUTE,
  valeursCommunaute,
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

  it('COMMUNAUTÉ compte les salles de l’éditeur et les créations publiées, sans rien dire à zéro', () => {
    expect(valeursCommunaute({ sallesAtelier: 0, creationsPubliees: 0 })).toEqual({ 'home-atelier': '', 'home-creations': '' })
    expect(valeursCommunaute({ sallesAtelier: 3, creationsPubliees: 1 })).toEqual({
      'home-atelier': '3 salles',
      'home-creations': '1 publiée',
    })
    expect(valeursCommunaute({ sallesAtelier: 1, creationsPubliees: 2 })).toEqual({
      'home-atelier': '1 salle',
      'home-creations': '2 publiées',
    })
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
      ...SOUS_LIEUX_COMMUNAUTE,
      'acc-communaute',
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

  it('COMMUNAUTÉ est un lieu pour tous, qui s’ouvre sur ÉDITEUR et CRÉATIONS DE LA COMMUNAUTÉ', () => {
    const groupe = /<button id="home-communaute"[^>]*>/.exec(HTML)?.[0] ?? ''
    expect(groupe).toContain('class="acc-lieu acc-groupe"')
    expect(groupe).toContain('aria-expanded="false"')
    expect(groupe).toContain('aria-controls="acc-communaute"')
    // le sous-menu : fermé au départ, les deux choix nommés pour le joueur
    const sous = /<div id="acc-communaute"[^>]*>([\s\S]*?)<\/div>/.exec(HTML)
    expect(sous?.[0]).toMatch(/<div id="acc-communaute"[^>]*hidden>/)
    expect(sous?.[1]).toMatch(/id="home-atelier"[^>]*><span>ÉDITEUR<\/span>/)
    expect(sous?.[1]).toMatch(/id="home-creations"[^>]*><span>CRÉATIONS DE LA COMMUNAUTÉ<\/span>/)
    expect(SOUS_LIEUX_COMMUNAUTE).toEqual(['home-atelier', 'home-creations'])
    // ni mode concepteur, ni allure d'outil
    for (const bouton of [groupe, ...(sous?.[1].match(/<button[^>]*>/g) ?? [])]) {
      expect(bouton).not.toContain('data-dev')
      expect(bouton).not.toContain('acc-outil')
    }
    // main.ts l'ouvre et le referme sur place
    const clic = MAIN.slice(MAIN.indexOf("getElementById('home-communaute')"))
    expect(clic.slice(0, 600)).toMatch(/setAttribute\('aria-expanded', String\(ouvert\)\)[\s\S]*sous\.hidden = !ouvert/)
    // la RÉGIE, elle, reste au concepteur
    expect(/<button id="home-regie"[^>]*>/.exec(HTML)?.[0]).toContain('data-dev')
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
