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

    // sas de sortie
    const e = level.exit;
    const pulse = 0.25 + 0.15 * Math.sin(time * 2.5);
    bctx.fillStyle = `rgba(80, 230, 160, ${pulse})`;
    bctx.fillRect(e.x, e.y, e.w, e.h);
    bctx.strokeStyle = "rgba(120, 255, 190, 0.8)";
    bctx.lineWidth = 2;
    bctx.strokeRect(e.x, e.y, e.w, e.h);

    // éponge : les cellules foncent en se gorgeant, saturées = inertes
    const s = level.sponge;
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
  }

  function drawFluid(playerFlag, cam) {
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, w, h);
    applyCam(fctx, cam);
    const r = 6.5;
    const n = Fluid.n;
    for (let i = 0; i < n; i++) {
      if (Fluid.mergeTimer[i] > 0) fctx.fillStyle = "#b4e6ff";       // goutte éjectée
      else if (playerFlag[i]) fctx.fillStyle = "#79d0ff";           // corps joueur
      else fctx.fillStyle = "#4f93c9";                              // eau libre
      fctx.beginPath();
      fctx.arc(Fluid.x[i], Fluid.y[i], r, 0, Math.PI * 2);
      fctx.fill();
    }
  }

  return {
    drawBackground, drawFluid,
    get w() { return w; }, get h() { return h; },
  };
})();
