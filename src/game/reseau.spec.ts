// Le contrat de la cloison réseau : un seul chemin vers l'API, le transport
// injectable, le préfixe d'URL, et le mode hors ligne qui rejette AVANT de
// partir — l'appelant tombe dans son catch, comme sans réseau.
import { afterEach, describe, expect, it } from 'vitest'
import { HorsLigneError, appelle, reseau } from './reseau'

function dosFactice(): { dos: { fetch(e: string, i?: RequestInit): Promise<Response> }; vus: { url: string; init?: RequestInit }[] } {
  const vus: { url: string; init?: RequestInit }[] = []
  return {
    vus,
    dos: {
      fetch: (url, init) => {
        vus.push({ url, init })
        return Promise.resolve(new Response('{"ok":true}', { status: 200 }))
      },
    },
  }
}

afterEach(() => {
  reseau.horsLigne = false
  reseau.base = ''
  reseau.dos = null
  reseau.appels.length = 0
  reseau.refuses.length = 0
})

describe('La cloison réseau', () => {
  it('passe l’appel au transport injecté, tel quel, et le note', async () => {
    const { dos, vus } = dosFactice()
    reseau.dos = dos
    const r = await appelle('/api/records', { method: 'POST', body: '{}' })
    expect(r.ok).toBe(true)
    expect(vus).toEqual([{ url: '/api/records', init: { method: 'POST', body: '{}' } }])
    expect(reseau.appels).toEqual(['/api/records'])
    expect(reseau.refuses).toEqual([])
  })

  it('le préfixe d’URL se pose devant le chemin — la même origine par défaut', async () => {
    const { dos, vus } = dosFactice()
    reseau.dos = dos
    reseau.base = 'https://sujet21.vercel.app'
    await appelle('/api/levels?id=x')
    expect(vus[0].url).toBe('https://sujet21.vercel.app/api/levels?id=x')
  })

  it('hors ligne : rien ne part, l’appel rejette, et le refus se note', async () => {
    const { dos, vus } = dosFactice()
    reseau.dos = dos
    reseau.horsLigne = true
    await expect(appelle('/api/presets')).rejects.toBeInstanceOf(HorsLigneError)
    expect(vus).toEqual([])
    expect(reseau.appels).toEqual([])
    expect(reseau.refuses).toEqual(['/api/presets'])
  })

  it('un appelant écrit comme les modules du jeu (try / catch → null) tombe sur son filet', async () => {
    reseau.horsLigne = true
    const lit = async (): Promise<unknown | null> => {
      try {
        const r = await appelle('/api/records', { cache: 'no-store' })
        if (!r.ok) return null
        return await r.json()
      } catch {
        return null
      }
    }
    expect(await lit()).toBeNull()
  })

  it('les journaux de diagnostic ne grossissent pas sans fin', async () => {
    reseau.horsLigne = true
    for (let i = 0; i < 260; i++) await appelle(`/api/x${i}`).catch(() => null)
    expect(reseau.refuses.length).toBe(200)
    expect(reseau.refuses[0]).toBe('/api/x60')
  })
})
