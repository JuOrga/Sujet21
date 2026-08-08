import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import {
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
