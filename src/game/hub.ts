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
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
  type AncreMeta,
  type LevelDef,
  type ObstacleBox,
  type PlotMeta,
  type RoleAncre,
  type StructureDef,
} from './level'
import { STRUCT_CHAMBRE, STRUCT_COULOIR } from './structures'

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

type RectHub = { minX: number; minY: number; maxX: number; maxY: number }

// le catalogue du comptoir — les MÊMES articles quel que soit le module ;
// seules les alcôves (plots) changent avec la géométrie du hub joué
export const ARTICLES_COMPTOIR = [
  {
    id: 'viatique' as const,
    nom: 'VIATIQUE DE GOUTTES',
    detail: '+0,8 L à la bonbonne, au départ de la prochaine descente',
    icone: '🧪',
    prix: 3,
  },
  {
    id: 'clef' as const,
    nom: 'CLEF DE CACHETTE',
    detail: 'les voiles du premier tableau tomberont d’emblée',
    icone: '🗝️',
    prix: 4,
  },
  {
    id: 'sac' as const,
    nom: 'SAC SURPRISE',
    detail: 'le Semblable ne dit pas ce qu’il y a dedans',
    icone: '🎴',
    prix: 3,
  },
  {
    id: 'secours' as const,
    nom: 'ÉCHANTILLON DE SECOURS',
    detail: '+1 vie pour la prochaine descente',
    icone: '💠',
    prix: 8,
  },
]

function etalAvecPlots(plots: RectHub[]): ArticleHub[] {
  return ARTICLES_COMPTOIR.map((a, i) => ({ ...a, plot: plots[i] }))
}

/** Les ids d'articles que la monnaie MÉMOIRE accepte sur un plot posé —
 * la liste fermée du format (levelIO écarte tout autre id). */
export const ARTICLES_COMPTOIR_IDS = ARTICLES_COMPTOIR.map((a) => a.id)

/** La fiche catalogue d'un article du comptoir (les effets sont des
 * PROVISIONS de la prochaine descente, où que le plot soit posé). */
export function articleComptoir(
  id: string,
): (typeof ARTICLES_COMPTOIR)[number] | null {
  return ARTICLES_COMPTOIR.find((a) => a.id === id) ?? null
}

/** Les zones méta d'un module, converties en PLOTS-DONNÉES : posées dans
 * la définition du tableau, elles suivent le chemin d'exécution commun —
 * le même que les plots qu'on pose dans l'éditeur. */
function metaEnDonnees(z: ZonesHub): {
  plots: PlotMeta[]
  bancMemoires: RectHub
  ancres: AncreMeta[]
} {
  const ancres: AncreMeta[] = []
  for (const [id, r] of Object.entries(z.stations))
    ancres.push({ ...r, role: 'station', id })
  for (const [id, rects] of Object.entries(z.portesDegat))
    for (const r of rects) ancres.push({ ...r, role: 'degat', id })
  ancres.push({ ...z.tableDepart, role: 'table-depart' })
  ancres.push({ ...z.sasScelle, role: 'sas-scelle' })
  ancres.push({ ...z.sceau, role: 'sceau' })
  ancres.push({ ...z.porteCuve, role: 'porte-cuve' })
  ancres.push({ ...z.sasGivre, role: 'sas-givre' })
  ancres.push({ ...z.sasVapeur, role: 'sas-vapeur' })
  return {
    plots: z.etal.map((a) => ({
      ...a.plot,
      article: a.id,
      monnaie: 'memoire' as const,
    })),
    bancMemoires: z.banc,
    ancres,
  }
}

/** Les ZONES MÉTA d'un hub : l'étal du comptoir, le banc des mémoires,
 * et les deux sas gardés. Chaque module (grand, compact) a les siennes —
 * le hub JOUÉ peut venir de la bibliothèque partagée, la géométrie
 * tranche (zonesDuHub). */
export interface ZonesHub {
  etal: ArticleHub[]
  banc: RectHub
  sasGivre: RectHub
  sasVapeur: RectHub
  // ─── le méta v5 : le hub accidenté se répare station par station ───
  /** Les PLOTS des stations de réparation (id de reparations.ts → zone
   * de contact). Le catalogue (noms, prix, dégâts) vit dans
   * reparations.ts ; ici, seulement OÙ l'on paie dans chaque module. */
  stations: Record<string, RectHub>
  /** LA TABLE DE DÉPART : au contact, le récapitulatif de ce qu'on
   * emporte (vies, bonbonne, fioles, provisions) — une fois réparée. */
  tableDepart: RectHub
  /** LE SECTEUR SCELLÉ : l'alcôve de la 4e sortie — condamnée jusqu'à la
   * fin de l'arc du récit. */
  sasScelle: RectHub
  /** Les PORTES DE DÉGÂT : les barrières d'énergie qui condamnent une
   * aile tant que sa station n'est pas réparée (id de station → SES
   * barrières — une aile peut avoir deux bouches, un couloir peut être
   * doublé). Elles passent par level.portes (canal négatif :
   * scénarisées). */
  portesDegat: Record<string, RectHub[]>
  /** LE SCEAU du secteur 4 : la barrière qui tient même passerelle
   * réparée — seule la fin de l'arc du récit la lève. */
  sceau: RectHub
  /** LA PORTE DE LA CUVE : close tant que l'éveil (acte 0) n'est pas
   * joué — le sujet naît ENFERMÉ ; la séquence ALERTE la crève
   * (brèche d'index 0 : cette porte doit rester la PREMIÈRE). */
  porteCuve: RectHub
}

// ─── LE MODULE MÉDUSE (v8) — DES COQUES D'UN SEUL TENANT ─────────────────
//
// Le plan du concepteur, bâti au KIT : chaque lieu est UNE forme creuse du
// moteur (FORME_COQUE), pas un assemblage de pavés. Un module = une boîte.
//
// LA RÈGLE DU KIT : les modules se rejoignent CENTRE DE FACE contre CENTRE
// DE FACE. Toutes les liaisons ont le même gabarit (couloir de 420, passage
// de 300) — c'est ce qui fait qu'un assemblage se lit comme une station et
// non comme un bricolage, et c'est ce qui permet aux portes d'être de
// simples fentes centrées, taillées dans le champ de la forme.
//
//   ouest ───────────────────────────────────────────────────────────► est
//                                             ⬡ GAZ (grille)   ⬡ SECTEUR 4
//                                                  │                 │
//   ⬡ CUVE ─ ⬡ ENDORMIS ─ ⬡ BAC ─[MÉM]─ ⬡ CENTRE ─[REC]─ ⬡ CARREFOUR ─ ⬡ SAS
//                                                  │
//                                             ⬡ GLACE (rideau)
//
// Dix-sept coques, dix-neuf blocs (deux portes de matière en plus) : le
// terrain de jeu entier tient dans un cinquième du budget du moteur.

const EP_HUB = 60 // l'épaisseur de coque, partout la même
const CHANF = 0.26 // le chanfrein des chambres : l'octogone du dessin

const chambre = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): StructureDef => ({
  type: STRUCT_CHAMBRE,
  minX,
  minY,
  maxX,
  maxY,
  ep: EP_HUB,
  chanfrein: CHANF,
})

const couloir = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  bouchon?: number,
): StructureDef => ({
  type: STRUCT_COULOIR,
  minX,
  minY,
  maxX,
  maxY,
  ep: EP_HUB,
  ...(bouchon !== undefined ? { bouchon } : {}),
})

/** LE PLAN DU MODULE : dix-sept coques. Les couloirs MORDENT dans les
 * chambres qu'ils relient, au MILIEU de leur face — ne pas les décaler
 * sans vérifier la traversée : une porte ne s'ouvre qu'au centre. */
export const STRUCTURES_HUB: StructureDef[] = [
  chambre(-4400, -460, -3800, 460), // LA CUVE : la naissance
  couloir(-3880, -210, -3400, 210),
  chambre(-3480, -1100, -2400, 1100), // L'AILE DES ENDORMIS
  couloir(-2480, -210, -2000, 210),
  chambre(-2080, -960, -1200, 960), // LE BAC D'ESSAI
  couloir(-1280, -210, -560, 210), // le couloir des MÉMOIRES
  chambre(-640, -520, 60, 520), // LE CENTRE DE CONTRÔLE
  couloir(-20, -210, 800, 210), // le couloir des RECORDS
  chambre(720, -560, 2560, 560), // LE CARREFOUR ET SON ÉTAL
  couloir(1430, 480, 1850, 980, MAT_GRILLE), // la montée du GAZ
  chambre(1300, 860, 1980, 1180), // LA SORTIE DE VAPEUR
  couloir(1430, -980, 1850, -480, MAT_RIDEAU), // la descente de la GLACE
  chambre(1300, -1180, 1980, -860), // LA SORTIE DE GIVRE
  couloir(2500, -210, 2980, 210),
  chambre(2900, -600, 4400, 600), // LE SAS DE LANCEMENT
  couloir(3440, 540, 3860, 1000), // la passerelle du secteur 4
  chambre(3300, 860, 4000, 1180), // LE SECTEUR 4, SCELLÉ
]


export const ZONES_HUB_GRAND: ZonesHub = {
  // l'ÉTAL : quatre alcôves au sud du carrefour
  etal: etalAvecPlots([
    { minX: 1000, minY: -480, maxX: 1260, maxY: -330 },
    { minX: 1320, minY: -480, maxX: 1580, maxY: -330 },
    { minX: 1640, minY: -480, maxX: 1900, maxY: -330 },
    { minX: 1960, minY: -480, maxX: 2220, maxY: -330 },
  ]),
  // LE BANC DES MÉMOIRES : le couloir entre ses deux rails
  banc: { minX: -1220, minY: -160, maxX: -620, maxY: 160 },
  // les deux sorties gardées, au fond de leur pod, derrière leur matière
  sasGivre: { minX: 1480, minY: -1110, maxX: 1800, maxY: -1000 },
  sasVapeur: { minX: 1480, minY: 1000, maxX: 1800, maxY: 1110 },
  stations: {
    eclairage: { minX: -420, minY: -100, maxX: -220, maxY: 100 },
    'table-depart': { minX: 3280, minY: 50, maxX: 3720, maxY: 200 },
    'mur-records': { minX: 160, minY: -80, maxX: 720, maxY: 80 },
    'bac-sable': { minX: -1980, minY: -520, maxX: -1780, maxY: -320 },
    distillateur: { minX: -420, minY: -400, maxX: -220, maxY: -200 },
    'aile-endormis': { minX: -3040, minY: -100, maxX: -2840, maxY: 100 },
    'passerelle-4': { minX: 2240, minY: 200, maxX: 2440, maxY: 400 },
  },
  tableDepart: { minX: 3280, minY: 50, maxX: 3720, maxY: 200 },
  sasScelle: { minX: 3450, minY: 960, maxX: 3850, maxY: 1120 },
  // les ailes condamnées ont DEUX bouches : la salle-passage garde ses
  // deux moitiés, au nord et au sud du couloir qui la traverse
  portesDegat: {
    'aile-endormis': [
      { minX: -3420, minY: 220, maxX: -2460, maxY: 270 },
      { minX: -3420, minY: -270, maxX: -2460, maxY: -220 },
    ],
    'bac-sable': [
      { minX: -2020, minY: 220, maxX: -1260, maxY: 270 },
      { minX: -2020, minY: -270, maxX: -1260, maxY: -220 },
    ],
    'passerelle-4': [{ minX: 3440, minY: 620, maxX: 3860, maxY: 670 }],
  },
  sceau: { minX: 3440, minY: 700, maxX: 3860, maxY: 750 },
  porteCuve: { minX: -3880, minY: -210, maxX: -3800, maxY: 210 },
}

export const TABLEAU_HUB: LevelDef = {
  name: 'Le module Méduse',
  code: 'HUB',
  journal:
    'Module d’accueil. Depuis l’accident, l’étage tient sur une file de chambres reliées par des couloirs : la cuve, l’aile des endormis, le bac d’essai, les consoles, le carrefour et ses trois routes. Le sujet le parcourt sans jamais hésiter. — Dr N. Véga',
  par: 3,
  ambiante: 0.5,
  bounds: { minX: -4500, minY: -1200, maxX: 4500, maxY: 1200 },
  spawn: { x: -4100, y: 0, n: 900 },
  exit: { minX: 4150, minY: -140, maxX: 4310, maxY: 140 },
  // LE TERRAIN DE JEU : dix-sept coques. Les parois viennent de là — ici,
  // on ne pose plus que le MOBILIER.
  structures: STRUCTURES_HUB,
  coque: 'structures',
  boxes: [
    // ═══ LE BAC D'ESSAI : toutes les surfaces, sans enjeu ══════════════
    box(-2000, 700, -1860, 780, MAT_CHAUD),
    box(-1820, 700, -1680, 780, MAT_MEMBRANE),
    box(-1640, 700, -1500, 780, MAT_RIDEAU),
    box(-1460, 700, -1320, 780, MAT_SURCHAUFFEUR),
    box(-2000, -780, -1860, -700, MAT_HYDROPHILE),
    box(-1820, -780, -1680, -700, MAT_HYDROPHOBE),
    box(-1640, -780, -1500, -700, MAT_FROID),
    box(-1460, -780, -1320, -700, MAT_GRILLE),

    // ═══ LES CONSOLES DES COULOIRS ═════════════════════════════════════
    // MÉMOIRES : deux rails qui encadrent le passage — le corps qui les
    // frôle ouvre l'écran du cycle des états
    box(-1200, 100, -640, 140, MAT_WALL, 2),
    box(-1200, -140, -640, -100, MAT_WALL, 2),
    // le pupitre du CENTRE DE CONTRÔLE
    box(-540, 330, -60, 400, MAT_WALL, 4),
    // RECORDS : le banc optique des calibrations
    box(40, 100, 740, 140, MAT_WALL, 2),
    box(40, -140, 740, -100, MAT_WALL, 2),
    // LA TABLE DE DÉPART, dans le sas
    box(3300, 90, 3700, 160, MAT_WALL, 7),

    // ═══ L'ÉTAL DU COMPTOIR : cinq cloisons, quatre alcôves ════════════
    box(940, -500, 1000, -320, MAT_WALL, 2),
    box(1260, -500, 1320, -320, MAT_WALL, 2),
    box(1580, -500, 1640, -320, MAT_WALL, 2),
    box(1900, -500, 1960, -320, MAT_WALL, 2),
    box(2220, -500, 2280, -320, MAT_WALL, 2),
  ],
  sponges: [],
  // QUATRE LAMPES, PAS SIX. Le moteur n'en allume que MAX_LUMIERES (4) : les
  // six posées ici laissaient les deux dernières — l'étal et le sas —
  // ÉTEINTES, et tout l'est du module vivait de la lumière qui fuyait par
  // dessus les murs de l'ouest. Depuis que les coques montent au plafond,
  // cette fuite n'existe plus : mesuré coque par coque, le sas tombait à
  // 0,33, la passerelle à 0,26, le secteur 4 à 0,26.
  //
  // Les deux lampes de l'ouest deviennent donc des BANDEAUX de 1600 u (le
  // maximum que le moteur tient : la demi-longueur est bornée à 800). Un
  // bandeau éclaire depuis le point de son segment le plus proche du texel —
  // un seul en couvre trois coques d'affilée, chambre-couloir-chambre, et
  // l'ouest garde exactement son clair d'avant avec deux lampes au lieu de
  // quatre. Elles sont posées SANS CORPS (taille 0) : le segment traverse
  // les cloisons, un luminaire dessiné se coucherait en travers des murs.
  lumieres: [
    // la cuve → l'aile des endormis : x de -4050 à -2450
    {
      x: -3250,
      y: 0,
      h: 640,
      intensite: 0.9,
      couleur: '#9fd4ee',
      forme: 'bandeau',
      longueur: 1600,
      taille: 0,
    },
    // le bac d'essai → le couloir des MÉMOIRES → le centre de contrôle
    {
      x: -900,
      y: 0,
      h: 640,
      intensite: 1.0,
      forme: 'bandeau',
      longueur: 1600,
      taille: 0,
    },
    { x: 1640, y: -120, h: 620, intensite: 0.95, couleur: '#ffd9a8' }, // l'étal
    { x: 3650, y: 0, h: 560, intensite: 0.95, couleur: '#8fe6b0' }, // le sas
  ],
  decals: [
    // LES SIX ENDORMIS : une fiole par alcôve. Celle du centre-nord est
    // VIDE — sous « NE PAS RÉVEILLER », la question s'impose d'elle-même.
    { x: -3260, y: 700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    { x: -2940, y: 700, w: 90, h: 300, kind: 'fiole-vide', fade: 0.98 },
    { x: -2620, y: 700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: -3260, y: -700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    { x: -2940, y: -700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: -2620, y: -700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    // les écrans du méta : sous tension une fois les stations réparées
    { x: -300, y: 365, w: 440, h: 130, kind: 'ecran-on', fade: 0.95 },
    { x: 390, y: 120, w: 620, h: 70, kind: 'ecran-on', fade: 0.95 },
    { x: -920, y: 120, w: 520, h: 70, kind: 'ecran-on', fade: 0.95 },
    { x: 3500, y: 125, w: 380, h: 70, kind: 'ecran-on', fade: 0.95 },
    // la machinerie du carrefour
    { x: 1000, y: 320, w: 420, h: 300, kind: 'tuyaux', fade: 0.9 },
    { x: 2280, y: 320, w: 420, h: 300, kind: 'vanne', fade: 0.9 },
  ],
  labels: [
    // ─── les lieux, dans l'ordre de la file
    { x: -4100, y: 300, text: 'MODULE MÉDUSE|LA CUVE', tone: 'mur', rang: 'secteur' },
    {
      x: -2940,
      y: 380,
      text: 'L’AILE DES ENDORMIS|NE PAS RÉVEILLER',
      cle: 'hub.aile-endormis',
      tone: 'froid',
      rang: 'secteur',
    },
    {
      x: -1640,
      y: 420,
      text: 'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU',
      cle: 'hub.bac-sable',
      tone: 'mur',
      rang: 'secteur',
    },
    { x: -920, y: -300, text: 'LE BANC DES MÉMOIRES|TISSER LES LIENS', tone: 'froid' },
    { x: -290, y: -300, text: 'CENTRE DE CONTRÔLE|LA CONDUITE DE L’ÉTAGE', tone: 'mur', rang: 'secteur' },
    {
      x: 390,
      y: -300,
      text: 'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS',
      cle: 'hub.mur-records',
      tone: 'froid',
    },
    { x: 3650, y: -320, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas', rang: 'secteur' },
    // ─── les surfaces du bac
    { x: -1930, y: 620, text: 'CHAUDIÈRE|ELLE VAPORISE', tone: 'chaud' },
    { x: -1750, y: 850, text: 'MEMBRANE|SEULE L’EAU PASSE', tone: 'phile' },
    { x: -1570, y: 620, text: 'RIDEAU|SEULE LA GLACE', tone: 'froid' },
    { x: -1390, y: 850, text: 'SURCHAUFFEUR|UN DASH EN VAPEUR', tone: 'chaud' },
    { x: -1930, y: -620, text: 'HYDROPHILE|ELLE RETIENT', tone: 'phile' },
    { x: -1750, y: -850, text: 'HYDROPHOBE|ELLE REPOUSSE', tone: 'phobe' },
    { x: -1570, y: -620, text: 'PLAQUE FROIDE|ELLE FIGE', tone: 'froid' },
    { x: -1390, y: -850, text: 'ÉVENT|LE SOUFFLE TRAVERSE', tone: 'grille' },
    // ─── le comptoir et ses quatre alcôves
    { x: 1640, y: -180, text: 'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE', tone: 'chaud', rang: 'secteur' },
    { x: 1130, y: -250, text: 'VIATIQUE DE GOUTTES|3 MÉMOIRE', tone: 'phile' },
    { x: 1450, y: -250, text: 'CLEF DE CACHETTE|4 MÉMOIRE', tone: 'phobe' },
    { x: 1770, y: -250, text: 'SAC SURPRISE|3 MÉMOIRE', tone: 'chaud' },
    { x: 2090, y: -250, text: 'ÉCHANTILLON DE SECOURS|8 MÉMOIRE', tone: 'froid' },
    // ─── les deux routes gardées, au bout de leur montée
    { x: 1640, y: 1100, text: 'SORTIE DE VAPEUR|LA DESCENTE DU JOUR', tone: 'grille', rang: 'secteur' },
    { x: 1640, y: 760, text: 'GRILLE|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    { x: 1640, y: -1100, text: 'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE', tone: 'froid', rang: 'secteur' },
    { x: 1640, y: -760, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    // ─── le méta v5 : l'après-accident
    {
      x: 3650,
      y: 1100,
      text: 'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR',
      cle: 'hub.secteur-scelle',
      tone: 'sas',
      rang: 'secteur',
    },
    {
      x: 3650,
      y: 420,
      text: 'ACCÈS CONDAMNÉ|DEPUIS L’ACCIDENT',
      cle: 'hub.acces-condamne',
      tone: 'mur',
    },
    {
      x: 3500,
      y: 260,
      text: 'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ',
      cle: 'hub.table-depart',
      tone: 'sas',
    },
    {
      x: -320,
      y: -460,
      text: 'LE DISTILLATEUR|LA PRIME DU RETOUR',
      cle: 'hub.distillateur',
      tone: 'grille',
    },
    // ─── les pictogrammes d'état, au pupitre du centre de contrôle
    { x: -420, y: 200, text: '', tone: 'eponge', picto: { couleur: '#d9a441', eau: 3, glace: 1, vapeur: 1 } },
    { x: -300, y: 200, text: '', tone: 'froid', picto: { couleur: '#8fc8ee', eau: 3, glace: 1, vapeur: 2 } },
    { x: -180, y: 200, text: '', tone: 'chaud', picto: { couleur: '#e8843c', eau: 2, glace: 3, vapeur: 0 } },
  ],
  // LE MARCHAND : le Semblable, derrière son étal
  marchand: { x: 1640, y: -60 },
  // LES CONSOLES DU MODULE : des surfaces de contact qui ouvrent un écran
  // (pupitres.ts). Elles sont posées EN DONNÉES, comme tout le reste du
  // méta — l'éditeur en pose autant qu'il veut, dans n'importe quel
  // tableau ; ici, les trois du module Méduse.
  pupitres: [
    // LE MUR DES RECORDS : la moitié EST du banc optique. On répare en
    // entrant par l'ouest (le plot de la station couvre tout le couloir) —
    // la console, elle, attend plus loin : la réparation et la consultation
    // ne se déclenchent pas du même pas.
    { minX: 430, minY: -80, maxX: 700, maxY: 80, ecran: 'records' as const },
    // LE CENTRE DE CONTRÔLE, sous son pupitre : la conduite de l'étage.
    // Le tableau des avaries n'est PAS gardé par une réparation — c'est
    // précisément quand le module est en panne qu'on vient le lire.
    {
      minX: -540,
      minY: 245,
      maxX: -310,
      maxY: 330,
      ecran: 'reparations' as const,
      titre: 'TABLEAU DES AVARIES',
    },
    {
      minX: -290,
      minY: 245,
      maxX: -60,
      maxY: 330,
      ecran: 'station' as const,
      titre: 'PLAN DU COMPLEXE',
    },
  ],
  // le méta EN DONNÉES : plots, banc et ANCRES suivent le chemin commun
  ...metaEnDonnees(ZONES_HUB_GRAND),
}


// ─── le module COMPACT (TABLEAU_HUB_COMPACT v4, 4500×1600) ───────────────
export const ZONES_HUB_COMPACT: ZonesHub = {
  etal: etalAvecPlots(
    [1460, 1720, 1980, 2240].map((cx) => ({
      minX: cx - 100,
      minY: -760,
      maxX: cx + 100,
      maxY: -580,
    })),
  ),
  // l'ÉTABLI du poste de gestion devient le banc : la zone ENVELOPPE le
  // plan de travail — le contact du corps contre lui ouvre l'écran
  banc: { minX: -500, minY: -800, maxX: 400, maxY: -520 },
  sasGivre: { minX: 2600, minY: 580, maxX: 2720, maxY: 780 },
  sasVapeur: { minX: 2600, minY: -780, maxX: 2720, maxY: -580 },
  stations: {
    eclairage: { minX: -350, minY: -150, maxX: -150, maxY: 50 },
    'table-depart': { minX: 1300, minY: 60, maxX: 1750, maxY: 280 },
    'mur-records': { minX: -800, minY: 150, maxX: -520, maxY: 500 },
    'bac-sable': { minX: -1720, minY: -540, maxX: -1520, maxY: -340 },
    distillateur: { minX: 1240, minY: -340, maxX: 1440, maxY: -140 },
    'aile-endormis': { minX: -400, minY: 300, maxX: -100, maxY: 500 },
    'passerelle-4': { minX: 1650, minY: 300, maxX: 1950, maxY: 480 },
  },
  tableDepart: { minX: 1300, minY: 60, maxX: 1750, maxY: 280 },
  sasScelle: { minX: 1600, minY: 560, maxX: 2000, maxY: 800 },
  portesDegat: {
    'bac-sable': [{ minX: -1720, minY: -630, maxX: -940, maxY: -590 }],
    'aile-endormis': [{ minX: -560, minY: 465, maxX: 260, maxY: 510 }],
    'passerelle-4': [{ minX: 1600, minY: 500, maxX: 2000, maxY: 555 }],
  },
  sceau: { minX: 1620, minY: 690, maxX: 1980, maxY: 735 },
  porteCuve: { minX: -900, minY: -420, maxX: -810, maxY: -80 },
}

/** LE RECTANGLE NUL : l'ancre absente d'un module rebâti à la main. Les
 * tests de contact sont STRICTS (> et <) : rien n'est jamais dedans — la
 * fonction qui manque ne s'active tout simplement pas. */
export const RECT_NUL: RectHub = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

/** Une ancre absente ? (le rectangle nul, ou un rectangle sans surface) */
export function ancreAbsente(r: RectHub): boolean {
  return r.maxX <= r.minX || r.maxY <= r.minY
}

/** Les zones méta LUES DANS LE TABLEAU (level.ancres) : le module posé à
 * l'éditeur fait foi. Aucune ancre posée : null — la géométrie tranchera.
 * L'étal et le banc, eux, sont déjà des données (plots, bancMemoires) :
 * ils n'ont plus besoin de ces zones héritées. */
export function zonesPosees(lv: {
  ancres?: readonly AncreMeta[]
  bancMemoires?: RectHub
}): ZonesHub | null {
  const ancres = lv.ancres ?? []
  if (ancres.length === 0) return null
  const z: ZonesHub = {
    etal: [],
    banc: lv.bancMemoires ?? RECT_NUL,
    sasGivre: RECT_NUL,
    sasVapeur: RECT_NUL,
    stations: {},
    tableDepart: RECT_NUL,
    sasScelle: RECT_NUL,
    portesDegat: {},
    sceau: RECT_NUL,
    porteCuve: RECT_NUL,
  }
  const simples: Record<string, (r: RectHub) => void> = {
    'table-depart': (r) => (z.tableDepart = r),
    'sas-scelle': (r) => (z.sasScelle = r),
    sceau: (r) => (z.sceau = r),
    'porte-cuve': (r) => (z.porteCuve = r),
    'sas-givre': (r) => (z.sasGivre = r),
    'sas-vapeur': (r) => (z.sasVapeur = r),
  }
  for (const a of ancres) {
    const r: RectHub = {
      minX: a.minX,
      minY: a.minY,
      maxX: a.maxX,
      maxY: a.maxY,
    }
    if (a.role === 'station') {
      if (a.id) z.stations[a.id] = r
    } else if (a.role === 'degat') {
      if (a.id) (z.portesDegat[a.id] ??= []).push(r)
    } else simples[a.role]?.(r)
  }
  return z
}

/** Les zones méta du hub JOUÉ. Les ANCRES POSÉES font foi (le module
 * rebâti à l'éditeur porte les siennes) ; à défaut, la géométrie tranche
 * pour les vieux instantanés : le grand module, le compact v4, ou null —
 * aucune zone ne s'active à tort. */
export function zonesDuHub(lv: {
  bounds: { maxX: number }
  ancres?: readonly AncreMeta[]
  bancMemoires?: RectHub
}): ZonesHub | null {
  const posees = zonesPosees(lv)
  if (posees) return posees
  if (lv.bounds.maxX >= 3500) return ZONES_HUB_GRAND
  if (lv.bounds.maxX >= 2600) return ZONES_HUB_COMPACT
  return null
}

/** Les rôles d'ancre, pour la palette de l'éditeur et le format. */
export const ROLES_ANCRE: readonly RoleAncre[] = [
  'station',
  'degat',
  'table-depart',
  'sas-scelle',
  'sceau',
  'porte-cuve',
  'sas-givre',
  'sas-vapeur',
]


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
  bounds: { minX: -1750, minY: -800, maxX: 2750, maxY: 800 },
  spawn: { x: -1400, y: 0, n: 900 },
  // le sas PRINCIPAL (l'eau) : la descente écrite — tout à l'est
  exit: { minX: 2560, minY: -120, maxX: 2700, maxY: 120 },
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
    // l'ÉTABLI du poste — devenu LE BANC DES MÉMOIRES : le contact du
    // corps contre le plan de travail ouvre l'écran du cycle des états
    box(-500, -800, 400, -700, MAT_WALL, 2),

    // cloison poste | aile est — porte HAUTE (y 140..480)
    box(700, 480, 700 + CLOISON, 800, MAT_WALL, 4),
    box(700, -800, 700 + CLOISON, 140, MAT_WALL, 4),

    // ═══ L'AILE EST (700..2750) : chicane, comptoir, puis les TROIS sas ═
    box(1150, -800, 1220, 300, MAT_WALL, 5),
    // LE COMPTOIR : les cloisons des quatre alcôves de l'étal, au sud —
    // des niches à trois murs : on y PLONGE pour acheter, en MÉMOIRE
    box(1300, -800, 1360, -560, MAT_WALL, 2),
    box(1560, -800, 1620, -560, MAT_WALL, 2),
    box(1820, -800, 1880, -560, MAT_WALL, 2),
    box(2080, -800, 2140, -560, MAT_WALL, 2),
    box(2340, -800, 2400, -560, MAT_WALL, 2),
    // ─── la CHAMBRE DE GIVRE (nord-est) : murée, sauf un RIDEAU — seule
    // la glace l'écarte. Le lien SOLIDIFICATION non tissé, pas de route.
    box(2400, 360, 2460, 440, MAT_WALL, 5),
    { minX: 2460, minY: 360, maxX: 2620, maxY: 440, material: MAT_RIDEAU },
    box(2620, 360, 2750, 440, MAT_WALL, 5),
    box(2400, 440, 2460, 800, MAT_WALL, 5),
    // ─── la CHAMBRE DE VAPEUR (sud-est) : murée, sauf une GRILLE — seul
    // le souffle passe. Le lien VAPORISATION est sa clef.
    box(2400, -440, 2460, -360, MAT_WALL, 5),
    { minX: 2460, minY: -440, maxX: 2620, maxY: -360, material: MAT_GRILLE },
    box(2620, -440, 2750, -360, MAT_WALL, 5),
    box(2400, -800, 2460, -440, MAT_WALL, 5),

    // ═══ LE MÉTA v5 : l'après-accident, remis en état ═════════════════
    // ─── LE SECTEUR SCELLÉ (nord de l'aile est) : la 4e sortie — vers
    // l'extérieur, vers le télescope. L'encadrement seul est en dur, la
    // condamnation est posée par le code (barrière d'énergie).
    box(1540, 560, 1600, 800, MAT_WALL, 4),
    box(2000, 560, 2060, 800, MAT_WALL, 4),
    // ─── LA TABLE DE DÉPART : le plan de travail qu'on longe avant les
    // sas — il récapitule ce qu'on emporte
    box(1350, 120, 1700, 200, MAT_WALL, 7),
    // ─── LE BAC D'ESSAI (sud de la cuve) : les surfaces qui manquent au
    // poste, à toucher SANS ENJEU
    box(-1700, -700, -1560, -640, MAT_CHAUD),
    box(-1500, -700, -1360, -640, MAT_MEMBRANE),
    box(-1300, -700, -1160, -640, MAT_RIDEAU),
    box(-1100, -700, -960, -640, MAT_SURCHAUFFEUR),
  ],
  sponges: [],
  lumieres: [
    { x: -1350, y: 250, h: 520, intensite: 0.9, couleur: '#9fd4ee' }, // la cuve : froide
    { x: -100, y: 100, h: 620, intensite: 1.05 }, // le poste : neutre, large
    { x: 1700, y: 200, h: 420, intensite: 0.95, couleur: '#ffd9a8' }, // le comptoir : chaude
    { x: 2550, y: 0, h: 380, intensite: 0.95, couleur: '#8fe6b0' }, // les sas : verte
  ],
  decals: [
    // l'écran du MUR DES RECORDS — sous tension une fois réparé
    { x: -700, y: 340, w: 300, h: 374, kind: 'ecran-on', fade: 0.95 },
    // l'alcôve de CONSERVATION : les fioles des semblables, une par niche.
    // Deux occupées, une VIDE au centre — sous « NE PAS RÉVEILLER », la
    // question s'impose d'elle-même : où est passé celui-là ?
    { x: -370, y: 610, w: 75, h: 380, kind: 'fiole-pleine', fade: 0.98 },
    { x: 70, y: 610, w: 75, h: 380, kind: 'fiole-vide', fade: 0.98 },
    {
      x: 510,
      y: 610,
      w: 75,
      h: 380,
      kind: 'fiole-pleine',
      fade: 0.98,
      flip: true,
    },
  ],
  labels: [
    // ─── les lieux (plan large)
    {
      x: -1350,
      y: 620,
      text: 'MODULE MÉDUSE|LA CUVE',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: -100,
      y: -260,
      text: 'POSTE DE GESTION|PROCÉDURES DE CONTENTION',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: 2250,
      y: 160,
      text: 'PROTOCOLE 21|SAS DE LANCEMENT',
      tone: 'sas',
      rang: 'secteur',
    },
    // ─── l'alcôve des fioles (les semblables, asset du concepteur)
    { x: -150, y: 700, text: 'CONSERVATION|NE PAS RÉVEILLER', tone: 'froid' },
    // ─── le banc des mémoires : l'établi du poste, ouvert au contact
    {
      x: -50,
      y: -480,
      text: 'LE BANC DES MÉMOIRES|TISSER LES LIENS',
      tone: 'froid',
    },
    // ─── le comptoir : quatre alcôves au sud de l'aile, prix en MÉMOIRE
    {
      x: 1850,
      y: -340,
      text: 'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE',
      tone: 'chaud',
      rang: 'secteur',
    },
    { x: 1460, y: -460, text: 'VIATIQUE DE GOUTTES|3 MÉMOIRE', tone: 'phile' },
    { x: 1720, y: -530, text: 'CLEF DE CACHETTE|4 MÉMOIRE', tone: 'phobe' },
    { x: 1980, y: -460, text: 'SAC SURPRISE|3 MÉMOIRE', tone: 'chaud' },
    {
      x: 2240,
      y: -530,
      text: 'ÉCHANTILLON DE SECOURS|8 MÉMOIRE',
      tone: 'froid',
    },
    // ─── les deux sorties gardées, au bout de l'aile
    {
      x: 2580,
      y: 650,
      text: 'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE',
      tone: 'froid',
      rang: 'secteur',
    },
    { x: 2540, y: 270, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    {
      x: 2580,
      y: -650,
      text: 'SORTIE DE VAPEUR|LA DESCENTE DU JOUR',
      tone: 'grille',
      rang: 'secteur',
    },
    { x: 2540, y: -270, text: 'GRILLE|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    // ─── le méta v5 : l'après-accident, remis en état
    {
      x: 1800,
      y: 730,
      text: 'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR', cle: 'hub.secteur-scelle',
      tone: 'sas',
      rang: 'secteur',
    },
    { x: 1800, y: 480, text: 'ACCÈS CONDAMNÉ|DEPUIS L’ACCIDENT', cle: 'hub.acces-condamne', tone: 'mur' },
    {
      x: 1520,
      y: 330,
      text: 'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ', cle: 'hub.table-depart',
      tone: 'sas',
    },
    {
      x: -1330,
      y: -300,
      text: 'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU', cle: 'hub.bac-sable',
      tone: 'mur',
    },
    { x: -1630, y: -560, text: 'CHAUDIÈRE|ELLE VAPORISE', tone: 'chaud' },
    { x: -1430, y: -480, text: 'MEMBRANE|SEULE L’EAU PASSE', tone: 'phile' },
    { x: -1230, y: -560, text: 'RIDEAU|SEULE LA GLACE', tone: 'froid' },
    { x: -1030, y: -480, text: 'SURCHAUFFEUR|UN DASH EN VAPEUR', tone: 'chaud' },
    {
      x: -700,
      y: 120,
      text: 'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS', cle: 'hub.mur-records',
      tone: 'froid',
    },
    {
      x: 1340,
      y: -240,
      text: 'LE DISTILLATEUR|LA PRIME DU RETOUR', cle: 'hub.distillateur',
      tone: 'grille',
    },
    // ─── LES PICTOGRAMMES D'ÉTAT, alignés au-dessus de l'établi :
    // sept moyens de contention, notés par état — sans un mot
    {
      x: -660,
      y: -580,
      text: '',
      tone: 'eponge',
      picto: { couleur: '#d9a441', eau: 3, glace: 1, vapeur: 1 },
    },
    {
      x: -440,
      y: -580,
      text: '',
      tone: 'froid',
      picto: { couleur: '#8fc8ee', eau: 3, glace: 1, vapeur: 2 },
    },
    {
      x: -220,
      y: -580,
      text: '',
      tone: 'chaud',
      picto: { couleur: '#e8843c', eau: 2, glace: 3, vapeur: 0 },
    },
    {
      x: 0,
      y: -580,
      text: '',
      tone: 'grille',
      picto: { couleur: '#7fae9e', eau: 1, glace: 1, vapeur: 0 },
    },
    {
      x: 220,
      y: -580,
      text: '',
      tone: 'phile',
      picto: { couleur: '#3fae9c', eau: 0, glace: 1, vapeur: 1 },
    },
    {
      x: 440,
      y: -580,
      text: '',
      tone: 'mur',
      picto: { couleur: '#5b7ba6', eau: 1, glace: 0, vapeur: 1 },
    },
    {
      x: 660,
      y: -580,
      text: '',
      tone: 'grille',
      picto: { couleur: '#39c8d8', eau: 1, glace: 1, vapeur: 0 },
    },
  ],
  ...metaEnDonnees(ZONES_HUB_COMPACT),
}
