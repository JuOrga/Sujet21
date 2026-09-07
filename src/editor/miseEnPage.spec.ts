import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LA MISE EN PAGE DE L'ÉDITEUR NE SE TESTE PAS AU PIXEL ICI (vitest tourne
// sans navigateur) — mais ses garde-fous, si. Chacun d'eux a été posé après
// une panne vécue : la palette de gauche qui partait de côté d'un coup de
// molette ou d'un glisser oblique (mesuré : 59 px de trop dans une colonne
// de 232), la barre d'outils qui recouvrait le haut des panneaux en écran
// étroit (jusqu'à 90 px sur iPad en ÉNORME). Un « nettoyage » qui retire
// l'une de ces lignes rend la panne sans qu'aucun test ne bouge : celui-ci
// la nomme.
const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

// le corps d'une règle CSS, repéré par son sélecteur exact en tête de ligne
function regle(css: string, selecteur: string): string {
  const debut = css.indexOf(`\n      ${selecteur} {`)
  expect(debut, `la règle « ${selecteur} » manque`).toBeGreaterThan(-1)
  return css.slice(debut, css.indexOf('}', debut))
}

describe('l’éditeur — les panneaux et la barre tiennent dans leur cadre', () => {
  it('les panneaux latéraux interdisent le défilement de côté', () => {
    // « overflow-y: auto » seul vaut aussi « overflow-x: auto » : sans cette
    // ligne, tout libellé plus large que la colonne rend le panneau
    // défilable de côté.
    expect(regle(HTML, '.ed-side')).toMatch(/overflow-x:\s*hidden/)
  })

  it('les libellés des outils s’enroulent au lieu de déborder', () => {
    // les boutons de l'éditeur sont sur une ligne par défaut ; les outils
    // aux noms longs (PLOT D'ARTICLE (CONDENSAT)…) passent à la ligne
    expect(regle(HTML, '#editor button.ed-tool')).toMatch(/white-space:\s*normal/)
  })

  it('en écran étroit, la barre d’outils prend sa hauteur au lieu de 46 px', () => {
    // la barre s'enroule sur deux à quatre lignes en dessous de 900 px :
    // une rangée fixée la faisait déborder sur le haut des panneaux
    // (plusieurs blocs portent cette largeur : on vise celui de l'éditeur)
    const debut = HTML.indexOf('@media (max-width: 900px) {\n        #editor {')
    expect(debut, 'la règle d’écran étroit de #editor manque').toBeGreaterThan(-1)
    const editeur = HTML.slice(debut, HTML.indexOf('}', debut))
    expect(editeur).toMatch(/grid-template-rows:\s*auto\b/)
  })

  it('le glisser au doigt et le stick ne poussent pas de côté un panneau qui l’interdit', () => {
    // scrollLeft s'écrit même sur un « overflow-x: hidden » : sans la garde,
    // un glisser oblique pousse la palette hors champ et rien ne la ramène
    expect(MAIN).toContain('if (suivi.lateral) suivi.cible.scrollLeft = suivi.left0 - dx')
    expect(MAIN).toContain('if (defileDeCote(sc)) sc.scrollLeft += vx * 1100 * dt')
    expect(MAIN).toMatch(/function defileDeCote\(el: HTMLElement\): boolean \{\s*return \/\(auto\|scroll\)\/\.test\(getComputedStyle\(el\)\.overflowX\)/)
  })
})
