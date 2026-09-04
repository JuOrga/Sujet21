import { describe, expect, it } from 'vitest'
import { CARTE_LIVREE, cloneCarte, serialiseCarte } from './carteStation'
import { documentCarte, litCartePubliee, memeCarte, refusPublication } from './cartePartage'

describe('la carte publiée', () => {
  it('la livrée se relit telle quelle, et se publie (rien à refuser)', () => {
    const relue = litCartePubliee(documentCarte(CARTE_LIVREE))
    expect(relue).not.toBeNull()
    expect(memeCarte(relue, CARTE_LIVREE)).toBe(true)
    expect(refusPublication(CARTE_LIVREE)).toEqual([])
  })

  it('une carte injouable ne remplace pas la livrée : deux modules du même id', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules.push({ ...c.modules[0] })
    expect(refusPublication(c).length).toBeGreaterThan(0)
    expect(litCartePubliee(documentCarte(c))).toBeNull()
  })

  it('un document qui n’est pas une carte vaut null', () => {
    expect(litCartePubliee(null)).toBeNull()
    expect(litCartePubliee({ modules: 'non' })).toBeNull()
    expect(litCartePubliee('carte')).toBeNull()
  })

  it('deux cartes se comparent par leur sérialisation, et un module déplacé les distingue', () => {
    const c = cloneCarte(CARTE_LIVREE)
    expect(memeCarte(c, CARTE_LIVREE)).toBe(true)
    c.modules[0].x += 8
    expect(memeCarte(c, CARTE_LIVREE)).toBe(false)
    expect(memeCarte(null, null)).toBe(true)
    expect(memeCarte(c, null)).toBe(false)
    expect(JSON.stringify(documentCarte(CARTE_LIVREE))).toBe(JSON.stringify(JSON.parse(serialiseCarte(CARTE_LIVREE))))
  })
})
