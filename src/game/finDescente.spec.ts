import { describe, expect, it } from 'vitest'
import { releveDescente } from './finDescente'

// LE RELEVÉ DE LA DESCENTE : ce que la scène de fin (bouclée, perdue,
// reprise) écrit en chiffres. Les attendus sont ceux que fmtL et fmtDuree
// rendaient dans main.ts avant leur déménagement (lancés une fois le 13/11,
// recopiés en dur) : le relevé ne doit pas changer l'écriture d'un litre ni
// d'une durée.
describe('le relevé de la descente', () => {
  const bouclee = {
    salles: 18,
    total: 18,
    livreL: 31.4,
    dureeS: 3720,
    instruments: 6,
    memoireGagnee: 240,
    palier: 4,
  }

  it('écrit une descente bouclée comme le reste du jeu l’écrit', () => {
    const r = releveDescente(bouclee)
    expect(r.salles).toBe('18/18')
    expect(r.litres).toBe('31,40 L')
    expect(r.duree).toBe('62:00')
    expect(r.instruments).toBe(6)
    expect(r.memoire).toBe('+240')
    expect(r.palier).toBe(4)
  })

  it('écrit une descente sans salle livrée comme fmtL(0)', () => {
    const r = releveDescente({ salles: 0, total: 18, livreL: 0, dureeS: 0, instruments: 0, memoireGagnee: 0, palier: 0 })
    expect(r.litres).toBe('0,00 L')
    expect(r.salles).toBe('0/18')
    expect(r.duree).toBe('0,0 s')
    expect(r.memoire).toBe('+0')
  })

  it('n’écrit jamais NaN, même d’une sauvegarde abîmée', () => {
    const r = releveDescente({
      salles: NaN,
      total: Infinity,
      livreL: NaN,
      dureeS: -Infinity,
      instruments: NaN,
      memoireGagnee: NaN,
      palier: NaN,
    })
    for (const [champ, v] of Object.entries(r)) {
      expect(String(v), champ).not.toMatch(/NaN|Infinity/)
      if (typeof v === 'number') expect(Number.isFinite(v), champ).toBe(true)
    }
  })

  it('ne compte jamais plus de salles franchies que la descente n’en a', () => {
    // la longueur se recalcule sur la carte : elle ne descend pas sous la
    // profondeur atteinte, mais un relevé ne doit pas dire « 19/18 »
    expect(releveDescente({ ...bouclee, salles: 19 }).salles).toBe('19/19')
  })
})
