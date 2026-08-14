"use strict";

// Solveur de fluide « Position Based Fluids » 2D, sans gravité.
// La contrainte de densité n'est pas bornée : une région trop peu dense
// attire ses voisines. C'est de là que vient la cohésion du corps — la
// tension de surface est un comportement du modèle, pas une règle (§2.3).
//
// Deux implémentations du même solveur, à API identique :
//   - le module WebAssembly (wasm/fluid.c), embarqué en base64 dans
//     js/fluid.wasm.js pour que le jeu s'ouvre toujours sans serveur ;
//   - la version JavaScript d'origine, conservée comme référence et repli.
// Fluid.ready (promesse) signale que le choix est fait ; Fluid.backend dit
// lequel tourne. Seule la partie chaude est portée : la logique de jeu
// (éjection, amas joueur, éponge, chaleur) reste en JS et continue de lire
// et d'écrire les tableaux x, y, vx… directement.
const Fluid = (() => {
  const MAX = 4000;

  // ---------- Implémentation JavaScript (référence et repli) ----------

  function makeJS() {
    const x  = new Float32Array(MAX), y  = new Float32Array(MAX);
    const vx = new Float32Array(MAX), vy = new Float32Array(MAX);
    const px = new Float32Array(MAX), py = new Float32Array(MAX);
    const lam = new Float32Array(MAX);
    const dpx = new Float32Array(MAX), dpy = new Float32Array(MAX);
    const nvx = new Float32Array(MAX), nvy = new Float32Array(MAX);
    const mergeTimer = new Float32Array(MAX);  // > 0 : goutte fraîchement éjectée
    const ballistic = new Float32Array(MAX);   // > 0 : découplée du fluide (en cours de détachement)
    const spongeT = new Float32Array(MAX);     // temps de contact continu avec l'éponge
    const temp = new Float32Array(MAX);        // température normalisée (0 = gel, 1 = ébullition)
    const frozen = new Uint8Array(MAX);        // 1 : particule prise dans le corps gelé (hors solveur)
    let n = 0;
    let rho0 = 1; // calibrée après le spawn

    const grid = new HashGrid();
    const nbr = []; // listes de voisins, réutilisées
    for (let i = 0; i < MAX; i++) nbr.push([]);

    function add(ax, ay, avx, avy) {
      if (n >= MAX) return -1;
      x[n] = ax; y[n] = ay; vx[n] = avx || 0; vy[n] = avy || 0;
      mergeTimer[n] = 0; ballistic[n] = 0; spongeT[n] = 0;
      temp[n] = P.tempAmbient; frozen[n] = 0;
      return n++;
    }

    function remove(i) { // échange avec la dernière
      n--;
      x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n];
      mergeTimer[i] = mergeTimer[n]; ballistic[i] = ballistic[n]; spongeT[i] = spongeT[n];
      temp[i] = temp[n]; frozen[i] = frozen[n];
    }

    function clear() { n = 0; }

    function findNeighbors() {
      const h = P.h, h2 = h * h;
      grid.build(px, py, n, h);
      for (let i = 0; i < n; i++) {
        const list = nbr[i];
        list.length = 0;
        // en vol libre ou gelée : aucun couplage fluide (la glace est rigide)
        if (ballistic[i] > 0 || frozen[i]) continue;
        const xi = px[i], yi = py[i];
        grid.query(xi, yi, h, (j) => {
          if (j === i || ballistic[j] > 0 || frozen[j]) return;
          const dx = xi - px[j], dy = yi - py[j];
          if (dx * dx + dy * dy < h2) list.push(j);
        });
      }
    }

    // Noyaux non normalisés ; les constantes sont absorbées par la calibration de rho0.
    function wPoly6(r2, h2) { const q = 1 - r2 / h2; return q * q * q; }        // W(0) = 1
    function dwSpiky(r, h)  { const q = 1 - r / h;  return -(q * q) / h; }      // dW/dr <= 0

    function density(i) {
      const h2 = P.h * P.h;
      let rho = 1; // contribution propre
      const list = nbr[i];
      for (let m = 0; m < list.length; m++) {
        const j = list[m];
        const dx = px[i] - px[j], dy = py[i] - py[j];
        rho += wPoly6(dx * dx + dy * dy, h2);
      }
      return rho;
    }

    // Après le spawn : la densité de repos = densité médiane des particules intérieures.
    function calibrate() {
      for (let i = 0; i < n; i++) { px[i] = x[i]; py[i] = y[i]; }
      findNeighbors();
      const interior = [];
      for (let i = 0; i < n; i++) if (nbr[i].length >= 6) interior.push(density(i));
      interior.sort((a, b) => a - b);
      rho0 = interior.length ? interior[Math.floor(interior.length / 2)] : 4;
    }

    function collide(i, level) {
      const b = level.bounds, m = 4;
      if (px[i] < b.x + m) px[i] = b.x + m;
      if (px[i] > b.x + b.w - m) px[i] = b.x + b.w - m;
      if (py[i] < b.y + m) py[i] = b.y + m;
      if (py[i] > b.y + b.h - m) py[i] = b.y + b.h - m;
      const walls = level.walls;
      for (let w = 0; w < walls.length; w++) {
        const W = walls[w];
        if (px[i] > W.x && px[i] < W.x + W.w && py[i] > W.y && py[i] < W.y + W.h) {
          // projection vers la face la plus proche
          const dl = px[i] - W.x, dr = W.x + W.w - px[i];
          const dt = py[i] - W.y, db = W.y + W.h - py[i];
          const min = Math.min(dl, dr, dt, db);
          if (min === dl) px[i] = W.x;
          else if (min === dr) px[i] = W.x + W.w;
          else if (min === dt) py[i] = W.y;
          else py[i] = W.y + W.h;
        }
      }
    }

    function substep(sdt, level) {
      const h = P.h, h2 = h * h;
      for (let i = 0; i < n; i++) {
        // les particules gelées sont déplacées en bloc rigide par le jeu
        if (frozen[i]) { px[i] = x[i]; py[i] = y[i]; continue; }
        px[i] = x[i] + vx[i] * sdt;
        py[i] = y[i] + vy[i] * sdt;
      }
      findNeighbors();

      const wDq = wPoly6(P.sCorrDq * P.sCorrDq * h2, h2);
      for (let it = 0; it < P.iterations; it++) {
        // multiplicateurs de Lagrange
        for (let i = 0; i < n; i++) {
          const list = nbr[i];
          let rho = 1, sgx = 0, sgy = 0, sum2 = 0;
          for (let m = 0; m < list.length; m++) {
            const j = list[m];
            const dx = px[i] - px[j], dy = py[i] - py[j];
            const r2 = dx * dx + dy * dy;
            const r = Math.sqrt(r2);
            rho += wPoly6(r2, h2);
            if (r > 1e-6) {
              const g = dwSpiky(r, h) / rho0;
              const gx = g * dx / r, gy = g * dy / r;
              sgx += gx; sgy += gy;
              sum2 += gx * gx + gy * gy;
            }
          }
          sum2 += sgx * sgx + sgy * sgy;
          lam[i] = -(rho / rho0 - 1) / (sum2 + P.eps);
        }
        // corrections de position
        for (let i = 0; i < n; i++) {
          const list = nbr[i];
          let sx = 0, sy = 0;
          for (let m = 0; m < list.length; m++) {
            const j = list[m];
            const dx = px[i] - px[j], dy = py[i] - py[j];
            const r2 = dx * dx + dy * dy;
            const r = Math.sqrt(r2);
            if (r > 1e-6) {
              const sc = -P.sCorrK * Math.pow(wPoly6(r2, h2) / wDq, 4);
              const s = (lam[i] + lam[j] + sc) * dwSpiky(r, h) / rho0;
              sx += s * dx / r; sy += s * dy / r;
            }
          }
          dpx[i] = sx; dpy[i] = sy;
        }
        for (let i = 0; i < n; i++) {
          if (frozen[i]) continue;
          px[i] += dpx[i]; py[i] += dpy[i];
          collide(i, level);
        }
      }

      // vitesse depuis les positions + viscosité XSPH (symétrique : conserve la q. de mvt)
      for (let i = 0; i < n; i++) {
        if (frozen[i]) continue; // la vitesse du bloc gelé est gérée par le jeu
        vx[i] = (px[i] - x[i]) / sdt;
        vy[i] = (py[i] - y[i]) / sdt;
      }
      for (let i = 0; i < n; i++) { nvx[i] = 0; nvy[i] = 0; }
      for (let i = 0; i < n; i++) {
        const list = nbr[i];
        for (let m = 0; m < list.length; m++) {
          const j = list[m];
          if (j < i) continue; // chaque paire une seule fois
          const dx = px[i] - px[j], dy = py[i] - py[j];
          const w = wPoly6(dx * dx + dy * dy, h2);
          const fx = (vx[j] - vx[i]) * w, fy = (vy[j] - vy[i]) * w;
          nvx[i] += fx; nvy[i] += fy;
          nvx[j] -= fx; nvy[j] -= fy;
        }
      }
      const c = P.viscosity;
      for (let i = 0; i < n; i++) {
        if (frozen[i]) continue;
        vx[i] += c * nvx[i]; vy[i] += c * nvy[i];
        const sp = Math.hypot(vx[i], vy[i]);
        if (sp > P.maxSpeed) { vx[i] *= P.maxSpeed / sp; vy[i] *= P.maxSpeed / sp; }
        x[i] = px[i]; y[i] = py[i];
      }
    }

    function step(dt, level) {
      const s = Math.max(1, Math.round(P.substeps));
      for (let k = 0; k < s; k++) substep(dt / s, level);
      for (let i = 0; i < n; i++) {
        if (mergeTimer[i] > 0) mergeTimer[i] -= dt;
        if (ballistic[i] > 0) ballistic[i] -= dt;
      }
    }

    return {
      x, y, vx, vy, mergeTimer, ballistic, spongeT, temp, frozen, grid,
      get n() { return n; },
      add, remove, clear, step, calibrate,
      backend: "js",
    };
  }

  // ---------- Enveloppe du module WebAssembly ----------

  // Le module possède les tableaux (mémoire linéaire, vues partagées avec JS)
  // et la boucle chaude (step, calibrate). add/remove/clear et le comptage n
  // restent ici : c'est de la tenue de registres, pas du calcul.
  function makeWasm(E) {
    const buf = E.memory.buffer;
    const fview = (ptr) => new Float32Array(buf, ptr, MAX);
    const x = fview(E.x_ptr()), y = fview(E.y_ptr());
    const vx = fview(E.vx_ptr()), vy = fview(E.vy_ptr());
    const mergeTimer = fview(E.merge_ptr());
    const ballistic = fview(E.ballistic_ptr());
    const spongeT = fview(E.sponge_ptr());
    const temp = fview(E.temp_ptr());
    const frozen = new Uint8Array(buf, E.frozen_ptr(), MAX);
    const maxWalls = E.max_walls();
    const walls = new Float32Array(buf, E.walls_ptr(), maxWalls * 4);
    let n = 0;

    function add(ax, ay, avx, avy) {
      if (n >= MAX) return -1;
      x[n] = ax; y[n] = ay; vx[n] = avx || 0; vy[n] = avy || 0;
      mergeTimer[n] = 0; ballistic[n] = 0; spongeT[n] = 0;
      temp[n] = P.tempAmbient; frozen[n] = 0;
      return n++;
    }

    function remove(i) { // échange avec la dernière
      n--;
      x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n];
      mergeTimer[i] = mergeTimer[n]; ballistic[i] = ballistic[n]; spongeT[i] = spongeT[n];
      temp[i] = temp[n]; frozen[i] = frozen[n];
    }

    function clear() { n = 0; }

    // Les paramètres (banc de réglage) et le niveau sont poussés à chaque
    // pas : quelques scalaires et rectangles, négligeable devant le solveur.
    function pushParams() {
      E.set_params(P.h, P.eps, P.sCorrK, P.sCorrDq, P.viscosity, P.maxSpeed,
                   Math.max(1, Math.round(P.iterations)));
    }

    function pushLevel(level) {
      const b = level.bounds;
      E.set_bounds(b.x, b.y, b.w, b.h);
      const count = Math.min(maxWalls, level.walls.length);
      for (let w = 0; w < count; w++) {
        const W = level.walls[w];
        walls[w * 4] = W.x; walls[w * 4 + 1] = W.y;
        walls[w * 4 + 2] = W.w; walls[w * 4 + 3] = W.h;
      }
      E.set_wall_count(count);
    }

    function step(dt, level) {
      pushParams();
      pushLevel(level);
      E.step(n, dt, Math.max(1, Math.round(P.substeps)));
    }

    function calibrate() {
      pushParams();
      E.calibrate(n);
    }

    return {
      x, y, vx, vy, mergeTimer, ballistic, spongeT, temp, frozen,
      grid: new HashGrid(), // pour l'amas joueur (main.js), hors solveur
      get n() { return n; },
      add, remove, clear, step, calibrate,
      backend: "wasm",
    };
  }

  // ---------- Choix de l'implémentation ----------

  // Le repli JS est prêt immédiatement ; le module WASM le remplace dès son
  // instanciation. main.js attend Fluid.ready avant de lancer la partie, le
  // choix est donc fait une fois pour toutes avant le premier spawn.
  let current = makeJS();

  const ready = (async () => {
    if (typeof FLUID_WASM_B64 !== "string" || typeof WebAssembly === "undefined") return;
    try {
      const s = atob(FLUID_WASM_B64);
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
      const { instance } = await WebAssembly.instantiate(bytes, {});
      current = makeWasm(instance.exports);
    } catch (e) {
      console.warn("Solveur WebAssembly indisponible, repli JavaScript :", e);
    }
  })();

  return {
    get x() { return current.x; },
    get y() { return current.y; },
    get vx() { return current.vx; },
    get vy() { return current.vy; },
    get mergeTimer() { return current.mergeTimer; },
    get ballistic() { return current.ballistic; },
    get spongeT() { return current.spongeT; },
    get temp() { return current.temp; },
    get frozen() { return current.frozen; },
    get grid() { return current.grid; },
    get n() { return current.n; },
    get backend() { return current.backend; },
    ready,
    add: (ax, ay, avx, avy) => current.add(ax, ay, avx, avy),
    remove: (i) => current.remove(i),
    clear: () => current.clear(),
    step: (dt, level) => current.step(dt, level),
    calibrate: () => current.calibrate(),
  };
})();
