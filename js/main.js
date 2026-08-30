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

  // Relief (M1.5) : monter coûte, descendre est gratuit.
  let crossing = null;      // { from, to, dz } : franchissement en cours
  let blocked = null;       // { dz, name } : arête trop haute pour le pouvoir actuel
  let latch = null;         // arête tenue : elle le reste jusqu'au bout du passage
  let gripUsed = false;     // une prise ne franchit qu'une arête
  let trigMsg = null;       // message de déclencheur (transitoire)

  const cam = { x: 0, y: 0, s: 1 };
  const mouse = { x: 0, y: 0, down: false, right: false };
  const keys = { left: false, right: false, up: false, down: false, grip: false };
  let touchGrip = false, testGrip = false, testDir = null;

  // Amas joueur : le corps est identifié dynamiquement par connexité (§13)
  const playerFlag = new Uint8Array(4096);
  let playerList = [];
  let prevCX = 0, prevCY = 0, prevReg = -1;
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
    prevCX = level.spawn.x; prevCY = level.spawn.y; prevReg = -1;
    cam.x = prevCX; cam.y = prevCY; cam.s = 1;
    state = "play"; simTime = 0; winTimer = 0; ejectAccum = 0; accum = 0;
    frozen = false; iceVX = 0; iceVY = 0; meanTemp = P.tempAmbient; steam.length = 0;
    crossing = null; blocked = null; latch = null; gripUsed = false; trigMsg = null;
    overlay.style.display = "none";
    updateCluster();
  }

  // ---------- Amas joueur ----------

  // Deux niveaux ne se touchent pas — sauf pendant un franchissement : le
  // volume qui passe d'un étage à l'autre reste un seul corps, c'est tout
  // l'intérêt. Prise relâchée, ce qui est en haut est en haut.
  function levelsLinked(a, b) {
    if (a === b) return true;
    if (!crossing) return false;
    return (a === crossing.from && b === crossing.to) ||
           (a === crossing.to && b === crossing.from);
  }

  // Parcours en largeur sur le graphe de proximité, à niveau constant.
  function flood(seed) {
    const x = Fluid.x, y = Fluid.y, ld2 = P.linkDist * P.linkDist;
    const stack = [seed];
    playerFlag[seed] = 1;
    while (stack.length) {
      const i = stack.pop();
      playerList.push(i);
      Fluid.grid.query(x[i], y[i], P.linkDist, (j) => {
        if (playerFlag[j] || Fluid.mergeTimer[j] > 0) return;
        if (Fluid.reg[j] !== Fluid.reg[i]) return;
        const dx = x[i] - x[j], dy = y[i] - y[j];
        if (dx * dx + dy * dy < ld2) { playerFlag[j] = 1; stack.push(j); }
      });
    }
  }

  function updateCluster() {
    const n = Fluid.n, x = Fluid.x, y = Fluid.y;
    Fluid.grid.build(x, y, n, P.linkDist);
    // Graine : la particule ré-absorbable la plus proche du centre précédent.
    // On la cherche d'abord au niveau où se tenait le corps — sinon une
    // gouttelette restée sur l'autre étage volerait l'identité au volume qui
    // vient de franchir l'arête. Sans relief, tout est au même niveau et la
    // règle est exactement celle d'avant.
    let seed = -1, best = Infinity;
    for (let pass = 0; pass < 2 && seed < 0; pass++) {
      for (let i = 0; i < n; i++) {
        if (Fluid.mergeTimer[i] > 0) continue;
        if (pass === 0 && Fluid.reg[i] !== prevReg) continue;
        const d = (x[i] - prevCX) ** 2 + (y[i] - prevCY) ** 2;
        if (d < best) { best = d; seed = i; }
      }
    }
    playerFlag.fill(0, 0, n);
    playerList = [];
    if (seed < 0) return;
    // Le corps, c'est l'amas connexe de son étage. Pendant un franchissement,
    // il est à cheval : on lui coud l'amas de l'autre étage le plus proche —
    // c'est le même volume, en train de passer la marche.
    flood(seed);
    if (crossing) {
      const other = Fluid.reg[seed] === crossing.from ? crossing.to : crossing.from;
      let s2 = -1, b2 = Infinity;
      for (let i = 0; i < n; i++) {
        if (playerFlag[i] || Fluid.mergeTimer[i] > 0 || Fluid.reg[i] !== other) continue;
        const d = (x[i] - prevCX) ** 2 + (y[i] - prevCY) ** 2;
        if (d < b2) { b2 = d; s2 = i; }
      }
      if (s2 >= 0) flood(s2);
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
      prevReg = bodyRegion();
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

  // ---------- Relief : les niveaux (M1.5) ----------
  //
  // Le tableau se lit de dessus : l'altitude n'est pas une force, c'est un
  // niveau. Un relief n'est donc pas un obstacle mais un autre étage du
  // décor — ses arêtes se comportent comme des parois (le solveur s'en
  // charge), et on ne les franchit qu'en le demandant : direction vers
  // l'arête, plus la prise. Monter transfère le volume d'un niveau au
  // suivant en en perdant une part ; descendre le laisse s'écouler, gratuit.
  // Rien de tout cela n'est une règle de plus : c'est le même corps, qui
  // change d'étage.

  function regionAt(wx, wy) {
    const R = level.reliefs;
    for (let k = 0; k < R.length; k++)
      if (wx > R[k].x && wx < R[k].x + R[k].w &&
          wy > R[k].y && wy < R[k].y + R[k].h) return k;
    return -1;
  }

  function zOf(k) { return k < 0 ? 0 : level.reliefs[k].z; }

  // Direction demandée : les touches (ou le stick) priment, sinon le curseur.
  function inputDir() {
    if (testDir) return testDir;
    let dx = 0, dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (dx || dy) { const l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l }; }
    const w = screenToWorld(mouse.x, mouse.y);
    const ax = w.x - centroidX, ay = w.y - centroidY;
    const l = Math.hypot(ax, ay);
    return l < 6 ? null : { x: ax / l, y: ay / l };
  }

  function gripHeld() {
    return mouse.right || keys.grip || touchGrip || testGrip;
  }

  // Niveau du corps : celui où se tient la majorité de son volume.
  function bodyRegion() {
    const tally = new Map();
    for (const i of playerList) {
      const k = Fluid.reg[i];
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    let best = -1, bestN = -1;
    for (const [k, c] of tally) if (c > bestN) { bestN = c; best = k; }
    return best;
  }

  // L'arête tenue : on sonde un point devant chaque particule du corps ; s'il
  // tombe dans un autre niveau, c'est celui-là qu'on vise. Pas de géométrie
  // d'arête à écrire — la sonde suit n'importe quelle forme de relief.
  function crossTarget(dir, from) {
    const tally = new Map(), reach = P.transferReach;
    for (const i of playerList) {
      if (Fluid.reg[i] !== from) continue;
      const k = regionAt(Fluid.x[i] + dir.x * reach, Fluid.y[i] + dir.y * reach);
      if (k === from) continue;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    let best = null, bestN = 0;
    for (const [k, c] of tally) if (c > bestN) { bestN = c; best = k; }
    return best;
  }

  // Retire une particule du corps : c'est le film qui reste sur la paroi.
  function dropParticle(idx) {
    const i = playerList[idx];
    playerList.splice(idx, 1);
    playerFlag[i] = 0;
    removeParticle(i);
  }

  // Champ de forces extérieures du pas courant, puis franchissement.
  function reliefUpdate(dt) {
    const n = Fluid.n, ax = Fluid.accX, ay = Fluid.accY;
    ax.fill(0, 0, n); ay.fill(0, 0, n);
    crossing = null; blocked = null;
    Fluid.setBridge(null);

    const dir = state === "play" && !frozen && playerList.length ? inputDir() : null;
    if (!dir || !gripHeld()) { latch = null; gripUsed = false; gatesUpdate(); return; }

    // Une fois l'arête tenue, on ne la lâche pas : le franchissement dure
    // tant qu'il reste du volume de l'autre côté. Sinon, dès que la moitié du
    // corps serait passée, le jeu changerait d'avis et abandonnerait le reste.
    let from, to;
    if (latch && playerList.some((i) => Fluid.reg[i] === latch.from)) {
      from = latch.from; to = latch.to;
    } else {
      latch = null;
      // une prise, une arête : le passage terminé, il faut relâcher avant
      // d'en tenir une autre — sinon on repartirait aussitôt de l'autre côté
      if (gripUsed) { gatesUpdate(); return; }
      from = bodyRegion();
      to = crossTarget(dir, from);
      if (to === null) { gatesUpdate(); return; }
    }

    const dz = zOf(to) - zOf(from);
    if (dz === 0) { gatesUpdate(); return; }
    if (dz > P.climbMaxStep) {
      // trop haut d'un coup : le relief reste une paroi. C'est là qu'un
      // déblocage de progression se branche (§9.2).
      blocked = { dz, to, name: level.reliefs[to].name };
      gatesUpdate(); return;
    }
    crossing = { from, to, dz };
    latch = crossing; gripUsed = true;
    Fluid.setBridge(from, to); // le temps du franchissement, le fluide est continu

    // Ruissellement : on vise une vitesse vers l'arête, on ne propulse pas.
    // La prise stabilise donc aussi le corps — c'est ce qui rend un
    // franchissement pilotable au lieu de le transformer en catapulte.
    // Monter s'écoule lentement, descendre tombe.
    const flow = dz > 0 ? P.climbFlow : P.descendFlow;
    for (const i of playerList) {
      if (Fluid.reg[i] !== from) continue; // ce qui est passé se pose
      ax[i] += (dir.x * flow - Fluid.vx[i]) * P.flowDrive;
      ay[i] += (dir.y * flow - Fluid.vy[i]) * P.flowDrive;
    }
  }

  // Après le pas de simulation : on constate qui a changé d'étage. Rien n'est
  // téléporté — le volume a traversé de lui-même l'arête ouverte. Ce qui monte
  // laisse une part de soi sur la paroi ; ce qui descend ne paie rien.
  function levelSync() {
    if (!crossing) return;
    const from = crossing.from, to = crossing.to, dz = crossing.dz;
    for (let k = playerList.length - 1; k >= 0; k--) {
      const i = playerList[k];
      const r = Fluid.reg[i];
      if (r !== from && r !== to) continue;
      const g = regionAt(Fluid.x[i], Fluid.y[i]);
      if (g === r || (g !== from && g !== to)) continue;
      if (g === to && dz > 0 && playerList.length > 1 &&
          Math.random() < Math.min(0.95, P.climbLoss * dz)) {
        dropParticle(k);
        continue;
      }
      Fluid.reg[i] = g;
    }
    // les gouttes libres suivent la même géométrie, sans rien payer
    for (let i = 0; i < Fluid.n; i++) {
      if (playerFlag[i]) continue;
      const r = Fluid.reg[i];
      if (r !== from && r !== to) continue;
      const g = regionAt(Fluid.x[i], Fluid.y[i]);
      if (g !== r && (g === from || g === to)) Fluid.reg[i] = g;
    }
  }

  // Vantaux : une vanne amorcée s'ouvre, et le reste. Un déclencheur ne se
  // rejoue pas — le volume qu'on a versé est dépensé.
  function gatesUpdate() {
    for (const g of level.gates) if (g.locked) g.open = true;
  }

  // Zone d'interaction : une fosse qui se remplit est un déclencheur. Le prix
  // est le volume qu'on y laisse — c'est un arbitrage, pas un interrupteur.
  function basinUpdate(dt) {
    for (const fo of level.fosses) {
      let count = 0;
      for (let i = 0; i < Fluid.n; i++) if (Fluid.reg[i] === fo.idx) count++;
      fo.fill = litres(count);
      if (fo.fill >= P.basinFill) fo.held += dt; else fo.held = 0;
      if (!fo.armed && fo.held >= P.basinHold) {
        fo.armed = true;
        if (fo.opens) { fo.opens.locked = true; fo.opens.open = true; }
        trigMsg = { text: fo.name + " AMORCÉ" +
          (fo.opens ? " — " + fo.opens.name + " OUVERTE" : ""), t: 3.5 };
      }
    }
    if (trigMsg) { trigMsg.t -= dt; if (trigMsg.t <= 0) trigMsg = null; }
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
    // gelé, on ne change plus de niveau : les arêtes de son étage sont des
    // parois comme les autres (§4, la glace n'a pas de prise)
    const bReg = playerList.length ? Fluid.reg[playerList[0]] : -1;
    const solids = level.walls.concat(level.gates.filter((q) => !q.open));
    if (bReg < 0) for (const R of level.reliefs) solids.push(R);
    const home = bReg >= 0 ? level.reliefs[bReg] : null;
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
      if (home) {
        if (xs[i] < home.x + 3) ppx = home.x + 3 - xs[i];
        else if (xs[i] > home.x + home.w - 3) ppx = home.x + home.w - 3 - xs[i];
        if (ys[i] < home.y + 3) ppy = home.y + 3 - ys[i];
        else if (ys[i] > home.y + home.h - 3) ppy = home.y + home.h - 3 - ys[i];
      }
      for (const W of solids) {
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
    reliefUpdate(dt);
    Fluid.step(dt, level);
    levelSync();
    iceUpdate(dt);
    spongeUpdate(dt);
    thermoUpdate(dt);
    steamUpdate(dt);
    updateCluster();
    stateUpdate();
    basinUpdate(dt);
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
    // le relief est un mode transitoire : il se dit à côté de l'état de l'eau
    const rl = blocked ? ["TROP HAUT", "#ff9c8a"]
      : crossing ? (crossing.dz > 0 ? ["MONTÉE", "#ffcf8a"] : ["DESCENTE", "#8affc8"]) : null;
    const rlTxt = rl ? ` &nbsp; <span class="state" style="color:${rl[1]}">${rl[0]}</span>` : "";
    const zb = zOf(bodyRegion());
    const zTxt = zb === 0 ? "" :
      ` <span style="color:#96b0e6">niveau ${zb > 0 ? "+" : ""}${zb}</span>`;
    const msg = trigMsg ? `<div class="trig">${trigMsg.text}</div>` : "";
    hud.innerHTML = `<span class="vol">${vol}</span> &nbsp; ` +
      `<span class="state" style="color:${st[1]}">${st[0]}</span>${rlTxt} &nbsp; ${ts} &nbsp; ` +
      `<span style="color:#5c6b7f">${simTime.toFixed(1).replace(".", ",")} s &nbsp; ` +
      `échantillon n°${Records.attempts() + 1}</span>` + zTxt + rec +
      `<div id="gauge"><b style="width:${pct}%"></b>` +
      `<i class="mkF" style="left:${P.freezeT * 100}%"></i>` +
      `<i class="mkB" style="left:${P.boilT * 100}%"></i></div>` + msg;
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
    Renderer.setActiveRelief(blocked ? blocked.to : crossing ? crossing.to : -1,
                             blocked ? "blocked" : "cross");
    Renderer.drawBackground(level, cam, simTime);
    Renderer.drawFluid(playerFlag, cam, level);
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

  // bouton « Prise » : le second bouton du relief, au doigt
  const gripBtn = document.getElementById("gripBtn");
  const setTouchGrip = (v) => (e) => { touchGrip = v; e.preventDefault(); };
  gripBtn.addEventListener("pointerdown", setTouchGrip(true));
  window.addEventListener("pointerup", () => { touchGrip = false; });
  window.addEventListener("pointercancel", () => { touchGrip = false; });

  window.addEventListener("contextmenu", (e) => {
    if (!e.target.closest("#panel")) e.preventDefault(); // le clic droit est la prise
  });
  window.addEventListener("mousedown", (e) => {
    if (e.target.closest("#panel") || e.target.closest("#legendBtn") ||
        e.target.closest("#gripBtn")) return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (e.button === 2) mouse.right = true; else mouse.down = true;
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) mouse.right = false; else mouse.down = false;
  });
  window.addEventListener("blur", () => {
    mouse.down = false; mouse.right = false; touchGrip = false;
    keys.left = keys.right = keys.up = keys.down = keys.grip = false;
  });
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

  // direction du relief : flèches ou WASD/ZQSD (mêmes touches physiques)
  const DIRK = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down",
  };
  window.addEventListener("keydown", (e) => {
    const scales = { Digit1: 0.25, Digit2: 0.5, Digit3: 1, Digit4: 2, Digit5: 4 };
    if (DIRK[e.code]) { keys[DIRK[e.code]] = true; e.preventDefault(); return; }
    if (e.code === "Space") { keys.grip = true; e.preventDefault(); return; }
    if (scales[e.code]) timeScale = scales[e.code];
    else if (e.code === "KeyR") reset();
    else if (e.code === "KeyT") Tuning.toggle();
    else if (e.code === "KeyL") toggleLegend();
  });
  window.addEventListener("keyup", (e) => {
    if (DIRK[e.code]) keys[DIRK[e.code]] = false;
    else if (e.code === "Space") keys.grip = false;
  });

  // instrumentation pour les tests automatisés
  window.__game = {
    stats() {
      return {
        n: Fluid.n,
        player: playerList.length,
        cx: centroidX, cy: centroidY,
        state, simTime,
        meanTemp, frozen, steam: steam.length,
        z: zOf(bodyRegion()), reg: bodyRegion(),
        climbing: !!crossing && crossing.dz > 0,
        descending: !!crossing && crossing.dz < 0,
        blocked: !!blocked,
        cross: crossing ? [crossing.from, crossing.to, crossing.dz] : null,
        basin: level.fosses[0].fill, armed: level.fosses[0].armed,
        vanne: level.gates.some((g) => g.open),
      };
    },
    setTimeScale(v) { timeScale = v; },
    // instrumentation du relief : prise maintenue + direction imposée
    grip(on, dx, dy) {
      testGrip = !!on;
      testDir = on && (dx || dy)
        ? (() => { const l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l }; })()
        : null;
    },
    // téléportation du corps, pour poser un test sans traverser le tableau
    warp(x, y) {
      const dx = x - centroidX, dy = y - centroidY;
      for (const i of playerList) {
        Fluid.x[i] += dx; Fluid.y[i] += dy;
        Fluid.vx[i] = 0; Fluid.vy[i] = 0;
        Fluid.reg[i] = regionAt(Fluid.x[i], Fluid.y[i]); // le corps se pose au niveau où il arrive
      }
      prevCX = x; prevCY = y; cam.x = x; cam.y = y;
      updateCluster();
    },
    records() {
      return { attempts: Records.attempts(), best: Records.best(), history: Records.history() };
    },
  };

  reset();
  requestAnimationFrame(frame);
})();
