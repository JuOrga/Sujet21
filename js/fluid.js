"use strict";

// Solveur de fluide « Position Based Fluids » 2D, sans gravité.
// La contrainte de densité n'est pas bornée : une région trop peu dense
// attire ses voisines. C'est de là que vient la cohésion du corps — la
// tension de surface est un comportement du modèle, pas une règle (§2.3).
const Fluid = (() => {
  const MAX = 4000;
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
  // Champ d'accélérations extérieures (px/s²), rempli par le jeu avant chaque
  // pas : ruissellement vers une arête, aspiration d'une fosse. Le solveur ne
  // sait pas ce que ces forces signifient — il les intègre, point. À zéro (le
  // cas par défaut), rien ne change.
  const accX = new Float32Array(MAX), accY = new Float32Array(MAX);
  // Le jeu est vu de dessus : l'altitude n'est pas une force, c'est un niveau.
  // reg[i] = indice de la région de relief où se trouve la particule, ou -1
  // pour le niveau du sol. Une particule ne change de niveau que par une
  // transition explicite (monter, descendre) ; le reste du temps, une arête
  // est une paroi.
  const reg = new Int16Array(MAX).fill(-1);
  // Deux niveaux ne se voient pas — sauf le temps d'un franchissement, où le
  // jeu déclare une passerelle entre eux : le volume à cheval sur la marche
  // reste alors un seul fluide, continu, donc stable. Le solveur ne sait pas
  // ce que ces deux entiers signifient.
  let bridgeA = 0, bridgeB = 0, bridged = false;
  function setBridge(a, b) {
    bridged = a !== undefined && a !== null;
    if (bridged) { bridgeA = a; bridgeB = b; }
  }
  function linked(ri, rj) {
    if (ri === rj) return true;
    if (!bridged) return false;
    return (ri === bridgeA && rj === bridgeB) || (ri === bridgeB && rj === bridgeA);
  }
  function inside(i, R) {
    return px[i] > R.x && px[i] < R.x + R.w && py[i] > R.y && py[i] < R.y + R.h;
  }
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
    accX[n] = 0; accY[n] = 0; reg[n] = -1;
    return n++;
  }

  function remove(i) { // échange avec la dernière
    n--;
    x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n];
    mergeTimer[i] = mergeTimer[n]; ballistic[i] = ballistic[n]; spongeT[i] = spongeT[n];
    temp[i] = temp[n]; frozen[i] = frozen[n];
    accX[i] = accX[n]; accY[i] = accY[n]; reg[i] = reg[n];
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
      const ri = reg[i];
      grid.query(xi, yi, h, (j) => {
        if (j === i || ballistic[j] > 0 || frozen[j]) return;
        // deux niveaux différents occupent le même point du plan sans se
        // toucher : vu de dessus, l'un est simplement au-dessus de l'autre
        if (!linked(ri, reg[j])) return;
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

  // Projection hors d'une boîte solide, vers la face la plus proche.
  function pushOut(i, W) {
    if (px[i] > W.x && px[i] < W.x + W.w && py[i] > W.y && py[i] < W.y + W.h) {
      const dl = px[i] - W.x, dr = W.x + W.w - px[i];
      const dt = py[i] - W.y, db = W.y + W.h - py[i];
      const min = Math.min(dl, dr, dt, db);
      if (min === dl) px[i] = W.x;
      else if (min === dr) px[i] = W.x + W.w;
      else if (min === dt) py[i] = W.y;
      else py[i] = W.y + W.h;
    }
  }

  // Confinement à une région : sur un relief, on ne quitte pas son niveau —
  // ses arêtes le tiennent comme des parois vues de dessus.
  function keepInside(i, R) {
    const m = 3;
    if (px[i] < R.x + m) px[i] = R.x + m;
    if (px[i] > R.x + R.w - m) px[i] = R.x + R.w - m;
    if (py[i] < R.y + m) py[i] = R.y + m;
    if (py[i] > R.y + R.h - m) py[i] = R.y + R.h - m;
  }

  function collide(i, level) {
    const b = level.bounds, m = 4;
    if (px[i] < b.x + m) px[i] = b.x + m;
    if (px[i] > b.x + b.w - m) px[i] = b.x + b.w - m;
    if (py[i] < b.y + m) py[i] = b.y + m;
    if (py[i] > b.y + b.h - m) py[i] = b.y + b.h - m;
    const walls = level.walls;
    for (let w = 0; w < walls.length; w++) pushOut(i, walls[w]);
    // Vantaux : arête d'une fosse, vanne d'un déclencheur. Fermés, ce sont
    // des parois comme les autres ; ouverts, ils n'existent plus.
    const gates = level.gates;
    if (gates) for (let g = 0; g < gates.length; g++)
      if (!gates[g].open) pushOut(i, gates[g]);
    // Relief : chaque niveau est un monde clos — ses arêtes sont des parois.
    // Sauf celle que le jeu vient d'ouvrir (la passerelle) : par celle-là, le
    // fluide passe de lui-même, et c'est le jeu qui constate le changement
    // d'étage après coup.
    const R = level.reliefs;
    if (!R) return;
    const k = reg[i];
    let inOpen = false;
    for (let m = 0; m < R.length; m++) {
      if (m === k) continue;
      if (linked(k, m)) { if (inside(i, R[m])) inOpen = true; continue; }
      pushOut(i, R[m]);
    }
    if (k >= 0 && !inOpen && !inside(i, R[k]) && !linked(k, -1)) keepInside(i, R[k]);
  }

  function substep(sdt, level) {
    const h = P.h, h2 = h * h;
    for (let i = 0; i < n; i++) {
      // les particules gelées sont déplacées en bloc rigide par le jeu
      if (frozen[i]) { px[i] = x[i]; py[i] = y[i]; continue; }
      vx[i] += accX[i] * sdt;
      vy[i] += accY[i] * sdt;
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
    x, y, vx, vy, mergeTimer, ballistic, spongeT, temp, frozen, accX, accY, reg, grid,
    get n() { return n; },
    add, remove, clear, step, calibrate, setBridge,
  };
})();
