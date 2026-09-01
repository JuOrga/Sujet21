// LES VARIANTES DU SHADER DE COMPOSITION — ce qu'un tableau n'utilise pas
// n'a pas à exister dans son shader.
//
// La composition, c'est UN shader de ~1 800 lignes exécuté pour CHAQUE pixel
// de l'écran, à chaque image. Sur un iPad Pro 12,9" à dpr 2 (~5,6 Mpx), cela
// fait ~336 millions d'exécutions par seconde : c'est le poste dominant, et
// la mesure du 29/08 le dit sans ambiguïté (cf. resolution.ts — le coût est
// PROPORTIONNEL au nombre de pixels, sans surcoût fixe : la passe est
// limitée par le remplissage).
//
// Or débrancher une fonctionnalité par un UNIFORME n'allège presque rien :
// le pilote alloue les registres pour le pire cas, l'occupation du GPU reste
// au plancher, et la latence des textures cesse d'être masquée. C'est
// exactement le constat déjà noté dans resolution.ts — « couper l'éclairage
// ou l'éclairage de volume n'y change rien ». Un `if` ne rend pas un
// registre.
//
// Et certains coûts ne peuvent même pas se débrancher. Les prélèvements de
// texture de matériau sont HORS de toute branche, et le shader dit pourquoi :
// « flux de contrôle uniforme requis par les mipmaps ». Sur « L'école des
// parois » — quatre boîtes, aucune plaque froide, aucune chaudière — la
// texture de givre et celle de chaudière sont lues 5,6 millions de fois par
// image pour un résultat que personne ne regarde.
//
// Un `#ifdef`, lui, retire le code : ni instruction, ni prélèvement, ni
// REGISTRE. D'où ce module. Il calcule, pour l'état courant, le MASQUE des
// fonctionnalités réellement utilisées et le prélude `#define` qui va avec ;
// le renderer compile un shader par masque et les garde en cache.
//
// RIEN ICI NE TOUCHE À L'IMAGE. La variante « tout allumé » (MASQUE_TOUT)
// est mot pour mot le shader d'avant, et c'est elle qui sert de repli tant
// qu'une variante spécialisée n'est pas prête. À l'écran, rien ne doit
// bouger — seuls les chiffres changent.

import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
} from '../game/level'

/**
 * Les drapeaux, dans l'ordre des bits du masque.
 *
 * Chacun commande un bloc du shader dont le tableau courant peut n'avoir
 * aucun usage. Un drapeau ne se pose QUE si la fonctionnalité est
 * effectivement employée : sinon le shader spécialisé ne serait pas plus
 * léger que le générique, et le cache se remplirait pour rien.
 */
export const DRAPEAUX = [
  // le sol est l'union des creux des COQUES posées : une boucle sur les 96
  // boîtes, par pixel, rien que pour savoir si l'on est dans une salle
  'AVEC_MODULES',
  // le voile, le liseré et les chevrons des zones d'état : une boucle de 16
  // + la fonction zoneDecor. La plupart des tableaux n'ont aucune zone.
  'AVEC_ZONES',
  // le relief 2.5D des parois : jusqu'à QUATRE évaluations de SDF de plus
  // PAR BOÎTE et par pixel, plus toute la peinture du flanc. Débranché par
  // défaut (render() reçoit relief = 0).
  'AVEC_RELIEF',
  // les nappes de brume d'ambiance : deux octaves de bruit de valeur
  'AVEC_BRUME',
  // l'ombre portée du volume : une marche de 8 pas × jusqu'à 4 lampes, et
  // jusqu'à trois prélèvements du champ par pas — le plus cher du lot
  'AVEC_OMBRE_VOLUME',
  // les textures de matériau. Prélevées hors branche (mipmaps), elles se
  // paient sur TOUT l'écran même si le matériau n'est posé nulle part.
  'AVEC_TEX_PAROI',
  'AVEC_TEX_PHILE',
  'AVEC_TEX_PHOBE',
  'AVEC_TEX_FROID',
  'AVEC_TEX_GRILLE',
  'AVEC_TEX_CHAUD',
] as const

export type Drapeau = (typeof DRAPEAUX)[number]

/** Le masque « tout allumé » : la variante GÉNÉRIQUE. Elle vaut exactement
 * le shader d'avant cette brique, et c'est ce qui rend le repli sûr — tant
 * qu'une variante spécialisée n'est pas liée, c'est elle qui dessine. */
export const MASQUE_TOUT = (1 << DRAPEAUX.length) - 1

/** Le matériau dont la présence commande chaque drapeau de texture. Vérifié
 * sur le shader : chaque `texXC` n'est lue qu'à UN endroit, dans la branche
 * de ce matériau — hors de lui, la valeur ne sert à personne. */
export const MATERIAU_TEXTURE: ReadonlyMap<Drapeau, number> = new Map([
  ['AVEC_TEX_PAROI', MAT_WALL],
  ['AVEC_TEX_PHILE', MAT_HYDROPHILE],
  ['AVEC_TEX_PHOBE', MAT_HYDROPHOBE],
  ['AVEC_TEX_FROID', MAT_FROID],
  ['AVEC_TEX_GRILLE', MAT_GRILLE],
  ['AVEC_TEX_CHAUD', MAT_CHAUD],
] as [Drapeau, number][])

/** L'état dont dépend la variante. Tout y est booléen ou ensemble : la
 * fonction est pure, elle se teste sans GPU. */
export interface EtatCompose {
  /** le sol est fait des COQUES posées (uSolModules) */
  modules: boolean
  /** au moins une zone d'état sur le tableau */
  zones: boolean
  /** relief 2.5D des parois (uRelief > 0) */
  relief: boolean
  /** brume d'ambiance du tableau (uBrume > 0) */
  brume: boolean
  /** le volume baigne dans la lumière de la pièce ET y porte son ombre */
  ombreVolume: boolean
  /** les matériaux RÉELLEMENT posés sur le tableau (boîtes rendues) */
  materiaux: ReadonlySet<number>
  /** les matériaux dont la texture d'habillage est chargée. Une texture qui
   * n'est pas encore arrivée laisse le décor procédural en place : la
   * prélever ne servirait à rien — et son arrivée change le masque, donc
   * fait cuire la bonne variante. */
  texturesPretes: ReadonlySet<number>
}

/** Le masque de l'état courant : un bit par drapeau réellement utile. */
export function masqueCompose(etat: EtatCompose): number {
  let masque = 0
  const pose = (drapeau: Drapeau, actif: boolean): void => {
    if (actif) masque |= 1 << DRAPEAUX.indexOf(drapeau)
  }
  pose('AVEC_MODULES', etat.modules)
  pose('AVEC_ZONES', etat.zones)
  pose('AVEC_RELIEF', etat.relief)
  pose('AVEC_BRUME', etat.brume)
  pose('AVEC_OMBRE_VOLUME', etat.ombreVolume)
  for (const [drapeau, materiau] of MATERIAU_TEXTURE)
    pose(
      drapeau,
      etat.materiaux.has(materiau) && etat.texturesPretes.has(materiau),
    )
  return masque
}

/**
 * Le même masque, tous les drapeaux de TEXTURE éteints.
 *
 * C'est la sonde ?sonde=santex. Le shader prend alors la branche
 * procédurale de chaque matériau — pas un seul prélèvement de texture de
 * matériau — et TOUT LE RESTE est identique : même boucle, mêmes boîtes,
 * même eau, mêmes couches.
 *
 * Elle tranche ce que deux mesures ont laissé ouvert. Le profil dit que
 * ces prélèvements coûtent 18 ms des 40 (arret3 : 45 im/s ; arret6 : 25).
 * Mais les déplacer dans la branche de leur matériau — donc les payer
 * beaucoup plus rarement — n'a rien rendu. Deux lectures possibles : ou
 * bien ils s'exécutent encore presque partout (dans un groupe de pixels,
 * il suffit d'UN voisin sur une paroi pour que tout le groupe paie), ou
 * bien leur coût ne tient pas au nombre d'exécutions. Les retirer
 * COMPLÈTEMENT sépare les deux.
 */
export function masqueSansTextures(masque: number): number {
  let sortie = masque
  for (const drapeau of MATERIAU_TEXTURE.keys())
    sortie &= ~(1 << DRAPEAUX.indexOf(drapeau))
  return sortie
}

/** Le nom du jumeau utilisable DANS une expression : `AVEC_RELIEF` →
 * `SI_RELIEF`. Deux formes pour deux besoins — `#ifdef` retire une
 * déclaration ou un bloc entier, `SI_*` s'écrit au milieu d'un ternaire
 * sans couper l'expression en deux. */
export function nomSi(drapeau: Drapeau): string {
  return `SI_${drapeau.slice('AVEC_'.length)}`
}

/** Le prélude `#define` d'un masque.
 *
 * Les deux formes sortent d'ICI, du même booléen : c'est ce qui interdit
 * qu'elles divergent. Un `#ifdef AVEC_RELIEF` qui retirerait le calcul
 * pendant qu'un `SI_RELIEF` resté vrai le lirait quand même ne compilerait
 * même pas — mais l'inverse (le calcul gardé, la lecture éteinte) passerait
 * en silence et coûterait cher pour rien. */
export function prelude(masque: number): string {
  const lignes: string[] = []
  DRAPEAUX.forEach((drapeau, bit) => {
    const actif = (masque & (1 << bit)) !== 0
    if (actif) lignes.push(`#define ${drapeau} 1`)
    lignes.push(`const bool ${nomSi(drapeau)} = ${actif ? 'true' : 'false'};`)
  })
  return `${lignes.join('\n')}\n`
}

/** La source d'une variante : le prélude glissé JUSTE APRÈS la directive de
 * version, qui doit rester la toute première ligne du fichier (GLSL ES 3.00
 * le refuse ailleurs).
 *
 * `arret` n'est pas un drapeau : c'est LA SONDE DE PROFIL (?sonde=arret1..5),
 * qui arrête main() à la fin d'un bloc pour en mesurer le coût marginal.
 * Elle ne sert jamais au jeu — 0 la laisse dormir. */
export function sourceVariante(
  source: string,
  masque: number,
  arret = 0,
  boitesNu = false,
): string {
  const fin = source.indexOf('\n')
  const marche =
    (arret > 0 ? `#define SONDE_ARRET ${arret}\n` : '') +
    (boitesNu ? '#define SONDE_BOITES_NU 1\n' : '')
  return `${source.slice(0, fin + 1)}${marche}${prelude(masque)}${source.slice(fin + 1)}`
}
