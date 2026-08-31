// ---------------------------------------------------------------------------
// L'ENTRAÎNEMENT — « apprends à jouer, et montre-moi comment tu progresses ».
//
//   pnpm rl:entraine --tableaux 21-A --generations 20 --travailleurs 4
//
// À chaque génération : une population de politiques est tirée, chacune joue
// les tableaux demandés, l'élite recentre la loi. La courbe imprimée EST la
// progression — retour moyen, meilleur retour, litres livrés, taux de
// traversée. La meilleure politique est écrite sur disque (.rl/) et se
// rejoue avec `pnpm rl:rejoue`.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { EnvSujet21, joue, reussie, type OptionsEnv } from './env'
import { NoyauxWasm } from '../sim/wasm'
import {
  alea,
  apprendParImitation,
  cemDepart,
  cemEchantillon,
  cemRecentre,
  decide,
  nbParams,
  politiqueDepuis,
  type Exemple,
} from './politique'
import { piloteCap } from './pilotes'

interface Reglages {
  tableaux: string[]
  particules: number
  duree: number
  generations: number
  population: number
  elite: number
  graine: number
  ecart0: number
  bruit: number
  pasParDecision: number
  sortie: string
  travailleurs: number
  wasm: boolean
  depart: string
  tours: number
}

function lisArgs(argv: string[]): Reglages {
  const get = (nom: string, def: string): string => {
    const i = argv.indexOf(`--${nom}`)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def
  }
  const num = (nom: string, def: number): number => Number(get(nom, String(def)))
  return {
    tableaux: get('tableaux', '21-A').split(',').map((s) => s.trim()).filter(Boolean),
    particules: num('particules', 300),
    duree: num('duree', 45),
    generations: num('generations', 20),
    population: num('population', 24),
    elite: num('elite', 6),
    graine: num('graine', 1),
    ecart0: num('ecart', 0.5),
    bruit: num('bruit', 0.05),
    pasParDecision: num('pas', 12),
    sortie: get('sortie', '.rl/politique.json'),
    travailleurs: Math.max(1, num('travailleurs', 1)),
    wasm: argv.includes('--wasm'),
    depart: get('depart', 'zero'),
    tours: num('tours', 3),
  }
}

async function noyaux(actif: boolean): Promise<NoyauxWasm | null> {
  if (!actif) return null
  const buf = readFileSync(new URL('../../public/noyaux.wasm', import.meta.url))
  return NoyauxWasm.charge(new Uint8Array(buf).buffer as ArrayBuffer)
}

function construitEnvs(r: Reglages, wasm: NoyauxWasm | null): EnvSujet21[] {
  const commun: OptionsEnv = {
    particules: r.particules,
    dureeMax: r.duree,
    pasParDecision: r.pasParDecision,
    wasm,
  }
  return r.tableaux.map((code) => new EnvSujet21({ code, ...commun }))
}

export interface Verdict {
  retour: number // moyenne sur les tableaux
  score: number // litres livrés, en moyenne
  reussites: number // tableaux traversés
}

/** Une politique passe TOUS les tableaux demandés : sa note est la moyenne. */
export function evalue(envs: EnvSujet21[], poids: ArrayLike<number>): Verdict {
  const pol = politiqueDepuis(envs[0].tailleObs, poids)
  let retour = 0
  let score = 0
  let reussites = 0
  for (const env of envs) {
    const r = joue(env, (obs) => decide(pol, obs))
    retour += r.retour
    score += r.score
    if (reussie(r.fin)) reussites++
  }
  return {
    retour: retour / envs.length,
    score: score / envs.length,
    reussites,
  }
}

// ---- MODE TRAVAILLEUR : un processus qui ne fait qu'évaluer. Le parent lui
// envoie des poids en JSON par ligne, il répond une note par ligne. C'est le
// parallélisme le plus bête qui soit — et le seul qui traverse sans douleur
// la frontière TypeScript/Node.
async function travailleur(r: Reglages): Promise<void> {
  const envs = construitEnvs(r, await noyaux(r.wasm))
  const rl = createInterface({ input: process.stdin })
  process.stdout.write('{"pret":true}\n')
  for await (const ligne of rl) {
    if (!ligne.trim()) continue
    const job = JSON.parse(ligne) as { id: number; poids: number[] }
    const v = evalue(envs, job.poids)
    process.stdout.write(JSON.stringify({ id: job.id, ...v }) + '\n')
  }
}

class Equipe {
  private readonly enfants: ReturnType<typeof spawn>[] = []
  private readonly attentes = new Map<number, (v: Verdict) => void>()
  private prochain = 0
  private ferme_ = false

  constructor(nb: number, argv: string[]) {
    for (let i = 0; i < nb; i++) {
      // Le lanceur (vite-node) doit être remis dans la ligne de commande :
      // il efface le chemin du script de argv, on le lui redonne.
      const lanceur = process.argv[1] ?? ''
      const script = fileURLToPath(import.meta.url)
      const avant = lanceur.includes('vite-node') ? [lanceur, script] : [script]
      const enfant = spawn(
        process.execPath,
        [...avant, ...argv, '--mode-travailleur'],
        { stdio: ['pipe', 'pipe', 'inherit'] },
      )
      const rl = createInterface({ input: enfant.stdout! })
      rl.on('line', (ligne) => {
        const rep = JSON.parse(ligne) as { id?: number } & Verdict
        if (rep.id === undefined) return // « pret »
        this.attentes.get(rep.id)?.(rep)
        this.attentes.delete(rep.id)
      })
      // Un travailleur qui meurt laisserait le parent à attendre une note qui
      // ne viendra jamais : mieux vaut s'arrêter en le disant.
      enfant.on('exit', (code) => {
        if (this.ferme_) return
        console.error(`travailleur interrompu (code ${code}) — entraînement arrêté`)
        process.exit(1)
      })
      this.enfants.push(enfant)
    }
  }

  evalue(id: number, poids: Float64Array): Promise<Verdict> {
    const enfant = this.enfants[this.prochain++ % this.enfants.length]
    return new Promise<Verdict>((resolve) => {
      this.attentes.set(id, resolve)
      enfant.stdin!.write(
        JSON.stringify({ id, poids: Array.from(poids) }) + '\n',
      )
    })
  }

  ferme(): void {
    this.ferme_ = true
    for (const e of this.enfants) e.kill()
  }
}

function horodate(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

async function entraine(r: Reglages, argv: string[]): Promise<void> {
  const wasm = await noyaux(r.wasm)
  const envsLocaux = construitEnvs(r, wasm)
  const taille = nbParams(envsLocaux[0].tailleObs)
  // Le point de départ. « zero » : tout à plat, la recherche part de rien.
  // « cap » : on copie d'abord le pilote écrit à la main (imitation), et
  // l'optimisation repart de sa copie — la courbe démarre alors au niveau du
  // pilote, et ce qu'elle gagne ensuite, la machine l'a trouvé seule.
  const etat = cemDepart(taille, r.depart === 'zero' ? r.ecart0 : r.ecart0 * 0.3)
  if (r.depart === 'cap') {
    // ---- IMITATION, puis RATTRAPAGE (DAgger).
    // Copier les décisions du pilote sur SES trajectoires ne suffit pas : la
    // copie dérive au premier écart, se retrouve dans des situations que le
    // pilote n'a jamais traversées, et n'a rien appris à y faire. Le remède
    // classique est de recommencer sur SES PROPRES trajectoires à elle, en
    // demandant au pilote ce qu'il aurait fait à chaque instant — ici c'est
    // gratuit, le pilote est une fonction. Trois tours suffisent à voir la
    // différence, et le journal imprime ce que vaut la copie à chaque tour.
    const exemples: Exemple[] = []
    const tailleObs = envsLocaux[0].tailleObs
    let poids: Float64Array = new Float64Array(taille)
    for (let tour = 0; tour <= r.tours; tour++) {
      for (const env of envsLocaux) {
        const pilote = piloteCap()
        const pol = politiqueDepuis(tailleObs, poids)
        env.reset()
        for (;;) {
          const obs = env.observe()
          // L'étiquette vient TOUJOURS du pilote ; au premier tour c'est aussi
          // lui qui conduit, ensuite c'est la copie (et le pilote corrige).
          const expert = pilote(env)
          exemples.push({ obs: obs.slice(), action: expert })
          const action = tour === 0 ? expert : decide(pol, obs)
          if (env.step(action).fini) break
        }
      }
      const copie = apprendParImitation(exemples, tailleObs)
      poids = copie.poids
      // Ce que VAUT la copie, pas seulement ce qu'elle recopie : une fidélité
      // de 90 % peut manquer les 10 % de décisions qui font la traversée.
      const vaut = evalue(envsLocaux, poids)
      console.log(
        `Imitation, tour ${tour} : ${exemples.length} décisions du pilote « cap », ` +
          `${(copie.exactitude * 100).toFixed(0)} % de fidélité · ` +
          `la copie vaut ${vaut.score.toFixed(2)} L (retour ${vaut.retour.toFixed(2)})`,
      )
    }
    etat.moyenne.set(poids)
  }
  const rnd = alea(r.graine)
  const equipe =
    r.travailleurs > 1 ? new Equipe(r.travailleurs, argv) : null

  console.log(
    `Tableaux : ${r.tableaux.join(', ')} · ${r.particules} particules · ` +
      `essai de ${r.duree} s · décision toutes les ${(r.pasParDecision / 120).toFixed(2)} s`,
  )
  console.log(
    `Politique linéaire : ${taille} poids · population ${r.population}, élite ${r.elite}, ` +
      `${r.generations} générations · ${r.travailleurs} travailleur(s)${r.wasm ? ' · WASM' : ''}`,
  )
  console.log(
    'gén |  retour moy |  retour max |  litres max | traversées |  temps',
  )

  const t0 = Date.now()
  let meilleurGlobal = { retour: -Infinity, poids: new Float64Array(taille) }
  const journal: Record<string, number>[] = []

  // Le fichier est réécrit APRÈS CHAQUE GÉNÉRATION, pas à la fin : un
  // entraînement de deux heures doit se regarder progresser (pnpm rl:courbe),
  // et une machine qui s'éteint ne doit pas emporter le travail avec elle.
  mkdirSync(dirname(r.sortie), { recursive: true })
  const ecris = (enCours: boolean): void => {
    writeFileSync(
      r.sortie,
      JSON.stringify(
        {
          version: 1,
          enCours,
          tailleObs: envsLocaux[0].tailleObs,
          reglages: r,
          retour: meilleurGlobal.retour,
          poids: Array.from(meilleurGlobal.poids),
          journal,
        },
        null,
        1,
      ),
    )
  }

  for (let g = 1; g <= r.generations; g++) {
    const candidats: Float64Array[] = []
    for (let i = 0; i < r.population; i++) candidats.push(cemEchantillon(etat, rnd))
    const verdicts = equipe
      ? await Promise.all(candidats.map((c, i) => equipe.evalue(g * 1000 + i, c)))
      : candidats.map((c) => evalue(envsLocaux, c))

    const ordre = candidats
      .map((_, i) => i)
      .sort((a, b) => verdicts[b].retour - verdicts[a].retour)
    const elite = ordre.slice(0, r.elite).map((i) => candidats[i])
    cemRecentre(etat, elite, r.bruit)

    const best = ordre[0]
    if (verdicts[best].retour > meilleurGlobal.retour) {
      meilleurGlobal = {
        retour: verdicts[best].retour,
        poids: candidats[best].slice(),
      }
    }
    const moy = verdicts.reduce((s, v) => s + v.retour, 0) / verdicts.length
    const traversees = verdicts.reduce((s, v) => s + v.reussites, 0)
    console.log(
      `${String(g).padStart(3)} | ${moy.toFixed(2).padStart(11)} | ` +
        `${verdicts[best].retour.toFixed(2).padStart(11)} | ` +
        `${verdicts[best].score.toFixed(2).padStart(11)} | ` +
        `${String(traversees).padStart(4)}/${String(r.population * r.tableaux.length).padEnd(5)} | ` +
        `${horodate(Date.now() - t0)}`,
    )
    journal.push({
      generation: g,
      retourMoyen: moy,
      retourMax: verdicts[best].retour,
      litresMax: verdicts[best].score,
      traversees,
    })
    ecris(g < r.generations)
  }
  equipe?.ferme()
  ecris(false)
  console.log(`\nMeilleure politique écrite dans ${r.sortie}`)
  console.log(`Rejouer :  pnpm rl:rejoue --politique ${r.sortie}`)
  console.log(`La courbe : pnpm rl:courbe --journal ${r.sortie}`)
}

const argv = process.argv.slice(2)
const reglages = lisArgs(argv)
if (argv.includes('--mode-travailleur')) {
  await travailleur(reglages)
} else {
  await entraine(
    reglages,
    argv.filter((a) => a !== '--mode-travailleur'),
  )
}
