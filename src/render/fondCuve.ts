// LE FOND DE CUVE — la dalle que le shader répète derrière le tableau.
//
// Jusqu'au 16/11, un carreau de 900 unités : un tableau standard (2400 ×
// 1500) le voyait presque trois fois en largeur, et son hublot quatre à six
// fois — « très basique, répliqué » (le concepteur). La dalle couvre
// maintenant un tableau standard entier : trois carreaux sur deux
// (tools/images/blender/fond_cuve.py), une baie par équipement, aucun en
// double. Un tableau plus grand la répète, sans couture (elle se raccorde
// par construction, comme l'ancien carreau).

/** L'étendue de la dalle, en unités du monde (largeur, hauteur). */
export const FOND_DALLE: readonly [number, number] = [2700, 1800]
