// LA POINTE DES OMBRES PORTÉES — où finit l'ombre d'un obstacle.
//
// Le cuiseur de lumière (LIGHT_FS, renderer.ts) marche du sol vers la lampe :
// le rayon monte, et un obstacle plus bas que lui ne l'arrête plus. Cette
// règle était un SEUIL — à l'altitude de l'obstacle, plus rien : l'ombre
// finissait donc sur une coupure nette, et le sol redevenait clair d'un coup
// derrière un mur. Sous un bandeau, cette coupure est une courbe : « des
// choses bizarres, les ombres peut-être, cela fait des sortes d'arcs » (le
// concepteur, 16/11 — sur le nouveau fond, sans trame, elles ressortaient).
//
// Sur sa dernière tranche de hauteur, l'obstacle ombre maintenant DE MOINS
// EN MOINS : on l'éloigne du rayon (on « lève » sa distance), de rien du
// tout jusqu'à la distance où la pénombre vaut la pleine lumière. La pointe
// de l'ombre devient un fondu, comme ses flancs le sont déjà.
import { glslFloat } from './surfacesSculptees'

/** La tranche de hauteur, sous le sommet de l'obstacle, où l'ombre s'efface
 *  (unités monde) : un tiers d'un mur haut (140). */
export const OMBRE_POINTE_MARGE = 46

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** La distance à ajouter à un obstacle de hauteur `h` quand le rayon passe à
 *  l'altitude `alt` : 0 tant qu'il est franchement dessous, puis une part
 *  croissante de `plein` — la distance qui, à cet endroit de la marche, rend
 *  déjà la pleine lumière (t / pen : la pénombre vaut pen · h / t).
 *  POURQUOI `plein` et pas une levée fixe : une levée fixe (220, premier
 *  essai) rendait la pleine lumière dès le début de la marge — la pointe ne
 *  se fondait pas, l'ombre raccourcissait d'un tiers, toujours aussi nette.
 *  Rapportée à `plein`, la lumière monte du bas de la marge au sommet, à
 *  toute distance de l'obstacle. */
export function leveePointe(alt: number, h: number, plein: number): number {
  return plein * smoothstep(h - OMBRE_POINTE_MARGE, h, alt)
}

/** Le jumeau GLSL, pour le cuiseur de lumière. */
export const OMBRE_POINTE_GLSL = `// (ombrePointe.ts : la règle et son jumeau TypeScript)
float leveePointe(float alt, float h, float plein) {
  return plein * smoothstep(h - ${glslFloat(OMBRE_POINTE_MARGE)}, h, alt);
}
`
