// Test de fumée : nécessite `npm i playwright` (et un Chromium accessible).
// Usage : node test/smoke.js
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

  // Laisse le blob se stabiliser 3 s
  await page.waitForTimeout(3000);
  const s1 = await page.evaluate(() => window.__game.stats());
  console.log("après 3 s repos:", JSON.stringify(s1));
  await page.screenshot({ path: "test/shot_idle.png" });

  // Propulsion : curseur À GAUCHE du corps -> le corps doit partir à droite.
  // Le corps est centré à l'écran ; on presse à 250 px à gauche du centre.
  await page.mouse.move(640 - 250, 360);
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await page.mouse.up();
  const s2 = await page.evaluate(() => window.__game.stats());
  console.log("après 2 s de poussée:", JSON.stringify(s2));

  // Dérive inertielle, en accéléré
  await page.evaluate(() => window.__game.setTimeScale(4));
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.__game.setTimeScale(1));
  const s3 = await page.evaluate(() => window.__game.stats());
  console.log("après dérive ×4:", JSON.stringify(s3));
  await page.screenshot({ path: "test/shot_drift.png" });

  // M1 — gel : corps refroidi de force -> il doit se figer en bloc
  await page.evaluate(() => { for (let i = 0; i < Fluid.n; i++) Fluid.temp[i] = 0; });
  await page.waitForTimeout(400);
  const sIce = await page.evaluate(() => window.__game.stats());
  console.log("gel forcé:", JSON.stringify(sIce));

  // M1 — dégel : réchauffé au-dessus du seuil, il redevient fluide
  await page.evaluate(() => { for (let i = 0; i < Fluid.n; i++) Fluid.temp[i] = 0.6; });
  await page.waitForTimeout(400);
  const sThaw = await page.evaluate(() => window.__game.stats());
  console.log("dégel:", JSON.stringify(sThaw));

  // M1 — vapeur : corps chaud + poussée -> bouffées perdues définitivement
  await page.evaluate(() => { for (let i = 0; i < Fluid.n; i++) Fluid.temp[i] = 0.9; });
  await page.mouse.move(640 - 250, 360);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  const sVap = await page.evaluate(() => window.__game.stats());
  console.log("poussée vapeur:", JSON.stringify(sVap));

  // Registres du labo : consignation, record (temps min, volume départage), persistance
  const rec = await page.evaluate(() => {
    Records.wipe();
    const a = Records.endAttempt({ won: false, time: 12.34, volume: 0.1 });
    const b = Records.endAttempt({ won: true, time: 40.0, volume: 0.5 });
    const c = Records.endAttempt({ won: true, time: 35.5, volume: 0.4 });
    const d = Records.endAttempt({ won: true, time: 60.0, volume: 0.9 });
    const out = {
      attempts: Records.attempts(),
      best: Records.best(),
      newBests: [a.newBest, b.newBest, c.newBest, d.newBest],
      history: Records.history().length,
    };
    Records.wipe();
    return out;
  });

  // Réserve (pool) : amorce facile sans transfo, plafond qui monte, tirage
  // déterministe et sans répétition immédiate. Le tirage prend un rnd (0..1).
  const pool = await page.evaluate(() => {
    const easy = (l) => l.difficulty === 1 && l.transforms.length === 0;
    // Chaque tableau du catalogue doit se construire sans erreur, avec une
    // géométrie complète (parois, bornes, sas, entrée).
    const builtAll = Run.catalog().every((l) => {
      const g = l.build();
      return g.walls.length > 0 && g.bounds && g.exit && g.spawn &&
        Array.isArray(g.zones) && Array.isArray(g.sponges);
    });
    const intro0 = Run.poolFor(0), intro1 = Run.poolFor(1), deep = Run.poolFor(6);
    const introPicks = [0, 0.25, 0.5, 0.75, 0.99].map((r) => Run.pick(0, null, r));
    // Une run déterministe : les deux premiers tableaux doivent différer
    // (le pool d'amorce compte au moins deux tableaux).
    Run.start(0);
    const seq = [Run.current().id];
    for (let i = 0; i < 6; i++) { Run.advance(0.5, (i % 5) / 5); seq.push(Run.current().id); }
    return {
      introOnlyEasy: intro0.length >= 2 && intro0.every(easy) && intro1.every(easy),
      introPicksEasy: introPicks.every(easy),
      ceil: [0, 2, 4].map((d) => Run.ceilingAt(d)),
      deepHasT3: deep.some((l) => l.difficulty === 3),
      deepNoT1: deep.every((l) => l.difficulty >= 2),
      firstTwoDiffer: seq[0] !== seq[1],
      banked: Run.banked(),
      builtAll,
    };
  });

  console.log("--- checks ---");
  console.log("erreurs JS:", errors.length ? errors : "aucune");
  const poolOK = pool.introOnlyEasy && pool.introPicksEasy &&
    String(pool.ceil) === "1,2,3" && pool.deepHasT3 && pool.deepNoT1 &&
    pool.firstTwoDiffer && Math.abs(pool.banked - 3) < 1e-9 && pool.builtAll;
  console.log("réserve (pool) :", poolOK ? "OK" : "ECHEC " + JSON.stringify(pool));
  console.log("corps stable au repos:", s1.player >= s0.player - 5 ? "OK" : "ECHEC");
  console.log("coût de la poussée (particules):", s1.player - s2.player);
  console.log("déplacement vers la droite:", (s2.cx - s1.cx).toFixed(1), "px puis", (s3.cx - s2.cx).toFixed(1), "px en dérive");
  console.log("gel du corps:", sIce.frozen ? "OK" : "ECHEC");
  console.log("dégel du corps:", !sThaw.frozen ? "OK" : "ECHEC");
  console.log("éjection vapeur (bouffées, perte définitive):",
    sVap.steam > 0 && sVap.n < sThaw.n ? "OK" : "ECHEC " + JSON.stringify(sVap));
  const recOK = rec.attempts === 4 && rec.history === 4 &&
    rec.best && rec.best.time === 35.5 && rec.best.no === 3 &&
    String(rec.newBests) === "false,true,true,false";
  console.log("registres du labo:", recOK ? "OK" : "ECHEC " + JSON.stringify(rec));
  await browser.close();
})();
