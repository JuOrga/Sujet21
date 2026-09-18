// LE CONTRAT DE L'ATH. Rien ne relie index.html à main.ts qu'un nom écrit en
// toutes lettres : un id renommé donne une interface muette, sans erreur et
// sans test rouge. Et une taille écrite sans --ui échappe au seul réglage
// d'accessibilité du jeu. Ce fichier verrouille les deux.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PICTOS, type NomPicto } from './athPictos'

const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

/** Le CSS de l'ATH, entre ses deux bornes écrites dans index.html. */
const CSS_ATH = ((): string => {
  const a = HTML.indexOf('/* ==== ATH : DÉBUT ==== */')
  const b = HTML.indexOf('/* ==== ATH : FIN ==== */')
  return a >= 0 && b > a ? HTML.slice(a, b) : ''
})()

describe('l’ATH garde les noms que le jeu cherche', () => {
  it.each([
    'hud', 'hud-volume', 'bonbonne', 'gauge-fill', 'gauge-threshold',
    'hud-tableau', 'hud-vies', 'hud-vies-chip', 'hud-cond', 'hud-cond-chip',
    'hud-instr', 'hud-instr-chip', 'hud-coque', 'hud-capture',
    'hud-perte', 'hud-rosee', 'hud-fantome',
    'voie-hud', 'vh-rang', 'vh-rail', 'vh-stade',
    'statebar', 'state-eau', 'state-glace', 'state-vapeur', 'state-zone',
    'touchbar', 'hud-danger',
  ])('#%s existe', (id) => {
    expect(HTML).toContain(`id="${id}"`)
  })
})

describe('le haut de l’écran : deux coins, plus de bandeau', () => {
  it('borne son CSS', () => {
    expect(CSS_ATH.length).toBeGreaterThan(0)
  })

  it('range les instruments dans .ath-vital et .ath-etat', () => {
    const hud = HTML.slice(HTML.indexOf('<div id="hud">'), HTML.indexOf('id="rejeu-barre"'))
    const vital = hud.slice(hud.indexOf('ath-vital'), hud.indexOf('ath-etat'))
    const etat = hud.slice(hud.indexOf('ath-etat'))
    for (const id of ['hud-volume', 'bonbonne', 'gauge-fill', 'hud-perte', 'hud-rosee', 'hud-fantome'])
      expect(vital, id).toContain(`id="${id}"`)
    for (const id of ['voie-hud', 'hud-tableau', 'hud-vies', 'hud-cond', 'hud-coque', 'hud-capture'])
      expect(etat, id).toContain(`id="${id}"`)
  })

  it('ne peint plus de bandeau : #hud n’a ni fond ni flou', () => {
    const regle = /#hud \{[^}]*\}/.exec(CSS_ATH)?.[0] ?? ''
    expect(regle).toContain('pointer-events: none')
    expect(regle).not.toMatch(/background|backdrop-filter|border-bottom/)
  })

  it('écrit toutes ses tailles de texte à l’échelle --ui', () => {
    const tailles = CSS_ATH.match(/font-size:[^;]+;/g) ?? []
    expect(tailles.length).toBeGreaterThan(5)
    for (const t of tailles) expect(t).toContain('var(--ui)')
  })

  it('respecte prefers-reduced-motion', () => {
    expect(CSS_ATH).toContain('prefers-reduced-motion: reduce')
  })

  it('écrit en dur les mêmes tracés que le dictionnaire', () => {
    const durs = [...HTML.matchAll(/data-picto="([a-z]+)"[^>]*><path d="([^"]+)"/g)]
    expect(durs.length).toBeGreaterThan(0)
    for (const [, nom, d] of durs) expect(d, nom).toBe(PICTOS[nom as NomPicto])
  })
})

describe('le cadran des états', () => {
  it('porte des pictogrammes, plus d’emoji', () => {
    const bar = HTML.slice(HTML.indexOf('<div id="statebar"'), HTML.indexOf('id="state-zone"'))
    expect(bar).not.toMatch(/[💧❄💨]/u)
    for (const n of ['eau', 'glace', 'vapeur']) expect(bar).toContain(`data-picto="${n}"`)
  })

  it('ne s’empile plus sur la barre du bas : --tb-h a disparu', () => {
    expect(HTML).not.toContain('--tb-h')
    expect(MAIN).not.toContain('--tb-h')
    expect(MAIN).toContain('--cadran-h')
  })

  it('garde la barre de rejeu dans l’écran en compact', () => {
    // elle héritait de --tb-h (~459 px en colonne) et partait hors écran
    const compact = HTML.slice(HTML.indexOf('/* ATH compact : le bas */'))
    expect(compact.slice(0, 1200)).toContain('#rejeu-barre')
  })
})

describe('les commandes et le tiroir', () => {
  it('a son tiroir dans la coque', () => {
    expect(HTML).toContain('id="tiroir"')
  })

  it('bâtit le tiroir depuis la liste testée, pas depuis une liste recopiée', () => {
    expect(MAIN).toContain('entreesTiroir(')
    expect(MAIN).toContain('toucheDe(')
  })

  it('ne met plus la barre en colonne : c’est elle qui débordait', () => {
    const regles = HTML.match(/#touchbar \{[^}]*\}/g) ?? []
    for (const r of regles) expect(r).not.toContain('flex-direction: column')
  })

  it('n’a plus l’ancienne fabrique à emoji', () => {
    expect(MAIN).not.toContain('touchButton(')
  })
})

export { HTML, MAIN, CSS_ATH }
