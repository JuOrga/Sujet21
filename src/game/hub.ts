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

// ─── LE MODULE MÉDUSE (v7) — BÂTI AU KIT DE COQUE ────────────────────────
//
// Le plan du concepteur, cette fois construit avec les STRUCTURES : des
// chambres octogonales reliées par des couloirs, dans le vide spatial.
// Les parois ne sont plus posées une par une — elles sont FABRIQUÉES par
// le kit (structures.ts), et les portes se percent d'elles-mêmes là où un
// couloir mord dans une coque.
//
//   ouest ───────────────────────────────────────────────────────────► est
//                                                          ╭─ GAZ (grille) ─╮
//   ⬡ CUVE ─ ⬡ AUTRES SUJETS ─ ⬡ BANC D'ESSAI ─[MÉMOIRES]─ ⬡ CENTRE ─      ⬡ SAS
//                                                [RECORDS]─ ⬡ ÉTAL ─────────╯
//                                                          ╰─ GLACE (rideau) ╯
//
// Treize structures, 68 blocs de coque : il en reste pour le mobilier. Le
// méta (plots, banc, marchand, ancres) est posé EN DONNÉES par-dessus, et
// tout le module s'ouvre dans l'éditeur, structure par structure.

const EP_COQUE = 70 // l'épaisseur des chambres
const EP_TUBE = 60 // celle des couloirs

const chambre = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  chanfrein: number,
): StructureDef => ({
  type: STRUCT_CHAMBRE,
  minX,
  minY,
  maxX,
  maxY,
  ep: EP_COQUE,
  chanfrein,
})

const couloir = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  extra: Partial<StructureDef> = {},
): StructureDef => ({
  type: STRUCT_COULOIR,
  minX,
  minY,
  maxX,
  maxY,
  ep: EP_TUBE,
  ...extra,
})

/** LE PLAN DU MODULE : les treize coques, d'ouest en est. Les couloirs
 * MORDENT dans les chambres qu'ils relient : c'est ce mordant qui perce
 * les portes — ne pas les raccourcir sans vérifier la traversée. */
export const STRUCTURES_HUB: StructureDef[] = [
  chambre(-4460, -440, -3860, 440, 0), // LA CUVE : la naissance
  couloir(-3940, -180, -3560, 180), // le col de la cuve
  chambre(-3640, -1120, -2360, 1120, 0.16), // L'AILE DES ENDORMIS
  couloir(-2440, -180, -2060, 180), // le col du bac
  chambre(-2140, -980, -1180, 980, 0.18), // LE BAC D'ESSAI
  couloir(-1260, -240, -460, 240), // le couloir des MÉMOIRES
  chambre(-540, -580, 140, 580, 0.3), // LE CENTRE DE CONTRÔLE
  couloir(60, -240, 900, 240), // le couloir des RECORDS
  chambre(820, -620, 2600, 620, 0.2), // LE CARREFOUR ET SON ÉTAL
  couloir(2480, 200, 3620, 500, { angle: -15, bouchon: MAT_GRILLE }), // LE GAZ
  couloir(2480, -500, 3620, -200, { angle: 15, bouchon: MAT_RIDEAU }), // LA GLACE
  couloir(2540, -200, 3540, 200), // la route de l'eau, tout droit
  chambre(3460, -560, 4440, 560, 0.26), // LE SAS DE LANCEMENT
]

export const ZONES_HUB_GRAND: ZonesHub = {
  // l'ÉTAL : quatre alcôves au sud du carrefour
  etal: etalAvecPlots([
    { minX: 1100, minY: -500, maxX: 1300, maxY: -330 },
    { minX: 1420, minY: -500, maxX: 1620, maxY: -330 },
    { minX: 1740, minY: -500, maxX: 1940, maxY: -330 },
    { minX: 2060, minY: -500, maxX: 2260, maxY: -330 },
  ]),
  // LE BANC DES MÉMOIRES : le couloir entre ses deux rails
  banc: { minX: -1230, minY: -180, maxX: -490, maxY: 180 },
  // les deux sorties gardées, derrière leur matière, au fond de leur branche
  sasGivre: { minX: 3190, minY: -351, maxX: 3350, maxY: -231 },
  sasVapeur: { minX: 3190, minY: 231, maxX: 3350, maxY: 351 },
  stations: {
    eclairage: { minX: -360, minY: -140, maxX: -160, maxY: 60 },
    'table-depart': { minX: 3580, minY: 60, maxX: 4060, maxY: 300 },
    'mur-records': { minX: 200, minY: -80, maxX: 760, maxY: 80 },
    'bac-sable': { minX: -1900, minY: -700, maxX: -1700, maxY: -500 },
    distillateur: { minX: -320, minY: -460, maxX: -120, maxY: -260 },
    'aile-endormis': { minX: -3100, minY: -140, maxX: -2900, maxY: 60 },
    'passerelle-4': { minX: 2260, minY: 300, maxX: 2460, maxY: 500 },
  },
  tableDepart: { minX: 3580, minY: 60, maxX: 4060, maxY: 300 },
  sasScelle: { minX: 4080, minY: 300, maxX: 4380, maxY: 500 },
  // les ailes condamnées ont DEUX bouches : la salle-passage garde ses
  // deux moitiés, au nord et au sud du couloir qui la traverse
  portesDegat: {
    'aile-endormis': [
      { minX: -3600, minY: 200, maxX: -2400, maxY: 250 },
      { minX: -3600, minY: -250, maxX: -2400, maxY: -200 },
    ],
    'bac-sable': [
      { minX: -2100, minY: 200, maxX: -1220, maxY: 250 },
      { minX: -2100, minY: -250, maxX: -1220, maxY: -200 },
    ],
    'passerelle-4': [{ minX: 4060, minY: 200, maxX: 4400, maxY: 250 }],
  },
  sceau: { minX: 4060, minY: 260, maxX: 4400, maxY: 300 },
  porteCuve: { minX: -3940, minY: -180, maxX: -3860, maxY: 180 },
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

export const TABLEAU_HUB: LevelDef = {
  name: 'Le module Méduse',
  code: 'HUB',
  journal:
    'Module d’accueil. Depuis l’accident, l’étage tient sur une file de chambres reliées par des couloirs : la cuve, l’aile des endormis, le bac d’essai, les consoles, le carrefour et ses trois routes. Le sujet le parcourt sans jamais hésiter. — Dr N. Véga',
  par: 3,
  ambiante: 0.5,
  bounds: { minX: -4500, minY: -1200, maxX: 4500, maxY: 1200 },
  spawn: { x: -4160, y: 0, n: 900 },
  // le sas de LANCEMENT, au fond de la dernière chambre
  exit: { minX: 4200, minY: -140, maxX: 4360, maxY: 140 },
  // LE TERRAIN DE JEU : les coques. Les parois sont fabriquées au
  // chargement — ici, on ne pose plus que le MOBILIER.
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
    box(-1180, 90, -540, 170, MAT_WALL, 2),
    box(-1180, -170, -540, -90, MAT_WALL, 2),
    // le pupitre du CENTRE DE CONTRÔLE
    box(-420, 380, 20, 450, MAT_WALL, 4),
    // RECORDS : le banc optique des calibrations
    box(180, 90, 780, 170, MAT_WALL, 2),
    box(180, -170, 780, -90, MAT_WALL, 2),
    // LA TABLE DE DÉPART, dans le sas
    box(3620, 100, 4020, 180, MAT_WALL, 7),

    // ═══ L'ÉTAL DU COMPTOIR : cinq cloisons, quatre alcôves ════════════
    box(1040, -520, 1100, -320, MAT_WALL, 2),
    box(1360, -520, 1420, -320, MAT_WALL, 2),
    box(1680, -520, 1740, -320, MAT_WALL, 2),
    box(2000, -520, 2060, -320, MAT_WALL, 2),
    box(2320, -520, 2380, -320, MAT_WALL, 2),
  ],
  sponges: [],
  lumieres: [
    { x: -4160, y: 0, h: 480, intensite: 0.9, couleur: '#9fd4ee' }, // la cuve : froide
    { x: -3000, y: 0, h: 640, intensite: 0.85, couleur: '#a8c6dd' }, // les endormis
    { x: -1660, y: 0, h: 600, intensite: 1.0 }, // le bac d'essai
    { x: -200, y: 0, h: 520, intensite: 1.05 }, // le centre de contrôle
    { x: 1700, y: -120, h: 560, intensite: 0.95, couleur: '#ffd9a8' }, // l'étal : chaude
    { x: 3950, y: 0, h: 480, intensite: 0.95, couleur: '#8fe6b0' }, // le sas : verte
  ],
  decals: [
    // LES SIX ENDORMIS : une fiole par alcôve. Celle du centre-nord est
    // VIDE — sous « NE PAS RÉVEILLER », la question s'impose d'elle-même.
    { x: -3300, y: 700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    { x: -3000, y: 700, w: 90, h: 300, kind: 'fiole-vide', fade: 0.98 },
    { x: -2700, y: 700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: -3300, y: -700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    { x: -3000, y: -700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: -2700, y: -700, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    // les écrans du méta : sous tension une fois les stations réparées
    { x: -200, y: 415, w: 420, h: 140, kind: 'ecran-on', fade: 0.95 },
    { x: 480, y: 130, w: 560, h: 80, kind: 'ecran-on', fade: 0.95 },
    { x: -860, y: 130, w: 600, h: 80, kind: 'ecran-on', fade: 0.95 },
    { x: 3820, y: 140, w: 380, h: 80, kind: 'ecran-on', fade: 0.95 },
    // la machinerie du carrefour
    { x: 1250, y: 380, w: 420, h: 300, kind: 'tuyaux', fade: 0.9 },
    { x: 2050, y: 380, w: 420, h: 300, kind: 'vanne', fade: 0.9 },
  ],
  labels: [
    // ─── les lieux, dans l'ordre de la file
    { x: -4160, y: 300, text: 'MODULE MÉDUSE|LA CUVE', tone: 'mur', rang: 'secteur' },
    {
      x: -3000,
      y: 380,
      text: 'L’AILE DES ENDORMIS|NE PAS RÉVEILLER',
      cle: 'hub.aile-endormis',
      tone: 'froid',
      rang: 'secteur',
    },
    {
      x: -1660,
      y: 420,
      text: 'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU',
      cle: 'hub.bac-sable',
      tone: 'mur',
      rang: 'secteur',
    },
    { x: -860, y: -300, text: 'LE BANC DES MÉMOIRES|TISSER LES LIENS', tone: 'froid' },
    { x: -200, y: -320, text: 'CENTRE DE CONTRÔLE|LA CONDUITE DE L’ÉTAGE', tone: 'mur', rang: 'secteur' },
    {
      x: 480,
      y: -300,
      text: 'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS',
      cle: 'hub.mur-records',
      tone: 'froid',
    },
    { x: 3950, y: -300, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas', rang: 'secteur' },
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
    { x: 1700, y: -180, text: 'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE', tone: 'chaud', rang: 'secteur' },
    { x: 1200, y: -560, text: 'VIATIQUE DE GOUTTES|3 MÉMOIRE', tone: 'phile' },
    { x: 1520, y: -560, text: 'CLEF DE CACHETTE|4 MÉMOIRE', tone: 'phobe' },
    { x: 1840, y: -560, text: 'SAC SURPRISE|3 MÉMOIRE', tone: 'chaud' },
    { x: 2160, y: -560, text: 'ÉCHANTILLON DE SECOURS|8 MÉMOIRE', tone: 'froid' },
    // ─── les deux routes gardées du carrefour
    { x: 3120, y: 470, text: 'SORTIE DE VAPEUR|LA DESCENTE DU JOUR', tone: 'grille', rang: 'secteur' },
    { x: 2760, y: 250, text: 'GRILLE|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    { x: 3120, y: -470, text: 'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE', tone: 'froid', rang: 'secteur' },
    { x: 2760, y: -250, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    // ─── le méta v5 : l'après-accident
    {
      x: 4230,
      y: 430,
      text: 'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR',
      cle: 'hub.secteur-scelle',
      tone: 'sas',
      rang: 'secteur',
    },
    {
      x: 4230,
      y: 130,
      text: 'ACCÈS CONDAMNÉ|DEPUIS L’ACCIDENT',
      cle: 'hub.acces-condamne',
      tone: 'mur',
    },
    {
      x: 3820,
      y: 330,
      text: 'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ',
      cle: 'hub.table-depart',
      tone: 'sas',
    },
    {
      x: -220,
      y: -520,
      text: 'LE DISTILLATEUR|LA PRIME DU RETOUR',
      cle: 'hub.distillateur',
      tone: 'grille',
    },
    // ─── les pictogrammes d'état, au pupitre du centre de contrôle
    { x: -320, y: 240, text: '', tone: 'eponge', picto: { couleur: '#d9a441', eau: 3, glace: 1, vapeur: 1 } },
    { x: -200, y: 240, text: '', tone: 'froid', picto: { couleur: '#8fc8ee', eau: 3, glace: 1, vapeur: 2 } },
    { x: -80, y: 240, text: '', tone: 'chaud', picto: { couleur: '#e8843c', eau: 2, glace: 3, vapeur: 0 } },
  ],
  // LE MARCHAND : le Semblable, derrière son étal
  marchand: { x: 1700, y: -60 },
  // le méta EN DONNÉES : plots, banc et ANCRES suivent le chemin commun —
  // tout se retouche dans l'éditeur, rien n'est deviné par la géométrie
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
