// LE RELIEF DES PAROIS — où se pose le SOMMET d'un solide.
//
// Chaque solide a une hauteur. Le shader de composition dessine sa base à
// sa place, son sommet DÉCALÉ, et la tranche entre les deux : c'est tout le
// relief 2.5D. Ce qui change d'un mode à l'autre, c'est seulement le
// décalage du sommet — d'où vient la caméra.
//
//   RADIAL (léger, fort) : la caméra est au ZÉNITH, juste au-dessus du
//     centre de l'écran. Le sommet fuit le centre, proportionnellement à
//     l'écart : on aperçoit les flancs des éléments qu'on aborde, et chacun
//     montre un côté différent selon où il est.
//   OBLIQUE : la caméra est « un peu sur le côté » — au sud, un rien à
//     l'ouest, inclinée vers la salle. Le décalage est le MÊME partout :
//     toutes les parois montrent leur face sud, comme dans une vue de trois
//     quarts. C'est une projection CAVALIÈRE : le sol n'est pas déformé,
//     donc la visée, la physique, les tracés par-dessus le jeu et l'éditeur
//     ne changent pas d'une virgule — seule l'image des parois change.
//
// Ce module est le JUMEAU du GLSL de renderer.ts (relDisp), comme fusion.ts
// l'est du sien : la même formule, testée ici, là où un shader ne se teste
// pas.

export type ModeRelief = 'off' | 'leger' | 'fort' | 'oblique'

// La hauteur VUE des solides en mode oblique, en unités monde : celle des
// ombres, HAUTEUR_BLOCS (140), vue à 45°. LE PREMIER RÉGLAGE (56 u, fondu
// sous le zoom de carte comme le radial) NE SE VOYAIT PAS : au zoom de jeu
// (~0,14 px/u), le fondu n'en laissait que 17 % — un pixel à l'écran. À
// 140 u et sans fondu, le sommet glisse d'une vingtaine de pixels en jeu.
// Les coques suivent la même hauteur vue : à leurs 2 400 u d'ombre, elles
// recouvriraient la salle entière.
export const HAUTEUR_VUE_OBLIQUE = 140

// La tranche (le flanc entre la base et le sommet) s'échantillonne en ce
// nombre de pas — le même chiffre que pasTranche dans le shader. Un pas
// plus large qu'un mur y ouvrirait un jour : 14 u, sous les 40 u d'une
// coque ordinaire (EP_DEFAUT).
export const PAS_TRANCHE_OBLIQUE = 10

// D'où regarde la caméra : l'angle du décalage du sommet, en degrés depuis
// l'axe +x du monde (+y monte à l'écran). 75° : le sommet monte et glisse
// un peu vers la droite — la caméra est au sud, un rien à l'ouest. Bien
// droit (90°), les parois verticales ne montreraient aucun flanc ; de
// biais, les deux familles de faces se lisent.
export const ANGLE_OBLIQUE_DEG = 75

export interface ParametresRelief {
  /** Coefficient du décalage RADIAL (0 : pas de relief radial). */
  k: number
  /** Décalage FIXE du sommet, en unités monde ; non nul : mode oblique. */
  decalX: number
  decalY: number
}

const RADIAL: Record<'off' | 'leger' | 'fort', number> = { off: 0, leger: 0.035, fort: 0.07 }

/** Les uniformes du relief pour un mode. En oblique, `k` vaut 1 : il sert
 *  d'interrupteur au shader (uRelief > 0 branche la tranche), le décalage
 *  lui-même vient alors de decalX/decalY. */
export function parametresRelief(mode: ModeRelief): ParametresRelief {
  if (mode === 'oblique') {
    const a = (ANGLE_OBLIQUE_DEG * Math.PI) / 180
    return {
      k: 1,
      decalX: HAUTEUR_VUE_OBLIQUE * Math.cos(a),
      decalY: HAUTEUR_VUE_OBLIQUE * Math.sin(a),
    }
  }
  return { k: RADIAL[mode] ?? 0, decalX: 0, decalY: 0 }
}

/** Le décalage du sommet au point `x, y` du monde — relDisp du shader, à
 *  l'identique. Le RADIAL s'efface sous le zoom de carte ; l'OBLIQUE ne
 *  s'efface jamais : c'est une caméra inclinée, pas un effet de près. */
export function decalageSommet(
  p: ParametresRelief,
  x: number,
  y: number,
  centreX: number,
  centreY: number,
  zoom: number,
): { x: number; y: number } {
  if (p.decalX !== 0 || p.decalY !== 0) return { x: p.decalX, y: p.decalY }
  const fondu = Math.min(1, Math.max(0, zoom * 1.2))
  return { x: (x - centreX) * p.k * fondu, y: (y - centreY) * p.k * fondu }
}
