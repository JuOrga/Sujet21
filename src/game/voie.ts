// LA VOIE SEMI-PROCÉDURALE : le PLAN DE DESCENTE — le cycle de vie complet
// d'une run, début · milieu · fin, jouable de bout en bout avec la seule
// génération procédurale. Le plan est PARAMÉTRABLE (banc de réglage) :
//   · longueur : le nombre de salles de la descente — la voie se BOUCLE au
//     bout, que la séquence écrite soit longue, courte ou vide ;
//   · diffMax  : la difficulté atteinte en fin de descente — la rampe monte
//     de 0 au départ jusqu'à ce plafond, linéairement ;
//   · graineDuJour : la DESCENTE DU JOUR — les salles générées sont les
//     mêmes pour tout le monde ce jour-là (la graine vient de la date), le
//     palmarès se compare entre postes.
// Le moment (début/milieu/fin) se calcule par tiers de la longueur, comme
// la phase de run du pool (poule.ts).

import { phaseRun } from './poule'
import type { CodeAtelier } from './levelIO'

export interface PlanVoie {
  longueur: number
  diffMax: number
  graineDuJour: boolean
}

export const PLAN_VOIE_DEFAUTS: PlanVoie = {
  longueur: 12,
  diffMax: 3,
  graineDuJour: false,
}

/** Ramène un plan (chargé du stockage, ou réglé au banc) dans les bornes. */
export function clampPlanVoie(p: Partial<PlanVoie> | null): PlanVoie {
  const n = (v: unknown, d: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : d
  return {
    longueur: Math.max(
      3,
      Math.min(40, Math.round(n(p?.longueur, PLAN_VOIE_DEFAUTS.longueur))),
    ),
    diffMax: Math.max(
      0,
      Math.min(9, Math.round(n(p?.diffMax, PLAN_VOIE_DEFAUTS.diffMax))),
    ),
    graineDuJour: p?.graineDuJour === true,
  }
}

/** Le MOMENT du rang (1-based) dans le plan : par tiers de la longueur. */
export function momentAuRang(rang: number, plan: PlanVoie): CodeAtelier['moment'] {
  return phaseRun(rang, plan.longueur)
}

/** La DIFFICULTÉ du rang : la rampe 0 → diffMax, linéaire sur la descente.
 * Rang 1 = 0, dernier rang = diffMax — le début accueille, la fin exige. */
export function diffAuRang(rang: number, plan: PlanVoie): number {
  const t = (Math.max(1, rang) - 1) / Math.max(1, plan.longueur - 1)
  return Math.max(0, Math.min(9, Math.round(Math.min(1, t) * plan.diffMax)))
}

/** Hachage FNV-1a 32 bits : stable, sans dépendance — la graine du jour. */
export function hachage(txt: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** La VARIANTE du rang pour la descente du jour : la même pour tous les
 * postes le même jour, différente à chaque rang et chaque jour. */
export function varianteDuJour(jourIso: string, rang: number): string {
  return (hachage(`${jourIso}#${rang}`) % 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')
}

/** DEUX MÉCANIQUES distinctes pour les cartes du choix — la première évite
 * celle de la salle écrite (si elle existe) pour que le choix parle. */
export function mecaniquesDuChoix(
  exclue: number | null,
  alea: () => number,
): [CodeAtelier['mecanique'], CodeAtelier['mecanique']] {
  const toutes = [0, 1, 2, 3] as const
  const candidates = toutes.filter((m) => m !== exclue)
  const a = candidates[Math.floor(alea() * candidates.length)]
  const restantes = toutes.filter((m) => m !== a)
  const b = restantes[Math.floor(alea() * restantes.length)]
  return [a, b]
}

// ---- Le PALMARÈS de la voie : ce qui donne envie de redescendre ----------
// Par poste (localStorage, la clé est gérée par l'appelant) : combien de
// descentes entamées, combien BOUCLÉES, la profondeur record, le meilleur
// volume livré sur une voie bouclée.

export interface PalmaresVoie {
  descentes: number
  bouclees: number
  profondeurRecord: number
  meilleurLivre: number
}

export const PALMARES_VOIE_VIERGE: PalmaresVoie = {
  descentes: 0,
  bouclees: 0,
  profondeurRecord: 0,
  meilleurLivre: 0,
}

export function litPalmaresVoie(brut: string | null): PalmaresVoie {
  try {
    const o = JSON.parse(brut ?? '{}') as Partial<PalmaresVoie>
    const n = (v: unknown): number =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
    return {
      descentes: Math.round(n(o.descentes)),
      bouclees: Math.round(n(o.bouclees)),
      profondeurRecord: Math.round(n(o.profondeurRecord)),
      meilleurLivre: n(o.meilleurLivre),
    }
  } catch {
    return { ...PALMARES_VOIE_VIERGE }
  }
}
