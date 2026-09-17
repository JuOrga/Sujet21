import { describe, expect, it } from 'vitest'
import type { PuitsDef } from './level'
import { AURA_FACTEUR, GRAINS_COEUR, GRAINS_HALO, dureeChuteCoeur, grainsPuits, porteeVisible, rayonNoyau } from './puitsDessin'

const P: PuitsDef = { x: 100, y: -50, force: 600, rayon: 350 }

describe('la chute d’un puits — un décor qui dit vrai', () => {
  it('les mêmes grains à chaque image ; chacun tombe droit vers le centre, sa traîne derrière lui ; jamais hors de l’aura', () => {
    const a = grainsPuits(P, 2)
    expect(a).toEqual(grainsPuits(P, 2))
    expect(a.length).toBeGreaterThan(0)
    expect(a.length).toBeLessThanOrEqual(GRAINS_COEUR + GRAINS_HALO)
    const b = grainsPuits(P, 2.02)
    for (const gr of a) {
      expect(gr.r).toBeLessThanOrEqual(porteeVisible(P) + 1e-6)
      expect(gr.r).toBeGreaterThanOrEqual(rayonNoyau(P) - 1e-6)
      // la direction pointe vers le centre
      expect(gr.tx * (P.x - gr.x) + gr.ty * (P.y - gr.y)).toBeCloseTo(gr.r, 6)
      expect(gr.vitesse).toBeGreaterThanOrEqual(0)
    }
    // un pas plus tard, un grain encore en chute est plus près du centre
    for (const gr of a) {
      const apres = b.find((q) => Math.abs(Math.atan2(q.y - P.y, q.x - P.x) - Math.atan2(gr.y - P.y, gr.x - P.x)) < 1e-9)
      if (apres) expect(apres.r).toBeLessThanOrEqual(gr.r + 1e-9)
    }
  })

  it('le cœur est isochrone : lâchés ensemble de distances différentes, les grains du cœur arrivent ensemble, en T/4', () => {
    const T4 = dureeChuteCoeur(P)
    expect(T4).toBeCloseTo((Math.PI / 2) * Math.sqrt(350 / 600), 6)
    // à 80 % de T/4 : tous les grains du cœur tombent encore, tous près du
    // noyau (moins de 0,3 rayon) — d'où qu'ils soient partis ; juste après
    // T/4, plus aucun : tous arrivés, la pause
    const coeur = (t: number) => grainsPuits(P, t).filter((g) => g.origine === 'coeur')
    const avant = coeur(T4 * 0.8)
    expect(avant.length).toBe(GRAINS_COEUR)
    for (const gr of avant) expect(gr.r).toBeLessThan(0.3 * 350)
    expect(coeur(T4 * 1.05)).toHaveLength(0)
    // juste après le lâcher : tous loin du noyau, étalés entre 0,35 et 0,92 rayon
    const rayons = coeur(0.02).map((g) => g.r)
    expect(Math.min(...rayons)).toBeGreaterThan(0.3 * 350)
    expect(Math.max(...rayons)).toBeLessThan(0.95 * 350)
    expect(Math.max(...rayons) - Math.min(...rayons)).toBeGreaterThan(0.3 * 350)
  })

  it('l’aura s’arrête à la portée, sinon à 1,6 rayon ; le noyau dit la force, borné par le cœur', () => {
    expect(porteeVisible(P)).toBe(AURA_FACTEUR * 350)
    expect(porteeVisible({ ...P, portee: 400 })).toBe(400)
    expect(rayonNoyau({ x: 0, y: 0, force: 540 })).toBeCloseTo(26, 6)
    expect(rayonNoyau({ x: 0, y: 0, force: 2160 })).toBeCloseTo(40, 6)
    expect(rayonNoyau({ x: 0, y: 0, force: 2160, rayon: 60 })).toBe(18)
  })

  it('deux puits aux mêmes réglages n’ont pas les mêmes grains', () => {
    const a = grainsPuits(P, 0.5, 0)
    const b = grainsPuits(P, 0.5, 1)
    expect(a.map((g) => g.x)).not.toEqual(b.map((g) => g.x))
  })
})
