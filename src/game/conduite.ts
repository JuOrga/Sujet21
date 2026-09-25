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
//
// LES BOUTS DANS LE MUR. Une conduite posée contre une paroi (la porte
// froide qui barre la salle d'un bord à l'autre) s'arrêtait sur une bride,
// comme posée là : sans arrivée ni départ. Un bout qui touche un solide ou
// le bord de la salle y PLONGE : pas de bride, le tuyau file jusqu'au bord
// du bloc et le mur le prend. Le rendu lit les mêmes bouts (boutsEnMur).

import {
  BOUT_MUR_NEG,
  BOUT_MUR_POS,
  FORME_CONDUITE,
  CONDUITE,
  conduiteHoriz,
  dansForme,
  type FormeBox,
} from './formes'
import { MAT_FROID, sansPhysique } from './level'

type Boite = FormeBox & { material: number }
type Bornes = { minX: number; minY: number; maxX: number; maxY: number }

/** Ce qui arrête un tuyau qui file : un solide (hors lui-même et les sans-
 *  physique : sas, vide, baie) ou le dehors de la salle. */
function dansLeMur(x: number, y: number, soi: Boite, boxes: readonly Boite[], bornes: Bornes | null): boolean {
  if (bornes && (x < bornes.minX || x > bornes.maxX || y < bornes.minY || y > bornes.maxY)) return true
  for (const o of boxes) {
    if (o === soi || sansPhysique(o.material)) continue
    // une AUTRE conduite arrête par ce qu'elle a À COUP SÛR — son tube et
    // ses joints —, pas par sa boîte : le bout d'une conduite en T contre
    // la boîte d'une voisine plongeait sinon dans le sol vide entre la boîte
    // et le tube (~0,22 T). Ses brides de BOUT n'y comptent pas : elles
    // dépendent de ses propres bouts (un bout dans un mur n'en a pas), et
    // les chercher ferait se sonder deux conduites l'une l'autre sans fin.
    const f = o.material === MAT_FROID && !o.forme ? tronconSur(o) : o
    if (dansForme(f, x, y)) return true
  }
  return false
}

/** Une conduite réduite à ce qu'elle a quels que soient ses bouts : les
 *  deux bouts « dans un mur », donc sans bride ni traversée — le tube de
 *  bout en bout, et ses joints. */
function tronconSur(o: Boite): Boite {
  return { ...o, forme: FORME_CONDUITE, bouts: BOUT_MUR_NEG | BOUT_MUR_POS } as Boite
}

/** Les bouts de la conduite `b` qui plongent dans un mur (BOUT_MUR_*). Un
 *  bout y plonge si, juste au-delà, TOUTE la section du tuyau (son axe et
 *  ses deux flancs) est dans un solide ou hors de la salle — un tuyau à
 *  moitié contre un coin garde sa bride. Une boîte oblique n'est pas
 *  sondée : ses bouts gardent leur bride. */
export function boutsEnMur(b: Boite, boxes: readonly Boite[], bornes: Bornes | null): number {
  if (b.material !== MAT_FROID || b.forme || b.angle) return 0
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  const horiz = conduiteHoriz(w, h, b.sens)
  const T = horiz ? h : w
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const e = 3 // juste au-delà du bout
  const flanc = CONDUITE.tuyau * T * 0.9
  let bouts = 0
  for (const [bit, signe] of [
    [BOUT_MUR_NEG, -1],
    [BOUT_MUR_POS, 1],
  ] as const) {
    let plein = true
    for (const t of [0, -flanc, flanc]) {
      const x = horiz ? (signe < 0 ? b.minX - e : b.maxX + e) : cx + t
      const y = horiz ? cy + t : signe < 0 ? b.minY - e : b.maxY + e
      if (!dansLeMur(x, y, b, boxes, bornes)) {
        plein = false
        break
      }
    }
    if (plein) bouts |= bit
  }
  return bouts
}

/** La boîte telle que la physique doit la lire. Renvoie la MÊME boîte pour
 *  tout ce qui n'est pas une conduite (aucune copie, aucun coût) ; une
 *  copie pour une conduite — la salle chargée n'est jamais modifiée.
 *  `boxes` et `bornes` : la salle, pour trouver les bouts plongés dans un
 *  mur ; sans elles, tous les bouts ont leur bride. */
export function formePhysique<B extends Boite>(b: B, boxes: readonly Boite[] = [], bornes: Bornes | null = null): B {
  if (b.material !== MAT_FROID || b.forme) return b
  const bouts = boutsEnMur(b, boxes, bornes)
  return { ...b, forme: FORME_CONDUITE, ...(bouts ? { bouts } : {}) }
}
