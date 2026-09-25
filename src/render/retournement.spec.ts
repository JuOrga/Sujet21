import { describe, expect, it } from 'vitest'
import { sondeRetournement } from './retournement'

// Le choix de la voie qui retourne les textures : la première qui rend
// l'image témoin retournée — Chromium ignore UNPACK_FLIP_Y sur un bitmap,
// d'autres navigateurs ignorent imageOrientation ; l'<img> en dernier.
describe('retournement des textures', () => {
  it('WebGL retourne le bitmap : on le laisse faire', async () => {
    expect(await sondeRetournement(async (m) => m === 'gl')).toBe('gl')
  })

  it('Chromium : WebGL ignore le retournement, le bitmap s’en charge', async () => {
    expect(await sondeRetournement(async (m) => m === 'bitmap')).toBe('bitmap')
  })

  it('personne ne retourne un bitmap : on repasse par l’<img>', async () => {
    expect(await sondeRetournement(async () => false)).toBe('img')
  })

  it('une voie qui lève une erreur compte pour un non', async () => {
    const essai = async (m: 'gl' | 'bitmap') => {
      if (m === 'gl') throw new Error('bitmap refusé')
      return true
    }
    expect(await sondeRetournement(essai)).toBe('bitmap')
  })
})
