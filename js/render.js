"use strict";

// Rendu sur trois canvas superposés : le décor, le fluide, puis les effets.
// Le canvas fluide porte un filtre SVG « goo » (flou + seuil d'alpha) :
// les particules fusionnent visuellement en métaballes (§11).
// Chaque surface a une identité visuelle univoque — couleur, texture,
// étiquette peinte dans le décor — pour qu'on sache d'un coup d'œil
// quelle surface fait quoi, et la légende (touche L) précise l'effet
// par état de l'eau.
const Renderer = (() => {
  const bg = document.getElementById("bg");
  const fl = document.getElementById("fluid");
  const fx = document.getElementById("fx");
  const bctx = bg.getContext("2d");
  const fctx = fl.getContext("2d");
  const xctx = fx.getContext("2d");
  let w = 0, h = 0;

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    bg.width = w; bg.height = h;
    fl.width = w; fl.height = h;
    fx.width = w; fx.height = h;
  }
  window.addEventListener("resize", resize);
  resize();

  function applyCam(ctx, cam) {
    ctx.setTransform(cam.s, 0, 0, cam.s, w / 2 - cam.x * cam.s, h / 2 - cam.y * cam.s);
  }

  function drawZone(z, time) {
    const heat = z.kind === "heat";
    // fond pulsant dans la couleur de la surface
    const pulse = heat ? 0.10 + 0.05 * Math.sin(time * 3) : 0.12 + 0.04 * Math.sin(time * 1.6);
    bctx.fillStyle = heat ? `rgba(255, 120, 50, ${pulse})` : `rgba(140, 205, 255, ${pulse})`;
    bctx.fillRect(z.x, z.y, z.w, z.h);

    bctx.save();
    bctx.beginPath();
    bctx.rect(z.x, z.y, z.w, z.h);
    bctx.clip();
    if (heat) {
      // rayures diagonales animées : ça « monte », ça chauffe
      bctx.strokeStyle = "rgba(255, 140, 60, 0.35)";
      bctx.lineWidth = 6;
      const off = (time * 30) % 26;
      for (let sx = z.x - z.h - 26; sx < z.x + z.w; sx += 26) {
        bctx.beginPath();
        bctx.moveTo(sx + off, z.y + z.h);
        bctx.lineTo(sx + off + z.h, z.y);
        bctx.stroke();
      }
    } else {
      // cristaux de givre fixes : ça fige
      bctx.strokeStyle = "rgba(180, 225, 255, 0.4)";
      bctx.lineWidth = 1.5;
      for (let gx = z.x + 20; gx < z.x + z.w; gx += 44)
        for (let gy = z.y + 20; gy < z.y + z.h; gy += 44) {
          bctx.beginPath();
          bctx.moveTo(gx - 6, gy); bctx.lineTo(gx + 6, gy);
          bctx.moveTo(gx, gy - 6); bctx.lineTo(gx, gy + 6);
          bctx.moveTo(gx - 4, gy - 4); bctx.lineTo(gx + 4, gy + 4);
          bctx.moveTo(gx - 4, gy + 4); bctx.lineTo(gx + 4, gy - 4);
          bctx.stroke();
        }
    }
    bctx.restore();

    bctx.strokeStyle = heat ? "#ff8c46" : "#9fdcff";
    bctx.lineWidth = 2;
    bctx.setLineDash([10, 6]);
    bctx.strokeRect(z.x, z.y, z.w, z.h);
    bctx.setLineDash([]);

    bctx.font = "600 22px 'Segoe UI', system-ui, sans-serif";
    bctx.fillStyle = heat ? "rgba(255, 160, 90, 0.9)" : "rgba(180, 225, 255, 0.9)";
    bctx.fillText(z.name, z.x + 12, z.y + 30);
  }

  function drawBackground(level, cam, time) {
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = "#0b0e14";
    bctx.fillRect(0, 0, w, h);
    applyCam(bctx, cam);

    // trame de repère : sans points fixes, la dérive serait imperceptible (§11)
    const step = 120;
    const x0 = Math.max(level.bounds.x, cam.x - w / cam.s), x1 = Math.min(level.bounds.w, cam.x + w / cam.s);
    const y0 = Math.max(level.bounds.y, cam.y - h / cam.s), y1 = Math.min(level.bounds.h, cam.y + h / cam.s);
    bctx.fillStyle = "#1a2130";
    for (let gx = Math.floor(x0 / step) * step; gx <= x1; gx += step)
      for (let gy = Math.floor(y0 / step) * step; gy <= y1; gy += step)
        bctx.fillRect(gx - 1.5, gy - 1.5, 3, 3);

    // zones thermiques : la carte de température se lit dans le décor (§5)
    for (const z of level.zones) drawZone(z, time);

    // sas de sortie
    const e = level.exit;
    const pulse = 0.25 + 0.15 * Math.sin(time * 2.5);
    bctx.fillStyle = `rgba(80, 230, 160, ${pulse})`;
    bctx.fillRect(e.x, e.y, e.w, e.h);
    bctx.strokeStyle = "rgba(120, 255, 190, 0.8)";
    bctx.lineWidth = 2;
    bctx.strokeRect(e.x, e.y, e.w, e.h);
    bctx.font = "600 22px 'Segoe UI', system-ui, sans-serif";
    bctx.fillStyle = "rgba(120, 255, 190, 0.9)";
    bctx.fillText("SAS", e.x + 12, e.y - 10);

    // éponges : les cellules foncent en se gorgeant, saturées = inertes
    for (const s of level.sponges) {
      for (let cy = 0; cy < s.rows; cy++)
        for (let cx = 0; cx < s.cols; cx++) {
          const st = s.stored[cy * s.cols + cx];
          const sat = Math.min(1, st / P.spongeCellCap);
          if (sat >= 1) bctx.fillStyle = "#3c4152";
          else {
            const g = Math.round(110 - 50 * sat);
            bctx.fillStyle = `rgb(${g + 20}, ${g}, ${Math.round(g * 0.55)})`;
          }
          bctx.fillRect(s.x + cx * s.cell + 1, s.y + cy * s.cell + 1, s.cell - 2, s.cell - 2);
        }
      if (s.name) {
        bctx.font = "600 18px 'Segoe UI', system-ui, sans-serif";
        bctx.fillStyle = "rgba(210, 175, 95, 0.9)";
        bctx.fillText(s.name, s.x, s.y - 8);
      }
    }

    // parois
    for (const W of level.walls) {
      bctx.fillStyle = "#232a38";
      bctx.fillRect(W.x, W.y, W.w, W.h);
      bctx.strokeStyle = "#39455c";
      bctx.lineWidth = 1.5;
      bctx.strokeRect(W.x + 0.75, W.y + 0.75, W.w - 1.5, W.h - 1.5);
    }
  }

  // Couleur d'une particule selon sa température : blanc glacé sous
  // l'ambiante, cyan à l'ambiante, orange chaud vers l'ébullition.
  // L'état se lit sur le corps lui-même (§11).
  function tempColor(t, base) {
    const A = P.tempAmbient;
    let m, target;
    if (t < A) { m = (A - t) / A; target = [223, 244, 255]; }
    else { m = Math.min(1, (t - A) / (1 - A)); target = [255, 150, 90]; }
    const r = Math.round(base[0] + (target[0] - base[0]) * m);
    const g = Math.round(base[1] + (target[1] - base[1]) * m);
    const b = Math.round(base[2] + (target[2] - base[2]) * m);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const BASE_PLAYER = [121, 208, 255], BASE_FREE = [79, 147, 201];

  function drawFluid(playerFlag, cam) {
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, w, h);
    applyCam(fctx, cam);
    const r = 6.5;
    const n = Fluid.n;
    for (let i = 0; i < n; i++) {
      if (Fluid.frozen[i]) fctx.fillStyle = "#eaf7ff";                        // glace : bloc pâle
      else if (Fluid.mergeTimer[i] > 0) fctx.fillStyle = "#b4e6ff";           // goutte éjectée
      else if (playerFlag[i]) fctx.fillStyle = tempColor(Fluid.temp[i], BASE_PLAYER);
      else fctx.fillStyle = tempColor(Fluid.temp[i], BASE_FREE);              // eau libre
      fctx.beginPath();
      fctx.arc(Fluid.x[i], Fluid.y[i], Fluid.frozen[i] ? r + 1 : r, 0, Math.PI * 2);
      fctx.fill();
    }
  }

  // Bouffées de vapeur : cercles doux qui s'étendent et s'estompent,
  // hors filtre goo — la vapeur ne « colle » pas, elle se disperse.
  function drawEffects(steam, cam) {
    xctx.setTransform(1, 0, 0, 1, 0, 0);
    xctx.clearRect(0, 0, w, h);
    if (!steam.length) return;
    applyCam(xctx, cam);
    for (const s of steam) {
      const a = Math.max(0, s.life / P.steamLife) * 0.45;
      xctx.fillStyle = `rgba(235, 243, 255, ${a})`;
      xctx.beginPath();
      xctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      xctx.fill();
    }
  }

  return {
    drawBackground, drawFluid, drawEffects,
    get w() { return w; }, get h() { return h; },
  };
})();
