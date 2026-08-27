import { describe, expect, it } from 'vitest'
import {
  clampPlanVoie,
  diffAuRang,
  litPalmaresVoie,
  mecaniquesDuChoix,
  momentAuRang,
  varianteDuJour,
} from './voie'

describe('voie — le plan de descente', () => {
  const plan = { longueur: 12, diffMax: 3, graineDuJour: false }

  it('le moment se répartit par tiers : début, milieu, fin', () => {
    const moments = Array.from({ length: 12 }, (_, i) =>
      momentAuRang(i + 1, plan),
    )
    expect(moments).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3])
  })

  it('la difficulté monte de 0 à diffMax, sans redescendre', () => {
    const diffs = Array.from({ length: 12 }, (_, i) => diffAuRang(i + 1, plan))
    expect(diffs[0]).toBe(0)
    expect(diffs[11]).toBe(3)
    for (let i = 1; i < diffs.length; i++)
      expect(diffs[i]).toBeGreaterThanOrEqual(diffs[i - 1])
  })

  it('au-delà de la longueur, la difficulté plafonne à diffMax', () => {
    expect(diffAuRang(99, plan)).toBe(3)
    expect(momentAuRang(99, plan)).toBe(3)
  })

  it('le clamp ramène tout plan dans les bornes — et les défauts comblent', () => {
    expect(clampPlanVoie(null)).toEqual({
      longueur: 12,
      diffMax: 3,
      graineDuJour: false,
    })
    expect(clampPlanVoie({ longueur: 999, diffMax: -4 })).toEqual({
      longueur: 40,
      diffMax: 0,
      graineDuJour: false,
    })
    expect(clampPlanVoie({ longueur: 1 }).longueur).toBe(3)
  })

  it('la graine du jour est stable, et change par jour comme par rang', () => {
    expect(varianteDuJour('2026-08-27', 3)).toBe(varianteDuJour('2026-08-27', 3))
    expect(varianteDuJour('2026-08-27', 3)).not.toBe(
      varianteDuJour('2026-08-28', 3),
    )
    expect(varianteDuJour('2026-08-27', 3)).not.toBe(
      varianteDuJour('2026-08-27', 4),
    )
    expect(varianteDuJour('2026-08-27', 3)).toMatch(/^[0-9A-Z]{4}$/)
  })

  it('les deux mécaniques du choix sont distinctes, la première évite l’écrite', () => {
    for (let tir = 0; tir < 50; tir++) {
      const alea = (): number => ((tir * 7919 + 13) % 97) / 97
      const [a, b] = mecaniquesDuChoix(1, alea)
      expect(a).not.toBe(1)
      expect(a).not.toBe(b)
    }
    const [a] = mecaniquesDuChoix(null, () => 0.99)
    expect([0, 1, 2, 3]).toContain(a)
  })

  it('le palmarès se relit blindé — le stockage abîmé rend le vierge', () => {
    expect(litPalmaresVoie(null)).toEqual({
      descentes: 0,
      bouclees: 0,
      profondeurRecord: 0,
      meilleurLivre: 0,
    })
    expect(litPalmaresVoie('{pas du json')).toEqual(litPalmaresVoie(null))
    expect(
      litPalmaresVoie(
        JSON.stringify({ descentes: 4, bouclees: 2, profondeurRecord: 17, meilleurLivre: 12.5 }),
      ),
    ).toEqual({ descentes: 4, bouclees: 2, profondeurRecord: 17, meilleurLivre: 12.5 })
    expect(litPalmaresVoie(JSON.stringify({ descentes: -3 })).descentes).toBe(0)
  })
})
