import { describe, expect, it } from 'vitest'
import {
  BONBONNE_CAP,
  INSTRUMENTS,
  PALIERS_XP,
  PRIX_CARTE,
  paliersAtteints,
  prochainPalier,
  tirageInstruments,
} from './instruments'

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

  it('un instrument déjà emporté ne revient pas — sauf les cartes de secours', () => {
    // TOUT le catalogue est en poche, sauf les cartes qui donnent une VIE
    // (celles-là ne s'emportent pas, elles se consomment) : il ne peut
    // donc rester qu'elles. Écrit ainsi, le test dit la RÈGLE et survit à
    // l'ajout de nouvelles cartes.
    const secours = INSTRUMENTS.filter((d) =>
      d.effets.some((e) => e.levier === 'vies'),
    ).map((d) => d.id)
    const tenus = INSTRUMENTS.map((d) => d.id).filter(
      (id) => !secours.includes(id),
    )
    expect(secours.length).toBeGreaterThan(0)
    for (let seed = 1; seed < 40; seed++) {
      const cartes = tirageInstruments(lcg(seed), tenus, 1, 3)
      expect(cartes.length).toBeGreaterThan(0)
      for (const c of cartes) expect(secours).toContain(c.id)
    }
  })

  it('le catalogue ne contient ni deux fois le même identifiant, ni deux fois la même icône', () => {
    // la carte se reconnaît à son glyphe dans le HUD des instruments : deux
    // cartes de même icône seraient indiscernables une fois embarquées
    const ids = INSTRUMENTS.map((d) => d.id)
    const icones = INSTRUMENTS.map((d) => d.icone)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(icones).size).toBe(icones.length)
    for (const d of INSTRUMENTS) {
      expect(d.nom.length).toBeGreaterThan(2)
      expect(d.desc.length).toBeGreaterThan(10)
    }
  })

  it('le CARNET DU SEMBLABLE ouvre une quatrième carte', () => {
    for (let seed = 1; seed < 40; seed++) {
      expect(tirageInstruments(lcg(seed), [], 1, 3, 4)).toHaveLength(4)
      expect(tirageInstruments(lcg(seed), [], 1, 3)).toHaveLength(3)
      // et les cartes restent distinctes
      const ids = tirageInstruments(lcg(seed), [], 1, 3, 4).map((c) => c.id)
      expect(new Set(ids).size).toBe(4)
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

describe('Bonbonne et XP d’étalonnage', () => {
  it('les paliers se comptent et s’annoncent', () => {
    expect(paliersAtteints(0)).toBe(0)
    expect(paliersAtteints(3)).toBe(1)
    expect(paliersAtteints(9.9)).toBe(2)
    expect(paliersAtteints(10)).toBe(3)
    expect(prochainPalier(0)).toBe(3)
    expect(prochainPalier(3)).toBe(6)
    expect(prochainPalier(PALIERS_XP[PALIERS_XP.length - 1])).toBe(null)
  })
  it('la capacité de la bonbonne est bien posée', () => {
    expect(BONBONNE_CAP).toBeGreaterThan(0)
  })
})
