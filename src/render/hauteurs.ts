// LES DEUX HAUTEURS DU CALCUL D'OMBRE, dans un petit module sans dépendance :
// le renderer les ré-exporte, volume.ts et ses tests les lisent ici sans
// tirer tout le moteur WebGL. Elles doublent les #define des shaders —
// lumiere.spec.ts vérifie qu'elles ne dérivent pas.
export const HAUTEUR_BLOCS = 140
export const HAUTEUR_COQUE = 2400
// La hauteur du CORPS : celle de son ombre portée (ombreVolume) et, relief
// allumé, celle dont son dessus glisse comme celui des parois — plus bas
// qu'un mur haut, il n'en recouvre que les deux tiers de la tranche.
export const HAUTEUR_CORPS = 95
