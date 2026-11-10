// TOURNER UNE SCÈNE — `node tools/clips/tourne.mjs <scène> [--apercu]`
//
// --apercu : la même partie (le hasard est semé, les gestes visent des
// points du MONDE et non de l'écran) à la densité 1 — 540×960, la mise en
// page de l'interface est celle du film final, quatre fois moins de pixels —
// avec une planche d'images à côté. Une minute au lieu de dix : on règle
// sur l'aperçu, on tourne en grand une fois.

import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ouvre } from './pilote.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))
export const SORTIE = process.env.CLIPS_SORTIE || path.resolve(ICI, '../../clips-sortie')

/** Les calques d'interface qu'un plan « propre » retire : le clip montre le
 *  corps et la salle, le texte vient du montage. */
export const MASQUES = {
  tout: '#hud,#statebar,#trophee-toast,#obj-arrow,#voie-carte,#touchbar,#world-labels',
  // la jauge reste : c'est elle qui prouve « se déplacer, c'est rétrécir »
  jauge: '#hud .ath-etat,#statebar,#trophee-toast,#obj-arrow,#voie-carte,#touchbar,#world-labels',
}
const css = (liste) => `${liste}{display:none!important}`

const nom = process.argv[2]
const apercu = process.argv.includes('--apercu')
if (!nom) {
  console.log('scènes :', fs.readdirSync(path.join(ICI, 'scenes')).map((f) => f.replace('.mjs', '')).join(', '))
  process.exit(1)
}
const scene = (await import(`./scenes/${nom}.mjs`)).default
const jeu = await ouvre({
  tableau: scene.tableau ?? 1,
  largeur: 540,
  hauteur: 960,
  densite: apercu ? 1 : 2,
  dureeSon: scene.dureeSon ?? 120,
  // module2d=0 : autour de la salle, le ciel étoilé plutôt que le plan du
  // module — en essai, ses cellules fermées se dessinent barrées d'une croix
  // rouge, qu'un spectateur lit comme une image manquante
  requete: scene.requete ?? 'module2d=0',
  css: css(MASQUES[scene.masque ?? 'tout']) + (scene.css ?? ''),
})
jeu.apercu = apercu
// la fiche d'accueil se retire en fondu : on la laisse finir avant tout
await jeu.pas(40)
const fichier = path.join(SORTIE, apercu ? 'apercu' : 'brut', `${nom}.mkv`)
try {
  await scene.tourne(jeu, fichier)
} finally {
  const bilan = await jeu.coupe()
  await jeu.ferme()
  if (bilan && apercu) {
    // une image toutes les demi-secondes, en planche : l'aperçu se lit d'un coup d'œil
    const planche = fichier.replace('.mkv', '.png')
    const pas = Math.max(1, Math.round(bilan.images / 24))
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', fichier, '-vf', `select='not(mod(n,${pas}))',scale=270:-1,tile=8x3`, '-frames:v', '1', planche])
    console.log('planche :', planche)
  }
}
