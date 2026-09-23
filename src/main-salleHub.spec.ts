import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LE HUB JOUÉ PENDANT UN ESSAI D'ÉDITEUR — un test qui garde une panne lue.
//
// `auHub` vaut vrai dès le chargement, et l'essai d'éditeur ne le baisse
// pas : la salle essayée passe devant le hub sans l'effacer. Tout ce qui
// faisait JOUER le hub sur la seule foi de `auHub` s'éveillait donc dans la
// salle essayée, au premier essai après le chargement : son sas lançait une
// descente au lieu de conclure l'essai, et les zones du hub — codées en dur,
// rendues par zonesDuHub pour toute salle de plus de 2 600 u — y posaient
// des sas de givre et de vapeur, un étal, un marchand invisibles.
//
// main.ts ne s'importe pas en test (il bâtit la page en se chargeant) : on
// lit donc sa source, comme main-amorce.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

/** Les lignes de la source qui contiennent ce motif. */
const lignes = (motif: RegExp): string[] =>
  SRC.split('\n').filter((l) => motif.test(l))

describe('le hub ne se joue que quand il est la salle jouée', () => {
  it('le prédicat écarte les essais', () => {
    const corps = SRC.match(/function salleHub\(\): boolean \{([^}]*)\}/)
    expect(corps?.[1]).toContain('testLevel === null')
  })

  it('les zones du hub ne se lisent que dans le hub joué', () => {
    const appels = lignes(/zonesDuHub\(level\)/)
    expect(appels.length).toBeGreaterThanOrEqual(2)
    for (const l of appels) expect(l).not.toMatch(/\bauHub\b/)
  })

  it('le sas de LANCEMENT ne se déclenche pas dans une salle essayée', () => {
    const branche = SRC.match(
      /\(drunk \|\| reached \|\| rejointSasHub\) &&\s*\n\s*(\w+)\s*\n\s*\) \{/,
    )
    expect(branche?.[1]).toBeDefined()
    expect(branche?.[1]).not.toBe('auHub')
    const rejoint = SRC.match(/const rejointSasHub =([\s\S]*?)\n  if \(/)
    expect(rejoint?.[1]).not.toMatch(/\bauHub\b/)
  })

  it('ni le marchand ni l’alerte de l’éveil ne se jouent en essai', () => {
    for (const l of lignes(/demarreSequence\('ALERTE'\)|q\.ecran === 'marchand'\)\) \{/))
      expect(l).not.toMatch(/\bauHub\b/)
  })
})
