// Le contrat du client des fantômes partagés : la lecture tolérante de
// l'index et d'une salle, l'envoi qui passe par la cloison, et le repli à
// null sans réseau — jamais une erreur.
import { afterEach, describe, expect, it } from 'vitest'
import { EnregistreurFantome, batLeFantome } from './fantome'
import {
  fetchFantomesPartages,
  fetchIndexFantomes,
  litIndexFantomes,
  litSallePartagee,
  pushFantomePartage,
} from './netFantomes'
import { reseau } from './reseau'

function trace(nom: string, litres: number, temps: number) {
  const r = new EnregistreurFantome(0.1)
  for (let i = 0; i < 5; i++) r.note(i * 0.1, { x: i, y: 0, r: 10, cl: 100, etat: 0, poussee: null, profil: new Array(16).fill(20) })
  return r.fin(nom, litres, temps, '2026-09-07T00:00:00.000Z')
}

afterEach(() => {
  reseau.dos = null
  reseau.horsLigne = false
})

describe('Les fantômes du palmarès, côté jeu', () => {
  it('lit une salle et un index tolérants : ce qui n’est pas un fantôme est écarté', () => {
    const vol = trace('REX', 3.4, 80)
    const salle = litSallePartagee({ volume: vol, chrono: { v: 9, donnees: 'x' }, autre: 1 })
    expect(salle.volume).toEqual(vol)
    expect(salle.chrono).toBeUndefined()
    expect(litSallePartagee(null)).toEqual({})
    const index = litIndexFantomes({
      salles: {
        '21-01': { volume: { nom: 'REX', litres: 3.4, temps: 80, quand: 'q' }, chrono: 7 },
        '21-02': { chrono: { nom: 'JU', litres: 'x', temps: 40 } },
        '21-03': {},
        '21-04': 'rien',
      },
    })
    expect(Object.keys(index).sort()).toEqual(['21-01', '21-02'])
    expect(index['21-01'].volume).toEqual({ nom: 'REX', litres: 3.4, temps: 80, quand: 'q' })
    expect(index['21-01'].chrono).toBeUndefined()
    expect(index['21-02'].chrono).toEqual({ nom: 'JU', litres: 0, temps: 40, quand: '' })
    expect(litIndexFantomes({ salles: null })).toEqual({})
    expect(litIndexFantomes(42)).toEqual({})
  })

  it('les lectures passent par la cloison, avec le code de la salle ; sans réseau, null', async () => {
    const vus: string[] = []
    reseau.dos = {
      fetch: (url) => {
        vus.push(url)
        const corps = url.includes('code=')
          ? { volume: trace('REX', 3.4, 80) }
          : { salles: { '21-01': { volume: { nom: 'REX', litres: 3.4, temps: 80, quand: '' } } } }
        return Promise.resolve(new Response(JSON.stringify(corps), { status: 200 }))
      },
    }
    const salle = await fetchFantomesPartages('21-01')
    expect(salle?.volume?.nom).toBe('REX')
    const index = await fetchIndexFantomes()
    expect(index?.['21-01']?.volume?.litres).toBe(3.4)
    expect(vus).toEqual(['/api/fantomes?code=21-01', '/api/fantomes'])
    reseau.horsLigne = true
    expect(await fetchFantomesPartages('21-01')).toBeNull()
    expect(await fetchIndexFantomes()).toBeNull()
  })

  it('l’envoi : le corps porte le code, la catégorie et la trace ; la réponse dit si elle est gardée', async () => {
    let corps: unknown = null
    reseau.dos = {
      fetch: (_url, init) => {
        corps = JSON.parse(String(init?.body))
        return Promise.resolve(new Response(JSON.stringify({ garde: true, salle: { chrono: trace('REX', 2, 30) } }), { status: 200 }))
      },
    }
    const r = await pushFantomePartage('21-01', 'chrono', trace('REX', 2, 30))
    expect(r?.garde).toBe(true)
    expect(r?.salle.chrono?.temps).toBe(30)
    expect(corps).toMatchObject({ code: '21-01', cat: 'chrono' })
    expect((corps as { fantome: { v: number } }).fantome.v).toBe(2)
    // un serveur qui refuse (413) : null, pas d'erreur
    reseau.dos = { fetch: () => Promise.resolve(new Response('trop lourd', { status: 413 })) }
    expect(await pushFantomePartage('21-01', 'chrono', trace('REX', 2, 30))).toBeNull()
  })

  it('la règle du palmarès : le volume d’abord puis le temps, le chrono d’abord puis les litres', () => {
    expect(batLeFantome('volume', { litres: 3, temps: 50 }, null)).toBe(true)
    expect(batLeFantome('volume', { litres: 3.1, temps: 90 }, { litres: 3, temps: 50 })).toBe(true)
    expect(batLeFantome('volume', { litres: 3, temps: 40 }, { litres: 3, temps: 50 })).toBe(true)
    expect(batLeFantome('volume', { litres: 3, temps: 60 }, { litres: 3, temps: 50 })).toBe(false)
    expect(batLeFantome('volume', { litres: 2.9, temps: 10 }, { litres: 3, temps: 50 })).toBe(false)
    expect(batLeFantome('chrono', { litres: 1, temps: 40 }, { litres: 3, temps: 50 })).toBe(true)
    expect(batLeFantome('chrono', { litres: 3.5, temps: 50 }, { litres: 3, temps: 50 })).toBe(true)
    expect(batLeFantome('chrono', { litres: 3.5, temps: 51 }, { litres: 3, temps: 50 })).toBe(false)
  })
})
