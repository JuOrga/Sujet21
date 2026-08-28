// LE HUB : le module d'accueil du laboratoire Méduse — la zone de départ du
// roguelike. Un labo D'HUMAINS (les « Créateurs », dans la bouche du sujet),
// pas un espace à soi : on y est OBSERVÉ. Le jeu commence ici, dans la cuve
// d'entraînement ; le placard d'entretien murmure les surfaces en énigmes ;
// l'écran de contrôle et le banc d'étalonnage attendent leurs chantiers
// (méta-progression) ; et le conduit de ventilation mène au SAS DE
// LANCEMENT — le sas de ce tableau ne collecte rien : il lance la run.
//
// Aucun enjeu ici : pas de records, pas de chrono, pas d'échantillon de
// secours consommé — la dispersion recompose simplement l'échantillon.

import {
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_RIDEAU,
  MAT_WALL,
  type LevelDef,
  type ObstacleBox,
} from './level'

function box(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  material: number,
  skin?: number,
): ObstacleBox {
  return skin ? { minX, minY, maxX, maxY, material, skin } : { minX, minY, maxX, maxY, material }
}

// ——— LE PLAN (v3) : des SALLES, pas un couloir cloisonné ———————————
//
// Un étage de 8000 × 3600, où chaque fonction a SA pièce, assez vaste pour
// qu'on la reconnaisse de loin et que sa pancarte ait de l'air autour d'elle.
// Le trajet reste serpentin (portes alternées : centre, haut, bas) — on
// TRAVERSE des lieux construits par des humains.
//
//   ouest ─────────────────────────────────────────────────────────► est
//   ┌──────────────┬───────────────────────┬──────────────┬─────────┐
//   │              │   OBSERVATION (nord)  │              │         │
//   │    CUVE      ├──porte──┐             │ ÉTALONNAGE   │ CONDUIT │
//   │ D'ENTRAÎNE-  │  HALL   │             │  (machines,  │   puis  │
//   │    MENT      ├─────────┘             │    banc)     │   SAS   │
//   │              │   PLACARD (sud)       │              │         │
//   └──────────────┴───────────────────────┴──────────────┴─────────┘
//
// Les cinq casiers du placard s'étalent sur 2 400 unités : leurs pancartes
// ne se marchent plus dessus, même vues de loin.

const CLOISON = 90 // épaisseur des cloisons de l'étage

// ——— LE MÉTA AU HUB (v4) ————————————————————————————————————————————
// La salle d'étalonnage cesse d'être « hors service » : elle devient le
// lieu du méta. LE COMPTOIR (un Semblable détaché au module — le cousin
// du Sujet 12) vend des PROVISIONS pour la prochaine descente, payées en
// MÉMOIRE — la monnaie qui survit à la purge : dépenser ce qu'on gagne,
// c'est ici. LE BANC DES MÉMOIRES ouvre l'écran du cycle des états au
// CONTACT : les transformations s'y tissent. Et le conduit gagne DEUX
// SORTIES GARDÉES par la matière elle-même : un RIDEAU (seule la glace
// l'écarte) vers la VOIE SEMI-PROCÉDURALE, une GRILLE (seule la vapeur
// passe) vers la DESCENTE DU JOUR — tant que le lien n'est pas tissé, la
// route n'existe pas ; les routes s'ouvrent au fil de la progression.

export interface ArticleHub {
  id: 'viatique' | 'secours' | 'clef' | 'sac'
  nom: string
  detail: string // la ligne du toast à l'achat
  icone: string
  prix: number // en MÉMOIRE
  plot: { minX: number; minY: number; maxX: number; maxY: number }
}

// l'étal du comptoir : quatre alcôves au sud de la salle d'étalonnage
const PLOT_HUB_Y0 = -1750
const PLOT_HUB_Y1 = -1560
const plotHub = (
  cx: number,
): { minX: number; minY: number; maxX: number; maxY: number } => ({
  minX: cx - 150,
  minY: PLOT_HUB_Y0,
  maxX: cx + 150,
  maxY: PLOT_HUB_Y1,
})
const CX_HUB = [220, 760, 1300, 1840] // les centres des quatre alcôves

export const ETAL_HUB: ArticleHub[] = [
  {
    id: 'viatique',
    nom: 'VIATIQUE DE GOUTTES',
    detail: '+0,8 L à la bonbonne, au départ de la prochaine descente',
    icone: '🧪',
    prix: 3,
    plot: plotHub(CX_HUB[0]),
  },
  {
    id: 'clef',
    nom: 'CLEF DE CACHETTE',
    detail: 'les voiles du premier tableau tomberont d’emblée',
    icone: '🗝️',
    prix: 4,
    plot: plotHub(CX_HUB[1]),
  },
  {
    id: 'sac',
    nom: 'SAC SURPRISE',
    detail: 'le Semblable ne dit pas ce qu’il y a dedans',
    icone: '🎴',
    prix: 3,
    plot: plotHub(CX_HUB[2]),
  },
  {
    id: 'secours',
    nom: 'ÉCHANTILLON DE SECOURS',
    detail: '+1 vie pour la prochaine descente',
    icone: '💠',
    prix: 8,
    plot: plotHub(CX_HUB[3]),
  },
]

/** LE BANC DES MÉMOIRES : le contact du corps ouvre l'écran du cycle. */
export const BANC_MEMOIRES_HUB = {
  minX: 1330,
  minY: 60,
  maxX: 1970,
  maxY: 420,
}

/** SAS DU GIVRE (nord-est, derrière le rideau) : lance LA VOIE. */
export const SAS_GIVRE_HUB = { minX: 3740, minY: 1500, maxX: 3940, maxY: 1780 }
/** SAS DE VAPEUR (sud-est, derrière la grille) : la DESCENTE DU JOUR. */
export const SAS_VAPEUR_HUB = {
  minX: 3740,
  minY: -1780,
  maxX: 3940,
  maxY: -1500,
}

export const TABLEAU_HUB: LevelDef = {
  name: 'Le module Méduse',
  code: 'HUB',
  journal:
    'Module d’accueil. Entre deux protocoles, le sujet est libre de circuler — « libre » au sens où nous consignons tout. Il connaît l’étage mieux que nous : il prend les chicanes du conduit sans jamais se tromper. Il passe de longues minutes devant le placard d’entretien. Il lit, je crois. — Dr N. Véga',
  par: 3,
  bounds: { minX: -4000, minY: -1800, maxX: 4000, maxY: 1800 },
  spawn: { x: -3200, y: 0, n: 900 },
  // le sas de LANCEMENT, tout à l'est, au bout des chicanes
  exit: { minX: 3760, minY: -140, maxX: 3940, maxY: 140 },
  boxes: [
    // ═══ CUVE D'ENTRAÎNEMENT (ouest, −4000..−2400) ═══════════════════
    // deux agrès pour sentir les surfaces, aux extrémités de la pièce :
    // le réveil, au centre, ne touche rien
    box(-3900, -900, -3600, -830, MAT_HYDROPHILE),
    box(-2900, 780, -2600, 850, MAT_HYDROPHOBE),
    // cloison cuve | hall — hublots au nord (on vous observe), caissons au
    // sud ; porte CENTRALE (y −220..220)
    box(-2400, 220, -2400 + CLOISON, 1800, MAT_WALL, 6),
    box(-2400, -1800, -2400 + CLOISON, -220, MAT_WALL, 1),

    // ═══ HALL (−2400..−200) : le carrefour, il dessert deux pièces ═════
    // mur nord du hall — porte vers l'OBSERVATION (x −1500..−1100)
    box(-2310, 620, -1500, 620 + CLOISON, MAT_WALL, 2),
    box(-1100, 620, -200, 620 + CLOISON, MAT_WALL, 2),
    // mur sud du hall — porte vers le PLACARD (x −1300..−900)
    box(-2310, -620 - CLOISON, -1300, -620, MAT_WALL, 1),
    box(-900, -620 - CLOISON, -200, -620, MAT_WALL, 1),

    // ─── SALLE D'OBSERVATION (nord du hall) : la baie des Créateurs ───
    box(-2000, 1500, -700, 1620, MAT_WALL, 7),

    // ─── PLACARD D'ENTRETIEN (sud du hall) : un casier par surface,
    // étalés sur 2 400 unités — chaque pancarte a sa colonne d'air
    box(-2200, -1700, -1960, -1610, MAT_HYDROPHILE),
    box(-1650, -1700, -1410, -1610, MAT_HYDROPHOBE),
    box(-1100, -1700, -860, -1610, MAT_FROID),
    box(-550, -1700, -310, -1610, MAT_GRILLE),

    // ═══ cloison hall | étalonnage — porte HAUTE (y 700..1100) ═══════
    box(-200, 1100, -200 + CLOISON, 1800, MAT_WALL, 4),
    box(-200, -1800, -200 + CLOISON, 700, MAT_WALL, 4),

    // ═══ SALLE D'ÉTALONNAGE (−200..2000) : le méta a pris ses murs ═══
    box(400, -400, 1200, -280, MAT_WALL, 2),
    box(600, 700, 800, 1300, MAT_WALL, 8),
    // le BANC DES MÉMOIRES (la machine — le contact ouvre l'écran du cycle)
    box(1400, 120, 1900, 240, MAT_WALL, 4),
    // LE COMPTOIR : les cloisons des quatre alcôves de l'étal, au sud —
    // des niches à trois murs, comme à l'Économat : on y PLONGE pour acheter
    box(-80, -1800, -20, -1540, MAT_WALL, 2),
    box(460, -1800, 520, -1540, MAT_WALL, 2),
    box(1000, -1800, 1060, -1540, MAT_WALL, 2),
    box(1540, -1800, 1600, -1540, MAT_WALL, 2),

    // ═══ cloison étalonnage | conduit — porte BASSE (y −1100..−700) ═══
    box(2000, -700, 2000 + CLOISON, 1800, MAT_WALL, 5),
    box(2000, -1800, 2000 + CLOISON, -1100, MAT_WALL, 5),

    // ═══ CONDUIT DE VENTILATION (2000..3600) : deux chicanes ══════════
    // par-dessus la première, par-dessous la seconde, puis les TROIS sas
    box(2600, -1800, 2690, 900, MAT_WALL, 5),
    box(3200, -900, 3290, 1800, MAT_WALL, 5),
    // ─── la CHAMBRE DE GIVRE (nord-est) : murée, sauf un RIDEAU — seule
    // la glace l'écarte. Le lien SOLIDIFICATION non tissé, la route
    // n'existe pas : les sorties s'ouvrent au fil de la progression.
    box(3290, 550, 3560, 640, MAT_WALL, 5),
    box(3560, 550, 3740, 640, MAT_RIDEAU),
    box(3740, 550, 4000, 640, MAT_WALL, 5),
    // ─── la CHAMBRE DE VAPEUR (sud-est) : murée, sauf une GRILLE — seul
    // le souffle passe. Le lien VAPORISATION est sa clef.
    box(3470, -1800, 3560, -550, MAT_WALL, 5),
    box(3560, -640, 3740, -550, MAT_GRILLE),
    box(3740, -640, 4000, -550, MAT_WALL, 5),
  ],
  sponges: [
    // le dernier casier du placard : l'éponge — elle boit, elle ne rend rien
    // (rangée au placard : la salle d'étalonnage appartient au comptoir)
    { minX: -290, minY: -1700, cols: 3, rows: 3, cellSize: 30, capacityPerCell: 5 },
  ],
  decals: [
    // L'ÉCRAN DE CONTRÔLE de la salle d'observation — SOUS TENSION : la
    // méta-progression est branchée (comptoir, banc des mémoires).
    // Ratio du fichier : 938/753 ≈ 1,246 — respecté pour ne pas l'écraser.
    { x: -1350, y: 1150, w: 380, h: 473, kind: 'ecran-on', fade: 0.95 },
  ],
  labels: [
    // Toute la signalétique est en PLAQUES (« SUR-TITRE|TITRE »). Le RANG
    // départage quand la place manque : « secteur » nomme un LIEU et
    // survit au dézoom (c'est la légende du plan) ; sans rang, la pancarte
    // commente un objet et s'efface dès qu'elle gênerait.
    // ─── la cuve
    { x: -3200, y: 1300, text: 'MODULE MÉDUSE — SECTEUR 01|CUVE D’ENTRAÎNEMENT', tone: 'mur', rang: 'secteur' },
    { x: -3200, y: -1400, text: 'NOTE DE SERVICE|LES CRÉATEURS OBSERVENT', tone: 'froid' },
    // ─── l'observation (nord)
    { x: -1350, y: 1300, text: 'ACCÈS CRÉATEURS|SALLE D’OBSERVATION', tone: 'mur', rang: 'secteur' },
    { x: -1350, y: 900, text: 'ÉCRAN DE CONTRÔLE|HORS TENSION', tone: 'grille' },
    // ─── le placard (sud) : le secteur au-dessus, les énigmes sur leurs
    // casiers — deux hauteurs alternées, 550 unités d'écart chacune
    { x: -1250, y: -900, text: 'SECTEUR 02|PLACARD D’ENTRETIEN', tone: 'mur', rang: 'secteur' },
    { x: -2080, y: -1400, text: 'HYDROPHILE|CE QUI AIME RETIENT', tone: 'phile' },
    { x: -1530, y: -1780, text: 'HYDROPHOBE|CE QUI REPOUSSE PROPULSE', tone: 'phobe' },
    { x: -980, y: -1400, text: 'PLAQUE FROIDE|LE FROID FIGE, LE FIGÉ FILE', tone: 'froid' },
    { x: -430, y: -1780, text: 'ÉVENT|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    { x: -245, y: -1400, text: 'ÉPONGE|ELLE BOIT, NE REND RIEN', tone: 'eponge' },
    // ─── le comptoir et le banc des mémoires (l'ancien « étalonnage »)
    { x: 900, y: 1450, text: 'SECTEUR 03|COMPTOIR & MÉMOIRES', tone: 'mur', rang: 'secteur' },
    { x: 1650, y: 480, text: 'LE BANC DES MÉMOIRES|TISSER LES LIENS', tone: 'froid' },
    { x: 1030, y: -1200, text: 'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE', tone: 'chaud', rang: 'secteur' },
    { x: 220, y: -1470, text: 'VIATIQUE DE GOUTTES|3 MÉMOIRE', tone: 'phile' },
    { x: 760, y: -1470, text: 'CLEF DE CACHETTE|4 MÉMOIRE', tone: 'phobe' },
    { x: 1300, y: -1470, text: 'SAC SURPRISE|3 MÉMOIRE', tone: 'chaud' },
    { x: 1840, y: -1470, text: 'ÉCHANTILLON DE SECOURS|8 MÉMOIRE', tone: 'froid' },
    // ─── le conduit et les trois départs
    { x: 2900, y: 1400, text: 'SECTEUR 04|CONDUIT DE VENTILATION', tone: 'grille', rang: 'secteur' },
    { x: 3520, y: 300, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas', rang: 'secteur' },
    { x: 3640, y: 1250, text: 'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE', tone: 'froid', rang: 'secteur' },
    { x: 3650, y: 800, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    { x: 3780, y: -1150, text: 'SORTIE DE VAPEUR|LA DESCENTE DU JOUR', tone: 'grille', rang: 'secteur' },
    { x: 3650, y: -420, text: 'GRILLE|SEUL LE SOUFFLE PASSE', tone: 'grille' },
  ],
}


// ═══════════════════════════════════════════════════════════════════════
// LE HUB COMPACT (bible v3.1, chantier DÉMO 2) — construit EN PARALLÈLE du
// hub actuel, accessible par le bouton « HUB COMPACT » de la fiche d'essai.
// Un petit module, parcellisé à l'ISS : trois chambres de travail reliées
// par des portes alternées. La CUVE à l'ouest, le POSTE DE GESTION au
// centre — ses pictogrammes d'état décrivent comment les HUMAINS gèrent la
// substance (aucun impact joueur, volontairement énigmatique) —, l'alcôve
// de CONSERVATION au nord (les fioles des semblables — asset du
// concepteur, deux occupées et une vide), et le SAS DE LANCEMENT à l'est. La bascule remplacera le hub actuel quand
// le module sera validé.
//
// Les notes des pictogrammes sont les VRAIES règles du jeu (0 inefficace ·
// 1 confine · 2 efficace · 3 outil idéal) :
//   ÉPONGE       eau 3 (elle boit)      glace 1        vapeur 1
//   PLAQUE FROIDE eau 3 (elle fige)     glace 1        vapeur 2 (rosée)
//   CHAUDIÈRE    eau 2 (elle vaporise)  glace 3 (dégel) vapeur 0
//   ÉVENT        eau 1                  glace 1        vapeur 0 (traverse)
//   MEMBRANE     eau 0 (traverse)       glace 1        vapeur 1
//   RIDEAU       eau 1                  glace 0 (écarte) vapeur 1
//   SURCHAUFFEUR eau 1                  glace 1        vapeur 0 (le frôle)
export const TABLEAU_HUB_COMPACT: LevelDef = {
  name: 'Le module Méduse — compact',
  code: 'HUB2',
  journal:
    'Module d’accueil, configuration compacte (chantier de refonte). Le poste de gestion affiche les procédures de contention par état.',
  par: 3,
  ambiante: 0.42,
  bounds: { minX: -1750, minY: -800, maxX: 1750, maxY: 800 },
  spawn: { x: -1400, y: 0, n: 900 },
  exit: { minX: 1560, minY: -120, maxX: 1700, maxY: 120 },
  boxes: [
    // ═══ LA CUVE (ouest, −1750..−900) : la chambre de naissance ════════
    // cloison cuve | poste — porte BASSE (y −420..−80)
    box(-900, -80, -900 + CLOISON, 800, MAT_WALL, 6),
    box(-900, -800, -900 + CLOISON, -420, MAT_WALL, 1),

    // ═══ LE POSTE DE GESTION (centre, −900..700) ═══════════════════════
    // l'alcôve de CONSERVATION au nord : trois niches à fioles
    box(-620, 520, -560, 800, MAT_WALL, 3),
    box(-180, 520, -120, 800, MAT_WALL, 3),
    box(260, 520, 320, 800, MAT_WALL, 3),
    // l'établi bas du poste (un plan de travail, on passe au-dessus)
    box(-500, -800, 400, -700, MAT_WALL, 2),

    // cloison poste | sas — porte HAUTE (y 140..480)
    box(700, 480, 700 + CLOISON, 800, MAT_WALL, 4),
    box(700, -800, 700 + CLOISON, 140, MAT_WALL, 4),

    // ═══ LE SAS (est, 700..1750) : une chicane courte puis la sortie ═══
    box(1150, -800, 1220, 300, MAT_WALL, 5),
  ],
  sponges: [],
  lumieres: [
    { x: -1350, y: 250, h: 520, intensite: 0.9, couleur: '#9fd4ee' }, // la cuve : froide
    { x: -100, y: 100, h: 620, intensite: 1.05 }, // le poste : neutre, large
    { x: 1450, y: 250, h: 380, intensite: 0.95, couleur: '#8fe6b0' }, // le sas : verte
  ],
  decals: [
    // l'écran de contrôle veille sur le poste de gestion
    { x: -700, y: 340, w: 300, h: 374, kind: 'ecran-off', fade: 0.95 },
    // l'alcôve de CONSERVATION : les fioles des semblables, une par niche.
    // Deux occupées, une VIDE au centre — sous « NE PAS RÉVEILLER », la
    // question s'impose d'elle-même : où est passé celui-là ?
    { x: -370, y: 610, w: 75, h: 380, kind: 'fiole-pleine', fade: 0.98 },
    { x: 70, y: 610, w: 75, h: 380, kind: 'fiole-vide', fade: 0.98 },
    { x: 510, y: 610, w: 75, h: 380, kind: 'fiole-pleine', fade: 0.98, flip: true },
  ],
  labels: [
    // ─── les lieux (plan large)
    { x: -1350, y: 620, text: 'MODULE MÉDUSE|LA CUVE', tone: 'mur', rang: 'secteur' },
    { x: -100, y: -260, text: 'POSTE DE GESTION|PROCÉDURES DE CONTENTION', tone: 'mur', rang: 'secteur' },
    { x: 1450, y: 560, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas', rang: 'secteur' },
    // ─── l'alcôve des fioles (les semblables, asset du concepteur)
    { x: -150, y: 700, text: 'CONSERVATION|NE PAS RÉVEILLER', tone: 'froid' },
    // ─── LES PICTOGRAMMES D'ÉTAT, alignés au-dessus de l'établi :
    // sept moyens de contention, notés par état — sans un mot
    { x: -660, y: -580, text: '', tone: 'eponge', picto: { couleur: '#d9a441', eau: 3, glace: 1, vapeur: 1 } },
    { x: -440, y: -580, text: '', tone: 'froid', picto: { couleur: '#8fc8ee', eau: 3, glace: 1, vapeur: 2 } },
    { x: -220, y: -580, text: '', tone: 'chaud', picto: { couleur: '#e8843c', eau: 2, glace: 3, vapeur: 0 } },
    { x: 0, y: -580, text: '', tone: 'grille', picto: { couleur: '#7fae9e', eau: 1, glace: 1, vapeur: 0 } },
    { x: 220, y: -580, text: '', tone: 'phile', picto: { couleur: '#3fae9c', eau: 0, glace: 1, vapeur: 1 } },
    { x: 440, y: -580, text: '', tone: 'mur', picto: { couleur: '#5b7ba6', eau: 1, glace: 0, vapeur: 1 } },
    { x: 660, y: -580, text: '', tone: 'grille', picto: { couleur: '#39c8d8', eau: 1, glace: 1, vapeur: 0 } },
  ],
}
