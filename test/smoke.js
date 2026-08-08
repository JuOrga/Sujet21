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

  console.log("--- checks ---");
  console.log("erreurs JS:", errors.length ? errors : "aucune");
  console.log("corps stable au repos:", s1.player >= s0.player - 5 ? "OK" : "ECHEC");
  console.log("coût de la poussée (particules):", s1.player - s2.player);
  console.log("déplacement vers la droite:", (s2.cx - s1.cx).toFixed(1), "px puis", (s3.cx - s2.cx).toFixed(1), "px en dérive");
  await browser.close();
})();
