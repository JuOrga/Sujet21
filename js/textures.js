"use strict";

// Habillage des surfaces : matériaux procéduraux, cuits une fois dans une
// tuile hors écran puis répétés en motif. Pas de fichier binaire, pas
// d'outillage — le prototype s'ouvre toujours d'un double-clic sur
// index.html, et la tuile est déterministe (graine fixe) : le décor est
// identique d'une partie à l'autre.
//
// Deux matériaux pour les parois :
//   « beton » — béton lisse gris foncé, brut, sans aucun signe ;
//   « sf »    — même béton, mais coffré en panneaux : joints creusés,
//               arête éclairée, boulons d'angle. Sobre : rien ne brille,
//               rien ne clignote, le décor reste en retrait du fluide.
const Textures = (() => {
  const TILE = 128; // côté de la tuile, en unités monde

  // --- bruit déterministe ---------------------------------------------

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bruit de valeur sur un réseau qui boucle : la tuile est raccordable,
  // aucune couture ne trahit la répétition.
  function lattice(size, rnd) {
    const a = new Float32Array(size * size);
    for (let i = 0; i < a.length; i++) a[i] = rnd();
    return a;
  }

  function sampleWrapped(a, size, x, y) {
    const x0 = Math.floor(x) % size, y0 = Math.floor(y) % size;
    const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
    const fx = x - Math.floor(x), fy = y - Math.floor(y);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); // lissage
    const a00 = a[y0 * size + x0], a10 = a[y0 * size + x1];
    const a01 = a[y1 * size + x0], a11 = a[y1 * size + x1];
    return (a00 * (1 - sx) + a10 * sx) * (1 - sy) + (a01 * (1 - sx) + a11 * sx) * sy;
  }

  // Somme d'octaves : les grandes taches donnent la matière coulée,
  // les petites le grain de surface.
  function fbm(octaves, seed) {
    const rnd = mulberry32(seed);
    const grids = octaves.map((o) => ({ size: o.size, data: lattice(o.size, rnd), amp: o.amp }));
    return (px, py) => {
      let v = 0;
      for (const g of grids) {
        const s = g.size / TILE;
        v += (sampleWrapped(g.data, g.size, px * s, py * s) - 0.5) * 2 * g.amp;
      }
      return v;
    };
  }

  // --- matériaux -------------------------------------------------------

  const MATERIALS = {
    // Version 1 — béton lisse, gris foncé neutre. Rien d'autre que la
    // matière : masse coulée, grain fin, quelques granulats plus sombres.
    beton: {
      label: "Béton lisse",
      base: [38, 41, 45],
      edge: "#474d55",       // liseré de contour
      taches: 8.5,           // amplitude des grandes taches de coulée
      grain: 4.5,            // grain fin, par pixel
      granulats: 90,         // nombre de granulats par tuile
      panneaux: 0,           // pas de joints : dalle continue
    },

    // Version 2 — même béton, coffré en panneaux : c'est la coque d'un
    // vaisseau, pas un mur d'usine. Le SF tient au découpage et à la
    // lumière rasante, pas à une couleur d'accent.
    sf: {
      label: "Béton coffré (SF sobre)",
      base: [36, 40, 46],    // même gris, une pointe plus froide
      edge: "#4a5566",
      taches: 8,             // matière plus égale : surface travaillée
      grain: 3.5,
      granulats: 55,
      panneaux: 64,          // joints tous les 64 px monde (2 × 2 par tuile)
      joint: -13,            // creux du joint
      arete: 9,              // arête éclairée sous le joint
      boulons: true,         // boulons aux angles de panneau
    },
  };

  const tiles = {};   // tuiles cuites, par matériau
  const patterns = new Map(); // motifs, par (contexte, matériau)

  function bake(name) {
    const M = MATERIALS[name];
    const cv = document.createElement("canvas");
    cv.width = TILE; cv.height = TILE;
    const c = cv.getContext("2d");

    // 1. la matière : taches de coulée + grain fin
    const macro = fbm([{ size: 4, amp: 1 }, { size: 8, amp: 0.55 }, { size: 16, amp: 0.3 }], 20260826);
    const micro = fbm([{ size: 64, amp: 1 }], 991);
    const img = c.createImageData(TILE, TILE);
    const d = img.data;
    const rnd = mulberry32(4242);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const v = macro(x, y) * M.taches
                + micro(x, y) * M.grain * 0.6
                + (rnd() - 0.5) * M.grain;
        const i = (y * TILE + x) * 4;
        d[i] = M.base[0] + v; d[i + 1] = M.base[1] + v; d[i + 2] = M.base[2] + v;
        d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);

    // 2. granulats : ponctuations sombres, à peine visibles — c'est ce qui
    //    empêche le béton de virer au plastique
    for (let k = 0; k < M.granulats; k++) {
      const x = rnd() * TILE, y = rnd() * TILE, r = 0.6 + rnd() * 1.5;
      c.fillStyle = `rgba(12, 14, 17, ${0.10 + rnd() * 0.16})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }

    // 3. coffrage (version SF) : joints creusés, arête éclairée dessous,
    //    boulons aux angles. Tracé en boucle sur la tuile pour rester
    //    raccordable.
    if (M.panneaux) {
      const p = M.panneaux;
      const dark = `rgba(0, 0, 0, ${Math.abs(M.joint) / 60})`;
      const lite = `rgba(190, 208, 230, ${M.arete / 130})`;
      c.lineWidth = 2;
      for (let g = 0; g < TILE; g += p) {
        c.strokeStyle = dark;
        c.beginPath(); c.moveTo(g + 1, 0); c.lineTo(g + 1, TILE);
        c.moveTo(0, g + 1); c.lineTo(TILE, g + 1); c.stroke();
        c.strokeStyle = lite;
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(g + 2.5, 0); c.lineTo(g + 2.5, TILE);
        c.moveTo(0, g + 2.5); c.lineTo(TILE, g + 2.5); c.stroke();
        c.lineWidth = 2;
      }
      if (M.boulons) {
        for (let gy = 0; gy < TILE; gy += p)
          for (let gx = 0; gx < TILE; gx += p) {
            // deux boulons par angle de panneau, décalés vers l'intérieur
            for (const [ox, oy] of [[9, 9], [p - 9, 9], [9, p - 9], [p - 9, p - 9]]) {
              const x = (gx + ox) % TILE, y = (gy + oy) % TILE;
              c.fillStyle = "rgba(0, 0, 0, 0.30)";
              c.beginPath(); c.arc(x, y + 0.9, 1.9, 0, Math.PI * 2); c.fill();
              c.fillStyle = "rgba(150, 166, 186, 0.26)";
              c.beginPath(); c.arc(x, y - 0.2, 1.7, 0, Math.PI * 2); c.fill();
            }
          }
      }
    }
    return cv;
  }

  function tile(name) {
    if (!tiles[name]) tiles[name] = bake(name);
    return tiles[name];
  }

  // Motif prêt à peindre. Le motif vit en coordonnées monde : il suit la
  // caméra et le zoom, la paroi ne « glisse » pas sous le décor.
  function pattern(ctx, name) {
    const key = name;
    let byCtx = patterns.get(ctx);
    if (!byCtx) { byCtx = {}; patterns.set(ctx, byCtx); }
    if (!byCtx[key]) byCtx[key] = ctx.createPattern(tile(name), "repeat");
    return byCtx[key];
  }

  const ORDER = ["sf", "beton"];
  let current = ORDER[0];

  return {
    TILE,
    materials: MATERIALS,
    tile, pattern,
    current: () => current,
    material: () => MATERIALS[current],
    set(name) { if (MATERIALS[name]) current = name; return current; },
    // bascule d'une version à l'autre : sert à les comparer en jeu
    cycle() { current = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]; return current; },
  };
})();
