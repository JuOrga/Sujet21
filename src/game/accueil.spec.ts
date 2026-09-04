import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// L'ACCUEIL NE SE MONTE PAS TOUT SEUL : sa coque est dans index.html, son
// code dans main.ts, et rien ne relie les deux qu'une poignée
// d'identifiants écrits en toutes lettres. Réorganiser l'écran — c'est
// arrivé en refaisant le menu — donne un bouton qui n'ouvre rien : pas
// d'erreur au navigateur, pas de test rouge, juste une porte morte.
const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

/** Le bouton entier, attributs compris, tel qu'il est écrit dans la coque. */
const balise = (id: string): string =>
  new RegExp(`<button id="${id}"[^>]*>`).exec(HTML)?.[0] ?? ''

describe('l’accueil — la coque et ses portes', () => {
  it('porte tous les identifiants que main.ts va chercher', () => {
    for (const id of [
      // le sas et ses deux lignes
      'start',
      'start-titre',
      'start-sous',
      // les gestes de descente, découverts en cours de run
      'home-restart',
      'start-abandon',
      // les cinq destinations
      'home-station',
      'home-codex',
      'home-cycle',
      'home-fioles',
      'home-records',
      // les réglages
      'home-params',
      'home-cmds',
      'home-mute',
      'home-plein',
      // les outils du concepteur
      'home-regie',
      'home-livraisons',
      // le relevé vivant, lu sur l'échantillon qui dérive derrière
      'home-volume',
      'home-particles',
      'home-state',
      'home-condensat',
      'home-memoire',
      'home-orbes',
      // l'opérateur, la version (sept touchers : mode concepteur), le journal
      'rec-name',
      'rec-need',
      'rec-essai',
      'rec-rows',
      'version-jeu',
      'home-seq',
    ])
      expect(HTML, `id="${id}" manque à index.html`).toContain(`id="${id}"`)
  })

  it('ne montre QU’UN seul gros bouton, et c’est le sas', () => {
    // toute la hiérarchie de l'écran tient dans cette surface : deux
    // boutons larges, et plus personne ne sait par où commencer
    expect(HTML.match(/class="ac-sas"/g) ?? []).toHaveLength(1)
    expect(balise('start')).toContain('class="ac-sas"')
  })

  it('garde le dessin du sas : son intitulé s’écrit dans son <span>', () => {
    // `startBtn.textContent = …` remplaçait le contenu du bouton — dessin,
    // voile et pastille de touche partaient avec le mot.
    expect(MAIN).not.toMatch(/startBtn\.(textContent|innerHTML)\s*=/)
    expect(MAIN).toContain('startTitre.textContent')
    expect(MAIN).toContain('startSous.textContent')
  })

  it('réserve les outils du concepteur : enclos ET boutons portent data-dev', () => {
    for (const id of ['home-regie', 'home-livraisons'])
      expect(balise(id), `${id} doit rester privé`).toContain('data-dev')
    // l'enclos aussi : sinon son étiquette « OUTILS CONCEPTEUR » resterait
    // affichée sur l'accueil public, au-dessus de deux boutons invisibles
    expect(HTML).toContain('class="ac-dev" data-dev')
    // …et aucune destination publique ne doit se retrouver dedans
    for (const id of ['home-station', 'home-codex', 'home-cycle', 'home-fioles', 'home-records'])
      expect(balise(id), `${id} est public`).not.toContain('data-dev')
  })

  it('laisse le palmarès là où main.ts le déménage', () => {
    // le voile RECORDS déplace ce bloc puis le remet à sa place : sans lui,
    // `recsBloc.parentElement` est nul et l'écran casse au retour
    expect(HTML).toContain('class="home-records"')
    expect(MAIN).toContain(".querySelector('.home-records')")
  })
})
