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

  // Vue de dessus : un relief se lit à son ombre portée et à la face de la
  // marche. Un palier est plus près de l'œil (clair, ombre à l'extérieur),
  // une fosse est plus loin (sombre, ombre à l'intérieur). L'arête tenue
  // s'allume ; une arête trop haute pour le pouvoir courant se signale.
  function drawRelief(r, time, mark) {
    const up = r.z > 0;
    const d = Math.min(34, 13 * Math.abs(r.z) + 8); // « épaisseur » lue de la marche

    if (up) {
      // ombre portée à l'extérieur : la surface flotte au-dessus du sol
      bctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      bctx.fillRect(r.x + d * 0.7, r.y + d * 0.9, r.w, r.h);
      // la face de la marche, côté opposé à la lumière
      bctx.fillStyle = "#161c28";
      bctx.fillRect(r.x, r.y, r.w + d * 0.7, r.h + d * 0.9);
      // le dessus : plus on est haut, plus on est près de la lumière
      const lift = Math.min(3, r.z);
      bctx.fillStyle = `rgb(${38 + 12 * lift}, ${46 + 13 * lift}, ${64 + 16 * lift})`;
      bctx.fillRect(r.x, r.y, r.w, r.h);
      // arêtes éclairées, côté lumière
      bctx.strokeStyle = "rgba(210, 228, 255, 0.30)";
      bctx.lineWidth = 2;
      bctx.beginPath();
      bctx.moveTo(r.x, r.y + r.h); bctx.lineTo(r.x, r.y); bctx.lineTo(r.x + r.w, r.y);
      bctx.stroke();
    } else {
      bctx.fillStyle = "#070a11";
      bctx.fillRect(r.x, r.y, r.w, r.h);
      // paroi intérieure vue de dessus : l'ombre est dedans, côté lumière
      const g = bctx.createLinearGradient(r.x, r.y, r.x + d * 1.8, r.y + d * 1.8);
      g.addColorStop(0, "rgba(0, 0, 0, 0.85)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      bctx.fillStyle = g;
      bctx.fillRect(r.x, r.y, r.w, r.h);
      // le fond attrape un peu de lumière du côté opposé
      bctx.strokeStyle = "rgba(140, 170, 210, 0.18)";
      bctx.lineWidth = 2;
      bctx.beginPath();
      bctx.moveTo(r.x + r.w, r.y); bctx.lineTo(r.x + r.w, r.y + r.h);
      bctx.lineTo(r.x, r.y + r.h);
      bctx.stroke();
    }

    // trame du dessus : elle continue celle du sol, décalée — le niveau se
    // lit aussi au déplacement du motif
    bctx.save();
    bctx.beginPath();
    bctx.rect(r.x, r.y, r.w, r.h);
    bctx.clip();
    bctx.fillStyle = up ? "#3a4762" : "#121826";
    const step = 120, sh = up ? 8 : -8;
    for (let gx = Math.floor(r.x / step) * step; gx <= r.x + r.w; gx += step)
      for (let gy = Math.floor(r.y / step) * step; gy <= r.y + r.h; gy += step)
        bctx.fillRect(gx - 1.5 + sh, gy - 1.5 + sh, 3, 3);
    bctx.restore();

    // arêtes
    const hot = mark === "cross", bad = mark === "blocked";
    bctx.strokeStyle = bad ? `rgba(255, 140, 120, ${0.6 + 0.3 * Math.sin(time * 12)})`
      : hot ? `rgba(138, 255, 200, ${0.6 + 0.35 * Math.sin(time * 10)})`
      : up ? "rgba(255, 208, 138, 0.55)" : "rgba(138, 255, 200, 0.45)";
    bctx.lineWidth = hot || bad ? 4 : 2.5;
    bctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

    // étiquette : le nom et le niveau, peints dans le décor
    bctx.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    bctx.fillStyle = up ? "rgba(255, 208, 138, 0.9)" : "rgba(150, 210, 235, 0.9)";
    const lvl = (r.z > 0 ? "+" : "") + r.z;
    bctx.fillText(`${r.name} ${lvl}`, r.x + 10, r.y + (up ? -12 : 28));

    // collecteur : le niveau atteint face au seuil demandé
    if (r.fill !== undefined) {
      const need = Math.max(0.001, P.basinFill);
      const ratio = Math.min(1, r.fill / need);
      const bw = r.w - 24;
      const by = r.y + r.h - 18;
      bctx.fillStyle = "rgba(255,255,255,0.10)";
      bctx.fillRect(r.x + 12, by, bw, 7);
      bctx.fillStyle = r.armed ? "rgba(120, 255, 190, 0.95)" : "rgba(121, 208, 255, 0.8)";
      bctx.fillRect(r.x + 12, by, bw * ratio, 7);
      bctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
      bctx.fillStyle = r.armed ? "rgba(120, 255, 190, 0.95)" : "rgba(150, 190, 230, 0.85)";
      bctx.fillText(r.armed ? "AMORCÉ" : r.fill.toFixed(2).replace(".", ",") + " / " +
        need.toFixed(2).replace(".", ",") + " L", r.x + 12, by - 8);
    }
  }

  // Vantail : fermé, c'est une paroi (mais on voit que c'en est un) ;
  // ouvert, il ne reste que son cadre.
  function drawGate(g, time) {
    if (!g.open) {
      bctx.fillStyle = "#2b3346";
      bctx.fillRect(g.x, g.y, g.w, g.h);
      bctx.strokeStyle = "rgba(255, 208, 138, 0.5)";
      bctx.lineWidth = 2;
      for (let k = g.y + 8; k < g.y + g.h - 4; k += 12) {
        bctx.beginPath();
        bctx.moveTo(g.x + 6, k); bctx.lineTo(g.x + g.w - 6, k);
        bctx.stroke();
      }
    } else {
      bctx.strokeStyle = `rgba(120, 255, 190, ${0.5 + 0.25 * Math.sin(time * 4)})`;
      bctx.lineWidth = 3;
      bctx.setLineDash([9, 7]);
      bctx.strokeRect(g.x, g.y, g.w, g.h);
      bctx.setLineDash([]);
    }
    if (g.name) {
      bctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
      bctx.fillStyle = g.open ? "rgba(120, 255, 190, 0.9)" : "rgba(255, 208, 138, 0.8)";
      bctx.fillText(g.name, g.x - 4, g.y - 10);
    }
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

    // relief : les creux d'abord, les surélévations ensuite — c'est l'ordre
    // dans lequel un œil les empile depuis le dessus
    if (level.reliefs) {
      for (const r of level.reliefs)
        if (r.z < 0) drawRelief(r, time, activeIdx === r.idx ? activeMark : null);
      for (const g of level.gates) drawGate(g, time);
      for (const r of level.reliefs)
        if (r.z > 0) drawRelief(r, time, activeIdx === r.idx ? activeMark : null);
    }
  }

  // L'arête tenue s'allume : le franchissement se voit avant de se sentir.
  let activeIdx = -1, activeMark = null;
  function setActiveRelief(idx, mark) { activeIdx = idx; activeMark = mark; }

  // Couleur d'une particule selon sa température : blanc glacé sous
  // l'ambiante, cyan à l'ambiante, orange chaud vers l'ébullition.
  // L'état se lit sur le corps lui-même (§11).
  function tempColor(t, base, tint) {
    const A = P.tempAmbient;
    let m, target;
    if (t < A) { m = (A - t) / A; target = [223, 244, 255]; }
    else { m = Math.min(1, (t - A) / (1 - A)); target = [255, 150, 90]; }
    const k = tint === undefined ? 1 : tint;
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    const r = cl(base[0] + (target[0] - base[0]) * m);
    const g = cl(base[1] + (target[1] - base[1]) * m);
    const b = cl(base[2] + (target[2] - base[2]) * m);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function shade(hex, k) {
    if (k === 1) return hex;
    const v = parseInt(hex.slice(1), 16);
    const cl = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
    return `rgb(${cl(v >> 16)}, ${cl((v >> 8) & 255)}, ${cl(v & 255)})`;
  }

  const BASE_PLAYER = [121, 208, 255], BASE_FREE = [79, 147, 201];

  // Le niveau se lit aussi sur le corps : plus clair d'un étage au-dessus,
  // plus sourd d'un étage en dessous.
  function levelTint(k, level) {
    if (k < 0 || !level.reliefs[k]) return 1;
    const z = level.reliefs[k].z;
    return z > 0 ? 1 + Math.min(0.3, 0.18 * z) : 1 / (1 + Math.min(0.7, 0.42 * -z));
  }

  function drawFluid(playerFlag, cam, level) {
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, w, h);
    applyCam(fctx, cam);
    const r = 6.5;
    const n = Fluid.n;
    for (let i = 0; i < n; i++) {
      const t = level ? levelTint(Fluid.reg[i], level) : 1;
      if (Fluid.frozen[i]) fctx.fillStyle = shade("#eaf7ff", t);              // glace : bloc pâle
      else if (Fluid.mergeTimer[i] > 0) fctx.fillStyle = shade("#b4e6ff", t); // goutte éjectée
      else if (playerFlag[i]) fctx.fillStyle = tempColor(Fluid.temp[i], BASE_PLAYER, t);
      else fctx.fillStyle = tempColor(Fluid.temp[i], BASE_FREE, t);           // eau libre
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
    drawBackground, drawFluid, drawEffects, setActiveRelief,
    get w() { return w; }, get h() { return h; },
  };
})();
