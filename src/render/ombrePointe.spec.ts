import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { OMBRE_POINTE_GLSL, OMBRE_POINTE_MARGE, leveePointe } from './ombrePointe'

// LA POINTE DES OMBRES S'ADOUCIT (retour du concepteur, 16/11) : des arcs
// nets au sol, lumière allumée — le bout de l'ombre d'un mur, coupé au
// seuil où le rayon de la lampe passe au-dessus de lui. Le shader ne tourne
// pas sous vitest : la règle pure est testée, sa SOURCE lue.
const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
const a = source.indexOf('const LIGHT_FS = `')
const i = source.indexOf('float sceneSdf(', a)
const sceneSdf = i < 0 ? '' : source.slice(i, source.indexOf('\n}\n', i))

describe('la pointe d’une ombre portée est un fondu', () => {
  // la pénombre du cuiseur : pen · h / t, bornée à 1 ; `plein` = t / pen
  const lumiere = (d: number, alt: number, h: number, t: number, pen: number): number =>
    Math.min(1, (pen * (d + leveePointe(alt, h, t / pen))) / t)

  it('franchement sous le sommet, l’obstacle ombre comme avant', () => {
    expect(leveePointe(0, 140, 50)).toBe(0)
    expect(leveePointe(140 - OMBRE_POINTE_MARGE, 140, 50)).toBe(0)
  })

  it('au sommet, la pleine lumière : le seuil qui suit (alt ≥ h, enjambé) ne se voit plus', () => {
    for (const [t, pen] of [[40, 4], [300, 6], [900, 9]] as const) {
      expect(lumiere(0, 140, 140, t, pen)).toBeCloseTo(1, 6)
    }
  })

  it('dans la marge, la lumière monte peu à peu, à toute distance de l’obstacle', () => {
    for (const [t, pen] of [[40, 4], [300, 6], [900, 9]] as const) {
      let avant = 0
      for (let alt = 140 - OMBRE_POINTE_MARGE; alt <= 140; alt += 0.5) {
        const l = lumiere(0, alt, 140, t, pen)
        expect(l).toBeGreaterThanOrEqual(avant)
        expect(l - avant).toBeLessThan(0.03)
        avant = l
      }
      // à mi-marge, l'ombre est encore à moitié là : elle ne s'éteint pas
      // dès le bas de la marge (le défaut de la levée fixe)
      expect(lumiere(0, 140 - OMBRE_POINTE_MARGE / 2, 140, t, pen)).toBeCloseTo(0.5, 6)
    }
  })

  it('le cuiseur lève CHAQUE obstacle, formes et pièces comprises', () => {
    expect(source).toContain('${OMBRE_POINTE_GLSL}')
    expect(OMBRE_POINTE_GLSL).toContain('float leveePointe(float alt, float h, float plein)')
    expect(sceneSdf).toMatch(/float leve = leveePointe\(alt, hObs, plein\);/)
    // les deux marches (le sol, les toits) donnent leur t / pen
    expect(source.split('sceneSdf(p + dir * ').length - 1).toBe(2)
    expect(source).toMatch(/sceneSdf\(p \+ dir \* t, t \* hL \/ distL, t \/ pen\)/)
    expect(source).toMatch(/sceneSdf\(p \+ dir \* tT, hT \+ tT \* monte, tT \/ pen\)/)
    const poses = sceneSdf.match(/d = min\(d, [^;]*;/g) ?? []
    expect(poses.length).toBeGreaterThanOrEqual(4)
    for (const p of poses) expect(p).toMatch(/\+ leve\)/)
  })
})
