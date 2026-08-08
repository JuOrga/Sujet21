"use strict";

(() => {
  const hud = document.getElementById("hud");
  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ovTitle");
  const ovText = document.getElementById("ovText");

  let level = null;
  let state = "play"; // play | won | lost
  let simTime = 0, timeScale = 1, accum = 0, lastT = 0;
  let winTimer = 0, ejectAccum = 0;
  let playerFrozen = false, vaporFlash = 0, meanTemp = 0;

  const cam = { x: 0, y: 0, s: 1 };
  const mouse = { x: 0, y: 0, down: false };

  // Amas joueur : le corps est identifié dynamiquement par connexité (§13)
  const playerFlag = new Uint8Array(4096);
  let playerList = [];
  let prevCX = 0, prevCY = 0;
  let centroidX = 0, centroidY = 0, bodyVX = 0, bodyVY = 0, bodyRadius = 30;

  // ---------- Mise en place ----------

  function spawnBlob(cx, cy, count) {
    // disque en empilement hexagonal
    const s = P.spacing;
    let placed = 0, ring = 0;
    Fluid.add(cx, cy);
    placed++;
    while (placed < count) {
      ring++;
      const m = ring * 6;
      for (let k = 0; k < m && placed < count; k++) {
        const a = (k / m) * Math.PI * 2 + ring * 0.35;
        Fluid.add(cx + Math.cos(a) * ring * s, cy + Math.sin(a) * ring * s);
        placed++;
      }
    }
  }

  function reset() {
    Fluid.clear();
    Thermal.reset();
    level = makeLevel();
    spawnBlob(level.spawn.x, level.spawn.y, P.baseCount);
    Fluid.calibrate();
    prevCX = level.spawn.x; prevCY = level.spawn.y;
    cam.x = prevCX; cam.y = prevCY; cam.s = 1;
    state = "play"; simTime = 0; winTimer = 0; ejectAccum = 0; accum = 0;
    playerFrozen = false; vaporFlash = 0; meanTemp = P.ambient;
    overlay.style.display = "none";
    updateCluster();
  }

  // ---------- Amas joueur ----------

  function updateCluster() {
    const n = Fluid.n, x = Fluid.x, y = Fluid.y;
    Fluid.grid.build(x, y, n, P.linkDist);
    // graine : la particule ré-absorbable la plus proche du centre précédent
    let seed = -1, best = Infinity;
    for (let i = 0; i < n; i++) {
      if (Fluid.mergeTimer[i] > 0 || Fluid.phase[i] === 2) continue;
      const d = (x[i] - prevCX) ** 2 + (y[i] - prevCY) ** 2;
      if (d < best) { best = d; seed = i; }
    }
    playerFlag.fill(0, 0, n);
    playerList = [];
    if (seed < 0) return;
    // parcours en largeur sur le graphe de proximité
    const stack = [seed];
    playerFlag[seed] = 1;
    const ld2 = P.linkDist * P.linkDist;
    while (stack.length) {
      const i = stack.pop();
      playerList.push(i);
      Fluid.grid.query(x[i], y[i], P.linkDist, (j) => {
        if (playerFlag[j] || Fluid.mergeTimer[j] > 0 || Fluid.phase[j] === 2) return;
        const dx = x[i] - x[j], dy = y[i] - y[j];
        if (dx * dx + dy * dy < ld2) { playerFlag[j] = 1; stack.push(j); }
      });
    }
    let sx = 0, sy = 0, svx = 0, svy = 0, ice = 0, st = 0, stN = 0;
    for (const i of playerList) {
      sx += x[i]; sy += y[i]; svx += Fluid.vx[i]; svy += Fluid.vy[i];
      if (Fluid.phase[i] === 1) ice++;
      else { st += Fluid.temp[i]; stN++; }
    }
    const m = playerList.length;
    if (m > 0) {
      centroidX = sx / m; centroidY = sy / m;
      bodyVX = svx / m; bodyVY = svy / m;
      let r2 = 0;
      for (const i of playerList) r2 += (x[i] - centroidX) ** 2 + (y[i] - centroidY) ** 2;
      bodyRadius = Math.sqrt(r2 / m) * 1.8 + 25;
      prevCX = centroidX; prevCY = centroidY;
      // gelé : on ne pilote plus (§4 Glace)
      playerFrozen = ice > m * 0.3;
      if (stN > 0) meanTemp = st / stN;
      else if (ice > 0) {
        const b = Thermal.bodies.get(Fluid.iceBody[playerList[0]]);
        if (b) meanTemp = b.temp;
      }
    }
  }

  // ---------- Le verbe unique : propulsion par éjection (§3.3) ----------

  function screenToWorld(mx, my) {
    return {
      x: (mx - Renderer.w / 2) / cam.s + cam.x,
      y: (my - Renderer.h / 2) / cam.s + cam.y,
    };
  }

  function ejectOne(dirX, dirY) {
    // la particule la plus en arrière (côté curseur) est expulsée
    let best = -Infinity, pick = -1, idx = -1;
    for (let k = 0; k < playerList.length; k++) {
      const i = playerList[k];
      const d = (Fluid.x[i] - centroidX) * dirX + (Fluid.y[i] - centroidY) * dirY;
      if (d > best) { best = d; pick = i; idx = k; }
    }
    if (pick < 0 || playerList.length < 2) return;
    const jitter = (Math.random() - 0.5) * 0.15;
    const c = Math.cos(jitter), s = Math.sin(jitter);
    const ex = dirX * c - dirY * s, ey = dirX * s + dirY * c;
    Fluid.vx[pick] = bodyVX + ex * P.ejectSpeed;
    Fluid.vy[pick] = bodyVY + ey * P.ejectSpeed;
    Fluid.mergeTimer[pick] = P.remergeDelay;
    Fluid.ballistic[pick] = 0.25;
    playerList.splice(idx, 1);
    playerFlag[pick] = 0;
    // recul : quantité de mouvement rigoureusement conservée
    const rem = playerList.length;
    for (const i of playerList) {
      Fluid.vx[i] -= ex * P.ejectSpeed / rem;
      Fluid.vy[i] -= ey * P.ejectSpeed / rem;
    }
  }

  function handleEject(dt) {
    if (!mouse.down || playerList.length === 0 || playerFrozen) { ejectAccum = 0; return; }
    const w = screenToWorld(mouse.x, mouse.y);
    const dx = w.x - centroidX, dy = w.y - centroidY;
    const len = Math.hypot(dx, dy);
    if (len < 6) return;
    const dirX = dx / len, dirY = dy / len;
    ejectAccum += dt * P.ejectRate;
    while (ejectAccum >= 1 && playerList.length > 1) {
      ejectAccum -= 1;
      ejectOne(dirX, dirY);
    }
  }

  // ---------- Éponge : gradient de risque, jamais mur binaire (§6) ----------

  function spongeUpdate(dt) {
    const toRemove = [];
    const drag = Math.exp(-P.spongeDrag * dt);
    for (let i = 0; i < Fluid.n; i++) {
      // l'éponge n'a pas prise sur la glace ni sur la vapeur (§4)
      if (Fluid.phase[i] !== 0) continue;
      let hitCell = -1, hitSponge = null;
      for (const s of level.sponges) {
        const c = spongeCellAt(s, Fluid.x[i], Fluid.y[i]);
        if (c >= 0 && s.stored[c] < P.spongeCellCap) { hitCell = c; hitSponge = s; break; }
      }
      if (hitCell >= 0) {
        Fluid.vx[i] *= drag; Fluid.vy[i] *= drag;
        Fluid.spongeT[i] += dt;
        if (Fluid.spongeT[i] >= P.spongeAbsorbTime) {
          toRemove.push(i);
          hitSponge.stored[hitCell]++;
        }
      } else if (Fluid.spongeT[i] > 0) {
        Fluid.spongeT[i] = Math.max(0, Fluid.spongeT[i] - dt * 2);
      }
    }
    for (let k = toRemove.length - 1; k >= 0; k--) Fluid.remove(toRemove[k]);
  }

  // ---------- Fin de tentative ----------

  function litres(count) { return count / P.baseCount; }
  function fmtL(v) { return v.toFixed(2).replace(".", ",") + " L"; }

  function checkEnd(dt) {
    if (state !== "play") return;
    if (playerList.length < P.disperseCount) {
      state = "lost";
      ovTitle.textContent = "Dispersion";
      ovText.textContent = "La cohésion ne tient plus. Le laboratoire prépare l'échantillon suivant.";
      overlay.style.display = "flex";
      return;
    }
    const e = level.exit;
    let inside = 0;
    for (const i of playerList) {
      if (Fluid.x[i] > e.x && Fluid.x[i] < e.x + e.w &&
          Fluid.y[i] > e.y && Fluid.y[i] < e.y + e.h) inside++;
    }
    if (inside > playerList.length * 0.6) winTimer += dt; else winTimer = 0;
    if (winTimer > 1.0) {
      state = "won";
      ovTitle.textContent = "Sas franchi";
      ovText.textContent = "Surplus mis en bonbonne : " + fmtL(litres(playerList.length)) +
        " — la récompense, c'est ce qu'il vous reste.";
      overlay.style.display = "flex";
    }
  }

  // ---------- Boucle ----------

  function gameStep(dt) {
    simTime += dt;
    if (state === "play") handleEject(dt);
    Fluid.step(dt, level);
    const th = Thermal.step(dt, level, {
      list: playerList, flag: playerFlag,
      cx: centroidX, cy: centroidY, frozen: playerFrozen,
    });
    if (th.vaporized > 0) vaporFlash = 0.8;
    else vaporFlash = Math.max(0, vaporFlash - dt);
    spongeUpdate(dt);
    updateCluster();
    checkEnd(dt);
  }

  function updateCamera(rdt) {
    const minDim = Math.min(Renderer.w, Renderer.h);
    let target = P.camFraction * minDim / (2 * bodyRadius);
    target = Math.min(P.zoomMax, Math.max(P.zoomMin, target));
    const k = 1 - Math.exp(-P.camSmooth * rdt);
    cam.x += (centroidX - cam.x) * k;
    cam.y += (centroidY - cam.y) * k;
    cam.s += (target - cam.s) * k;
  }

  function updateHud() {
    const vol = fmtL(litres(playerList.length));
    const ts = timeScale === 1 ? "×1" : "×" + timeScale;
    // l'état se lit dans la silhouette ; l'étiquette n'est qu'une aide de recette
    let label, color;
    if (playerFrozen) { label = "glace"; color = "#dff4ff"; }
    else if (vaporFlash > 0) { label = "vapeur"; color = "#ffb37a"; }
    else { label = "liquide"; color = "#79d0ff"; }
    const t = Math.max(0, Math.min(1, meanTemp));
    const tempTint = `rgb(${Math.round(120 + 135 * t)}, ${Math.round(200 - 60 * t)}, ${Math.round(255 - 140 * t)})`;
    hud.innerHTML = `<span class="vol">${vol}</span> &nbsp; ` +
      `<span style="color:${color}">${label}</span> ` +
      `<span style="color:${tempTint}">●</span> &nbsp; ${ts} &nbsp; ` +
      `<span style="color:#5c6b7f">${simTime.toFixed(1).replace(".", ",")} s</span>`;
  }

  function frame(t) {
    const rdt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    accum += rdt * timeScale;
    const stepDt = 1 / 60;
    let steps = 0;
    // le time warp ne modifie jamais le pas de temps physique,
    // seulement le nombre de pas consommés par seconde réelle (§11)
    while (accum >= stepDt && steps < 10) { gameStep(stepDt); accum -= stepDt; steps++; }
    if (steps === 10) accum = 0;
    updateCamera(rdt);
    Renderer.drawBackground(level, cam, simTime);
    Renderer.drawFluid(playerFlag, cam);
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---------- Entrées ----------

  window.addEventListener("mousedown", (e) => {
    if (e.target.closest("#panel")) return;
    mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY;
  });
  window.addEventListener("mouseup", () => { mouse.down = false; });
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

  // tactile : le doigt joue le rôle du curseur maintenu
  window.addEventListener("touchstart", (e) => {
    if (e.target instanceof Element &&
        (e.target.closest("#panel") || e.target.closest("#overlay"))) return;
    e.preventDefault();
    mouse.down = true;
    mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY;
  }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (!mouse.down) return;
    e.preventDefault();
    mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY;
  }, { passive: false });
  window.addEventListener("touchend", (e) => {
    if (e.touches.length === 0) mouse.down = false;
  });
  // sur mobile, pas de touche R : toucher l'écran de fin relance
  overlay.addEventListener("click", () => { if (state !== "play") reset(); });
  window.addEventListener("keydown", (e) => {
    const scales = { Digit1: 0.25, Digit2: 0.5, Digit3: 1, Digit4: 2, Digit5: 4 };
    if (scales[e.code]) timeScale = scales[e.code];
    else if (e.code === "KeyR") reset();
    else if (e.code === "KeyT") Tuning.toggle();
  });

  // instrumentation pour les tests automatisés
  window.__game = {
    stats() {
      let vapor = 0;
      for (let i = 0; i < Fluid.n; i++) if (Fluid.phase[i] === 2) vapor++;
      return {
        n: Fluid.n,
        player: playerList.length,
        cx: centroidX, cy: centroidY,
        vx: bodyVX, vy: bodyVY,
        speed: Math.hypot(bodyVX, bodyVY),
        meanTemp, frozen: playerFrozen, vapor,
        state, simTime,
      };
    },
    setTimeScale(v) { timeScale = v; },
    level() { return level; },
    // téléporte le corps joueur (tests uniquement) ; vitesses remises à zéro
    teleport(wx, wy) {
      const dx = wx - centroidX, dy = wy - centroidY;
      const moved = new Set();
      for (const i of playerList) {
        Fluid.x[i] += dx; Fluid.y[i] += dy;
        Fluid.vx[i] = 0; Fluid.vy[i] = 0;
        const b = Fluid.iceBody[i];
        if (b >= 0 && !moved.has(b)) {
          moved.add(b);
          const B = Thermal.bodies.get(b);
          if (B) { B.x += dx; B.y += dy; B.vx = 0; B.vy = 0; }
        }
      }
      prevCX = wx; prevCY = wy;
      updateCluster();
    },
  };

  reset();
  requestAnimationFrame(frame);
})();
