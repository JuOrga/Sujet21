"use strict";

// Un tableau de test : un problème fermé (§7.1), traversable par trois
// routes selon l'état (critère de sortie du jalon M1) :
//   - liquide : se faufiler par la fente haute, ou payer la barrière d'éponge ;
//   - glace   : geler dans la cryobaie et glisser par le couloir bas, dont
//               l'éponge n'a pas prise sur la glace ;
//   - vapeur  : chauffer au radiateur, puis traverser la barrière en une
//               détente explosive — la vitesse limite le temps de contact.
//
// La première salle porte en plus le relief (jalon M1.5). Le tableau se lit de
// dessus : une région de relief a une altitude en niveaux — un palier au-dessus
// du sol, une fosse en dessous. Ses arêtes sont des parois tant qu'on ne les
// franchit pas ; monter dessus coûte du volume, y descendre est gratuit. Une
// fosse qui se remplit est une zone d'interaction : elle arme un déclencheur.
function makeSponge(x, y, w, h, name) {
  const cell = 20;
  const cols = Math.round(w / cell), rows = Math.round(h / cell);
  return { x, y, w, h, cell, cols, rows, stored: new Uint8Array(cols * rows), name };
}

// Palier : une région surélevée. Vue de dessus, ce n'est pas un obstacle mais
// un autre niveau — on s'y arrête au pied de ses arêtes, on n'y monte qu'en
// payant. z est son altitude en niveaux au-dessus du sol.
function makePalier(x, y, w, h, z, name) {
  return { kind: "palier", x, y, w, h, z, name };
}

// Fosse : une région en contrebas. Le liquide s'arrête tout seul sur ses
// arêtes ; direction voulue + prise, il s'y écoule — gratuitement. Si elle
// est un collecteur, son remplissage arme un déclencheur.
function makeFosse(x, y, w, h, z, name, opens) {
  return {
    kind: "fosse", x, y, w, h, z, name, opens: opens || null,
    held: 0, armed: false, fill: 0,
  };
}

function makeLevel() {
  const W = 2600, H = 1200, T = 40;

  // Vanne du pont inférieur : fermée, elle complète exactement la paroi
  // centrale ; ouverte (collecteur amorcé), elle ouvre une route latérale
  // vers la cryobaie — un déblocage, jamais un raccourci (§9.1).
  const vanne = { x: 880, y: 940, w: 60, h: 60, open: false, locked: false,
                  name: "VANNE" };

  // Le banc de relief de la première salle, à l'écart des routes existantes.
  // Le belvédère est à +2 : inaccessible d'un seul élan depuis le sol (le
  // dénivelé maximal se règle au banc), mais à un pas du palier. C'est là que
  // se branche un déblocage de progression — le même décor, une route de plus.
  const palier = makePalier(100, 740, 240, 240, 1, "PALIER");
  const belvedere = makePalier(100, 980, 240, 140, 2, "BELVÉDÈRE");
  const fosse = makeFosse(560, 800, 260, 280, -1, "COLLECTEUR", vanne);

  const walls = [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },
    // premier mur : large passage central, et plus bas la vanne du collecteur
    { x: 880, y: T, w: 60, h: 460 },
    { x: 880, y: 700, w: 60, h: 240 },   // de part et d'autre de la vanne (y 940–1000)
    { x: 880, y: 1000, w: 60, h: H - T - 1000 },
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

  const reliefs = [palier, belvedere, fosse];
  reliefs.forEach((r, k) => { r.idx = k; }); // indice stocké dans Fluid.reg

  return {
    bounds: { x: 0, y: 0, w: W, h: H },
    walls, zones, sponges,
    reliefs,
    fosses: [fosse],
    gates: [vanne],
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
