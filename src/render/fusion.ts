// LA FUSION DES SILHOUETTES — la règle, en clair et testable.
//
// LE DÉFAUT qu'elle corrige : chaque solide peignait son liseré sur TOUTE sa
// silhouette, y compris la part ENTERRÉE sous un autre. Or le modulaire
// repose sur le recouvrement — « on empile des formes et le passage
// apparaît » (structures.ts) : une chambre et un couloir qui se chevauchent
// montraient donc leurs deux bords se couper en travers, au lieu de ne faire
// qu'une seule silhouette.
//
// LA RÈGLE : un liseré ne se peint QUE là où aucun autre solide ne recouvre
// le point. Deux formes qui se chevauchent ne rendent alors que le contour
// de leur union — elles ont l'air fusionnées, sans qu'aucune géométrie ne
// change. Le REMPLISSAGE, lui, n'est pas touché : il obéit toujours à
// l'ordre de peinture (le dernier solide est dessus), et c'est cet ordre que
// l'éditeur règle — voir `ordre.ts`.
//
// Ce module est le JUMEAU du GLSL de renderer.ts, comme formes.ts l'est du
// sien : les mêmes formules, à l'identique. Il ne tourne pas dans la boucle
// de rendu — il sert à ÉNONCER la règle et à la tenir sous tests, là où un
// shader ne se teste pas.

/** `smoothstep` de GLSL, à l'identique. */
export function smoothstep(bord0: number, bord1: number, x: number): number {
  if (bord0 === bord1) return x < bord0 ? 0 : 1
  const t = Math.min(1, Math.max(0, (x - bord0) / (bord1 - bord0)))
  return t * t * (3 - 2 * t)
}

/** LE PLUS INTÉRIEUR des solides en ce point : celui dont la distance signée
 *  est la plus petite (la plus négative). `i` vaut -1 sur une liste vide.
 *  À égalité, le PREMIER gagne — la boucle du shader n'écrase que sur un
 *  strictement plus petit, et les deux doivent dire la même chose. */
export function plusInterieur(distances: readonly number[]): {
  i: number
  d: number
} {
  let i = -1
  let d = 1e9
  for (let k = 0; k < distances.length; k++) {
    if (distances[k] < d) {
      d = distances[k]
      i = k
    }
  }
  return { i, d }
}

/** Ce qui reste du liseré du solide `bi` : 1 il se peint entier, 0 il est
 *  enterré sous un autre. Le fondu sur `edgeW` — et non un seuil net —
 *  évite l'escalier là où le bord plonge sous son voisin.
 *
 *  `iCouv` / `dCouv` : le plus intérieur des solides en ce point. Quand
 *  c'est `bi` lui-même, personne ne le recouvre : son liseré passe entier. */
export function lisereLibre(
  bi: number,
  iCouv: number,
  dCouv: number,
  edgeW: number,
): number {
  if (iCouv < 0 || iCouv === bi) return 1
  return smoothstep(-edgeW, 0, dCouv)
}
