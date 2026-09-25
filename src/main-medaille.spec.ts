import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// La médaille repliée et le voile des offres : des défauts de CSS de la
// revue de la livraison #461, qu'on garde en lisant la feuille elle-même.
const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')

describe('la médaille repliée et le voile des offres (index.html)', () => {
  it('repliée, l’anneau ne tourne plus (ellipse qui balayait le titre)', () => {
    expect(html).toMatch(/\.mb-scene\.mb-compact \.mb-rang-anneau \{[^}]*animation: none/)
  })

  it('le voile d’une offre bat « .mb-carte small » en spécificité', () => {
    expect(html).toMatch(/\.mb-carte \.mb-ev-voile \{/)
    expect(html).not.toMatch(/^\s*\.mb-ev-voile \{/m)
  })
})
