// La ROTATION des hits, forme par forme : chaque silhouette tournée se
// juge tournée — le rectangle, le coin, la capsule, le disque et l'arc.
// Garde-fous nés d'un signalement : « la hitbox ne pivote pas ».
import { describe, expect, it } from 'vitest'
import { dansForme, FORME_COIN, FORME_CAPSULE, FORME_ARC, FORME_DISQUE } from './formes'

describe('hit tourné', () => {
  // boîte 200×100 centrée en (0,0) — points témoins avant/après rotation 90°
  const base = { minX: -100, minY: -50, maxX: 100, maxY: 50 }
  it('rect tourné 90° : le point du grand axe sort, celui du petit entre', () => {
    const b = { ...base, angle: 90 }
    expect(dansForme(b, 90, 0)).toBe(false) // dans la boîte d'origine, hors tournée
    expect(dansForme(b, 0, 90)).toBe(true) // hors boîte d'origine, dans la tournée
  })
  it('coin tourné 90° suit la rotation', () => {
    // p0=0 : triangle (-100,-50)(100,-50)(-100,50). (-50,0) est dedans ;
    // tourné +90°, ce point du triangle atterrit en (0,-50).
    const b = { ...base, forme: FORME_COIN, angle: 90 }
    expect(dansForme(b, 0, -50)).toBe(true)
    // (-90,-40) est dans le triangle NON tourné, hors du triangle tourné
    expect(dansForme({ ...base, forme: FORME_COIN }, -90, -40)).toBe(true)
    expect(dansForme(b, -90, -40)).toBe(false)
  })
  it('capsule tournée 90° suit la rotation', () => {
    const b = { ...base, forme: FORME_CAPSULE, angle: 90 }
    expect(dansForme(b, 0, 90)).toBe(true)
    expect(dansForme(b, 90, 0)).toBe(false)
  })
  it('disque (ellipse) tourné 90° suit la rotation', () => {
    const b = { ...base, forme: FORME_DISQUE, angle: 90 }
    expect(dansForme(b, 0, 80)).toBe(true)
    expect(dansForme(b, 80, 0)).toBe(false)
  })
  it('arc tourné 90° suit la rotation', () => {
    const b = { ...base, forme: FORME_ARC, angle: 90 }
    // l'arc plein s'ouvre vers +x en local ; témoin grossier : un point de
    // l'anneau local (90,0) doit se retrouver en (0,90) une fois tourné
    const local = dansForme({ ...base, forme: FORME_ARC }, 90, 0)
    expect(dansForme(b, 0, 90)).toBe(local)
  })
})
