import { describe, expect, it } from 'vitest'
import { Records, type StorageLike } from './records'

function memoryStorage(): StorageLike {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

describe('Records — les registres du labo', () => {
  it('consigne les collectes et retient le record par tableau', () => {
    const r = new Records(memoryStorage())
    expect(r.tableauRecord('21-A')).toBeNull()
    expect(r.noteCollection('21-A', 3.1, 80).newRecord).toBe(true)
    expect(r.noteCollection('21-A', 2.5, 40).newRecord).toBe(false)
    expect(r.noteCollection('21-A', 3.4, 120).newRecord).toBe(true)
    expect(r.tableauRecord('21-A')).toMatchObject({ liters: 3.4, time: 120 })
  })

  it('à volume égal, le temps le plus court départage', () => {
    const r = new Records(memoryStorage())
    r.noteCollection('21-B', 3.0, 90)
    expect(r.noteCollection('21-B', 3.0, 70).newRecord).toBe(true)
    expect(r.noteCollection('21-B', 3.0, 95).newRecord).toBe(false)
    expect(r.tableauRecord('21-B')).toMatchObject({ liters: 3.0, time: 70 })
  })

  it('la dispersion clôt l’essai : le n° d’échantillon avance', () => {
    const r = new Records(memoryStorage())
    expect(r.essaiNumber()).toBe(1)
    r.noteCollection('21-A', 3.0, 60) // collecter ne change pas d'échantillon
    expect(r.essaiNumber()).toBe(1)
    r.noteDispersion('21-B', 30)
    expect(r.essaiNumber()).toBe(2)
    expect(r.lastEntries(10).map((e) => e.won)).toEqual([true, false])
  })

  it('persiste dans le stockage et repart à vide après effacement', () => {
    const storage = memoryStorage()
    const a = new Records(storage)
    a.noteCollection('21-A', 3.2, 55)
    a.noteDispersion('21-A', 10)
    const b = new Records(storage)
    expect(b.essaiNumber()).toBe(2)
    expect(b.tableauRecord('21-A')).toMatchObject({ liters: 3.2, time: 55, essai: 1 })
    b.wipe()
    expect(new Records(storage).essaiNumber()).toBe(1)
  })

  it('le nom d’opérateur est estampillé sur les records et persiste', () => {
    const storage = memoryStorage()
    const r = new Records(storage)
    r.setOperator('  julien du 21  ')
    expect(r.operator()).toBe('JULIEN DU 21')
    r.noteCollection('21-A', 3.0, 60)
    expect(r.tableauRecord('21-A')).toMatchObject({ name: 'JULIEN DU 21' })
    // un record battu porte le nom du nouvel opérateur
    r.setOperator('vega')
    r.noteCollection('21-A', 3.5, 60)
    expect(r.tableauRecord('21-A')).toMatchObject({ name: 'VEGA' })
    expect(new Records(storage).operator()).toBe('VEGA')
  })

  it('la meilleure expédition : distance, puis réserve, puis temps', () => {
    const storage = memoryStorage()
    const r = new Records(storage)
    expect(r.expedition()).toBeNull()
    expect(r.noteExpedition(0, 0, 30).newRecord).toBe(false) // rien à consigner
    expect(r.noteExpedition(2, 4.1, 300).newRecord).toBe(true)
    expect(r.noteExpedition(1, 9.9, 100).newRecord).toBe(false) // moins loin : non
    expect(r.noteExpedition(2, 4.5, 400).newRecord).toBe(true) // aussi loin, plus riche
    expect(r.noteExpedition(4, 3.0, 700).newRecord).toBe(true) // plus loin : oui
    expect(new Records(storage).expedition()).toMatchObject({ tableaux: 4, liters: 3.0 })
  })

  it('survit à un stockage absent ou corrompu', () => {
    const none = new Records(null)
    expect(none.noteCollection('21-A', 1, 1).newRecord).toBe(true)
    const storage = memoryStorage()
    storage.setItem('projet21.registres.v1', '{pas du json')
    expect(new Records(storage).essaiNumber()).toBe(1)
  })
})
