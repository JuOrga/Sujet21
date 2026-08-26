// LE CABINET LOGIQUE : la logique booléenne en lumière — cinq salles de
// démonstration qui DÉTOURNENT les mécanismes du jeu, sans en modifier un
// seul. Le constat : les pastilles et les portes forment une algèbre
// complète.
//
//   · une pastille TOR est une MÉMOIRE 1 BIT — un passage du faisceau
//     l'écrit à 1, rien ne l'efface ;
//   · deux pastilles d'un même canal, porte par défaut : un OU ;
//   · la règle « et » de la porte : un ET ;
//   · la pastille NOR (barrière tenue) : un NON — la sortie vaut
//     NON(faisceau coupé), et la première coupure scelle pour de bon.
//
// Le joueur est l'opérande : geler son corps sous un fil de lumière écrit
// un bit (le flanc du bloc renvoie le faisceau sur la pastille), traverser
// une barrière en vapeur laisse le fil intact, la traverser en eau le
// coupe. Ces salles se chargent depuis l'écran SALLES (mode concepteur),
// à l'essai — hors expédition, hors accueil.
//
// Les cotes suivent la grammaire du générateur (generateur.ts) : émetteur
// au plafond (fil à plomb), pastille de miroir posée sur le trajet du
// reflet (+52 sous le point de gel), barrière verticale à colonne dégagée,
// pastille NOR au sol. Chaque circuit est PROUVÉ par le vrai traceur
// (laser.ts) dans circuits.spec.ts — comme les salles générées.

import {
  MAT_WALL,
  type CibleDef,
  type LaserDef,
  type LevelDef,
  type ObstacleBox,
  type PorteDef,
  type WorldLabel,
} from './level'

// ---- La coquille commune : une salle d'étude, une cloison, le sas -------
// x : 0 → 1900 ; y : -550 → 550. La salle d'étude va jusqu'à la cloison
// (x = 1340..1400), le sas vit derrière, le passage central fait 240 de
// haut — les proportions du générateur.
const H2 = 550 // demi-hauteur
const CLOISON_X0 = 1340
const CLOISON_X1 = 1400
const GAP = 120 // demi-hauteur du passage central

interface Circuit {
  code: string
  name: string
  journal: string
  labels: WorldLabel[]
  lasers: LaserDef[]
  cibles: CibleDef[]
  porte: PorteDef
}

function salleCircuit(c: Circuit): LevelDef {
  const boxes: ObstacleBox[] = [
    // les deux pans de la cloison, au-dessus et au-dessous du passage
    { minX: CLOISON_X0, minY: GAP, maxX: CLOISON_X1, maxY: H2, material: MAT_WALL, skin: 2 },
    { minX: CLOISON_X0, minY: -H2, maxX: CLOISON_X1, maxY: -GAP, material: MAT_WALL, skin: 3 },
  ]
  return {
    name: c.name,
    code: c.code,
    journal: c.journal,
    bounds: { minX: 0, minY: -H2, maxX: 1900, maxY: H2 },
    spawn: { x: 230, y: 0, n: 700 },
    exit: { minX: 1730, minY: -110, maxX: 1850, maxY: 110 },
    boxes,
    sponges: [],
    labels: [
      { x: 1790, y: 170, text: 'SAS', tone: 'sas' },
      ...c.labels,
    ],
    lasers: c.lasers,
    cibles: c.cibles,
    portes: [c.porte],
    par: 8,
  }
}

/** Un poste de MIROIR : le fil à plomb, la consigne au point de gel, la
 * pastille sur le trajet du reflet — les cotes du générateur. */
function posteMiroir(
  ex: number,
  my: number,
  canal: number,
  nom: string,
): { laser: LaserDef; cible: CibleDef; labels: WorldLabel[]; spot: { x: number; y: number } } {
  return {
    laser: { x: ex, y: H2 - 24, angle: -90 },
    cible: { x: ex + 220, y: my + 52, r: 30, canal },
    labels: [
      { x: ex, y: my - 66, text: nom, tone: 'froid', rang: 'detail' },
    ],
    spot: { x: ex, y: my },
  }
}

/** Une BARRIÈRE TENUE : le faisceau vertical, sa pastille NOR au sol. */
function posteBarriere(
  bx: number,
  canal: number,
): { laser: LaserDef; cible: CibleDef; spot: { x: number; y: number } } {
  return {
    laser: { x: bx, y: H2 - 24, angle: -90 },
    cible: { x: bx, y: -H2 + 52, r: 22, mode: 'nor', canal },
    spot: { x: bx, y: 0 },
  }
}

// ---- Les cinq circuits, du bit à la serrure composée --------------------

// C-1 · LA MÉMOIRE : une pastille TOR = un bit. L'écrire ouvre, pour de bon.
const m1 = posteMiroir(600, -40, 1, 'GELER ICI — ÉCRIRE 1')
const MEMOIRE = salleCircuit({
  code: 'CL-1',
  name: 'Cabinet logique — la mémoire (1 bit)',
  journal:
    'Une pastille TOR est une mémoire : un seul passage du faisceau l’écrit à 1, et rien ne l’efface. Gelez votre corps sous le fil de lumière — son flanc renvoie le faisceau sur la pastille. Le bit reste écrit même si vous repartez : la porte ne se referme jamais.',
  labels: [
    { x: 600, y: 340, text: 'MÉMOIRE|1 BIT', tone: 'grille' },
    ...m1.labels,
    { x: 1370, y: 190, text: 'S’OUVRE À 1', tone: 'sas', rang: 'detail' },
  ],
  lasers: [m1.laser],
  cibles: [m1.cible],
  porte: { minX: CLOISON_X0, minY: -GAP, maxX: CLOISON_X1, maxY: GAP, canal: 1 },
})
export const SPOT_MEMOIRE = m1.spot

// C-2 · OU : deux entrées, un canal — une seule suffit.
const ou1 = posteMiroir(420, -60, 1, 'ENTRÉE A')
const ou2 = posteMiroir(880, 60, 1, 'ENTRÉE B')
const OU = salleCircuit({
  code: 'CL-2',
  name: 'Cabinet logique — OU (une entrée suffit)',
  journal:
    'Deux pastilles portent le même numéro de canal : la porte s’ouvre dès que L’UNE s’allume — c’est un OU. Écrivez l’entrée A ou l’entrée B, à votre guise ; la seconde ne sert à rien, sinon à vérifier le théorème.',
  labels: [
    { x: 650, y: 340, text: 'PORTE OU|A + B MÊME CANAL', tone: 'grille' },
    ...ou1.labels,
    ...ou2.labels,
  ],
  lasers: [ou1.laser, ou2.laser],
  cibles: [ou1.cible, ou2.cible],
  porte: { minX: CLOISON_X0, minY: -GAP, maxX: CLOISON_X1, maxY: GAP, canal: 1 },
})
export const SPOTS_OU = [ou1.spot, ou2.spot]

// C-3 · ET : mêmes deux entrées — mais la porte exige LES DEUX. La mémoire
// TOR rend le ET praticable seul : on écrit A, puis B, l'une retient l'autre.
const et1 = posteMiroir(420, -90, 1, 'ENTRÉE A')
const et2 = posteMiroir(880, 60, 1, 'ENTRÉE B')
const ET = salleCircuit({
  code: 'CL-3',
  name: 'Cabinet logique — ET (les deux, dans l’ordre que vous voudrez)',
  journal:
    'Même montage que le OU — mais la porte porte la règle ET : elle exige TOUTES les pastilles du canal. Seul, c’est possible parce que la pastille TOR retient : écrivez A, puis allez écrire B — la première vous attend. Un ET logique, câblé en lumière.',
  labels: [
    { x: 650, y: 340, text: 'PORTE ET|A PUIS B — LES DEUX', tone: 'grille' },
    ...et1.labels,
    ...et2.labels,
  ],
  lasers: [et1.laser, et2.laser],
  cibles: [et1.cible, et2.cible],
  porte: { minX: CLOISON_X0, minY: -GAP, maxX: CLOISON_X1, maxY: GAP, canal: 1, regle: 'et' },
})
export const SPOTS_ET = [et1.spot, et2.spot]

// C-4 · NON : la barrière tenue. La sortie vaut NON(fil coupé) — et la
// première coupure scelle : un NON qui ne pardonne pas.
const non1 = posteBarriere(1150, 1)
const NON = salleCircuit({
  code: 'CL-4',
  name: 'Cabinet logique — NON (le fil qu’il ne faut pas couper)',
  journal:
    'La pastille NOR tient la porte ouverte TANT QUE le faisceau la touche : la sortie vaut NON(coupure). Traversez la lumière en VAPEUR — ionisée, elle file droit et le fil tient. La traverser en eau plie le faisceau : première coupure, la pastille grille, la porte se scelle pour de bon.',
  labels: [
    { x: 700, y: 340, text: 'PORTE NON|LE FIL TIENT LA PORTE', tone: 'grille' },
    { x: 1150, y: 120, text: 'TRAVERSER EN VAPEUR', tone: 'grille', rang: 'detail' },
    { x: 1150, y: -300, text: 'COUPER = SCELLER', tone: 'chaud', rang: 'detail' },
  ],
  lasers: [non1.laser],
  cibles: [non1.cible],
  porte: { minX: CLOISON_X0, minY: -GAP, maxX: CLOISON_X1, maxY: GAP, canal: 1 },
})
export const SPOT_NON = non1.spot

// C-5 · LE VERROU : le circuit composé — porte = MÉMOIRE ET NON(coupure).
// Une pastille TOR (la clé, à écrire) et une pastille NOR (le fil, à ne
// jamais couper) partagent le canal d'une porte ET : elle ne s'ouvre que
// bit écrit ET fil intact. Écrire la clé, puis passer le fil en vapeur.
const v1 = posteMiroir(500, -40, 1, 'ÉCRIRE LA CLÉ')
const v2 = posteBarriere(1150, 1)
const VERROU = salleCircuit({
  code: 'CL-5',
  name: 'Cabinet logique — le verrou (mémoire ET fil intact)',
  journal:
    'Le circuit composé : la porte ET exige ses deux pastilles — la TOR (une clé à écrire au miroir de glace) et la NOR (un fil de lumière qui doit rester intact). Porte = clé ÉCRITE ET fil NON coupé. Écrivez la clé, puis franchissez le fil en vapeur. Le couper scelle le verrou à jamais.',
  labels: [
    { x: 700, y: 340, text: 'LE VERROU|CLÉ ET FIL INTACT', tone: 'grille' },
    ...v1.labels,
    { x: 1150, y: 120, text: 'PASSER EN VAPEUR', tone: 'grille', rang: 'detail' },
  ],
  lasers: [v1.laser, v2.laser],
  cibles: [v1.cible, v2.cible],
  porte: { minX: CLOISON_X0, minY: -GAP, maxX: CLOISON_X1, maxY: GAP, canal: 1, regle: 'et' },
})
export const SPOT_VERROU_CLE = v1.spot
export const SPOT_VERROU_FIL = v2.spot

/** Les cinq salles du cabinet, dans l'ordre du cours. */
export const CIRCUITS: LevelDef[] = [MEMOIRE, OU, ET, NON, VERROU]
