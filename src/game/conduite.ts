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
//
// LA CHAUDIÈRE suit la même règle, avec ses pièces à elle (formes.ts,
// CHAUDIERE) : le carter à ailettes, le capot, le boîtier et la plaque de
// sol où plonge son câble. Toute chaudière RECTANGULAIRE s'y lit.

import {
  BOUT_MUR_NEG,
  BOUT_MUR_POS,
  CHAUDIERE,
  FORME_CHAUDIERE,
  FORME_CONDUITE,
  CONDUITE,
  conduiteHoriz,
  dansForme,
  modeChaudiere,
  piecesChaudiere,
  piecesConduite,
  type FormeBox,
} from './formes'
import { MAT_CHAUD, MAT_FROID, sansPhysique } from './level'

type Boite = FormeBox & { material: number }

/** La conduite ou la chaudière qui se dessine à ses pièces : une plaque
 *  froide ou une chaudière RECTANGULAIRE. Une forme donnée à l'éditeur
 *  (disque, capsule…) l'emporte : la pièce est dessinée découpée à elle. */
export function aPieces(b: { material: number; forme?: number }): boolean {
  return (b.material === MAT_FROID || b.material === MAT_CHAUD) && !b.forme
}
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
    const f = aPieces(o) ? tronconSur(o) : o
    if (dansForme(f, x, y)) return true
  }
  return false
}

/** Une conduite réduite à ce qu'elle a quels que soient ses bouts : les
 *  deux bouts « dans un mur », donc sans bride ni traversée — le tube de
 *  bout en bout, et ses joints. */
function tronconSur(o: Boite): Boite {
  const forme = o.material === MAT_CHAUD ? FORME_CHAUDIERE : FORME_CONDUITE
  return { ...o, forme, bouts: BOUT_MUR_NEG | BOUT_MUR_POS } as Boite
}

/** Les bouts de la conduite `b` qui plongent dans un mur (BOUT_MUR_*). Un
 *  bout y plonge si, juste au-delà, TOUTE la section du tuyau (son axe et
 *  ses deux flancs) est dans un solide ou hors de la salle — un tuyau à
 *  moitié contre un coin garde sa bride. Une boîte oblique n'est pas
 *  sondée : ses bouts gardent leur bride. */
export function boutsEnMur(b: Boite, boxes: readonly Boite[], bornes: Bornes | null): number {
  if (!aPieces(b) || b.angle) return 0
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  const horiz = conduiteHoriz(w, h, b.sens)
  const T = horiz ? h : w
  // une chaudière compacte ou courte ignore ses bouts (piecesChaudiere, le
  // shader) : les six sondages contre toute la salle seraient perdus
  if (b.material === MAT_CHAUD && modeChaudiere(horiz ? w : h, T) !== 'longue') return 0
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const e = 3 // juste au-delà du bout
  const flanc = (b.material === MAT_CHAUD ? CHAUDIERE.corps : CONDUITE.tuyau) * T * 0.9
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
  if (!aPieces(b)) return b
  const bouts = boutsEnMur(b, boxes, bornes)
  // LES PIÈCES, précalculées sur la copie : la boucle de contact du
  // solveur (formes.ts, conduiteContactAxe) les lit d'un champ au lieu de
  // les rebâtir, ou de les chercher, à chaque particule et chaque sous-pas
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  const horiz = conduiteHoriz(w, h, (b as Boite & { sens?: number }).sens)
  const chaud = b.material === MAT_CHAUD
  const pieces = (chaud ? piecesChaudiere : piecesConduite)(horiz ? w : h, horiz ? h : w, bouts)
  return { ...b, forme: chaud ? FORME_CHAUDIERE : FORME_CONDUITE, pieces, ...(bouts ? { bouts } : {}) }
}

/** LA CLÉ D'UNE BOÎTE : tout ce qui décide de la forme qu'on y lit —
 *  géométrie, matière, forme et ses réglages (p0, p1, les bouts d'un arc
 *  p2, la coupe), angle, sens du tuyau. UNE seule définition, pour la carte
 *  de lumière (renderer.ts, cleBoitesLumiere) comme pour les bouts des
 *  conduites : deux copies avaient déjà oublié p2 et la coupe, qui changent
 *  la surface d'un arc sans rien changer d'autre. */
export function cleBoite(b: Boite): string {
  const f = b as Boite & {
    angle?: number
    p0?: number
    p1?: number
    p2?: number
    sens?: number
    coupe?: { x: number; y: number; nx: number; ny: number }
  }
  const c = f.coupe ? `${f.coupe.x}/${f.coupe.y}/${f.coupe.nx}/${f.coupe.ny}` : ''
  return `;${b.minX},${b.minY},${b.maxX},${b.maxY},${f.angle ?? 0},${b.material},${b.forme ?? 0},${f.p0 ?? 0},${f.p1 ?? 0},${f.p2 ?? 0},${f.sens ?? 0},${c}`
}

/** La signature de tout ce dont les bouts d'une conduite dépendent : chaque
 *  boîte (cleBoite) et les bornes. Un éditeur qui déplace une boîte SUR
 *  PLACE la change : un cache qui s'y fie ne garde jamais des bouts
 *  périmés. */
export function signatureBoites(boxes: readonly Boite[], bornes: Bornes | null): string {
  let k = bornes ? `${bornes.minX},${bornes.minY},${bornes.maxX},${bornes.maxY}` : '-'
  for (const b of boxes) k += cleBoite(b)
  return k
}

const formesParSalle = new WeakMap<readonly Boite[], { cle: string; formes: readonly Boite[] }>()

/** LES FORMES PHYSIQUES D'UNE SALLE, une fois par état du décor. Le laser
 *  les recalculait à CHAQUE tir (et le générateur en tire des centaines) :
 *  pour chaque conduite, six sondages contre toutes les boîtes, plus une
 *  copie de la liste. Sans conduite, la liste elle-même (rien à changer) ;
 *  avec, la dernière réponse tant que la signature n'a pas bougé. */
export function formesPhysiques<B extends Boite>(boxes: readonly B[], bornes: Bornes | null): readonly B[] {
  if (!boxes.some(aPieces)) return boxes
  const cle = signatureBoites(boxes, bornes)
  const c = formesParSalle.get(boxes)
  if (c && c.cle === cle) return c.formes as readonly B[]
  const formes = boxes.map((b) => formePhysique(b, boxes, bornes))
  formesParSalle.set(boxes, { cle, formes })
  return formes
}
