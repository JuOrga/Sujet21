import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// La hauteur des blocs est écrite DEUX FOIS dans renderer.ts : une fois dans
// le shader principal (qui éclaire le DESSUS des solides) et une fois dans le
// cuiseur de carte de lumière (qui borne la longueur des ombres portées). Les
// deux doivent dire la même chose, sinon les ombres se couchent pour une
// hauteur et les sommets s'éclairent pour une autre — l'incohérence serait
// invisible en test unitaire et coûteuse à débusquer à l'œil.
const source = readFileSync(
  fileURLToPath(new URL('./renderer.ts', import.meta.url)),
  'utf8',
)

describe('Éclairage des volumes — la hauteur des blocs', () => {
  it('vaut la même chose dans le shader principal et dans le cuiseur', () => {
    const valeurs = [...source.matchAll(/#define\s+HAUTEUR_BLOCS\s+([0-9.]+)/g)].map(
      (m) => m[1],
    )
    expect(valeurs).toHaveLength(2)
    expect(valeurs[0]).toBe(valeurs[1])
  })

  it('laisse un plancher de lisibilité aux solides : jamais tout à fait noirs', () => {
    const m = source.match(/#define\s+PLANCHER_SOLIDE\s+([0-9.]+)/)
    expect(m).not.toBeNull()
    const plancher = Number(m![1])
    expect(plancher).toBeGreaterThan(0.1) // un obstacle reste visible
    expect(plancher).toBeLessThan(1) // mais la lumière a bien un effet
  })
})
