// Effets sonores procéduraux (Web Audio) : presque tout est synthétisé —
// seule la nappe de vapeur est un enregistrement (public/sound/vapeur-nappe.mp3),
// parce qu'aucun filtrage de bruit blanc ne donne autre chose qu'un
// sifflement. Trois boucles continues pilotées par le jeu (souffle
// d'éjection, respiration de la fumée, tourbillon du sas), des one-shots
// (gel, dégel, vaporisation, impacts de glace, avalement, tampons), et le
// bourdon discret de la station. Le contexte audio ne peut naître que d'un
// geste utilisateur (politique navigateur) : resume() est appelé au premier
// clic et reste sans effet ensuite.

export interface AudioPrefs {
  on: boolean
  volume: number
}

const PREFS_KEY = 'projet-21-audio'

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs>
      return {
        on: p.on !== false,
        volume: typeof p.volume === 'number' && Number.isFinite(p.volume) ? p.volume : 0.5,
      }
    }
  } catch {
    // localStorage indisponible : valeurs par défaut
  }
  return { on: true, volume: 0.5 }
}

function storePrefs(p: AudioPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // sans gravité
  }
}

export class AudioFx {
  enabled: boolean
  volume: number

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private ejectG: GainNode | null = null
  private gasG: GainNode | null = null
  private gasDepth: GainNode | null = null // profondeur de la respiration de la nappe
  private drainG: GainNode | null = null
  private drainF: BiquadFilterNode | null = null
  // Ralenti de visée (dash vapeur) : un passe-bas sur TOUT le mixage — le
  // monde sonore plonge « sous l'eau » —, un plongeon de hauteur à l'entrée,
  // et deux voix hors filtre pour habiter le temps suspendu.
  private slowLp: BiquadFilterNode | null = null
  private slowDuck: GainNode | null = null
  // Second maître, HORS passe-bas, pour les voix du temps suspendu : même
  // coupure et même volume que le maître principal (applyMaster règle les
  // deux), mais ses voix restent nettes quand le filtre étouffe le reste.
  private postMaster: GainNode | null = null
  private slowShimG: GainNode | null = null
  private slowSubG: GainNode | null = null
  private slowActive = false

  constructor(prefs: AudioPrefs) {
    this.enabled = prefs.on
    this.volume = prefs.volume
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    storePrefs({ on: this.enabled, volume: this.volume })
    this.applyMaster()
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
    storePrefs({ on: this.enabled, volume: this.volume })
    this.applyMaster()
  }

  private applyMaster(): void {
    if (!this.ctx) return
    const cible = this.enabled ? this.volume : 0
    this.master?.gain.setTargetAtTime(cible, this.ctx.currentTime, 0.05)
    this.postMaster?.gain.setTargetAtTime(cible, this.ctx.currentTime, 0.05)
  }

  // À appeler depuis un geste utilisateur ; idempotent.
  resume(): void {
    if (!this.ctx) this.build()
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  // Le contexte et les bus, pour brancher la bande-son au même endroit :
  // une seule coupure, un seul volume, une seule mise en veille. `bus` passe
  // par le passe-bas du ralenti ; `post` reste net pendant la visée — c'est
  // là que se branche la texture du temps suspendu.
  graph(): { ctx: AudioContext; bus: GainNode; post: GainNode } | null {
    if (!this.ctx) this.build()
    return this.ctx && this.master && this.postMaster
      ? { ctx: this.ctx, bus: this.master, post: this.postMaster }
      : null
  }

  private build(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx

    const master = ctx.createGain()
    master.gain.value = this.enabled ? this.volume : 0
    // Tout le mixage traverse ce passe-bas : grand ouvert en temps normal,
    // il se referme pendant la visée du dash — musique et bruitages compris.
    const slowLp = ctx.createBiquadFilter()
    slowLp.type = 'lowpass'
    slowLp.frequency.value = 19500
    slowLp.Q.value = 0.4
    const slowDuck = ctx.createGain()
    slowDuck.gain.value = 1
    master.connect(slowLp)
    slowLp.connect(slowDuck)
    slowDuck.connect(ctx.destination)
    this.slowLp = slowLp
    this.slowDuck = slowDuck
    this.master = master
    const postMaster = ctx.createGain()
    postMaster.gain.value = this.enabled ? this.volume : 0
    postMaster.connect(ctx.destination)
    this.postMaster = postMaster

    // Bruit blanc partagé par toutes les voix soufflées
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noise = buf

    // Boucles continues (gain à 0, le jeu les ouvre)
    this.ejectG = this.noiseLoop(1400, 2.2).gain // souffle fin de l'éjection
    // La vapeur : une nappe ENREGISTRÉE qui roule (vapeur-nappe.mp3), pas
    // un jet sous pression. Du bruit blanc filtré reste un sifflement quoi
    // qu'on lui fasse ; le fichier, lui, n'a rien au-dessus de 800 Hz et
    // respire tout seul. Le jeu ne pilote plus que son niveau.
    {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(master)
      this.gasG = g
      void this.chargeNappe(ctx, g)
    }
    const drain = this.noiseLoop(220, 2.6)
    this.drainG = drain.gain
    this.drainF = drain.filter

    // Voix du temps suspendu, branchées APRÈS le passe-bas (elles doivent
    // rester nettes quand tout le reste s'étouffe) : un scintillement d'air
    // très discret, et un battement grave qui pulse comme un cœur au ralenti.
    {
      const shim = ctx.createBufferSource()
      shim.buffer = this.noise
      shim.loop = true
      const shimF = ctx.createBiquadFilter()
      shimF.type = 'bandpass'
      shimF.frequency.value = 3400
      shimF.Q.value = 4
      const shimG = ctx.createGain()
      shimG.gain.value = 0
      shim.connect(shimF)
      shimF.connect(shimG)
      shimG.connect(postMaster)
      shim.start()
      this.slowShimG = shimG

      const sub = ctx.createOscillator()
      sub.type = 'sine'
      sub.frequency.value = 52
      const subG = ctx.createGain()
      subG.gain.value = 0
      // le battement : un LFO lent module la voix grave (±60 % de son niveau)
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.85
      const depth = ctx.createGain()
      depth.gain.value = 0
      lfo.connect(depth)
      depth.connect(subG.gain)
      sub.connect(subG)
      subG.connect(postMaster)
      sub.start()
      lfo.start()
      this.slowSubG = subG
      // la profondeur du LFO suit le gain de base : on la règle dans setSlowMo
      ;(subG as GainNode & { __depth?: GainNode }).__depth = depth
    }

    // Le son suit la visibilité de la page : en arrière-plan (autre app,
    // autre onglet, écran verrouillé), le contexte se suspend — sinon le
    // bourdon continue tout seul dans la poche. Au retour, il reprend ;
    // ça remet aussi d'aplomb un contexte cassé par une interruption
    // (appel, notification sonore) sur mobile.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) {
        void this.ctx.suspend()
      } else if (this.enabled) {
        void this.ctx.resume()
      }
    })
  }

  // Va chercher la nappe de vapeur et la met à tourner dans le gain déjà
  // câblé. Le rebouclage se fait à 0,12 s des bords : le MP3 se décode avec
  // quelques millisecondes de silence en tête et prepare.py fond les deux
  // extrémités — en bouclant à l'intérieur, la couture tombe en pleine
  // matière et ne s'entend pas.
  // Si le fichier manque (hors ligne, décodage refusé), on retombe sur
  // l'ancienne voix de synthèse : une nappe sommaire vaut mieux qu'un
  // silence là où le joueur attend un retour de son geste.
  private async chargeNappe(ctx: AudioContext, sortie: GainNode): Promise<void> {
    try {
      const rep = await fetch('/sound/vapeur-nappe.mp3')
      if (!rep.ok) throw new Error(String(rep.status))
      const buf = await ctx.decodeAudioData(await rep.arrayBuffer())
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.loopStart = Math.min(0.12, buf.duration / 4)
      src.loopEnd = Math.max(buf.duration - 0.12, buf.duration * 0.75)
      src.connect(sortie)
      src.start()
    } catch {
      this.nappeDeSecours(ctx, sortie)
    }
  }

  private nappeDeSecours(ctx: AudioContext, sortie: GainNode): void {
    if (!this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const sombre = ctx.createBiquadFilter()
    sombre.type = 'lowpass'
    sombre.frequency.value = 640
    sombre.Q.value = 0.3
    const corps = ctx.createBiquadFilter()
    corps.type = 'bandpass'
    corps.frequency.value = 260
    corps.Q.value = 0.8
    src.connect(sombre)
    sombre.connect(corps)
    corps.connect(sortie)
    src.start()
    const lfoF = ctx.createOscillator()
    lfoF.type = 'sine'
    lfoF.frequency.value = 0.31 // le roulis du filtre (±90 Hz)
    const depF = ctx.createGain()
    depF.gain.value = 90
    lfoF.connect(depF)
    depF.connect(corps.frequency)
    lfoF.start()
    const lfoA = ctx.createOscillator()
    lfoA.type = 'sine'
    lfoA.frequency.value = 0.19 // la respiration du niveau
    const depA = ctx.createGain()
    depA.gain.value = 0
    lfoA.connect(depA)
    depA.connect(sortie.gain)
    lfoA.start()
    this.gasDepth = depA
  }

  private noiseLoop(freq: number, q: number): { gain: GainNode; filter: BiquadFilterNode } {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    src.start()
    return { gain, filter }
  }

  // Le bourdon de la station a été retiré : le fond est silencieux, seuls
  // les gestes sonnent (éjection, vapeur, sas, transitions d'état).

  private ramp(g: GainNode | null, target: number): void {
    if (!this.ctx || !g) return
    g.gain.setTargetAtTime(target, this.ctx.currentTime, 0.09)
  }

  // Ralenti de visée : à l'entrée, la hauteur du monde tombe (plongeon) et
  // le passe-bas se referme — tout s'étouffe, comme une oreille sous l'eau ;
  // les voix du temps suspendu s'allument, seules à rester nettes. À la
  // sortie, le filtre rouvre d'un coup sec et une remontée brève rend l'air.
  setSlowMo(on: boolean): void {
    if (!this.ctx || on === this.slowActive) return
    this.slowActive = on
    const t = this.ctx.currentTime
    const depth = (this.slowSubG as (GainNode & { __depth?: GainNode }) | null)?.__depth ?? null
    if (on) {
      this.slowLp?.frequency.cancelScheduledValues(t)
      this.slowLp?.frequency.setTargetAtTime(240, t, 0.08)
      // le monde s'éloigne : étouffé PAR le filtre, et plus bas de moitié —
      // sans cette baisse, les basses de la musique masquaient tout l'effet
      this.slowDuck?.gain.setTargetAtTime(0.3, t, 0.12)
      this.blip(340, 46, 0.9, 0.17, 'sine') // le plongeon : la hauteur tombe
      this.noiseBurst(600, 0.8, 0.6, 0.08, 'lowpass')
      this.ramp(this.slowShimG, 0.042)
      this.ramp(this.slowSubG, 0.075)
      if (depth && this.ctx) depth.gain.setTargetAtTime(0.045, t, 0.25)
    } else {
      this.slowLp?.frequency.cancelScheduledValues(t)
      this.slowLp?.frequency.setTargetAtTime(19500, t, 0.04)
      this.slowDuck?.gain.setTargetAtTime(1, t, 0.05)
      this.blip(85, 700, 0.24, 0.11, 'sine') // l'air revient d'un trait
      this.ramp(this.slowShimG, 0)
      this.ramp(this.slowSubG, 0)
      if (depth && this.ctx) depth.gain.setTargetAtTime(0, t, 0.1)
    }
  }

  // ---- Boucles pilotées chaque frame par le jeu (niveaux 0..1) ----

  setEjectLevel(v: number): void {
    this.ramp(this.ejectG, v * 0.055)
  }

  setGasLevel(v: number): void {
    // Le fichier est calé à -20 dBFS RMS : × 0,6 le pose une paire de dB
    // au-dessus des lits musicaux (eux à -23 × 0,72), assez pour qu'on
    // sente le nuage sans qu'il couvre le tableau. C'est LA ligne à
    // toucher si la vapeur est trop forte ou trop timide.
    this.ramp(this.gasG, v * 0.6)
    // la respiration LFO n'existe que sur la nappe de secours : le fichier,
    // lui, ondule déjà de lui-même
    this.ramp(this.gasDepth, v * 0.085 * 0.3)
  }

  setDrainLevel(v: number): void {
    this.ramp(this.drainG, v * v * 0.1)
    if (this.ctx && this.drainF) {
      this.drainF.frequency.setTargetAtTime(180 + 520 * v, this.ctx.currentTime, 0.2)
    }
  }

  // ---- One-shots ----

  private blip(f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine', delay = 0): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private noiseBurst(freq: number, q: number, dur: number, peak: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
    if (!this.ctx || !this.master || !this.noise) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
  }

  // Gel : craquements cristallins qui se propagent, puis un shimmer froid
  freezeOn(): void {
    for (let i = 0; i < 12; i++) {
      this.noiseBurst(2600 + Math.random() * 2500, 8, 0.05, 0.05, 'bandpass', Math.random() * 0.5)
    }
    this.blip(1900, 2600, 0.7, 0.02)
  }

  // Dégel : quelques gouttes qui retombent
  freezeOff(): void {
    for (let i = 0; i < 5; i++) {
      this.blip(820 + Math.random() * 300, 360, 0.16, 0.035, 'sine', Math.random() * 0.45)
    }
  }

  // Vaporisation : le souffle monte ; condensation : il retombe
  vaporizeOn(): void {
    this.noiseBurst(700, 1.2, 0.55, 0.09, 'bandpass')
    this.blip(300, 900, 0.5, 0.02, 'sine')
  }

  vaporizeOff(): void {
    this.noiseBurst(500, 1.2, 0.45, 0.07, 'bandpass')
    this.blip(800, 260, 0.45, 0.025, 'sine')
  }

  // Impact d'un bloc de glace : coup sourd, force ∝ vitesse d'impact
  iceImpact(speed: number): void {
    const s = Math.min(1, speed / 700)
    this.blip(130, 55, 0.16, 0.12 * s + 0.02, 'sine')
    this.noiseBurst(900, 1.5, 0.06, 0.05 * s, 'lowpass')
  }

  // Avalement par le sas : glouglous, plus denses quand ça boit fort
  pulseSwallow(count: number): void {
    const n = Math.min(3, count)
    for (let i = 0; i < n; i++) {
      this.blip(320 + Math.random() * 120, 110, 0.1, 0.05, 'sine', i * 0.03)
    }
  }

  // Vortex de regroupement : souffle tournoyant bref
  vortex(): void {
    this.noiseBurst(400, 2, 0.7, 0.08)
    this.blip(200, 640, 0.6, 0.02, 'sine')
  }

  // ÉCHANTILLON COLLECTÉ : tampon mécanique puis carillon d'inventaire
  collect(): void {
    this.blip(95, 45, 0.14, 0.16, 'square')
    this.blip(660, 660, 0.22, 0.05, 'sine', 0.12)
    this.blip(880, 880, 0.24, 0.05, 'sine', 0.24)
    this.blip(1320, 1320, 0.4, 0.045, 'sine', 0.36)
  }

  // DISPERSION : masse grave qui s'effondre
  disperse(): void {
    this.blip(90, 34, 1.1, 0.14, 'sine')
    this.noiseBurst(240, 1, 0.8, 0.07, 'lowpass')
  }
}
