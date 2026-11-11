// LE MONTAGE — `node tools/clips/montage.mjs <scène>`
//
// Prend le film brut et la piste son d'une scène (tourne.mjs) et livre un
// fichier prêt pour TikTok, Reels et Shorts (1080×1920, 60 i/s, H.264 + AAC) :
//   final/<scène>.mp4   le plan, sa ligne de marque, le son du jeu
//   final/<scène>.txt   la légende et les mots-dièse, à coller
// Une scène qui porte des textes (montage.textes) sort en plus
// final/<scène>-sans-texte.mp4, le même plan nu.
//
// LE CARTON DE FIN. Le concepteur (11/11) : « il faut peut-être mettre
// quelque chose à la fin, écran noir avec étoiles, et marqué le titre ».
// Premier essai : un fondu enchaîné de 0,4 s vers le ciel, puis le titre en
// fondu. Verdict du concepteur : « pas génial ». Trois défauts, à l'analyse :
// le fondu enchaîné superpose deux images sombres (la salle et le ciel), ce
// qui se lit comme un voile gris, pas comme un passage ; le titre arrivait
// par un SECOND fondu, deux transitions molles d'affilée ; et le son tombait
// au silence au même instant, laissant le carton vide.
// D'où la fin actuelle : COUPE FRANCHE, une seconde avant la fin du plan
// (« tu peux couper 1 seconde avant ») — on quitte l'action pendant qu'elle
// vit encore —, le titre est là en deux dixièmes, et le son de la scène
// CONTINUE sous le carton pendant la seconde coupée, puis s'éteint.
// `--noir` (ou montage.transition: 'noir') donne l'autre grammaire : le plan
// s'éteint au noir, le carton s'en relève.
// `montage: { carton: false }` retire le carton (et rend sa ligne de marque
// au plan) — c'est ce qu'il faut à une boucle, que le carton interrompt.
//
// LES TEXTES sont dessinés par le navigateur, pas par ffmpeg : mêmes polices
// que le jeu (Michroma, IBM Plex Mono — celles de dist/), même palette
// (docs/charte-visuelle.md). Une image transparente par texte, que ffmpeg
// pose avec un fondu.
//
// LES MARGES. TikTok recouvre le haut (onglets), le bas (légende, musique)
// et la droite (boutons). Tout ce qui s'écrit tient dans le bandeau du haut,
// entre 140 et 345 px, à 70 px des bords : la marque sur une ligne, le
// texte dessous. Les scènes cadrent la salle SOUS ce bandeau.

import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../..')
const SORTIE = process.env.CLIPS_SORTIE || path.resolve(RACINE, 'clips-sortie')
const { chromium } = createRequire(import.meta.url)('playwright')
const L = 1080
const H = 1920

// `montage.mjs <scène> jauge` monte la variante tournée avec --jauge
const drapeaux = process.argv.slice(3).filter((x) => x.startsWith('--'))
const variante = process.argv.slice(3).find((x) => !x.startsWith('--'))
const scene = (await import(`./scenes/${process.argv[2]}.mjs`)).default
const nom = process.argv[2] + (variante ? `-${variante}` : '')
const m = scene.montage ?? {}
const brut = path.join(SORTIE, 'brut', `${nom}.mkv`)
const son = path.join(SORTIE, 'brut', `${nom}.wav`)
const dossier = path.join(SORTIE, 'final')
const tmp = path.join(SORTIE, 'textes', nom)
fs.mkdirSync(dossier, { recursive: true })
fs.mkdirSync(tmp, { recursive: true })

const dureeBrute = Number(
  execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', '-select_streams', 'v:0', brut]).toString().trim(),
) / 60
// LES COUPES. Une scène peut laisser à côté de son film un fichier .json
// { garde: [[début, fin], …] } en secondes : seuls ces passages sont montés,
// bout à bout. C'est une coupe franche de monteur — le jeu laisse parfois
// huit secondes entre le dernier souffle du corps et son panneau de fin, et
// huit secondes de vide ne se regardent pas.
const fCoupes = brut.replace(/\.mkv$/, '.json')
// (bornées au film : une scène qui s'arrête un peu tôt ne doit pas faire
// compter des images qui n'existent pas)
const garde = fs.existsSync(fCoupes)
  ? JSON.parse(fs.readFileSync(fCoupes, 'utf8')).garde.map(([a, b]) => [Math.max(0, a), Math.min(dureeBrute, b)])
  : null
const duree = garde ? garde.reduce((s, [a, b]) => s + (Math.round(b * 60) - Math.round(a * 60)) / 60, 0) : dureeBrute

// ---- les images des textes --------------------------------------------------
const polices = path.join(RACINE, 'dist/assets/fonts')
// en data: — une page posée par setContent n'a pas d'origine, et le
// navigateur lui refuse les polices en file:// : sans cela le texte tombait
// en silence sur la police du système
const police = (famille, fichier, graisse) =>
  `@font-face{font-family:'${famille}';font-weight:${graisse};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(polices, fichier)).toString('base64')}) format('woff2')}`
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const page = (corps) => `<!doctype html><meta charset="utf-8"><style>
${police('Michroma', 'michroma-400-latin.woff2', 400)}
${police('Plex', 'plex-mono-600-latin.woff2', 600)}
html,body{margin:0;width:${L}px;height:${H}px;background:transparent;overflow:hidden}
.bloc{position:absolute;left:70px;right:70px;text-align:center}
.titre{font:400 50px/1.27 'Michroma',sans-serif;color:#eef7fd;letter-spacing:.04em;text-transform:uppercase;
  text-shadow:0 0 22px rgba(3,7,16,.95),0 0 8px rgba(3,7,16,.95),0 3px 3px rgba(3,7,16,.9)}
.titre b{font-weight:400;color:#63b7e6}
.sous{margin-top:20px;font:600 31px/1.35 'Plex',monospace;color:#bfe0f3;letter-spacing:.06em;
  text-shadow:0 0 14px rgba(3,7,16,1),0 0 6px rgba(3,7,16,1),0 2px 2px rgba(3,7,16,.9)}
.trait{width:96px;height:4px;margin:20px auto 0;background:#63b7e6;box-shadow:0 0 14px rgba(99,183,230,.8)}
.marque{position:absolute;left:0;right:0;text-align:center;font:600 21px/1 'Plex',monospace;letter-spacing:.34em;
  color:#63b7e6;text-shadow:0 0 10px rgba(3,7,16,1),0 0 4px rgba(3,7,16,1)}
.marque b{font:400 21px/1 'Michroma',sans-serif;color:#eef7fd;letter-spacing:.24em}
</style>${corps}`
// **mot** dans un titre : le mot passe au cyan de la charte
const riche = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')
const blocTexte = (t) =>
  `<div class="bloc" style="top:${t.y ?? 186}px"><div class="titre">${riche(t.titre)}</div>` +
  (t.sous ? `<div class="sous">${riche(t.sous)}</div>` : '') +
  (t.trait === false ? '' : '<div class="trait"></div>') +
  `</div>`
const blocMarque = (y) => `<div class="marque" style="top:${y}px"><b>SUJET 21</b> · TENSION DE SURFACE</div>`

// LE CIEL DU CARTON : dessiné, pas photographié — un noir d'encre (la nuit de
// la charte, #030710) et des étoiles posées par un hasard SEMÉ : le même
// ciel à chaque montage, net au pixel. Une lueur très faible derrière le
// titre, celle de la capsule Steam.
const cielCarton = () => {
  let g = 21
  const alea = () => {
    g = (g + 0x6d2b79f5) >>> 0
    let x = g
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  let etoiles = ''
  for (let i = 0; i < 520; i++) {
    const x = (alea() * L).toFixed(1)
    const y = (alea() * H).toFixed(1)
    const k = alea()
    // beaucoup de poussière, quelques étoiles franches
    const r = k > 0.985 ? 2.6 : k > 0.93 ? 1.7 : k > 0.6 ? 1.1 : 0.7
    const o = (k > 0.93 ? 0.95 : 0.25 + alea() * 0.5).toFixed(2)
    const c = alea() > 0.82 ? '#a7ddf5' : alea() > 0.9 ? '#f2e3c9' : '#eef7fd'
    etoiles += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" style="position:absolute;inset:0">${etoiles}</svg>`
}
const pageCarton = (fond) =>
  page(
    `<style>
html,body{background:${fond ? '#030710' : 'transparent'}}
.lueur{position:absolute;left:50%;top:860px;width:1500px;height:1100px;margin:-550px 0 0 -750px;
  background:radial-gradient(closest-side,rgba(24,58,92,.55),rgba(10,24,40,.25) 55%,rgba(3,7,16,0) 100%)}
.nom{position:absolute;left:0;right:0;top:770px;text-align:center;font:400 104px/1 'Michroma',sans-serif;color:#eef7fd;
  letter-spacing:.1em;padding-left:.1em;text-shadow:0 0 34px rgba(99,183,230,.35)}
.filet{position:absolute;left:50%;top:912px;width:120px;height:4px;margin-left:-60px;background:#63b7e6;box-shadow:0 0 16px rgba(99,183,230,.8)}
.sousnom{position:absolute;left:0;right:0;top:948px;text-align:center;font:600 32px/1 'Plex',monospace;color:#63b7e6;
  letter-spacing:.46em;padding-left:.46em}
</style>` +
      (fond
        ? `<div class="lueur"></div>${cielCarton()}`
        : `<div class="nom">SUJET 21</div><div class="filet"></div><div class="sousnom">TENSION DE SURFACE</div>`),
  )

const textes = m.textes ?? []
const avecCarton = m.carton !== false
const CARTON = 2.2 // secondes
const transition = drapeaux.includes('--noir') ? 'noir' : (m.transition ?? 'coupe')
// ce qu'on retire à la fin du plan avant le carton — et, en coupe franche,
// ce pendant quoi le son de la scène continue dessous
const ROGNE = avecCarton ? (m.rogne ?? 1) : 0
const NOIR = 0.3 // la durée de chaque demi-fondu de la variante « noir »
const nav = await chromium.launch()
const pg = await nav.newPage({ viewport: { width: L, height: H } })
const calques = []
const dessine = async (html, fichier) => {
  await pg.setContent(page(html))
  await pg.evaluate(() => document.fonts.ready)
  await pg.screenshot({ path: fichier, omitBackground: true })
}
for (const [i, t] of textes.entries()) {
  const f = path.join(tmp, `t${i}.png`)
  await dessine(blocTexte(t), f)
  calques.push({ f, de: t.de, a: t.a ?? duree })
}
const marque = path.join(tmp, 'marque.png')
await dessine(blocMarque(m.marqueY ?? 146), marque)
const cartonFond = path.join(tmp, 'carton-fond.png')
const cartonTitre = path.join(tmp, 'carton-titre.png')
if (avecCarton) {
  await pg.setContent(pageCarton(true))
  await pg.evaluate(() => document.fonts.ready)
  await pg.screenshot({ path: cartonFond })
  await pg.setContent(pageCarton(false))
  await pg.evaluate(() => document.fonts.ready)
  await pg.screenshot({ path: cartonTitre, omitBackground: true })
}
await nav.close()
const plan = duree - ROGNE // ce qui reste du plan à l'image
const total = avecCarton ? plan + CARTON : duree

// ---- l'assemblage -------------------------------------------------------------
function assemble(sortie, avecTextes) {
  const args = ['-y', '-loglevel', 'error', '-i', brut]
  const aSon = fs.existsSync(son)
  if (aSon) args.push('-i', son)
  let n = aSon ? 2 : 1
  const filtres = []
  let v = '0:v'
  let a0 = '1:a'
  if (garde) {
    const img = garde.map(([a, b]) => `between(n,${Math.round(a * 60)},${Math.round(b * 60) - 1})`).join('+')
    const sec = garde.map(([a, b]) => `between(t,${a.toFixed(4)},${(b - 1e-4).toFixed(4)})`).join('+')
    filtres.push(`[0:v]select='${img}',setpts=N/(60*TB)[vg]`)
    v = 'vg'
    if (aSon) {
      filtres.push(`[1:a]aselect='${sec}',asetpts=N/SR/TB[ag]`)
      a0 = 'ag'
    }
  }
  const pose = (c, fondu = 0.22) => {
    args.push('-loop', '1', '-framerate', '60', '-t', String(duree), '-i', c.f)
    const k = n++
    const entree = c.de > 0.01 ? `fade=t=in:st=${c.de}:d=${fondu}:alpha=1,` : ''
    const sortieF = c.a < duree - 0.01 ? `fade=t=out:st=${(c.a - fondu).toFixed(3)}:d=${fondu}:alpha=1,` : ''
    filtres.push(`[${k}:v]format=rgba,${entree}${sortieF}null[c${k}]`)
    filtres.push(`[${v}][c${k}]overlay=0:0:format=auto:enable='between(t,${c.de},${c.a})'[v${k}]`)
    v = `v${k}`
  }
  if (avecTextes) for (const c of calques) pose(c)
  // la marque reste, discrète, du début à la fin, AU-DESSUS du texte : pas
  // de carton de fin (il casserait la boucle, et c'est la seconde où l'on
  // décroche), et pas en bas, où la légende de TikTok la recouvrirait
  // (avec un carton de fin, la marque n'y est plus par défaut : le titre
  // arrive à la fin ; `marque: true` la remet)
  if (m.marque ?? !avecCarton) pose({ f: marque, de: 0, a: duree })
  if (avecCarton) {
    args.push('-loop', '1', '-framerate', '60', '-t', String(CARTON), '-i', cartonFond)
    const kf = n++
    args.push('-loop', '1', '-framerate', '60', '-t', String(CARTON), '-i', cartonTitre)
    const kt = n++
    const noir = transition === 'noir'
    // coupe franche : le titre est là presque aussitôt ; au noir : il attend
    // que le ciel se soit relevé
    filtres.push(`[${kt}:v]format=rgba,fade=t=in:st=${noir ? NOIR + 0.1 : 0.04}:d=${noir ? 0.4 : 0.2}:alpha=1[ct]`)
    filtres.push(
      `[${kf}:v][ct]overlay=0:0:format=auto,fps=60,format=yuv444p,settb=AVTB,setsar=1${noir ? `,fade=t=in:st=0:d=${NOIR}` : ''}[carton]`,
    )
    filtres.push(
      `[${v}]trim=duration=${plan.toFixed(4)},setpts=PTS-STARTPTS,fps=60,format=yuv444p,settb=AVTB,setsar=1${noir ? `,fade=t=out:st=${(plan - NOIR).toFixed(4)}:d=${NOIR}` : ''}[plan]`,
    )
    filtres.push(`[plan][carton]concat=n=2:v=1:a=0[vx]`)
    v = 'vx'
  }
  filtres.push(`[${v}]format=yuv420p[vf]`)
  if (aSon) {
    // −15 LUFS : le niveau où une vidéo ne paraît ni faible ni écrasée à
    // côté des autres dans le fil.
    // Sans carton : un fondu de sortie pour que la boucle ne claque pas.
    // Coupe franche : le son COURT sous le carton pendant la seconde rognée,
    // et s'éteint sur ses huit derniers dixièmes. Au noir : il s'éteint avec
    // l'image.
    const finSon = !avecCarton ? duree : transition === 'noir' ? plan : duree
    const queue = !avecCarton ? 0.3 : transition === 'noir' ? NOIR : Math.min(0.8, ROGNE)
    filtres.push(
      `[${a0}]atrim=duration=${finSon.toFixed(4)},afade=t=in:d=0.06,afade=t=out:st=${(finSon - queue).toFixed(3)}:d=${queue},loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000,apad=whole_dur=${total.toFixed(4)}[af]`,
    )
  }
  args.push('-filter_complex', filtres.join(';'), '-map', '[vf]')
  if (aSon) args.push('-map', '[af]', '-c:a', 'aac', '-b:a', '256k')
  args.push(
    '-t', total.toFixed(4), '-r', '60',
    // crf 15 en preset slow : ~20 Mbit/s sur ces images sombres. TikTok
    // recompresse tout — on lui donne une source où il n'y a rien à abîmer.
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level', '4.2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', sortie,
  )
  execFileSync('ffmpeg', args, { stdio: 'inherit' })
  const ko = Math.round(fs.statSync(sortie).size / 1024)
  console.log(`${path.basename(sortie)} : ${total.toFixed(2)} s${avecCarton ? ` (plan ${plan.toFixed(2)} s + carton, ${transition})` : ''}, ${ko} Ko`)
}
// la légende et les mots-dièse voyagent avec le clip : à coller tels quels
if (scene.publication) {
  fs.writeFileSync(path.join(dossier, `${nom}.txt`), `${scene.publication.legende}\n\n${scene.publication.mots.join(' ')}\n`)
}
assemble(path.join(dossier, `${nom}${drapeaux.includes('--noir') ? '-noir' : ''}.mp4`), true)
// une scène sans texte n'a qu'une version : la seconde serait la même
if (textes.length > 0) assemble(path.join(dossier, `${nom}-sans-texte.mp4`), false)
