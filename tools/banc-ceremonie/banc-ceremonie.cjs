// BANC DE LA CÉRÉMONIE — chaque étape de #mb-veil, à 1280 × 720 ou 1280 × 800.
// La page CONSTRUITE (vite build → dist/) est servie, ses scripts BLOQUÉS
// (WebGL2 indisponible en headless : le jeu ne démarrerait pas) ; la vraie
// feuille de style reste. On injecte fabrique.js (les vrais modules du jeu :
// plan de station, mini-carte à voies, plans des salles générées, cartes
// d'instruments, tuiles de récolte, rencontres, feu de particules) puis
// poses.js (le DOM que main.ts bâtit à chaque étape).
// node banc-ceremonie.cjs <port>
//   BANC_TAILLE=1280x800  la taille de l'écran (1280x720 par défaut) : le
//                         Steam Deck a 80 px de plus, et une étape qui tient
//                         à l'une peut déborder à l'autre ;
//   BANC_MOINS=1          « moins d'animations » (reducedMotion: 'reduce') :
//                         chaque mise en scène doit retomber sur son état final.
// Les captures et mesures.json vont dans captures/<taille>[-moins]/ : trois
// passes (720, 800, moins) ne s'écrasent pas l'une l'autre.
// Avant : ./node_modules/.bin/vite build, servir dist/ (vite preview), et
// empaqueter fabrique.ts en fabrique.js (esbuild --bundle --format=iife,
// ./node_modules/.bin/esbuild si présent). Le dépôt n'a pas Playwright :
// le banc emprunte celui d'un autre projet de la machine (chemin ci-dessous).
const { chromium } = require('/home/julian/projets/PasMoi/node_modules/playwright-core')
const fs = require('fs')
const path = require('path')
const port = process.argv[2] || '5291'
const TAILLE = process.env.BANC_TAILLE || '1280x720'
const dims = /^(\d+)x(\d+)$/.exec(TAILLE)
if (!dims) { console.log(`BANC_TAILLE « ${TAILLE} » : attendu LARGEURxHAUTEUR, par exemple 1280x800`); process.exit(1) }
const VUE = { width: Number(dims[1]), height: Number(dims[2]) }
const MOINS = process.env.BANC_MOINS === '1'
const OUT = path.join(__dirname, 'captures', `${TAILLE}${MOINS ? '-moins' : ''}`)
fs.mkdirSync(OUT, { recursive: true })
// import.meta.glob est une macro de VITE (planche.ts : les planches livrées,
// tirées par voiesModule → voie → … → renderer) ; esbuild la laisse telle
// quelle sur un import.meta vide, et fabrique.js mourait au chargement
// (« import_meta.glob is not a function ») — window.FAB n'existait plus,
// aucune pose ne se dressait. Hors de Vite, aucune planche n'est livrée :
// le glob rend un catalogue vide.
const FAB = fs.readFileSync(path.join(__dirname, 'fabrique.js'), 'utf-8')
  .replace(/\bimport_meta(\d*)\.glob\(/g, '(() => ({}))(')
const POSES = fs.readFileSync(path.join(__dirname, 'poses.js'), 'utf-8')

const MENTHE = ['#6dffb8', '#a9ffd6', '#8fd8c8', '#eaf6ff']
const OR = ['#ffd977', '#ffe9a8', '#fff4d6', '#f2c98e']

// [fichier, pose, argument, préparation figée (dans la page), attente ms, survol]
const PRISES = [
  ['00-vocabulaire', 'vocabulaire', null, null, 1500],
  ['01-bilan-chute-t850ms', 'bilan', 'chute', 'chute', 0],
  ['02-bilan-final', 'bilan', 'final', null, 2200],
  ['03-versement', 'versement', null, null, 2200, '.mb-dest-maitrise'],
  ['03b-versement-defile', 'versement', null, 'defile', 2200, '.mb-dest-maitrise'],
  ['04-etalonnage-palier-t350ms', 'etalonnage', 'palier', 'palier', 0],
  ['05-tirage-retournement-t550ms', 'draft', null, 'retourne', 0],
  ['06-tirage', 'draft', null, 'vise', 2600, '.mb-pli:first-child .crt-draft'],
  ['06b-tirage-elue-t250ms', 'draft', 'elue', 'elue', 0],
  ['07-salles', 'salles', null, null, 2000, '.mb-porte'],
  ['07b-salles-noeud', 'salles', 'noeud', null, 2000],
  ['07c-salles-porte-ouverte-t260ms', 'salles', null, 'porte', 1500],
  ['08-module-sceau-t350ms', 'module', null, 'sceau', 0],
  ['09-module', 'module', null, null, 2200],
  ['10-carte-station', 'carte', null, null, 1800],
  ['11-repos', 'repos', null, null, 1500],
  ['12-don', 'don', null, null, 1500],
  ['13-rencontre', 'evenement', null, null, 1500],
  ['14-rencontre-issue', 'evenement', 'issue', null, 1500],
  ['15-cache', 'cache', null, null, 1500],
  ['16-minijeu', 'minijeu', null, null, 1500],
  ['17-fin-ordinaire', 'fin', null, null, 1500],
  ['18-fin-bouclee', 'finDescente', 'bouclee', null, 3000],
  ['18b-fin-bouclee-sceau-t900ms', 'finDescente', 'bouclee', 'finSceau', 0],
  ['19-fin-perdue', 'finDescente', 'perdue', null, 3000],
  ['20-fin-reprise', 'finDescente', 'reprise', null, 2000],
]

// les instants figés : chaque règle donne l'âge (ms) des animations ciblées,
// et le feu reprend les rafales que main.ts jette à cet instant
function prepare(quoi, M, O) {
  const P = window.POSE
  const $ = (s) => document.querySelector(s)
  if (quoi === 'chute') {
    P.fige([['.mb-rang, .mb-rang *', 200], ['.mb-flash', 200], ['.mb-scene', 200]], 900)
    P.feu([{ el: $('#mb-rang'), age: 0.2, r: { n: 120, teintes: ['#ffd977', '#eaf6ff', ...M], vitesse: 480, gravite: 420, forme: 'etincelle', duree: 1, taille: 4 } }])
  } else if (quoi === 'palier') {
    P.fige([['.mb-palier-eclair, .mb-palier-eclair *', 350], ['.mb-flash', 350], ['.mb-etal-tube', 350], ['.mb-etal-palier', 350], ['.mb-scene', 350]], 1500)
    P.feu([
      { el: $('#mb-etal-pg'), age: 0.35, r: { n: 90, teintes: M, vitesse: 520, gravite: 380, forme: 'etincelle', duree: 1.1, taille: 4 } },
      { el: $('#mb-etal-tube'), age: 0.35, r: { n: 60, teintes: [...M, ...O], vitesse: 260, gravite: 600, forme: 'confetti', duree: 1.6, taille: 6 } },
    ])
  } else if (quoi === 'retourne') {
    P.fige([['.mb-pli, .mb-pli *', 550]], 1500)
  } else if (quoi === 'vise') {
    const h = $('#mb-cartes'); h.classList.add('mb-isole')
    const pli = h.children[0]; pli.classList.add('mb-vise'); pli.style.setProperty('--ry', '-5deg'); pli.style.setProperty('--rx', '3deg')
  } else if (quoi === 'elue') {
    P.fige([['.mb-pli, .mb-pli *', 250], ['.mb-scene', 250]], 2600)
    const b = $('.mb-elu-c .crt-draft')
    const fam = getComputedStyle(b).getPropertyValue('--fam').trim() || '#6dffb8'
    P.feu([
      { el: b, age: 0.25, r: { n: 70, teintes: [fam, '#eaf6ff', ...M], vitesse: 420, gravite: 520, forme: 'confetti', duree: 1.4, taille: 6 } },
      { el: b, age: 0.25, r: { n: 40, teintes: [fam, '#ffffff'], vitesse: 600, gravite: 200, forme: 'etincelle', duree: 0.7, taille: 4 } },
    ])
  } else if (quoi === 'porte') {
    const h = $('#mb-cartes'); h.classList.add('mb-elu')
    const p = h.querySelectorAll('.mb-porte')[1]; p.classList.add('mb-elue')
    document.getElementById('mb-flash').classList.add('mb-on')
    document.getElementById('mb-scene').classList.add('mb-secousse')
    P.fige([['.mb-porte', 260], ['.mb-flash', 260], ['.mb-scene', 260]], null)
    P.feu([{ el: p, age: 0.26, r: { n: 80, teintes: M, vitesse: 520, gravite: 260, forme: 'etincelle', duree: 0.9, taille: 4 } }])
  } else if (quoi === 'sceau') {
    P.fige([['.mb-module, .mb-module *', 350], ['.mb-continuer', 350], ['.mb-choix', 350]], 900)
    P.feu([{ el: $('.mb-module-sceau'), age: 0.35, r: { n: 70, teintes: [...M, ...O], vitesse: 420, gravite: 480, forme: 'confetti', duree: 1.4, taille: 6 } }])
  } else if (quoi === 'finSceau') {
    // le sceau du module touche (0,5 s de retard + 55 % de ses 0,62 s) : le
    // feu d'or que main.ts y jette, et le flash
    document.getElementById('mb-flash').classList.add('mb-on')
    P.fige([['.mb-flash', 60]], 900)
    P.feu([{ el: $('.mb-fin-sceau'), age: 0.06, r: { n: 110, teintes: [...O, '#eaf6ff'], vitesse: 520, gravite: 460, forme: 'confetti', duree: 1.6, taille: 6 } }])
  } else if (quoi === 'defile') {
    const s = document.getElementById('mb-scene'); s.scrollTop = s.scrollHeight
  }
}

function mesure() {
  const s = document.getElementById('mb-scene')
  const veil = document.getElementById('mb-veil')
  if (veil.hidden) return { veil: 'caché' }
  const vis = [...s.querySelectorAll('button, .mb-cartouche, .mb-ligne, .mb-coeur')].filter((e) => e.offsetParent)
  const bas = vis.length ? Math.round(Math.max(...vis.map((e) => e.getBoundingClientRect().bottom))) : 0
  return {
    scene: `${s.scrollHeight}/${s.clientHeight}${s.scrollHeight > s.clientHeight + 1 ? ' DÉBORDE (défile)' : ''}`,
    basDuDernierBouton: bas,
    ecran: innerHeight,
    boutons: s.querySelectorAll('button:not([disabled])').length,
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const rapport = []
  for (const [nom, pose, arg, prep, attente, survol] of PRISES) {
    const page = await browser.newPage({ viewport: VUE, reducedMotion: MOINS ? 'reduce' : 'no-preference' })
    page.on('pageerror', (e) => console.log(nom, 'PAGEERR', String(e).slice(0, 200)))
    await page.route('**/*.js', (r) => r.abort())
    await page.goto(`http://127.0.0.1:${port}/`)
    // LES EMOJI : le WSL headless n'a aucune police emoji (tofu) ; on prête
    // Segoe UI Emoji (la police du poste Windows) aux familles du jeu, par
    // unicode-range — c'est ce qu'un joueur Windows voit. Et l'écran de
    // chargement (#amorce), resté sous le voile faute de script, s'efface.
    const plage = 'U+1F000-1FAFF, U+2300-23FF, U+2600-27BF, U+2B00-2BFF, U+FE0F, U+1F1E6-1F1FF'
    await page.addStyleTag({ content:
      // Michroma n'a qu'une graisse (400, le gras est synthétisé) : lui
      // prêter une face 600 lui volait ses titres en gras
      [['IBM Plex Mono', 400], ['IBM Plex Mono', 600], ['Michroma', 400]].map(([f, w]) =>
        `@font-face{font-family:'${f}';font-weight:${w};src:url('/emoji-banc.ttf');unicode-range:${plage}}`).join('') +
      // ce qui est derrière le voile (menu, hub) ne se voit pas en jeu : la
      // salle est derrière, rendue en WebGL — ici, du noir
      'body > :not(#mb-veil):not(#overlay){visibility:hidden!important}' })
    await page.evaluate(() => document.fonts.ready)
    await page.addScriptTag({ content: FAB })
    await page.addScriptTag({ content: POSES })
    await page.evaluate(([p, a]) => window.POSE[p](a), [pose, arg])
    if (attente) await page.waitForTimeout(attente)
    if (survol) {
      await page.hover(survol, { force: true }).catch((e) => console.log(nom, 'survol', String(e).slice(0, 120)))
      if (pose === 'versement') await page.evaluate(() => { document.querySelector('.mb-versement').dataset.vers = 'd' })
      await page.waitForTimeout(400)
    }
    if (prep) {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
      await page.evaluate(prepare.toString().replace(/^function prepare/, '(function prepare') + ')(' + JSON.stringify(prep) + ',' + JSON.stringify(MENTHE) + ',' + JSON.stringify(OR) + ')')
      await page.waitForTimeout(80)
    }
    const m = await page.evaluate(mesure)
    rapport.push({ nom, ...m })
    console.log(nom, JSON.stringify(m))
    await page.screenshot({ path: path.join(OUT, `${nom}.png`) })
    await page.close()
  }
  fs.writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify(rapport, null, 1))
  console.log(`→ ${path.relative(process.cwd(), OUT)}/`)
  await browser.close()
  process.exit(0)
})().catch((e) => { console.log('ERR', String(e).slice(0, 600)); process.exit(1) })
