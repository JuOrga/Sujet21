import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioFx, loadAudioPrefs } from './audio'
import { VOIX, type VoixCeremonie } from './sonsCeremonie'

const TOUTES: VoixCeremonie[] = ['compteur', 'sceau', 'cartouche', 'deversement', 'palier', 'elu', 'levier']

// Un contexte factice qui note ce que la voix programme : pas d'OfflineAudioContext
// sous Node, mais les crêtes de gain et les instants d'arrêt se lisent très bien
// dans les appels. Ça ne remplace pas l'écoute (voir le commit).
function faux() {
  const crêtes: number[] = []
  const arrêts: number[] = []
  const départs: number[] = [] // start() des oscillateurs : le rythme d'une voix
  const param = (estGain = false) => ({
    value: 0,
    setValueAtTime(v: number) { if (estGain) crêtes.push(Math.abs(v)) },
    linearRampToValueAtTime(v: number) { if (estGain) crêtes.push(Math.abs(v)) },
    exponentialRampToValueAtTime(v: number) { if (estGain) crêtes.push(Math.abs(v)) },
    setTargetAtTime() {},
  })
  const noeud = (osc = false) => ({
    connect() {},
    start(t: number) { if (osc) départs.push(t) },
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
    createOscillator: () => noeud(true),
    createBiquadFilter: noeud,
    createBufferSource: noeud,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  }
  return { ctx: ctx as unknown as AudioContext, crêtes, arrêts, départs, bus: noeud() as unknown as AudioNode }
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
      expect(VOIX[v].gain, v).toBeLessThanOrEqual(0.15)
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

  it('le compteur accélère : les écarts entre tics décroissent', () => {
    const { ctx, départs, bus } = faux()
    VOIX.compteur.jouer(ctx, bus, 1, 0)
    expect(départs.length).toBeGreaterThan(5)
    const ecarts = départs.slice(1).map((t, i) => t - départs[i])
    for (let i = 1; i < ecarts.length; i++) expect(ecarts[i], `écart ${i}`).toBeLessThan(ecarts[i - 1])
  })

  describe('AudioFx.ceremonie', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('ne bâtit jamais de contexte audio quand le son est coupé', () => {
      const Ctor = vi.fn()
      vi.stubGlobal('window', { AudioContext: Ctor })
      const fx = new AudioFx({ ...loadAudioPrefs(), on: false })
      for (const v of TOUTES) expect(() => fx.ceremonie(v)).not.toThrow()
      expect(Ctor).not.toHaveBeenCalled()
    })

    it('son actif : va jusqu’à la voix, sur le bus des effets, à la force donnée', () => {
      const fx = new AudioFx({ on: true, volume: 0.5 })
      const { ctx, bus } = faux()
      const g = { ctx, bus: bus as unknown as GainNode, post: bus as unknown as GainNode }
      ;(ctx as unknown as { currentTime: number }).currentTime = 3
      vi.spyOn(fx, 'graph').mockReturnValue(g)
      const jouer = vi.spyOn(VOIX.sceau, 'jouer').mockImplementation(() => {})
      fx.ceremonie('sceau', 0.7)
      expect(jouer).toHaveBeenCalledWith(ctx, bus, 0.7, 3)
      jouer.mockRestore()
    })

    it('ne lève rien quand la voix elle-même casse', () => {
      const fx = new AudioFx({ on: true, volume: 0.5 })
      const { ctx, bus } = faux()
      vi.spyOn(fx, 'graph').mockReturnValue({ ctx, bus: bus as unknown as GainNode, post: bus as unknown as GainNode })
      const jouer = vi.spyOn(VOIX.palier, 'jouer').mockImplementation(() => { throw new Error('ctx cassé') })
      expect(() => fx.ceremonie('palier')).not.toThrow()
      jouer.mockRestore()
    })
  })

  it('ne lève rien sans contexte audio (son allumé, pas de navigateur)', () => {
    const fx = new AudioFx({ on: true, volume: 0.5 })
    expect(() => fx.ceremonie('palier', 0.5)).not.toThrow()
  })
})
