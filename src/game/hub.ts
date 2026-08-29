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
  type LevelDef,
  type ObstacleBox,
  type PlotMeta,
} from './level'

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
} {
  return {
    plots: z.etal.map((a) => ({
      ...a.plot,
      article: a.id,
      monnaie: 'memoire' as const,
    })),
    bancMemoires: z.banc,
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
   * aile tant que sa station n'est pas réparée (id de station → porte).
   * Elles passent par level.portes (canal négatif : scénarisées). */
  portesDegat: Record<string, RectHub>
  /** LE SCEAU du secteur 4 : la barrière qui tient même passerelle
   * réparée — seule la fin de l'arc du récit la lève. */
  sceau: RectHub
  /** LA PORTE DE LA CUVE : close tant que l'éveil (acte 0) n'est pas
   * joué — le sujet naît ENFERMÉ ; la séquence ALERTE la crève
   * (brèche d'index 0 : cette porte doit rester la PREMIÈRE). */
  porteCuve: RectHub
}

// ─── le GRAND module (TABLEAU_HUB, 8000×3600) ────────────────────────────
export const ZONES_HUB_GRAND: ZonesHub = {
  etal: etalAvecPlots(
    [220, 760, 1300, 1840].map((cx) => ({
      minX: cx - 150,
      minY: -1750,
      maxX: cx + 150,
      maxY: -1560,
    })),
  ),
  banc: { minX: 1330, minY: 60, maxX: 1970, maxY: 420 },
  sasGivre: { minX: 3740, minY: 1500, maxX: 3940, maxY: 1780 },
  sasVapeur: { minX: 3740, minY: -1780, maxX: 3940, maxY: -1500 },
  // les stations, chacune posée CONTRE l'objet qu'elle remet en état,
  // hors des trajets obligés (pas de toast au simple passage)
  stations: {
    eclairage: { minX: -1850, minY: 350, maxX: -1650, maxY: 550 },
    'table-depart': { minX: 2740, minY: -140, maxX: 3180, maxY: 140 },
    'mur-records': { minX: -700, minY: 900, maxX: -250, maxY: 1300 },
    'bac-sable': { minX: -3980, minY: -1300, maxX: -3780, maxY: -1100 },
    distillateur: { minX: 450, minY: 420, maxX: 950, maxY: 660 },
    'aile-endormis': { minX: -3500, minY: 700, maxX: -3200, maxY: 950 },
    'passerelle-4': { minX: 3480, minY: 200, maxX: 3680, maxY: 500 },
  },
  tableDepart: { minX: 2740, minY: -140, maxX: 3180, maxY: 140 },
  sasScelle: { minX: 3760, minY: 250, maxX: 3940, maxY: 450 },
  portesDegat: {
    'bac-sable': { minX: -3980, minY: -1390, maxX: -2500, maxY: -1340 },
    'aile-endormis': { minX: -3720, minY: 1030, maxX: -3080, maxY: 1080 },
    'passerelle-4': { minX: 3700, minY: 250, maxX: 3740, maxY: 450 },
  },
  sceau: { minX: 3860, minY: 250, maxX: 3900, maxY: 450 },
  porteCuve: { minX: -2400, minY: -220, maxX: -2310, maxY: 220 },
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
    'bac-sable': { minX: -1720, minY: -630, maxX: -940, maxY: -590 },
    'aile-endormis': { minX: -560, minY: 465, maxX: 260, maxY: 510 },
    'passerelle-4': { minX: 1600, minY: 500, maxX: 2000, maxY: 555 },
  },
  sceau: { minX: 1620, minY: 690, maxX: 1980, maxY: 735 },
  porteCuve: { minX: -900, minY: -420, maxX: -810, maxY: -80 },
}

/** Les zones méta du hub JOUÉ — la géométrie tranche : le grand module,
 * le compact v4, ou null (un vieil instantané de la bibliothèque, sans
 * annexe méta : aucune zone ne s'active à tort). */
export function zonesDuHub(lv: { bounds: { maxX: number } }): ZonesHub | null {
  if (lv.bounds.maxX >= 3500) return ZONES_HUB_GRAND
  if (lv.bounds.maxX >= 2600) return ZONES_HUB_COMPACT
  return null
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

    // ═══ LE MÉTA v5 : le module d'après l'accident, remis en état ═════
    // ─── LE SECTEUR SCELLÉ (mur est, au nord du sas de lancement) : la
    // 4e sortie — vers l'EXTÉRIEUR, vers le télescope. Condamnée jusqu'à
    // la fin de l'arc du récit (la barrière est posée par le code, pas
    // par ces murs : l'encadrement seul est en dur).
    box(3700, 190, 3960, 250, MAT_WALL, 4),
    box(3700, 450, 3960, 510, MAT_WALL, 4),
    // ─── LA TABLE DE DÉPART : le plan de travail du conduit — on le
    // longe entre les deux chicanes, il récapitule ce qu'on emporte
    box(2800, -60, 3120, 60, MAT_WALL, 7),
    // ─── LE BAC D'ESSAI (sud de la cuve) : les surfaces que le placard
    // ne montre pas, à toucher SANS ENJEU — le tutoriel permanent
    box(-3880, -1500, -3640, -1420, MAT_CHAUD),
    box(-3520, -1500, -3280, -1420, MAT_MEMBRANE),
    box(-3160, -1500, -2920, -1420, MAT_RIDEAU),
    box(-2800, -1500, -2560, -1420, MAT_SURCHAUFFEUR),
  ],
  sponges: [
    // le dernier casier du placard : l'éponge — elle boit, elle ne rend rien
    // (rangée au placard : la salle d'étalonnage appartient au comptoir)
    {
      minX: -290,
      minY: -1700,
      cols: 3,
      rows: 3,
      cellSize: 30,
      capacityPerCell: 5,
    },
  ],
  decals: [
    // L'ÉCRAN DE CONTRÔLE de la salle d'observation — SOUS TENSION : la
    // méta-progression est branchée (comptoir, banc des mémoires).
    // Ratio du fichier : 938/753 ≈ 1,246 — respecté pour ne pas l'écraser.
    { x: -1350, y: 1150, w: 380, h: 473, kind: 'ecran-on', fade: 0.95 },
    // LE MUR DES RECORDS (est de l'observation) : le banc optique des
    // calibrations — son écran s'éteint tant qu'il n'est pas réparé
    { x: -450, y: 1150, w: 300, h: 374, kind: 'ecran-on', fade: 0.95 },
    // L'AILE DES ENDORMIS (nord de la cuve) : les essais d'avant, en
    // capsule — deux occupées, une vide. Qui était dans celle du centre ?
    { x: -3650, y: 1350, w: 110, h: 560, kind: 'fiole-pleine', fade: 0.98 },
    { x: -3400, y: 1350, w: 110, h: 560, kind: 'fiole-vide', fade: 0.98 },
    {
      x: -3150,
      y: 1350,
      w: 110,
      h: 560,
      kind: 'fiole-pleine',
      fade: 0.98,
      flip: true,
    },
  ],
  labels: [
    // Toute la signalétique est en PLAQUES (« SUR-TITRE|TITRE »). Le RANG
    // départage quand la place manque : « secteur » nomme un LIEU et
    // survit au dézoom (c'est la légende du plan) ; sans rang, la pancarte
    // commente un objet et s'efface dès qu'elle gênerait.
    // ─── la cuve
    {
      x: -3200,
      y: 1300,
      text: 'MODULE MÉDUSE — SECTEUR 01|CUVE D’ENTRAÎNEMENT',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: -3200,
      y: -1400,
      text: 'NOTE DE SERVICE|LES CRÉATEURS OBSERVENT',
      tone: 'froid',
    },
    // ─── l'observation (nord)
    {
      x: -1350,
      y: 1300,
      text: 'ACCÈS CRÉATEURS|SALLE D’OBSERVATION',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: -1350,
      y: 900,
      text: 'ÉCRAN DE CONTRÔLE|HORS TENSION',
      tone: 'grille',
    },
    // ─── le placard (sud) : le secteur au-dessus, les énigmes sur leurs
    // casiers — deux hauteurs alternées, 550 unités d'écart chacune
    {
      x: -1250,
      y: -900,
      text: 'SECTEUR 02|PLACARD D’ENTRETIEN',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: -2080,
      y: -1400,
      text: 'HYDROPHILE|CE QUI AIME RETIENT',
      tone: 'phile',
    },
    {
      x: -1530,
      y: -1780,
      text: 'HYDROPHOBE|CE QUI REPOUSSE PROPULSE',
      tone: 'phobe',
    },
    {
      x: -980,
      y: -1400,
      text: 'PLAQUE FROIDE|LE FROID FIGE, LE FIGÉ FILE',
      tone: 'froid',
    },
    { x: -430, y: -1780, text: 'ÉVENT|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    {
      x: -245,
      y: -1400,
      text: 'ÉPONGE|ELLE BOIT, NE REND RIEN',
      tone: 'eponge',
    },
    // ─── le comptoir et le banc des mémoires (l'ancien « étalonnage »)
    {
      x: 900,
      y: 1450,
      text: 'SECTEUR 03|COMPTOIR & MÉMOIRES',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: 1650,
      y: 480,
      text: 'LE BANC DES MÉMOIRES|TISSER LES LIENS',
      tone: 'froid',
    },
    {
      x: 1030,
      y: -1200,
      text: 'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE',
      tone: 'chaud',
      rang: 'secteur',
    },
    { x: 220, y: -1470, text: 'VIATIQUE DE GOUTTES|3 MÉMOIRE', tone: 'phile' },
    { x: 760, y: -1470, text: 'CLEF DE CACHETTE|4 MÉMOIRE', tone: 'phobe' },
    { x: 1300, y: -1470, text: 'SAC SURPRISE|3 MÉMOIRE', tone: 'chaud' },
    {
      x: 1840,
      y: -1470,
      text: 'ÉCHANTILLON DE SECOURS|8 MÉMOIRE',
      tone: 'froid',
    },
    // ─── le conduit et les trois départs
    {
      x: 2900,
      y: 1400,
      text: 'SECTEUR 04|CONDUIT DE VENTILATION',
      tone: 'grille',
      rang: 'secteur',
    },
    {
      x: 3520,
      y: 300,
      text: 'PROTOCOLE 21|SAS DE LANCEMENT',
      tone: 'sas',
      rang: 'secteur',
    },
    {
      x: 3640,
      y: 1250,
      text: 'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE',
      tone: 'froid',
      rang: 'secteur',
    },
    { x: 3650, y: 800, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    {
      x: 3780,
      y: -1150,
      text: 'SORTIE DE VAPEUR|LA DESCENTE DU JOUR',
      tone: 'grille',
      rang: 'secteur',
    },
    { x: 3650, y: -420, text: 'GRILLE|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    // ─── le méta v5 : l'après-accident, remis en état
    {
      x: 3850,
      y: 640,
      text: 'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR',
      tone: 'sas',
      rang: 'secteur',
    },
    { x: 3560, y: 100, text: 'ACCÈS CONDAMNÉ|DEPUIS L’ACCIDENT', tone: 'mur' },
    {
      x: 2960,
      y: 260,
      text: 'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ',
      tone: 'sas',
    },
    {
      x: -3220,
      y: -1100,
      text: 'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU',
      tone: 'mur',
      rang: 'secteur',
    },
    { x: -3760, y: -1280, text: 'CHAUDIÈRE|ELLE VAPORISE, ELLE DÉGÈLE', tone: 'chaud' },
    { x: -3400, y: -1650, text: 'MEMBRANE|SEULE L’EAU TRAVERSE', tone: 'phile' },
    { x: -3040, y: -1280, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    { x: -2680, y: -1650, text: 'SURCHAUFFEUR|FRÔLÉ EN VAPEUR, UN DASH', tone: 'chaud' },
    {
      x: -450,
      y: 1450,
      text: 'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS',
      tone: 'froid',
    },
    {
      x: -3400,
      y: 1700,
      text: 'L’AILE DES ENDORMIS|NE PAS RÉVEILLER',
      tone: 'froid',
    },
    {
      x: 700,
      y: 560,
      text: 'LE DISTILLATEUR|LA PRIME DU RETOUR',
      tone: 'grille',
    },
  ],
  // le méta EN DONNÉES : comptoir et banc suivent le chemin commun des
  // plots posés — zonesDuHub ne sert plus qu'aux vieux instantanés (et
  // aux sas gardés, qui restent géométriques)
  ...metaEnDonnees(ZONES_HUB_GRAND),
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
      text: 'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR',
      tone: 'sas',
      rang: 'secteur',
    },
    { x: 1800, y: 480, text: 'ACCÈS CONDAMNÉ|DEPUIS L’ACCIDENT', tone: 'mur' },
    {
      x: 1520,
      y: 330,
      text: 'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ',
      tone: 'sas',
    },
    {
      x: -1330,
      y: -300,
      text: 'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU',
      tone: 'mur',
    },
    { x: -1630, y: -560, text: 'CHAUDIÈRE|ELLE VAPORISE', tone: 'chaud' },
    { x: -1430, y: -480, text: 'MEMBRANE|SEULE L’EAU PASSE', tone: 'phile' },
    { x: -1230, y: -560, text: 'RIDEAU|SEULE LA GLACE', tone: 'froid' },
    { x: -1030, y: -480, text: 'SURCHAUFFEUR|UN DASH EN VAPEUR', tone: 'chaud' },
    {
      x: -700,
      y: 120,
      text: 'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS',
      tone: 'froid',
    },
    {
      x: 1340,
      y: -240,
      text: 'LE DISTILLATEUR|LA PRIME DU RETOUR',
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
