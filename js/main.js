"use strict";

(() => {
  const hud = document.getElementById("hud");
  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ovTitle");
  const ovText = document.getElementById("ovText");
  const ovRecord = document.getElementById("ovRecord");
  const ovLog = document.getElementById("ovLog");

  let level = null;
  let state = "play"; // play | won | lost
  let simTime = 0, timeScale = 1, accum = 0, lastT = 0;
  let winTimer = 0, ejectAccum = 0;

  // État thermique (M1) : le corps gèle sous freezeT (moyenne), dégèle
  // au-dessus de meltT ; au-dessus de boilT l'éjection devient vapeur.
  let frozen = false, iceVX = 0, iceVY = 0, meanTemp = 0;
  const steam = []; // bouffées de vapeur : cosmétiques, le volume est déjà perdu

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
    level = makeLevel();
    spawnBlob(level.spawn.x, level.spawn.y, P.baseCount);
    Fluid.calibrate();
    prevCX = level.spawn.x; prevCY = level.spawn.y;
    cam.x = prevCX; cam.y = prevCY; cam.s = 1;
    state = "play"; simTime = 0; winTimer = 0; ejectAccum = 0; accum = 0;
    frozen = false; iceVX = 0; iceVY = 0; meanTemp = P.tempAmbient; steam.length = 0;
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
      if (Fluid.mergeTimer[i] > 0) continue;
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
        if (playerFlag[j] || Fluid.mergeTimer[j] > 0) return;
        const dx = x[i] - x[j], dy = y[i] - y[j];
        if (dx * dx + dy * dy < ld2) { playerFlag[j] = 1; stack.push(j); }
      });
    }
    let sx = 0, sy = 0, svx = 0, svy = 0;
    for (const i of playerList) { sx += x[i]; sy += y[i]; svx += Fluid.vx[i]; svy += Fluid.vy[i]; }
    const m = playerList.length;
    if (m > 0) {
      centroidX = sx / m; centroidY = sy / m;
      bodyVX = svx / m; bodyVY = svy / m;
      let r2 = 0;
      for (const i of playerList) r2 += (x[i] - centroidX) ** 2 + (y[i] - centroidY) ** 2;
      bodyRadius = Math.sqrt(r2 / m) * 1.8 + 25;
      prevCX = centroidX; prevCY = centroidY;
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
    const isSteam = Fluid.temp[pick] >= P.boilT;
    const speed = P.ejectSpeed * (isSteam ? P.steamBoost : 1);
    playerList.splice(idx, 1);
    playerFlag[pick] = 0;
    // recul : quantité de mouvement rigoureusement conservée — la vapeur
    // part plus vite, donc pousse plus fort (§4, « l'énergie »)
    const rem = playerList.length;
    for (const i of playerList) {
      Fluid.vx[i] -= ex * speed / rem;
      Fluid.vy[i] -= ey * speed / rem;
    }
    if (isSteam) {
      // détente explosive : la bouffée part définitivement, elle ne revient pas
      steam.push({
        x: Fluid.x[pick], y: Fluid.y[pick],
        vx: bodyVX + ex * speed * 0.45, vy: bodyVY + ey * speed * 0.45,
        r: 7, life: P.steamLife,
      });
      removeParticle(pick);
    } else {
      Fluid.vx[pick] = bodyVX + ex * speed;
      Fluid.vy[pick] = bodyVY + ey * speed;
      Fluid.mergeTimer[pick] = P.remergeDelay;
      Fluid.ballistic[pick] = 0.25;
    }
  }

  // Fluid.remove(i) échange i avec la dernière particule : on remappe
  // l'indice déplacé dans playerFlag/playerList (valides jusqu'au
  // prochain updateCluster).
  function removeParticle(i) {
    const last = Fluid.n - 1;
    Fluid.remove(i);
    if (last !== i) {
      if (playerFlag[last]) {
        playerFlag[i] = 1;
        const li = playerList.indexOf(last);
        if (li >= 0) playerList[li] = i;
      } else {
        playerFlag[i] = 0;
      }
      playerFlag[last] = 0;
    }
  }

  function handleEject(dt) {
    if (frozen) { ejectAccum = 0; return; } // gelé : on ne pilote plus (§4)
    if (!mouse.down || playerList.length === 0) { ejectAccum = 0; return; }
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
      if (Fluid.frozen[i]) continue; // l'éponge n'a pas prise sur la glace (§4)
      let held = false;
      for (const s of level.sponges) {
        const c = spongeCellAt(s, Fluid.x[i], Fluid.y[i]);
        if (c >= 0 && s.stored[c] < P.spongeCellCap) {
          Fluid.vx[i] *= drag; Fluid.vy[i] *= drag;
          Fluid.spongeT[i] += dt;
          if (Fluid.spongeT[i] >= P.spongeAbsorbTime) {
            toRemove.push(i);
            s.stored[c]++;
          }
          held = true;
          break;
        }
      }
      if (!held && Fluid.spongeT[i] > 0) {
        Fluid.spongeT[i] = Math.max(0, Fluid.spongeT[i] - dt * 2);
      }
    }
    for (let k = toRemove.length - 1; k >= 0; k--) removeParticle(toRemove[k]);
  }

  // ---------- Chaleur et changements d'état (M1, §4–§5) ----------

  function zoneAt(wx, wy) {
    for (const z of level.zones)
      if (wx > z.x && wx < z.x + z.w && wy > z.y && wy < z.y + z.h) return z;
    return null;
  }

  function thermoUpdate(dt) {
    const T = Fluid.temp, cap = 1 + P.latentHeat;
    const toFlash = [];
    for (let i = 0; i < Fluid.n; i++) {
      const z = zoneAt(Fluid.x[i], Fluid.y[i]);
      if (z) T[i] += (z.kind === "heat" ? P.heatPower : -P.coldPower) * dt;
      T[i] += (P.tempAmbient - T[i]) * P.tempRelax * dt;
      if (T[i] < 0) T[i] = 0;
      if (T[i] >= cap) {
        // chaleur latente épuisée : évaporation spontanée, perte définitive
        if (!Fluid.frozen[i]) toFlash.push(i); else T[i] = cap;
      }
    }
    for (let k = toFlash.length - 1; k >= 0; k--) {
      const i = toFlash[k];
      const a = Math.random() * Math.PI * 2;
      steam.push({
        x: Fluid.x[i], y: Fluid.y[i],
        vx: Fluid.vx[i] + Math.cos(a) * 50, vy: Fluid.vy[i] + Math.sin(a) * 50,
        r: 6, life: P.steamLife,
      });
      removeParticle(i);
    }
  }

  function stateUpdate() {
    if (playerList.length === 0) return;
    let sum = 0;
    for (const i of playerList) sum += Fluid.temp[i];
    meanTemp = sum / playerList.length;
    if (!frozen && meanTemp < P.freezeT) {
      // geler, c'est parier sur une trajectoire : on fige le corps en bloc
      frozen = true; iceVX = bodyVX; iceVY = bodyVY;
      for (const i of playerList) {
        Fluid.frozen[i] = 1;
        Fluid.vx[i] = iceVX; Fluid.vy[i] = iceVY;
      }
    } else if (frozen && meanTemp > P.meltT) {
      frozen = false;
      for (let i = 0; i < Fluid.n; i++) {
        if (Fluid.frozen[i]) {
          Fluid.frozen[i] = 0;
          Fluid.vx[i] = iceVX; Fluid.vy[i] = iceVY;
        }
      }
    }
  }

  function iceUpdate(dt) {
    if (!frozen) return;
    // translation rigide : on glisse, on rebondit, la quantité de
    // mouvement se conserve (§4, « l'engagement »)
    const xs = Fluid.x, ys = Fluid.y;
    for (let i = 0; i < Fluid.n; i++)
      if (Fluid.frozen[i]) { xs[i] += iceVX * dt; ys[i] += iceVY * dt; }
    // rebond : plus forte pénétration constatée sur chaque axe
    const b = level.bounds, m = 4;
    let pushX = 0, pushY = 0;
    for (let i = 0; i < Fluid.n; i++) {
      if (!Fluid.frozen[i]) continue;
      let ppx = 0, ppy = 0;
      if (xs[i] < b.x + m) ppx = b.x + m - xs[i];
      else if (xs[i] > b.x + b.w - m) ppx = b.x + b.w - m - xs[i];
      if (ys[i] < b.y + m) ppy = b.y + m - ys[i];
      else if (ys[i] > b.y + b.h - m) ppy = b.y + b.h - m - ys[i];
      for (const W of level.walls) {
        if (xs[i] > W.x && xs[i] < W.x + W.w && ys[i] > W.y && ys[i] < W.y + W.h) {
          const dl = xs[i] - W.x, dr = W.x + W.w - xs[i];
          const dt2 = ys[i] - W.y, db = W.y + W.h - ys[i];
          const mn = Math.min(dl, dr, dt2, db);
          if (mn === dl) ppx = -dl;
          else if (mn === dr) ppx = dr;
          else if (mn === dt2) ppy = -dt2;
          else ppy = db;
        }
      }
      if (Math.abs(ppx) > Math.abs(pushX)) pushX = ppx;
      if (Math.abs(ppy) > Math.abs(pushY)) pushY = ppy;
    }
    if (pushX !== 0) {
      for (let i = 0; i < Fluid.n; i++) if (Fluid.frozen[i]) xs[i] += pushX;
      iceVX = -iceVX * P.iceBounce;
    }
    if (pushY !== 0) {
      for (let i = 0; i < Fluid.n; i++) if (Fluid.frozen[i]) ys[i] += pushY;
      iceVY = -iceVY * P.iceBounce;
    }
    for (let i = 0; i < Fluid.n; i++)
      if (Fluid.frozen[i]) { Fluid.vx[i] = iceVX; Fluid.vy[i] = iceVY; }
  }

  function steamUpdate(dt) {
    for (let k = steam.length - 1; k >= 0; k--) {
      const s = steam[k];
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.97; s.vy *= 0.97;
      s.r += 26 * dt;
      s.life -= dt;
      if (s.life <= 0) steam.splice(k, 1);
    }
  }

  // ---------- Fin de tentative ----------

  function litres(count) { return count / P.baseCount; }
  function fmtL(v) { return v.toFixed(2).replace(".", ",") + " L"; }
  function fmtS(v) { return v.toFixed(1).replace(".", ",") + " s"; }

  // Registres du labo (§10) : la fin de tentative est consignée, le record
  // (sas franchi le plus vite) est rappelé, et le registre raconte la série.
  function showRegister(rec) {
    const best = Records.best();
    if (rec.newBest) {
      ovRecord.textContent = "Nouveau record du protocole : sas franchi en " + fmtS(best.time) + ".";
    } else if (best) {
      ovRecord.textContent = "Record du protocole : " + fmtS(best.time) +
        " avec " + fmtL(best.volume) + " (échantillon n°" + best.no + ").";
    } else {
      ovRecord.textContent = "Aucun échantillon n'a encore franchi le sas.";
    }
    const rows = Records.history(5).map((e) =>
      "n°" + e.no + " — " + (e.won ? "sas franchi, " + fmtS(e.time) + ", " + fmtL(e.volume)
                                   : "dispersion à " + fmtS(e.time)));
    ovLog.innerHTML = "<em>Registres du labo</em><br>" + rows.join("<br>");
  }

  function checkEnd(dt) {
    if (state !== "play") return;
    if (playerList.length < P.disperseCount) {
      state = "lost";
      const rec = Records.endAttempt({ won: false, time: simTime, volume: litres(playerList.length) });
      ovTitle.textContent = "Dispersion";
      ovText.textContent = "La cohésion ne tient plus. Le laboratoire prépare l'échantillon suivant.";
      showRegister(rec);
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
      const rec = Records.endAttempt({ won: true, time: simTime, volume: litres(playerList.length) });
      ovTitle.textContent = "Sas franchi";
      ovText.textContent = "Surplus mis en bonbonne : " + fmtL(litres(playerList.length)) +
        " — la récompense, c'est ce qu'il vous reste.";
      showRegister(rec);
      overlay.style.display = "flex";
    }
  }

  // ---------- Boucle ----------

  function gameStep(dt) {
    simTime += dt;
    if (state === "play") handleEject(dt);
    Fluid.step(dt, level);
    iceUpdate(dt);
    spongeUpdate(dt);
    thermoUpdate(dt);
    steamUpdate(dt);
    updateCluster();
    stateUpdate();
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
    const best = Records.best();
    const rec = best ? ` &nbsp; <span style="color:#5c6b7f">record ${fmtS(best.time)}</span>` : "";
    // l'état se lit d'un coup d'œil : mot + couleur + jauge de température
    const st = frozen ? ["GLACE", "#eaf7ff"]
      : meanTemp >= P.boilT ? ["VAPEUR", "#ffb37a"]
      : ["LIQUIDE", "#79d0ff"];
    const pct = Math.round(Math.min(1, Math.max(0, meanTemp)) * 100);
    hud.innerHTML = `<span class="vol">${vol}</span> &nbsp; ` +
      `<span class="state" style="color:${st[1]}">${st[0]}</span> &nbsp; ${ts} &nbsp; ` +
      `<span style="color:#5c6b7f">${simTime.toFixed(1).replace(".", ",")} s &nbsp; ` +
      `échantillon n°${Records.attempts() + 1}</span>` + rec +
      `<div id="gauge"><b style="width:${pct}%"></b>` +
      `<i class="mkF" style="left:${P.freezeT * 100}%"></i>` +
      `<i class="mkB" style="left:${P.boilT * 100}%"></i></div>`;
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
    Renderer.drawEffects(steam, cam);
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---------- Entrées ----------

  // touche L au clavier, bouton « Légende » au tactile
  function toggleLegend() {
    const lg = document.getElementById("legend");
    lg.style.display = lg.style.display === "none" ? "block" : "none";
  }
  document.getElementById("legendBtn").addEventListener("click", toggleLegend);

  window.addEventListener("mousedown", (e) => {
    if (e.target.closest("#panel") || e.target.closest("#legendBtn")) return;
    mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY;
  });
  window.addEventListener("mouseup", () => { mouse.down = false; });
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("keydown", (e) => {
    const scales = { Digit1: 0.25, Digit2: 0.5, Digit3: 1, Digit4: 2, Digit5: 4 };
    if (scales[e.code]) timeScale = scales[e.code];
    else if (e.code === "KeyR") reset();
    else if (e.code === "KeyT") Tuning.toggle();
    else if (e.code === "KeyL") toggleLegend();
  });

  // ---------- Démarrage : écran de chargement (§11) ----------

  // Le premier lancement est le plus coûteux : construction du tableau,
  // calibration du solveur, puis les premiers pas physiques, que le
  // navigateur compile à chaud. Tout cela dans la même trame donnerait une
  // page figée plusieurs secondes — indiscernable d'un plantage. On étale
  // donc la mise en route sur plusieurs trames, derrière un écran qui dit
  // ce qui se passe et où ça en est ; la boucle de jeu ne démarre qu'une
  // fois l'échantillon stabilisé et la première image peinte.

  const boot = document.getElementById("boot");
  const bootStep = document.getElementById("bootStep");
  const bootBar = document.querySelector("#bootBar b");
  const bootNote = document.getElementById("bootNote");
  let ready = false;

  const WARMUP_STEPS = 48; // ~0,8 s de simulation avant de rendre la main
  const WARMUP_CHUNK = 8;

  const FIRST_RUN_KEY = "tension-de-surface.demarrage.v1";
  function firstRun() {
    try {
      if (localStorage.getItem(FIRST_RUN_KEY)) return false;
      localStorage.setItem(FIRST_RUN_KEY, "1");
      return true;
    } catch (e) { return false; } // stockage indisponible : on reste discret
  }

  function bootProgress(pct, label) {
    if (label) bootStep.textContent = label;
    bootBar.style.width = Math.round(pct * 100) + "%";
  }

  // rend la main au navigateur, le temps qu'il peigne l'état courant :
  // la trame d'animation s'exécute avant le rendu, le timer juste après
  function yieldToPaint() {
    return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  }

  async function bootSequence() {
    if (firstRun()) {
      bootNote.textContent = "Première mise en route : le solveur se calibre et " +
        "l'échantillon se stabilise. Les lancements suivants seront immédiats.";
    }
    bootProgress(0.06, "Assemblage du tableau…");
    await yieldToPaint();

    reset(); // tableau, échantillon, calibration de la densité de repos
    bootProgress(0.22, "Calibration du solveur…");
    await yieldToPaint();

    // Stabilisation : l'échantillon trouve son équilibre pendant que le
    // navigateur chauffe le solveur. Par paquets, pour que la barre avance.
    const stepDt = 1 / 60;
    for (let done = 0; done < WARMUP_STEPS; done += WARMUP_CHUNK) {
      for (let k = 0; k < WARMUP_CHUNK; k++) Fluid.step(stepDt, level);
      updateCluster();
      bootProgress(0.22 + 0.7 * (done + WARMUP_CHUNK) / WARMUP_STEPS,
        "Stabilisation de l'échantillon…");
      await yieldToPaint();
    }

    // première image peinte sous l'écran de chargement : quand le voile
    // s'efface, la scène est déjà là, caméra cadrée (rdt élevé = pas de
    // lissage, on colle d'emblée à la cible)
    updateCamera(5);
    Renderer.drawBackground(level, cam, 0);
    Renderer.drawFluid(playerFlag, cam);
    Renderer.drawEffects(steam, cam);
    updateHud();
    bootProgress(1, "Prêt.");
    await yieldToPaint();

    boot.classList.add("done");
    setTimeout(() => { boot.style.display = "none"; }, 500);
    ready = true;
    lastT = performance.now();
    accum = 0;
    requestAnimationFrame(frame);
  }

  // instrumentation pour les tests automatisés
  window.__game = {
    ready() { return ready; },
    stats() {
      return {
        n: Fluid.n,
        player: playerList.length,
        cx: centroidX, cy: centroidY,
        state, simTime,
        meanTemp, frozen, steam: steam.length,
      };
    },
    setTimeScale(v) { timeScale = v; },
    records() {
      return { attempts: Records.attempts(), best: Records.best(), history: Records.history() };
    },
  };

  bootSequence().catch((e) => {
    // un démarrage qui échoue doit le dire : l'écran reste, mais il explique
    console.error(e);
    bootProgress(1, "Le laboratoire n'a pas pu démarrer.");
    bootNote.textContent = String(e && e.message ? e.message : e);
  });
})();
