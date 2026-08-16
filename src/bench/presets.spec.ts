import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import {
  BUILTIN_PRESETS,
  copyParams,
  mergePresets,
  parsePresetFile,
  parseSharedPayload,
  removePreset,
  serializePreset,
  upsertPreset,
  type Preset,
} from './presets'

function makePreset(title: string, params: Partial<SimParams> = {}): Preset {
  return { title, description: `desc ${title}`, savedAt: '2026-08-08T00:00:00Z', params }
}

describe('présets du banc', () => {
  it('sérialise puis relit un préset avec titre et description', () => {
    const preset = makePreset('cohésion forte', { sCorrK: 0.2, vortexPull: 500 })
    const back = parsePresetFile(serializePreset(preset))
    expect(back).toEqual(preset)
  })

  it('relit l’ancien format d’export (paramètres à plat, sans titre)', () => {
    const legacy = JSON.stringify({ ...DEFAULT_PARAMS, sCorrK: 0.33 })
    const back = parsePresetFile(legacy)
    expect(back.title).toBe('')
    expect(back.params.sCorrK).toBe(0.33)
  })

  it('n’applique que les paramètres numériques connus', () => {
    const into: SimParams = { ...DEFAULT_PARAMS }
    copyParams({ sCorrK: 0.4, inconnu: 99, ejectRate: NaN } as Partial<SimParams>, into)
    expect(into.sCorrK).toBe(0.4)
    expect(into.ejectRate).toBe(DEFAULT_PARAMS.ejectRate)
    expect('inconnu' in into).toBe(false)
  })

  it('enregistrer sous un titre existant remplace, sinon crée (trié par titre)', () => {
    let list = upsertPreset([], makePreset('b'))
    list = upsertPreset(list, makePreset('a'))
    expect(list.map((p) => p.title)).toEqual(['a', 'b'])
    list = upsertPreset(list, makePreset('b', { sCorrK: 0.5 }))
    expect(list).toHaveLength(2)
    expect(list.find((p) => p.title === 'b')?.params.sCorrK).toBe(0.5)
  })

  it('fusionne local et partagé : un préset par titre, le plus récent gagne', () => {
    const local = [
      { ...makePreset('a', { sCorrK: 0.1 }), savedAt: '2026-08-08T10:00:00Z' },
      makePreset('mien'),
    ]
    const shared = [
      { ...makePreset('a', { sCorrK: 0.9 }), savedAt: '2026-08-08T12:00:00Z' },
      makePreset('ami'),
    ]
    const merged = mergePresets(local, shared)
    expect(merged.map((p) => p.title)).toEqual(['a', 'ami', 'mien'])
    expect(merged.find((p) => p.title === 'a')?.params.sCorrK).toBe(0.9)
  })

  it('supprime par titre', () => {
    const list = upsertPreset(upsertPreset([], makePreset('a')), makePreset('b'))
    expect(removePreset(list, 'a').map((p) => p.title)).toEqual(['b'])
  })

  it('relit la bibliothèque partagée : nouveau format avec préset par défaut', () => {
    const lib = parseSharedPayload({ presets: [makePreset('a')], defaultTitle: 'a' })
    expect(lib.presets.map((p) => p.title)).toEqual(['a'])
    expect(lib.defaultTitle).toBe('a')
  })

  it('relit l’ancien format de bibliothèque (tableau nu, sans défaut)', () => {
    const lib = parseSharedPayload([makePreset('a'), makePreset('b')])
    expect(lib.presets).toHaveLength(2)
    expect(lib.defaultTitle).toBeNull()
  })

  it('bibliothèque illisible ou défaut vide : retombe proprement', () => {
    expect(parseSharedPayload('n’importe quoi')).toEqual({ presets: [], defaultTitle: null })
    expect(parseSharedPayload({ presets: [], defaultTitle: '' }).defaultTitle).toBeNull()
    expect(parseSharedPayload({ presets: [makePreset('a')], defaultTitle: 42 }).defaultTitle).toBeNull()
  })
})

// Les présets LIVRÉS sont du CONTENU : une faute de frappe dans une clé, une
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
