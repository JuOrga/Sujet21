// La mémoire de capture : la partie pure — l'élagage aux images clés, la
// cadence, la disponibilité selon l'appareil, le débit.

import { describe, expect, it } from 'vitest'
import { CADENCES_TAMPON, DUREE_TAMPON_MS, aEncoder, debitPour, elague, tamponDisponible } from './tamponCapture'
import type { MorceauVideo } from './webm'

const m = (tempsMs: number, cle: boolean): MorceauVideo => ({ donnees: new Uint8Array(1), cle, tempsUs: tempsMs * 1000 })

/** une seconde d'images à 30 ips, clé en tête */
function seconde(debutMs: number): MorceauVideo[] {
  const out: MorceauVideo[] = []
  for (let i = 0; i < 30; i++) out.push(m(debutMs + (i * 1000) / 30, i === 0))
  return out
}

describe('elague', () => {
  it('garde entre huit et neuf secondes, et commence sur une clé', () => {
    let file: MorceauVideo[] = []
    for (let s = 0; s < 20; s++) file = elague([...file, ...seconde(s * 1000)], DUREE_TAMPON_MS * 1000)
    expect(file[0].cle).toBe(true)
    const duree = (file[file.length - 1].tempsUs - file[0].tempsUs) / 1000
    expect(duree).toBeGreaterThanOrEqual(DUREE_TAMPON_MS)
    expect(duree).toBeLessThan(DUREE_TAMPON_MS + 1000)
    // la clé retenue est la plus récente qui laisse encore huit secondes
    expect(file[0].tempsUs).toBe(11_000_000)
  })

  it('ne touche à rien tant que huit secondes ne sont pas dépassées', () => {
    const file = [...seconde(0), ...seconde(1000), ...seconde(2000)]
    expect(elague(file, DUREE_TAMPON_MS * 1000)).toBe(file)
    expect(elague([], 1)).toEqual([])
  })

  it('n’élague jamais sur une image qui n’est pas une clé', () => {
    const file = [m(0, true), m(500, false), m(20_000, false), m(20_500, false)]
    // la seule clé est la première : rien à retirer
    expect(elague(file, 1000 * 1000)).toHaveLength(4)
  })
})

describe('aEncoder', () => {
  it('à 30 images par seconde sur un rendu à 60, une image sur deux', () => {
    // 16,7 ms depuis la dernière : trop tôt ; 33 ms : oui
    expect(aEncoder(16.7, 30)).toBe(false)
    expect(aEncoder(33.3, 30)).toBe(true)
  })

  it('à 60, chaque image d’un rendu à 60 — même un peu en avance (58 Hz)', () => {
    expect(aEncoder(16.7, 60)).toBe(true)
    expect(aEncoder(11.2, 60)).toBe(true)
    expect(aEncoder(8, 60)).toBe(false)
  })

  it('jamais quand la mémoire est éteinte', () => {
    expect(aEncoder(1000, 0)).toBe(false)
  })
})

describe('tamponDisponible', () => {
  it('oui sur un pointeur fin avec WebCodecs, non sur tactile ou sans encodeur', () => {
    const pc = { matchMedia: () => ({ matches: false }) }
    const tactile = { matchMedia: () => ({ matches: true }) }
    expect(tamponDisponible(pc, {})).toBe(true)
    expect(tamponDisponible(tactile, {})).toBe(false)
    expect(tamponDisponible(pc, undefined)).toBe(false)
  })
})

describe('les cadences', () => {
  it('offre éteint, 30 et 60, avec un débit qui tient sous le magasin sur huit secondes', () => {
    expect([...CADENCES_TAMPON]).toEqual([0, 30, 60])
    for (const ips of CADENCES_TAMPON) {
      if (ips === 0) continue
      const octets = (debitPour(ips) / 8) * (DUREE_TAMPON_MS / 1000)
      expect(octets).toBeLessThan(3_000_000)
    }
    expect(debitPour(60)).toBeGreaterThan(debitPour(30))
  })
})
