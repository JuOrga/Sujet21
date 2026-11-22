import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LA NARRATION DU HUB ET LE TUTO, DÉSACTIVÉS PAR DÉFAUT (le concepteur,
// 22/11 : « désactive la narration du hub […] tuto désactivé par défaut »).
// main.ts ne s'importe pas en test (il bâtit la page en se chargeant) : on
// lit sa source, comme main-salleHub.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

describe('le hub sans narration, l’éveil sans lancement automatique', () => {
  it('les deux drapeaux sont baissés', () => {
    expect(SRC).toMatch(/const EVEIL_PAR_DEFAUT: boolean = false/)
    expect(SRC).toMatch(/const NARRATION_HUB: boolean = false/)
  })

  it('l’éveil ne part de lui-même que si le drapeau le veut', () => {
    expect(SRC).toMatch(/function lanceEveil\(force = false\): void \{\n[^\n]*\n[^\n]*\n\s*if \(!force && !EVEIL_PAR_DEFAUT\) return/)
  })

  it('pas de cryostase au chargement : le corps du menu n’est gelé que si l’éveil se joue', () => {
    const gels = SRC.split('\n').filter((l) => /getItem\(CLE_EVEIL\)\) input\.freezeIntent = true/.test(l))
    expect(gels).toHaveLength(1)
    expect(gels[0]).toMatch(/^if \(EVEIL_PAR_DEFAUT && !coffre\.stockage\.getItem\(CLE_EVEIL\)\)/)
  })

  it('le bouton « rejouer l’éveil » et le R en plein éveil le forcent', () => {
    const bouton = SRC.match(/getElementById\('proto-rejouer'\)[\s\S]*?\n\}\)/)?.[0] ?? ''
    expect(bouton).toMatch(/lanceEveil\(true\)/)
    expect(SRC).toMatch(/if \(eveil\.etape !== 'off'\) lanceEveil\(true\)/)
  })

  it('les moments joués à l’arrivée au hub passent par NARRATION_HUB', () => {
    const appel = SRC.split('\n').findIndex((l) => l.includes("joueMoment('premier-lancement')"))
    expect(appel).toBeGreaterThan(0)
    expect(SRC.split('\n')[appel - 1]).toMatch(/if \(NARRATION_HUB\)/)
  })

  it('la cinématique du départ se tait avec elle : la run part tout de suite', () => {
    expect(SRC).toMatch(/if \(NARRATION_HUB\) void joueMoment\('lancement-run'\)\.then\(partir\)\n\s*else partir\(\)/)
  })

  it('sans éveil, l’acte 0 n’attend plus : la cuve s’ouvre, le récit se livre', () => {
    expect(SRC).toMatch(/return eveilJoue\(\) \|\| !EVEIL_PAR_DEFAUT/)
    expect(SRC).toMatch(/cuveClose: !acteZeroPasse\(\) \|\| eveilEnCours \|\| alerteDifferee/)
    expect(SRC).toMatch(/if \(!sasOutil && acteZeroPasse\(\) && !testLevel\)/)
  })

  it('le drapeau d’éveil en cours est déclaré AVANT le premier applyLevel', () => {
    // hubJoue le lit dès le chargement : déclaré après, il lèverait une
    // erreur d'initialisation (zone morte de `let`)
    const decl = SRC.indexOf('let eveilEnCours = false')
    const premier = SRC.indexOf('\napplyLevel()\n')
    expect(decl).toBeGreaterThan(0)
    expect(premier).toBeGreaterThan(decl)
  })
})
