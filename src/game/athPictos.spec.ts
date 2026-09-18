import { describe, expect, it } from 'vitest'
import { PICTOS, picto, type NomPicto } from './athPictos'

describe('les pictogrammes de l\'ATH', () => {
  const noms = Object.keys(PICTOS) as NomPicto[]

  it('couvre le cadran, les commandes, le tiroir et la capsule', () => {
    for (const n of [
      'glace', 'eau', 'vapeur',
      'menu', 'pause', 'lecture', 'editeur',
      'legende', 'etats', 'dossier', 'station', 'recadrer', 'vortex',
      'son', 'muet', 'recommencer', 'fiche', 'banc',
      'coque', 'instruments',
    ])
      expect(noms).toContain(n)
  })

  it('n\'écrit que des tracés SVG bien formés', () => {
    for (const n of noms) {
      expect(PICTOS[n], n).toMatch(/^M[0-9MmLlHhVvCcSsQqTtAaZz .,-]+$/)
    }
  })

  it('rend un svg décoratif, sans couleur propre : le CSS le teinte', () => {
    const s = picto('eau')
    expect(s).toContain('viewBox="0 0 24 24"')
    expect(s).toContain('aria-hidden="true"')
    expect(s).toContain(`d="${PICTOS.eau}"`)
    expect(s).not.toMatch(/fill=|stroke=/)
  })
})
