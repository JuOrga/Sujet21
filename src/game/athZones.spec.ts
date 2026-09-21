import { describe, expect, it } from 'vitest'
import { pancarteLibre, zonesInterdites } from './athZones'

// un écran de 1280 × 720 : module vital en haut à gauche, cadran en bas
const VITAL = { left: 14, top: 12, right: 250, bottom: 70 }
const CADRAN = { left: 540, top: 640, right: 740, bottom: 706 }

describe('les zones interdites aux pancartes', () => {
  const zones = zonesInterdites([VITAL, null, CADRAN], 10)

  it('ignore les postes absents et gonfle les autres de la marge', () => {
    expect(zones).toHaveLength(2)
    expect(zones[0]).toEqual({ left: 4, top: 2, right: 260, bottom: 80 })
  })

  it('ignore un poste sans surface (masqué)', () => {
    expect(zonesInterdites([{ left: 5, top: 5, right: 5, bottom: 9 }], 10)).toEqual([])
  })

  it('rend le haut de l’écran aux pancartes : seul le coin est pris', () => {
    // l'ancienne bande de 46 px effaçait cette pancarte, au centre-haut
    expect(pancarteLibre(640, 24, 60, 10, zones)).toBe(true)
    expect(pancarteLibre(120, 40, 60, 10, zones)).toBe(false)
  })

  it('rend le bas aussi : à côté du cadran, la pancarte tient', () => {
    expect(pancarteLibre(1000, 680, 60, 10, zones)).toBe(true)
    expect(pancarteLibre(640, 680, 60, 10, zones)).toBe(false)
  })

  it('compte un simple contact de bord comme libre', () => {
    // boîte [260..380] contre zone [..260] : elles se touchent, sans se couvrir
    expect(pancarteLibre(320, 40, 60, 10, zones)).toBe(true)
  })
})
