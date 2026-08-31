// ---------------------------------------------------------------------------
// LA COURBE — voir la progression, dans le terminal, pendant que ça tourne.
//
//   pnpm rl:courbe                                  # .rl/politique.json
//   pnpm rl:courbe --journal .rl/berceau.json       # un autre entraînement
//   pnpm rl:courbe --serie litres                   # ce qui est LIVRÉ au sas
//
// L'entraînement écrit son journal après CHAQUE génération : la courbe se
// lit en cours de route, sans attendre la fin. Trois séries : `retour` (ce
// que l'agent optimise), `litres` (le score du jeu, celui qui se compare aux
// records humains) et `traversees` (combien de politiques de la génération
// ont conclu leur tableau).
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import process from 'node:process'

interface Ligne {
  generation: number
  retourMoyen: number
  retourMax: number
  litresMax: number
  traversees: number
}

const argv = process.argv.slice(2)
const get = (nom: string, def: string): string => {
  const i = argv.indexOf(`--${nom}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}

const fichier = get('journal', '.rl/politique.json')
const serie = get('serie', 'retour')
const hauteur = Number(get('hauteur', '16'))
const largeur = Number(get('largeur', '72'))

const brut = JSON.parse(readFileSync(fichier, 'utf8')) as {
  journal?: Ligne[]
  reglages?: { tableaux: string[]; particules: number; duree: number }
  enCours?: boolean
}
const journal = brut.journal ?? []
if (journal.length === 0) {
  console.log(`${fichier} : aucun journal (l’entraînement n’a pas encore conclu de génération)`)
  process.exit(0)
}

// Les séries lisibles. `retour` en trace deux : la moyenne de la population
// (est-ce que TOUT LE MONDE progresse ?) et le meilleur de la génération
// (est-ce qu'une piste s'ouvre ?). Les deux disent des choses différentes :
// une moyenne qui monte sans meilleur qui monte, c'est une population qui
// se range derrière une prudence — souvent le signe d'une récompense qui
// paie l'immobilité.
const series: Record<string, { nom: string; traits: [string, (l: Ligne) => number][] }> = {
  retour: {
    nom: 'retour (récompense cumulée d’un essai)',
    traits: [
      ['moyenne  ·', (l) => l.retourMoyen],
      ['meilleur +', (l) => l.retourMax],
    ],
  },
  litres: {
    nom: 'litres livrés au sas par la meilleure politique',
    traits: [['litres +', (l) => l.litresMax]],
  },
  traversees: {
    nom: 'politiques ayant conclu leur tableau',
    traits: [['traversées +', (l) => l.traversees]],
  },
}
const choix = series[serie]
if (!choix) {
  console.error(`série inconnue : ${serie} (retour, litres, traversees)`)
  process.exit(1)
}

const marques = ['·', '+', '*']
const points = choix.traits.map(([, f]) => journal.map(f))
const toutes = points.flat()
let bas = Math.min(...toutes)
let haut = Math.max(...toutes)
if (haut - bas < 1e-9) {
  haut = bas + 1
  bas -= 1
}
const marge = (haut - bas) * 0.05
bas -= marge
haut += marge

const grille: string[][] = Array.from({ length: hauteur }, () =>
  Array.from({ length: largeur }, () => ' '),
)
// Le zéro se voit : sans lui, une courbe de récompenses négatives ressemble
// à une courbe de récompenses positives.
if (bas < 0 && haut > 0) {
  const l = Math.round(((haut - 0) / (haut - bas)) * (hauteur - 1))
  for (let c = 0; c < largeur; c++) grille[l][c] = '─'
}
points.forEach((serieY, s) => {
  serieY.forEach((y, i) => {
    const c =
      serieY.length === 1
        ? 0
        : Math.round((i / (serieY.length - 1)) * (largeur - 1))
    const l = Math.round(((haut - y) / (haut - bas)) * (hauteur - 1))
    grille[Math.max(0, Math.min(hauteur - 1, l))][c] = marques[s % marques.length]
  })
})

const r = brut.reglages
console.log(
  `${fichier}${brut.enCours ? ' (entraînement EN COURS)' : ''}` +
    (r ? ` · ${r.tableaux.join(', ')} · ${r.particules} particules · essais de ${r.duree} s` : ''),
)
console.log(`${choix.nom} — ${journal.length} générations\n`)
for (let l = 0; l < hauteur; l++) {
  const valeur = haut - ((haut - bas) * l) / (hauteur - 1)
  console.log(`${valeur.toFixed(2).padStart(8)} │${grille[l].join('')}`)
}
console.log(`${' '.repeat(8)} └${'─'.repeat(largeur)}`)
console.log(
  `${' '.repeat(9)}gén 1${' '.repeat(Math.max(1, largeur - 12))}gén ${journal.length}`,
)
console.log(
  `\nlégende : ${choix.traits.map(([nom], i) => `${marques[i % marques.length]} ${nom.replace(/[·+*]\s*$/, '').trim()}`).join('   ')}`,
)

const dernier = journal[journal.length - 1]
const meilleur = journal.reduce((a, b) => (b.litresMax > a.litresMax ? b : a))
console.log(
  `\ndernière génération : retour moyen ${dernier.retourMoyen.toFixed(2)} · ` +
    `meilleur ${dernier.retourMax.toFixed(2)} · ${dernier.litresMax.toFixed(2)} L · ` +
    `${dernier.traversees} traversée(s)`,
)
console.log(
  `record de litres : ${meilleur.litresMax.toFixed(2)} L à la génération ${meilleur.generation}`,
)
