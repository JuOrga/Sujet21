// ÉCRIT PAR tools/images/materiel.py — ne pas retoucher à la main.
// Le rectangle de chaque pièce du matériel de coque dans l’atlas
// (public/assets/coque-materiel.webp), en fraction de l’atlas, origine
// en HAUT à gauche comme l’image ; `rapport` = largeur / hauteur de la
// pièce recadrée. null : pas d’image, le shader la trace lui-même.
// L’ordre est celui des constantes PIECE_* de compositionCoque.ts.

export interface RectAtlas {
  u0: number
  v0: number
  u1: number
  v1: number
  rapport: number
}

export const ATLAS_COQUE: readonly (RectAtlas | null)[] = [
  { u0: 0.00000, v0: 0.00000, u1: 0.68359, v1: 0.32227, rapport: 2.1220 }, // 0 aile
  { u0: 0.68848, v0: 0.00000, u1: 0.84570, v1: 0.39062, rapport: 0.4023 }, // 1 radiateur
  { u0: 0.00000, v0: 0.39551, u1: 0.34717, v1: 0.73730, rapport: 1.0157 }, // 2 parabole
  { u0: 0.35205, v0: 0.39551, u1: 0.57227, v1: 0.88379, rapport: 0.4509 }, // 3 amarrage
  { u0: 0.57715, v0: 0.39551, u1: 0.66406, v1: 0.85938, rapport: 0.1873 }, // 4 treillis
  null, // 5 propulseurs : pas d’image, tracée par le shader
  null, // 6 feu : pas d’image, tracée par le shader
]
