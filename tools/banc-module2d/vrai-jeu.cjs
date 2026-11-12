// LE VRAI JEU, EN PETIT — voir le moteur monter le module, sans carte graphique.
//
//   pnpm dev --port 5173 --host 127.0.0.1        (dans un autre terminal)
//   node tools/banc-module2d/vrai-jeu.cjs dossier-de-sortie [nombre d'images]
//
// Le jeu complet passait pour impossible à rendre dans un Chromium sans tête
// (« une image toutes les vingt secondes »). Il l'est à 1280 × 800 ; à
// 320 × 200, le rendu logiciel tient ~2 images par seconde — assez pour voir
// qu'une salle se monte sans erreur et ce que le moteur en montre. Le coût
// est au pixel : rester petit. Tout ce qui n'est pas une toile est masqué.
// La sonde entre dans le premier module par __expedition (sans passer par le
// hub ni la carte) et capture une image après l'autre, avec l'état de la caméra.
const { chromium } = require('playwright')
;(async () => {
  const [dossier = '.', n = '12'] = process.argv.slice(2)
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 320, height: 200 } })
  const erreurs = []
  p.on('console', (m) => m.type() === 'error' && erreurs.push(m.text().slice(0, 300)))
  p.on('pageerror', (e) => erreurs.push('ERREUR DE PAGE ' + (e.stack || e.message).slice(0, 600)))
  await p.goto((process.env.JEU ?? 'http://127.0.0.1:5173') + '/?module2d=1', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => typeof window.__expedition === 'function' && typeof window.__cam === 'object', null, { timeout: 240000, polling: 1000 })
  await p.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important } canvas { visibility: visible !important }' })
  await p.evaluate(() => window.__expedition())
  for (let i = 0; i < +n; i++) {
    const etat = await Promise.race([
      p.evaluate(() => ({ camera: [Math.round(__cam.x), Math.round(__cam.y), +__cam.zoom.toFixed(4)], pilote: __cam.piloteT })),
      new Promise((ok) => setTimeout(() => ok('occupé'), 15000)),
    ])
    let capture = 'manquée'
    try {
      await p.screenshot({ path: `${dossier}/vrai-jeu-${String(i).padStart(2, '0')}.png`, timeout: 60000 })
      capture = 'ok'
    } catch {}
    console.log(i, JSON.stringify(etat), capture)
  }
  console.log(erreurs.length ? erreurs.join('\n') : 'aucune erreur de console')
  await b.close()
  process.exit(erreurs.length ? 1 : 0)
})()
