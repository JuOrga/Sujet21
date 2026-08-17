import { describe, expect, it } from 'vitest'
import {
  CINEMATIQUE_ESSAI,
  DUREE_MAX,
  DUREE_MIN,
  EFFETS,
  FONDUS,
  parseCinematique,
  plancheVierge,
  serializeCinematique,
} from './cinematique'
import { BRUITAGES, PISTES, PONCTUATIONS } from './soundtrack'

describe('cinématiques — le format de données', () => {
  it('sérialise puis relit une cinématique à l’identique', () => {
    const source = {
      code: 'OUVERTURE',
      titre: "L'ouverture",
      planches: [
        {
          ...plancheVierge(),
          image: '/assets/cine/a.webp',
          texte: 'Qui êtes-vous ?',
          duree: 6,
        },
        {
          ...plancheVierge(),
          effet: 'battement-rouge' as const,
          bruitage: 'souffle-vapeur',
        },
      ],
    }
    const relu = parseCinematique(JSON.parse(serializeCinematique(source)))
    expect(relu).not.toBeNull()
    expect(relu!.rejets).toEqual([])
    expect(relu!.cine).toEqual(source)
  })

  it('refuse ce qui n’est pas une cinématique : sans code ou sans planche', () => {
    expect(parseCinematique(null)).toBeNull()
    expect(parseCinematique('texte')).toBeNull()
    expect(
      parseCinematique({ titre: 'sans code', planches: [plancheVierge()] }),
    ).toBeNull()
    expect(parseCinematique({ code: 'VIDE', planches: [] })).toBeNull()
    expect(parseCinematique({ code: 'VIDE' })).toBeNull()
  })

  it('borne la durée et nomme le rejet', () => {
    const r = parseCinematique({
      code: 'X',
      planches: [
        { ...plancheVierge(), duree: 999 },
        { ...plancheVierge(), duree: 0 },
      ],
    })!
    expect(r.cine.planches[0].duree).toBe(DUREE_MAX)
    expect(r.cine.planches[1].duree).toBe(DUREE_MIN)
    expect(r.rejets).toHaveLength(2)
  })

  it('écarte les vocabulaires inconnus (effet, fondu, sons) sans jeter la planche', () => {
    const r = parseCinematique({
      code: 'X',
      planches: [
        {
          image: 'i.webp',
          duree: 5,
          effet: 'explosion-hollywood',
          fondu: 'sepia',
          bruitage: 'trompette',
          ponctuation: 'roulement',
          piste: 'valse',
        },
      ],
    })!
    const p = r.cine.planches[0]
    expect(p.effet).toBe('zoom-avant') // le défaut, pas l'inconnu
    expect(p.fondu).toBe('noir')
    expect(p.bruitage).toBe('')
    expect(p.ponctuation).toBe('')
    expect(p.piste).toBe('')
    expect(r.rejets).toHaveLength(5)
    expect(p.image).toBe('i.webp') // la planche elle-même survit
  })

  it('ignore une planche illisible mais garde les autres', () => {
    const r = parseCinematique({
      code: 'X',
      planches: ['pas un objet', plancheVierge(), 42],
    })!
    expect(r.cine.planches).toHaveLength(1)
    expect(r.rejets).toHaveLength(2)
  })

  it("la cinématique d'essai livrée est valide, planche par planche", () => {
    const r = parseCinematique(
      JSON.parse(serializeCinematique(CINEMATIQUE_ESSAI)),
    )
    expect(r).not.toBeNull()
    expect(r!.rejets).toEqual([])
    expect(r!.cine).toEqual(CINEMATIQUE_ESSAI)
    for (const p of CINEMATIQUE_ESSAI.planches) {
      expect(EFFETS).toContain(p.effet)
      expect(FONDUS).toContain(p.fondu)
      if (p.bruitage) expect(BRUITAGES).toContain(p.bruitage)
      if (p.ponctuation) expect(PONCTUATIONS).toContain(p.ponctuation)
      if (p.piste) expect(PISTES).toContain(p.piste)
      expect(p.duree).toBeGreaterThanOrEqual(DUREE_MIN)
      expect(p.duree).toBeLessThanOrEqual(DUREE_MAX)
    }
  })
})
