// LA CÉRÉMONIE, EN VRAI — voir la fin de salle et la fin de module du jeu
// complet, à leur taille réelle, sans carte graphique.
//
//   pnpm dev --port 5173 --host 127.0.0.1        (dans un autre terminal)
//   node tools/ceremonie/capture.cjs dossier-de-sortie [largeur] [hauteur] [reduit]
//
// Le jeu complet passait pour impossible à regarder dans un Chromium sans
// tête : à 1280 × 800 le rendu logiciel bloque le fil principal, et une
// capture d'écran n'aboutit jamais (30 s d'attente, mesuré le 12/11). Le
// banc du module 2D s'en sortait en rapetissant TOUTE la fenêtre à
// 320 × 200 — ce qui écrase aussi l'interface, donc ne montre rien d'un
// écran en HTML.
//
// L'astuce : le coût est au pixel de la TOILE, et sa taille est la fenêtre
// multipliée par devicePixelRatio (main.ts, echelleRendue). On ment sur ce
// seul nombre (0,12 → une toile de 154 × 96) : la toile devient minuscule,
// la mise en page et les requêtes média, elles, restent celles d'un écran
// de 1280 × 800. La cérémonie est du HTML par-dessus : elle sort nette.
//
// Le parcours est le VRAI : __expedition lance une descente, le pupitre
// valide chaque salle (« valider-salle » : surplus compté, condensat versé,
// mémoire gravée, rien de simulé), puis la sonde verse, tire, ouvre la
// première porte, et ainsi jusqu'au bilan du module et au plan. Une image
// par étape, nommée dans l'ordre.
const { chromium } = require('playwright')
;(async () => {
  const [dossier = '.', largeur = '1280', hauteur = '800', reduit = ''] = process.argv.slice(2)
  const b = await chromium.launch()
  const ctx = await b.newContext({
    viewport: { width: +largeur, height: +hauteur },
    reducedMotion: reduit ? 'reduce' : 'no-preference',
  })
  await ctx.addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { get: () => 0.12 }))
  const p = await ctx.newPage()
  const erreurs = []
  p.on('console', (m) => m.type() === 'error' && erreurs.push(m.text().slice(0, 300)))
  p.on('pageerror', (e) => erreurs.push('ERREUR DE PAGE ' + (e.stack || e.message).slice(0, 600)))
  await p.goto(process.env.JEU ?? 'http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => typeof window.__expedition === 'function' && typeof window.__pupitre === 'function', null, { timeout: 240000, polling: 500 })
  await p.waitForTimeout(800)
  // en portrait le jeu demande de tourner l'appareil ; sans nom d'opérateur,
  // la signature du protocole couvre tout — on passe l'un et l'autre
  const passe = async () => {
    const tourner = p.locator('#tourner-quand-meme')
    if (await tourner.isVisible().catch(() => false)) await tourner.click()
    const signature = p.locator('#signature')
    if (await signature.isVisible().catch(() => false)) {
      await signature.locator('input').first().fill('SONDE')
      await signature.locator('button').first().click()
    }
  }
  await passe()
  await p.evaluate(() => window.__expedition())
  await p.waitForTimeout(1500)
  await passe()

  let n = 0
  const image = async (nom) => {
    const fichier = `${dossier}/${String(n++).padStart(2, '0')}-${nom}.png`
    const etat = await p.evaluate(() => ({
      titre: document.getElementById('mb-titre').textContent,
      contexte: document.getElementById('mb-choix-titre').textContent,
      // une scène plus haute que sa fenêtre défile : c'est le signal d'un écran qui ne tient pas
      defile: document.getElementById('mb-scene').scrollHeight - document.getElementById('mb-scene').clientHeight,
    }))
    let capture = 'ok'
    try {
      await p.screenshot({ path: fichier, timeout: 60000 })
    } catch {
      capture = 'manquée'
    }
    console.log(fichier, capture, JSON.stringify(etat))
  }
  const ouverte = () => p.evaluate(() => !document.getElementById('mb-veil').hidden)

  let auPlan = false
  for (let salle = 1; salle <= 8 && !auPlan; salle++) {
    await p.evaluate(() => window.__pupitre('valider-salle'))
    await p.waitForFunction(() => !document.getElementById('mb-veil').hidden, null, { timeout: 30000 })
    if (salle === 1) {
      await p.waitForTimeout(3000)
      await image('releve-en-cours')
    }
    await p.waitForFunction(() => !document.getElementById('mb-choix').hidden, null, { timeout: 30000 })
    await p.waitForTimeout(1200)
    await image(`salle${salle}-releve`)
    // la maîtrise aux salles impaires, la réserve aux paires : les deux chemins se voient
    const destination = p.locator(salle % 2 ? '.mb-dest-maitrise' : '.mb-dest-reserve:not([disabled])')
    if (await destination.count()) {
      await destination.first().click()
      await p.waitForTimeout(2600)
      await image(`salle${salle}-versee`)
    }
    for (let tour = 0; tour < 10 && (await ouverte()); tour++) {
      await p.waitForTimeout(1700)
      if (!(await ouverte())) break
      await image(`salle${salle}-etape${tour}`)
      const geste = await p.evaluate(() => {
        const hote = document.getElementById('mb-cartes')
        if (hote.classList.contains('mb-station')) return 'plan'
        const suite = hote.querySelector('.mb-continuer')
        if (suite) return suite.click(), 'suite'
        const bouton = hote.querySelector('button:not([disabled])')
        if (bouton) return bouton.click(), 'choix'
        return 'rien'
      })
      if (geste === 'plan') auPlan = true
      if (geste === 'plan' || geste === 'rien') break
    }
    await p.waitForTimeout(2500)
  }
  console.log(erreurs.length ? erreurs.join('\n') : 'aucune erreur de console')
  await b.close()
  process.exit(erreurs.length ? 1 : 0)
})()
