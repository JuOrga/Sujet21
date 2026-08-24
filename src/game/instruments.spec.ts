import { describe, expect, it } from 'vitest'
import { INSTRUMENTS, PRIX_CARTE, tirageInstruments } from './instruments'

// Générateur déterministe (LCG) : le tirage se rejoue à l'identique
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe('Instruments — le tirage de fin de salle', () => {
  it('propose au plus 3 cartes distinctes, tirées du bon bassin', () => {
    const cartes = tirageInstruments(lcg(7), [], 1, 3)
    expect(cartes.length).toBe(3)
    const ids = cartes.map((c) => c.id)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(INSTRUMENTS.some((d) => d.id === id)).toBe(true)
  })

  it('un instrument déjà emporté ne revient pas — sauf l’échantillon de secours', () => {
    for (let seed = 1; seed < 40; seed++) {
      const tenus = ['gaine-isolante', 'buse-calibree', 'aimant-rosee', 'chambre-froide']
      const cartes = tirageInstruments(lcg(seed), tenus, 1, 3)
      // il ne reste que l'échantillon de secours au bassin
      expect(cartes.map((c) => c.id)).toEqual(['echantillon-secours'])
    }
  })

  it('l’échantillon de secours ne paraît que si une vie manque', () => {
    for (let seed = 1; seed < 40; seed++) {
      const pleines = tirageInstruments(lcg(seed), [], 3, 3)
      expect(pleines.some((c) => c.id === 'echantillon-secours')).toBe(false)
    }
  })

  it('au moins une carte reste offerte, et les prix sont au tarif unique', () => {
    for (let seed = 1; seed < 200; seed++) {
      const cartes = tirageInstruments(lcg(seed), [], 1, 3)
      expect(cartes.some((c) => c.prix === 0)).toBe(true)
      for (const c of cartes) expect([0, PRIX_CARTE]).toContain(c.prix)
    }
  })

  it('des cartes payantes existent bel et bien (sur l’ensemble des graines)', () => {
    let payantes = 0
    for (let seed = 1; seed < 200; seed++) {
      payantes += tirageInstruments(lcg(seed), [], 1, 3).filter((c) => c.prix > 0).length
    }
    expect(payantes).toBeGreaterThan(50)
  })
})
