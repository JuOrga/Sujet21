"use strict";

// Un tableau, trois routes selon l'état (critère de sortie du jalon M1) :
//   - LIQUIDE (couloir central) : la barrière d'éponge à payer en volume,
//     ou la fente étroite qui demande de se déformer.
//   - GLACE (couloir haut) : une cryobaie gèle le corps lancé ; le tunnel
//     absorbant qui suit viderait un corps liquide, mais l'éponge n'a pas
//     prise sur la glace — on le traverse en glissant. Un radiateur fait
//     fondre avant la sortie.
//   - VAPEUR (couloir bas) : un radiateur en cul-de-sac sert de catapulte :
//     le flanc exposé bout, la bouffée part vers la source, le corps est
//     projeté le long du couloir. Rapide, mais la vapeur est perdue.
function makeLevel() {
  const W = 3400, H = 1600, T = 40;
  const walls = [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },
    // deux longues cloisons séparent les trois couloirs (x 1000 -> 2600)
    { x: 1000, y: 520, w: 1600, h: 60 },
    { x: 1000, y: 1020, w: 1600, h: 60 },
    // couloir central : barrière verticale — fente en haut, éponge en dessous
    { x: 1750, y: 580, w: 60, h: 80 },   // fente entre y=660 et y=700
    { x: 1750, y: 700, w: 60, h: 60 },
  ];

  const sponges = [
    // barrière du couloir central : payable en volume, cellule par cellule (§6)
    { x: 1750, y: 760, w: 60, h: 260, cell: 20, cols: 3, rows: 13,
      stored: new Uint8Array(3 * 13) },
    // tunnel absorbant du couloir haut : trop long pour être payé en liquide —
    // seule la glace le traverse intacte
    { x: 1700, y: T, w: 460, h: 480, cell: 20, cols: 23, rows: 24,
      stored: new Uint8Array(23 * 24) },
  ];

  // Carte thermique (§5) : le level design se pense en gradients de
  // température, pas en portes. t est la température au cœur de la source.
  const heatSources = [
    { x: 1280, y: 280, r: 330, t: -0.55 },  // cryobaie du couloir haut
    { x: 2420, y: 240, r: 250, t: 1.3 },    // radiateur de fonte, fin du couloir haut
    { x: 1090, y: 1300, r: 300, t: 1.6 },   // catapulte à vapeur, entrée du couloir bas
    { x: 2080, y: 1560, r: 230, t: 1.5 },   // conduite chaude : danger si on dérive bas
  ];

  return {
    bounds: { x: 0, y: 0, w: W, h: H },
    walls, sponges, heatSources,
    exit: { x: 3240, y: 700, w: 120, h: 200 },
    spawn: { x: 320, y: 800 },
  };
}

function spongeCellAt(sponge, wx, wy) {
  if (wx < sponge.x || wx >= sponge.x + sponge.w ||
      wy < sponge.y || wy >= sponge.y + sponge.h) return -1;
  const cx = Math.floor((wx - sponge.x) / sponge.cell);
  const cy = Math.floor((wy - sponge.y) / sponge.cell);
  return cy * sponge.cols + cx;
}
