// Parité des deux implémentations du solveur (JS de référence vs module
// WebAssembly) : mêmes entrées, on compare un pas exact puis une trajectoire
// poussée. Tourne dans Node, sans navigateur. Usage : node test/parity.js
//
// Les deux backends ne sont pas bit à bit identiques : l'ordre d'énumération
// des voisins diffère (Map JS vs tri par comptage), donc l'ordre des sommes
// flottantes aussi. On vérifie qu'un pas reste quasi identique et que la
// trajectoire agrégée (volume, centre de masse, rayon) raconte la même chose.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(ctx, file) {
  const p = path.join(__dirname, "..", file);
  vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: file });
}

async function makeWorld(useWasm) {
  const ctx = vm.createContext({ atob, WebAssembly, console });
  load(ctx, "js/params.js");
  load(ctx, "js/grid.js");
  if (useWasm) load(ctx, "js/fluid.wasm.js");
  load(ctx, "js/level.js");
  load(ctx, "js/fluid.js");
  const world = vm.runInContext("({ Fluid, P, makeLevel })", ctx);
  await world.Fluid.ready;
  return world;
}

// même empilement hexagonal que main.js
function spawnBlob(Fluid, cx, cy, count, spacing) {
  let placed = 0, ring = 0;
  Fluid.add(cx, cy);
  placed++;
  while (placed < count) {
    ring++;
    const m = ring * 6;
    for (let k = 0; k < m && placed < count; k++) {
      const a = (k / m) * Math.PI * 2 + ring * 0.35;
      Fluid.add(cx + Math.cos(a) * ring * spacing, cy + Math.sin(a) * ring * spacing);
      placed++;
    }
  }
}

function setup(world) {
  const { Fluid, P, makeLevel } = world;
  const level = makeLevel();
  Fluid.clear();
  spawnBlob(Fluid, level.spawn.x, level.spawn.y, P.baseCount, P.spacing);
  Fluid.calibrate();
  return level;
}

function stats(Fluid) {
  const n = Fluid.n;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += Fluid.x[i]; sy += Fluid.y[i]; }
  const cx = sx / n, cy = sy / n;
  let r2 = 0;
  for (let i = 0; i < n; i++) r2 += (Fluid.x[i] - cx) ** 2 + (Fluid.y[i] - cy) ** 2;
  return { n, cx, cy, radius: Math.sqrt(r2 / n) };
}

function maxPosDiff(A, B) {
  let m = 0;
  for (let i = 0; i < A.n; i++) {
    m = Math.max(m, Math.abs(A.x[i] - B.x[i]), Math.abs(A.y[i] - B.y[i]));
  }
  return m;
}

(async () => {
  const jsW = await makeWorld(false);
  const wasmW = await makeWorld(true);
  if (jsW.Fluid.backend !== "js") throw new Error("attendu backend js, obtenu " + jsW.Fluid.backend);
  if (wasmW.Fluid.backend !== "wasm") throw new Error("attendu backend wasm, obtenu " + wasmW.Fluid.backend);

  const jsLevel = setup(jsW);
  const wasmLevel = setup(wasmW);
  const dt = 1 / 60;
  let fails = 0;
  const check = (label, ok, detail) => {
    console.log(label + ":", ok ? "OK" : "ECHEC", detail);
    if (!ok) fails++;
  };

  check("nombre de particules", jsW.Fluid.n === wasmW.Fluid.n, "(" + jsW.Fluid.n + ")");
  check("spawn identique", maxPosDiff(jsW.Fluid, wasmW.Fluid) === 0, "");

  // un pas : les deux solveurs doivent produire quasi la même chose
  jsW.Fluid.step(dt, jsLevel);
  wasmW.Fluid.step(dt, wasmLevel);
  const d1 = maxPosDiff(jsW.Fluid, wasmW.Fluid);
  check("écart max après 1 pas", d1 < 1e-3, "(" + d1.toExponential(2) + " px)");

  // 2 s de repos : le corps doit rester posé au même endroit
  for (let k = 0; k < 120; k++) {
    jsW.Fluid.step(dt, jsLevel);
    wasmW.Fluid.step(dt, wasmLevel);
  }
  let a = stats(jsW.Fluid), b = stats(wasmW.Fluid);
  check("repos : centre de masse", Math.hypot(a.cx - b.cx, a.cy - b.cy) < 1.0,
    "(écart " + Math.hypot(a.cx - b.cx, a.cy - b.cy).toFixed(3) + " px)");
  check("repos : rayon du corps", Math.abs(a.radius - b.radius) < 1.0,
    "(js " + a.radius.toFixed(2) + " / wasm " + b.radius.toFixed(2) + " px)");

  // poussée : même impulsion, la trajectoire (portée par la quantité de
  // mouvement, conservée par les deux solveurs) doit rester superposée
  for (const F of [jsW.Fluid, wasmW.Fluid])
    for (let i = 0; i < F.n; i++) F.vx[i] += 120;
  for (let k = 0; k < 300; k++) { // 5 s de dérive
    jsW.Fluid.step(dt, jsLevel);
    wasmW.Fluid.step(dt, wasmLevel);
  }
  a = stats(jsW.Fluid); b = stats(wasmW.Fluid);
  check("dérive : le corps a bougé", a.cx - jsLevel.spawn.x > 200,
    "(" + (a.cx - jsLevel.spawn.x).toFixed(0) + " px)");
  check("dérive : centres superposés", Math.hypot(a.cx - b.cx, a.cy - b.cy) < 5.0,
    "(écart " + Math.hypot(a.cx - b.cx, a.cy - b.cy).toFixed(2) + " px)");
  check("dérive : rayons comparables", Math.abs(a.radius - b.radius) < 3.0,
    "(js " + a.radius.toFixed(2) + " / wasm " + b.radius.toFixed(2) + " px)");

  // gel : les particules marquées frozen ne doivent plus être résolues
  for (const F of [jsW.Fluid, wasmW.Fluid]) {
    for (let i = 0; i < F.n; i++) { F.frozen[i] = 1; F.vx[i] = 0; F.vy[i] = 0; }
  }
  const beforeIce = stats(wasmW.Fluid);
  for (let k = 0; k < 60; k++) wasmW.Fluid.step(dt, wasmLevel);
  const afterIce = stats(wasmW.Fluid);
  check("gel : bloc immobile (wasm)",
    Math.hypot(afterIce.cx - beforeIce.cx, afterIce.cy - beforeIce.cy) < 1e-6, "");

  console.log(fails === 0 ? "--- parité JS/WASM : OK ---" : "--- " + fails + " échec(s) ---");
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
