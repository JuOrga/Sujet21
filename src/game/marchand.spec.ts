import { describe, expect, it } from 'vitest'
import { TRANSFOS_CYCLE } from './cycle'
import { AMELIORATIONS, amelioration, orbesEnVente, prixOrbe } from './marchand'
import { Records, type StorageLike } from './records'

function memoryStorage(): StorageLike {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

describe('le marchand du hub — le catalogue', () => {
  it('le prix d’un orbe est celui de sa transformation ; le mystère et les états ne sont pas en vente', () => {
    expect(prixOrbe('solidification')).toBe(10)
    expect(prixOrbe('sublimation')).toBe(60)
    expect(prixOrbe('ionisation')).toBeNull()
    expect(prixOrbe('solide')).toBeNull()
    expect(prixOrbe('inconnu')).toBeNull()
  })

  it('l’étal des orbes suit l’ordre du cycle, sans les mystères', () => {
    const etal = orbesEnVente()
    expect(etal.map((o) => o.id)).toEqual(
      TRANSFOS_CYCLE.filter((t) => t.etat !== 'mystere').map((t) => t.id),
    )
    for (const o of etal) expect(o.prix).toBeGreaterThan(0)
  })

  it('les améliorations ont un id unique et un prix', () => {
    const ids = new Set(AMELIORATIONS.map((a) => a.id))
    expect(ids.size).toBe(AMELIORATIONS.length)
    expect(amelioration('reserve')?.prix).toBe(12)
    expect(amelioration('x')).toBeNull()
  })
})

describe('les orbes dans les registres', () => {
  it('s’achètent contre de la mémoire, une fois, et se dépensent au tissage', () => {
    const r = new Records(memoryStorage())
    r.gagneMemoire(25)
    expect(r.acheteOrbe('solidification', 10)).toBe(true)
    expect(r.memoire()).toBe(15)
    expect(r.aOrbe('solidification')).toBe(true)
    // déjà en poche : refusé, rien de débité
    expect(r.acheteOrbe('solidification', 10)).toBe(false)
    expect(r.memoire()).toBe(15)
    // trop cher
    expect(r.acheteOrbe('sublimation', 60)).toBe(false)
    // le tissage consomme l’orbe et grave le lien
    expect(r.tisseAvecOrbe('solidification')).toBe(true)
    expect(r.aOrbe('solidification')).toBe(false)
    expect(r.eveilTient('solidification')).toBe(true)
    // pas d’orbe, pas de tissage ; un lien tissé ne se rachète pas
    expect(r.tisseAvecOrbe('vaporisation')).toBe(false)
    expect(r.acheteOrbe('solidification', 10)).toBe(false)
    expect(r.gagneOrbe('solidification')).toBe(false)
  })

  it('les registres survivent au rechargement, orbes compris', () => {
    const st = memoryStorage()
    const r = new Records(st)
    r.gagneOrbe('gaz')
    r.acheteAmelioration('reserve', 0)
    const r2 = new Records(st)
    expect(r2.orbes()).toEqual(['gaz'])
    expect(r2.aAmelioration('reserve')).toBe(true)
  })

  it('une cache ne se pille qu’une fois, et donne son orbe', () => {
    const r = new Records(memoryStorage())
    expect(r.videCache('S1b', 'sublimation')).toBe(true)
    expect(r.aOrbe('sublimation')).toBe(true)
    expect(r.cacheVidee('S1b')).toBe(true)
    expect(r.videCache('S1b', 'sublimation')).toBe(false)
    // une seconde cache portant un orbe déjà en poche se vide sans doublon
    expect(r.videCache('S3b', 'sublimation')).toBe(true)
    expect(r.orbes()).toEqual(['sublimation'])
  })

  it('la réinitialisation du cycle rend les orbes, pas la mémoire', () => {
    const r = new Records(memoryStorage())
    r.gagneMemoire(10)
    r.acheteOrbe('solidification', 10)
    r.tisseAvecOrbe('solidification')
    r.reinitialiseCycle()
    expect(r.eveilAcquis()).toEqual([])
    expect(r.orbes()).toEqual(['solidification'])
    expect(r.memoire()).toBe(0)
  })

  it('une amélioration durable s’achète une fois', () => {
    const r = new Records(memoryStorage())
    r.gagneMemoire(30)
    expect(r.acheteAmelioration('souffle', 20)).toBe(true)
    expect(r.acheteAmelioration('souffle', 20)).toBe(false)
    expect(r.acheteAmelioration('reserve', 12)).toBe(false) // 10 restants
    expect(r.ameliorations()).toEqual(['souffle'])
  })
})
