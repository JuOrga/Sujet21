import { describe, expect, it } from 'vitest'
import { DELAI_REPOS_MS, athAuRepos, litReglageAth, pointeurPres } from './athRepos'

const base = { maintenant: 10_000, dernierGeste: 10_000, reglage: 'discret' as const, force: false }

describe('le repos de l’ATH', () => {
  it('est DISCRET par défaut, et ne reconnaît que « complet » comme refus', () => {
    expect(litReglageAth(null)).toBe('discret')
    expect(litReglageAth('n’importe quoi')).toBe('discret')
    expect(litReglageAth('complet')).toBe('complet')
  })

  it('s’endort après le délai, pas avant', () => {
    expect(athAuRepos({ ...base, maintenant: 10_000 + DELAI_REPOS_MS - 1 })).toBe(false)
    expect(athAuRepos({ ...base, maintenant: 10_000 + DELAI_REPOS_MS })).toBe(true)
  })

  it('ne s’endort jamais en COMPLET', () => {
    expect(athAuRepos({ ...base, maintenant: 99_000, reglage: 'complet' })).toBe(false)
  })

  it('reste éveillé tant qu’on le force (tiroir ouvert, pause, alerte)', () => {
    expect(athAuRepos({ ...base, maintenant: 99_000, force: true })).toBe(false)
  })

  it('se réveille quand le pointeur approche d’un poste', () => {
    const postes = [{ left: 14, top: 650, right: 150, bottom: 706 }]
    expect(pointeurPres(200, 600, postes)).toBe(true) // ~71 px du coin
    expect(pointeurPres(640, 360, postes)).toBe(false)
    expect(pointeurPres(80, 680, postes)).toBe(true) // dedans
  })
})
