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
  type DecalDef,
  type LevelDef,
  type ObstacleBox,
  type PlotMeta,
  type RoleAncre,
  type StructureDef,
  type WorldLabel,
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

// ─── LE MODULE MÉDUSE (v9) — UNE ROTONDE, PAS UNE FILE ───────────────────
//
// Le plan v8 était une FILE : six chambres alignées sur 9 000 unités, et
// le trajet obligé de chaque run — la cuve au sas — traversait tout, y
// compris deux ailes condamnées. Or une seule chose est obligatoire au hub :
// aller de la naissance à la sortie. Tout le reste est un détour CHOISI.
// C'est le fait qui commande ce plan (docs/hub-proposition.md).
//
// Une LIGNE DE VOL droite et courte — la cuve, la rotonde, le sas — et des
// alcôves qui s'ouvrent dessus. Toutes les portes du trajet obligé sont
// centrées sur y = 0 : une seule éjection bien visée porte de la cuve au
// sas. Un détour est perpendiculaire, d'un couloir de profondeur, et l'on
// en ressort par où l'on est entré : on ne TRAVERSE jamais une aile.
//
//                        ⬡ ENDORMIS              ⬡ VAPEUR ═[passerelle]═ ⬡ SECTEUR 4
//                             ║                  (grille)               (scellé)
//   ⬡ CUVE ═══ ⬡ ROTONDE ═══════════ ⬡ SAS À TROIS BOUCHES ──▶ EAU (le sas)
//                             ║                  (rideau)
//                        ⬡ BAC D'ESSAI           ⬡ GIVRE
//
// LA ROTONDE tient tout ce qu'on fait avant de partir, sur ses quatre
// quartiers — rien à retenir, tout se voit du centre : le banc des mémoires
// au nord-ouest, le comptoir du Semblable au sud-ouest, le mur des records
// et les consoles au nord-est, la vitrine et le codex au sud-est. LE SAS est
// le seuil : on y longe la table de départ et l'on choisit sa sortie par son
// état, les trois bouches côte à côte. La route du télescope (secteur 4)
// part de la sortie de vapeur : c'est une décision de ce plan, pas du canon
// — le kit ne perce qu'une porte par face, et le sas n'en a plus de libre.
//
// LA RÈGLE DU KIT : les modules se rejoignent CENTRE DE FACE contre CENTRE
// DE FACE, couloir de 420, passage de 300. Quinze coques, dix-sept blocs.

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

/** LE PLAN DU MODULE : quinze coques. Les couloirs MORDENT de 80 dans les
 * chambres qu'ils relient, au MILIEU de leur face — ne pas les décaler
 * sans vérifier la traversée : une porte ne s'ouvre qu'au centre. */
export const STRUCTURES_HUB: StructureDef[] = [
  // ─── la ligne de vol (y = 0)
  chambre(-2120, -500, -1220, 500), // 0 LA CUVE : la naissance
  couloir(-1300, -210, -820, 210), // 1 la porte de la cuve
  chambre(-900, -900, 900, 900), // 2 LA ROTONDE : le poste de gestion
  couloir(820, -210, 1300, 210), // 3 vers le seuil
  chambre(1220, -700, 2720, 700), // 4 LE SAS À TROIS BOUCHES
  // ─── les deux ailes de la rotonde
  couloir(-210, 820, 210, 1300), // 5 la montée vers les endormis
  chambre(-600, 1220, 600, 1780), // 6 L'AILE DES ENDORMIS
  couloir(-210, -1300, 210, -820), // 7 la descente vers le bac
  chambre(-600, -1780, 600, -1220), // 8 LE BAC D'ESSAI
  // ─── les deux sorties gardées par leur matière
  couloir(1760, 620, 2180, 1120, MAT_GRILLE), // 9 la montée du GAZ
  chambre(1630, 1000, 2310, 1400), // 10 LA SORTIE DE VAPEUR
  couloir(1760, -1120, 2180, -620, MAT_RIDEAU), // 11 la descente de la GLACE
  chambre(1630, -1400, 2310, -1000), // 12 LA SORTIE DE GIVRE
  // ─── la route du télescope, au-delà de la vapeur
  couloir(2230, 990, 2710, 1410), // 13 la passerelle du secteur 4
  chambre(2630, 990, 3330, 1410), // 14 LE SECTEUR 4, SCELLÉ
]

export const ZONES_HUB_GRAND: ZonesHub = {
  // L'ÉTAL : quatre alcôves en L dans le quartier sud-ouest de la rotonde,
  // deux contre la paroi ouest, deux contre la paroi sud — le Semblable se
  // tient devant, dans l'angle (marchand)
  etal: etalAvecPlots([
    { minX: -830, minY: -565, maxX: -690, maxY: -425 },
    { minX: -830, minY: -355, maxX: -690, maxY: -215 },
    { minX: -565, minY: -830, maxX: -425, maxY: -690 },
    { minX: -355, minY: -830, maxX: -215, maxY: -690 },
  ]),
  // LE BANC DES MÉMOIRES : contre la paroi nord, quartier nord-ouest — la
  // zone ENVELOPPE le banc, le corps qui s'y frotte ouvre l'écran
  banc: { minX: -660, minY: 540, maxX: -160, maxY: 800 },
  // les deux sorties gardées : au fond du pod de givre (le bout sud) ; à
  // l'OUEST du pod de vapeur — l'est y mène à la passerelle, et le corps qui
  // va au secteur 4 ne doit pas lancer une descente en passant
  sasGivre: { minX: 1830, minY: -1330, maxX: 2110, maxY: -1230 },
  sasVapeur: { minX: 1720, minY: 1090, maxX: 1850, maxY: 1310 },
  // LES STATIONS : aucune sur la ligne de vol. Une station se paie AU
  // CONTACT — le trajet obligé ne doit jamais débiter la mémoire à l'insu
  // du joueur (le mur des records du v8 barrait tout son couloir)
  stations: {
    eclairage: { minX: 330, minY: 200, maxX: 490, maxY: 360 },
    'table-depart': { minX: 1620, minY: -340, maxX: 2120, maxY: -180 },
    'mur-records': { minX: 200, minY: 540, maxX: 560, maxY: 690 },
    // les ailes se paient à leur porte, DEPUIS la rotonde : on répare en
    // entrant, et la plaque « EN PANNE » se lit du centre
    'bac-sable': { minX: -100, minY: -800, maxX: 100, maxY: -640 },
    'aile-endormis': { minX: -100, minY: 640, maxX: 100, maxY: 800 },
    // le distillateur est dans la cuve : la prime du retour tombe là où
    // l'on renaît
    distillateur: { minX: -1540, minY: -400, maxX: -1360, maxY: -240 },
    'passerelle-4': { minX: 2100, minY: 1110, maxX: 2240, maxY: 1290 },
  },
  // LA TABLE DE DÉPART se LONGE : sa zone de lecture couvre la ligne de vol,
  // le récapitulatif s'affiche à chaque départ (un toast, rien à fermer) —
  // sa station, elle, reste au sud de la ligne
  tableDepart: { minX: 1560, minY: -340, maxX: 2180, maxY: 60 },
  sasScelle: { minX: 3080, minY: 1100, maxX: 3230, maxY: 1300 },
  // les portes de dégât barrent le couloir de l'aile, hors de la chambre
  portesDegat: {
    'aile-endormis': [{ minX: -210, minY: 930, maxX: 210, maxY: 980 }],
    'bac-sable': [{ minX: -210, minY: -980, maxX: 210, maxY: -930 }],
    'passerelle-4': [{ minX: 2330, minY: 990, maxX: 2380, maxY: 1410 }],
  },
  sceau: { minX: 2410, minY: 990, maxX: 2460, maxY: 1410 },
  porteCuve: { minX: -1300, minY: -210, maxX: -1220, maxY: 210 },
}

// LES PICTOGRAMMES D'ÉTAT du poste de gestion (bible v3.1) : les VRAIES
// règles du jeu, sans un mot — 0 inefficace · 1 confine · 2 efficace ·
// 3 l'outil idéal. Le joueur les lit à l'envers : 3, c'est mortel.
const PICTOS: { tone: WorldLabel['tone']; couleur: string; eau: number; glace: number; vapeur: number }[] = [
  { tone: 'eponge', couleur: '#d9a441', eau: 3, glace: 1, vapeur: 1 }, // l'éponge boit
  { tone: 'froid', couleur: '#8fc8ee', eau: 3, glace: 1, vapeur: 2 }, // la plaque froide fige
  { tone: 'chaud', couleur: '#e8843c', eau: 2, glace: 3, vapeur: 0 }, // la chaudière vaporise
  { tone: 'grille', couleur: '#9aa3ab', eau: 1, glace: 1, vapeur: 0 }, // l'évent laisse passer
  { tone: 'phile', couleur: '#63b7e6', eau: 0, glace: 1, vapeur: 1 }, // la membrane laisse passer l'eau
  { tone: 'froid', couleur: '#d6e8f5', eau: 1, glace: 0, vapeur: 1 }, // le rideau s'écarte devant la glace
  { tone: 'chaud', couleur: '#e8951f', eau: 1, glace: 1, vapeur: 0 }, // le surchauffeur frôle la vapeur
]
// deux rangées sous le banc : quatre, puis trois en quinconce
const PICTOS_POSES: WorldLabel[] = PICTOS.map((p, i) => ({
  x: i < 4 ? -700 + i * 120 : -640 + (i - 4) * 120,
  y: i < 4 ? 430 : 320,
  text: '',
  tone: p.tone,
  picto: { couleur: p.couleur, eau: p.eau, glace: p.glace, vapeur: p.vapeur },
}))

// LES VINGT ET UNE CUVES (sujet-vivant IV1) : vingt alvéoles sur les parois
// de la cuve, dix-neuf vides — la vingtième, au milieu de la paroi ouest,
// est celle devant laquelle le sujet naît : la vingt-et-unième tentative. Compassion pour eux, identification pour
// soi — un décalque, zéro mécanique.
const ALVEOLES: DecalDef[] = [
  ...Array.from({ length: 10 }, (_, i) => ({
    x: -1960 + i * 60,
    y: 300,
    w: 56,
    h: 200,
    kind: 'fiole-vide' as const,
    fade: 0.9,
    ...(i % 2 ? { flip: true } : {}),
  })),
  ...Array.from({ length: 7 }, (_, i) => ({
    x: -1960 + i * 60,
    y: -300,
    w: 56,
    h: 200,
    kind: 'fiole-vide' as const,
    fade: 0.9,
    ...(i % 2 ? {} : { flip: true }),
  })),
  ...[-200, 0, 200].map((y) => ({
    x: -1900,
    y,
    w: 56,
    h: 200,
    kind: 'fiole-vide' as const,
    fade: 0.9,
  })),
]

// LE BAC D'ESSAI : les huit surfaces, dans l'ordre des pictogrammes — ce
// que le poste dit en points, le bac le fait toucher, sans enjeu
const SURFACES_BAC: { mat: number; text: string; tone: WorldLabel['tone'] }[] = [
  { mat: MAT_CHAUD, text: 'CHAUDIÈRE|ELLE VAPORISE', tone: 'chaud' },
  { mat: MAT_MEMBRANE, text: 'MEMBRANE|SEULE L’EAU PASSE', tone: 'phile' },
  { mat: MAT_RIDEAU, text: 'RIDEAU|SEULE LA GLACE', tone: 'froid' },
  { mat: MAT_SURCHAUFFEUR, text: 'SURCHAUFFEUR|UN DASH EN VAPEUR', tone: 'chaud' },
  { mat: MAT_HYDROPHILE, text: 'HYDROPHILE|ELLE RETIENT', tone: 'phile' },
  { mat: MAT_HYDROPHOBE, text: 'HYDROPHOBE|ELLE REPOUSSE', tone: 'phobe' },
  { mat: MAT_FROID, text: 'PLAQUE FROIDE|ELLE FIGE', tone: 'froid' },
  { mat: MAT_GRILLE, text: 'ÉVENT|LE SOUFFLE TRAVERSE', tone: 'grille' },
]
const xBac = (i: number): number => -505 + i * 130

export const TABLEAU_HUB: LevelDef = {
  name: 'Le module Méduse',
  code: 'HUB',
  journal:
    'Module d’accueil. Une rotonde au centre, la cuve à l’ouest, le sas à l’est : le sujet va droit de sa naissance à la sortie, et tout le reste s’ouvre sur son chemin — le banc, le comptoir, les consoles, deux ailes, trois bouches.',
  par: 3,
  ambiante: 0.5,
  bounds: { minX: -2250, minY: -1900, maxX: 3450, maxY: 1900 },
  spawn: { x: -1720, y: 0, n: 900 },
  // LA BOUCHE D'EAU : au fond du sas, sur la ligne de vol
  exit: { minX: 2470, minY: -140, maxX: 2630, maxY: 140 },
  // LE TERRAIN DE JEU : quinze coques. Les parois viennent de là — ici,
  // on ne pose plus que le MOBILIER.
  structures: STRUCTURES_HUB,
  coque: 'structures',
  boxes: [
    // ═══ LA ROTONDE ════════════════════════════════════════════════════
    // nord-ouest : LE BANC DES MÉMOIRES, contre la paroi nord
    box(-620, 700, -200, 760, MAT_WALL, 2),
    // nord-est : LE MUR DES RECORDS (paroi nord) et LES CONSOLES (paroi est)
    box(200, 700, 560, 760, MAT_WALL, 2),
    box(760, 220, 800, 560, MAT_WALL, 4),
    // sud-est : LE CODEX, contre la paroi est
    box(760, -560, 800, -220, MAT_WALL, 7),
    // sud-ouest : L'ÉTAL en L — trois cloisons par paroi, deux alcôves
    box(-840, -630, -680, -570, MAT_WALL, 2),
    box(-840, -420, -680, -360, MAT_WALL, 2),
    box(-840, -210, -680, -150, MAT_WALL, 2),
    box(-630, -840, -570, -680, MAT_WALL, 2),
    box(-420, -840, -360, -680, MAT_WALL, 2),
    box(-210, -840, -150, -680, MAT_WALL, 2),

    // ═══ LE SAS : LA TABLE DE DÉPART, qu'on longe ═══════════════════════
    box(1620, -300, 2120, -230, MAT_WALL, 7),

    // ═══ LE BAC D'ESSAI : toutes les surfaces, sans enjeu ══════════════
    ...SURFACES_BAC.map((s, i) => box(xBac(i), -1600, xBac(i) + 100, -1520, s.mat)),
  ],
  sponges: [],
  // QUATRE LAMPES, le maximum que le moteur allume. Deux BANDEAUX verticaux
  // (1600 u, sans corps) : l'un descend la rotonde et éclaire ses deux
  // ailes par ses bouts, l'autre descend le sas et atteint ses deux pods.
  // La cuve garde sa lampe froide, le comptoir sa lampe chaude. Le secteur
  // scellé reste dans la pénombre : il l'est.
  lumieres: [
    { x: -1670, y: 0, h: 640, intensite: 0.9, couleur: '#9fd4ee' }, // la cuve : froide
    { x: 0, y: 0, h: 640, intensite: 1.0, forme: 'bandeau', longueur: 1600, angle: 90, taille: 0 }, // la rotonde
    { x: 1970, y: 0, h: 600, intensite: 0.95, couleur: '#8fe6b0', forme: 'bandeau', longueur: 1600, angle: 90, taille: 0 }, // le sas
    { x: -520, y: -520, h: 520, intensite: 0.9, couleur: '#ffd9a8' }, // le comptoir : chaud
  ],
  decals: [
    // LA CUVE : les vingt et une alvéoles
    ...ALVEOLES,
    { x: -1450, y: -320, w: 150, h: 150, kind: 'tuyaux', fade: 0.85 }, // le distillateur
    // LES SIX ENDORMIS : une fiole par alcôve, celle du milieu VIDE — sous
    // « NE PAS RÉVEILLER », la question s'impose d'elle-même
    { x: -420, y: 1560, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    { x: -252, y: 1560, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: -84, y: 1560, w: 90, h: 300, kind: 'fiole-vide', fade: 0.98 },
    { x: 84, y: 1560, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    { x: 252, y: 1560, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: 420, y: 1560, w: 90, h: 300, kind: 'fiole-pleine', fade: 0.98 },
    // LA VITRINE de la rotonde : trois semblables sous verre, dont un parti
    { x: 300, y: -650, w: 80, h: 260, kind: 'fiole-pleine', fade: 0.98 },
    { x: 420, y: -650, w: 80, h: 260, kind: 'fiole-vide', fade: 0.98 },
    { x: 540, y: -650, w: 80, h: 260, kind: 'fiole-pleine', fade: 0.98, flip: true },
    // les écrans du méta : sous tension une fois les stations réparées
    { x: 380, y: 730, w: 340, h: 70, kind: 'ecran-on', fade: 0.95 }, // le mur des records
    { x: 740, y: 300, w: 120, h: 60, kind: 'ecran-on', fade: 0.95 }, // les avaries
    { x: 740, y: 480, w: 120, h: 60, kind: 'ecran-on', fade: 0.95 }, // le plan
    { x: 740, y: -390, w: 120, h: 60, kind: 'ecran-on', fade: 0.95 }, // le codex
    { x: 1870, y: -265, w: 380, h: 70, kind: 'ecran-on', fade: 0.95 }, // la table
    // l'armoire d'éclairage, et la machinerie du seuil
    { x: 410, y: 280, w: 130, h: 195, kind: 'vanne', fade: 0.9 },
    { x: 1450, y: 420, w: 300, h: 220, kind: 'tuyaux', fade: 0.85 },
    { x: 2500, y: -440, w: 300, h: 220, kind: 'tuyaux', fade: 0.85, flip: true },
  ],
  labels: [
    // ─── la cuve
    { x: -1670, y: 470, text: 'MODULE MÉDUSE|LA CUVE', tone: 'mur', rang: 'secteur' },
    { x: -1800, y: -470, text: 'CUVES 1 À 21|VINGT SONT VIDES', tone: 'froid' },
    {
      x: -1450,
      y: -470,
      text: 'LE DISTILLATEUR|LA PRIME DU RETOUR',
      cle: 'hub.distillateur',
      tone: 'grille',
    },
    // ─── la rotonde
    { x: 0, y: -480, text: 'LA ROTONDE|LE POSTE DE GESTION', tone: 'mur', rang: 'secteur' },
    { x: -410, y: 620, text: 'LE BANC DES MÉMOIRES|TISSER LES LIENS', tone: 'froid' },
    ...PICTOS_POSES,
    {
      x: 380,
      y: 470,
      text: 'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS',
      cle: 'hub.mur-records',
      tone: 'froid',
    },
    { x: 680, y: 620, text: 'LES CONSOLES|AVARIES · PLAN DE LA STATION', tone: 'mur' },
    { x: 420, y: -480, text: 'LA VITRINE|DES SEMBLABLES SOUS VERRE', tone: 'froid' },
    { x: 680, y: -640, text: 'LE CODEX|LE MANUEL ÉCRIT PAR LA PARTIE', tone: 'froid' },
    // ─── le comptoir et ses quatre alcôves
    { x: -330, y: -400, text: 'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE', tone: 'chaud', rang: 'secteur' },
    { x: -760, y: -495, text: 'VIATIQUE DE GOUTTES|3 MÉMOIRE', tone: 'phile' },
    { x: -760, y: -285, text: 'CLEF DE CACHETTE|4 MÉMOIRE', tone: 'phobe' },
    { x: -495, y: -760, text: 'SAC SURPRISE|3 MÉMOIRE', tone: 'chaud' },
    { x: -285, y: -760, text: 'ÉCHANTILLON DE SECOURS|8 MÉMOIRE', tone: 'froid' },
    // ─── les deux ailes
    {
      x: 0,
      y: 1400,
      text: 'L’AILE DES ENDORMIS|NE PAS RÉVEILLER',
      cle: 'hub.aile-endormis',
      tone: 'froid',
      rang: 'secteur',
    },
    {
      x: 0,
      y: -1340,
      text: 'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU',
      cle: 'hub.bac-sable',
      tone: 'mur',
      rang: 'secteur',
    },
    ...SURFACES_BAC.map((s, i) => ({
      x: xBac(i) + 50,
      y: i % 2 ? -1670 : -1450,
      text: s.text,
      tone: s.tone,
    })),
    // ─── le seuil : la table, le sas, les deux routes gardées
    { x: 2350, y: 400, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas', rang: 'secteur' },
    {
      x: 1870,
      y: -440,
      text: 'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ',
      cle: 'hub.table-depart',
      tone: 'sas',
    },
    { x: 1970, y: 780, text: 'GRILLE|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    { x: 1780, y: 1360, text: 'SORTIE DE VAPEUR|LA DESCENTE DU JOUR', tone: 'grille', rang: 'secteur' },
    { x: 1970, y: -780, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    { x: 1970, y: -1360, text: 'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE', tone: 'froid', rang: 'secteur' },
    // ─── la route du télescope
    {
      x: 2980,
      y: 1200,
      text: 'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR',
      cle: 'hub.secteur-scelle',
      tone: 'sas',
      rang: 'secteur',
    },
    {
      x: 2480,
      y: 1200,
      text: 'ACCÈS CONDAMNÉ|DEPUIS L’ACCIDENT',
      cle: 'hub.acces-condamne',
      tone: 'mur',
    },
  ],
  // LE MARCHAND : le Semblable, debout devant ses alcôves, dans l'angle
  marchand: { x: -540, y: -490 },
  // LES CONSOLES DU MODULE : des surfaces de contact qui ouvrent un écran
  // (pupitres.ts), toutes dans la rotonde, aucune sur la ligne de vol.
  pupitres: [
    // LE MUR DES RECORDS : la moitié EST du banc optique, DANS le plot de
    // sa station — elle s'éteint avec elle — mais jamais sur tout le plot :
    // la réparation se paie en entrant, la consultation vient après
    { minX: 380, minY: 560, maxX: 560, maxY: 680, ecran: 'records' as const },
    // LES CONSOLES de la paroi est. Le tableau des avaries n'est gardé par
    // AUCUNE réparation : c'est quand le module est en panne qu'on le lit.
    {
      minX: 600,
      minY: 220,
      maxX: 760,
      maxY: 380,
      ecran: 'reparations' as const,
      titre: 'TABLEAU DES AVARIES',
    },
    {
      minX: 600,
      minY: 400,
      maxX: 760,
      maxY: 560,
      ecran: 'station' as const,
      titre: 'PLAN DU COMPLEXE',
    },
    // LE CODEX, en face, sur la même paroi
    { minX: 600, minY: -560, maxX: 760, maxY: -220, ecran: 'codex' as const, titre: 'LE CODEX' },
    // LA VITRINE : la collection de fioles, sous les trois semblables
    { minX: 240, minY: -800, maxX: 600, maxY: -560, ecran: 'fioles' as const, titre: 'LA VITRINE' },
    // LE SEMBLABLE : posé en pupitre, il remplace le contact de l'étal —
    // la boîte englobante des alcôves, élargie, mordait sur la ligne de vol
    { minX: -660, minY: -620, maxX: -420, maxY: -380, ecran: 'marchand' as const, titre: 'LE COMPTOIR' },
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
 * pour les vieux instantanés : la rotonde (v9), le compact v4, ou null —
 * aucune zone ne s'active à tort. */
export function zonesDuHub(lv: {
  bounds: { maxX: number }
  ancres?: readonly AncreMeta[]
  bancMemoires?: RectHub
}): ZonesHub | null {
  const posees = zonesPosees(lv)
  if (posees) return posees
  if (lv.bounds.maxX >= 3000) return ZONES_HUB_GRAND
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
  // LES CONSOLES DU MODULE (pupitres.ts) — et c'est CE module que les
  // joueurs voient : la bibliothèque sert le tableau de code « HUB », semé
  // depuis ici par ops/maj-hub.mjs. Des consoles posées dans le seul grand
  // module n'atteindraient personne.
  pupitres: [
    // LE MUR DES RECORDS : au NORD de son plot, la réparation se paie en
    // entrant par le sud — deux pas différents, deux gestes différents.
    { minX: -780, minY: 320, maxX: -540, maxY: 480, ecran: 'records' as const },
    // LE POSTE DE GESTION : la conduite de l'étage. Le tableau des avaries
    // n'est PAS gardé par une réparation — c'est quand tout est en panne
    // qu'on vient le lire.
    {
      minX: 0,
      minY: 200,
      maxX: 240,
      maxY: 350,
      ecran: 'reparations' as const,
      titre: 'TABLEAU DES AVARIES',
    },
    {
      minX: 320,
      minY: 200,
      maxX: 560,
      maxY: 350,
      ecran: 'station' as const,
      titre: 'PLAN DU COMPLEXE',
    },
  ],
  ...metaEnDonnees(ZONES_HUB_COMPACT),
}
