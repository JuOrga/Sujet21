// LA GRILLE D'UNE ÉPONGE, tirée du rectangle qu'on lui donne.
//
// Une éponge est une grille de cellules CARRÉES (SpongeDef : cols × rows ×
// cellSize) : c'est la cellule qui boit, se gorge puis durcit. L'éditeur
// posait toujours des cellules de 24 u et arrondissait le rectangle tracé
// au multiple de 24 le plus proche — or tout le reste se cale sur la
// grille de l'éditeur (20 u). L'éponge sautait donc par paliers à elle,
// débordait ou rentrait en deçà du trait, et ne s'alignait jamais sur la
// paroi voisine (le concepteur, 27/11 : « l'éponge fonctionne par carrés
// de 6 unités, alors que tout le reste ne fonctionne pas comme cela »).
//
// On choisit désormais la cellule d'après le rectangle : la plus grande
// qui le pave EXACTEMENT, entre CELLULE_MIN et CELLULE_MAX. Sur la grille
// de 20, c'est 20 u, toujours : l'éponge tombe pile sur le trait, comme
// une paroi. Ce n'est qu'à main levée, sur des côtés sans diviseur commun
// raisonnable, qu'on retombe sur l'ancien arrondi.

/** La cellule la plus fine qu'on choisisse seul : en deçà, une éponge de
 *  taille moyenne compterait des centaines de cellules d'une particule. */
export const CELLULE_MIN = 8
/** La plus grande : la cellule historique du jeu, que les salles livrées
 *  emploient — au-delà, une cellule gorgée ouvrirait une brèche trop grosse. */
export const CELLULE_MAX = 24

export interface GrilleEponge {
  cols: number
  rows: number
  cellSize: number
}

function pgcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

/** La grille d'une éponge de `w` × `h` (en unités du monde). `actuelle` :
 *  la cellule qu'elle a déjà — gardée si elle pave encore le rectangle,
 *  pour ne pas défaire un réglage du concepteur. */
export function grilleEponge(w: number, h: number, actuelle?: number): GrilleEponge {
  const lw = Math.max(1, Math.round(w))
  const lh = Math.max(1, Math.round(h))
  if (actuelle && Number.isInteger(actuelle) && actuelle >= 4 && lw % actuelle === 0 && lh % actuelle === 0) {
    return { cols: lw / actuelle, rows: lh / actuelle, cellSize: actuelle }
  }
  const g = pgcd(lw, lh)
  for (let c = Math.min(CELLULE_MAX, g); c >= CELLULE_MIN; c--) {
    if (g % c === 0) return { cols: lw / c, rows: lh / c, cellSize: c }
  }
  // aucun pavage exact (côtés tracés à main levée) : l'ancien arrondi
  const c = actuelle && actuelle >= 4 ? actuelle : CELLULE_MAX
  return {
    cols: Math.max(1, Math.round(lw / c)),
    rows: Math.max(1, Math.round(lh / c)),
    cellSize: c,
  }
}
