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

// Le plan, d'ouest en est — un ÉTAGE de laboratoire, pas une salle unique :
//   CUVE D'ENTRAÎNEMENT → porte centrale → HALL (dessert la SALLE
//   D'OBSERVATION au nord et le PLACARD D'ENTRETIEN au sud) → porte HAUTE →
//   SALLE D'ÉTALONNAGE (machines, banc) → porte BASSE → CONDUIT DE
//   VENTILATION en chicanes (par-dessus, par-dessous) → SAS DE LANCEMENT.
// Les portes alternées (centre, haut, bas) font le trajet serpentin : on
// TRAVERSE un lieu construit par des humains, on ne glisse pas dans un couloir.
export const TABLEAU_HUB: LevelDef = {
  name: 'Le module Méduse',
  code: 'HUB',
  journal:
    'Module d’accueil. Entre deux protocoles, le sujet est libre de circuler — « libre » au sens où nous consignons tout. Il connaît l’étage mieux que nous : il prend les chicanes du conduit sans jamais se tromper. Il passe de longues minutes devant le placard d’entretien. Il lit, je crois. — Dr N. Véga',
  par: 3,
  bounds: { minX: -2400, minY: -1100, maxX: 2400, maxY: 1100 },
  spawn: { x: -1800, y: 0, n: 900 },
  // le sas de LANCEMENT, tout à l'est, au bout des chicanes
  exit: { minX: 2260, minY: -120, maxX: 2390, maxY: 120 },
  boxes: [
    // ---- CUVE D'ENTRAÎNEMENT (ouest) : deux agrès pour sentir les
    // surfaces — aux BORDS de la cuve, jamais sous le point de réveil
    // (l'échantillon naissait collé à l'hydrophile : réveil neutre désormais)
    box(-2320, -720, -2120, -650, MAT_HYDROPHILE),
    box(-1520, 580, -1320, 650, MAT_HYDROPHOBE),
    // ---- cloison cuve | hall : hublots en haut (on vous observe),
    // caissons en bas — porte CENTRALE (y −150..150)
    box(-1200, 150, -1120, 1100, MAT_WALL, 6),
    box(-1200, -1100, -1120, -150, MAT_WALL, 1),
    // ---- HALL : mur nord (porte vers l'observation, x −800..−560)
    box(-1120, 400, -800, 480, MAT_WALL, 2),
    box(-560, 400, 0, 480, MAT_WALL, 2),
    // ---- SALLE D'OBSERVATION (nord) : la baie d'écrans des Créateurs
    box(-900, 950, -150, 1100, MAT_WALL, 7),
    // ---- HALL : mur sud (porte vers le placard, x −300..−60)
    box(-1120, -480, -300, -400, MAT_WALL, 1),
    box(-60, -480, 0, -400, MAT_WALL, 1),
    // ---- PLACARD D'ENTRETIEN (sud) : un casier par surface, étalés sur
    // toute la largeur de la pièce pour que chaque pancarte respire
    box(-1060, -1050, -900, -970, MAT_HYDROPHILE),
    box(-844, -1050, -684, -970, MAT_HYDROPHOBE),
    box(-628, -1050, -468, -970, MAT_FROID),
    box(-412, -1050, -252, -970, MAT_GRILLE),
    // ---- cloison hall | salle d'étalonnage : porte HAUTE (y 250..500)
    box(0, 500, 80, 1100, MAT_WALL, 4),
    box(0, -1100, 80, 250, MAT_WALL, 4),
    // ---- SALLE D'ÉTALONNAGE : machines, et le banc sur le chemin
    box(400, -200, 900, -80, MAT_WALL, 2),
    box(500, 400, 640, 800, MAT_WALL, 8),
    box(700, 60, 1020, 160, MAT_WALL, 4),
    // ---- cloison étalonnage | conduit : porte BASSE (y −500..−250)
    box(1200, -250, 1280, 1100, MAT_WALL, 5),
    box(1200, -1100, 1280, -500, MAT_WALL, 5),
    // ---- CONDUIT DE VENTILATION : deux chicanes — par-dessus la première,
    // par-dessous la seconde, puis remonter au sas
    box(1600, -1100, 1680, 600, MAT_WALL, 5),
    box(1960, -600, 2040, 1100, MAT_WALL, 5),
  ],
  sponges: [
    // le dernier casier du placard : l'éponge — elle boit, elle ne rend rien
    { minX: -155, minY: -1050, cols: 3, rows: 3, cellSize: 26, capacityPerCell: 5 },
  ],
  labels: [
    // Toute la signalétique du module est en PLAQUES (« SUR-TITRE|TITRE ») :
    // le petit sur-titre situe (secteur, autorité), le titre nomme.
    // la cuve
    { x: -1800, y: 800, text: 'MODULE MÉDUSE — SECTEUR 01|CUVE D’ENTRAÎNEMENT', tone: 'mur' },
    { x: -1800, y: -800, text: 'NOTE DE SERVICE|LES CRÉATEURS OBSERVENT', tone: 'froid' },
    // l'observation (nord du hall)
    { x: -800, y: 780, text: 'ACCÈS CRÉATEURS|SALLE D’OBSERVATION', tone: 'mur' },
    { x: -250, y: 620, text: 'ÉCRAN DE CONTRÔLE|HORS TENSION', tone: 'grille' },
    // le placard (sud du hall) : la pancarte de secteur reste dans le hall,
    // près de la porte ; à l'intérieur, chaque casier a la sienne — TROIS
    // hauteurs en quinconce, pour que rien ne se chevauche même dézoomé
    { x: -450, y: -300, text: 'SECTEUR 02|PLACARD D’ENTRETIEN', tone: 'mur' },
    { x: -980, y: -880, text: 'HYDROPHILE|CE QUI AIME RETIENT', tone: 'phile' },
    { x: -764, y: -740, text: 'HYDROPHOBE|CE QUI REPOUSSE PROPULSE', tone: 'phobe' },
    { x: -548, y: -600, text: 'PLAQUE FROIDE|LE FROID FIGE, LE FIGÉ FILE', tone: 'froid' },
    { x: -332, y: -880, text: 'ÉVENT|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    { x: -116, y: -740, text: 'ÉPONGE|ELLE BOIT, NE REND RIEN', tone: 'eponge' },
    // la salle d'étalonnage
    { x: 640, y: 940, text: 'SECTEUR 03|SALLE D’ÉTALONNAGE', tone: 'mur' },
    { x: 860, y: 260, text: 'BANC D’ÉTALONNAGE|HORS SERVICE', tone: 'chaud' },
    // le conduit et le départ
    { x: 1440, y: 700, text: 'SECTEUR 04|CONDUIT DE VENTILATION', tone: 'grille' },
    { x: 2120, y: 320, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas' },
  ],
}
