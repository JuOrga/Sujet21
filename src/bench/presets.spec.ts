import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { BUILTIN_PRESETS, copyParams, mergePresets } from './presets'

// Les présets livrés sont du CONTENU : une faute de frappe dans une clé, une
// valeur qui fait diverger le solveur, et c'est le banc entier qui trahit.
// Chaque livré passe donc au tourment : clés connues, puis une vraie séance
// de jeu condensée — tirs, gel, vapeur, dash — sans une seule valeur folle.

describe('Présets livrés — sept manières de sentir le même fluide', () => {
  it('chaque clé existe dans les paramètres (pas de curseur fantôme)', () => {
    for (const p of BUILTIN_PRESETS) {
      for (const [k, v] of Object.entries(p.params)) {
        expect(k in DEFAULT_PARAMS, `${p.title} : clé inconnue « ${k} »`).toBe(true)
        expect(typeof v, `${p.title} : ${k} n'est pas un nombre`).toBe('number')
        expect(Number.isFinite(v), `${p.title} : ${k} n'est pas fini`).toBe(true)
      }
      expect(p.title.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(40) // une intention, pas un borborygme
      expect(p.savedAt).toBe('') // le livré doit PERDRE la fusion face au préset d'un testeur
    }
  })

  it('chaque préset survit à une séance condensée sans valeur folle', () => {
    for (const preset of BUILTIN_PRESETS) {
      const p = { ...DEFAULT_PARAMS }
      copyParams(preset.params, p)
      const sim = new FluidSim(p, { minX: -1200, minY: -700, maxX: 1200, maxY: 700 })
      sim.setLevel([{ minX: 600, minY: -700, maxX: 660, maxY: 700, material: 0 }], [])
      sim.spawnDisc(0, 0, 90, KIND_PLAYER)
      // 1 s de tirs vers le mur, puis bascule vapeur + dash, puis retour
      for (let s = 0; s < Math.round(1 / p.dt); s++) {
        sim.eject(500, 0, p.dt)
        sim.step(p.dt)
      }
      sim.gasIntent = true
      for (let s = 0; s < Math.round(1 / p.dt); s++) sim.step(p.dt)
      sim.dashBudget = 3
      sim.gasDash(600, 0)
      sim.gasIntent = false
      for (let s = 0; s < Math.round(1 / p.dt); s++) sim.step(p.dt)
      for (let i = 0; i < sim.count; i++) {
        expect(Number.isFinite(sim.posX[i]), `${preset.title} : position folle`).toBe(true)
        expect(Number.isFinite(sim.velX[i]), `${preset.title} : vitesse folle`).toBe(true)
      }
      expect(sim.count, `${preset.title} : la cuve s'est vidée`).toBeGreaterThan(20)
    }
  })

  it('un préset de testeur au même titre gagne la fusion contre le livré', () => {
    const mien = {
      title: BUILTIN_PRESETS[0].title,
      description: 'ma version',
      savedAt: '2026-08-16T12:00:00Z',
      params: { ejectSpeed: 1234 },
    }
    const fusion = mergePresets(BUILTIN_PRESETS, [mien])
    const gagnant = fusion.find((q) => q.title === mien.title)
    expect(gagnant?.params.ejectSpeed).toBe(1234)
  })
})
