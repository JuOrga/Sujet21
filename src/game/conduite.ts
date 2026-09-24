// La conduite d'ammoniac (plaque froide) : sa FORME PHYSIQUE.
//
// Le shader (conduiteNH3) ne peint qu'UN tuyau, du diamètre de la boîte,
// fermé par deux calottes : une pilule, le sol visible autour. La physique,
// elle, lisait la boîte — et l'eau butait dans des coins où l'on ne voyait
// que le sol. Toute plaque froide RECTANGULAIRE prend donc, à l'entrée du
// solveur et du laser, la forme CAPSULE (formes.ts, déjà la pilule du grand
// axe) : ce qu'on voit, ce qui arrête et ce qui gèle sont la même forme. Une plaque à qui l'éditeur a donné une forme (disque,
// capsule…) la garde : elle est dessinée découpée à cette forme.

import { FORME_CAPSULE } from './formes'
import { MAT_FROID } from './level'

/** La boîte telle que la physique doit la lire. Renvoie la MÊME boîte pour
 *  tout ce qui n'est pas une conduite (aucune copie, aucun coût) ; une
 *  copie pour une conduite — la salle chargée n'est jamais modifiée. */
export function formePhysique<B extends { material: number; forme?: number }>(b: B): B {
  if (b.material !== MAT_FROID || b.forme) return b
  return { ...b, forme: FORME_CAPSULE }
}
