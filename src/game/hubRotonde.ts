// LA ROTONDE — le troisième module Méduse, bâti pour qu'on n'y marche plus.
//
// Le concepteur, 21/11 : « ceux actuels ne me conviennent pas du tout, je
// les trouve très lourds et lents à parcourir ». Les deux hubs livrés sont
// des FILES : le grand aligne dix-sept coques sur 8 800 u (du départ au sas :
// 8 330 u, en traversant le banc des mémoires PUIS le mur des records, deux
// écrans qui s'ouvrent sur le trajet obligé) ; le compact tient en 4 500 u
// mais se parcourt en chicane, trois cloisons à contourner.
//
// Ici, plus de file : un PLAN RAYONNANT. Le sujet naît AU CENTRE, dans une
// cuve en anneau — le même anneau que la vitrine du menu (cuveAccueil.ts) :
// on quitte la fiche et l'on est dedans. Autour d'elle, un hall octogonal
// d'un seul tenant ; sur ses quatre faces, quatre bras OUVERTS sur toute
// leur largeur (pas de porte à viser) ; dans ses quatre pans coupés, quatre
// baies. Tout se voit d'où l'on naît, et tout est à une impulsion.
//
//                          ┌─────────┐
//                          │COMPTOIR │
//                          │    N    │           ┌───────┐
//                 ╱────────┘         └────────╲  │VAPEUR │
//               ╱  RECORDS           ÉCLAIRAGE  ╲│(grille)
//   ┌──────────┤                                 ├───┴───┴──┐
//   │ SECTEUR 4 · ENDORMIS    ╭ CUVE ╮   →  →   TABLE ·  SAS│
//   └──────────┤     (banc) ──╯      ╰           ├───┬───┬──┘
//               ╲  CONTRÔLE        DISTILLATEUR ╱│ GIVRE │
//                 ╲────────┐         ┌────────╱  │(rideau)
//                          │   BAC   │           └───────┘
//                          │    S    │
//                          └─────────┘
//
// LES TROIS RÈGLES DU PLAN, que hubRotonde.spec.ts garde :
//
//  1. L'AXE DU DÉPART EST LIBRE. La bouche de la cuve regarde le sas : de la
//     naissance au lancement, une ligne droite, et AUCUN écran ne s'ouvre en
//     chemin (seule la table de départ y passe : un toast, rien à fermer).
//  2. CE QUI OUVRE UN ÉCRAN SE VISE. Marchand, mémoires, avaries, plan,
//     records : chacun est une console au fond d'une baie, d'un bras ou au
//     dos de la cuve, hors des lignes qui relient la cuve aux quatre bras.
//  3. UNE FONCTION, UNE CONSOLE. Le comptoir n'a plus quatre alcôves où
//     plonger : un pupitre « marchand » ouvre le Semblable (pupitres.ts).
//     Le banc est une console comme les autres. Sept coques au lieu de
//     dix-sept, dix-neuf blocs au lieu de trente-huit.
//
// Ce module ne remplace rien : il s'AJOUTE (code « HUB3 »), comme le compact
// en son temps. Le hub joué reste l'entrée « HUB » de la bibliothèque, à
// défaut le grand module — la bascule est le geste du concepteur (ouvrir la
// copie dans l'éditeur, la recoder HUB, publier). `?hub=rotonde` le joue
// tout de suite, sans rien publier.

import { ARC_BOUT_DROIT, COQUE_EST, COQUE_NORD, COQUE_OUEST, COQUE_SUD, FORME_ARC, FORME_DISQUE } from './formes'
import {
  MAT_BAIE,
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
  type StructureDef,
} from './level'
import { STRUCT_CHAMBRE, STRUCT_COULOIR } from './structures'

type Rect = { minX: number; minY: number; maxX: number; maxY: number }

// ─── LES COTES DU PLAN ────────────────────────────────────────────────────
// Une poignée de nombres, et tout le reste s'en déduit : c'est ce qui permet
// de resserrer ou d'aérer le module sans recalculer vingt rectangles.

/** L'épaisseur de coque, partout la même. Un multiple de 8 : le format serre
 *  l'épaisseur par pas de 8 (coquePack) — posée à 60 comme dans le grand
 *  module, elle se dessine à 64 (mesuré : epaisseurDessinee), et tout ce qui
 *  se cale sur elle à la main (barrières, zones au ras des parois) tomberait
 *  4 u à côté du mur réel. */
export const EP_ROTONDE = 56

/** Le demi-côté EXTÉRIEUR du hall : un octogone de 1 840 u. */
export const HALL = 920
/** …et sa face INTÉRIEURE, où s'arrêtent les bras raccordés. */
const HALL_INT = HALL - EP_ROTONDE

/** La demi-largeur EXTÉRIEURE d'un bras, et son passage : 480 u, soit plus
 *  de deux fois le corps (≈ 210 u de diamètre à 900 particules). Un multiple
 *  de 32 : la porte d'une coque se règle par pas de 32. */
const BRAS = 296
export const PASSAGE_BRAS = 2 * (BRAS - EP_ROTONDE)

/** Le bout des bras (cote extérieure) : le comptoir et le bac au nord et au
 *  sud, le départ à l'est, l'aile — plus longue, elle porte le secteur 4 —
 *  à l'ouest. */
const BOUT_NS = 1500
// L'EST EST PLUS LONG QUE LE NORD ET LE SUD, et c'est pour le sas. À 1 640
// (la première livraison), la bouche du sas — 65 u de rayon, la taille de
// celle des deux autres hubs — se perdait entre les deux portes de flanc et
// leurs colliers de raccord : « le sas n'est clairement pas assez voyant »
// (le concepteur, 22/11, sur l'aperçu). La grossir sur place aurait mis sa
// zone de collecte sur le chemin des deux routes gardées : on serait parti
// en descente écrite en allant chercher la grille. Le bras s'allonge donc
// de 360 u : les portes de flanc restent en son milieu, et le sas prend
// tout le fond, seul.
const BOUT_EST = 2000
const BOUT_OUEST = -2050

/** LA CUVE : l'anneau du menu, à l'échelle du hall. 256 u de rayon libre —
 *  le corps (≈ 105 u) y dérive sans toucher, et la règle de dégagement du
 *  départ (120 u, levelIO) est tenue deux fois. */
export const CUVE_RAYON = 300
export const CUVE_EPAISSEUR = 44
/** La demi-ouverture de la BOUCHE, en degrés : 38° ouvrent 315 u de corde
 *  au rayon intérieur — le corps sort sans se déchirer sur les montants. */
export const CUVE_BOUCHE = 38

/** L'anneau de la cuve : un arc dont la bouche regarde l'EST. L'arc du
 *  moteur s'étend de part et d'autre de +x et sa boîte est sa boîte
 *  englobante EXACTE (formes.ts, arcRayons) : pour une coupe franche de
 *  demi-ouverture O ≥ 90°, elle va de cos(O) à 1 sur l'axe. Tournée d'un
 *  demi-tour, c'est le DOS de l'arc qui regarde l'ouest. */
function anneauCuve(): ObstacleBox {
  const R = CUVE_RAYON
  const ouverture = 180 - CUVE_BOUCHE
  const tips = -Math.cos((ouverture * Math.PI) / 180) // > 0 : les montants de la bouche
  return {
    minX: -R,
    minY: -R,
    maxX: R * tips,
    maxY: R,
    material: MAT_WALL,
    forme: FORME_ARC,
    p0: CUVE_EPAISSEUR / R,
    p1: ouverture,
    p2: ARC_BOUT_DROIT,
    angle: 180,
  }
}

/** Le milieu du bras de départ TEL QU'IL EST DESSINÉ : raccordé, il commence
 *  à la face intérieure du hall — et ses portes de flanc sont centrées sur
 *  cette boîte-là, pas sur l'emprise tracée. Les deux sorties gardées s'y
 *  alignent ; hubRotonde.spec.ts vérifie que les trois passages coïncident. */
export const DEPART_MILIEU = (HALL_INT + BOUT_EST) / 2

const couloir = (r: Rect, plus: Partial<StructureDef> = {}): StructureDef => ({
  type: STRUCT_COULOIR,
  ...r,
  ep: EP_ROTONDE,
  ...plus,
})

/** LE PLAN : sept coques. Les bras sont des COULOIRS fermés à leur bout
 *  (ouvertures forcées) : ils mordent dans le hall au milieu de sa face, le
 *  raccord les arrête à sa paroi intérieure, et le hall leur ouvre une porte
 *  de toute leur largeur — un bras est une ABSIDE, pas une pièce derrière
 *  une porte. Ne pas les décaler : une face ne s'ouvre qu'en son centre. */
export const STRUCTURES_ROTONDE: StructureDef[] = [
  // LE HALL : un octogone (chanfrein au maximum), ses quatre faces ouvertes
  { type: STRUCT_CHAMBRE, minX: -HALL, minY: -HALL, maxX: HALL, maxY: HALL, ep: EP_ROTONDE, chanfrein: 0.5 },
  // NORD — LE COMPTOIR
  couloir({ minX: -BRAS, minY: HALL - 80, maxX: BRAS, maxY: BOUT_NS }, { axe: 1, ouvertures: COQUE_SUD }),
  // SUD — LE BAC D'ESSAI
  couloir({ minX: -BRAS, minY: -BOUT_NS, maxX: BRAS, maxY: -(HALL - 80) }, { axe: 1, ouvertures: COQUE_NORD }),
  // OUEST — L'AILE : les endormis, la passerelle, le secteur 4 au bout
  couloir({ minX: BOUT_OUEST, minY: -BRAS, maxX: -(HALL - 80), maxY: BRAS }, { axe: 0, ouvertures: COQUE_EST }),
  // EST — LE DÉPART : le sas au bout, les deux routes gardées sur ses flancs
  couloir(
    { minX: HALL - 80, minY: -BRAS, maxX: BOUT_EST, maxY: BRAS },
    { axe: 0, ouvertures: COQUE_OUEST | COQUE_NORD | COQUE_SUD, porte: PASSAGE_BRAS },
  ),
  // LA SORTIE DE VAPEUR (nord du départ), barrée par sa GRILLE
  couloir(
    { minX: DEPART_MILIEU - BRAS, minY: BRAS - 80, maxX: DEPART_MILIEU + BRAS, maxY: 860 },
    { axe: 1, ouvertures: COQUE_SUD, bouchon: MAT_GRILLE },
  ),
  // LA SORTIE DE GIVRE (sud du départ), barrée par son RIDEAU
  couloir(
    { minX: DEPART_MILIEU - BRAS, minY: -860, maxX: DEPART_MILIEU + BRAS, maxY: -(BRAS - 80) },
    { axe: 1, ouvertures: COQUE_NORD, bouchon: MAT_RIDEAU },
  ),
]

// ─── LES RENDEZ-VOUS ──────────────────────────────────────────────────────

const carre = (cx: number, cy: number, demiX: number, demiY = demiX): Rect => ({
  minX: cx - demiX,
  minY: cy - demiY,
  maxX: cx + demiX,
  maxY: cy + demiY,
})

/** Une barrière d'énergie en travers d'un bras : elle déborde le passage de
 *  10 u de chaque côté, pour mordre dans les parois (aucun jour). */
const DEMI_BARRIERE = PASSAGE_BRAS / 2 + 10

/** Le sas : son rayon, et son centre — adossé au fond du bras. */
export const SAS_RAYON = 150
const SAS_X = BOUT_EST - EP_ROTONDE - SAS_RAYON - 4

/** Les zones de la rotonde, nommées — le test les relit une à une. */
export const ZONES_ROTONDE = {
  // LE SAS DE LANCEMENT, au fond du bras de départ : 150 u de rayon — son
  // iris (1,35 rayon de cadre, renderer.ts) couvre 405 u des 480 du bras.
  // C'est la pièce la plus grosse du module après la cuve, dans son axe.
  sas: carre(SAS_X, 0, SAS_RAYON),
  // LA TABLE DE DÉPART : le seuil du bras — on la franchit pour partir
  tableDepart: { minX: 960, minY: -130, maxX: 1100, maxY: 130 } as Rect,
  // les deux sorties gardées, DERRIÈRE leur matière
  sasVapeur: carre(DEPART_MILIEU, 690, 120, 80),
  sasGivre: carre(DEPART_MILIEU, -690, 120, 80),
  // LA PORTE DE LA CUVE : la corde de la bouche (acte 0 : le sujet naît
  // enfermé, la séquence ALERTE la crève)
  porteCuve: { minX: 196, minY: -190, maxX: 240, maxY: 190 } as Rect,
  // les stations de réparation
  stations: {
    // nord-est et sud-est : les deux machines qui encadrent l'axe du départ
    eclairage: carre(520, 520, 90),
    distillateur: carre(520, -520, 90),
    'table-depart': { minX: 960, minY: -130, maxX: 1100, maxY: 130 } as Rect,
    // LE MUR DES RECORDS : la baie du nord-ouest, contre le pan coupé
    'mur-records': carre(-510, 510, 120, 90),
    // devant l'aile et devant le bac : on paie au seuil, la barrière tombe
    'aile-endormis': { minX: -800, minY: -100, maxX: -640, maxY: 100 } as Rect,
    'bac-sable': { minX: -100, minY: -800, maxX: 100, maxY: -640 } as Rect,
    // au fond de l'aile des endormis, devant la passerelle
    'passerelle-4': { minX: -1500, minY: -100, maxX: -1340, maxY: 100 } as Rect,
  } as Record<string, Rect>,
  portesDegat: {
    'aile-endormis': [{ minX: -916, minY: -DEMI_BARRIERE, maxX: -872, maxY: DEMI_BARRIERE }],
    'bac-sable': [{ minX: -DEMI_BARRIERE, minY: -916, maxX: DEMI_BARRIERE, maxY: -872 }],
    'passerelle-4': [{ minX: -1580, minY: -DEMI_BARRIERE, maxX: -1536, maxY: DEMI_BARRIERE }],
  } as Record<string, Rect[]>,
  sceau: { minX: -1650, minY: -DEMI_BARRIERE, maxX: -1606, maxY: DEMI_BARRIERE } as Rect,
  sasScelle: { minX: -1930, minY: -120, maxX: -1730, maxY: 120 } as Rect,
  // LE BANC DES MÉMOIRES : adossé au DOS de la cuve. Le corps posé contre
  // l'anneau a son centre à ≈ 405 u du milieu du module : dans la zone, à
  // 85 u de son bord côté cuve.
  //
  // Le banc et le mur des records ont échangé leurs places à la relecture du
  // module EN PANNE : la plaque « EN PANNE » d'une station se pose au centre
  // de son plot, et celle du mur, au dos de la cuve, tombait sur la même
  // ligne que celle de l'aile des endormis, à 330 u — l'une masquait
  // l'autre. Le banc n'est pas une station : il n'a pas de plaque.
  banc: { minX: -500, minY: -90, maxX: -320, maxY: 90 } as Rect,
  // les consoles
  pupitres: {
    marchand: { minX: -230, minY: 1230, maxX: -10, maxY: 1340 } as Rect,
    reparations: carre(-590, -430, 90, 50),
    station: carre(-430, -590, 90, 50),
    records: carre(-510, 510, 90, 50),
  },
}

function ancresRotonde(): AncreMeta[] {
  const z = ZONES_ROTONDE
  const out: AncreMeta[] = []
  for (const [id, r] of Object.entries(z.stations)) out.push({ ...r, role: 'station', id })
  for (const [id, rects] of Object.entries(z.portesDegat))
    for (const r of rects) out.push({ ...r, role: 'degat', id })
  out.push({ ...z.tableDepart, role: 'table-depart' })
  out.push({ ...z.sasScelle, role: 'sas-scelle' })
  out.push({ ...z.sceau, role: 'sceau' })
  out.push({ ...z.porteCuve, role: 'porte-cuve' })
  out.push({ ...z.sasGivre, role: 'sas-givre' })
  out.push({ ...z.sasVapeur, role: 'sas-vapeur' })
  return out
}

// ─── LE BAC D'ESSAI : huit surfaces sur trois murs, le milieu libre ───────
const BAC_FOND = -(BOUT_NS - EP_ROTONDE) // la face intérieure du fond
const BAC_FLANC = BRAS - EP_ROTONDE // …et celle des flancs
const plaqueFond = (cx: number, material: number): ObstacleBox => ({
  minX: cx - 50,
  minY: BAC_FOND + 4,
  maxX: cx + 50,
  maxY: BAC_FOND + 54,
  material,
})
const plaqueFlanc = (cote: -1 | 1, cy: number, material: number): ObstacleBox => ({
  minX: cote < 0 ? -BAC_FLANC + 4 : BAC_FLANC - 54,
  minY: cy - 50,
  maxX: cote < 0 ? -BAC_FLANC + 54 : BAC_FLANC - 4,
  maxY: cy + 50,
  material,
})

export const TABLEAU_HUB_ROTONDE: LevelDef = {
  name: 'Le module Méduse — rotonde',
  code: 'HUB3',
  journal:
    'Module d’accueil, configuration en rotonde. La cuve au centre, le hall autour, quatre bras : le comptoir, le bac, l’aile, le départ. Le sujet n’y cherche plus rien — il voit tout d’où il naît. — Dr N. Véga',
  par: 3,
  ambiante: 0.5,
  plafond: 'hub',
  bounds: { minX: -2150, minY: -1600, maxX: 2100, maxY: 1600 },
  // il naît au centre du module, dans la cuve
  spawn: { x: 0, y: 0, n: 900 },
  exit: ZONES_ROTONDE.sas,
  structures: STRUCTURES_ROTONDE,
  coque: 'structures',
  // PAS DE SAS DE RACCORD aux jonctions : les bras s'ouvrent sur toute leur
  // largeur, le hall et ses bras se lisent d'un seul tenant. Les cols
  // peints que le moteur pose à chaque couloir (metaAssets.decalsDuMeta)
  // découpaient le plan en pièces — « je n'aime pas du tout » (le
  // concepteur, 22/11, sur l'aperçu).
  raccords: 'aucun',
  boxes: [
    // LA VITRE sous l'échantillon, comme au menu : un fond, qui passe sous
    // la paroi de l'anneau pour qu'aucun jour ne reste entre les deux
    {
      ...carre(0, 0, CUVE_RAYON - CUVE_EPAISSEUR / 2),
      material: MAT_BAIE,
      forme: FORME_DISQUE,
    },
    anneauCuve(),
    // ═══ LE BAC D'ESSAI : toutes les surfaces, sans enjeu ══════════════
    // au fond, les quatre qui AGISSENT — la chaude et la froide aux deux
    // coins opposés, pour qu'on ne gèle pas en venant bouillir
    plaqueFond(-180, MAT_CHAUD),
    plaqueFond(-60, MAT_HYDROPHILE),
    plaqueFond(60, MAT_HYDROPHOBE),
    plaqueFond(180, MAT_FROID),
    // sur les flancs, les quatre qui FILTRENT
    plaqueFlanc(-1, -1040, MAT_MEMBRANE),
    plaqueFlanc(-1, -1200, MAT_RIDEAU),
    plaqueFlanc(1, -1040, MAT_GRILLE),
    plaqueFlanc(1, -1200, MAT_SURCHAUFFEUR),
  ],
  sponges: [],
  // QUATRE LAMPES, le compte que le moteur allume (MAX_LUMIERES) : une
  // haute au-dessus du hall, et une par bras qui porte une couleur — le
  // comptoir chaud, le départ vert, l'aile froide. Le bac vit de la lampe
  // du hall, qui tombe droit dans sa bouche.
  lumieres: [
    { x: 0, y: 0, h: 900, taille: 0 },
    // la lampe du départ est posée SUR le sas, basse et poussée : c'est le
    // point le plus clair du module, on le voit depuis la cuve
    { x: SAS_X, y: 0, h: 400, intensite: 1.35, couleur: '#8fe6b0' },
    { x: 0, y: 1180, h: 520, intensite: 0.9, couleur: '#ffd9a8' },
    // un bandeau SANS CORPS (taille 0) : il court de la bouche de l'aile au
    // secteur 4 — un luminaire dessiné se coucherait sous les barrières
    {
      x: -1420,
      y: 0,
      h: 600,
      intensite: 0.9,
      couleur: '#9fd4ee',
      forme: 'bandeau',
      longueur: 1000,
      taille: 0,
    },
  ],
  decals: [
    // LES SIX ENDORMIS, de part et d'autre de l'allée. Celle du milieu, au
    // nord, est VIDE — sous « NE PAS RÉVEILLER », la question s'impose.
    { x: -1010, y: 135, w: 70, h: 200, kind: 'fiole-pleine', fade: 0.98 },
    { x: -1150, y: 135, w: 70, h: 200, kind: 'fiole-vide', fade: 0.98 },
    { x: -1290, y: 135, w: 70, h: 200, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: -1010, y: -135, w: 70, h: 200, kind: 'fiole-pleine', fade: 0.98, flip: true },
    { x: -1150, y: -135, w: 70, h: 200, kind: 'fiole-pleine', fade: 0.98 },
    { x: -1290, y: -135, w: 70, h: 200, kind: 'fiole-pleine', fade: 0.98 },
    // LES PIÈCES DES STATIONS (§20 de assets-ia.md) : chacune à moins de
    // 400 u du plot de SA station et d'aucune autre — c'est la zone où la
    // panne l'assombrit (reparations.ts, MARGE_DECOR)
    { x: 520, y: 520, w: 200, h: 200, kind: 'hub-eclairage', fade: 0.9 },
    { x: 520, y: -520, w: 200, h: 200, kind: 'hub-distillateur', fade: 0.9 },
    { x: 1030, y: 0, w: 300, h: 100, kind: 'hub-table-depart', fade: 0.9 },
    { x: 0, y: -1150, w: 230, h: 230, kind: 'hub-bac-sable', fade: 0.7 },
    // le mur des records : sa pièce contre le pan coupé, son écran sous la
    // console — éteint avec lui
    { x: -510, y: 606, w: 260, h: 74, kind: 'hub-mur-records', fade: 0.9 },
    { x: -510, y: 432, w: 180, h: 40, kind: 'ecran-on', fade: 0.95 },
    // la machinerie du comptoir
    { x: -150, y: 1010, w: 150, h: 110, kind: 'tuyaux', fade: 0.8 },
    { x: 150, y: 1010, w: 150, h: 110, kind: 'vanne', fade: 0.8 },
  ],
  labels: [
    // ─── le hall et ses quatre bras : la légende du plan
    { x: 0, y: 150, text: 'MODULE MÉDUSE|LA CUVE', tone: 'mur', rang: 'secteur' },
    { x: SAS_X, y: 205, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas', rang: 'secteur' },
    { x: 0, y: 1400, text: 'LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE', tone: 'chaud', rang: 'secteur' },
    {
      x: 0,
      y: -980,
      text: 'LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU',
      cle: 'hub.bac-sable',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: -1150,
      y: 0,
      text: 'L’AILE DES ENDORMIS|NE PAS RÉVEILLER',
      cle: 'hub.aile-endormis',
      tone: 'froid',
      rang: 'secteur',
    },
    // ─── les deux routes gardées
    {
      x: DEPART_MILIEU,
      y: 790,
      text: 'SORTIE DE VAPEUR|LA DESCENTE DU JOUR',
      tone: 'grille',
      rang: 'secteur',
    },
    { x: DEPART_MILIEU, y: 400, text: 'GRILLE|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    {
      x: DEPART_MILIEU,
      y: -790,
      text: 'SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE',
      tone: 'froid',
      rang: 'secteur',
    },
    { x: DEPART_MILIEU, y: -400, text: 'RIDEAU|SEULE LA GLACE L’ÉCARTE', tone: 'froid' },
    // ─── les baies du hall
    { x: -560, y: 170, text: 'LE BANC DES MÉMOIRES|TISSER LES LIENS', tone: 'froid' },
    { x: -620, y: -620, text: 'CENTRE DE CONTRÔLE|LA CONDUITE DE L’ÉTAGE', tone: 'mur' },
    {
      x: 520,
      y: -660,
      text: 'LE DISTILLATEUR|LA PRIME DU RETOUR',
      cle: 'hub.distillateur',
      tone: 'grille',
    },
    {
      x: -510,
      y: 700,
      text: 'LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS',
      cle: 'hub.mur-records',
      tone: 'froid',
    },
    {
      x: 1030,
      y: -190,
      text: 'LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ',
      cle: 'hub.table-depart',
      tone: 'sas',
    },
    // ─── le bout de l'aile : l'après-accident
    {
      x: -1830,
      y: 180,
      text: 'LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR',
      cle: 'hub.secteur-scelle',
      tone: 'sas',
      rang: 'secteur',
    },
    {
      x: -1830,
      y: -180,
      text: 'ACCÈS CONDAMNÉ|DEPUIS L’ACCIDENT',
      cle: 'hub.acces-condamne',
      tone: 'mur',
    },
    // ─── les surfaces du bac
    { x: -180, y: -1330, text: 'CHAUDIÈRE|ELLE VAPORISE', tone: 'chaud' },
    { x: -60, y: -1270, text: 'HYDROPHILE|ELLE RETIENT', tone: 'phile' },
    { x: 60, y: -1330, text: 'HYDROPHOBE|ELLE REPOUSSE', tone: 'phobe' },
    { x: 180, y: -1270, text: 'PLAQUE FROIDE|ELLE FIGE', tone: 'froid' },
    { x: -130, y: -1040, text: 'MEMBRANE|SEULE L’EAU PASSE', tone: 'phile' },
    { x: -130, y: -1200, text: 'RIDEAU|SEULE LA GLACE', tone: 'froid' },
    { x: 130, y: -1040, text: 'ÉVENT|LE SOUFFLE TRAVERSE', tone: 'grille' },
    { x: 130, y: -1200, text: 'SURCHAUFFEUR|UN DASH EN VAPEUR', tone: 'chaud' },
  ],
  // LE MARCHAND : le Semblable, au fond du comptoir, à côté de sa console
  marchand: { x: 140, y: 1240 },
  // UNE FONCTION, UNE CONSOLE. Le pupitre « marchand » remplace le contact
  // de l'étal : pas de plots, donc pas d'achat en frôlant une alcôve.
  pupitres: [
    // LE MUR DES RECORDS d'abord : la console est DANS le plot de sa station
    // (elle s'éteint avec elle), sans le couvrir — on paie en entrant dans
    // la baie, on consulte en se posant sur la console
    { ...ZONES_ROTONDE.pupitres.records, ecran: 'records' },
    // LE CENTRE DE CONTRÔLE : la conduite de l'étage. Le tableau des avaries
    // n'est gardé par AUCUNE réparation — c'est en panne qu'on vient le lire
    { ...ZONES_ROTONDE.pupitres.reparations, ecran: 'reparations', titre: 'TABLEAU DES AVARIES' },
    { ...ZONES_ROTONDE.pupitres.station, ecran: 'station', titre: 'PLAN DU COMPLEXE' },
    { ...ZONES_ROTONDE.pupitres.marchand, ecran: 'marchand' },
  ],
  bancMemoires: ZONES_ROTONDE.banc,
  ancres: ancresRotonde(),
}
