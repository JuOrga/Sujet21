import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import { amorcePresets, type EntreesSortiesPresets } from './amorcePresets'
import type { Preset, SharedLibrary } from './presets'

function preset(title: string, params: Partial<SimParams>): Preset {
  return { title, description: '', savedAt: '2026-09-01T00:00:00Z', params }
}

function io(
  sur: Partial<EntreesSortiesPresets> & { partage?: SharedLibrary | Error },
): EntreesSortiesPresets & { ranges: Preset[][]; defauts: (string | null)[] } {
  const ranges: Preset[][] = []
  const defauts: (string | null)[] = []
  return {
    ranges,
    defauts,
    presetsLocaux: sur.presetsLocaux ?? (() => []),
    defautLocal: sur.defautLocal ?? (() => null),
    chargePartage:
      sur.chargePartage ??
      (() =>
        sur.partage instanceof Error
          ? Promise.reject(sur.partage)
          : Promise.resolve(sur.partage ?? { presets: [], defaultTitle: null })),
    rangePresets: (l) => ranges.push(l),
    rangeDefaut: (t) => defauts.push(t),
  }
}

describe('l’amorce des présets (le banc différé)', () => {
  it('applique tout de suite le défaut du cache local', async () => {
    const params: SimParams = { ...DEFAULT_PARAMS }
    const es = io({
      presetsLocaux: () => [preset('maison', { sCorrK: 0.42 })],
      defautLocal: () => 'maison',
    })
    const a = amorcePresets(params, es)
    expect(a.local?.title).toBe('maison')
    expect(params.sCorrK).toBe(0.42)
    expect(await a.partage).toBeNull()
  })

  it('laisse la bibliothèque partagée corriger le défaut, et le mémorise', async () => {
    const params: SimParams = { ...DEFAULT_PARAMS }
    const es = io({
      presetsLocaux: () => [preset('maison', { sCorrK: 0.42 })],
      defautLocal: () => 'maison',
      partage: { presets: [preset('labo', { sCorrK: 0.77 })], defaultTitle: 'labo' },
    })
    const a = amorcePresets(params, es)
    expect(params.sCorrK).toBe(0.42)
    const def = await a.partage
    expect(def?.title).toBe('labo')
    expect(params.sCorrK).toBe(0.77)
    expect(es.defauts).toEqual(['labo'])
    expect(es.ranges.at(-1)?.map((p) => p.title)).toContain('labo')
  })

  it('ne réapplique rien quand le défaut partagé est déjà celui du cache', async () => {
    const params: SimParams = { ...DEFAULT_PARAMS }
    const es = io({
      presetsLocaux: () => [preset('maison', { sCorrK: 0.42 })],
      defautLocal: () => 'maison',
      partage: { presets: [preset('maison', { sCorrK: 0.42 })], defaultTitle: 'maison' },
    })
    const a = amorcePresets(params, es)
    params.sCorrK = 0.5 // un réglage fait entre-temps ne doit pas être écrasé
    expect(await a.partage).toBeNull()
    expect(params.sCorrK).toBe(0.5)
  })

  it('sans backend, garde le cache local sans bruit', async () => {
    const params: SimParams = { ...DEFAULT_PARAMS }
    const es = io({ partage: new Error('réseau') })
    const a = amorcePresets(params, es)
    expect(a.local).toBeNull()
    expect(await a.partage).toBeNull()
    expect(es.defauts).toEqual([])
  })
})
