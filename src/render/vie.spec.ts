import { describe, expect, it } from 'vitest'
import {
  GENRE_LUEUR,
  GENRE_MOTE,
  Motes,
  VIE_STRIDE,
  lueurGoutte,
  remplitVie,
  toucheLeCorps,
  type Hotes,
  type Humeur,
} from './vie'

// un corps de dix gouttes en rond autour de (100, 100), plus deux gouttes
// libres loin de là
function corps(): Hotes & { cooldown: Float32Array; duCorps: Uint8Array } {
  const n = 12
  const posX = new Float32Array(n)
  const posY = new Float32Array(n)
  const kind = new Uint8Array(n)
  for (let i = 0; i < 10; i++) {
    posX[i] = 100 + Math.cos(i) * 20
    posY[i] = 100 + Math.sin(i) * 20
    kind[i] = 1
  }
  posX[10] = 900
  posY[10] = 900
  posX[11] = 950
  posY[11] = 950
  return {
    count: n,
    posX,
    posY,
    kind,
    frozen: new Uint8Array(n),
    gaseous: new Uint8Array(n),
    cooldown: new Float32Array(n),
    duCorps: new Uint8Array(n),
  }
}

const calme: Humeur = {
  regardX: 100,
  regardY: 100,
  rassemble: 0,
  agite: 0,
  dispersed: false,
}

// un tirage déterministe : la suite 0,1 · 0,3 · 0,7 · … rejouable
function tirage(): () => number {
  let s = 17
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

describe('les motes', () => {
  it("s'accrochent à des gouttes DU CORPS, jamais aux gouttes libres", () => {
    const motes = new Motes(20, tirage())
    const h = corps()
    for (let k = 0; k < 60; k++) motes.update(1 / 60, h, calme, tirage())
    for (let m = 0; m < motes.n; m++) {
      expect(motes.alpha[m]).toBeGreaterThan(0.3)
      // toutes dans le rond du corps — aucune partie vers (900, 900)
      expect(Math.hypot(motes.x[m] - 100, motes.y[m] - 100)).toBeLessThan(40)
    }
  })

  it('suivent le fluide : le corps se déplace, elles se déplacent', () => {
    const motes = new Motes(8, tirage())
    const h = corps()
    for (let k = 0; k < 60; k++) motes.update(1 / 60, h, calme, tirage())
    for (let i = 0; i < 10; i++) h.posX[i] += 300
    for (let k = 0; k < 90; k++) motes.update(1 / 60, h, calme, tirage())
    for (let m = 0; m < motes.n; m++) {
      expect(Math.hypot(motes.x[m] - 400, motes.y[m] - 100)).toBeLessThan(40)
    }
  })

  it('se raccrochent ailleurs quand leur goutte est éjectée', () => {
    const motes = new Motes(6, tirage())
    const h = corps()
    for (let k = 0; k < 60; k++) motes.update(1 / 60, h, calme, tirage())
    // toutes les gouttes du corps partent, sauf une : elle devient l'hôte
    // de toutes — et une goutte éjectée loin n'emporte aucune mote
    for (let i = 1; i < 10; i++) {
      h.kind[i] = 0
      h.posX[i] = 700
    }
    // un seul tirage pour toute la suite : recréé à chaque image, il
    // rejouait les mêmes nombres et pouvait manquer l'hôte à chaque fois
    const rand = tirage()
    for (let k = 0; k < 120; k++) motes.update(1 / 60, h, calme, rand)
    for (let m = 0; m < motes.n; m++) {
      // l'hôte, à son rayon de vagabondage près (16 au plus)
      expect(Math.abs(motes.x[m] - h.posX[0])).toBeLessThan(20)
      expect(motes.alpha[m]).toBeGreaterThan(0.5)
    }
  })

  it('se resserrent vers le regard sous la peur', () => {
    const rand = tirage()
    const h = corps()
    const serre = new Motes(30, tirage())
    const libre = new Motes(30, tirage())
    const peur: Humeur = { ...calme, regardX: 100, regardY: 100, rassemble: 1 }
    for (let k = 0; k < 120; k++) {
      serre.update(1 / 60, h, peur, rand)
      libre.update(1 / 60, h, calme, rand)
    }
    const moy = (mo: Motes): number => {
      let s = 0
      for (let m = 0; m < mo.n; m++)
        s += Math.hypot(mo.x[m] - 100, mo.y[m] - 100)
      return s / mo.n
    }
    expect(moy(serre)).toBeLessThan(moy(libre) * 0.6)
  })

  it("s'éteignent quand le corps se défait", () => {
    const motes = new Motes(6, tirage())
    const h = corps()
    for (let k = 0; k < 60; k++) motes.update(1 / 60, h, calme, tirage())
    for (let k = 0; k < 120; k++)
      motes.update(1 / 60, h, { ...calme, dispersed: true }, tirage())
    for (let m = 0; m < motes.n; m++) expect(motes.alpha[m]).toBe(0)
  })
})

describe("la lueur d'une goutte perdue", () => {
  it("est nulle pour une goutte qui n'a jamais été lui", () => {
    expect(lueurGoutte(1.2, 1.2, 0)).toBe(0)
  })
  it("brille fraîche, s'éteint quand le délai expire — sauf la braise à portée", () => {
    expect(lueurGoutte(1.2, 1.2, 1)).toBe(1)
    expect(lueurGoutte(0.6, 1.2, 1)).toBeCloseTo(0.25)
    expect(lueurGoutte(0, 1.2, 1)).toBe(0)
    expect(lueurGoutte(0, 1.2, 2)).toBeCloseTo(0.3)
  })
})

describe('le tampon de vie', () => {
  it('écrit les motes puis une lueur par goutte détachée, et rien pour le corps', () => {
    const motes = new Motes(4, tirage())
    const h = corps()
    for (let k = 0; k < 60; k++) motes.update(1 / 60, h, calme, tirage())
    h.duCorps[10] = 1
    h.cooldown[10] = 1.2
    h.duCorps[11] = 2 // dans le halo, délai expiré : la braise
    const out = new Float32Array(64 * VIE_STRIDE)
    const n = remplitVie(out, motes, h, 1.2)
    expect(n).toBe(6)
    for (let p = 0; p < 4; p++) expect(out[p * VIE_STRIDE + 3]).toBe(GENRE_MOTE)
    expect(out[4 * VIE_STRIDE + 3]).toBe(GENRE_LUEUR)
    expect(out[4 * VIE_STRIDE + 4]).toBe(1)
    expect(out[5 * VIE_STRIDE + 4]).toBeCloseTo(0.3)
  })
  it('respecte la capacité du tampon', () => {
    const motes = new Motes(4, tirage())
    const h = corps()
    for (let k = 0; k < 60; k++) motes.update(1 / 60, h, calme, tirage())
    const out = new Float32Array(2 * VIE_STRIDE)
    expect(remplitVie(out, motes, h, 1.2)).toBe(2)
  })
})

describe('le toucher du corps', () => {
  it('vaut sur une goutte du corps, pas sur l’eau libre ni le vide', () => {
    const h = corps()
    expect(toucheLeCorps(120, 100, h, 14)).toBe(true) // la goutte 0 est en (120, 100)
    expect(toucheLeCorps(900, 900, h, 14)).toBe(false) // eau libre
    expect(toucheLeCorps(500, 500, h, 14)).toBe(false) // rien
  })
})
