// LE RELIEF 2.5D DES PAROIS, RÉPARÉ (volume des parois, volet 1) — les
// règles pures. Le shader de composition en reçoit le jumeau GLSL
// (RELIEF_PAROIS_GLSL, généré ici) ; reliefParois.spec.ts tient les deux.
//
// Le relief allumé, le SOMMET de chaque solide fuit le centre de l'écran
// (le dessus d'une paroi haute est plus près de l'œil que son pied) et la
// tranche se révèle du côté qui regarde le centre. La physique, elle, reste
// sur la BASE : c'est au pied que le fluide touche. Ce que le relief d'avant
// ignorait :
//  - la longueur du flanc suit la hauteur de l'élément (volume.ts) : une
//    plaque basse ne se dresse pas comme un mur.
import { HAUTEUR_BLOCS } from './hauteurs'
import { glslFloat } from './surfacesSculptees'

/** La part du déplacement que prend le sommet d'un solide de hauteur `h` :
 *  sa hauteur sur celle d'un mur haut. Le mur haut (HAUTEUR_BLOCS) garde le
 *  flanc d'avant ; un hydro moyen n'en prend que 90/140, une plaque basse
 *  40/140. Bornée au mur haut, comme la coque l'est pour l'image (volume.ts :
 *  hauteurPropre) — sinon une cloison de modules (2400) jaillirait de
 *  l'écran. */
export function facteurRelief(h: number): number {
  return Math.min(Math.max(h, 0), HAUTEUR_BLOCS) / HAUTEUR_BLOCS
}

/** La règle en GLSL, pour le shader de composition. */
export const RELIEF_PAROIS_GLSL = `// (reliefParois.ts : la règle et son jumeau TypeScript)
float facteurRelief(float h) {
  return clamp(h, 0.0, ${glslFloat(HAUTEUR_BLOCS)}) / ${glslFloat(HAUTEUR_BLOCS)};
}
`
