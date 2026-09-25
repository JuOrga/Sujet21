import { describe, expect, it } from 'vitest'
import { passeNetteRequise } from './renderer'

// La toile repassée en NATIF coûte, au réglage « faible », quatre fois ses
// pixels : elle ne doit arriver que si le joueur l'a demandée.
describe('la passe nette', () => {
  it('ne se déclenche jamais d’elle-même en résolution réduite', () => {
    expect(passeNetteRequise(2, 1, false)).toBe(false) // faible, DPR 2
    expect(passeNetteRequise(2, 1.5, false)).toBe(false) // moyenne
  })

  it('suit le décor net demandé, en résolution réduite seulement', () => {
    expect(passeNetteRequise(2, 1, true)).toBe(true)
    expect(passeNetteRequise(2, 2, true)).toBe(false) // déjà natif
  })
})
