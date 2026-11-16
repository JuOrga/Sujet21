import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FOND_DALLE } from './fondCuve'
import { PARALLAXE_DEFAUTS, coucheFond } from './parallaxe'

// LE FOND DE CUVE, REPRIS (retour du concepteur, 16/11) : « très basique »,
// les mêmes hublots répétés, une grille par-dessus, et une parallaxe qui
// donnait l'impression que le jeu glissait sur un verre posé au-dessus du
// fond. Le shader ne tourne pas sous vitest : on lit sa SOURCE.
const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
const a = source.indexOf('// Dedans : fond de cuve')
const fond = a < 0 ? '' : source.slice(a, source.indexOf('// halo le long des parois', a))

describe('le fond de cuve est collé au monde', () => {
  it('la paroi ne glisse plus sous le jeu : suivi 1, zoom 1', () => {
    expect(PARALLAXE_DEFAUTS.cuve).toEqual({ suivi: 1, zoom: 1 })
  })

  it('à tout zoom et où que soit la caméra, un point du fond reste sous le même point du monde', () => {
    for (const z of [0.12, 0.3, 1, 2.5]) {
      for (const [cx, cy] of [[0, 0], [300, -80], [-1200, 640]] as const) {
        const p = coucheFond(1234, -567, cx, cy, z, PARALLAXE_DEFAUTS.cuve, PARALLAXE_DEFAUTS.ref)
        expect(p.x).toBeCloseTo(1234, 6)
        expect(p.y).toBeCloseTo(-567, 6)
      }
    }
  })
})

describe('le fond de cuve n’a plus de trame de mesure', () => {
  it('aucune ligne de grille ne se peint sur le fond', () => {
    expect(fond).not.toBe('')
    expect(fond).not.toContain('gridLine(')
    expect(fond).not.toContain('gridDim')
  })
})

describe('la dalle du fond : assez grande pour qu’un tableau standard n’en voie qu’une', () => {
  it('un tableau standard (2400 × 1500) tient dans une dalle', () => {
    expect(FOND_DALLE[0]).toBeGreaterThanOrEqual(2400)
    expect(FOND_DALLE[1]).toBeGreaterThanOrEqual(1500)
  })

  it('le fond et ses deux reflets se lisent au pas de la dalle, plus au carreau de 900', () => {
    expect(source).not.toMatch(/uTexTank,[^;]*\/ 900\.0/)
    expect(source.split('/ FOND_DALLE').length - 1).toBe(3)
    expect(source).toMatch(/#define FOND_DALLE vec2\(\$\{glslFloat\(FOND_DALLE\[0\]\)\}, \$\{glslFloat\(FOND_DALLE\[1\]\)\}\)/)
  })
})
