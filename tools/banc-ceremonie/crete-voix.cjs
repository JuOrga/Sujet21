// CRÊTE DES VOIX — rend chaque voix de la cérémonie et les stings de référence
// d'audio.ts (coupFinal, collect, vanne, iceImpact) dans un OfflineAudioContext
// de Chromium sans tête, sur un bus de gain unitaire, et imprime la crête de la
// SOMME (les nœuds qui partent ensemble s'additionnent : c'est elle qui sature).
// Les stings sont joués par un vrai AudioFx à qui l'on prête le contexte hors
// ligne ; le bruit des voix est aléatoire : la crête varie de quelques %.
// node tools/banc-ceremonie/crete-voix.cjs   (depuis la racine de l'arbre)
const { chromium } = require('/home/julian/projets/PasMoi/node_modules/playwright-core')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ESBUILD = '/home/julian/projets/sujet21/node_modules/.pnpm/node_modules/.bin/esbuild'
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crete-')), 'crete.js')
execFileSync(ESBUILD, [path.join(__dirname, 'crete-voix-entree.ts'), '--bundle', '--format=iife', `--outfile=${out}`], { stdio: 'inherit' })

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('about:blank')
  await page.addScriptTag({ path: out })
  const r = await page.evaluate(() => window.mesure())
  await browser.close()
  const f = (n) => n.toFixed(3)
  const plafond = Math.min(...Object.values(r.refs))
  console.log('RÉFÉRENCES (crête de la somme, gain unitaire)')
  for (const [k, v] of Object.entries(r.refs)) console.log(`  ${k.padEnd(12)} ${f(v)}`)
  console.log(`PLAFOND = la plus basse des références : ${f(plafond)}`)
  console.log('VOIX (force 1)')
  for (const [k, v] of Object.entries(r.voix)) console.log(`  ${k.padEnd(12)} ${f(v)}  ${v <= plafond ? 'ok' : 'AU-DESSUS'}`)
})()
