import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EMBOUT_U, tranchesBandeau } from './lampes'

// LE BANDEAU EN TROIS TRANCHES (retour du concepteur, 16/11 : les lampes
// « moches ») : l'image, étirée d'un seul tenant, allongeait ses embouts en
// pointes. Les embouts gardent leur forme, le milieu prend la longueur.
const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
const a = source.indexOf('private drawLampes(')
const drawLampes = a < 0 ? '' : source.slice(a, source.indexOf('\n  }\n', a))

describe('le bandeau se dessine en trois tranches', () => {
  it('les embouts sont carrés, quelle que soit la longueur de la lampe', () => {
    for (const demiLong of [60, 120, 400, 900]) {
      const t = tranchesBandeau(demiLong, 20)
      expect(t).toHaveLength(3)
      expect(t[0].x1 - t[0].x0).toBeCloseTo(40, 6)
      expect(t[2].x1 - t[2].x0).toBeCloseTo(40, 6)
      expect([t[0].u0, t[0].u1]).toEqual([0, EMBOUT_U])
      expect([t[2].u0, t[2].u1]).toEqual([1 - EMBOUT_U, 1])
    }
  })

  it('le milieu prend le reste : les tranches se suivent sans trou, du bord au bord du quad', () => {
    const t = tranchesBandeau(400, 20)
    expect(t[0].x0).toBeCloseTo(-420, 6)
    expect(t[2].x1).toBeCloseTo(420, 6)
    expect(t[1].x0).toBe(t[0].x1)
    expect(t[1].x1).toBe(t[2].x0)
    expect([t[1].u0, t[1].u1]).toEqual([EMBOUT_U, 1 - EMBOUT_U])
  })

  it('les deux bouts de la lampe tombent au centre des embouts', () => {
    // le segment de la lampe va de −demiLong à +demiLong : c'est là que
    // l'image a ses brides (à un huitième de chaque bord)
    const t = tranchesBandeau(400, 20)
    expect((t[0].x0 + t[0].x1) / 2).toBeCloseTo(-400, 6)
    expect((t[2].x0 + t[2].x1) / 2).toBeCloseTo(400, 6)
  })

  it('une lampe trop courte serre ses deux embouts, sans milieu ni recouvrement', () => {
    const t = tranchesBandeau(8, 20)
    expect(t).toHaveLength(2)
    expect(t[0].x0).toBeCloseTo(-28, 6)
    expect(t[0].x1).toBeCloseTo(0, 6)
    expect(t[1].x0).toBeCloseTo(0, 6)
    expect(t[1].x1).toBeCloseTo(28, 6)
  })

  it('le rendu pose le bandeau tranche par tranche, le plafonnier d’un seul quad', () => {
    expect(drawLampes).toContain('tranchesBandeau(l.demiLong, R)')
    expect(drawLampes).not.toMatch(/const hw = l\.bandeau \? l\.demiLong \+ R : R/)
  })
})
