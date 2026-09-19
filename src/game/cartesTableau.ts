// LES CARTES D'UN TABLEAU : ce que le joueur tient, plus ce que la salle
// impose — et comment elles se composent avec la physique du tableau.
//
// LA RÈGLE DE PRIORITÉ, en trois couches (la question du concepteur, 17/09 :
// « des cartes pourraient influencer le preset, est-ce que ça n'entre pas en
// conflit avec le preset défini par tableau ? et en cas de multicarte ? ») :
//   1. le banc → le preset du tableau (LevelDef.reglages) → les réglages du
//      mini-jeu écrivent les NOMBRES de la physique, clé par clé, le dernier
//      qui écrit gagne — c'est createSim, et c'est tout ;
//   2. les cartes n'écrivent jamais un nombre dans le preset : elles tirent
//      des LEVIERS lus par-dessus (un facteur multiplie, un ajout s'ajoute),
//      exactement comme les instruments d'une run le font déjà — le preset
//      est la base, la carte le modificateur ; aucun conflit possible ;
//   3. plusieurs cartes suivent la règle des leviers (valeurLevier) : les
//      facteurs se multiplient, les ajouts s'additionnent ; une carte n'est
//      comptée qu'UNE fois même si la salle l'impose et que le joueur la tient.
// Pour le tir de glace, la part de l'éclat vaut donc preset + cartes, et un
// plafond garde le geste sensé (au-delà, l'éclat serait le corps).

import type { InstrumentDef } from './instruments'
import { instrumentDef } from './instruments'

/** La part du corps qu'un éclat ne dépasse jamais, cartes et preset réunis. */
export const GLACE_TIR_PART_MAX = 0.5

/** Les cartes qui JOUENT dans une salle : celles de la run, puis celles que
 *  le tableau impose et que le joueur n'a pas déjà — sans doublon. */
export function cartesActives(tenues: readonly string[], imposees: readonly string[] | undefined): string[] {
  const out = tenues.slice()
  for (const id of imposees ?? []) if (!out.includes(id)) out.push(id)
  return out
}

/** La part de l'éclat pour la salle : la base (le preset) plus les cartes,
 *  jamais négative, jamais au-delà du plafond. */
export function partTirEffective(base: number, bonusCartes: number): number {
  const b = Number.isFinite(base) ? Math.max(0, base) : 0
  const c = Number.isFinite(bonusCartes) ? Math.max(0, bonusCartes) : 0
  return Math.min(GLACE_TIR_PART_MAX, b + c)
}

/** Les identifiants d'un tableau que le catalogue ne connaît pas (une carte
 *  d'atelier jamais publiée, une faute de frappe) : ils ne font rien en jeu,
 *  l'éditeur les dit. */
export function cartesInconnues(ids: readonly string[] | undefined, catalogue: InstrumentDef[]): string[] {
  return (ids ?? []).filter((id) => !instrumentDef(id, catalogue))
}

/** Une liste de cartes lue d'un fichier : des chaînes non vides, sans doublon. */
export function litCartes(brut: unknown): string[] | undefined {
  if (!Array.isArray(brut)) return undefined
  const out: string[] = []
  for (const x of brut) {
    if (typeof x !== 'string') continue
    const id = x.trim()
    if (id && !out.includes(id)) out.push(id)
  }
  return out.length > 0 ? out : undefined
}
