// LE MONTAGE — `node tools/clips/montage.mjs <scène>`
//
// Prend le film brut et la piste son d'une scène (tourne.mjs) et livre un
// fichier prêt pour TikTok, Reels et Shorts (1080×1920, 60 i/s, H.264 + AAC) :
//   final/<scène>.mp4   le plan, sa ligne de marque, le son du jeu
//   final/<scène>.txt   la légende et les mots-dièse, à coller
// Une scène qui porte des textes (montage.textes) sort en plus
// final/<scène>-sans-texte.mp4, le même plan nu.
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
const scene = (await import(`./scenes/${process.argv[2]}.mjs`)).default
const nom = process.argv[2] + (process.argv[3] ? `-${process.argv[3]}` : '')
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

const textes = m.textes ?? []
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
await nav.close()

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
  if (m.marque !== false) pose({ f: marque, de: 0, a: duree })
  filtres.push(`[${v}]format=yuv420p[vf]`)
  if (aSon) {
    // −15 LUFS : le niveau où une vidéo ne paraît ni faible ni écrasée à
    // côté des autres dans le fil ; un fondu de sortie pour que la boucle
    // ne claque pas
    filtres.push(`[${a0}]afade=t=in:d=0.06,afade=t=out:st=${(duree - 0.3).toFixed(3)}:d=0.3,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[af]`)
  }
  args.push('-filter_complex', filtres.join(';'), '-map', '[vf]')
  if (aSon) args.push('-map', '[af]', '-c:a', 'aac', '-b:a', '256k')
  args.push(
    '-t', String(duree), '-r', '60',
    // crf 15 en preset slow : ~20 Mbit/s sur ces images sombres. TikTok
    // recompresse tout — on lui donne une source où il n'y a rien à abîmer.
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level', '4.2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', sortie,
  )
  execFileSync('ffmpeg', args, { stdio: 'inherit' })
  const ko = Math.round(fs.statSync(sortie).size / 1024)
  console.log(`${path.basename(sortie)} : ${duree.toFixed(2)} s, ${ko} Ko`)
}
// la légende et les mots-dièse voyagent avec le clip : à coller tels quels
if (scene.publication) {
  fs.writeFileSync(path.join(dossier, `${nom}.txt`), `${scene.publication.legende}\n\n${scene.publication.mots.join(' ')}\n`)
}
assemble(path.join(dossier, `${nom}.mp4`), true)
// une scène sans texte n'a qu'une version : la seconde serait la même
if (textes.length > 0) assemble(path.join(dossier, `${nom}-sans-texte.mp4`), false)
