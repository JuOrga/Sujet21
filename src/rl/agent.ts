// ---------------------------------------------------------------------------
// L'AGENT QUI JOUE À L'ÉCRAN — regarder l'IA essayer, sur n'importe quel
// tableau, dans le vrai jeu.
//
// Deux façons de montrer un agent : rejouer une TRACE enregistrée hors ligne,
// ou le faire DÉCIDER en direct. C'est la seconde qui est faite ici, et elle
// est meilleure sur tous les points : n'importe quel tableau immédiatement
// (rien à pré-calculer), on peut recommencer, changer de salle, le regarder
// se rattraper — et le coût est ridicule. Une politique linéaire, c'est 836
// multiplications toutes les 0,1 s ; les capteurs, seize rayons échantillonnés
// — de l'ordre du dixième de milliseconde par décision, à côté des ~2,6 ms
// que coûte UN pas de fluide (et il y en a 120 par seconde de jeu). Regarder
// l'agent jouer ne coûte donc rien de plus que jouer soi-même.
//
// L'agent ne triche pas : il n'écrit ni dans le solveur ni dans le monde. Il
// pose le doigt là où un joueur le poserait — c'est tout ce que fait
// `ordre()`. Le jeu, lui, ne sait pas qui tient le doigt.
// ---------------------------------------------------------------------------

import type { FluidSim } from '../sim/solver'
import type { LevelDef } from '../game/level'
import { Capteurs } from './capteurs'
import {
  ACTION_CONCLURE,
  ACTION_POUSSE_0,
  ACTION_RASSEMBLE,
  ACTION_RIEN,
  DIRECTIONS,
} from './env'
import { piloteCap, piloteHasard, type Pilote } from './pilotes'
import { decideurDepuis } from './politique'

/** La distance du « doigt » virtuel : la même qu'à l'entraînement. */
const PORTEE_VISEE = 900

/** Ce que l'agent demande au jeu, dans le langage du joueur. */
export interface Ordre {
  /** Le doigt est-il posé ? (`input.aimActive`) */
  tient: boolean
  /** Où il est posé, en coordonnées MONDE. */
  x: number
  y: number
  /** L'agent appuie sur CONTINUER (le sas a bu assez). */
  conclure: boolean
  action: number
}

export const NOMS_ACTIONS: string[] = (() => {
  const noms = ['attend', 'se rassemble', 'conclut']
  const fleches = ['→', '↗', '↗', '↑', '↑', '↖', '↖', '←', '←', '↙', '↙', '↓', '↓', '↘', '↘', '→']
  for (let k = 0; k < DIRECTIONS; k++) noms.push(`vise ${fleches[k]}`)
  return noms
})()

export interface PolitiqueChargee {
  nom: string
  /** Politique apprise — linéaire (CEM) ou réseau (PPO). */
  decide?: (obs: Float32Array) => number
  /** …ou pilote écrit à la main. */
  pilote?: Pilote
  /** Où en est l'entraînement qui a produit ces poids (mode suivi). */
  progression?: Progression
}

/** Le dernier état connu de l'entraînement, lu dans le journal du fichier. */
export interface Progression {
  iteration: number
  litresMoyens: number
  traversees: number
  enCours: boolean
}

/**
 * Charge un agent : `cap` et `hasard` sont les pilotes de référence, écrits à
 * la main ; tout le reste est traité comme l'URL d'un JSON produit par
 * `pnpm rl:entraine`.
 */
export async function chargeAgent(
  nom: string,
  opts: { argmax?: boolean; courant?: boolean } = {},
): Promise<PolitiqueChargee> {
  if (nom === 'cap' || nom === '1' || nom === '') {
    return { nom: 'cap (écrit à la main)', pilote: piloteCap() }
  }
  if (nom === 'hasard') return { nom: 'hasard', pilote: piloteHasard(1) }
  // L'anti-cache est indispensable en mode suivi : sans lui, le navigateur
  // resservirait la première version du fichier pendant toute la séance.
  const url = opts.courant ? `${nom}?t=${Date.now()}` : nom
  const rep = await fetch(url)
  if (!rep.ok) throw new Error(`agent introuvable : ${nom} (HTTP ${rep.status})`)
  const brut = (await rep.json()) as {
    type?: string
    tailleObs: number
    tailles?: number[]
    poids: number[]
    poidsCourants?: number[]
    enCours?: boolean
    journal?: Record<string, number>[]
  }
  if (!brut.poids) throw new Error(`${nom} : ce n’est pas une politique`)
  // En suivi, on veut la politique TELLE QU'ELLE EST À CET INSTANT
  // (poidsCourants), pas la meilleure retenue depuis le début : regarder
  // s'entraîner, c'est voir aussi les mauvais moments.
  const poids = opts.courant && brut.poidsCourants ? brut.poidsCourants : brut.poids
  const charge = decideurDepuis({ ...brut, poids }, { argmax: opts.argmax })
  const derniere = brut.journal?.[brut.journal.length - 1]
  return {
    nom: `${nom.replace(/^.*\//, '')} · ${charge.genre}`,
    decide: charge.decide,
    progression: derniere
      ? {
          iteration: derniere.generation ?? 0,
          litresMoyens: derniere.litresMoyens ?? derniere.litresMax ?? 0,
          traversees: derniere.traversees ?? 0,
          enCours: brut.enCours !== false,
        }
      : undefined,
  }
}

/**
 * SUIVRE UN ENTRAÎNEMENT EN DIRECT. Le fichier de politique est réécrit par
 * `pnpm rl:ppo` à chaque itération (et de façon atomique : on ne peut pas en
 * lire une moitié) ; on le relit ici toutes les `periode` secondes et on
 * remplace le cerveau de l'agent à chaud. Le jeu ne s'interrompt pas : la
 * même traversée continue avec une politique un peu meilleure.
 *
 * Rend la fonction qui arrête le suivi.
 */
export function suitPolitique(
  nom: string,
  periode: number,
  surMaj: (charge: PolitiqueChargee) => void,
  surErreur?: (e: unknown) => void,
): () => void {
  let vivant = true
  let enVol = false
  const minuteur = setInterval(() => {
    if (!vivant || enVol) return
    enVol = true
    void chargeAgent(nom, { courant: true })
      .then((c) => {
        if (vivant) surMaj(c)
      })
      .catch((e: unknown) => surErreur?.(e))
      .finally(() => {
        enVol = false
      })
  }, Math.max(500, periode * 1000))
  return () => {
    vivant = false
    clearInterval(minuteur)
  }
}

export class AgentEnJeu {
  nom: string
  actif = true
  derniereAction = ACTION_RIEN
  /** Décisions prises depuis le début du tableau — le « nombre de gestes ». */
  decisions = 0
  /** Coût mesuré d'une décision, en millisecondes (moyenne glissante). */
  coutMs = 0

  /** Où en est l'entraînement suivi, s'il y en a un. */
  progression: Progression | null = null
  /** Nombre de fois que le cerveau a été remplacé à chaud. */
  relectures = 0

  private capteurs: Capteurs
  private readonly periode: number
  private prochaineDecision = 0
  private ordreCourant: Ordre = {
    tient: false,
    x: 0,
    y: 0,
    conclure: false,
    action: ACTION_RIEN,
  }

  constructor(
    private charge: PolitiqueChargee,
    level: LevelDef,
    /** Secondes simulées entre deux décisions (0,1 s à l'entraînement). */
    periode = 0.1,
  ) {
    this.nom = charge.nom
    this.progression = charge.progression ?? null
    this.capteurs = new Capteurs(level)
    this.periode = periode
  }

  /** Remplace le cerveau à chaud, sans couper la partie en cours. */
  remplace(charge: PolitiqueChargee): void {
    this.charge = charge
    this.progression = charge.progression ?? this.progression
    this.relectures++
  }

  /** Le tableau a changé (ou recommencé) : les capteurs suivent. */
  changeTableau(level: LevelDef): void {
    this.capteurs = new Capteurs(level)
    this.prochaineDecision = 0
    this.decisions = 0
    this.derniereAction = ACTION_RIEN
    this.ordreCourant = {
      tient: false,
      x: 0,
      y: 0,
      conclure: false,
      action: ACTION_RIEN,
    }
  }

  /**
   * L'ordre du moment. On ne décide qu'une fois par période — entre deux, le
   * doigt reste posé où il était : c'est un geste tenu, comme celui d'un
   * joueur, pas une rafale d'impulsions.
   */
  ordre(sim: FluidSim, temps: number): Ordre {
    if (temps >= this.prochaineDecision) {
      this.prochaineDecision = temps + this.periode
      const t0 = performance.now()
      const action = this.choisit(sim, temps)
      this.coutMs += (performance.now() - t0 - this.coutMs) * 0.1
      this.decisions++
      this.ordreCourant = this.traduit(action, sim)
      this.derniereAction = this.ordreCourant.action
    }
    return this.ordreCourant
  }

  private choisit(sim: FluidSim, temps: number): number {
    if (this.charge.pilote) {
      return this.charge.pilote({
        sim,
        sortie: this.capteurs.sortie,
        aspireAssez: () =>
          sim.swallowed >= Math.max(20, sim.baseVolume * 0.1),
      })
    }
    return this.charge.decide!(this.capteurs.lis(sim, temps))
  }

  /** De l'action abstraite au geste : où le doigt se pose, et s'il se pose. */
  private traduit(action: number, sim: FluidSim): Ordre {
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    if (action === ACTION_CONCLURE) {
      // CONCLURE avant que le sas ait assez bu ne fait RIEN — comme à
      // l'entraînement, où le geste est refusé. Sans cette garde, le jeu
      // retiendrait l'intention (continuerVoulu ne se dégonfle pas) et
      // conclurait de lui-même à la seconde où le seuil est franchi : l'agent
      // se verrait offrir une salle bouclée qu'il n'a pas décidé de boucler.
      if (sim.swallowed < Math.max(20, sim.baseVolume * 0.1)) {
        return { tient: false, x: cx, y: cy, conclure: false, action: ACTION_RIEN }
      }
      return { tient: false, x: cx, y: cy, conclure: true, action }
    }
    if (action === ACTION_RASSEMBLE) {
      // Le doigt SUR le corps : le jeu y lit le rassemblement, gratuitement.
      return { tient: true, x: cx, y: cy, conclure: false, action }
    }
    if (action < ACTION_POUSSE_0) {
      return { tient: false, x: cx, y: cy, conclure: false, action }
    }
    const a = ((action - ACTION_POUSSE_0) / DIRECTIONS) * Math.PI * 2
    return {
      tient: true,
      x: cx + Math.cos(a) * PORTEE_VISEE,
      y: cy + Math.sin(a) * PORTEE_VISEE,
      conclure: false,
      action,
    }
  }

  /** Ce que l'agent est en train de faire, en toutes lettres. */
  libelle(): string {
    return NOMS_ACTIONS[this.derniereAction] ?? '—'
  }
}
