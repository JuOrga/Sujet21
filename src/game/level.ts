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

// Zone d'état (refonte 2026) : une région du tableau qui IMPOSE un état et
// interdit d'en changer, ou qui laisse le choix. Le corps qui y entre est
// converti ; tant qu'il y est, le sélecteur d'état est verrouillé.
export type ZoneForce = 'libre' | 'eau' | 'glace' | 'vapeur'

export interface ZoneDef {
  minX: number
  minY: number
  maxX: number
  maxY: number
  force: ZoneForce
  label?: string
}

// Décalque de décor : machinerie plaquée sur la paroi (tuyaux, vanne).
// Aucune physique, aucune règle — seulement la preuve que quelqu'un a
// construit cet endroit avant de l'abandonner.
export interface DecalDef {
  x: number
  y: number
  w: number
  h: number
  kind: 'tuyaux' | 'vanne'
  flip?: boolean // miroir horizontal : la même pièce ne se répète pas telle quelle
  fade?: number // 0..1, opacité (défaut 0,55)
}

export interface LevelDef {
  name: string
  code: string // code d'essai du protocole (21-A, 21-B…)
  journal: string // entrée du journal de bord, affichée à l'ouverture du tableau
  figure?: string // illustration du carton de journal (public/assets)
  bounds: Bounds
  spawn: { x: number; y: number; n: number }
  exit: { minX: number; minY: number; maxX: number; maxY: number }
  boxes: ObstacleBox[]
  sponges: SpongeDef[]
  labels: WorldLabel[]
  decals?: DecalDef[]
  zones?: ZoneDef[]
  par?: number // budget d'impulsions visé : franchissable en `par`, record en dessous
  // Lit musical imposé par le tableau. Sans valeur, la cuve suit le
  // refroidissement de la coque (tiède → glaciale) : c'est le cas général,
  // les tableaux n'ont pas à choisir une musique pour exister.
  ambiance?: string
}

// Nom lisible de chaque matériau — l'éditeur et la légende parlent la même
// langue que le code.
export const MATERIAL_NAMES: Record<number, string> = {
  [MAT_WALL]: 'Paroi',
  [MAT_HYDROPHILE]: 'Hydrophile',
  [MAT_HYDROPHOBE]: 'Hydrophobe',
  [MAT_EXIT]: 'Sas',
  [MAT_FROID]: 'Hublot (froid)',
  [MAT_GRILLE]: 'Grille',
  [MAT_CHAUD]: 'Radiateur',
}

// La CAUSE de chaque zone : une zone n'impose pas un état par convention, elle
// l'impose parce qu'il s'est passé quelque chose ici. Le nom sert d'étiquette
// par défaut, et le décor de la zone illustre la même cause.
export const ZONE_CAUSES: Record<ZoneForce, string> = {
  glace: 'HUBLOT FENDU',
  vapeur: 'CONDUITE ROMPUE',
  eau: 'CHAMBRE PRESSURISÉE',
  libre: 'ZONE LIBRE',
}

/** Le nom affiché d'une zone : le sien, ou la cause de son régime. */
export function zoneName(z: ZoneDef): string {
  return z.label && z.label.trim() ? z.label.trim().toUpperCase() : ZONE_CAUSES[z.force]
}

/** L'état imposé au point (x, y), ou 'libre' si aucune zone ne l'impose. */
// ---- Forme du rayon d'action d'une zone (refonte 2026) ------------------
// Le régime n'emplit plus un rectangle : il ÉMANE de l'accident dessiné au
// centre (hublot, brèche, rampe). Sa limite est une ellipse inscrite dans le
// rectangle déclaré, ondulée par trois harmoniques — arrondie, irrégulière,
// et différente pour chaque zone (les phases dépendent de son centre).
// La MÊME formule sert la mécanique (ici) et le rendu (les phases sont
// calculées ici puis passées au shader) : ce qu'on voit est ce qu'on subit.

/** Les trois phases d'ondulation d'une zone — déterministes, par centre. */
export function zonePhases(z: ZoneDef): [number, number, number] {
  const cx = (z.minX + z.maxX) * 0.5
  const cy = (z.minY + z.maxY) * 0.5
  const ph = (k: number): number => {
    const t = Math.sin(cx * 0.12898 + cy * 0.78233 + k * 17.17) * 43758.5453
    return (t - Math.floor(t)) * Math.PI * 2
  }
  return [ph(1), ph(2), ph(3)]
}

/** Distance de forme : < 1 dedans, 1 sur la lisière, > 1 dehors. */
export function zoneShape(z: ZoneDef, x: number, y: number): number {
  const hx = Math.max(1e-6, (z.maxX - z.minX) * 0.5)
  const hy = Math.max(1e-6, (z.maxY - z.minY) * 0.5)
  const nx = (x - (z.minX + z.maxX) * 0.5) / hx
  const ny = (y - (z.minY + z.maxY) * 0.5) / hy
  const d = Math.hypot(nx, ny)
  const th = Math.atan2(ny, nx)
  const [p1, p2, p3] = zonePhases(z)
  // rayon de lisière : 0,86 de la demi-taille, ondulé de ±0,135 — le tout
  // reste inscrit dans le rectangle déclaré à l'éditeur
  const w =
    0.86 + 0.062 * Math.sin(3 * th + p1) + 0.043 * Math.sin(5 * th + p2) + 0.03 * Math.sin(8 * th + p3)
  return d / w
}

/** Le contour de la lisière, pour l'éditeur (polygone en coordonnées monde). */
export function zoneOutline(z: ZoneDef, steps = 64): { x: number; y: number }[] {
  const cx = (z.minX + z.maxX) * 0.5
  const cy = (z.minY + z.maxY) * 0.5
  const hx = (z.maxX - z.minX) * 0.5
  const hy = (z.maxY - z.minY) * 0.5
  const [p1, p2, p3] = zonePhases(z)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2
    const w =
      0.86 + 0.062 * Math.sin(3 * th + p1) + 0.043 * Math.sin(5 * th + p2) + 0.03 * Math.sin(8 * th + p3)
    pts.push({ x: cx + Math.cos(th) * hx * w, y: cy + Math.sin(th) * hy * w })
  }
  return pts
}

export function zoneForceAt(level: LevelDef, x: number, y: number): ZoneForce {
  const zones = level.zones
  if (!zones) return 'libre'
  // la dernière zone déclarée gagne : on peut superposer une exception
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i]
    // rejet rapide par le rectangle englobant, puis la vraie forme
    if (x < z.minX || x > z.maxX || y < z.minY || y > z.maxY) continue
    if (zoneShape(z, x, y) < 1) return z.force
  }
  return 'libre'
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

// Tableau 1 bis — la galerie noyée (PROTOTYPE de réfection du secteur A,
// accessible depuis la fiche d'essai ; il remplacera 21-A s'il convainc).
// Un tableau « eau seule » : aucun changement d'état requis — on apprend
// l'éjection, l'inertie et le volume. La géométrie n'est plus une boîte nue :
// une porte massive, des contreforts, une cascade de dalles en quinconce,
// une étagère hydrophile pour se poser et viser, une lèvre hydrophobe qui
// défend la goulotte du sas.
export const TABLEAU_1BIS: LevelDef = {
  name: 'La galerie noyée',
  code: '21-A bis',
  journal:
    'Réfection du secteur A : cloisons redessinées, contreforts, une galerie au lieu d’un couloir. L’échantillon n’a besoin d’aucun artifice ici — seulement d’eau, et de retenue. — Dr N. Véga',
  figure: '/assets/card-galerie.webp',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -300, maxX: 1180, maxY: -60 },
  boxes: [
    // la porte d'entrée : deux piliers massifs, ouverture décentrée
    box(-700, 200, -560, 750, MAT_WALL),
    box(-700, -750, -560, -260, MAT_WALL),
    // contreforts : la paroi respire au lieu d'être une boîte nue
    box(-350, 660, -150, 750, MAT_WALL),
    box(80, -750, 280, -660, MAT_WALL),
    box(500, 600, 700, 750, MAT_WALL),
    box(820, -750, 980, -640, MAT_WALL),
    // la cascade : trois dalles en quinconce, le courant se faufile
    box(-380, -80, -40, 20, MAT_WALL),
    box(-200, -380, 160, -300, MAT_WALL),
    box(-40, 220, 300, 300, MAT_WALL),
    // l'étagère hydrophile : se coller, se poser, viser
    box(340, -140, 620, -40, MAT_HYDROPHILE),
    // la lèvre hydrophobe qui défend la goulotte du sas
    box(680, 120, 1020, 220, MAT_HYDROPHOBE),
    // le pilier bas de la goulotte
    box(680, -750, 760, -420, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -630, y: -60, text: 'LA PORTE', tone: 'mur' },
    { x: -110, y: -30, text: 'LA CASCADE', tone: 'mur' },
    { x: 480, y: -90, text: 'HYDROPHILE', tone: 'phile' },
    { x: 850, y: 170, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 1110, y: -180, text: 'SAS', tone: 'sas' },
  ],
  // La machinerie de la galerie : plaquée aux parois, à l'écart des routes —
  // le lieu a été construit, entretenu, puis laissé.
  decals: [
    { x: -1105, y: 230, w: 160, h: 160, kind: 'tuyaux' },
    { x: -1105, y: -180, w: 150, h: 150, kind: 'tuyaux', flip: true, fade: 0.45 },
    { x: -520, y: 590, w: 190, h: 285, kind: 'vanne', fade: 0.5 },
    { x: 300, y: -640, w: 150, h: 225, kind: 'vanne', fade: 0.42 },
    { x: 1120, y: 520, w: 165, h: 165, kind: 'tuyaux', fade: 0.5 },
    { x: 60, y: 700, w: 150, h: 150, kind: 'tuyaux', flip: true, fade: 0.4 },
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
