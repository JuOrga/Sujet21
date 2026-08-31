// ---------------------------------------------------------------------------
// L'ENTRAÎNEMENT PAR PPO — celui qui apprend pour de bon.
//
//   pnpm rl:ppo --tableaux 21-01 --iterations 400 --travailleurs 8
//
// À chaque itération : les travailleurs font jouer la politique en cours
// (chacun mène plusieurs tableaux de front), rapportent ce qui s'est passé,
// le parent calcule les avantages et fait quelques pas de descente, puis
// renvoie les nouveaux poids. Le journal est écrit à chaque itération —
// `pnpm rl:courbe --journal .rl/ppo.json` le trace pendant que ça tourne, et
// la politique sauvée se regarde jouer dans le jeu (`?agent=…`).
//
// Où passe le temps : ~99 % dans le solveur de fluide, c'est-à-dire dans les
// travailleurs. Le réseau (8 200 poids) ne pèse rien, et c'est pourquoi un
// GPU n'aurait rien à faire ici : la seule chose qui accélère un entraînement,
// c'est le NOMBRE DE CŒURS (--travailleurs) — voir `pnpm rl:banc`.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { NB_ACTIONS } from './env'
import { PPO_DEFAUT, avantagesGAE, majPPO, type Transition } from './ppo'
import { Adam, Reseau, parametres } from './reseau'
import { Collecteur, resume, type BilanEpisode, type OptionsCollecte } from './rollout'
import { alea } from './politique'

interface Reglages extends OptionsCollecte {
  iterations: number
  pasParEnv: number // T : décisions collectées par tableau et par itération
  travailleurs: number
  graine: number
  lr: number
  couches: number[]
  sortie: string
  recuit: boolean
}

function lisArgs(argv: string[]): Reglages {
  const get = (nom: string, def: string): string => {
    const i = argv.indexOf(`--${nom}`)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def
  }
  const num = (nom: string, def: number): number => Number(get(nom, String(def)))
  return {
    codes: get('tableaux', '21-01').split(',').map((s) => s.trim()).filter(Boolean),
    particules: num('particules', 450),
    duree: num('duree', 45),
    pasParDecision: num('pas', 12),
    envs: num('envs', 2),
    iterations: num('iterations', 300),
    pasParEnv: num('horizon', 256),
    travailleurs: Math.max(1, num('travailleurs', 4)),
    graine: num('graine', 1),
    lr: num('lr', 3e-4),
    couches: get('couches', '64,64').split(',').map(Number),
    sortie: get('sortie', '.rl/ppo.json'),
    recuit: get('recuit', '1') !== '0',
  }
}

// ---- Ce qui voyage entre les processus ------------------------------------
interface Requete {
  iter: number
  poidsP: number[]
  poidsV: number[]
  T: number
  graine: number
}
interface Reponse {
  iter: number
  tailleObs: number
  obs: number[] // à plat : n × tailleObs
  action: number[]
  logp: number[]
  valeur: number[]
  recompense: number[]
  fini: number[]
  valeurFinale: number[]
  bilans: BilanEpisode[]
}

function reconstruit(r: Reponse): Transition[] {
  const out: Transition[] = []
  const n = r.action.length
  for (let i = 0; i < n; i++) {
    out.push({
      obs: Float32Array.from(r.obs.slice(i * r.tailleObs, (i + 1) * r.tailleObs)),
      action: r.action[i],
      logp: r.logp[i],
      valeur: r.valeur[i],
      recompense: r.recompense[i],
      fini: r.fini[i] === 1,
    })
  }
  return out
}

async function travailleur(r: Reglages): Promise<void> {
  const collecteur = new Collecteur(r)
  const politique = new Reseau([collecteur.tailleObs, ...r.couches, NB_ACTIONS])
  const valeur = new Reseau([collecteur.tailleObs, ...r.couches, 1])
  const rl = createInterface({ input: process.stdin })
  process.stdout.write(JSON.stringify({ pret: true }) + '\n')
  for await (const ligne of rl) {
    if (!ligne.trim()) continue
    const req = JSON.parse(ligne) as Requete
    politique.importe(req.poidsP)
    valeur.importe(req.poidsV)
    const rnd = alea(req.graine)
    const { transitions, valeurFinale } = collecteur.collecte(
      politique,
      valeur,
      req.T,
      rnd,
      PPO_DEFAUT.gamma,
    )
    const tailleObs = collecteur.tailleObs
    const obs: number[] = []
    for (const t of transitions) for (let i = 0; i < tailleObs; i++) obs.push(t.obs[i])
    const rep: Reponse = {
      iter: req.iter,
      tailleObs,
      obs,
      action: transitions.map((t) => t.action),
      logp: transitions.map((t) => t.logp),
      valeur: transitions.map((t) => t.valeur),
      recompense: transitions.map((t) => t.recompense),
      fini: transitions.map((t) => (t.fini ? 1 : 0)),
      valeurFinale,
      bilans: collecteur.ramasseBilans(),
    }
    process.stdout.write(JSON.stringify(rep) + '\n')
  }
}

class Equipe {
  private readonly enfants: ReturnType<typeof spawn>[] = []
  private readonly attentes = new Map<number, (r: Reponse) => void>()
  private ferme_ = false

  constructor(nb: number, argv: string[]) {
    for (let i = 0; i < nb; i++) {
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
        const rep = JSON.parse(ligne) as { pret?: boolean } & Reponse
        if (rep.pret) return
        const cle = rep.iter * 1000 + i
        this.attentes.get(cle)?.(rep)
        this.attentes.delete(cle)
      })
      enfant.on('exit', (code) => {
        if (this.ferme_) return
        console.error(`travailleur interrompu (code ${code}) — entraînement arrêté`)
        process.exit(1)
      })
      this.enfants.push(enfant)
    }
  }

  collecte(req: Requete): Promise<Reponse[]> {
    return Promise.all(
      this.enfants.map(
        (enfant, i) =>
          new Promise<Reponse>((resolve) => {
            this.attentes.set(req.iter * 1000 + i, resolve)
            // Chaque travailleur a SA graine : sans ça, huit processus
            // exploreraient exactement les mêmes hésitations.
            enfant.stdin!.write(
              JSON.stringify({ ...req, graine: req.graine + i * 7919 }) + '\n',
            )
          }),
      ),
    )
  }

  ferme(): void {
    this.ferme_ = true
    for (const e of this.enfants) e.kill()
  }
}

function horodate(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(
    Math.floor(s / 60) % 60,
  ).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

async function entraine(r: Reglages, argv: string[]): Promise<void> {
  const rnd = alea(r.graine)
  const local = new Collecteur({ ...r, envs: r.travailleurs > 1 ? 1 : r.envs })
  const tailleObs = local.tailleObs
  const politique = new Reseau([tailleObs, ...r.couches, NB_ACTIONS], rnd)
  const valeur = new Reseau([tailleObs, ...r.couches, 1], rnd)
  const adamP = new Adam(parametres(politique), r.lr)
  const adamV = new Adam(parametres(valeur), r.lr)
  const equipe = r.travailleurs > 1 ? new Equipe(r.travailleurs, argv) : null
  const parIteration = r.pasParEnv * r.envs * r.travailleurs

  console.log(
    `PPO · ${r.codes.join(', ')} · ${r.particules} particules · essais de ${r.duree} s\n` +
      `Réseau ${[tailleObs, ...r.couches, NB_ACTIONS].join('→')} = ${politique.nbPoids} poids ` +
      `(+ critique ${valeur.nbPoids}) · lr ${r.lr}${r.recuit ? ' (recuit)' : ''}\n` +
      `${r.travailleurs} travailleur(s) × ${r.envs} tableaux × ${r.pasParEnv} décisions ` +
      `= ${parIteration} décisions par itération`,
  )
  console.log(
    'it. |  décisions | épis. | retour moy | litres moy | litres max | trav. | disp. | entropie |    KL |    temps',
  )

  const journal: Record<string, number>[] = []
  let total = 0
  let meilleur = { litres: -1, poids: politique.exporte() }
  const t0 = Date.now()
  mkdirSync(dirname(r.sortie), { recursive: true })
  const ecris = (enCours: boolean): void => {
    writeFileSync(
      r.sortie,
      JSON.stringify({
        version: 2,
        type: 'mlp',
        enCours,
        tailleObs,
        nbActions: NB_ACTIONS,
        tailles: [tailleObs, ...r.couches, NB_ACTIONS],
        reglages: { ...r, tableaux: r.codes },
        poids: meilleur.poids.map((v) => Number(v.toFixed(5))),
        poidsCourants: politique.exporte().map((v) => Number(v.toFixed(5))),
        journal,
      }),
    )
  }

  for (let it = 1; it <= r.iterations; it++) {
    if (r.recuit) {
      const facteur = 1 - (it - 1) / r.iterations
      adamP.lr = r.lr * facteur
      adamV.lr = r.lr * facteur
    }
    const req: Requete = {
      iter: it,
      poidsP: politique.exporte(),
      poidsV: valeur.exporte(),
      T: r.pasParEnv,
      graine: r.graine + it * 104729,
    }
    const segments: { trs: Transition[]; vf: number }[] = []
    const bilans: BilanEpisode[] = []
    if (equipe) {
      for (const rep of await equipe.collecte(req)) {
        const trs = reconstruit(rep)
        for (let e = 0; e < rep.valeurFinale.length; e++) {
          segments.push({
            trs: trs.slice(e * r.pasParEnv, (e + 1) * r.pasParEnv),
            vf: rep.valeurFinale[e],
          })
        }
        bilans.push(...rep.bilans)
      }
    } else {
      const { transitions, valeurFinale } = local.collecte(
        politique,
        valeur,
        r.pasParEnv,
        rnd,
        PPO_DEFAUT.gamma,
      )
      for (let e = 0; e < valeurFinale.length; e++) {
        segments.push({
          trs: transitions.slice(e * r.pasParEnv, (e + 1) * r.pasParEnv),
          vf: valeurFinale[e],
        })
      }
      bilans.push(...local.ramasseBilans())
    }

    const transitions: Transition[] = []
    const avantages: number[] = []
    const retours: number[] = []
    for (const seg of segments) {
      const g = avantagesGAE(seg.trs, seg.vf, PPO_DEFAUT.gamma, PPO_DEFAUT.lambda)
      transitions.push(...seg.trs)
      for (let i = 0; i < seg.trs.length; i++) {
        avantages.push(g.avantages[i])
        retours.push(g.retours[i])
      }
    }
    total += transitions.length
    const diag = majPPO(
      politique,
      valeur,
      adamP,
      adamV,
      transitions,
      Float64Array.from(avantages),
      Float64Array.from(retours),
      PPO_DEFAUT,
      rnd,
    )
    const bilan = resume(bilans)
    if (bilan.episodes > 0 && bilan.litresMoyens > meilleur.litres) {
      meilleur = { litres: bilan.litresMoyens, poids: politique.exporte() }
    }
    journal.push({
      generation: it,
      decisions: total,
      episodes: bilan.episodes,
      retourMoyen: bilan.retourMoyen,
      retourMax: bilan.retourMoyen,
      litresMoyens: bilan.litresMoyens,
      litresMax: bilan.litresMax,
      traversees: bilan.traversees,
      entropie: diag.entropie,
    })
    console.log(
      `${String(it).padStart(3)} | ${String(total).padStart(10)} | ` +
        `${String(bilan.episodes).padStart(5)} | ${bilan.retourMoyen.toFixed(2).padStart(10)} | ` +
        `${bilan.litresMoyens.toFixed(2).padStart(10)} | ${bilan.litresMax.toFixed(2).padStart(10)} | ` +
        `${String(bilan.traversees).padStart(5)} | ${String(bilan.dispersions).padStart(5)} | ` +
        `${diag.entropie.toFixed(3).padStart(8)} | ${diag.klApprox.toFixed(3).padStart(5)} | ` +
        `${horodate(Date.now() - t0)}`,
    )
    ecris(it < r.iterations)
  }
  equipe?.ferme()
  ecris(false)
  console.log(`\nPolitique écrite dans ${r.sortie}`)
  console.log(`La courbe :   pnpm rl:courbe --journal ${r.sortie} --serie litres`)
  console.log(`La regarder : copier ${r.sortie} dans public/agents/ puis ?agent=./agents/…`)
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
