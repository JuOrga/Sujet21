// Collecteur de performance : la frame RÉELLE, mesurée sur l'appareil du
// joueur — pas au banc d'essai du développeur. Fenêtre glissante (~2 min),
// coût par image négligeable (écritures dans des tableaux plats). Le rapport
// se COPIE (presse-papier) ou s'ENVOIE AU LABO (api/perf) depuis le voile
// PARAMÈTRES : c'est la boucle qui permet d'analyser un Steam Deck ou un
// téléphone à distance, sur des chiffres réels.

const CAP = 7200 // ~2 minutes à 60 images/s

export interface PerfResume {
  p50: number
  p95: number
  images: number
}

export class PerfCollector {
  private readonly dt = new Float32Array(CAP) // ms entre images RENDUES (non plafonné)
  private readonly cpu = new Float32Array(CAP) // ms CPU TOTAL de la frame (tout le rappel)
  private readonly phys = new Float32Array(CAP) // ms de pas physiques dans l'image
  private readonly rend = new Float32Array(CAP) // ms de soumission du rendu (CPU)
  private readonly steps = new Uint8Array(CAP) // pas physiques consommés
  private readonly parts = new Uint16Array(CAP) // particules simulées
  // l'ÉCHELLE DE RENDU de l'image, en centièmes (100 = natif). C'était
  // un « palier de qualité » (un index de barreau) : illisible dans un
  // rapport, et sans valeur depuis que l'échelle se calcule au lieu de
  // sauter de cran en cran.
  private readonly qual = new Uint8Array(CAP)
  private total = 0 // images notées depuis le début
  private cursor = 0
  // LE PAS FIXE de la simulation, en ms (8,33 à 120 Hz, 16,67 à 60). Sans
  // lui, les `steps` relevés ne sont qu'un compte : c'est lui qui les
  // convertit en TEMPS SIMULÉ, donc qui permet de dire si le monde a
  // avancé aussi vite que l'horloge. Voir `vitesseDuTemps()`.
  private pasMs = 1000 / 120
  // Cadence BRUTE des rappels rAF (rendus ou sautés) : c'est l'horloge de
  // l'écran. Sur un panneau adaptatif (LTPO : 60/90/120 Hz qui changent en
  // cours de partie), elle explique un verrou qui « ne tient pas » : viser
  // 60 sur une grille de 90 fabrique des images de 22 ms sans que rien ne
  // rame. Histogramme au ms, à décroissance (≈ fenêtre glissante).
  private readonly ticks = new Map<number, number>()
  private ticksTotal = 0

  tick(dtMs: number): void {
    if (dtMs <= 0 || dtMs > 250) return
    const c = Math.round(dtMs)
    this.ticks.set(c, (this.ticks.get(c) ?? 0) + 1)
    if (++this.ticksTotal > 20000) {
      let reste = 0
      for (const [k, v] of this.ticks) {
        const nv = v >> 1
        if (nv === 0) this.ticks.delete(k)
        else {
          this.ticks.set(k, nv)
          reste += nv
        }
      }
      this.ticksTotal = reste
    }
  }

  note(
    dtMs: number,
    cpuMs: number,
    physMs: number,
    rendMs: number,
    steps: number,
    particles: number,
    echelleX100: number,
  ): void {
    // Une « image » de plus d'1,5 s n'est pas une image : c'est un onglet
    // endormi, un écran éteint, une appli passée derrière — le navigateur
    // avait suspendu le rappel. La consigner polluerait durée, percentiles
    // et pires images (constaté : un dt de 172 s dans un rapport réel).
    // Un dt négatif ou nul n'est pas une image non plus (horloges rAF et
    // performance.now() qui divergent au premier rappel — constaté au banc).
    if (dtMs <= 0 || dtMs > 1500) return
    const i = this.cursor
    this.dt[i] = dtMs
    this.cpu[i] = cpuMs
    this.phys[i] = physMs
    this.rend[i] = rendMs
    this.steps[i] = Math.min(255, steps)
    this.parts[i] = Math.min(65535, particles)
    this.qual[i] = echelleX100
    this.cursor = (i + 1) % CAP
    this.total++
  }

  private taille(): number {
    return Math.min(this.total, CAP)
  }

  /** Déclare le pas fixe courant (1000/simHz). Changer de pas VIDE la
   *  fenêtre : mélanger deux régimes de temps dans un même relevé ferait
   *  mentir la vitesse du temps sans que rien ne le signale — le collecteur
   *  se protège ici plutôt que de compter sur ses appelants. */
  pasFixe(ms: number): void {
    if (!(ms > 0) || ms === this.pasMs) return
    this.pasMs = ms
    this.reset()
  }

  /** Vide la fenêtre. Appelé à chaque changement de réglage (moteur,
   * graphismes, verrou…) : un rapport ne mélange JAMAIS deux
   * configurations — sans quoi les A/B envoyés coup sur coup se
   * contaminent (constaté : deux rapports à 37 s d'écart, fenêtres
   * quasi identiques, comparaison sans valeur). */
  reset(): void {
    this.total = 0
    this.cursor = 0
    this.ticks.clear()
    this.ticksTotal = 0
  }

  /** Les dt de la fenêtre, triés croissants (copie). */
  private dtTries(): Float32Array {
    const n = this.taille()
    const out = new Float32Array(n)
    out.set(n < CAP ? this.dt.subarray(0, n) : this.dt)
    return out.sort()
  }

  /** L'essentiel pour un affichage vif : fps médian et plancher p5. */
  resume(): PerfResume {
    const tri = this.dtTries()
    const n = tri.length
    if (n < 30) return { p50: 0, p95: 0, images: n }
    return {
      p50: 1000 / tri[Math.floor(n * 0.5)],
      p95: 1000 / tri[Math.floor(n * 0.95)],
      images: n,
    }
  }

  /** LA VITESSE DU TEMPS : le temps SIMULÉ divisé par le temps RÉEL sur la
   *  fenêtre. 1 = le monde avance à l'horloge. 0,75 = il tourne au ralenti
   *  d'un quart, en permanence.
   *
   *  POURQUOI CE CHIFFRE EXISTE. La boucle à pas fixe ABANDONNE le retard
   *  qu'elle n'a pas les moyens de payer (`FixedLoop.advance` : « le retard
   *  non payé est abandonné »). C'est le bon garde-fou — sans lui, une image
   *  en retard impose plus de pas, coûte plus cher, prend plus de retard, et
   *  la machine s'installe à 15 im/s. Mais il paie en TEMPS SIMULÉ, et il le
   *  faisait SANS RIEN DIRE : le rapport annonçait 40 im/s honnêtes pendant
   *  que le monde tournait à 75 % de sa vitesse. Le joueur, lui, le sentait
   *  — « certains niveaux tournent au ralenti » — sans qu'aucun chiffre du
   *  rapport ne puisse le confirmer.
   *
   *  Le calcul est EXACT et ne coûte rien de plus : les pas par image sont
   *  déjà relevés, le pas fixe est connu. Le report d'accumulateur d'une
   *  image sur l'autre ne fausse rien — il se paie à l'image suivante, et il
   *  reste au plus un pas en suspens au bout de la fenêtre.
   *
   *  `null` tant que la fenêtre est trop courte pour vouloir dire quelque
   *  chose (une seconde d'images). */
  vitesseDuTemps(): number | null {
    const n = this.taille()
    if (n < 60) return null
    let pas = 0
    let reelMs = 0
    for (let k = 0; k < n; k++) {
      pas += this.steps[k]
      reelMs += this.dt[k]
    }
    if (reelMs <= 0) return null
    return (pas * this.pasMs) / reelMs
  }

  /** Le rapport complet — tout ce qu'il faut pour diagnostiquer à distance. */
  rapport(extra: Record<string, unknown>): Record<string, unknown> {
    const n = this.taille()
    const tri = this.dtTries()
    const pc = (q: number): number => (n > 0 ? tri[Math.min(n - 1, Math.floor(n * q))] : 0)
    // Les 10 pires images, avec leur contexte : c'est là que les à-coups
    // parlent. `horsCpuMs` = dt − cpu total : du temps où NOTRE code ne
    // tourne pas — file GPU pleine, compositeur, gel du système. `autreJsMs`
    // = cpu − physique − rendu : notre code HORS des deux gros postes
    // (laser, étiquettes DOM, panneau 2D, HUD…).
    const pires: {
      dtMs: number
      cpuMs: number
      physMs: number
      rendMs: number
      autreJsMs: number
      horsCpuMs: number
      pas: number
      particules: number
      echelleX100: number
    }[] = []
    for (let k = 0; k < n; k++) {
      const d = this.dt[k]
      if (pires.length < 10 || d > pires[pires.length - 1].dtMs) {
        const cpu = this.cpu[k]
        pires.push({
          dtMs: Math.round(d * 100) / 100,
          cpuMs: Math.round(cpu * 100) / 100,
          physMs: Math.round(this.phys[k] * 100) / 100,
          rendMs: Math.round(this.rend[k] * 100) / 100,
          autreJsMs: Math.round((cpu - this.phys[k] - this.rend[k]) * 100) / 100,
          horsCpuMs: Math.round((d - cpu) * 100) / 100,
          pas: this.steps[k],
          particules: this.parts[k],
          echelleX100: this.qual[k],
        })
        pires.sort((a, b) => b.dtMs - a.dtMs)
        if (pires.length > 10) pires.pop()
      }
    }
    let physSum = 0
    let rendSum = 0
    let cpuSum = 0
    let sup20 = 0
    let sup33 = 0
    let sup50 = 0
    for (let k = 0; k < n; k++) {
      physSum += this.phys[k]
      rendSum += this.rend[k]
      cpuSum += this.cpu[k]
      if (this.dt[k] > 20) sup20++
      if (this.dt[k] > 33.4) sup33++
      if (this.dt[k] > 50) sup50++
    }
    // Les BANDES de lenteur : les 10 pires images (trous système) ne disent
    // rien de la MASSE des images moyennement lentes — celles qui cassent un
    // « 60 constant ». Par bande : moyennes des postes et POSTE DOMINANT par
    // image (physique, rendu, autre JS, hors CPU) — qui casse la cadence ?
    const bandes = [
      { plage: '20-33ms', min: 20, max: 33.4 },
      { plage: '33-50ms', min: 33.4, max: 50 },
      { plage: '50ms+', min: 50, max: Infinity },
    ].map((b) => {
      let images = 0
      let sp = 0
      let sr = 0
      let sa = 0
      let sh = 0
      const dominante = { physique: 0, rendu: 0, autreJs: 0, horsCpu: 0 }
      for (let k = 0; k < n; k++) {
        const d = this.dt[k]
        if (d <= b.min || d > b.max) continue
        const phys = this.phys[k]
        const rend = this.rend[k]
        const autre = Math.max(0, this.cpu[k] - phys - rend)
        const hors = Math.max(0, d - this.cpu[k])
        images++
        sp += phys
        sr += rend
        sa += autre
        sh += hors
        const m = Math.max(phys, rend, autre, hors)
        if (m === hors) dominante.horsCpu++
        else if (m === phys) dominante.physique++
        else if (m === rend) dominante.rendu++
        else dominante.autreJs++
      }
      const r = (v: number): number => (images > 0 ? Math.round((v / images) * 100) / 100 : 0)
      return {
        plage: b.plage,
        images,
        moyennes: { physMs: r(sp), renduCpuMs: r(sr), autreJsMs: r(sa), horsCpuMs: r(sh) },
        dominante,
      }
    })
    // Histogramme des durées d'images RENDUES : la grille de l'écran s'y lit
    // (des pics à 17/22/25 ms trahissent une quantification, pas une charge).
    const imgHist = new Map<number, number>()
    for (let k = 0; k < n; k++) {
      const c = Math.round(this.dt[k])
      imgHist.set(c, (imgHist.get(c) ?? 0) + 1)
    }
    const cadenceImages = [...imgHist.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ms, cnt]) => ({ ms, n: cnt }))
    const cadenceTicks = [...this.ticks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([ms, cnt]) => ({ ms, n: cnt }))
    const hzEcranEstime =
      cadenceTicks.length > 0 && cadenceTicks[0].ms > 0
        ? Math.round(1000 / cadenceTicks[0].ms)
        : null
    const vitesse = this.vitesseDuTemps()
    const nav = navigator as Navigator & { deviceMemory?: number }
    const perfMem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    return {
      quoi: 'sujet21-rapport-perf',
      // 5 : la VITESSE DU TEMPS entre dans la fenêtre. Un rapport v4 n'a
      // pas le champ — c'est à ça que sert le numéro.
      version: 5,
      quand: new Date().toISOString(),
      appareil: {
        userAgent: navigator.userAgent,
        ecran: `${screen.width}×${screen.height}`,
        vue: `${window.innerWidth}×${window.innerHeight}`,
        dpr: window.devicePixelRatio,
        coeurs: navigator.hardwareConcurrency ?? null,
        memoireGo: nav.deviceMemory ?? null,
        tactile: window.matchMedia('(pointer: coarse)').matches,
      },
      ...extra,
      fenetre: {
        images: n,
        dureeS: Math.round(tri.reduce((a, b) => a + b, 0) / 100) / 10,
        fps: {
          p50: Math.round(1000 / pc(0.5)),
          p75: Math.round(1000 / pc(0.75)),
          p95: Math.round(1000 / pc(0.95)),
          p99: Math.round(1000 / pc(0.99)),
          pire: n > 0 ? Math.round(1000 / tri[n - 1]) : 0,
        },
        imagesLentes: { sup20ms: sup20, sup33ms: sup33, sup50ms: sup50 },
        // Le monde a-t-il avancé aussi vite que l'horloge ? (1 = oui.)
        // Sous 1, la boucle a abandonné du temps simulé faute de budget :
        // c'est du RALENTI, pas une chute de cadence — et c'est le seul
        // chiffre qui le dise. `pasFixeMs` accompagne, pour qu'on puisse
        // refaire le calcul à la main depuis le rapport.
        vitesseDuTemps: vitesse === null ? null : Math.round(vitesse * 1000) / 1000,
        pasFixeMs: Math.round(this.pasMs * 100) / 100,
        bandesLentes: bandes,
        cadenceImages,
        moyennes: {
          physMs: Math.round((physSum / Math.max(1, n)) * 100) / 100,
          renduCpuMs: Math.round((rendSum / Math.max(1, n)) * 100) / 100,
          cpuTotalMs: Math.round((cpuSum / Math.max(1, n)) * 100) / 100,
          autreJsMs: Math.round(((cpuSum - physSum - rendSum) / Math.max(1, n)) * 100) / 100,
        },
        memoireJsMo: perfMem ? Math.round(perfMem.usedJSHeapSize / 1048576) : null,
      },
      // L'horloge de l'écran, mesurée sur les rappels rAF bruts (rendus ou
      // sautés) : le Hz RÉEL du panneau au moment du jeu — pas sa fiche.
      cadenceEcran: { hzEstime: hzEcranEstime, ticks: cadenceTicks },
      piresImages: pires,
    }
  }
}
