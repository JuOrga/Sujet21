import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// UN ESSAI NE TOUCHE PAS À LA RUN — trois fuites lues.
//
// Un essai d'éditeur (ou de planche) peut se lancer en pleine descente. Il
// en débordait trois fois : la CLEF DE CACHETTE achetée pour la run s'y
// consommait (la salle suivante gardait ses voiles), un ÉCLAT pris en essai
// restait « déjà pris » pour la run (sa mémoire perdue), et la RÉSERVE et
// l'HORLOGE de la run étaient remises à zéro sans retour. Les pastilles et
// la fiole bues en essai, elles, sont gardées avec leur semis
// (main-essaiPastilles.spec.ts).
//
// main.ts ne s'importe pas en test : on lit sa source, comme
// main-amorce.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

/** Le corps d'une fonction du module, jusqu'à sa première accolade de fin. */
const corps = (nom: string): string =>
  SRC.match(new RegExp(`function ${nom}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''

describe('un essai ne consomme rien de la run', () => {
  it('la clef de cachette ne se consomme pas en essai', () => {
    const garde = SRC.match(/^\s*if \(clefCachette && (.+)\) \{$/m)
    expect(garde?.[1]).toContain('testLevel === null')
  })

  it('un éclat pris en essai ne se retient pas pour la run', () => {
    const bloc = SRC.match(/for \(const i of graves\) \{([\s\S]*?)gagneMemoireRun/)
    expect(bloc?.[1]).toMatch(/if \(testLevel\) \{[\s\S]*\} else \{[\s\S]*eclatsPrisRun\.add/)
    expect(bloc?.[1].split('} else {')[0]).not.toContain('eclatsPrisRun.add')
  })

  it('la réserve et l’horloge de la run se mettent de côté, puis se rendent', () => {
    // aucun départ d'essai ne les efface sans les garder
    expect(SRC).not.toMatch(/fromEditor = true\s*\n\s*run\.bonbonneLiters = 0/)
    expect(corps('startTest')).not.toContain('run.bonbonneLiters = 0')
    expect(corps('startTest')).toContain('ouvreEssai()')
    // restart les rend dès que plus aucun essai n'est joué
    expect(corps('restart')).toMatch(/if \(sauveEssai && testLevel === null\)/)
    // une run neuve, reprise ou close les oublie
    for (const f of ['newExpedition', 'retourAuLabo', 'quitteAuMenu', 'reprendreRun'])
      expect(corps(f)).toContain('sauveEssai = null')
  })
})
