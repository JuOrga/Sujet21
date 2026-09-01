// LA STATION : la carte globale du jeu, et le BIOME de chaque tronçon.
//
// La bible le demande depuis le début (docs/scenario.md) : « chaque tableau
// EST un module ou une parcelle de module », « on doit reconnaître la
// station comme on reconnaît l'ISS sur une infographie ». Jusqu'ici la
// descente était une SUITE — un rail de crans sur le flanc droit — et le
// joueur ne traversait aucun LIEU. Ce fichier donne le lieu : six modules
// amarrés à une poutre, qu'on parcourt de gauche à droite au fil de la run.
//
// POURQUOI SIX, et pas cinq ni sept. Six se coupe par DEUX comme par
// TROIS : à douze salles on avance d'un module toutes les deux, à dix-huit
// toutes les trois, et dans les deux cas les tiers de la descente (début ·
// milieu · fin) tombent EXACTEMENT sur une frontière de module — deux
// modules par moment. Aucun autre compte ne donne les trois à la fois.
// Une longueur multiple de six est donc la bonne longueur ; les autres
// marchent (le découpage reste proportionnel) mais laissent des modules
// plus courts que d'autres, et le joueur le sent.
//
// UN MODULE EST UN BIOME. Ce n'est pas une vignette sur un plan : c'est un
// ensemble de salles qui partagent une matière et une leçon — les serres
// collent, les cryobaies figent, le bloc thermique vaporise. La progression
// des mécaniques du plan (eau, puis glace, puis vapeur, puis tout) et la
// traversée de la station sont la MÊME montée, vue d'un cran plus haut.

import type { CodeAtelier } from './levelIO'

/** La géométrie d'un module sur le plan (repère du plan, cf. PLAN_LARGEUR). */
export interface BoiteModule {
  x: number
  y: number
  w: number
  h: number
}

export interface ModuleStation {
  id: string
  /** le nom sur le plan, en capitales */
  nom: string
  /** ce qu'on y fait, en trois mots */
  soustitre: string
  /** la phrase du module — le ton du biome */
  ambiance: string
  /** la teinte, prise dans le langage de couleur du jeu (cf. carte.ts) */
  teinte: string
  /** le moment de la descente auquel ce module appartient */
  moment: CodeAtelier['moment']
  /** la mécanique que le biome demande (0 aucune · 1 glace · 2 vapeur · 3 toutes) */
  mecanique: CodeAtelier['mecanique']
  /** les surfaces qui font la matière du biome, en mots de joueur */
  matieres: readonly string[]
  boite: BoiteModule
}

/** Le repère du plan : tout le dessin tient dans ce rectangle. */
export const PLAN_LARGEUR = 1280
export const PLAN_HAUTEUR = 600

const AXE = 300 // l'axe des modules pressurisés
const H = 86 // la hauteur d'un fût de module

/** LE HUB : le module d'accueil, en tête de station. Il n'appartient pas à
 *  la descente (on n'y compte ni rang ni record) — il ouvre le plan. */
export const MODULE_HUB: ModuleStation = {
  id: 'meduse',
  nom: 'MÉDUSE',
  soustitre: 'module d’accueil',
  ambiance:
    'La cuve où vous êtes né, l’aile des endormis, le comptoir. On y revient entre deux descentes ; on n’y risque rien.',
  teinte: '#8fd8b0',
  moment: 1,
  mecanique: 0,
  matieres: ['la cuve', 'le bac d’essai', 'le comptoir'],
  boite: { x: 46, y: AXE - H / 2 - 8, w: 150, h: H + 16 },
}

/** LES SIX MODULES DE LA DESCENTE, dans l'ordre de la traversée. La
 *  progression des matières suit celle des mécaniques du plan : l'eau
 *  seule, puis ce qui colle, puis le froid, puis le souffle, puis la
 *  chaleur, puis tout à la fois. */
export const MODULES: readonly ModuleStation[] = [
  {
    id: 'amarrage',
    nom: 'LE NŒUD D’AMARRAGE',
    soustitre: 'sas et carrefours',
    ambiance:
      'Des coques nues et des angles. Rien n’y colle, rien n’y gèle : on y apprend à pousser, à viser, et à ne pas se cogner pour rien.',
    teinte: '#63b7e6',
    moment: 1,
    mecanique: 0,
    matieres: ['parois nues', 'surfaces hydrophobes'],
    boite: { x: 236, y: AXE - H / 2, w: 138, h: H },
  },
  {
    id: 'serres',
    nom: 'LES SERRES',
    soustitre: 'hydroponie',
    ambiance:
      'Tout y retient. Les parois mouillées vous gardent, les membranes vous laissent suinter — s’arracher coûte une impulsion, alors on vise avant de partir.',
    teinte: '#2e8f6a',
    moment: 1,
    mecanique: 0,
    matieres: ['surfaces hydrophiles', 'membranes', 'gouttières'],
    boite: { x: 400, y: AXE - H / 2, w: 138, h: H },
  },
  {
    id: 'cryobaies',
    nom: 'LES CRYOBAIES',
    soustitre: 'conservation',
    ambiance:
      'Le froid y est partout, et il ne demande pas la permission. Ce qui s’attarde gèle et se soude ; ce qui a gelé exprès traverse les rideaux d’un bloc.',
    teinte: '#6fb7d8',
    moment: 2,
    mecanique: 1,
    matieres: ['plaques froides', 'rideaux lamellaires', 'dépôts de givre'],
    boite: { x: 564, y: AXE - H / 2, w: 138, h: H },
  },
  {
    id: 'ferme',
    nom: 'LA FERME',
    soustitre: 'poutre et dehors',
    ambiance:
      'La partie non pressurisée : des grilles, des évents, et le vide au bout. Seul le souffle passe les barreaux — le reste attend de l’autre côté.',
    teinte: '#7f9dc0',
    moment: 2,
    mecanique: 2,
    matieres: ['grilles', 'évents', 'conduits'],
    boite: { x: 728, y: AXE - H / 2, w: 138, h: H },
  },
  {
    id: 'thermique',
    nom: 'LE BLOC THERMIQUE',
    soustitre: 'chaudières',
    ambiance:
      'L’endroit le plus chaud de la station, et le dernier à s’éteindre. On y refait ses dashs de borne en borne, et la vapeur perdue perle plus loin, sur le froid.',
    teinte: '#c06a32',
    moment: 3,
    mecanique: 2,
    matieres: ['chaudières', 'surchauffeurs', 'conduites brûlantes'],
    boite: { x: 892, y: AXE - H / 2, w: 138, h: H },
  },
  {
    id: 'secteur-4',
    nom: 'LE SECTEUR 4',
    soustitre: 'ce qui doit partir',
    ambiance:
      'Scellé depuis l’accident. Des rails de champ, un convoyeur, et une porte qui ne s’ouvre qu’une fois tout raconté. Au bout : là-haut.',
    teinte: '#c99aff',
    moment: 3,
    mecanique: 3,
    matieres: ['rails de champ', 'le convoyeur', 'le sas scellé'],
    boite: { x: 1056, y: AXE - H / 2 - 6, w: 150, h: H + 12 },
  },
]

/** Le nombre de cases de la station — six, et le commentaire de tête dit
 *  pourquoi : c'est le seul compte qui se coupe par deux ET par trois. */
export const CASES = MODULES.length

/** LA POUTRE et ses panneaux : la silhouette qui fait reconnaître une
 *  station. Elle croise la file des modules en son milieu, comme sur l'ISS,
 *  et ne porte aucune salle — c'est du décor, et c'est assumé. */
export const POUTRE = { x: 689, y: 78, w: 14, h: 496 }
// Les panneaux du BAS descendent plus bas qu'il n'y paraît nécessaire, et
// c'est mesuré : la bande 350-410 porte les étiquettes des modules, et un
// panneau posé à 382 recouvrait « conservation » sous les cryobaies.
export const PANNEAUX: readonly BoiteModule[] = [
  { x: 591, y: 86, w: 210, h: 62 },
  { x: 591, y: 156, w: 210, h: 62 },
  { x: 591, y: 434, w: 210, h: 62 },
  { x: 591, y: 504, w: 210, h: 62 },
]
/** Les radiateurs : plus petits, plus clairs, perpendiculaires à la poutre. */
// Les hauteurs ne sont pas libres : la bande 350-400 porte les ÉTIQUETTES
// des modules (nom sur deux lignes, puis sous-titre). Un radiateur posé là
// se lisait comme un module sans nom — mesuré au banc, il recouvrait
// « LE BLOC THERMIQUE ». Ils encadrent donc la file, sans jamais l'écrire.
export const RADIATEURS: readonly BoiteModule[] = [
  { x: 470, y: 196, w: 104, h: 26 },
  { x: 470, y: 428, w: 104, h: 26 },
  { x: 818, y: 196, w: 104, h: 26 },
  { x: 818, y: 428, w: 104, h: 26 },
]

/** LE PAS RÉGULIER : combien de salles par module, quand la longueur se
 *  coupe juste. Null quand elle ne tombe pas sur un multiple de six — le
 *  découpage reste proportionnel, mais l'écran ne doit pas annoncer un
 *  chiffre rond qui serait faux. */
export function pasRegulier(longueur: number): number | null {
  return longueur > 0 && longueur % CASES === 0 ? longueur / CASES : null
}

/** LE MODULE d'un rang (1-based) : la répartition est proportionnelle, donc
 *  juste quelle que soit la longueur — et exacte quand elle est multiple de
 *  six. Hors descente (rang 0), on est au hub : la fonction rend 0. */
export function caseDuRang(rang: number, longueur: number): number {
  if (rang <= 0 || longueur <= 0) return 0
  return Math.max(1, Math.min(CASES, Math.ceil((rang * CASES) / longueur)))
}

/** Les rangs que couvre une case (1-based, bornes incluses). */
export function rangsDeCase(
  c: number,
  longueur: number,
): { premier: number; dernier: number } {
  const i = Math.max(1, Math.min(CASES, Math.round(c)))
  return {
    premier: Math.floor(((i - 1) * longueur) / CASES) + 1,
    dernier: Math.floor((i * longueur) / CASES),
  }
}

/** Le module d'un rang — le hub quand la descente n'a pas commencé. */
export function moduleDuRang(rang: number, longueur: number): ModuleStation {
  const c = caseDuRang(rang, longueur)
  return c === 0 ? MODULE_HUB : MODULES[c - 1]
}

/** L'ÉTAT d'un module pour le plan : franchi, courant, ou à venir. Le rang
 *  passé est celui des salles FRANCHIES (voieRang) — la salle en cours est
 *  donc la suivante, et c'est elle qui donne le module courant. */
export type EtatModule = 'franchi' | 'courant' | 'avenir'

export function etatModule(
  index: number,
  rangCourant: number,
  longueur: number,
): EtatModule {
  const c = caseDuRang(rangCourant, longueur)
  const i = index + 1
  if (c === 0) return 'avenir'
  if (i < c) return 'franchi'
  return i === c ? 'courant' : 'avenir'
}
