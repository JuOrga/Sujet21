import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// La médaille repliée et le voile des offres : des défauts de CSS de la
// revue de la livraison #461, qu'on garde en lisant la feuille elle-même.
const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')

describe('la médaille repliée et le voile des offres (index.html)', () => {
  // la médaille ronde est devenue un SCEAU octogonal (cérémonie « station ») :
  // l'anneau qui tournait n'existe plus, mais le repli reste un bandeau
  // immobile — un sceau qui retomberait ou pencherait à chaque repli
  // balaierait le titre comme l'ellipse le faisait
  it('repliée, la marque du rang ne tourne ni ne retombe (ellipse qui balayait le titre)', () => {
    expect(html).toMatch(/\.mb-scene\.mb-compact \.mb-rang \{[^}]*animation: none/)
    expect(html).toMatch(/\.mb-scene\.mb-compact \.mb-rang \{[^}]*--mb-sceau-incl: 0deg/)
  })

  // l'offre de rencontre est devenue une cartouche (cérémonie « station ») :
  // le voile porte toujours deux classes, sinon le détail ordinaire, à
  // spécificité égale, lui reprenait sa couleur
  it('le voile d’une offre bat le détail ordinaire en spécificité', () => {
    expect(html).toMatch(/\.mb-offre-detail\.mb-ev-voile \{/)
    expect(html).not.toMatch(/^\s*\.mb-ev-voile \{/m)
  })
})
