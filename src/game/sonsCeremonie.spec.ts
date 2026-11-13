import { describe, expect, it } from 'vitest'
import { AudioFx, loadAudioPrefs } from './audio'
import { VOIX, type VoixCeremonie } from './sonsCeremonie'

const TOUTES: VoixCeremonie[] = ['compteur', 'sceau', 'cartouche', 'deversement', 'palier', 'elu', 'levier']

// Un contexte factice qui note ce que la voix programme : pas d'OfflineAudioContext
// sous Node, mais les crêtes de gain et les instants d'arrêt se lisent très bien
// dans les appels. Ça ne remplace pas l'écoute (voir le commit).
function faux() {
  const crêtes: number[] = []
  const arrêts: number[] = []
  const param = (estGain = false) => ({
    value: 0,
    setValueAtTime(v: number) { if (estGain) crêtes.push(Math.abs(v)) },
    linearRampToValueAtTime(v: number) { if (estGain) crêtes.push(Math.abs(v)) },
    exponentialRampToValueAtTime(v: number) { if (estGain) crêtes.push(Math.abs(v)) },
    setTargetAtTime() {},
  })
  const noeud = () => ({
    connect() {},
    start() {},
    stop(t: number) { arrêts.push(t) },
    gain: param(true),
    frequency: param(),
    Q: param(),
    detune: param(),
    playbackRate: param(),
    type: '',
    buffer: null as unknown,
  })
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createGain: noeud,
    createOscillator: noeud,
    createBiquadFilter: noeud,
    createBufferSource: noeud,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  }
  return { ctx: ctx as unknown as AudioContext, crêtes, arrêts, bus: noeud() as unknown as AudioNode }
}

describe('sonsCeremonie', () => {
  it('donne une voix à chaque geste, brève', () => {
    for (const v of TOUTES) {
      expect(VOIX[v].duree, v).toBeGreaterThan(0)
      expect(VOIX[v].duree, v).toBeLessThanOrEqual(1.6)
    }
  })

  it('chaque voix programme du son, le tait dans sa durée et reste sous le niveau des stings', () => {
    for (const v of TOUTES) {
      const { ctx, crêtes, arrêts, bus } = faux()
      VOIX[v].jouer(ctx, bus, 1, 10)
      expect(arrêts.length, v).toBeGreaterThan(0)
      // aucune source ne vit au-delà de sa durée annoncée (+ la queue d'arrêt)
      expect(Math.max(...arrêts) - 10, v).toBeLessThanOrEqual(VOIX[v].duree + 0.1)
      // coupFinal (0,26) est le plus fort des stings existants : on reste dessous
      expect(Math.max(...crêtes), v).toBeLessThanOrEqual(VOIX[v].gain)
      expect(VOIX[v].gain, v).toBeLessThanOrEqual(0.2)
    }
  })

  it('la force dose l’intensité', () => {
    for (const v of TOUTES) {
      const fort = faux()
      const doux = faux()
      VOIX[v].jouer(fort.ctx, fort.bus, 1, 0)
      VOIX[v].jouer(doux.ctx, doux.bus, 0.2, 0)
      expect(Math.max(...doux.crêtes), v).toBeLessThan(Math.max(...fort.crêtes))
    }
  })

  it('ne joue rien et ne lève rien quand le son est coupé', () => {
    const fx = new AudioFx({ ...loadAudioPrefs(), on: false })
    for (const v of TOUTES) expect(() => fx.ceremonie(v)).not.toThrow()
    expect(fx.graph()).toBeNull()
  })

  it('ne lève rien sans contexte audio (son allumé, pas de navigateur)', () => {
    const fx = new AudioFx({ on: true, volume: 0.5 })
    expect(() => fx.ceremonie('palier', 0.5)).not.toThrow()
  })
})
