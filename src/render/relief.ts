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

// La hauteur VUE des solides en mode oblique, en unités monde. Ce n'est pas
// HAUTEUR_BLOCS (140, la hauteur des ombres) : vue sous une inclinaison
// d'une vingtaine de degrés, une paroi de 140 ne décale son sommet que
// d'une cinquantaine d'unités. Plus, et les murs minces (un dixième des
// boîtes posées font 40 u d'épaisseur ou moins) laissent un jour entre
// leur base et leur sommet ; c'est aussi ce qui garde l'eau lisible
// derrière un mur. Les coques suivent la même hauteur vue : à leurs 2 400
// u, elles recouvriraient la salle entière.
export const HAUTEUR_VUE_OBLIQUE = 56

// D'où regarde la caméra : l'angle du décalage du sommet, en degrés depuis
// l'axe +x du monde (+y monte à l'écran). 75° : le sommet monte et glisse
// un peu vers la droite — la caméra est au sud, un rien à l'ouest. Bien
// droit (90°), les parois verticales ne montraient aucun flanc et la vue
// paraissait simplement écrasée ; de biais, les deux familles de faces se
// lisent.
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
 *  l'identique. Il s'efface sous le zoom de carte : le plan large reste
 *  une carte, vue d'aplomb. */
export function decalageSommet(
  p: ParametresRelief,
  x: number,
  y: number,
  centreX: number,
  centreY: number,
  zoom: number,
): { x: number; y: number } {
  const fondu = Math.min(1, Math.max(0, zoom * 1.2))
  if (p.decalX !== 0 || p.decalY !== 0) return { x: p.decalX * fondu, y: p.decalY * fondu }
  return { x: (x - centreX) * p.k * fondu, y: (y - centreY) * p.k * fondu }
}
