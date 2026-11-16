// Point d'entrée empaqueté par crete-voix.cjs : les vraies voix, rendues hors ligne.
import { AudioFx } from '../../src/game/audio'
import { VOIX, type VoixCeremonie } from '../../src/game/sonsCeremonie'

const SR = 44100

function rendu(): { ctx: OfflineAudioContext; bus: GainNode } {
  const ctx = new OfflineAudioContext(1, SR * 2, SR)
  const bus = ctx.createGain() // gain unitaire : on mesure le son brut, avant le volume
  bus.connect(ctx.destination)
  return { ctx, bus }
}

async function crete(ctx: OfflineAudioContext): Promise<number> {
  const d = (await ctx.startRendering()).getChannelData(0)
  let m = 0
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]))
  return m
}

// Les stings de référence appartiennent à la classe : on lui prête le contexte
// hors ligne et son bus unitaire (mêmes champs que build(), sans le navigateur).
async function sting(nom: 'coupFinal' | 'collect' | 'vanne' | 'iceImpact'): Promise<number> {
  const { ctx, bus } = rendu()
  const fx = new AudioFx({ on: true, volume: 1 }) as unknown as Record<string, unknown>
  fx.ctx = ctx
  fx.master = bus
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  fx.noise = buf
  if (nom === 'iceImpact') (fx as unknown as AudioFx).iceImpact(700)
  else (fx as unknown as Record<string, () => void>)[nom]()
  return crete(ctx)
}

async function voix(v: VoixCeremonie, force: number): Promise<number> {
  const { ctx, bus } = rendu()
  VOIX[v].jouer(ctx as unknown as AudioContext, bus, force, 0)
  return crete(ctx)
}

;(window as unknown as Record<string, unknown>).mesure = async () => {
  const refs: Record<string, number> = {}
  for (const n of ['coupFinal', 'collect', 'vanne', 'iceImpact'] as const) refs[n] = await sting(n)
  const voix1: Record<string, number> = {}
  for (const v of Object.keys(VOIX) as VoixCeremonie[]) voix1[v] = await voix(v, 1)
  return { refs, voix: voix1 }
}
