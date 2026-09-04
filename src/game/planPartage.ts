// LE PLAN DE LA DESCENTE, PARTAGÉ. Jusqu'ici le plan (longueur, rampe,
// posture, poids de la pioche) ne vivait que sur le poste qui l'avait
// réglé : les joueurs jouaient le plan livré avec le code, quoi que le
// concepteur ait trouvé. Désormais le plan PUBLIÉ (magasin partagé) joue
// pour tout le monde ; le brouillon du poste reste l'outil de réglage.
//
// QUI JOUE QUEL PLAN, au démarrage — la règle est ici, pure et testée :
//   · un JOUEUR joue le publié, sinon le livré : il ne règle jamais le
//     plan, un brouillon qui traînerait sur son poste ne compte pas ;
//   · un CONCEPTEUR joue son brouillon s'il en a un (il est en train de
//     régler), sinon le publié, sinon le livré. L'écran LA DESCENTE lui
//     dit lequel joue et ce qui diffère.

import { clampPlanVoie, PLAN_VOIE_DEFAUTS, type PlanVoie } from './voie'

export type SourcePlan = 'brouillon' | 'publie' | 'livre'

/** Le plan publié tel qu'il arrive — null s'il n'y en a pas. */
export function litPlanPublie(document: unknown): PlanVoie | null {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) return null
  return clampPlanVoie(document as Partial<PlanVoie>)
}

/** Deux plans disent-ils la même descente ? (comparés dans leurs bornes) */
export function memePlan(a: PlanVoie | null, b: PlanVoie | null): boolean {
  if (a === null || b === null) return a === b
  return JSON.stringify(clampPlanVoie(a)) === JSON.stringify(clampPlanVoie(b))
}

export function planAuDemarrage(entree: {
  brouillon: PlanVoie | null
  publie: PlanVoie | null
  concepteur: boolean
}): { plan: PlanVoie; source: SourcePlan } {
  if (entree.concepteur && entree.brouillon) return { plan: clampPlanVoie(entree.brouillon), source: 'brouillon' }
  if (entree.publie) return { plan: clampPlanVoie(entree.publie), source: 'publie' }
  return { plan: clampPlanVoie(PLAN_VOIE_DEFAUTS), source: 'livre' }
}

/** Ce que l'écran affiche : d'où vient le plan qui joue sur ce poste. */
export function etatPlan(entree: {
  courant: PlanVoie
  publie: PlanVoie | null
}): { source: SourcePlan; identiqueAuPublie: boolean; identiqueAuLivre: boolean } {
  const identiqueAuPublie = entree.publie !== null && memePlan(entree.courant, entree.publie)
  const identiqueAuLivre = memePlan(entree.courant, PLAN_VOIE_DEFAUTS)
  const source: SourcePlan = identiqueAuPublie ? 'publie' : entree.publie === null && identiqueAuLivre ? 'livre' : 'brouillon'
  return { source, identiqueAuPublie, identiqueAuLivre }
}
