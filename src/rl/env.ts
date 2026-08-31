// ---------------------------------------------------------------------------
// L'ENVIRONNEMENT D'APPRENTISSAGE — le jeu sans écran, sans son, sans DOM.
//
// Pourquoi ce fichier existe : pour qu'une machine apprenne à jouer, il lui
// faut jouer BEAUCOUP — des dizaines de milliers de traversées. Le jeu réel
// est branché au navigateur (canvas, audio, manette, cinématiques) et tourne
// au mieux en temps réel. Ici, on ne garde que ce qui décide de l'issue d'un
// tableau : le solveur de fluide, la géométrie du niveau, l'aspiration du
// sas, et les fins d'un essai (le sas a tout bu, le joueur conclut, le corps
// s'est défait).
//
// C'est une RÉDUCTION assumée du jeu, pas une seconde implémentation : tout
// ce qui compte passe par les mêmes appels que `main.ts` fait à chaque pas —
// `eject`, `rassemble`, `applyExitSuction`, `step`. Les règles de fin sont
// recopiées de `main.ts` (le seuil « tout est bu ») et testées.
//
// Limites de cette version (assumées, documentées dans
// docs/apprentissage-par-renforcement.md) :
//   — l'eau seulement : ni glace, ni vapeur, ni dash (le péage de bascule et
//     la réserve de dashs vivent dans main.ts, pas dans le solveur) ;
//   — pas de lasers, de cibles, de rails, de cinématiques ni de méta ;
//   — les portes déclarées restent CLOSES (aucune brèche scénarisée).
// Un tableau qui repose sur ces mécaniques n'est donc pas jouable ici :
// `tableauxRL()` ne retient que ceux qui s'en passent.
// ---------------------------------------------------------------------------

import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import type { NoyauxWasm } from '../sim/wasm'
import { TABLEAUX, TABLEAUX_ECOLE, type LevelDef } from '../game/level'
import { niveauExpanse } from '../game/structures'
import { Capteurs } from './capteurs'

/**
 * Le corps ne se pilote qu'en poussant : 16 directions, se rassembler, ne rien
 * faire — et CONCLURE, le bouton « CONTINUER » du jeu : dès que le sas a bu
 * assez (un dixième du volume de départ), le joueur décide d'arrêter les
 * frais et d'embarquer le reste. Sans cette action, l'agent resterait à
 * ramasser des gouttes jusqu'à la fin des temps.
 */
export const DIRECTIONS = 16
export const ACTION_RIEN = 0
export const ACTION_RASSEMBLE = 1
export const ACTION_CONCLURE = 2
export const ACTION_POUSSE_0 = 3
export const NB_ACTIONS = ACTION_POUSSE_0 + DIRECTIONS

/** Distance du « doigt » virtuel : assez loin pour que la visée soit une direction. */
const PORTEE_VISEE = 900

export interface OptionsEnv {
  /** Code du tableau (21-A…). Ignoré si `level` est fourni. */
  code?: string
  level?: LevelDef
  /** Nombre de particules au départ (défaut : celui du tableau). Moins = plus vite. */
  particules?: number
  /** Pas physiques par décision (défaut 12 : une décision toutes les 0,1 s simulée). */
  pasParDecision?: number
  /** Durée maximale d'un essai, en secondes simulées. */
  dureeMax?: number
  /** Nombre de rayons de télémétrie autour du corps. */
  rayons?: number
  /** Portée de la télémétrie, en unités monde. */
  porteeRayon?: number
  /** Noyaux WASM (facultatif : accélération, jamais une dépendance). */
  wasm?: NoyauxWasm | null
  /** Le vaisseau refroidit-il pendant l'essai ? (défaut : oui, comme en jeu) */
  refroidissement?: boolean
  /** Surcharges de réglages du banc. */
  params?: Partial<SimParams>
}

export interface PoidsRecompense {
  /** Litres livrés au sas — le score du jeu. */
  livre: number
  /** Progression vers le sas (par unité de distance normalisée regagnée). */
  approche: number
  /** Volume détaché du corps hors du sas — négatif quand on va le rechercher. */
  perte: number
  /** Coût du temps, par seconde simulée. */
  temps: number
  /** Prime de traversée. */
  reussite: number
  /** Amende de dispersion. */
  dispersion: number
}

// Ces poids ont été RÉGLÉS, pas devinés. Premier jeu d'essai : amende de
// dispersion à 10, coût du temps à 0,02. L'agent a appris en cinq générations
// la seule leçon que ce contrat récompensait — NE RIEN FAIRE : rester immobile
// coûtait 1,2, tenter la traversée et se défaire en coûtait 10. La leçon vaut
// pour toute récompense : elle est un contrat, et l'agent le lit mieux que
// nous. Ici, l'immobilité doit coûter PLUS cher qu'un échec courageux.
export const POIDS_DEFAUT: PoidsRecompense = {
  livre: 6,
  approche: 5,
  perte: 1.5,
  temps: 0.05,
  reussite: 10,
  dispersion: 3,
}

export type Fin = 'en-cours' | 'sas' | 'conclu' | 'disperse' | 'perdu' | 'temps'

/** Les deux fins qui rapportent : le sas a tout bu, ou le joueur a conclu. */
export function reussie(fin: Fin): boolean {
  return fin === 'sas' || fin === 'conclu'
}

export interface Pas {
  obs: Float32Array
  recompense: number
  fini: boolean
  fin: Fin
  info: EtatLisible
}

export interface EtatLisible {
  temps: number // secondes simulées
  litres: number // volume encore vivant
  litresLivres: number // volume passé par le sas
  volumeRatio: number // part du volume de départ encore vivante
  distanceSas: number
  fin: Fin
}

/** Les tableaux jouables tels quels par l'environnement réduit. */
export function tableauxRL(): LevelDef[] {
  return [...TABLEAUX_ECOLE, ...TABLEAUX].filter(
    (l) =>
      (l.lasers?.length ?? 0) === 0 &&
      (l.cibles?.length ?? 0) === 0 &&
      (l.rails?.length ?? 0) === 0 &&
      (l.zones?.length ?? 0) === 0 &&
      (l.plots?.length ?? 0) === 0 &&
      (l.exige?.length ?? 0) === 0,
  )
}

function trouveTableau(code: string): LevelDef {
  const tous = [...TABLEAUX_ECOLE, ...TABLEAUX]
  const lv = tous.find((l) => l.code === code)
  if (!lv) {
    throw new Error(
      `tableau « ${code} » inconnu — connus : ${tous.map((l) => l.code).join(', ')}`,
    )
  }
  return lv
}

export class EnvSujet21 {
  readonly level: LevelDef
  readonly params: SimParams
  readonly poids: PoidsRecompense = { ...POIDS_DEFAUT }
  readonly pasParDecision: number
  readonly dureeMax: number
  readonly tailleObs: number
  /** Les capteurs — les mêmes qu'à l'écran, c'est tout l'intérêt. */
  readonly capteurs: Capteurs
  readonly sortie: { x: number; y: number }

  private readonly wasm: NoyauxWasm | null
  private readonly refroidissement: boolean
  private readonly particules: number
  private readonly diagonale: number

  sim!: FluidSim
  temps = 0
  fin: Fin = 'en-cours'
  private vivantsAvant = 0
  private avalesAvant = 0
  private distAvant = 0

  constructor(opts: OptionsEnv = {}) {
    this.level = niveauExpanse(opts.level ?? trouveTableau(opts.code ?? '21-A'))
    // ÉCHELLE DU CORPS. Entraîner sur un corps plus petit va plus vite (le
    // coût d'un pas suit le nombre de particules), mais le seuil de
    // dispersion est un volume ABSOLU : à 150 particules au lieu de 900, la
    // réserve serait à sec après une poignée d'impulsions et le tableau
    // deviendrait impossible pour de mauvaises raisons. On met donc le seuil
    // à l'échelle du corps — l'ARBITRAGE du jeu (« se déplacer, c'est
    // rétrécir », on peut dépenser ~93 % de soi) reste le même.
    const echelle = (opts.particules ?? this.level.spawn.n) / this.level.spawn.n
    this.params = {
      ...DEFAULT_PARAMS,
      criticalVolumeLiters: DEFAULT_PARAMS.criticalVolumeLiters * echelle,
      ...(opts.params ?? {}),
    }
    this.pasParDecision = opts.pasParDecision ?? 12
    this.dureeMax = opts.dureeMax ?? 60
    this.wasm = opts.wasm ?? null
    this.refroidissement = opts.refroidissement ?? true
    this.particules = opts.particules ?? this.level.spawn.n
    this.capteurs = new Capteurs(this.level, {
      rayons: opts.rayons,
      porteeRayon: opts.porteeRayon,
      dureeReference: this.dureeMax,
    })
    this.sortie = this.capteurs.sortie
    this.diagonale = this.capteurs.diagonale
    this.tailleObs = this.capteurs.taille
    this.reset()
  }

  /** Remet le tableau à zéro. Aucun aléa : deux resets donnent deux essais identiques. */
  reset(): Float32Array {
    // 4096 : la capacité du jeu (CAPACITY de main.ts), pour que la même
    // salle ne bute jamais sur une limite différente ici.
    const sim = new FluidSim(this.params, this.level.bounds, 4096)
    if (this.wasm) {
      sim.noyauxWasm = this.wasm
      sim.moteurWasm = true
    }
    sim.dashBudgetMax = this.level.dashBudget ?? this.params.gasDashBudget
    sim.dashBudget = sim.dashBudgetMax
    sim.setLevel(this.level.boxes, this.level.sponges)
    // Les portes déclarées restent closes : sans le séquenceur, aucune brèche.
    if (this.level.portes && this.level.portes.length > 0) {
      sim.setDoors(this.level.portes)
    }
    sim.spawnDisc(
      this.level.spawn.x,
      this.level.spawn.y,
      this.particules,
      KIND_PLAYER,
    )
    sim.relabel()
    sim.updatePlayerStats()
    this.sim = sim
    this.temps = 0
    this.fin = 'en-cours'
    this.vivantsAvant = sim.aliveCount()
    this.avalesAvant = 0
    this.distAvant = this.distanceSas()
    return this.observe()
  }

  private distanceSas(): number {
    return Math.hypot(
      this.sim.stats.centroidX - this.sortie.x,
      this.sim.stats.centroidY - this.sortie.y,
    )
  }

  /** Le seuil du bouton CONTINUER de main.ts : un dixième du volume de départ bu. */
  aspireAssez(): boolean {
    return this.sim.swallowed >= Math.max(20, this.sim.baseVolume * 0.1)
  }

  /** Le seuil de victoire de main.ts : le sas a bu, il ne reste qu'un fond. */
  private toutEstBu(): boolean {
    const seuilBu = Math.max(6, this.sim.baseVolume * 0.02)
    return this.sim.swallowed > 0 && this.sim.count <= seuilBu
  }

  /**
   * Une décision : `pasParDecision` pas physiques sous la même consigne —
   * exactement la boucle de main.ts, moins l'écran.
   */
  step(action: number): Pas {
    if (this.fin !== 'en-cours') {
      return {
        obs: this.observe(),
        recompense: 0,
        fini: true,
        fin: this.fin,
        info: this.etat(),
      }
    }
    const sim = this.sim
    const dt = this.params.dt
    if (action === ACTION_CONCLURE && this.aspireAssez()) {
      this.fin = 'conclu'
      return {
        obs: this.observe(),
        recompense: this.poids.reussite * this.score(),
        fini: true,
        fin: this.fin,
        info: this.etat(),
      }
    }
    const pousse = action >= ACTION_POUSSE_0
    const angle = ((action - ACTION_POUSSE_0) / DIRECTIONS) * Math.PI * 2
    for (let k = 0; k < this.pasParDecision && this.fin === 'en-cours'; k++) {
      if (this.refroidissement) {
        sim.chill = Math.min(
          1,
          this.temps / Math.max(30, this.params.chillDuration),
        )
      }
      if (pousse && !sim.dispersed) {
        // La visée SUIT le corps : le doigt reste posé « dans cette
        // direction », comme un joueur qui maintient son geste.
        sim.eject(
          sim.stats.centroidX + Math.cos(angle) * PORTEE_VISEE,
          sim.stats.centroidY + Math.sin(angle) * PORTEE_VISEE,
          dt,
        )
      } else if (action === ACTION_RASSEMBLE && !sim.dispersed) {
        sim.rassemble(dt)
      }
      sim.applyExitSuction(this.sortie.x, this.sortie.y, dt)
      sim.step(dt)
      this.temps += dt
      if (sim.dispersed) this.fin = 'disperse'
      else if (this.toutEstBu()) this.fin = 'sas'
      else if (sim.aliveCount() === 0) this.fin = 'perdu'
      else if (this.temps >= this.dureeMax) this.fin = 'temps'
    }

    // ---- La récompense. Trois termes seulement, tous lisibles en jeu :
    // ce que le sas a bu, le chemin gagné vers lui, et ce qu'on a laissé
    // en route (le temps n'est qu'un rappel à l'ordre).
    const p = this.poids
    const litre = this.params.litersPerParticle
    const avales = sim.swallowed
    const vivants = sim.aliveCount()
    const livre = (avales - this.avalesAvant) * litre
    // Signé : ce qui se détache coûte, ce qu'on va rechercher rapporte
    // autant — récupérer une flaque égarée est un geste du jeu, pas un aveu.
    const perdu = this.vivantsAvant - vivants - (avales - this.avalesAvant)
    const dist = this.distanceSas()
    const gagne = (this.distAvant - dist) / this.diagonale
    let r =
      p.livre * livre +
      p.approche * gagne -
      p.perte * perdu * litre -
      p.temps * this.pasParDecision * this.params.dt
    if (this.fin === 'sas') r += p.reussite * this.score()
    if (this.fin === 'disperse' || this.fin === 'perdu') r -= p.dispersion
    this.avalesAvant = avales
    this.vivantsAvant = vivants
    this.distAvant = dist

    return {
      obs: this.observe(),
      recompense: r,
      fini: this.fin !== 'en-cours',
      fin: this.fin,
      info: this.etat(),
    }
  }

  etat(): EtatLisible {
    const litre = this.params.litersPerParticle
    return {
      temps: this.temps,
      litres: this.sim.liters(),
      litresLivres: this.sim.swallowed * litre,
      volumeRatio:
        this.sim.baseVolume > 0
          ? this.sim.aliveCount() / this.sim.baseVolume
          : 0,
      distanceSas: this.distanceSas(),
      fin: this.fin,
    }
  }

  /** Ce que l'agent voit — délégué aux capteurs partagés avec le jeu. */
  observe(): Float32Array {
    return this.capteurs.lis(this.sim, this.temps)
  }

  /**
   * Le score du jeu, litre pour litre comme main.ts : le SURPLUS embarqué —
   * ce que le sas a bu, plus ce qui reste vivant au moment de conclure. Un
   * corps défait ou un chrono épuisé ne rapportent rien : la bonbonne se
   * remplit au sas, pas dans la cuve.
   */
  score(): number {
    if (!reussie(this.fin)) return 0
    return this.sim.swallowed * this.params.litersPerParticle + this.sim.liters()
  }

}

/** Un essai complet sous une politique donnée. */
export function joue(
  env: EnvSujet21,
  politique: (obs: Float32Array) => number,
  surPas?: (action: number, pas: Pas) => void,
): { retour: number; score: number; fin: Fin; etat: EtatLisible; pas: number } {
  env.reset()
  let retour = 0
  let n = 0
  let obs = env.observe()
  for (;;) {
    const action = politique(obs)
    const pas = env.step(action)
    retour += pas.recompense
    obs = pas.obs
    n++
    surPas?.(action, pas)
    if (pas.fini) {
      return { retour, score: env.score(), fin: pas.fin, etat: pas.info, pas: n }
    }
  }
}
