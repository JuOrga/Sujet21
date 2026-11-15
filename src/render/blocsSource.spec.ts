import { describe, it, expect } from 'vitest'
import { blocApres, entetesAutour, occurrencesDans } from './blocsSource'

// L'outil des gardes qui lisent la source en texte : « dans le bloc » doit
// vouloir dire dans le bloc, pas « plus loin dans le fichier ».
const src = `
float a = 0.0;
if (uRelief > 0.0 && solide) {
  if (x > 0.0) {
    a = 1.0; // un commentaire avec une accolade }
  }
  b = solCache(d);
}
c = solCache(d);
`

describe('les blocs d’une source', () => {
  it('blocApres rend le bloc entier, accolades appariées, commentaires ignorés', () => {
    const b = blocApres(src, 'if (uRelief > 0.0 && solide) {')
    expect(b.startsWith('if (uRelief > 0.0 && solide) {')).toBe(true)
    expect(b.endsWith('}')).toBe(true)
    expect(b).toContain('b = solCache(d);')
    // la ligne d'après le bloc n'y est pas : c'est tout l'objet de l'outil
    expect(b).not.toContain('c = solCache(d);')
  })

  it('blocApres rend vide si l’en-tête manque, ou ne s’ouvre pas sur une accolade', () => {
    expect(blocApres(src, 'if (true) {')).toBe('')
    expect(blocApres(src, 'float a')).toBe('')
  })

  it('entetesAutour dit dans quels blocs tombe une position', () => {
    const i = src.indexOf('a = 1.0;')
    expect(entetesAutour(src, i)).toEqual(['if (x > 0.0)', 'if (uRelief > 0.0 && solide)'])
    expect(entetesAutour(src, src.indexOf('b = solCache'))).toEqual(['if (uRelief > 0.0 && solide)'])
    expect(entetesAutour(src, src.indexOf('c = solCache'))).toEqual([])
  })

  it('occurrencesDans donne chaque occurrence et ses blocs', () => {
    const o = occurrencesDans(src, 'solCache(')
    expect(o).toHaveLength(2)
    expect(o[0].entetes).toEqual(['if (uRelief > 0.0 && solide)'])
    expect(o[1].entetes).toEqual([])
  })

  it('une adresse n’est pas un commentaire', () => {
    const s = "const u = 'http://x' ; if (k) { y = 1 }"
    expect(blocApres(s, 'if (k) {')).toBe('if (k) { y = 1 }')
  })
})
