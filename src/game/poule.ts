// Le POOL de salles : à chaque rang de la run (les deux lettres du code
// « 21XX-MMD »), plusieurs tableaux peuvent coexister — en fin de salle,
// après la récompense, le jeu en PROPOSE DEUX au choix. La sélection est
// automatique, sur les critères du code :
//   · le MOMENT le plus proche de la phase réelle de la run d'abord ;
//   · puis la DIVERSITÉ : deux mécaniques différentes si possible,
//     sinon l'écart de difficulté le plus parlant.

import type { LevelDef } from './level'
import { decodeCode21, type Code21 } from './levelIO'

/** La phase de la run (1 début · 2 milieu · 3 fin) au rang donné. */
export function phaseRun(rang: number, total: number): 1 | 2 | 3 {
  const t = Math.max(1, total)
  const p = 1 + Math.min(2, Math.floor(((rang - 1) / t) * 3))
  return p as 1 | 2 | 3
}

/** Les candidats du POOL au rang donné : tous les tableaux dont le code
 * « 21XX-MMD » porte cet ordre. */
export function candidatsAuRang(niveaux: LevelDef[], rang: number): LevelDef[] {
  return niveaux.filter((lv) => decodeCode21(lv.code)?.ordre === rang)
}

/** Les DEUX propositions de fin de salle — ou [] si le pool du rang n'a pas
 * au moins deux tableaux (l'enchaînement reste alors linéaire). */
export function propositionsSalles(
  niveaux: LevelDef[],
  rang: number,
  totalRun: number,
): LevelDef[] {
  const cands = candidatsAuRang(niveaux, rang)
  if (cands.length < 2) return []
  const phase = phaseRun(rang, totalRun)
  const code = (lv: LevelDef): Code21 => decodeCode21(lv.code)!
  // moment le plus proche de la phase d'abord ; difficulté douce ensuite
  const tri = [...cands].sort((a, b) => {
    const da = Math.abs(code(a).atelier.moment - phase)
    const db = Math.abs(code(b).atelier.moment - phase)
    if (da !== db) return da - db
    return code(a).atelier.difficulte - code(b).atelier.difficulte
  })
  const premier = tri[0]
  const a1 = code(premier).atelier
  const reste = tri.slice(1)
  // la DIVERSITÉ fait le choix intéressant : une mécanique différente si le
  // pool en offre une — sinon l'écart de difficulté le plus grand
  const second =
    reste.find((lv) => code(lv).atelier.mecanique !== a1.mecanique) ??
    [...reste].sort(
      (a, b) =>
        Math.abs(code(b).atelier.difficulte - a1.difficulte) -
        Math.abs(code(a).atelier.difficulte - a1.difficulte),
    )[0]
  return [premier, second]
}
