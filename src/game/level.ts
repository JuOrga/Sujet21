// Définition des tableaux (§7.1) : un problème fermé — on entre avec le
// volume plein, il n'y a pas d'eau à ramasser, on sort par un sas.
// Les obstacles sont de la chimie, pas de la géométrie (§6).

import type { Bounds } from '../sim/solver'

export const MAT_WALL = 0
export const MAT_HYDROPHILE = 1
export const MAT_HYDROPHOBE = 2
export const MAT_EXIT = 3 // rendu seulement, pas de physique
export const MAT_FROID = 4 // plaque froide : gèle l'eau qui s'attarde dans son aura
export const MAT_GRILLE = 5 // grille : arrête le liquide et la glace, laisse passer la vapeur
export const MAT_CHAUD = 6 // radiateur : vaporise l'eau dans son aura, dégèle, évapore ce qui s'attarde

export interface ObstacleBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  material: number
}

export interface SpongeDef {
  minX: number
  minY: number
  cols: number
  rows: number
  cellSize: number
  capacityPerCell: number // particules absorbées avant qu'une cellule se solidifie
}

// Étiquette peinte dans le décor : chaque élément distinctif porte son nom,
// dans la couleur de la légende — la surface s'identifie d'un coup d'œil.
export interface WorldLabel {
  x: number
  y: number
  text: string
  tone: 'mur' | 'phile' | 'phobe' | 'eponge' | 'froid' | 'grille' | 'sas' | 'chaud'
}

export interface LevelDef {
  name: string
  code: string // code d'essai du protocole (21-A, 21-B…)
  journal: string // entrée du journal de bord, affichée à l'ouverture du tableau
  bounds: Bounds
  spawn: { x: number; y: number; n: number }
  exit: { minX: number; minY: number; maxX: number; maxY: number }
  boxes: ObstacleBox[]
  sponges: SpongeDef[]
  labels: WorldLabel[]
}

function box(minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox {
  return { minX, minY, maxX, maxY, material }
}

// Tableau 1 — lecture de gauche à droite :
// 1. une cloison hydrophobe percée de deux ouvertures (se scinder ou se
//    faufiler, les bords déviant les trajectoires) ;
// 2. un îlot hydrophile au centre : on s'y colle, on y rampe, il faut payer
//    une impulsion pour s'en arracher ;
// 3. un mur d'éponge qui barre la moitié basse : passer par le couloir haut,
//    ou payer le passage en volume et ouvrir une brèche permanente (§6) ;
// 4. le sas, en bas à droite — derrière l'éponge : le couloir haut oblige à
//    redescendre le long de la paroi.
export const TABLEAU_1: LevelDef = {
  name: 'Le sas',
  code: '21-A',
  journal:
    'Cohésion nominale. L’échantillon dérive vers le collecteur avec une constance… inhabituelle. Sept essais, sept trajectoires identiques. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -420, maxX: 1180, maxY: -180 },
  boxes: [
    // 1. cloison hydrophobe : trois segments, deux ouvertures
    box(-420, -750, -360, -380, MAT_HYDROPHOBE),
    box(-420, -180, -360, 180, MAT_HYDROPHOBE),
    box(-420, 380, -360, 750, MAT_HYDROPHOBE),
    // 2. îlot hydrophile
    box(-80, -160, 240, -40, MAT_HYDROPHILE),
    // muret neutre au-dessus du couloir de l'éponge
    box(560, 240, 640, 750, MAT_WALL),
  ],
  sponges: [
    // 3. mur d'éponge : bloque de bas en haut jusqu'au couloir (y = 40..240)
    {
      minX: 560,
      minY: -750,
      cols: 2,
      rows: 33,
      cellSize: 24,
      capacityPerCell: 5,
    },
  ],
  labels: [
    { x: -390, y: 0, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 80, y: -100, text: 'HYDROPHILE', tone: 'phile' },
    { x: 584, y: -60, text: 'ÉPONGE', tone: 'eponge' },
    { x: 1110, y: -300, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 2 — la chambre froide (une mécanique : l'état). Lecture :
// 1. deux plaques froides encadrent l'entrée : passer au centre, ou raser et
//    payer en givre — le froid se lit à son aura avant de mordre ;
// 2. une chicane hydrophobe au milieu : les rebonds font perdre le contrôle,
//    et le petit plot froid est un mouillage volontaire — geler un flanc pour
//    s'arrêter net, puis payer le dégel en temps ;
// 3. une barrière froide devant le sas, percée d'un passage étroit : viser
//    juste, ou traverser en acceptant un gel partiel.
export const TABLEAU_2: LevelDef = {
  name: 'La chambre froide',
  code: '21-B',
  journal:
    'Installation de plaques cryogéniques sur demande. Si l’échantillon « choisit » ses trajectoires, le froid les lui fera payer. Note : il a appris à s’en servir. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // 1. porte froide d'entrée
    box(-500, -750, -440, -150, MAT_FROID),
    box(-500, 150, -440, 750, MAT_FROID),
    // 2. chicane hydrophobe + plot d'ancrage
    box(-100, -420, -20, -240, MAT_HYDROPHOBE),
    box(60, 240, 140, 420, MAT_HYDROPHOBE),
    box(180, -50, 260, 50, MAT_FROID),
    // 3. barrière froide devant le sas, passage en y = -80..180
    box(700, -750, 760, -80, MAT_FROID),
    box(700, 180, 760, 750, MAT_FROID),
  ],
  sponges: [],
  labels: [
    { x: -470, y: 430, text: 'PLAQUE FROIDE', tone: 'froid' },
    { x: -60, y: -330, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 220, y: 110, text: 'PLOT FROID', tone: 'froid' },
    { x: 730, y: 440, text: 'PLAQUE FROIDE', tone: 'froid' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 3 — le conduit (une mécanique : le gaz). Lecture :
// 1. une grille barre tout le passage : le liquide s'y écrase, la vapeur la
//    traverse — se changer en gaz (G) est le seul chemin ;
// 2. un goulet neutre au centre : en vapeur on le franchit sans se mouiller
//    aux parois, mais le nuage s'évapore pendant qu'on le pilote ;
// 3. une seconde grille, puis deux portes froides : le froid condense la
//    vapeur — on redevient liquide avant le sas, qu'on le veuille ou non.
export const TABLEAU_3: LevelDef = {
  name: 'Le conduit',
  code: '21-C',
  journal:
    'Les grilles retiennent l’eau et la glace. Ce matin, l’échantillon a traversé la première à l’état de vapeur. Je demande le passage en confinement de niveau 3. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // 1. première grille, pleine hauteur
    box(-500, -750, -460, 750, MAT_GRILLE),
    // 2. goulet neutre
    box(-80, -750, 0, -100, MAT_WALL),
    box(-80, 100, 0, 750, MAT_WALL),
    // 3. seconde grille puis portes condensantes
    box(400, -750, 440, 750, MAT_GRILLE),
    box(520, -750, 580, -180, MAT_FROID),
    box(520, 180, 580, 750, MAT_FROID),
  ],
  sponges: [],
  labels: [
    { x: -480, y: 320, text: 'GRILLE', tone: 'grille' },
    { x: 420, y: 320, text: 'GRILLE', tone: 'grille' },
    { x: 550, y: 440, text: 'PLAQUE FROIDE', tone: 'froid' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 4 — la cuve thermique (le jalon « chaleur » : les trois routes).
// Le tableau se lit comme une carte de température. Lecture :
// 1. une cloison neutre percée au centre ;
// 2. un radiateur en haut, une cryobaie en bas : deux préparations d'état ;
// 3. une barrière qui combine les trois réponses — fente étroite en haut
//    (liquide : se faufiler), mur d'éponge au centre (payer en volume, ou
//    traverser en vapeur gagnée au radiateur), couloir bas tapissé d'éponge
//    (la glace y glisse : l'éponge n'a pas prise sur elle).
export const TABLEAU_4: LevelDef = {
  name: 'La cuve thermique',
  code: '21-D',
  journal:
    'Un radiateur et une cryobaie dans la même cuve : trois chemins, trois états. L’échantillon a pris les trois en trois essais. Ce n’est plus une fuite, c’est une démonstration. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // 1. cloison neutre, large passage central
    box(-420, -750, -360, -160, MAT_WALL),
    box(-420, 160, -360, 750, MAT_WALL),
    // 2. la carte thermique : radiateur en haut, cryobaie en bas
    box(-80, 520, 320, 640, MAT_CHAUD),
    box(-80, -640, 320, -520, MAT_FROID),
    // 3. barrière : mur au-dessus de la fente (la fente : y = 360..440,
    //    entre ce segment et le haut du mur d'éponge)
    box(560, 440, 620, 750, MAT_WALL),
  ],
  sponges: [
    // mur d'éponge central : de la fente au couloir bas (y = -360..360)
    { minX: 560, minY: -360, cols: 2, rows: 30, cellSize: 24, capacityPerCell: 5 },
    // couloir bas tapissé : deux lèvres d'éponge, la glace passe entre elles
    { minX: 660, minY: -420, cols: 10, rows: 2, cellSize: 24, capacityPerCell: 4 },
    { minX: 660, minY: -750, cols: 10, rows: 2, cellSize: 24, capacityPerCell: 4 },
  ],
  labels: [
    { x: 120, y: 580, text: 'RADIATEUR', tone: 'chaud' },
    { x: 120, y: -580, text: 'CRYOBAIE', tone: 'froid' },
    { x: 584, y: 0, text: 'ÉPONGE', tone: 'eponge' },
    { x: 780, y: -580, text: 'ÉPONGE', tone: 'eponge' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 5 — la serre (combinaison : hydrophile + chaleur + éponge).
// Lecture : des étagères hydrophiles jalonnent la traversée — s'y coller,
// c'est s'arrêter net pour viser, mais s'en arracher se paie ; le radiateur
// du haut offre l'autre monnaie (la vapeur passe l'éponge) ; le mur d'éponge
// ferme la moitié basse.
export const TABLEAU_5: LevelDef = {
  name: 'La serre',
  code: '21-E',
  journal:
    'Les parois mouillantes devaient l’immobiliser. Il s’en sert comme de prises d’escalade : il se colle, il vise, il s’arrache. Le protocole lui a appris la patience. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -320, maxX: 1180, maxY: -80 },
  boxes: [
    // les étagères : des mouillages successifs pour casser l'inertie
    box(-560, 80, -240, 200, MAT_HYDROPHILE),
    box(-80, -420, 240, -300, MAT_HYDROPHILE),
    // le radiateur du haut : la monnaie vapeur
    box(120, 520, 520, 640, MAT_CHAUD),
    // muret neutre au-dessus du couloir de l'éponge
    box(560, 300, 640, 750, MAT_WALL),
  ],
  sponges: [
    // mur d'éponge : bloque du bas jusqu'au couloir (y = 100..300)
    { minX: 560, minY: -750, cols: 2, rows: 35, cellSize: 24, capacityPerCell: 5 },
  ],
  labels: [
    { x: -400, y: 140, text: 'HYDROPHILE', tone: 'phile' },
    { x: 80, y: -360, text: 'HYDROPHILE', tone: 'phile' },
    { x: 320, y: 580, text: 'RADIATEUR', tone: 'chaud' },
    { x: 584, y: -200, text: 'ÉPONGE', tone: 'eponge' },
    { x: 1110, y: -360, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 6 — le dépôt de givre (combinaison : grilles + froid +
// recondensation). Lecture : deux grilles imposent la vapeur, leurs péages
// essorent le nuage — mais les plaques froides du dépôt recondensent les
// pertes en rosée : passer, puis revenir cueillir son propre corps.
export const TABLEAU_6: LevelDef = {
  name: 'Le dépôt de givre',
  code: '21-F',
  journal:
    'Le givre des plaques n’est pas du givre. C’est LUI — ce que les grilles lui arrachent perle sur les parois froides, et il revient le boire. Rien ne se perd. Ça m’inquiète. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // première grille, pleine hauteur : la vapeur est obligatoire
    box(-460, -750, -420, 750, MAT_GRILLE),
    // le dépôt : deux plaques froides qui recondensent les pertes
    box(-220, -750, -160, -280, MAT_FROID),
    box(-220, 280, -160, 750, MAT_FROID),
    // chicane hydrophobe au centre
    box(180, -480, 260, -120, MAT_HYDROPHOBE),
    box(330, 140, 410, 500, MAT_HYDROPHOBE),
    // seconde grille, puis une dernière plaque à l'écart du sas
    box(680, -750, 720, 750, MAT_GRILLE),
    box(850, -750, 910, -380, MAT_FROID),
  ],
  sponges: [],
  labels: [
    { x: -440, y: 320, text: 'GRILLE', tone: 'grille' },
    { x: -190, y: 520, text: 'DÉPÔT DE GIVRE', tone: 'froid' },
    { x: 220, y: -300, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 700, y: 320, text: 'GRILLE', tone: 'grille' },
    { x: 880, y: -560, text: 'DÉPÔT', tone: 'froid' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 7 — la dérive (le final : presque pas de murs). Lecture : un
// grand vide où chaque impulsion se paie ; des plots hydrophobes en guise de
// bandes de billard, deux mouillages froids pour geler-glisser sans dépenser
// une goutte. La maîtrise pure de l'inertie et du volume.
export const TABLEAU_7: LevelDef = {
  name: 'La dérive',
  code: '21-G',
  journal:
    'Nous avons retiré les cloisons du secteur : sans appui, il devra se dépenser. Il a gelé, ricoché deux fois, et traversé sans perdre une goutte. Le protocole est terminé. Lui non. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -980, y: 0, n: 900 },
  exit: { minX: 1040, minY: 380, maxX: 1180, maxY: 620 },
  boxes: [
    // les bandes du billard
    box(-520, -260, -400, -140, MAT_HYDROPHOBE),
    box(-160, 260, -40, 380, MAT_HYDROPHOBE),
    box(240, -380, 360, -260, MAT_HYDROPHOBE),
    box(560, 60, 680, 180, MAT_HYDROPHOBE),
    // deux mouillages froids : geler pour glisser, se souder pour viser
    box(-360, 420, -240, 520, MAT_FROID),
    box(300, -700, 420, -600, MAT_FROID),
    // un unique radiateur, loin de la route directe
    box(-1060, -640, -860, -560, MAT_CHAUD),
  ],
  sponges: [],
  labels: [
    { x: -460, y: -100, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: -300, y: 560, text: 'MOUILLAGE FROID', tone: 'froid' },
    { x: 360, y: -560, text: 'MOUILLAGE FROID', tone: 'froid' },
    { x: -960, y: -520, text: 'RADIATEUR', tone: 'chaud' },
    { x: 1110, y: 340, text: 'SAS', tone: 'sas' },
  ],
}

// L'ordre de la partie : chaque tableau enseigne une chose, les derniers
// les combinent, et la dérive conclut sur la maîtrise pure.
export const TABLEAUX: LevelDef[] = [
  TABLEAU_1,
  TABLEAU_2,
  TABLEAU_3,
  TABLEAU_5,
  TABLEAU_6,
  TABLEAU_4,
  TABLEAU_7,
]

export function pointInBox(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY
}
