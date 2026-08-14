// La boucle à pas fixe : le contrat anti-domino. Après une image accrochée,
// le plafond de croisière interdit la rafale de rattrapage — le retard est
// abandonné, pas payé en pas supplémentaires (rapport v3 du Pixel : chaque
// accroc système se payait deux ou trois fois).

import { describe, expect, it } from 'vitest'
import { FixedLoop } from './loop'

const DT = 1 / 120

describe('FixedLoop — plafond de croisière (anti-domino)', () => {
  it('en croisière à 60 im/s, exactement 2 pas par image', () => {
    const loop = new FixedLoop()
    let pas = 0
    for (let i = 0; i < 10; i++) {
      pas = loop.advance(1 / 60, 1, DT, () => {}, Infinity, 2)
      expect(pas).toBe(2)
    }
  })

  it('après une image accrochée (25 ms), le plafond bloque la rafale et le retard est abandonné', () => {
    const loop = new FixedLoop()
    loop.advance(1 / 60, 1, DT, () => {}, Infinity, 2)
    // l'accroc : 25 ms d'un coup — 3 pas seraient dus, 2 seulement passent
    const pasAccroc = loop.advance(0.025, 1, DT, () => {}, Infinity, 2)
    expect(pasAccroc).toBe(2)
    // l'image suivante repart à zéro : 2 pas, pas 3 — le retard n'a pas
    // été reporté (il est abandonné, c'est le contrat)
    const pasSuivant = loop.advance(1 / 60, 1, DT, () => {}, Infinity, 2)
    expect(pasSuivant).toBe(2)
  })

  it('le time warp garde ses pas : plafond 12 à ×6, les 12 passent', () => {
    const loop = new FixedLoop()
    const pas = loop.advance(1 / 60, 6, DT, () => {}, Infinity, 12)
    expect(pas).toBe(12)
  })

  it('sans plafond fourni, le comportement historique demeure (rattrapage possible)', () => {
    const loop = new FixedLoop()
    const pas = loop.advance(0.025, 1, DT, () => {})
    expect(pas).toBe(3)
  })
})
