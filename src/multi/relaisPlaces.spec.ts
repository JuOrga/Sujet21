import { describe, expect, it } from 'vitest'
import { DEBIT_MAX, GRACE_MS, JETON, PATIENCE_DEBIT, admet, adresseDe, debit, occupe, quitte, salonNeuf } from '../../relais/places.js'
import { jetonNeuf } from './relais'

// LES RÈGLES DU RELAIS QUI PROTÈGENT LES JOUEURS (relais/places.js). Le
// serveur entier s'essaie en local (relais/essai-places.mjs) et en ligne
// (le workflow relais) ; ses règles, elles, se tiennent ici, avec le jeu.

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)

describe('relais — une place ne se prend plus avec le seul code', () => {
  it('une place libre se prend avec n’importe quel jeton', () => {
    const s = salonNeuf()
    expect(admet(s, 'invite', A, 0)).toBe(true)
  })

  it('une place tenue ne se donne qu’au même jeton : celui qui revient la reprend, un intrus est refusé', () => {
    const s = salonNeuf()
    occupe(s, 'hote', 'connexion-1', A)
    expect(admet(s, 'hote', A, 1000)).toBe(true)
    expect(admet(s, 'hote', B, 1000)).toBe(false)
    // et un client d'avant les jetons (jeton vide) ne la prend pas non plus
    expect(admet(s, 'hote', '', 1000)).toBe(false)
  })

  it('une place à peine quittée reste à son jeton GRACE_MS (le temps de revenir d’une coupure), puis se libère', () => {
    const s = salonNeuf()
    occupe(s, 'invite', 'connexion-1', A)
    quitte(s, 'invite', 10_000)
    expect(admet(s, 'invite', B, 10_000 + GRACE_MS - 1)).toBe(false)
    expect(admet(s, 'invite', A, 10_000 + GRACE_MS - 1)).toBe(true)
    // l'ami parti pour de bon peut être remplacé
    expect(admet(s, 'invite', B, 10_000 + GRACE_MS)).toBe(true)
  })

  it('deux clients d’avant les jetons gardent l’ancienne règle entre eux', () => {
    const s = salonNeuf()
    occupe(s, 'invite', 'connexion-1', '')
    expect(admet(s, 'invite', '', 5)).toBe(true)
  })

  it('le jeton que tire le jeu a le format que le relais attend, et change à chaque fois', () => {
    const j = jetonNeuf()
    expect(j).toMatch(/^[0-9a-f]{32}$/)
    expect(JETON.test(j)).toBe(true)
    expect(jetonNeuf()).not.toBe(j)
    // le relais refuse ce qui n'en est pas un
    expect(JETON.test('pas-un-jeton')).toBe(false)
    expect(JETON.test('')).toBe(true)
  })
})

describe('relais — le débit d’une connexion est borné', () => {
  it('une partie réelle passe : 212 Ko/s mesurés, en vingt images par seconde', () => {
    const d = debit()
    const image = Math.round((212 * 1024) / 20)
    for (let t = 0; t < 10_000; t += 50) expect(d.compte(image, t)).toBe('passe')
  })

  it('au-delà du plafond, on jette ; qui persiste PATIENCE_DEBIT secondes est coupé', () => {
    const d = debit()
    const gros = 64 * 1024
    const verdicts: string[] = []
    for (let t = 0; t < (PATIENCE_DEBIT + 1) * 1000; t += 50) verdicts.push(d.compte(gros, t))
    // la première seconde : passe jusqu'au plafond, puis jette
    expect(verdicts.slice(0, 20)).toContain('passe')
    expect(verdicts.slice(0, 20)).toContain('jette')
    expect(verdicts.filter((v) => v === 'passe').length).toBeLessThanOrEqual(Math.ceil((DEBIT_MAX / gros) * (PATIENCE_DEBIT + 1)))
    expect(verdicts).toContain('coupe')
    // pas avant d'avoir persisté
    expect(verdicts.indexOf('coupe')).toBeGreaterThanOrEqual((PATIENCE_DEBIT - 1) * 20)
  })

  it('une rafale isolée ne coupe pas : le compte d’excès repart à zéro après une seconde sage', () => {
    const d = debit()
    for (let s = 0; s < 20; s++) {
      // une seconde sur deux au-delà du plafond
      const gros = s % 2 === 0 ? DEBIT_MAX + 1 : 1000
      expect(d.compte(gros, s * 1000)).not.toBe('coupe')
    }
  })
})

describe('relais — l’adresse d’une connexion', () => {
  it('derrière Vercel, le premier maillon de x-forwarded-for ; sinon, le repli', () => {
    expect(adresseDe({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7')
    expect(adresseDe({ 'x-forwarded-for': ['198.51.100.2'] })).toBe('198.51.100.2')
    expect(adresseDe({}, '127.0.0.1')).toBe('127.0.0.1')
  })
})
