// La conduite d'ammoniac (plaque froide) : sa FORME PHYSIQUE.
//
// Le shader (conduiteNH3) peint un tuyau givré plus mince que le bloc, avec
// des brides de toute sa largeur aux bouts et aux joints — le sol visible
// autour. La physique, elle, lisait la boîte — et l'eau butait sur du sol
// visible. Toute plaque froide RECTANGULAIRE prend donc, à l'entrée du
// solveur et du laser, la forme CONDUITE (formes.ts : l'union du tuyau et
// de ses brides) : ce qu'on voit, ce qui arrête et ce qui gèle sont la même
// forme. Une plaque à qui l'éditeur a donné une forme (disque,
// capsule…) la garde : elle est dessinée découpée à cette forme.

import { FORME_CONDUITE } from './formes'
import { MAT_FROID } from './level'

/** La boîte telle que la physique doit la lire. Renvoie la MÊME boîte pour
 *  tout ce qui n'est pas une conduite (aucune copie, aucun coût) ; une
 *  copie pour une conduite — la salle chargée n'est jamais modifiée. */
export function formePhysique<B extends { material: number; forme?: number }>(b: B): B {
  if (b.material !== MAT_FROID || b.forme) return b
  return { ...b, forme: FORME_CONDUITE }
}
