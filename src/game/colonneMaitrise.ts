// ---- LA COLONNE DE MAÎTRISE ------------------------------------------------
// Le tube rendu dans Blender (ceremonieObjets.ts, OBJETS.maitrise) a trois
// SIÈGES d'anneau. Chacun porte un palier de la table : la colonne montre
// les trois paliers à venir, depuis le dernier atteint (le fond du tube).
// Le liquide qui passe un siège, c'est un palier franchi — son niveau doit
// donc tomber EXACTEMENT sur le siège quand l'XP vaut le palier : on le
// lit par morceaux, d'un siège à l'autre, et non sur une échelle unique
// (les paliers ne sont pas également espacés : 3, 6, 10, 15…).
// Ce module décide (niveaux, quels anneaux) et écrit le gabarit des
// anneaux ; la cérémonie (main.ts) pose et anime.

import { ANNEAU_URL, ANNEAUX_MAITRISE, OBJETS } from './ceremonieObjets'
import { PALIERS_XP } from './instruments'

/** Le niveau de chaque siège, du plus bas au plus haut : la hauteur du
 *  centre de sa boîte d'anneau, en part de la fenêtre du liquide (0 au fond,
 *  1 en haut). Dérivé des mesures de l'atelier : re-rendre la colonne ne
 *  demande rien ici. */
export const NIVEAUX_SIEGES: readonly number[] = ANNEAUX_MAITRISE.map((b) => {
  const f = OBJETS.maitrise.liquide
  return (f.y + f.h - (b.y + b.h / 2)) / f.h
})

/** Ce que la colonne montre : le fond (`base`, le dernier palier atteint, ou
 *  0) et les paliers posés sur ses sièges, du bas vers le haut. */
export interface Colonne {
  base: number
  paliers: readonly number[]
}

/** La colonne vue depuis `xp` : les trois paliers à venir. Au bout de la
 *  table, les trois DERNIERS paliers, franchis ou non — les sièges restent
 *  occupés (des anneaux brisés disent la table finie). */
export function colonneMaitrise(xp: number, table: readonly number[] = PALIERS_XP): Colonne {
  const n = NIVEAUX_SIEGES.length
  let suivant = table.findIndex((p) => xp < p)
  if (suivant < 0) suivant = table.length
  const debut = Math.max(0, Math.min(suivant, table.length - n))
  return { base: debut > 0 ? table[debut - 1] : 0, paliers: table.slice(debut, debut + n) }
}

/** Le niveau du liquide (0..1) pour `xp` : en ligne droite d'un siège à
 *  l'autre ; au-delà du dernier, la pente du dernier tronçon, jusqu'au
 *  plein. Sans palier, la colonne est pleine (la table est finie). */
export function niveauColonne(c: Colonne, xp: number): number {
  if (c.paliers.length === 0) return 1
  const noeuds: Array<[number, number]> = [[c.base, 0], ...c.paliers.map((p, k): [number, number] => [p, NIVEAUX_SIEGES[k]])]
  if (xp <= c.base) return 0
  for (let k = 1; k < noeuds.length; k++) {
    const [x0, y0] = noeuds[k - 1]
    const [x1, y1] = noeuds[k]
    if (xp <= x1) return y0 + ((y1 - y0) * (xp - x0)) / (x1 - x0)
  }
  const [xa, ya] = noeuds[noeuds.length - 2]
  const [xb, yb] = noeuds[noeuds.length - 1]
  return Math.min(1, yb + ((yb - ya) * (xp - xb)) / (xb - xa))
}

/** Les anneaux de la colonne, à poser DANS la cuve (.mb-cuve, qui a les
 *  proportions de l'image) et PAR-DESSUS le verre : chacun dans la boîte
 *  mesurée de son siège, la case 1 de la planche (intact) pour un palier à
 *  franchir, la case 2 (brisé) pour un palier atteint. `apres` désigne ceux
 *  qu'un versement franchirait (.mb-anneau-franchit). Décoratifs : le
 *  palier se dit en texte ailleurs. L'image absente, il reste le siège vide
 *  du rendu de la colonne — jamais une icône cassée (c'est un fond). */
export function anneauxHTML(c: Colonne, xp: number, apres = xp): string {
  const pct = (v: number): string => `${+(v * 100).toFixed(3)}%`
  return c.paliers
    .map((p, k) => {
      const b = ANNEAUX_MAITRISE[k]
      const brise = xp >= p
      const franchit = !brise && apres >= p
      const cls = 'mb-anneau' + (brise ? ' mb-anneau-brise' : '') + (franchit ? ' mb-anneau-franchit' : '')
      return (
        `<i class="${cls}" aria-hidden="true" ` +
        `style="left:${pct(b.x)};top:${pct(b.y)};width:${pct(b.l)};height:${pct(b.h)};background-image:url(${ANNEAU_URL})"></i>`
      )
    })
    .join('')
}
