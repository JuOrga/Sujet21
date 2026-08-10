// Bande-son : lits musicaux, ambiances de zone et ponctuations.
//
// Rien n'est attaché à un tableau précis — les tableaux vont bouger, la
// musique est donc accrochée à ce qui reste stable : l'accueil, la cuve (deux
// lits croisés par le refroidissement de la coque), le type de zone traversée
// (hublot fendu, conduite rompue, chambre pressurisée) et les événements.
// Un tableau peut malgré tout imposer son lit via `ambiance` (§ éditeur).
//
// Tout passe par le bus de AudioFx : la coupure, le volume et la mise en
// veille en arrière-plan restent gérés à un seul endroit. Les fichiers sont
// chargés à la demande — tant que le son est coupé, rien n'est téléchargé.

import type { AudioFx } from './audio'

export type Piste =
  | 'accueil'
  | 'cuve-tiede'
  | 'cuve-glaciale'
  | 'zone-hublot'
  | 'zone-conduite'
  | 'zone-chambre'

export const PISTES: Piste[] = [
  'accueil',
  'cuve-tiede',
  'cuve-glaciale',
  'zone-hublot',
  'zone-conduite',
  'zone-chambre',
]

export const PISTE_NOMS: Record<Piste, string> = {
  accueil: 'Accueil — protocole',
  'cuve-tiede': 'Cuve tiède (coque chaude)',
  'cuve-glaciale': 'Cuve glaciale (coque froide)',
  'zone-hublot': 'Hublot fendu (glace)',
  'zone-conduite': 'Conduite rompue (vapeur)',
  'zone-chambre': 'Chambre pressurisée (eau)',
}

export type Ponctuation =
  | 'sting-collecte'
  | 'sting-record'
  | 'sting-derniere-impulsion'
  | 'fin-de-course'

export type Bruitage =
  | 'ejection-1'
  | 'ejection-2'
  | 'ejection-3'
  | 'gel'
  | 'vaporisation'
  | 'condensation'
  | 'impact-glace'
  | 'goutte-rosee'
  | 'eponge'
  | 'souffle-vapeur'
  | 'vortex-sas'

export type Scene = 'accueil' | 'cuve' | 'muet'

const XFADE = 2 // s de croisement au raccord de boucle et entre deux lits

/** Une piste en boucle. Le MP3 décodé porte quelques millisecondes de silence
 * en tête ; plutôt que de compter sur un bouclage exact, on fait tourner deux
 * lectures qui se croisent — le raccord devient inaudible et le fondu de
 * l'une couvre le décalage de l'autre. */
class Voix {
  readonly gain: GainNode
  private next = 0
  private timer: number | null = null
  private stopped = false

  constructor(
    private readonly ctx: AudioContext,
    dest: AudioNode,
    private readonly buffer: AudioBuffer,
  ) {
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(dest)
    this.next = ctx.currentTime + 0.02
    this.tick()
    this.timer = window.setInterval(() => this.tick(), 500)
  }

  niveau(v: number, temps = 1.2): void {
    if (this.stopped) return
    this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, temps / 3)
  }

  stop(): void {
    this.stopped = true
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
    window.setTimeout(() => this.gain.disconnect(), 3000)
  }

  private tick(): void {
    if (this.stopped) return
    const now = this.ctx.currentTime
    // Contexte suspendu longtemps (page en arrière-plan) : on repart d'ici
    // au lieu de rattraper des dizaines de segments en retard.
    if (this.next < now) this.next = now + 0.05
    let garde = 0
    while (this.next < now + 2 && garde++ < 3) this.planifie(this.next)
  }

  private planifie(at: number): void {
    const dur = this.buffer.duration
    const xf = Math.min(XFADE, dur / 3)
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer
    const g = this.ctx.createGain()
    // fondus en puissance constante : deux extraits décorrélés se croisent
    // sans creux au milieu (un fondu linéaire, lui, s'entend)
    const n = 48
    const monte = new Float32Array(n)
    const descend = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      monte[i] = Math.sin((t * Math.PI) / 2)
      descend[i] = Math.cos((t * Math.PI) / 2)
    }
    g.gain.setValueCurveAtTime(monte, at, xf)
    g.gain.setValueCurveAtTime(descend, at + dur - xf, xf)
    src.connect(g)
    g.connect(this.gain)
    src.start(at)
    src.stop(at + dur + 0.05)
    this.next = at + dur - xf
  }
}

export class Soundtrack {
  private ctx: AudioContext | null = null
  private musique: GainNode | null = null
  private effets: GainNode | null = null
  private readonly tampons = new Map<string, AudioBuffer>()
  private readonly encours = new Map<string, Promise<AudioBuffer | null>>()
  private readonly voix = new Map<Piste, Voix>()
  private readonly cibles = new Map<Piste, number>()

  private scene: Scene = 'muet'
  private chill = 0
  private zone: Piste | null = null
  private ambiance: Piste | null = null
  private eveille = false

  constructor(private readonly fx: AudioFx) {}

  /** À appeler depuis un geste utilisateur, comme AudioFx.resume(). */
  eveiller(): void {
    if (this.eveille) return
    const g = this.fx.graph()
    if (!g) return
    this.ctx = g.ctx
    // La musique passe sous les bruitages : elle porte l'ambiance, pas
    // l'information — un impact de glace doit toujours ressortir.
    this.musique = g.ctx.createGain()
    this.musique.gain.value = 0.72
    this.musique.connect(g.bus)
    this.effets = g.ctx.createGain()
    this.effets.gain.value = 1
    this.effets.connect(g.bus)
    this.eveille = true
    this.applique()
  }

  // ---- Pilotage (appelé par le jeu) ----

  setScene(s: Scene): void {
    if (this.scene === s) return
    this.scene = s
    this.applique()
  }

  /** Refroidissement de la coque, 0 (tiède) → 1 (glaciale). */
  setChill(v: number): void {
    const c = Math.min(1, Math.max(0, v))
    if (Math.abs(c - this.chill) < 0.01) return
    this.chill = c
    this.applique()
  }

  /** Zone traversée : 'libre' coupe l'ambiance et rend la cuve à elle-même. */
  setZone(z: 'libre' | 'eau' | 'glace' | 'vapeur'): void {
    const piste: Piste | null =
      z === 'glace' ? 'zone-hublot' : z === 'vapeur' ? 'zone-conduite' : z === 'eau' ? 'zone-chambre' : null
    if (piste === this.zone) return
    this.zone = piste
    this.applique()
  }

  /** Lit imposé par le tableau (champ `ambiance`), ou null pour la cuve. */
  setAmbiance(p: Piste | null | undefined): void {
    const v = p ?? null
    if (v === this.ambiance) return
    this.ambiance = v
    this.applique()
  }

  private applique(): void {
    if (!this.eveille) return
    const jeu = this.scene === 'cuve'
    // Une zone imposée prend le dessus : le lit s'efface derrière elle sans
    // disparaître — on reste dans la cuve, on est juste passé sous un accident.
    const attenue = jeu && this.zone ? 0.3 : 1
    const lit: Piste | 'paire' | null = jeu ? (this.ambiance ?? 'paire') : null
    for (const p of PISTES) {
      let v = 0
      if (p === 'accueil') v = this.scene === 'accueil' ? 0.85 : 0
      else if (lit === 'paire' && p === 'cuve-tiede') v = (1 - this.chill) * attenue
      else if (lit === 'paire' && p === 'cuve-glaciale') v = this.chill * attenue
      else if (lit === p) v = attenue
      if (jeu && p === this.zone) v = Math.max(v, 0.85)
      this.cibles.set(p, v)
    }
    for (const [p, v] of this.cibles) {
      if (v > 0.001) void this.ouvrir(p, v)
      else this.voix.get(p)?.niveau(0, XFADE)
    }
  }

  private async ouvrir(p: Piste, v: number): Promise<void> {
    const existante = this.voix.get(p)
    if (existante) {
      existante.niveau(v, XFADE)
      return
    }
    const buf = await this.charge(p)
    // le temps du chargement, la consigne a pu changer
    if (!buf || !this.ctx || !this.musique) return
    const cible = this.cibles.get(p) ?? 0
    if (cible <= 0.001 || this.voix.has(p)) return
    const voix = new Voix(this.ctx, this.musique, buf)
    this.voix.set(p, voix)
    voix.niveau(cible, XFADE)
  }

  // ---- Ponctuations et bruitages ----

  ponctuation(nom: Ponctuation, gain = 0.9): void {
    void this.coup(nom, gain, 1, this.musique)
  }

  bruitage(nom: Bruitage, gain = 0.7, vitesse = 1): void {
    void this.coup(nom, gain, vitesse, this.effets)
  }

  private async coup(nom: string, gain: number, vitesse: number, sortie: GainNode | null): Promise<void> {
    if (!this.eveille || !sortie) return
    const buf = await this.charge(nom)
    if (!buf || !this.ctx) return
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = vitesse
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(g)
    g.connect(sortie)
    src.start()
  }

  private charge(nom: string): Promise<AudioBuffer | null> {
    const deja = this.tampons.get(nom)
    if (deja) return Promise.resolve(deja)
    const encours = this.encours.get(nom)
    if (encours) return encours
    const ctx = this.ctx
    if (!ctx) return Promise.resolve(null)
    const p = fetch(`/sound/${nom}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => {
        this.tampons.set(nom, buf)
        return buf
      })
      .catch(() => {
        // fichier absent ou décodage refusé : le jeu continue en silence
        this.encours.delete(nom)
        return null
      })
    this.encours.set(nom, p)
    return p
  }
}
