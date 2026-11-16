import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LES CARTES IMPOSÉES DE L'ÉDITEUR montrent chaque instrument par sa case
// rendue, comme le jeu : le concepteur doit reconnaître dans l'éditeur le
// dessin que le joueur verra. Une carte perso garde l'émoji qu'il a tapé —
// c'est iconeInstrumentHTML qui le rend. L'éditeur vit dans le DOM : la
// garde lit editor.ts en texte (vitest n'a pas de navigateur).
const EDITEUR = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')
const debut = EDITEUR.indexOf('\n  private syncCartes(')
const corps = EDITEUR.slice(debut, EDITEUR.indexOf('\n  }\n', debut))

describe('l’éditeur — les cartes imposées', () => {
  it('chaque case et le compte passent par iconeInstrumentHTML, jamais par l’émoji du catalogue', () => {
    expect(debut).toBeGreaterThan(-1)
    expect(corps).not.toMatch(/\.icone\b/)
    expect(corps.match(/iconeInstrumentHTML\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    // le compte porte désormais du HTML : il s'écrit en innerHTML
    expect(corps).toContain('compte.innerHTML')
  })
})
