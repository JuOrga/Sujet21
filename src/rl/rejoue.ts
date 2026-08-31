// ---------------------------------------------------------------------------
// REJOUER — regarder ce qu'une politique fait vraiment, tableau par tableau.
//
//   pnpm rl:rejoue --politique .rl/politique.json --tableaux 21-01,21-A
//   pnpm rl:rejoue --pilote cap        # la référence écrite à la main
//   pnpm rl:rejoue --pilote hasard     # le plancher
//
// `--trace fichier.json` écrit la suite des décisions : de quoi rejouer la
// traversée ailleurs (ou la comparer entre deux politiques).
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { EnvSujet21, joue, tableauxRL, type Fin } from './env'
import { piloteCap, piloteHasard } from './pilotes'
import { decideurDepuis } from './politique'

const argv = process.argv.slice(2)
const get = (nom: string, def: string): string => {
  const i = argv.indexOf(`--${nom}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const num = (nom: string, def: number): number => Number(get(nom, String(def)))

const codes = get('tableaux', '21-01')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const particules = num('particules', 900)
const duree = num('duree', 90)
const pasParDecision = num('pas', 12)
const fichierTrace = get('trace', '')

// Le pilote d'ici reçoit l'environnement complet (il peut donc lire
// l'observation) ; ceux de pilotes.ts se contentent de la vue minimale.
type PiloteLocal = (env: EnvSujet21) => number

function politiqueChoisie(): { nom: string; pilote: PiloteLocal } {
  const fichier = get('politique', '')
  if (fichier) {
    const brut = JSON.parse(readFileSync(fichier, 'utf8')) as {
      type?: string
      tailleObs: number
      tailles?: number[]
      poids: number[]
    }
    const charge = decideurDepuis(brut)
    return {
      nom: `${fichier} (${charge.genre})`,
      pilote: (env) => charge.decide(env.observe()),
    }
  }
  const nom = get('pilote', 'cap')
  if (nom === 'hasard') return { nom: 'hasard', pilote: piloteHasard(num('graine', 1)) }
  return { nom: `cap(${num('vitesse', 40)})`, pilote: piloteCap(num('vitesse', 40)) }
}

const { nom, pilote } = politiqueChoisie()
const liste = codes[0] === 'tous' ? tableauxRL().map((l) => l.code) : codes
console.log(`Politique : ${nom} · ${particules} particules · essai de ${duree} s`)
console.log('tableau |       fin |   litres |  chrono | décisions')

const traces: Record<string, number[]> = {}
let total = 0
let reussites = 0
for (const code of liste) {
  const env = new EnvSujet21({ code, particules, dureeMax: duree, pasParDecision })
  const actions: number[] = []
  const r = joue(
    env,
    () => pilote(env),
    (a) => actions.push(a),
  )
  traces[code] = actions
  total += r.score
  if (r.fin === 'sas' || r.fin === 'conclu') reussites++
  console.log(
    `${code.padEnd(7)} | ${(r.fin as Fin).padStart(9)} | ${r.score.toFixed(2).padStart(6)} L | ` +
      `${r.etat.temps.toFixed(1).padStart(6)} s | ${String(r.pas).padStart(9)}`,
  )
}
console.log(
  `\n${reussites}/${liste.length} traversée(s) · ${total.toFixed(2)} L au total ` +
    `(${(total / liste.length).toFixed(2)} L en moyenne)`,
)
if (fichierTrace) {
  mkdirSync(dirname(fichierTrace), { recursive: true })
  writeFileSync(fichierTrace, JSON.stringify({ politique: nom, traces }))
  console.log(`Trace écrite dans ${fichierTrace}`)
}
