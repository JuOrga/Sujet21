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

export const TABLEAU_HUB: LevelDef = {
  name: 'Le module Méduse',
  code: 'HUB',
  journal:
    'Module d’accueil. Entre deux protocoles, le sujet est libre dans la cuve d’entraînement — « libre » au sens où nous consignons tout. Il passe de longues minutes devant le placard d’entretien. Il lit, je crois. — Dr N. Véga',
  par: 3,
  bounds: { minX: -1600, minY: -750, maxX: 1600, maxY: 750 },
  spawn: { x: -1000, y: 0, n: 900 },
  // le sas de LANCEMENT, au bout du conduit de ventilation, à droite
  exit: { minX: 1450, minY: -140, maxX: 1590, maxY: 140 },
  boxes: [
    // ---- la cloison cuve / hall central : hublots en haut (on vous
    // observe), caissons en bas — une large ouverture au milieu
    box(-420, 220, -340, 750, MAT_WALL, 6),
    box(-420, -750, -340, -220, MAT_WALL, 1),
    // ---- la cuve d'entraînement : deux agrès, pour sentir les surfaces
    box(-820, -120, -640, -50, MAT_HYDROPHILE),
    box(-780, 260, -600, 330, MAT_HYDROPHOBE),
    // ---- la salle d'observation (plafond du hall) : écrans des Créateurs
    box(-160, 640, 500, 750, MAT_WALL, 7),
    // ---- le placard d'entretien (plancher du hall) : un échantillon de
    // chaque surface, étiquettes énigmatiques au-dessus
    box(-160, -700, 0, -620, MAT_HYDROPHILE),
    box(120, -700, 280, -620, MAT_HYDROPHOBE),
    box(400, -700, 560, -620, MAT_FROID),
    box(680, -700, 840, -620, MAT_GRILLE),
    // ---- le banc d'étalonnage (hors service — chantier méta) : un îlot
    // blindé posé SUR le trajet cuve → sas — on le contourne, on le voit
    box(300, -40, 620, 60, MAT_WALL, 4),
    // ---- le conduit de ventilation vers le sas : parois d'aération
    box(1080, 160, 1160, 750, MAT_WALL, 5),
    box(1080, -750, 1160, -160, MAT_WALL, 5),
  ],
  sponges: [
    // le dernier casier du placard : l'éponge — elle boit, elle ne rend rien
    { minX: 940, minY: -700, cols: 3, rows: 3, cellSize: 26, capacityPerCell: 5 },
  ],
  labels: [
    // Toute la signalétique du module est en PLAQUES (« SUR-TITRE|TITRE ») :
    // le petit sur-titre situe (secteur, autorité), le titre nomme.
    // la cuve
    { x: -1000, y: 500, text: 'MODULE MÉDUSE — SECTEUR 01|CUVE D’ENTRAÎNEMENT', tone: 'mur' },
    { x: -1000, y: -500, text: 'NOTE DE SERVICE|LES CRÉATEURS OBSERVENT', tone: 'froid' },
    // l'observation et le banc (les deux machines des chantiers méta)
    { x: 170, y: 520, text: 'ACCÈS CRÉATEURS|SALLE D’OBSERVATION', tone: 'mur' },
    { x: 640, y: 520, text: 'ÉCRAN DE CONTRÔLE|HORS TENSION', tone: 'grille' },
    { x: 460, y: 150, text: 'BANC D’ÉTALONNAGE|HORS SERVICE', tone: 'chaud' },
    // le placard : chaque casier porte le NOM de sa surface en sur-titre
    // et son énigme en titre — on apprend le mot et la poésie d'un coup
    { x: 400, y: -330, text: 'SECTEUR 02|PLACARD D’ENTRETIEN', tone: 'mur' },
    { x: -80, y: -540, text: 'HYDROPHILE|CE QUI AIME RETIENT', tone: 'phile' },
    { x: 200, y: -430, text: 'HYDROPHOBE|CE QUI REPOUSSE PROPULSE', tone: 'phobe' },
    { x: 480, y: -540, text: 'PLAQUE FROIDE|LE FROID FIGE, LE FIGÉ FILE', tone: 'froid' },
    { x: 760, y: -430, text: 'ÉVENT|SEUL LE SOUFFLE PASSE', tone: 'grille' },
    { x: 1000, y: -540, text: 'ÉPONGE|ELLE BOIT, NE REND RIEN', tone: 'eponge' },
    // le départ
    { x: 1120, y: 340, text: 'SECTEUR 03|CONDUIT DE VENTILATION', tone: 'grille' },
    { x: 1330, y: -220, text: 'PROTOCOLE 21|SAS DE LANCEMENT', tone: 'sas' },
  ],
}
