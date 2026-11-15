// LE RELIEF 2.5D DES PAROIS, RÉPARÉ (volume des parois, volet 1) — les
// règles pures. Le shader de composition en reçoit le jumeau GLSL
// (RELIEF_PAROIS_GLSL, généré ici) ; reliefParois.spec.ts tient les deux.
//
// Le relief allumé, le SOMMET de chaque solide fuit le centre de l'écran
// (le dessus d'une paroi haute est plus près de l'œil que son pied) et la
// tranche se révèle du côté qui regarde le centre. La physique, elle, reste
// sur la BASE : c'est au pied que le fluide touche. Trois choses en
// découlent, que le relief d'avant ignorait :
//  - la longueur du flanc suit la hauteur de l'élément (volume.ts) : une
//    plaque basse ne se dresse pas comme un mur ;
//  - là où le sommet déplacé recouvre le sol au-delà du pied, ce sol ne se
//    voit plus — ni le fluide qui touche le pied, ni ce qui se pose au sol ;
//  - ce qui est plaqué sur un dessus (les décalques d'un mur) suit son sommet.
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

/** Le relief s'efface au zoom de carte (en dessous de ~0,8) : de loin, des
 *  sommets qui glissent donneraient le mal de mer. La même formule que le
 *  shader (`clamp(uZoom * 1.2, 0, 1)`). */
export function fonduRelief(zoom: number): number {
  return Math.min(Math.max(zoom * 1.2, 0), 1)
}

/** La fraction `f` dont le sommet d'un solide de hauteur `h` s'écarte du
 *  centre de l'écran : le shader montre, au point `w` de l'écran, le sommet
 *  du point `c + (w − c)(1 − f)` de la base (`k` : RELIEF_K, main.ts). */
export function fractionSommet(k: number, zoom: number, h: number): number {
  return k * fonduRelief(zoom) * facteurRelief(h)
}

/** Où se voit, relief allumé, le point (x, y) du DESSUS d'un solide : la
 *  réciproque de la règle du shader. Un décalque plaqué sur le mur y pose
 *  ses sommets ; f = 0 le laisse où il est. */
export function pointDuSommet(
  x: number,
  y: number,
  cx: number,
  cy: number,
  f: number,
): [number, number] {
  const s = 1 / (1 - f)
  return [cx + (x - cx) * s, cy + (y - cy) * s]
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Le SOL QUE LE SOLIDE CACHE, 0..1, en un pixel : `d` la distance signée à
 *  la base, `dV` au sommet déplacé, `flanc` la tranche peinte ici (0..1),
 *  `w` le fondu d'un pixel. UNE règle : un dessus opaque cache ce qui est
 *  dessous.
 *  - Partout où le dessus couvre le pixel, le sol est caché — au-delà du
 *    pied du côté où il déborde (le fluide qui touche le pied passe dessous),
 *    et sur la base aussi. Un solide étanche n'y contient rien (seule la
 *    lisière des splats y déborde) ; un PERMÉABLE (membrane, évent, rideau)
 *    y laisse passer le fluide, qui entre sous le dessus et ressort au-delà
 *    du débord, sans couture. (La première règle ne cachait la base que du
 *    côté du débord : le fluide qui traversait une membrane s'arrêtait net au
 *    milieu de son dessus — vu au banc, tableau 9, relecture R4.)
 *  - Hors de la base, la tranche est peinte (une face latérale vue de
 *    biais) : le sol derrière elle est caché.
 *  - Côté où le pied se voit (la tranche sur la base, d ≤ 0, hors du dessus),
 *    rien n'est caché : le fluide y touche le bas du flanc.
 *  Ne se calcule que relief allumé (le shader la garde sous uRelief > 0) :
 *  relief éteint, rien ne change. */
export function solCache(d: number, dV: number, flanc: number, w: number): number {
  const sommet = 1 - smoothstep(-w, 0, dV)
  const tranche = d > 0 ? flanc : 0
  return Math.max(sommet, tranche)
}

/** Les deux règles en GLSL, pour le shader de composition. */
export const RELIEF_PAROIS_GLSL = `// (reliefParois.ts : les règles et leur jumeau TypeScript)
float facteurRelief(float h) {
  return clamp(h, 0.0, ${glslFloat(HAUTEUR_BLOCS)}) / ${glslFloat(HAUTEUR_BLOCS)};
}
float solCache(float d, float dV, float flanc, float w) {
  float sommet = 1.0 - smoothstep(-w, 0.0, dV);
  return max(sommet, d > 0.0 ? flanc : 0.0);
}
`
