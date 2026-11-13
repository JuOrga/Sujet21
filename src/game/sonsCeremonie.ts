// ---- LES VOIX SONORES DE LA CÉRÉMONIE --------------------------------------
// Le contrat : le nom des voix que la cérémonie peut réclamer. `AudioFx`
// (audio.ts) les joue sur le bus des effets, `main.ts` les appelle par
// `sonCeremonie`. Chaque voix est synthétisée (aucun fichier : la cérémonie
// ne doit rien charger) et BRÈVE — elle ponctue un geste, elle ne l'habille
// pas. Les gains restent sous celui des stings existants d'audio.ts
// (coupFinal 0,26 ; vanne 0,18 ; collect 0,16) : une cérémonie qui couvrirait
// la musique serait pire qu'une cérémonie muette.

export type VoixCeremonie =
  | 'compteur'
  | 'sceau'
  | 'cartouche'
  | 'deversement'
  | 'palier'
  | 'elu'
  | 'levier'

/** Synthétise la voix sur le contexte et le bus donnés ; `force` (0..1) dose
 *  l'intensité, `t0` est l'instant de départ du contexte. */
export type RecetteVoix = (ctx: AudioContext, bus: AudioNode, force: number, t0: number) => void

export interface VoixDef {
  /** secondes : le son s'éteint dans ce délai (testé sur un contexte factice) */
  duree: number
  /** crête maximale d'un nœud de gain à force 1 */
  gain: number
  jouer: RecetteVoix
}

// Le bruit est tiré une fois par contexte : 0,5 s suffit, chaque voix en lit
// un morceau à un décalage différent.
const BRUITS = new WeakMap<object, AudioBuffer>()
function bruit(ctx: AudioContext): AudioBuffer {
  let b = BRUITS.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    BRUITS.set(ctx, b)
  }
  return b
}

// 0,4 → 1 : même à force 0 on entend le geste, il est juste plus discret
const dose = (force: number): number => 0.4 + 0.6 * Math.max(0, Math.min(1, force))

/** Une note : glisse de f0 à f1, attaque de 8 ms, chute exponentielle. */
function note(
  ctx: AudioContext, bus: AudioNode, t: number,
  type: OscillatorType, f0: number, f1: number, dur: number, crete: number,
): void {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(crete, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(bus)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Un souffle filtré dont la fréquence file de f0 à f1 ; `att` : montée (s). */
function souffle(
  ctx: AudioContext, bus: AudioNode, t: number,
  type: BiquadFilterType, f0: number, f1: number, q: number, dur: number, crete: number, att = 0.01,
): void {
  const s = ctx.createBufferSource()
  s.buffer = bruit(ctx)
  s.loop = true
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(crete, t + att)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f)
  f.connect(g)
  g.connect(bus)
  s.start(t)
  s.stop(t + dur + 0.02)
}

export const VOIX: Record<VoixCeremonie, VoixDef> = {
  // Le compteur : un tic sec par pas, dont la cadence s'ACCÉLÈRE — le chiffre
  // qui défile s'emballe puis s'arrête. Les tics montent un peu en hauteur.
  compteur: {
    duree: 0.9, gain: 0.07,
    jouer(ctx, bus, force, t0) {
      const k = dose(force)
      const n = 11
      for (let i = 0; i < n; i++) {
        // écarts qui rétrécissent : le dernier tic tombe à t0 + 0,8
        const t = t0 + 0.8 * (1 - Math.pow(1 - i / (n - 1), 1.7))
        const f = 1300 + 60 * i
        note(ctx, bus, t, 'square', f, f * 0.62, 0.04, 0.07 * k)
      }
    },
  },

  // Le sceau : le choc sourd d'un tampon sur du métal — coup grave, claque
  // de contact, et deux résonances inharmoniques qui traînent un instant.
  sceau: {
    duree: 0.8, gain: 0.2,
    jouer(ctx, bus, force, t0) {
      const k = dose(force)
      note(ctx, bus, t0, 'sine', 115, 42, 0.42, 0.2 * k)
      note(ctx, bus, t0, 'square', 92, 40, 0.12, 0.1 * k)
      souffle(ctx, bus, t0, 'lowpass', 900, 500, 1.2, 0.09, 0.07 * k)
      note(ctx, bus, t0 + 0.01, 'sine', 311, 311, 0.7, 0.03 * k)
      note(ctx, bus, t0 + 0.01, 'sine', 487, 487, 0.5, 0.02 * k)
    },
  },

  // La cartouche : un loquet qui s'enclenche, puis une note claire d'acquisition.
  cartouche: {
    duree: 0.55, gain: 0.12,
    jouer(ctx, bus, force, t0) {
      const k = dose(force)
      note(ctx, bus, t0, 'square', 210, 90, 0.07, 0.12 * k)
      souffle(ctx, bus, t0, 'bandpass', 1800, 1800, 1.5, 0.04, 0.04 * k)
      note(ctx, bus, t0 + 0.09, 'sine', 740, 740, 0.4, 0.05 * k)
      note(ctx, bus, t0 + 0.09, 'sine', 1480, 1480, 0.25, 0.02 * k)
    },
  },

  // Le déversement : un écoulement — bruit filtré qui s'ouvre puis se referme,
  // et quelques glouglous graves dessus. Le plus long des gestes courants.
  deversement: {
    duree: 1.4, gain: 0.08,
    jouer(ctx, bus, force, t0) {
      const k = dose(force)
      souffle(ctx, bus, t0, 'bandpass', 280, 800, 1.4, 0.7, 0.08 * k, 0.25)
      souffle(ctx, bus, t0 + 0.65, 'bandpass', 800, 260, 1.4, 0.7, 0.05 * k, 0.05)
      for (let i = 0; i < 5; i++) {
        const t = t0 + 0.1 + i * 0.22
        const f = 200 + 40 * ((i * 7) % 4)
        note(ctx, bus, t, 'sine', f, f * 0.4, 0.1, 0.05 * k)
      }
    },
  },

  // Le palier : une montée qui se tend, puis un anneau qui sonne et CASSE —
  // la hauteur de l'anneau s'effondre d'un demi-ton sous lui-même et un
  // éclat de bruit l'achève.
  palier: {
    duree: 1.5, gain: 0.14,
    jouer(ctx, bus, force, t0) {
      const k = dose(force)
      note(ctx, bus, t0, 'triangle', 220, 880, 0.6, 0.08 * k)
      note(ctx, bus, t0, 'sine', 110, 440, 0.6, 0.06 * k)
      const t1 = t0 + 0.6
      note(ctx, bus, t1, 'sine', 1318, 1318, 0.5, 0.06 * k)
      note(ctx, bus, t1, 'sine', 1318 * 2.76, 1318 * 2.76, 0.35, 0.025 * k)
      // la cassure : l'anneau glisse vers le bas en se tordant
      note(ctx, bus, t1 + 0.5, 'sine', 1318, 620, 0.3, 0.05 * k)
      souffle(ctx, bus, t1 + 0.5, 'highpass', 3000, 3000, 0.7, 0.18, 0.06 * k)
      note(ctx, bus, t1 + 0.5, 'square', 130, 52, 0.35, 0.14 * k)
    },
  },

  // L'élu : une petite fanfare de trois notes claires qui montent — on a été choisi.
  elu: {
    duree: 1.1, gain: 0.06,
    jouer(ctx, bus, force, t0) {
      const k = dose(force)
      ;[660, 990, 1320].forEach((f, i) => {
        note(ctx, bus, t0 + i * 0.13, 'sine', f, f, 0.5 + i * 0.1, 0.06 * k)
        note(ctx, bus, t0 + i * 0.13, 'triangle', f * 2, f * 2, 0.25, 0.015 * k)
      })
    },
  },

  // Le levier : le clac lourd d'un contacteur qu'on rabat, et sa résonance basse.
  levier: {
    duree: 0.55, gain: 0.16,
    jouer(ctx, bus, force, t0) {
      const k = dose(force)
      note(ctx, bus, t0, 'square', 150, 58, 0.12, 0.16 * k)
      souffle(ctx, bus, t0, 'lowpass', 1500, 700, 1, 0.06, 0.06 * k)
      note(ctx, bus, t0 + 0.05, 'sine', 72, 50, 0.4, 0.1 * k)
    },
  },
}
