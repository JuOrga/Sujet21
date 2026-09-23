import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// UN ESSAI NE TOUCHE NI À LA RUN NI AUX REGISTRES — trois fuites lues.
//
// Un essai d'éditeur peut se lancer en pleine descente. Trois choses en
// débordaient : la CLEF DE CACHETTE achetée pour la run s'y consommait (la
// salle suivante gardait ses voiles), une FIOLE bue y rejoignait la
// collection pour de bon, et les PASTILLES bues remplissaient la bourse de
// la run. Les éclats de mémoire, eux, se gardaient déjà (« rien ne se grave
// aux registres ») : c'est la règle qu'on étend.
//
// main.ts ne s'importe pas en test : on lit sa source, comme
// main-amorce.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

describe('un essai ne consomme ni ne gagne rien de la run', () => {
  it('la clef de cachette ne se consomme pas en essai', () => {
    const garde = SRC.match(/^\s*if \(clefCachette && (.+)\) \{$/m)
    expect(garde?.[1]).toContain('testLevel === null')
  })

  it('une fiole bue en essai ne rejoint pas la collection', () => {
    const bloc = SRC.match(/fiolePrise = true([\s\S]*?)records\.ajouteFiole/)
    expect(bloc?.[1]).toMatch(/if \(testLevel\) \{/)
  })

  it('une pastille bue en essai ne remplit pas la bourse', () => {
    const bloc = SRC.match(/const cl = pastilles\[i\]\.cl([\s\S]*?)run\.pastillesCl/)
    expect(bloc?.[1]).toMatch(/if \(!testLevel\) gagneCondensat\(cl\)/)
  })
})
