import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LA PANNE DU 23/09 : les pastilles de condensat posées dans l'éditeur ne
// paraissaient plus en jeu. Le semis se taisait « au hub » — mais `auHub`
// vaut vrai dès le chargement, et l'essai d'éditeur ne le baisse pas : la
// salle essayée passe devant le hub sans l'effacer. La fiole suivait la
// même règle. Désormais les deux lisent salleHub() (le hub est la salle
// JOUÉE) ; et puisqu'elles paraissent en essai, ce qu'on y boit ne crédite
// ni la bourse ni la collection (la règle des éclats de mémoire).
//
// main.ts ne s'importe pas en test (il bâtit la page en se chargeant) : on
// lit sa source, comme main-amorce.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

describe('les pastilles et la fiole dans une salle essayée', () => {
  it('le prédicat du hub écarte les essais', () => {
    const corps = SRC.match(/function salleHub\(\): boolean \{([^}]*)\}/)
    expect(corps?.[1]).toContain('testLevel === null')
  })

  it('le semis des pastilles et de la fiole lit la salle jouée', () => {
    const pastilles = SRC.match(/^\s*pastilles = (.+)$/m)?.[1]
    expect(pastilles).toMatch(/^salleHub\(\) \|\|/)
    const fiole = SRC.match(/fiolePastille =\s*\n\s*(.+)/)?.[1]
    expect(fiole).toMatch(/^salleHub\(\) \|\|/)
  })

  it('une pastille bue en essai ne remplit pas la bourse', () => {
    const bloc = SRC.match(/const cl = pastilles\[i\]\.cl([\s\S]*?)run\.pastillesCl/)
    expect(bloc?.[1]).toMatch(/if \(!testLevel\) gagneCondensat\(cl\)/)
  })

  it('une fiole bue en essai ne rejoint pas la collection', () => {
    const bloc = SRC.match(/fiolePrise = true([\s\S]*?)records\.ajouteFiole/)
    expect(bloc?.[1]).toMatch(/if \(testLevel\) \{/)
  })
})
