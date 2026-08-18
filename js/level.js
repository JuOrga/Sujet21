"use strict";

// Catalogue des tableaux (§7.1). Chaque tableau est un problème fermé, décrit
// par sa géométrie (`build`) et par deux étiquettes qui pilotent la réserve
// (voir run.js) :
//   - difficulty : palier 1 (facile) → 3 (difficile) ;
//   - transforms : les états de l'eau *attendus* pour le traverser proprement
//     ([] = résoluble en pur liquide, sans changement d'état).
// La réserve tire les premiers tableaux parmi les `difficulty:1, transforms:[]`,
// puis élargit le pool vers le haut à mesure que la run s'enfonce.

function makeSponge(x, y, w, h, name) {
  const cell = 20;
  const cols = Math.round(w / cell), rows = Math.round(h / cell);
  return { x, y, w, h, cell, cols, rows, stored: new Uint8Array(cols * rows), name };
}

// Bord du tableau : les quatre parois qui ferment la salle.
function frameWalls(W, H, T) {
  return [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },
  ];
}

// Gabarit commun : salle 2600×1200, entrée à gauche, sas à droite.
const W = 2600, H = 1200, T = 40;
const SPAWN = { x: 300, y: 600 };
const EXIT = { x: 2440, y: 520, w: 120, h: 180 };

function shell(extra) {
  return {
    bounds: { x: 0, y: 0, w: W, h: H },
    walls: frameWalls(W, H, T).concat(extra.walls || []),
    zones: extra.zones || [],
    sponges: extra.sponges || [],
    exit: extra.exit || EXIT,
    spawn: extra.spawn || SPAWN,
  };
}

// --- Palier 1 : franchissables en pur liquide, gabarits larges -------------

// ANTICHAMBRE — un mur, un large passage central. Le tableau d'initiation.
function buildAntichambre() {
  return shell({
    walls: [
      { x: 1300, y: T, w: 70, h: 440 },              // pilier haut  (y 40→480)
      { x: 1300, y: 780, w: 70, h: H - T - 780 },    // pilier bas   (y 780→1160)
    ],
  });
}

// CHICANE — deux passages larges décalés : on monte, puis on redescend.
function buildChicane() {
  return shell({
    walls: [
      { x: 980, y: 380, w: 70, h: H - T - 380 },     // bloque le bas (passage en haut)
      { x: 1620, y: T, w: 70, h: 780 },              // bloque le haut (passage en bas)
    ],
  });
}

// --- Palier 2 : précision, éponge ou glace — encore franchissable liquide --

// LE DÉTROIT — trois fentes étroites en enfilade : le pilotage fin se paie
// en volume, mais aucun changement d'état n'est requis.
function buildDetroit() {
  return shell({
    walls: [
      { x: 900, y: T, w: 60, h: 460 }, { x: 900, y: 660, w: 60, h: H - T - 660 },   // fente 500→660
      { x: 1500, y: T, w: 60, h: 500 }, { x: 1500, y: 700, w: 60, h: H - T - 700 }, // fente 540→700
      { x: 2050, y: T, w: 60, h: 440 }, { x: 2050, y: 640, w: 60, h: H - T - 640 }, // fente 480→640
    ],
  });
}

// LA DIGUE — barrière d'éponge au centre, doublée d'une fente étroite : payer
// la brèche en volume (§6) ou se faufiler. Pas de thermique.
function buildDigue() {
  return shell({
    walls: [
      { x: 1300, y: T, w: 70, h: 300 },              // haut  (y 40→340)
      { x: 1300, y: 980, w: 70, h: H - T - 980 },    // bas   (y 980→1160)
    ],
    sponges: [
      makeSponge(1300, 450, 70, 530, "ÉPONGE"),      // barrière (y 450→980)
    ],
    // fente liquide y 340→450 (110 px), coûteuse mais franchissable
  });
}

// LA BANQUISE — cryobaie puis couloir bas tapissé d'éponge : geler et glisser
// (l'éponge n'a pas prise sur la glace, §4). Fente haute étroite en secours.
function buildBanquise() {
  return shell({
    walls: [
      { x: 1450, y: 130, w: 60, h: 770 },            // mur (y 130→900) ; fente haute y 40→130
    ],
    zones: [
      { kind: "cold", x: 1050, y: 900, w: 400, h: H - T - 900, name: "CRYOBAIE" },
    ],
    sponges: [
      makeSponge(1510, 900, 300, 40, "ÉPONGE"),      // couloir bas : plafond
      makeSponge(1510, 1120, 300, 40, null),         // couloir bas : sol
    ],
  });
}

// --- Palier 3 : la thermique est la clé -----------------------------------

// CHAMBRE THERMIQUE — le tableau de référence du jalon M1 : trois routes
// selon l'état (liquide par la fente, vapeur à travers l'éponge, glace par
// le couloir bas). Cf. README.
function buildChambreThermique() {
  const CW = 2600, CH = 1200, CT = 40;
  return {
    bounds: { x: 0, y: 0, w: CW, h: CH },
    walls: [
      { x: 0, y: 0, w: CW, h: CT },
      { x: 0, y: CH - CT, w: CW, h: CT },
      { x: 0, y: 0, w: CT, h: CH },
      { x: CW - CT, y: 0, w: CT, h: CH },
      { x: 880, y: CT, w: 60, h: 460 },
      { x: 880, y: 700, w: 60, h: CH - CT - 700 },
      { x: 1480, y: CT, w: 60, h: 110 },   // fente entre y=150 et y=190
      { x: 1480, y: 190, w: 60, h: 110 },
      { x: 1480, y: 900, w: 60, h: 110 },  // le couloir bas s'ouvre à y=1010
    ],
    zones: [
      { kind: "heat", x: 1000, y: CT, w: 400, h: 140, name: "RADIATEUR" },
      { kind: "cold", x: 980, y: 1000, w: 420, h: CH - CT - 1000, name: "CRYOBAIE" },
    ],
    sponges: [
      makeSponge(1480, 300, 60, 600, "ÉPONGE"),
      makeSponge(1560, 1010, 260, 40, "ÉPONGE"),
      makeSponge(1560, 1120, 260, 40, null),
    ],
    exit: { x: 2440, y: 500, w: 120, h: 200 },
    spawn: { x: 300, y: 600 },
  };
}

// LE DOUBLE SAS — un radiateur pour monter en température, puis une paroi
// d'éponge épaisse : la traverser vite en vapeur (le temps de contact limite
// la perte) plutôt que de la payer en volume.
function buildDoubleSas() {
  return shell({
    walls: [
      { x: 1500, y: T, w: 70, h: 360 },              // haut  (y 40→400)
      { x: 1500, y: 800, w: 70, h: H - T - 800 },    // bas   (y 800→1160)
    ],
    zones: [
      { kind: "heat", x: 700, y: 460, w: 360, h: 280, name: "RADIATEUR" },
    ],
    sponges: [
      makeSponge(1500, 400, 70, 400, "ÉPONGE"),      // seule ouverture (y 400→800)
    ],
  });
}

// La réserve : ordre indifférent, c'est run.js qui trie par difficulté.
const LEVELS = [
  { id: "antichambre",  name: "ANTICHAMBRE",       difficulty: 1, transforms: [],              build: buildAntichambre },
  { id: "chicane",      name: "CHICANE",           difficulty: 1, transforms: [],              build: buildChicane },
  { id: "detroit",      name: "LE DÉTROIT",        difficulty: 2, transforms: [],              build: buildDetroit },
  { id: "digue",        name: "LA DIGUE",          difficulty: 2, transforms: [],              build: buildDigue },
  { id: "banquise",     name: "LA BANQUISE",       difficulty: 2, transforms: ["ice"],         build: buildBanquise },
  { id: "chambre",      name: "CHAMBRE THERMIQUE", difficulty: 3, transforms: ["ice", "steam"], build: buildChambreThermique },
  { id: "double-sas",   name: "LE DOUBLE SAS",     difficulty: 3, transforms: ["steam"],       build: buildDoubleSas },
];

function levelById(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

function spongeCellAt(sponge, wx, wy) {
  if (wx < sponge.x || wx >= sponge.x + sponge.w ||
      wy < sponge.y || wy >= sponge.y + sponge.h) return -1;
  const cx = Math.floor((wx - sponge.x) / sponge.cell);
  const cy = Math.floor((wy - sponge.y) / sponge.cell);
  return cy * sponge.cols + cx;
}
