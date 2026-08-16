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

    // ═══ SALLE D'ÉTALONNAGE (−200..2000) : les machines, et le banc ═══
    box(400, -400, 1200, -280, MAT_WALL, 2),
    box(600, 700, 800, 1300, MAT_WALL, 8),
    box(1400, 120, 1900, 240, MAT_WALL, 4),

    // ═══ cloison étalonnage | conduit — porte BASSE (y −1100..−700) ═══
    box(2000, -700, 2000 + CLOISON, 1800, MAT_WALL, 5),
    box(2000, -1800, 2000 + CLOISON, -1100, MAT_WALL, 5),

    // ═══ CONDUIT DE VENTILATION (2000..3600) : deux chicanes ══════════
    // par-dessus la première, par-dessous la seconde, puis le sas
    box(2600, -1800, 2690, 900, MAT_WALL, 5),
    box(3200, -900, 3290, 1800, MAT_WALL, 5),
  ],
  sponges: [
    // le dernier casier du placard : l'éponge — elle boit, elle ne rend rien
    { minX: 60, minY: -1700, cols: 3, rows: 3, cellSize: 30, capacityPerCell: 5 },
  ],
  decals: [
    // L'ÉCRAN DE CONTRÔLE de la salle d'observation (asset du concepteur,
    // détouré en deux états au châssis identique). HORS TENSION tant que la
    // méta-progression n'est pas branchée : le jour venu, 'ecran-on'.
    // Ratio du fichier : 938/753 ≈ 1,246 — respecté pour ne pas l'écraser.
    { x: -1350, y: 1150, w: 380, h: 473, kind: 'ecran-off', fade: 0.95 },
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
    { x: 180, y: -1400, text: 'ÉPONGE|ELLE BOIT, NE REND RIEN', tone: 'eponge' },
    // ─── l'étalonnage
    { x: 900, y: 1450, text: 'SECTEUR 03|SALLE D’ÉTALONNAGE', tone: 'mur', rang: 'secteur' },
    { x: 1650, y: 480, text: 'BANC D’ÉTALONNAGE|HORS SERVICE', tone: 'chaud' },
    // ─── le conduit et le départ
    { x: 2900, y: 1400, text: 'SECTEUR 04|CONDUIT DE VENTILATION', tone: 'grille', rang: 'secteur' },
    { x: 3600, y: 600, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas', rang: 'secteur' },
  ],
}
