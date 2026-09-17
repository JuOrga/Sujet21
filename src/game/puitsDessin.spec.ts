import { describe, expect, it } from 'vitest'
import type { PuitsDef } from './level'
import { AURA_FACTEUR, LUEURS_COEUR, LUEURS_HALO, lueursPuits, omegaPuits, porteeVisible } from './puitsDessin'

const P: PuitsDef = { x: 100, y: -50, force: 600, rayon: 350 }

describe('les lueurs d’un puits — un décor qui dit vrai', () => {
  it('dans le cœur, toutes tournent à la même vitesse angulaire √(force/rayon) ; au-delà, elles traînent', () => {
    const w = Math.sqrt(600 / 350)
    expect(omegaPuits(P, 100)).toBeCloseTo(w, 6)
    expect(omegaPuits(P, 350)).toBeCloseTo(w, 6)
    expect(omegaPuits(P, 700)).toBeCloseTo(w / Math.sqrt(8), 6)
  })

  it('les mêmes lueurs à chaque image, dans le cœur et l’aura, jamais sur la lisière ; elles avancent d’un pas de temps dans le sens du puits', () => {
    const a = lueursPuits(P, 1.5)
    const b = lueursPuits(P, 1.5)
    expect(a).toEqual(b)
    expect(a).toHaveLength(LUEURS_COEUR + LUEURS_HALO)
    for (const l of a) {
      expect(l.r).toBeGreaterThan(0.2 * 350)
      expect(l.r).toBeLessThanOrEqual(porteeVisible(P) + 1e-6)
      expect(Math.abs(l.r - 350)).toBeGreaterThan(10) // pas d'anneau à la lisière
      expect(Math.hypot(l.tx, l.ty)).toBeCloseTo(1, 6)
      expect(Math.hypot(l.x - P.x, l.y - P.y)).toBeCloseTo(l.r, 6)
    }
    // un pas plus tard, chaque lueur s'est déplacée dans la direction de sa traîne
    const c = lueursPuits(P, 1.5 + 0.01)
    for (let k = 0; k < a.length; k++) {
      const dx = c[k].x - a[k].x
      const dy = c[k].y - a[k].y
      expect(dx * a[k].tx + dy * a[k].ty).toBeGreaterThan(0)
    }
    // sens direct par défaut (trigonométrique) : à droite du puits, ça monte
    const droite = a.filter((l) => l.x > P.x + 0.5 * l.r)
    expect(droite.length).toBeGreaterThan(0)
    for (const l of droite) expect(l.ty).toBeGreaterThan(0)
    // sens horaire : la même lueur descend
    const h = lueursPuits({ ...P, sens: -1 }, 1.5)
    const droiteH = h.filter((l) => l.x > P.x + 0.5 * l.r)
    for (const l of droiteH) expect(l.ty).toBeLessThan(0)
  })

  it('l’aura s’arrête à la portée, sinon à 1,6 rayon ; sans halo visible, pas de lueur de halo', () => {
    expect(porteeVisible(P)).toBe(AURA_FACTEUR * 350)
    expect(porteeVisible({ ...P, portee: 400 })).toBe(400)
    expect(lueursPuits({ ...P, portee: 340 }, 0)).toHaveLength(LUEURS_COEUR)
    const halo = lueursPuits(P, 0).filter((l) => l.r > 350)
    expect(halo).toHaveLength(LUEURS_HALO)
    for (const l of halo) expect(l.alpha).toBeLessThan(0.4)
  })

  it('deux puits aux mêmes réglages n’ont pas les mêmes lueurs', () => {
    const a = lueursPuits(P, 0, 0)
    const b = lueursPuits(P, 0, 1)
    expect(a[0].x).not.toBe(b[0].x)
  })
})
