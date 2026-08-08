"use strict";

// Rendu sur deux canvas superposés : le décor, puis le fluide.
// Le canvas fluide porte un filtre SVG « goo » (flou + seuil d'alpha) :
// les particules fusionnent visuellement en métaballes (§11).
const Renderer = (() => {
  const bg = document.getElementById("bg");
  const fl = document.getElementById("fluid");
  const bctx = bg.getContext("2d");
  const fctx = fl.getContext("2d");
  let w = 0, h = 0;

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    bg.width = w; bg.height = h;
    fl.width = w; fl.height = h;
  }
  window.addEventListener("resize", resize);
  resize();

  function applyCam(ctx, cam) {
    ctx.setTransform(cam.s, 0, 0, cam.s, w / 2 - cam.x * cam.s, h / 2 - cam.y * cam.s);
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

    // carte thermique : lueurs des sources — le niveau se lit en gradients (§5)
    for (const S of level.heatSources) {
      const hot = S.t > P.ambient;
      const g = bctx.createRadialGradient(S.x, S.y, 0, S.x, S.y, S.r);
      if (hot) {
        g.addColorStop(0, "rgba(255, 120, 45, 0.34)");
        g.addColorStop(0.5, "rgba(255, 100, 40, 0.14)");
        g.addColorStop(1, "rgba(255, 90, 40, 0)");
      } else {
        g.addColorStop(0, "rgba(140, 205, 255, 0.30)");
        g.addColorStop(0.5, "rgba(140, 205, 255, 0.12)");
        g.addColorStop(1, "rgba(140, 205, 255, 0)");
      }
      bctx.fillStyle = g;
      bctx.beginPath();
      bctx.arc(S.x, S.y, S.r, 0, Math.PI * 2);
      bctx.fill();
      // cœur de la source
      const pulse2 = 0.6 + 0.25 * Math.sin(time * (hot ? 5 : 2) + S.x);
      bctx.fillStyle = hot ? `rgba(255, 170, 90, ${pulse2})` : `rgba(210, 240, 255, ${pulse2})`;
      bctx.beginPath();
      bctx.arc(S.x, S.y, 14, 0, Math.PI * 2);
      bctx.fill();
    }

    // sas de sortie
    const e = level.exit;
    const pulse = 0.25 + 0.15 * Math.sin(time * 2.5);
    bctx.fillStyle = `rgba(80, 230, 160, ${pulse})`;
    bctx.fillRect(e.x, e.y, e.w, e.h);
    bctx.strokeStyle = "rgba(120, 255, 190, 0.8)";
    bctx.lineWidth = 2;
    bctx.strokeRect(e.x, e.y, e.w, e.h);

    // éponges : les cellules foncent en se gorgeant, saturées = inertes
    for (const s of level.sponges)
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

    // parois
    for (const W of level.walls) {
      bctx.fillStyle = "#232a38";
      bctx.fillRect(W.x, W.y, W.w, W.h);
      bctx.strokeStyle = "#39455c";
      bctx.lineWidth = 1.5;
      bctx.strokeRect(W.x + 0.75, W.y + 0.75, W.w - 1.5, W.h - 1.5);
    }

    // vapeur : brume qui s'étend et s'éteint — dessinée hors du filtre « goo »
    // pour ne pas se re-fondre en gouttes à l'écran
    for (let i = 0; i < Fluid.n; i++) {
      if (Fluid.phase[i] !== 2) continue;
      const a = Math.max(0, Fluid.vaporT[i] / P.vaporLife);
      const r = 6 + (1 - a) * 16;
      bctx.fillStyle = `rgba(205, 224, 234, ${(0.34 * a).toFixed(3)})`;
      bctx.beginPath();
      bctx.arc(Fluid.x[i], Fluid.y[i], r, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  function drawFluid(playerFlag, cam) {
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, w, h);
    applyCam(fctx, cam);
    const r = 6.5;
    const n = Fluid.n;
    for (let i = 0; i < n; i++) {
      if (Fluid.phase[i] === 2) continue;                            // la vapeur est dessinée en brume, sans goo
      if (Fluid.phase[i] === 1) fctx.fillStyle = "#e9f8ff";          // glace : cristal pâle
      else if (Fluid.mergeTimer[i] > 0) fctx.fillStyle = "#b4e6ff";  // goutte éjectée
      else {
        // l'état se lit par la couleur (§11) : bleu froid -> orangé au bord de l'ébullition
        const t = Fluid.temp[i];
        if (t > 0.8)       fctx.fillStyle = playerFlag[i] ? "#ffb37a" : "#d99a68";
        else if (t > 0.55) fctx.fillStyle = playerFlag[i] ? "#b4d4b8" : "#8fb0a0";
        else if (t < 0.18) fctx.fillStyle = playerFlag[i] ? "#c2ecff" : "#8fc4e6";
        else               fctx.fillStyle = playerFlag[i] ? "#79d0ff" : "#4f93c9";
      }
      fctx.beginPath();
      fctx.arc(Fluid.x[i], Fluid.y[i], Fluid.phase[i] === 1 ? r + 1 : r, 0, Math.PI * 2);
      fctx.fill();
    }
  }

  return {
    drawBackground, drawFluid,
    get w() { return w; }, get h() { return h; },
  };
})();
