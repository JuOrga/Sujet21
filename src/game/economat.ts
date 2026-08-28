// L'ÉCONOMAT : la salle-boutique de la run — le Charon de l'espace.
// Derrière une grille, un AUTRE — un Semblable, le Sujet 12 — troque
// contre du CONDENSAT : la matière que le laboratoire confisquera de
// toute façon à la purge. Lui, au moins, rend quelque chose.
//
// La salle S'INTERCALE une fois par run, à mi-descente, et compte comme
// un arrêt normal — mais son sas NE COLLECTE RIEN (pas de records, pas de
// cérémonie : on reprend la descente, la bourse en poche). Les achats se
// font AU CONTACT : le corps se glisse dans une alcôve de l'étal, le prix
// se débite, l'effet s'applique.

import {
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_WALL,
  type LevelDef,
  type ObstacleBox,
} from './level'
import { FORME_CAPSULE } from './formes'

function box(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  material: number,
  skin?: number,
): ObstacleBox {
  return skin
    ? { minX, minY, maxX, maxY, material, skin }
    : { minX, minY, maxX, maxY, material }
}

export const CODE_ECONOMAT = 'ECO'

/** Cette salle est-elle l'Économat ? (le sas y est un passage, pas un
 * collecteur — et rien ne s'y consigne). */
export function estEconomat(level: { code: string }): boolean {
  return level.code === CODE_ECONOMAT
}

export interface ArticleEconomat {
  id: 'gouttes' | 'secours' | 'dashs' | 'clef' | 'sac'
  nom: string
  detail: string // la ligne du toast à l'achat
  icone: string
  prix: number // en centilitres de condensat
  plot: { minX: number; minY: number; maxX: number; maxY: number }
}

// ——— L'ÉTAL : cinq alcôves le long du mur sud ——————————————————————
// Chaque alcôve est une niche à trois murs : on y PLONGE pour acheter —
// pas d'achat en passant devant.
const PLOT_Y0 = -750
const PLOT_Y1 = -570
const plot = (
  cx: number,
): { minX: number; minY: number; maxX: number; maxY: number } => ({
  minX: cx - 150,
  minY: PLOT_Y0,
  maxX: cx + 150,
  maxY: PLOT_Y1,
})
const CX = [-1180, -620, -60, 500, 1060] // les centres des cinq alcôves

export const ETAL_ECONOMAT: ArticleEconomat[] = [
  {
    id: 'gouttes',
    nom: 'FIOLE DE GOUTTES',
    detail: '+0,8 L versés à la bonbonne',
    icone: '🧪',
    prix: 60,
    plot: plot(CX[0]),
  },
  {
    id: 'dashs',
    nom: 'RECHARGE DES DASHS',
    detail: 'la réserve d’impulsions refaite',
    icone: '💨',
    prix: 50,
    plot: plot(CX[1]),
  },
  {
    id: 'clef',
    nom: 'CLEF DE CACHETTE',
    detail: 'les voiles du prochain tableau tombent',
    icone: '🗝️',
    prix: 90,
    plot: plot(CX[2]),
  },
  {
    id: 'secours',
    nom: 'ÉCHANTILLON DE SECOURS',
    detail: '+1 vie pour la descente',
    icone: '💠',
    prix: 150,
    plot: plot(CX[3]),
  },
  {
    id: 'sac',
    nom: 'SAC SURPRISE',
    detail: 'le Semblable ne dit pas ce qu’il y a dedans',
    icone: '🎴',
    prix: 40,
    plot: plot(CX[4]),
  },
]

/** Les ids d'articles que la monnaie CONDENSAT accepte sur un plot posé —
 * la liste fermée du format (levelIO écarte tout autre id). */
export const ARTICLES_ETAL_IDS = ETAL_ECONOMAT.map((a) => a.id)

/** La fiche catalogue d'un article de l'étal (nom, détail, icône, prix de
 * référence) — le plot posé fournit sa propre alcôve, et son prix s'il
 * surcharge. Null : id inconnu. */
export function articleEtal(id: string): ArticleEconomat | null {
  return ETAL_ECONOMAT.find((a) => a.id === id) ?? null
}

// ——— LA SALLE ———————————————————————————————————————————————————————
// Un module court : la cuve d'accueil, le comptoir du Semblable au nord
// (derrière sa grille), l'étal au sud, le sas de reprise à l'est.

const GRILLE_Y = 330 // le bas de la grille du comptoir

export const TABLEAU_ECONOMAT: LevelDef = {
  name: 'L’Économat',
  code: CODE_ECONOMAT,
  journal:
    'Annexe non cartographiée. Il y a un AUTRE ici — un semblable, derrière la grille. Il ne parle pas ; il pousse des choses à travers les barreaux et prend le condensat en échange. Le laboratoire l’aurait confisqué de toute façon. — Le sujet reviendra.',
  par: 3,
  bounds: { minX: -1600, minY: -800, maxX: 1600, maxY: 800 },
  spawn: { x: -1340, y: 60, n: 900 },
  // le sas de REPRISE : un passage, pas un collecteur
  exit: { minX: 1400, minY: -90, maxX: 1560, maxY: 90 },
  boxes: [
    // le COMPTOIR du Semblable : sa chambre au nord, fermée d'une grille —
    // on se voit, on se touche presque, on ne se rejoint pas
    box(-700, GRILLE_Y, -420, GRILLE_Y + 60, MAT_WALL, 6),
    box(-420, GRILLE_Y, 420, GRILLE_Y + 60, MAT_GRILLE),
    box(420, GRILLE_Y, 700, GRILLE_Y + 60, MAT_WALL, 6),
    box(-700, GRILLE_Y + 60, -640, 800, MAT_WALL, 6),
    box(640, GRILLE_Y + 60, 700, 800, MAT_WALL, 6),
    // LE SUJET 12 : une masse en capsule, posée derrière les barreaux —
    // hydrophile : ce qui aime retient
    {
      minX: -170,
      minY: 470,
      maxX: 170,
      maxY: 690,
      material: MAT_HYDROPHILE,
      forme: FORME_CAPSULE,
    },
    // L'ÉTAL : les cloisons des cinq alcôves (niches à trois murs, le
    // sol de la cuve fait le fond)
    box(-1400, -800, -1340, -540, MAT_WALL, 2),
    box(-960, -800, -900, -540, MAT_WALL, 2),
    box(-400, -800, -340, -540, MAT_WALL, 2),
    box(160, -800, 220, -540, MAT_WALL, 2),
    box(720, -800, 780, -540, MAT_WALL, 2),
    box(1280, -800, 1340, -540, MAT_WALL, 2),
    // une chicane légère avant le sas : on ne quitte pas l'annexe sans
    // avoir vu l'étal
    box(1100, 240, 1180, 800, MAT_WALL, 5),
  ],
  sponges: [],
  // le méta EN DONNÉES : les cinq alcôves de l'étal comme plots posés, et
  // le Sujet 12 comme marchand — le même chemin d'exécution que les plots
  // qu'on pose dans l'éditeur, et une copie de bibliothèque hérite de tout
  plots: ETAL_ECONOMAT.map((a) => ({
    ...a.plot,
    article: a.id,
    monnaie: 'condensat' as const,
  })),
  marchand: { x: 0, y: 580 },
  labels: [
    {
      x: 0,
      y: 740,
      text: 'ANNEXE NON CARTOGRAPHIÉE|L’ÉCONOMAT',
      tone: 'mur',
      rang: 'secteur',
    },
    { x: 0, y: 240, text: 'SUJET 12|IL ÉCHANGE', tone: 'froid' },
    {
      x: 860,
      y: -240,
      text: 'L’ÉTAL|TOUT SE PAIE EN CONDENSAT',
      tone: 'chaud',
      rang: 'secteur',
    },
    { x: CX[0], y: -500, text: 'FIOLE DE GOUTTES|60 cL', tone: 'phile' },
    { x: CX[1], y: -500, text: 'RECHARGE DES DASHS|50 cL', tone: 'grille' },
    { x: CX[2], y: -500, text: 'CLEF DE CACHETTE|90 cL', tone: 'phobe' },
    { x: CX[3], y: -500, text: 'ÉCHANTILLON DE SECOURS|150 cL', tone: 'froid' },
    { x: CX[4], y: -500, text: 'SAC SURPRISE|40 cL', tone: 'chaud' },
    { x: 1480, y: 240, text: 'REPRISE DE LA DESCENTE|SAS', tone: 'sas' },
  ],
}
