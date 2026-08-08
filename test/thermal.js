// Test M1 : gel en cryobaie, fonte puis ébullition au radiateur.
// Usage : node test/thermal.js  (nécessite playwright, cf. test/smoke.js)
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  await page.waitForTimeout(500);
  const s0 = await page.evaluate(() => window.__game.stats());
  console.log("t0:", JSON.stringify(s0));

  // --- Gel : le corps est placé au cœur de la cryobaie ---
  await page.evaluate(() => {
    const s = window.__game.level().heatSources.find((s) => s.t < 0);
    window.__game.teleport(s.x, s.y);
    window.__game.setTimeScale(4);
  });
  await page.waitForTimeout(4000);
  const sIce = await page.evaluate(() => window.__game.stats());
  console.log("après cryobaie:", JSON.stringify(sIce));
  await page.screenshot({ path: "test/shot_ice.png" });

  // --- Fonte + ébullition : le corps gelé est posé près du cœur du radiateur
  // le plus chaud (il faut s'engager dans la chaleur pour bouillir, §4 Vapeur) ---
  const sHot = await page.evaluate(() => {
    const s = window.__game.level().heatSources
      .reduce((a, b) => (b.t > a.t ? b : a));
    window.__game.teleport(s.x + s.r * 0.22, s.y);
    return s;
  });
  await page.waitForTimeout(4000);
  const sBoil = await page.evaluate(() => window.__game.stats());
  console.log("après radiateur:", JSON.stringify(sBoil));
  await page.screenshot({ path: "test/shot_boil.png" });
  await page.evaluate(() => window.__game.setTimeScale(1));

  console.log("--- checks ---");
  const ok = (name, cond) => { console.log(name + ":", cond ? "OK" : "ECHEC"); return cond; };
  let pass = true;
  pass &= ok("erreurs JS (aucune)", errors.length === 0);
  if (errors.length) console.log(errors);
  pass &= ok("gel en cryobaie (frozen)", sIce.frozen === true);
  pass &= ok("température de gel < seuil", sIce.meanTemp < 0.25);
  pass &= ok("fonte au radiateur (plus frozen)", sBoil.frozen === false);
  pass &= ok("ébullition : vapeur émise ou volume perdu",
    sBoil.vapor > 0 || sBoil.player < sIce.player - 3);
  pass &= ok("poussée thermique : le corps a bougé",
    Math.hypot(sBoil.cx - (sHot.x + sHot.r * 0.22), sBoil.cy - sHot.y) > 40
    || sBoil.speed > 30);
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
