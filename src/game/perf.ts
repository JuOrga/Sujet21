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
  private readonly qual = new Uint8Array(CAP) // palier de qualité actif
  private total = 0 // images notées depuis le début
  private cursor = 0

  note(
    dtMs: number,
    cpuMs: number,
    physMs: number,
    rendMs: number,
    steps: number,
    particles: number,
    quality: number,
  ): void {
    // Une « image » de plus d'1,5 s n'est pas une image : c'est un onglet
    // endormi, un écran éteint, une appli passée derrière — le navigateur
    // avait suspendu le rappel. La consigner polluerait durée, percentiles
    // et pires images (constaté : un dt de 172 s dans un rapport réel).
    if (dtMs > 1500) return
    const i = this.cursor
    this.dt[i] = dtMs
    this.cpu[i] = cpuMs
    this.phys[i] = physMs
    this.rend[i] = rendMs
    this.steps[i] = Math.min(255, steps)
    this.parts[i] = Math.min(65535, particles)
    this.qual[i] = quality
    this.cursor = (i + 1) % CAP
    this.total++
  }

  private taille(): number {
    return Math.min(this.total, CAP)
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
      qualite: number
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
          qualite: this.qual[k],
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
    const nav = navigator as Navigator & { deviceMemory?: number }
    const perfMem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    return {
      quoi: 'sujet21-rapport-perf',
      version: 2,
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
        moyennes: {
          physMs: Math.round((physSum / Math.max(1, n)) * 100) / 100,
          renduCpuMs: Math.round((rendSum / Math.max(1, n)) * 100) / 100,
          cpuTotalMs: Math.round((cpuSum / Math.max(1, n)) * 100) / 100,
          autreJsMs: Math.round(((cpuSum - physSum - rendSum) / Math.max(1, n)) * 100) / 100,
        },
        memoireJsMo: perfMem ? Math.round(perfMem.usedJSHeapSize / 1048576) : null,
      },
      piresImages: pires,
    }
  }
}
