import { describe, expect, it } from 'vitest'
import { fichesCodex } from './codex'
import {
  RAYONS_FICHES,
  RAYONS_JOURNAL,
  ecritCibles,
  fichesDuRayon,
  formateQuand,
  indice,
  litCibles,
  progression,
  rayonsDe,
  visibles,
  voisine,
} from './codexVue'

const connu = (ids: string[]) => (id: string) => ids.includes(id)

describe('les rayons du codex', () => {
  it('les fiches et le journal se partagent tout le codex, sans doublon ni oubli', () => {
    const fiches = RAYONS_FICHES.flatMap(fichesDuRayon)
    const journal = RAYONS_JOURNAL.flatMap(fichesDuRayon)
    expect(fiches.length + journal.length).toBe(fichesCodex().length)
    expect(new Set([...fiches, ...journal].map((d) => d.id)).size).toBe(fichesCodex().length)
    // le rayon scellé n'a rien : il annonce, il ne ment pas
    expect(fichesDuRayon(RAYONS_FICHES.find((r) => r.scelle)!)).toEqual([])
    expect(rayonsDe('journal')).toBe(RAYONS_JOURNAL)
  })

  it('le filtre garde les connues, ou les autres', () => {
    const eau = RAYONS_FICHES[0]
    const c = connu(['eau-mur', 'eau-grille'])
    expect(visibles(eau, 'tous', c).length).toBe(fichesDuRayon(eau).length)
    expect(visibles(eau, 'ok', c).map((d) => d.id)).toEqual(['eau-mur', 'eau-grille'])
    expect(visibles(eau, 'non', c).some((d) => d.id === 'eau-mur')).toBe(false)
  })

  it('la progression compte par mode', () => {
    const c = connu(['eau-mur', 'recit-livraison'])
    expect(progression('fiches', c)).toMatchObject({ faites: 1 })
    expect(progression('journal', c)).toMatchObject({ faites: 1, total: 11, pct: 9 })
    expect(progression('fiches', () => false).pct).toBe(0)
  })
})

describe('la navigation et les indices', () => {
  it('la voisine boucle dans les deux sens, et part du début sans sélection', () => {
    const l = fichesDuRayon(RAYONS_FICHES[0])
    expect(voisine(l, null, 1)).toBe(l[0])
    expect(voisine(l, l[0].id, -1)).toBe(l[l.length - 1])
    expect(voisine(l, l[l.length - 1].id, 1)).toBe(l[0])
    expect(voisine([], null, 1)).toBeNull()
  })

  it('l’indice dit le matériau et l’état, jamais le titre', () => {
    const d = fichesCodex().find((x) => x.id === 'glace-rideau')!
    expect(indice(d)).toBe('Toucher un rideau lamellaire à l’état glace.')
    expect(indice(d)).not.toContain(d.titre)
    expect(indice(fichesCodex().find((x) => x.id === 'rosee')!)).toContain('phénomène')
    expect(indice(fichesCodex().find((x) => x.id === 'recit-alerte')!)).toContain('récit')
    expect(indice(fichesCodex().find((x) => x.id === 'fin-miroir')!)).toContain('fin')
    expect(indice(fichesCodex().find((x) => x.id === 'fin-miroir')!)).not.toContain('miroir')
  })

  it('la date de découverte se lit, ou se tait', () => {
    expect(formateQuand('2026-09-04T07:00:00.000Z')).toBe('04/09/2026')
    expect(formateQuand('')).toBe('')
    expect(formateQuand('n’importe quoi')).toBe('')
  })

  it('les objectifs suivis survivent au rechargement, et un stockage muet ne casse rien', () => {
    const m = new Map<string, string>()
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    ecritCibles(st, new Set(['eau-membrane']))
    expect([...litCibles(st)]).toEqual(['eau-membrane'])
    expect(litCibles(null).size).toBe(0)
    m.set('projet21.codex.cibles.v1', '{pas une liste')
    expect(litCibles(st).size).toBe(0)
  })
})
