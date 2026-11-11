// LE PILOTE — ouvre le jeu, le fait avancer image par image, et filme.
//
// Voir horloge.js pour le principe (le jeu ne voit que notre horloge). Ici :
// le navigateur, l'entrée dans la salle, les gestes, et le tuyau vers ffmpeg.
//
// LE RENDU. Chromium sans carte graphique retombe sur SwiftShader : 3,3 s
// par image en 540×960 (mesuré le 10/11/2026) — 1 h 40 pour quinze secondes
// de vidéo. Avec une vraie fenêtre sous Xvfb et ANGLE branché sur l'OpenGL
// de Mesa (llvmpipe), la même image tombe à 85 ms, et à ~290 ms en
// 1080×1920. D'où la fenêtre (headless: false) et l'écran virtuel : ce
// n'est pas pour voir, c'est pour le pilote graphique.

import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../..')
const { chromium } = createRequire(import.meta.url)('playwright')

export const IPS = 60
const DT = 1000 / IPS

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webm': 'video/webm',
}

/** Sert dist/ — le jeu CONSTRUIT, celui que le joueur reçoit, pas le
 *  serveur de développement (dont le client HMR pose ses propres minuteries). */
function sertDist() {
  const dist = path.join(RACINE, 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ absent : lancer `pnpm build` d’abord')
  return new Promise((ok) => {
    const s = http.createServer((req, rep) => {
      const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      let f = path.join(dist, chemin)
      if (!f.startsWith(dist)) return rep.writeHead(403).end()
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html')
      if (!fs.existsSync(f)) return rep.writeHead(404).end()
      rep.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' })
      fs.createReadStream(f).pipe(rep)
    })
    s.listen(0, '127.0.0.1', () => ok({ port: s.address().port, ferme: () => s.close() }))
  })
}

/** Un écran virtuel à nous : le pilote se suffit, pas besoin de xvfb-run. */
async function ecranVirtuel(l, h) {
  for (let n = 90 + Math.floor(Math.random() * 400); ; n++) {
    if (fs.existsSync(`/tmp/.X${n}-lock`)) continue
    const x = spawn('Xvfb', [`:${n}`, '-screen', '0', `${l}x${h}x24`, '-nolisten', 'tcp'], { stdio: 'ignore' })
    await new Promise((r) => setTimeout(r, 700))
    if (x.exitCode === null) return { display: `:${n}`, ferme: () => x.kill() }
  }
}

/**
 * Ouvre le jeu dans la salle demandée, corps prêt, commandes en main.
 *
 * `largeur`×`hauteur` sont en pixels CSS et `densite` multiplie : 540×960 à
 * la densité 2 donne une image de 1080×1920 avec une interface dessinée à la
 * taille qu'elle a sur un téléphone — en 1080×1920 à la densité 1, le HUD
 * serait minuscule.
 */
export async function ouvre({
  tableau = 1,
  largeur = 540,
  hauteur = 960,
  densite = 2,
  dureeSon = 150,
  graine = 21,
  sansEcrit = false,
  doigt = true,
  requete = '',
  css = '',
  journal = true,
} = {}) {
  const t0 = Date.now()
  const dit = (...a) => journal && console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s]`, ...a)
  const serveur = await sertDist()
  const ecran = await ecranVirtuel(largeur + 200, hauteur + 300)
  const navigateur = await chromium.launch({
    headless: false,
    env: { ...process.env, DISPLAY: ecran.display },
    args: [
      '--use-gl=angle',
      '--use-angle=gl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
    ],
  })
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: densite })
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && dit('ERREUR PAGE', m.text().slice(0, 400)))
  page.on('pageerror', (e) => dit('EXCEPTION PAGE', String(e).slice(0, 400)))
  page.on('response', (r) => r.status() >= 400 && dit('ABSENT', r.status(), r.url().replace(/^http:\/\/[^/]+/, '')))
  await page.addInitScript(`window.__clipReglages = ${JSON.stringify({ dureeSon, graine })}`)
  await page.addInitScript(fs.readFileSync(path.join(ICI, 'horloge.js'), 'utf8'))
  // SANS ÉCRIT : les écriteaux que le jeu dessine dans son calque 2D
  // (« ANNEAU 1 / 3 », les numéros des anneaux, les consignes) ne sont pas
  // des éléments de page qu'un style masquerait. On rend muettes les deux
  // fonctions qui écrivent dans un canvas : les formes restent, les mots
  // partent — le plan montre la physique, pas le mode d'emploi.
  if (sansEcrit)
    await page.addInitScript(() => {
      CanvasRenderingContext2D.prototype.fillText = () => {}
      CanvasRenderingContext2D.prototype.strokeText = () => {}
    })
  // ?horsligne : le contenu LIVRÉ fait foi, aucun appel à l'API (que le bac
  // à sable ne joint pas de toute façon)
  await page.goto(`http://127.0.0.1:${serveur.port}/?tableau=${tableau}&horsligne${requete ? '&' + requete : ''}`, { waitUntil: 'load' })
  const cdp = await page.context().newCDPSession(page)

  const pasNu = (n = 1) =>
    page.evaluate(
      async ([n, dt]) => {
        for (let i = 0; i < n; i++) await window.__pas(dt)
      },
      [n, DT],
    )

  // le module du jeu se charge à la demande (src/amorce.ts) : on pompe
  // l'horloge jusqu'à ce que sa sonde apparaisse
  for (let i = 0; i < 600; i++) {
    await pasNu(1)
    if (await page.evaluate(() => !!window.__sim && !!document.getElementById('start'))) break
    await page.waitForTimeout(50)
  }
  // L'ENTRÉE, comme un joueur : signer le protocole, puis COMMENCER. On ne
  // dessine PAS d'image entre les deux — le voile de signature floute le jeu
  // derrière lui (backdrop-filter), et ce flou-là coûte des secondes par
  // image au rendu logiciel.
  await page.evaluate(() => {
    const sig = document.getElementById('signature')
    if (sig && !sig.hidden) {
      document.getElementById('sig-nom').value = 'S21'
      document.getElementById('sig-valider').click()
    }
  })
  await page.evaluate((g) => {
    window.__clipSeme(g) // même hasard à partir d'ici, quel qu'ait été le chargement
    document.getElementById('start').click()
  }, graine)
  if (css) await page.addStyleTag({ content: css })
  dit('en jeu :', await page.evaluate(() => document.body.className))

  let ffmpeg = null
  let finFfmpeg = null
  let sonDebut = 0
  let images = 0
  let visee = false
  let dernier = { x: 0, y: 0 }
  // LES GESTES sont des événements de pointeur posés DANS la page, sur le
  // canvas du jeu, et non des mouvements de vraie souris. Chromium aligne
  // les déplacements de souris sur ses images réelles : sous charge, un
  // déplacement pouvait arriver une image pilotée trop tard, et deux
  // tournages du même scénario divergeaient (vécu le 11/11 : la ressaisie
  // tournée pendant un montage n'était plus celle de son aperçu). Un
  // événement dispatché à la main est traité sur-le-champ, toujours.
  const pointeur = (type, x, y) =>
    page.evaluate(
      ([type, x, y]) => {
        document.getElementById('glcanvas').dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            button: type === 'pointermove' ? -1 : 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: x,
            clientY: y,
          }),
        )
      },
      [type, x, y],
    )
  let ancreDoigt = null // où le doigt est posé sur le corps, tant qu'il le tient

  const jeu = {
    page,
    largeur,
    hauteur,
    dit,
    get images() {
      return images
    },

    /** Avance d'une image (ou de n), sans filmer. */
    pas: pasNu,

    /** Avance d'UNE image, la photographie si on filme, et rend l'état du
     *  monde — un seul aller-retour avec la page par image. */
    async image({ cam } = {}) {
      const etat = await page.evaluate(
        async ([dt, cam]) => {
          if (cam) window.__clipCadre(cam)
          await window.__pas(dt)
          return window.__clipEtat ? window.__clipEtat() : null
        },
        [DT, cam ?? null],
      )
      if (ffmpeg) {
        // `clip` à l'échelle de la densité : sans lui, la capture CDP sort en
        // pixels CSS (540×960) — mesuré identique à page.screenshot (PSNR
        // infini) et deux fois et demie plus rapide (256 ms contre 661)
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          optimizeForSpeed: true,
          clip: { x: 0, y: 0, width: largeur, height: hauteur, scale: densite },
        })
        const tampon = Buffer.from(data, 'base64')
        if (!ffmpeg.stdin.write(tampon)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
        images++
      }
      return etat
    },

    /** L'état du monde, sans avancer. */
    etat: () => page.evaluate(() => window.__clipEtat()),

    /** Exécute du code dans la page (réglages, sondes). */
    dans: (f, arg) => page.evaluate(f, arg),

    /** Monde → pixels CSS de la fenêtre, avec la caméra de MAINTENANT. */
    async versEcran(x, y) {
      const c = await page.evaluate(() => ({ x: window.__cam.x, y: window.__cam.y, z: window.__cam.zoom }))
      return { x: largeur / 2 + (x - c.x) * c.z, y: hauteur / 2 - (y - c.y) * c.z }
    },

    /** Pose (ou déplace) le pointeur sur un point de l'ÉCRAN, bouton tenu :
     *  le corps éjecte vers ce point et part à l'opposé. */
    async viseEcran(x, y) {
      const px = Math.max(2, Math.min(largeur - 2, x))
      const py = Math.max(2, Math.min(hauteur - 2, y))
      await pointeur(visee ? 'pointermove' : 'pointerdown', px, py)
      visee = true
      dernier = { x: px, y: py }
    },

    /** Pose le pointeur sur un point du MONDE. */
    async vise(x, y) {
      const e = await jeu.versEcran(x, y)
      await jeu.viseEcran(e.x, e.y)
    },

    /** Pose le pointeur SUR le corps et le tient : le geste se retourne
     *  vers l'intérieur, le corps se rassemble (solver.ts, rassemble).
     *  `ou: 'centre'` vise la particule la plus proche du centre de masse —
     *  pas le centre lui-même : sur un corps étiré en arc il tombe dans le
     *  vide, et le jeu n'y verrait qu'une éjection. `ou: 'bout'` vise le
     *  bout le plus étiré, la particule la plus loin du centre (le
     *  concepteur, 11/11 : « ne clique pas au centre mais plutôt sur le bout
     *  étiré »). Une fois posé, le doigt SUIT : à chaque image il reste sur
     *  la particule la plus proche de là où il était — il accompagne le
     *  bout qui revient au lieu de sauter d'un point à l'autre. */
    async toucheCorps({ ou = 'centre' } = {}) {
      const p = await page.evaluate(
        ([ou, ancre]) => {
          const s = window.__sim
          // tenu : on colle à l'endroit d'avant ; posé : le centre ou le bout
          const cx = ancre ? ancre.x : s.stats.centroidX
          const cy = ancre ? ancre.y : s.stats.centroidY
          const loin = !ancre && ou === 'bout'
          let mieux = null
          let d2 = loin ? -1 : Infinity
          for (let i = 0; i < s.count; i++) {
            if (s.kind[i] !== 1 || s.gaseous[i] === 1) continue // 1 : KIND_PLAYER
            const d = (s.posX[i] - cx) ** 2 + (s.posY[i] - cy) ** 2
            if (loin ? d > d2 : d < d2) {
              d2 = d
              mieux = { x: s.posX[i], y: s.posY[i] }
            }
          }
          return mieux
        },
        [ou, ancreDoigt],
      )
      if (!p) return
      ancreDoigt = p
      await jeu.vise(p.x, p.y)
      // LE DOIGT. Le jeu ne dessine rien là où l'on touche, et un corps qui
      // se rassemble « tout seul » ne raconte pas le geste. On pose donc un
      // anneau discret sous le pointeur, le temps du toucher — c'est le seul
      // élément du film qui ne vient pas du jeu (comme le rond des captures
      // d'écran de téléphone). `doigt: false` à l'ouverture le retire.
      if (doigt) {
        const e = await jeu.versEcran(p.x, p.y)
        await page.evaluate(([x, y]) => {
          let d = document.getElementById('clip-doigt')
          if (!d) {
            d = document.createElement('div')
            d.id = 'clip-doigt'
            d.style.cssText =
              'position:fixed;z-index:99;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;' +
              'border:2px solid rgba(214,232,245,.85);background:rgba(214,232,245,.14);box-shadow:0 0 14px rgba(99,183,230,.55);' +
              'opacity:0;transition:opacity .12s linear'
            document.body.appendChild(d)
          }
          d.style.left = x + 'px'
          d.style.top = y + 'px'
          d.style.opacity = '1'
        }, [e.x, e.y])
      }
    },

    async lache() {
      if (!visee) return
      await pointeur('pointerup', dernier.x, dernier.y)
      visee = false
      ancreDoigt = null
      await page.evaluate(() => {
        const d = document.getElementById('clip-doigt')
        if (d) d.style.opacity = '0'
      })
    },

    touche: (k) => page.keyboard.press(k),

    /** Démarre l'enregistrement : chaque image() suivante part dans le film. */
    filme(sortie) {
      fs.mkdirSync(path.dirname(sortie), { recursive: true })
      // un intermédiaire quasi sans perte (crf 6, 4:4:4) : le montage le
      // recompresse une seule fois, à la fin
      ffmpeg = spawn(
        'ffmpeg',
        ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(IPS), '-c:v', 'png', '-i', '-',
          // la matrice BT.709, DITE : sans elle ffmpeg convertit le RVB en
          // BT.601 sans l'écrire, et un lecteur qui suppose 709 pour de la HD
          // décale les bleus du jeu vers le vert
          '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv444p',
          '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '6', sortie],
        { stdio: ['pipe', 'inherit', 'inherit'] },
      )
      finFfmpeg = new Promise((r) => ffmpeg.on('close', r))
      images = 0
      return page.evaluate(() => window.__sonInstant()).then((s) => {
        sonDebut = s
        jeu.sortie = sortie
      })
    },

    /** Arrête le film et écrit la piste son du jeu à côté (même nom, .wav). */
    async coupe() {
      if (!ffmpeg) return null
      ffmpeg.stdin.end()
      await finFfmpeg
      ffmpeg = null
      const sonFin = sonDebut + images / IPS
      const wav = await page.evaluate(([a, b]) => window.__sonWav(a, b), [sonDebut, sonFin])
      const bilan = { video: jeu.sortie, images, secondes: images / IPS, son: null, crete: 0 }
      if (wav) {
        bilan.son = jeu.sortie.replace(/\.\w+$/, '.wav')
        bilan.crete = wav.crete
        fs.writeFileSync(bilan.son, Buffer.from(wav.base64, 'base64'))
      }
      dit('film :', JSON.stringify(bilan))
      return bilan
    },

    async capture(fichier) {
      fs.mkdirSync(path.dirname(fichier), { recursive: true })
      await page.screenshot({ path: fichier })
    },

    async ferme() {
      await navigateur.close().catch(() => {})
      ecran.ferme()
      serveur.ferme()
    },
  }

  // La sonde d'état, lue à chaque image par les scénarios.
  await page.evaluate(() => {
    // LE CADRE DU CLIP. { z } seul : le jeu continue de suivre le corps, on
    // ne fixe que le zoom. { x, y, z } : le scénario tient toute la caméra.
    // { libre: true } rend la main au jeu.
    window.__clipCadre = (cam) => {
      const c = window.__cam
      // Le cadre s'impose APRÈS le calcul de la caméra du jeu, pas à sa
      // place : son plan d'ouverture continue de tourner dessous, et c'est
      // lui qui retient l'impulsion de départ des salles à puits. Le
      // scénario décide donc de l'image du lancer ({ lance: true }) sans
      // que le cadre saute quand le plan d'ouverture rend la main.
      if (!c.__clip) {
        const calcule = c.update.bind(c)
        c.update = (...a) => {
          calcule(...a)
          const k = window.__clipCam
          if (!k) return
          if (k.x !== undefined) {
            c.x = k.x
            c.y = k.y
          }
          if (k.z) c.zoom = k.z
        }
        c.__clip = true
      }
      window.__clipCam = cam.libre ? null : cam
      if (cam.lance) c.cancelIntro()
    }
    /** La salle telle que la caméra la connaît : centre et dimensions. */
    window.__clipSalle = () => {
      const c = window.__cam
      return { x: c.introX, y: c.introY, l: c.nivL, h: c.nivH }
    }
    window.__clipEtat = () => {
      const s = window.__sim
      const c = window.__cam
      const st = s.stats
      return {
        t: window.__t(),
        x: st.centroidX,
        y: st.centroidY,
        vx: st.velX,
        vy: st.velY,
        r: st.rmsRadius,
        n: st.count,
        cam: { x: c.x, y: c.y, z: c.zoom },
        // la jauge, telle que le joueur la lit
        litres: document.querySelector('#hud .ath-vital')?.innerText?.split('\n')[0] ?? '',
        disperse: !!s.dispersed,
        // la part du corps prise en glace, et celle passée en vapeur
        gel: (() => {
          let g = 0
          for (let i = 0; i < st.count && i < s.frozen.length; i++) if (s.frozen[i]) g++
          return s.count ? g / s.count : 0
        })(),
        gaz: (() => {
          let g = 0
          for (let i = 0; i < s.count; i++) if (s.gaseous && s.gaseous[i]) g++
          return s.count ? g / s.count : 0
        })(),
        tout: s.count,
        rassemble: !!window.__rass,
        salle: window.__run ? window.__run.tableauTime : 0,
      }
    }
  })
  return jeu
}
