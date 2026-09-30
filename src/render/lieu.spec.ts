// OÙ JOUE LE JOUEUR : la région vient du fuseau horaire, jamais d'une
// demande de géolocalisation.

import { describe, expect, it } from 'vitest'
import { lieuDuJoueur } from './lieu'

describe('lieu — la région du joueur, d’après son fuseau', () => {
  it('un fuseau de la table donne sa ville', () => {
    const l = lieuDuJoueur('Europe/Paris', 60)
    expect(l).toEqual({ lat: 48.86, lon: 2.35, source: 'table' })
    expect(lieuDuJoueur('America/Sao_Paulo', -180).lat).toBeLessThan(-20)
  })

  it('un fuseau inconnu : la longitude du décalage d’hiver, la latitude du continent', () => {
    const l = lieuDuJoueur('Europe/Andorra', 60)
    expect(l.source).toBe('decalage')
    expect(l.lon).toBeCloseTo(15, 6)
    expect(l.lat).toBe(48)
    expect(lieuDuJoueur('America/Winnipeg', -360).lon).toBeCloseTo(-90, 6)
    expect(lieuDuJoueur('America/Asuncion', -240).lat).toBeLessThan(0)
  })

  it('sans fuseau, ou en UTC : le méridien de Greenwich, l’équateur', () => {
    expect(lieuDuJoueur(undefined, 0)).toEqual({ lat: 0, lon: 0, source: 'decalage' })
    expect(lieuDuJoueur('Etc/UTC', 0).lon).toBeCloseTo(0, 6)
  })

  it('la longitude reste dans −180..180, même au-delà de la ligne de changement de date', () => {
    const l = lieuDuJoueur('Pacific/Kiritimati', 14 * 60)
    expect(l.lon).toBeGreaterThanOrEqual(-180)
    expect(l.lon).toBeLessThanOrEqual(180)
    expect(l.lon).toBeCloseTo(-150, 6)
  })
})
