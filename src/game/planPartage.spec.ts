import { describe, expect, it } from 'vitest'
import { PLAN_VOIE_DEFAUTS, clampPlanVoie } from './voie'
import { etatPlan, litPlanPublie, memePlan, planAuDemarrage } from './planPartage'

const court = clampPlanVoie({ ...PLAN_VOIE_DEFAUTS, longueur: 6, diffMax: 5 })

describe('le plan publié, relu', () => {
  it('se ramène dans ses bornes, et un document qui n’est pas un plan vaut null', () => {
    expect(litPlanPublie({ longueur: 99, diffMax: -4 })).toMatchObject({ longueur: 40, diffMax: 0 })
    expect(litPlanPublie(null)).toBeNull()
    expect(litPlanPublie([1, 2])).toBeNull()
    expect(litPlanPublie('plan')).toBeNull()
  })

  it('deux plans se comparent dans leurs bornes', () => {
    expect(memePlan(PLAN_VOIE_DEFAUTS, { ...PLAN_VOIE_DEFAUTS })).toBe(true)
    expect(memePlan(PLAN_VOIE_DEFAUTS, { ...PLAN_VOIE_DEFAUTS, longueur: 400 })).toBe(false)
    expect(memePlan({ ...PLAN_VOIE_DEFAUTS, longueur: 400 }, { ...PLAN_VOIE_DEFAUTS, longueur: 40 })).toBe(true)
    expect(memePlan(null, null)).toBe(true)
    expect(memePlan(PLAN_VOIE_DEFAUTS, null)).toBe(false)
  })
})

describe('qui joue quel plan au démarrage', () => {
  it('un joueur joue le publié, sinon le livré — son brouillon ne compte pas', () => {
    expect(planAuDemarrage({ brouillon: court, publie: null, concepteur: false })).toEqual({ plan: PLAN_VOIE_DEFAUTS, source: 'livre' })
    expect(planAuDemarrage({ brouillon: court, publie: { ...PLAN_VOIE_DEFAUTS, longueur: 20 }, concepteur: false })).toMatchObject({ plan: { longueur: 20 }, source: 'publie' })
  })

  it('un concepteur joue son brouillon, sinon le publié, sinon le livré', () => {
    expect(planAuDemarrage({ brouillon: court, publie: PLAN_VOIE_DEFAUTS, concepteur: true })).toMatchObject({ plan: { longueur: 6 }, source: 'brouillon' })
    expect(planAuDemarrage({ brouillon: null, publie: court, concepteur: true })).toMatchObject({ plan: { longueur: 6 }, source: 'publie' })
    expect(planAuDemarrage({ brouillon: null, publie: null, concepteur: true })).toEqual({ plan: PLAN_VOIE_DEFAUTS, source: 'livre' })
  })
})

describe('ce que l’écran dit du plan qui joue', () => {
  it('identique au publié : le publié joue ; sinon un brouillon ; le livré seulement si rien n’est publié', () => {
    expect(etatPlan({ courant: court, publie: court })).toMatchObject({ source: 'publie', identiqueAuPublie: true })
    expect(etatPlan({ courant: court, publie: PLAN_VOIE_DEFAUTS })).toMatchObject({ source: 'brouillon', identiqueAuPublie: false })
    expect(etatPlan({ courant: PLAN_VOIE_DEFAUTS, publie: null })).toMatchObject({ source: 'livre', identiqueAuLivre: true })
    // le livré modifié sans rien de publié : c'est un brouillon
    expect(etatPlan({ courant: court, publie: null }).source).toBe('brouillon')
    // un publié égal au livré : c'est le publié qui joue, pas « le livré »
    expect(etatPlan({ courant: PLAN_VOIE_DEFAUTS, publie: PLAN_VOIE_DEFAUTS }).source).toBe('publie')
  })
})
