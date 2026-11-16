import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// LE NOYAU DE REGROUPEMENT : le curseur de la manette (LB tenu) se montre
// par un effet DU CORPS, pas par une mire dessinée par-dessus. Ces gardes
// tiennent ce choix — le rendu lui-même se juge à l'œil.
const SHADER = readFileSync(resolve(__dirname, 'renderer.ts'), 'utf8')
const MAIN = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')

/** Le bloc du shader qui peint le noyau. */
function bloc(): string {
  const i = SHADER.indexOf('if (uNoyau.z > 0.003) {')
  expect(i).toBeGreaterThan(0)
  return SHADER.slice(i, SHADER.indexOf('// Gel (tableau 2)', i))
}

describe('le noyau de regroupement', () => {
  it('est un uniforme du corps, alimenté à chaque image', () => {
    expect(SHADER).toContain('uniform vec4 uNoyau;')
    expect(SHADER).toContain("cu['uNoyau'],")
    expect(MAIN).toContain('noyau: noyau.presence,')
    expect(MAIN).toContain('noyauPrise: noyau.prise,')
  })

  it('reste SOUS la peau : masqué par le corps, en liquide seulement', () => {
    const b = bloc()
    expect(b).toContain('clamp(player, 0.0, 1.0)')
    expect(b).toContain('(1.0 - vap)')
    expect(b).toContain('(1.0 - icy)')
    // chaque apport de lumière passe par le masque : rien ne déborde sur la cuve
    const apports = b.split('\n').filter((l) => l.includes('water +='))
    expect(apports.length).toBe(3)
    for (const l of apports) expect(l).toContain('masqueN')
  })

  it('ses rides CONVERGENT (la caresse, elle, les écarte)', () => {
    expect(bloc()).toMatch(/sin\(dN \* [\d.]+ \+ uTime/)
    expect(SHADER).toMatch(/sin\(dC \* [\d.]+ - age/)
  })

  it('a remplacé la mire : plus rien ne se dessine par-dessus l’eau', () => {
    expect(MAIN).not.toContain('drawCurseurVolume')
    expect(MAIN).toContain('majNoyau(dtReal)')
  })
})
