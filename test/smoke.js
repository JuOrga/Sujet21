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
  const P_DISPERSE = await page.evaluate(() => P.disperseCount);

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

  // M1.5 — le relief. Le tableau se lit de dessus : une arête sépare deux
  // niveaux et se comporte comme une paroi tant qu'on ne la franchit pas.
  // On pose le corps contre chaque arête (warp) et on tient la prise.
  const relief = async (x, y, dx, dy, ms) => {
    await page.keyboard.press("KeyR");
    await page.waitForTimeout(200);
    await page.evaluate(([x, y]) => window.__game.warp(x, y), [x, y]);
    await page.waitForTimeout(700);
    await page.evaluate(([dx, dy]) => window.__game.grip(true, dx, dy), [dx, dy]);
    await page.waitForTimeout(ms);
    const s = await page.evaluate(() => window.__game.stats());
    await page.evaluate(() => window.__game.grip(false));
    return s;
  };

  // sans prise, le corps s'arrête de lui-même contre l'arête du palier
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__game.warp(400, 860));
  await page.waitForTimeout(900);
  const sArret = await page.evaluate(() => window.__game.stats());
  console.log("arrêté contre l'arête:", JSON.stringify(sArret));

  // monter sur le palier +1 : ça coûte du volume, le corps reste un
  const sMonte = await relief(400, 860, -1, 0, 4000);
  console.log("montée sur le palier +1:", JSON.stringify(sMonte));

  // le belvédère +2 depuis le sol : au-delà du dénivelé franchissable
  const sHaut = await relief(400, 1050, -1, 0, 900);
  console.log("belvédère +2 depuis le sol:", JSON.stringify(sHaut));

  // descendre dans le collecteur : gratuit, et son remplissage ouvre la vanne
  const sFosse = await relief(504, 900, 1, 0, 2500);
  console.log("descente dans le collecteur:", JSON.stringify(sFosse));
  await page.screenshot({ path: "test/shot_relief.png" });
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(200);

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

  console.log("--- checks ---");
  console.log("erreurs JS:", errors.length ? errors : "aucune");
  console.log("corps stable au repos:", s1.player >= s0.player - 5 ? "OK" : "ECHEC");
  console.log("coût de la poussée (particules):", s1.player - s2.player);
  console.log("déplacement vers la droite:", (s2.cx - s1.cx).toFixed(1), "px puis", (s3.cx - s2.cx).toFixed(1), "px en dérive");
  console.log("gel du corps:", sIce.frozen ? "OK" : "ECHEC");
  console.log("dégel du corps:", !sThaw.frozen ? "OK" : "ECHEC");
  console.log("éjection vapeur (bouffées, perte définitive):",
    sVap.steam > 0 && sVap.n < sThaw.n ? "OK" : "ECHEC " + JSON.stringify(sVap));
  console.log("arrêt seul sur l'arête (sans prise):",
    sArret.z === 0 && !sArret.climbing ? "OK" : "ECHEC " + JSON.stringify(sArret));
  console.log("montée sur le palier +1:",
    sMonte.z === 1 && sMonte.n < 220 && sMonte.player > P_DISPERSE ? "OK"
      : "ECHEC " + JSON.stringify(sMonte));
  console.log("coût de la montée (particules):", 220 - sMonte.n);
  console.log("dénivelé +2 refusé depuis le sol:",
    sHaut.blocked && sHaut.z === 0 ? "OK" : "ECHEC " + JSON.stringify(sHaut));
  console.log("descente gratuite dans le collecteur:",
    sFosse.z === -1 && sFosse.n === 220 ? "OK" : "ECHEC " + JSON.stringify(sFosse));
  console.log("collecteur rempli -> vanne ouverte:",
    sFosse.armed && sFosse.vanne ? "OK" : "ECHEC " + JSON.stringify(sFosse));
  const recOK = rec.attempts === 4 && rec.history === 4 &&
    rec.best && rec.best.time === 35.5 && rec.best.no === 3 &&
    String(rec.newBests) === "false,true,true,false";
  console.log("registres du labo:", recOK ? "OK" : "ECHEC " + JSON.stringify(rec));
  await browser.close();
})();
