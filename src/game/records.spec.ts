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
  it('deux records par salle, indépendants : le volume et le chrono', () => {
    const r = new Records(memoryStorage())
    expect(r.tableauRecord('21-A')).toBeNull()
    // première collecte : les deux records naissent
    let n = r.noteCollection('21-A', 3.1, 80)
    expect(n).toMatchObject({ newVolume: true, newChrono: true })
    // plus rapide mais moins volumineuse : seul le CHRONO tombe
    n = r.noteCollection('21-A', 2.5, 40)
    expect(n).toMatchObject({ newVolume: false, newChrono: true })
    // plus volumineuse mais plus lente : seul le VOLUME tombe
    n = r.noteCollection('21-A', 3.4, 120)
    expect(n).toMatchObject({ newVolume: true, newChrono: false })
    const bests = r.tableauRecord('21-A')!
    expect(bests.volume).toMatchObject({ liters: 3.4, time: 120 })
    expect(bests.chrono).toMatchObject({ liters: 2.5, time: 40 })
  })

  it('à volume égal, le temps départage le record de volume (et inversement)', () => {
    const r = new Records(memoryStorage())
    r.noteCollection('21-B', 3.0, 90)
    expect(r.noteCollection('21-B', 3.0, 70).newVolume).toBe(true)
    expect(r.noteCollection('21-B', 3.0, 95).newVolume).toBe(false)
    expect(r.tableauRecord('21-B')!.volume).toMatchObject({
      liters: 3.0,
      time: 70,
    })
    expect(r.noteCollection('21-B', 3.6, 70).newChrono).toBe(true) // même chrono, plus de litres
    expect(r.tableauRecord('21-B')!.chrono).toMatchObject({
      liters: 3.6,
      time: 70,
    })
  })

  it('migration : un registre d’avant la refonte sème ses deux records', () => {
    const st = memoryStorage()
    st.setItem(
      'projet21.registres.v1',
      JSON.stringify({
        essais: 2,
        operator: 'REX',
        tableaux: { '21-A': { liters: 4.2, time: 66, essai: 1, name: 'REX' } },
        expedition: null,
        history: [],
      }),
    )
    const r = new Records(st)
    const bests = r.tableauRecord('21-A')!
    expect(bests.volume).toMatchObject({ liters: 4.2, time: 66, name: 'REX' })
    expect(bests.chrono).toMatchObject({ liters: 4.2, time: 66 })
  })

  it('la MÉMOIRE : gain, dépense, et migration des vieux registres', () => {
    const st = memoryStorage()
    const r = new Records(st)
    expect(r.memoire()).toBe(0)
    expect(r.gagneMemoire(12)).toBe(12)
    expect(r.gagneMemoire(0)).toBe(12) // un gain nul ne grave rien
    expect(r.depenseMemoire(5)).toBe(true)
    expect(r.depenseMemoire(50)).toBe(false) // solde insuffisant : refus
    expect(r.memoire()).toBe(7)
    // la persistance : une relecture retrouve le solde
    expect(new Records(st).memoire()).toBe(7)
    // migration : un registre d'AVANT l'Éveil (sans champ memoire) lit 0
    const ancien = memoryStorage()
    ancien.setItem(
      'projet21.registres.v1',
      JSON.stringify({
        essais: 1,
        operator: 'REX',
        tableaux: {},
        expedition: null,
        history: [],
      }),
    )
    expect(new Records(ancien).memoire()).toBe(0)
  })

  it('les FIOLES : collection persistante, deux logements, bascule', () => {
    const st = memoryStorage()
    const r = new Records(st)
    expect(r.fioles()).toEqual([])
    expect(r.ajouteFiole('aimant')).toBe(true)
    expect(r.ajouteFiole('aimant')).toBe(false) // jamais deux fois
    r.ajouteFiole('sonde')
    r.ajouteFiole('troc')
    // équiper : la bascule respecte les deux logements
    expect(r.basculeFiole('aimant', 2)).toBe(true)
    expect(r.basculeFiole('sonde', 2)).toBe(true)
    expect(r.basculeFiole('troc', 2)).toBe(false) // logements pleins
    expect(r.fiolesEquipees()).toEqual(['aimant', 'sonde'])
    expect(r.basculeFiole('aimant', 2)).toBe(false) // rangée
    expect(r.basculeFiole('troc', 2)).toBe(true) // la place s'est libérée
    expect(r.fioleEquipee('troc')).toBe(true)
    // une fiole non possédée ne s'équipe pas
    expect(r.basculeFiole('isolant', 2)).toBe(false)
    // persistance
    expect(new Records(st).fiolesEquipees()).toEqual(['sonde', 'troc'])
    // migration : registres d'avant les fioles
    const ancien = memoryStorage()
    ancien.setItem(
      'projet21.registres.v1',
      JSON.stringify({
        essais: 0,
        operator: '',
        tableaux: {},
        expedition: null,
        history: [],
        memoire: 4,
      }),
    )
    expect(new Records(ancien).fioles()).toEqual([])
  })

  it('réinitialiser le cycle (outil concepteur) : détisse et rembourse', () => {
    const r = new Records(memoryStorage())
    r.gagneMemoire(30)
    expect(r.acquiertEveil('solidification', 10)).toBe(true)
    expect(r.acquiertEveil('vaporisation', 15)).toBe(true)
    expect(r.memoire()).toBe(5)
    r.reinitialiseCycle(25)
    expect(r.eveilAcquis()).toEqual([])
    expect(r.memoire()).toBe(30) // la mémoire dépensée est revenue
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
    expect(b.tableauRecord('21-A')!.volume).toMatchObject({
      liters: 3.2,
      time: 55,
      essai: 1,
    })
    b.wipe()
    expect(new Records(storage).essaiNumber()).toBe(1)
  })

  it('le nom d’opérateur est estampillé sur les records et persiste', () => {
    const storage = memoryStorage()
    const r = new Records(storage)
    r.setOperator('  julien du 21  ')
    expect(r.operator()).toBe('JULIEN DU 21')
    r.noteCollection('21-A', 3.0, 60)
    expect(r.tableauRecord('21-A')!.volume).toMatchObject({
      name: 'JULIEN DU 21',
    })
    // un record battu porte le nom du nouvel opérateur
    r.setOperator('vega')
    r.noteCollection('21-A', 3.5, 60)
    expect(r.tableauRecord('21-A')!.volume).toMatchObject({ name: 'VEGA' })
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
    expect(new Records(storage).expedition()).toMatchObject({
      tableaux: 4,
      liters: 3.0,
    })
  })

  it('survit à un stockage absent ou corrompu', () => {
    const none = new Records(null)
    expect(none.noteCollection('21-A', 1, 1).newVolume).toBe(true)
    const storage = memoryStorage()
    storage.setItem('projet21.registres.v1', '{pas du json')
    expect(new Records(storage).essaiNumber()).toBe(1)
  })
})
