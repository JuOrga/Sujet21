"use strict";

// Un tableau de test : un problème fermé (§7.1), traversable par trois
// routes selon l'état (critère de sortie du jalon M1) :
//   - liquide : se faufiler par la fente haute, ou payer la barrière d'éponge ;
//   - glace   : geler dans la cryobaie et glisser par le couloir bas, dont
//               l'éponge n'a pas prise sur la glace ;
//   - vapeur  : chauffer au radiateur, puis traverser la barrière en une
//               détente explosive — la vitesse limite le temps de contact.
function makeSponge(x, y, w, h, name) {
  const cell = 20;
  const cols = Math.round(w / cell), rows = Math.round(h / cell);
  return { x, y, w, h, cell, cols, rows, stored: new Uint8Array(cols * rows), name };
}

function makeLevel() {
  const W = 2600, H = 1200, T = 40;
  const walls = [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },
    // premier mur : large passage central
    { x: 880, y: T, w: 60, h: 460 },
    { x: 880, y: 700, w: 60, h: H - T - 700 },
    // second mur : fente étroite en haut, barrière d'éponge au centre,
    // couloir bas ouvert (route de la glace)
    { x: 1480, y: T, w: 60, h: 110 },   // fente entre y=150 et y=190
    { x: 1480, y: 190, w: 60, h: 110 },
    { x: 1480, y: 900, w: 60, h: 110 }, // le couloir bas s'ouvre à y=1010
  ];

  // Zones thermiques (§5) : le tableau se lit comme une carte de température.
  const zones = [
    { kind: "heat", x: 1000, y: T, w: 400, h: 140, name: "RADIATEUR" },
    { kind: "cold", x: 980, y: 1000, w: 420, h: H - T - 1000, name: "CRYOBAIE" },
  ];

  // Matériau absorbant (mécanique validée du doc, §6) : grilles de cellules
  // qui saturent une à une. Sans prise sur la glace.
  const sponges = [
    makeSponge(1480, 300, 60, 600, "ÉPONGE"),          // barrière centrale
    makeSponge(1560, 1010, 260, 40, "ÉPONGE"),         // couloir bas, paroi haute
    makeSponge(1560, 1120, 260, 40, null),             // couloir bas, paroi basse
  ];

  return {
    bounds: { x: 0, y: 0, w: W, h: H },
    walls, zones, sponges,
    exit: { x: 2440, y: 500, w: 120, h: 200 },
    spawn: { x: 300, y: 600 },
  };
}

function spongeCellAt(sponge, wx, wy) {
  if (wx < sponge.x || wx >= sponge.x + sponge.w ||
      wy < sponge.y || wy >= sponge.y + sponge.h) return -1;
  const cx = Math.floor((wx - sponge.x) / sponge.cell);
  const cy = Math.floor((wy - sponge.y) / sponge.cell);
  return cy * sponge.cols + cx;
}
