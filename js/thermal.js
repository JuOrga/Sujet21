"use strict";

// M1 — La chaleur, seconde ressource (§4–5 du doc fonctionnel).
// Chaque particule porte une température ; le tableau est une carte thermique
// (radiateurs, cryobaies). Les états ne sont pas des règles : de simples
// seuils sur cette grandeur physique.
//   gel        -> le corps devient un solide balistique : on ne pilote plus,
//                 on glisse, on rebondit ; l'éponge n'a plus prise (§4 Glace)
//   ébullition -> la particule part en bouffée de vapeur, quantité de
//                 mouvement conservée : poussée explosive, volume perdu (§4 Vapeur)
const Thermal = (() => {
  // Corps de glace rigides (translation pure) : id -> { x, y, vx, vy, temp, count }
  const bodies = new Map();
  let nextId = 1;

  const delta = new Float32Array(4000); // flux de conduction par particule
  const neigh = new Int16Array(4000);   // nombre de voisines liquides

  function reset() { bodies.clear(); nextId = 1; }

  // --- La carte thermique du tableau ---
  function tempAt(level, wx, wy) {
    let t = P.ambient;
    const src = level.heatSources;
    for (let s = 0; s < src.length; s++) {
      const S = src[s];
      const dx = wx - S.x, dy = wy - S.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < S.r * S.r) {
        const w = 1 - Math.sqrt(d2) / S.r;
        t += (S.t - P.ambient) * w * w;
      }
    }
    return t;
  }

  // Conduction interne + échange avec le milieu. L'échange se fait surtout en
  // surface (peu de voisines) : l'inertie thermique d'un gros corps — lent à
  // chauffer, lent à geler — émerge au lieu d'être scriptée (§3.2).
  function conductAndExchange(dt, level) {
    const n = Fluid.n, h = P.h, h2 = h * h;
    const x = Fluid.x, y = Fluid.y, temp = Fluid.temp, phase = Fluid.phase;
    Fluid.grid.build(x, y, n, h);
    delta.fill(0, 0, n);
    neigh.fill(0, 0, n);
    const k = Math.min(0.06, P.diffusion * dt / 4);
    for (let i = 0; i < n; i++) {
      if (phase[i] !== 0) continue;
      Fluid.grid.query(x[i], y[i], h, (j) => {
        if (j <= i || phase[j] !== 0) return;
        const dx = x[i] - x[j], dy = y[i] - y[j];
        const r2 = dx * dx + dy * dy;
        if (r2 >= h2) return;
        neigh[i]++; neigh[j]++;
        const f = (temp[j] - temp[i]) * k * (1 - r2 / h2);
        delta[i] += f; delta[j] -= f;
      });
    }
    for (let i = 0; i < n; i++) {
      if (phase[i] !== 0) continue;
      const surf = Math.max(0.12, 1 - neigh[i] / 8);
      const T = tempAt(level, x[i], y[i]);
      temp[i] += delta[i] + (T - temp[i]) * Math.min(1, P.envRate * surf * dt);
    }
  }

  // --- Ébullition : chaque bouffée part définitivement ---
  function boil(player) {
    let count = 0;
    for (let i = 0; i < Fluid.n; i++) {
      if (Fluid.phase[i] !== 0 || Fluid.temp[i] < P.boilT) continue;
      // la bouffée part du côté chaud, vers l'extérieur du corps :
      // le recul pousse le corps loin de la source — fusée thermique
      let dx = Fluid.x[i] - player.cx, dy = Fluid.y[i] - player.cy;
      if (!player.flag[i] || (dx === 0 && dy === 0)) {
        const a = (i * 2.399963) % (Math.PI * 2);
        dx = Math.cos(a); dy = Math.sin(a);
      }
      const l = Math.hypot(dx, dy);
      const ex = dx / l, ey = dy / l;
      const dvx = ex * P.vaporSpeed, dvy = ey * P.vaporSpeed;
      // recul réparti sur les voisines liquides : q. de mvt exactement conservée
      const R = P.h * 3, R2 = R * R, near = [];
      Fluid.grid.query(Fluid.x[i], Fluid.y[i], R, (j) => {
        if (j === i || Fluid.phase[j] !== 0) return;
        const ddx = Fluid.x[j] - Fluid.x[i], ddy = Fluid.y[j] - Fluid.y[i];
        if (ddx * ddx + ddy * ddy < R2) near.push(j);
      });
      for (let m = 0; m < near.length; m++) {
        Fluid.vx[near[m]] -= dvx / near.length;
        Fluid.vy[near[m]] -= dvy / near.length;
      }
      Fluid.vx[i] += dvx; Fluid.vy[i] += dvy;
      Fluid.phase[i] = 2;
      Fluid.vaporT[i] = P.vaporLife;
      Fluid.mergeTimer[i] = 1e9; // la vapeur ne refusionne jamais (recondensation : M2)
      count++;
    }
    return count;
  }

  // --- Gel ---
  function freezeCluster(list) {
    let cx = 0, cy = 0, vx = 0, vy = 0, t = 0;
    const m = list.length;
    if (!m) return;
    for (const i of list) {
      cx += Fluid.x[i]; cy += Fluid.y[i];
      vx += Fluid.vx[i]; vy += Fluid.vy[i];
      t += Fluid.temp[i];
    }
    cx /= m; cy /= m; vx /= m; vy /= m; t /= m;
    const id = nextId++;
    bodies.set(id, { x: cx, y: cy, vx, vy, temp: t, count: m });
    for (const i of list) {
      Fluid.phase[i] = 1;
      Fluid.iceBody[i] = id;
      Fluid.iceOffX[i] = Fluid.x[i] - cx;
      Fluid.iceOffY[i] = Fluid.y[i] - cy;
      Fluid.vx[i] = vx; Fluid.vy[i] = vy;
      Fluid.spongeT[i] = 0;
    }
  }

  function updateFreeze(player) {
    // le corps joueur gèle d'un bloc : on choisit un vecteur, on ne pilote
    // plus — geler, c'est parier sur une trajectoire (§4 Glace)
    if (player.list.length && !player.frozen) {
      let t = 0, m = 0;
      for (const i of player.list) if (Fluid.phase[i] === 0) { t += Fluid.temp[i]; m++; }
      if (m && t / m < P.freezeT) {
        freezeCluster(player.list.filter((i) => Fluid.phase[i] === 0));
        return;
      }
    }
    // gouttes libres : grêlons individuels
    for (let i = 0; i < Fluid.n; i++) {
      if (Fluid.phase[i] === 0 && !player.flag[i] && Fluid.temp[i] < P.freezeT)
        freezeCluster([i]);
    }
  }

  // --- Mouvement rigide de la glace : translation, rebonds, fonte ---
  function collideRigid(b, px, py, acc) {
    // même géométrie que le fluide : bornes du tableau + murs rectangulaires
    const bounds = acc.level.bounds, m = 4;
    if (px < bounds.x + m) { acc.pushXp = Math.max(acc.pushXp, bounds.x + m - px); }
    if (px > bounds.x + bounds.w - m) { acc.pushXn = Math.min(acc.pushXn, bounds.x + bounds.w - m - px); }
    if (py < bounds.y + m) { acc.pushYp = Math.max(acc.pushYp, bounds.y + m - py); }
    if (py > bounds.y + bounds.h - m) { acc.pushYn = Math.min(acc.pushYn, bounds.y + bounds.h - m - py); }
    const walls = acc.level.walls;
    for (let w = 0; w < walls.length; w++) {
      const W = walls[w];
      if (px > W.x && px < W.x + W.w && py > W.y && py < W.y + W.h) {
        const dl = px - W.x, dr = W.x + W.w - px;
        const dt2 = py - W.y, db = W.y + W.h - py;
        const min = Math.min(dl, dr, dt2, db);
        if (min === dl) acc.pushXn = Math.min(acc.pushXn, -dl);
        else if (min === dr) acc.pushXp = Math.max(acc.pushXp, dr);
        else if (min === dt2) acc.pushYn = Math.min(acc.pushYn, -dt2);
        else acc.pushYp = Math.max(acc.pushYp, db);
      }
    }
  }

  function stepIce(dt, level) {
    if (!bodies.size) return;
    for (const b of bodies.values()) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.fieldT = 0; b.fieldN = 0;
      b.acc = { level, pushXp: 0, pushXn: 0, pushYp: 0, pushYn: 0 };
    }
    for (let i = 0; i < Fluid.n; i++) {
      if (Fluid.phase[i] !== 1) continue;
      const b = bodies.get(Fluid.iceBody[i]);
      const px = b.x + Fluid.iceOffX[i], py = b.y + Fluid.iceOffY[i];
      Fluid.x[i] = px; Fluid.y[i] = py;
      b.fieldT += tempAt(level, px, py); b.fieldN++;
      collideRigid(b, px, py, b.acc);
    }
    const molten = [];
    for (const [id, b] of bodies) {
      const a = b.acc;
      const px = a.pushXp + a.pushXn, py = a.pushYp + a.pushYn;
      b.x += px; b.y += py;
      if (px > 0 && b.vx < 0) b.vx = -b.vx * P.iceRestitution;
      if (px < 0 && b.vx > 0) b.vx = -b.vx * P.iceRestitution;
      if (py > 0 && b.vy < 0) b.vy = -b.vy * P.iceRestitution;
      if (py < 0 && b.vy > 0) b.vy = -b.vy * P.iceRestitution;
      // la glace échange lentement : chaleur latente (§3.2)
      const T = b.fieldN ? b.fieldT / b.fieldN : P.ambient;
      b.temp += (T - b.temp) * Math.min(1, P.iceEnvRate * dt);
      if (b.temp > P.meltT) molten.push(id);
    }
    for (const id of molten) melt(id);
    // repositionne après poussée pour éviter un cadre de pénétration visible
    for (let i = 0; i < Fluid.n; i++) {
      if (Fluid.phase[i] !== 1) continue;
      const b = bodies.get(Fluid.iceBody[i]);
      Fluid.x[i] = b.x + Fluid.iceOffX[i];
      Fluid.y[i] = b.y + Fluid.iceOffY[i];
      Fluid.vx[i] = b.vx; Fluid.vy[i] = b.vy;
    }
  }

  function melt(id) {
    const b = bodies.get(id);
    for (let i = 0; i < Fluid.n; i++) {
      if (Fluid.iceBody[i] !== id) continue;
      Fluid.phase[i] = 0;
      Fluid.iceBody[i] = -1;
      Fluid.temp[i] = b.temp;
      Fluid.vx[i] = b.vx; Fluid.vy[i] = b.vy;
    }
    bodies.delete(id);
  }

  // --- La vapeur dérive puis se perd (recondensation sur parois froides : M2) ---
  function stepVapor(dt) {
    const dead = [];
    const drag = Math.exp(-0.35 * dt);
    for (let i = 0; i < Fluid.n; i++) {
      if (Fluid.phase[i] !== 2) continue;
      Fluid.vx[i] *= drag; Fluid.vy[i] *= drag;
      Fluid.vaporT[i] -= dt;
      if (Fluid.vaporT[i] <= 0) dead.push(i);
    }
    for (let k = dead.length - 1; k >= 0; k--) Fluid.remove(dead[k]);
  }

  function step(dt, level, player) {
    conductAndExchange(dt, level);
    const vaporized = boil(player);
    updateFreeze(player);
    stepIce(dt, level);
    stepVapor(dt);
    return { vaporized };
  }

  return { step, reset, tempAt, bodies };
})();
