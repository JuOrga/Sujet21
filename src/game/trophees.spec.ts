// Le contrat des trophées : idempotence, persistance, compteurs cumulés.
import { describe, expect, it } from 'vitest'
import { TROPHEES, Trophees } from './trophees'

function stockage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

describe('Trophées', () => {
  it('débloque une fois, jamais deux — et prévient le rappel', () => {
    const s = stockage()
    const t = new Trophees(s)
    let fanfares = 0
    t.onDebloque = () => fanfares++
    expect(t.debloque('palet-parfait')).toBe(true)
    expect(t.debloque('palet-parfait')).toBe(false)
    expect(fanfares).toBe(1)
    expect(t.gagne('palet-parfait')).toBe(true)
    expect(t.nbGagnes()).toBe(1)
  })

  it('persiste entre deux sessions (même stockage)', () => {
    const s = stockage()
    new Trophees(s).debloque('recondense')
    const relu = new Trophees(s)
    expect(relu.gagne('recondense')).toBe(true)
    expect(relu.quand('recondense')).not.toBe('')
  })

  it('les compteurs cumulent — la 21e collecte fait l’opérateur de nuit', () => {
    const s = stockage()
    const t = new Trophees(s)
    for (let i = 0; i < 20; i++) t.compte('collectes')
    expect(t.compteur('collectes')).toBe(20)
    expect(t.compte('collectes')).toBe(21)
  })

  it('refuse un identifiant inconnu, et la liste est cohérente', () => {
    const t = new Trophees(stockage())
    expect(t.debloque('inconnu')).toBe(false)
    expect(new Set(TROPHEES.map((x) => x.id)).size).toBe(TROPHEES.length)
  })
})
