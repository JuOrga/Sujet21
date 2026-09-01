// LE PLAFOND DE LA BIBLIOTHÈQUE PARTAGÉE : un POIDS, plus un nombre.
//
// Le défaut vécu : le serveur refusait la 61e entrée (« bibliothèque
// pleine »), alors que soixante tableaux ne pèsent qu'une petite centaine de
// kilo-octets — le plafond arrivait mille fois avant la moindre gêne réelle,
// et il arrivait en plein travail. Ces tests tiennent les deux bouts : que
// soixante entrées passent, et qu'un document vraiment lourd soit refusé.

import { describe, expect, it } from 'vitest'
import { BUDGET_OCTETS, poidsDocument, refusDeBudget } from '../../api/_budget'
import { TABLEAUX } from './level'
import { serializeLevel } from './levelIO'

/** Une bibliothèque de n entrées faite de VRAIS tableaux du jeu — le poids
 *  d'un tableau inventé ne prouverait rien. */
function bibliotheque(n: number): { levels: unknown[] } {
  const levels = []
  for (let i = 0; i < n; i++) {
    const lv = TABLEAUX[i % TABLEAUX.length]
    levels.push({
      id: `tableau-${i}`,
      auteur: 'JU',
      majAt: '2026-09-01T12:00:00.000Z',
      codeAuteur: 'JU',
      codeAt: '2026-09-01T12:00:00.000Z',
      level: JSON.parse(serializeLevel(lv)),
    })
  }
  return { levels }
}

describe('le budget de la bibliothèque — le poids, pas le nombre', () => {
  it('la 61e entrée — celle que le serveur refusait — passe, et de très loin', () => {
    const lib = bibliotheque(61)
    expect(lib.levels.length).toBeGreaterThan(60) // l’ancien plafond, en dur
    expect(refusDeBudget(lib)).toBeNull()
    // la mesure qui justifie la levée du plafond : moins d’un dixième du budget
    expect(poidsDocument(lib)).toBeLessThan(BUDGET_OCTETS / 10)
  })

  it('le millier tient encore : le plafond n’est plus celui qu’on rencontre', () => {
    expect(refusDeBudget(bibliotheque(1000))).toBeNull()
  })

  it('un document vraiment trop lourd est refusé, et il dit son poids', () => {
    const refus = refusDeBudget({ levels: ['x'.repeat(BUDGET_OCTETS + 1)] })
    expect(refus).toContain('plafond de poids')
    expect(refus).toMatch(/\d+ Ko pour \d+ Ko/)
  })

  it('le budget se règle, et la limite est stricte au dernier octet', () => {
    const corps = { a: 'x' }
    const poids = poidsDocument(corps) // {"a":"x"} = 9 octets
    expect(refusDeBudget(corps, poids)).toBeNull()
    expect(refusDeBudget(corps, poids - 1)).not.toBeNull()
  })

  it('le poids est celui des OCTETS, pas celui des caractères — les accents comptent double', () => {
    // la prose du dépôt est française : compter en caractères sous-estimerait
    expect(poidsDocument('éèê')).toBeGreaterThan(JSON.stringify('éèê').length)
  })
})
