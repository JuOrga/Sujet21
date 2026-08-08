"use strict";

// Un tableau de test : un problème fermé (§7.1).
// Deux routes vers le sas : payer l'éponge en volume, ou se faufiler
// (éventuellement se scinder) par la fente haute.
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
    // second mur : fente étroite en haut, barrière d'éponge au centre
    { x: 1480, y: T, w: 60, h: 110 },   // fente entre y=150 et y=190
    { x: 1480, y: 190, w: 60, h: 110 },
    { x: 1480, y: 900, w: 60, h: 260 },
  ];

  // Barrière absorbante (mécanique validée du doc, §6) : grille de cellules
  // qui saturent une à une. On peut « payer un passage en volume ».
  const sponge = {
    x: 1480, y: 300, w: 60, h: 600, cell: 20,
    cols: 3, rows: 30,
    stored: new Uint8Array(3 * 30),
  };

  return {
    bounds: { x: 0, y: 0, w: W, h: H },
    walls, sponge,
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
