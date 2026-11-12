// LE BANC DU MODULE 2D, EN IMAGES — sans le reste du jeu.
//
//   pnpm dev --port 5173 --host 127.0.0.1        (dans un autre terminal)
//   node tools/banc-module2d/capture.cjs toile  sortie.png "biome=chaud"
//   node tools/banc-module2d/capture.cjs film   sortie.png "biome=cryo&saut=2&rang=3&joues=1,0,1" "0,0.7,1.4,2.1,2.8"
//   node tools/banc-module2d/capture.cjs film   sortie.png "biome=tempere&genre=entree&rang=0&joues=" "0,0.9,1.5,2.1,2.4"
//   node tools/banc-module2d/capture.cjs film   sortie.png "biome=chaud&z=0.5" "-1"      (la vue de jeu, sans transition)
//
// `toile` : le module entier, tel que le peintre le compose (module.html).
// `film`  : une planche d'images à travers le VRAI shader (transition.html) —
//           un temps négatif donne la vue de jeu (z : le zoom, cx cy : le centre).
// Les réglages de l'adresse : biome, forme, rangs, voies, rang, voie, joues,
// hr (hauteur / largeur de la salle), icones=0, saut (rangs franchis d'un
// coup), genre=entree, temps (l'horloge du shader), w, h.
const { chromium } = require('playwright')
;(async () => {
  const [mode, out, query = '', ts = '-1', w = mode === 'film' ? '640' : '1600', h = mode === 'film' ? '400' : '900', cols = '4'] = process.argv.slice(2)
  if (!out || (mode !== 'toile' && mode !== 'film')) {
    console.error('usage : capture.cjs toile|film sortie.png "<réglages>" ["t1,t2,…"] [largeur] [hauteur] [colonnes]')
    process.exit(1)
  }
  const base = process.env.BANC ?? 'http://127.0.0.1:5173/tools/banc-module2d'
  const b = await chromium.launch()
  const temps = ts.split(',').map(Number)
  const C = mode === 'film' ? Math.min(+cols, temps.length) : 1
  const L = mode === 'film' ? Math.ceil(temps.length / C) : 1
  const p = await b.newPage({ viewport: { width: +w * C, height: +h * L } })
  p.on('pageerror', (e) => console.error('ERREUR DE PAGE', e.message.slice(0, 600)))
  await p.goto(`${base}/${mode === 'film' ? 'transition' : 'module'}.html?w=${w}&h=${h}&${query}`)
  await p.waitForFunction(() => document.title === 'pret', null, { timeout: 90000 })
  if (mode === 'film')
    await p.evaluate(
      ({ temps, C, L, w, h }) => {
        const src = document.getElementById('c')
        const pl = document.createElement('canvas')
        pl.width = w * C
        pl.height = h * L
        const g = pl.getContext('2d')
        temps.forEach((t, i) => {
          window.__image(t < 0 ? null : t)
          g.drawImage(src, (i % C) * w, Math.floor(i / C) * h)
          g.fillStyle = '#fff'
          g.font = '14px monospace'
          g.fillText(t < 0 ? 'jeu' : `t = ${t.toFixed(2)} s`, (i % C) * w + 8, Math.floor(i / C) * h + 18)
        })
        src.replaceWith(pl)
      },
      { temps, C, L, w: +w, h: +h },
    )
  else console.log(JSON.stringify(await p.evaluate(() => window.__info)))
  await p.screenshot({ path: out })
  await b.close()
})()
