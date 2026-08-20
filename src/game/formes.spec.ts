// Les formes d'obstacle : le contrat du champ signé (dist < 0 dedans,
// gradient normalisé sortant) doit tenir pour chaque forme, rotation
// comprise — c'est tout ce que la physique consomme.

import { describe, expect, it } from 'vitest'
import {
  FORME_ARC,
  FORME_CAPSULE,
  FORME_COIN,
  FORME_DISQUE,
  dansForme,
  formeContact,
  formeOutline,
  type FormeBox,
  type FormeContact,
} from './formes'

const out: FormeContact = { dist: 0, nx: 0, ny: 1 }

function contact(b: FormeBox, x: number, y: number): FormeContact {
  formeContact(x, y, b, out)
  return { ...out }
}

describe('formes — disque', () => {
  const b: FormeBox = {
    minX: -100,
    minY: -50,
    maxX: 100,
    maxY: 50,
    forme: FORME_DISQUE,
  }

  it('cercle exact quand la boîte est carrée', () => {
    const c: FormeBox = {
      minX: -50,
      minY: -50,
      maxX: 50,
      maxY: 50,
      forme: FORME_DISQUE,
    }
    expect(contact(c, 80, 0).dist).toBeCloseTo(30, 5)
    expect(contact(c, 0, 20).dist).toBeCloseTo(-30, 5)
    const r = contact(c, 30, 40) // sur le cercle (rayon 50)
    expect(r.dist).toBeCloseTo(0, 5)
    expect(Math.hypot(r.nx, r.ny)).toBeCloseTo(1, 6)
    expect(r.nx).toBeCloseTo(0.6, 5)
    expect(r.ny).toBeCloseTo(0.8, 5)
  })

  it("l'ellipse remplit sa boîte sur les axes, pas dans les coins", () => {
    expect(dansForme(b, 99, 0)).toBe(true)
    expect(dansForme(b, 0, 49)).toBe(true)
    expect(dansForme(b, 90, 45)).toBe(false)
    expect(dansForme(b, 101, 0)).toBe(false)
  })

  it('le gradient reste normalisé partout', () => {
    for (const [x, y] of [
      [140, 30],
      [10, 5],
      [-60, 20],
      [0, 80],
    ]) {
      const r = contact(b, x, y)
      expect(Math.hypot(r.nx, r.ny)).toBeCloseTo(1, 5)
    }
  })
})

describe('formes — capsule', () => {
  const b: FormeBox = {
    minX: 0,
    minY: 0,
    maxX: 300,
    maxY: 100,
    forme: FORME_CAPSULE,
  }

  it('segment sur le grand axe, bouts ronds', () => {
    // au milieu : épaisseur pleine (rayon 50 autour de y = 50)
    expect(contact(b, 150, 120).dist).toBeCloseTo(20, 5)
    expect(contact(b, 150, 50).dist).toBeCloseTo(-50, 5)
    // au bout : le coin de la boîte est HORS de la capsule
    expect(dansForme(b, 2, 2)).toBe(false)
    // le bout rond : centre (250, 50), rayon 50
    expect(contact(b, 340, 50).dist).toBeCloseTo(40, 5)
  })

  it('verticale quand la boîte est haute', () => {
    const v: FormeBox = {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 300,
      forme: FORME_CAPSULE,
    }
    expect(contact(v, 120, 150).dist).toBeCloseTo(20, 5)
    expect(dansForme(v, 50, 290)).toBe(true)
    expect(dansForme(v, 5, 295)).toBe(false)
  })
})

describe('formes — coin', () => {
  const b: FormeBox = {
    minX: 0,
    minY: 0,
    maxX: 100,
    maxY: 100,
    forme: FORME_COIN,
  }

  it("orientation 0 : l'angle droit en bas-gauche, l'hypoténuse au nord-est", () => {
    expect(dansForme(b, 10, 10)).toBe(true)
    expect(dansForme(b, 90, 90)).toBe(false)
    // sur l'hypoténuse x + y = 100
    expect(contact(b, 50, 50).dist).toBeCloseTo(0, 5)
    const r = contact(b, 80, 80)
    expect(r.dist).toBeCloseTo(Math.hypot(30, 30), 5)
    expect(r.nx).toBeCloseTo(Math.SQRT1_2, 5)
    expect(r.ny).toBeCloseTo(Math.SQRT1_2, 5)
  })

  it('les quatre orientations couvrent les quatre coins', () => {
    expect(dansForme({ ...b, p0: 1 }, 90, 10)).toBe(true)
    expect(dansForme({ ...b, p0: 1 }, 10, 90)).toBe(false)
    expect(dansForme({ ...b, p0: 2 }, 90, 90)).toBe(true)
    expect(dansForme({ ...b, p0: 2 }, 10, 10)).toBe(false)
    expect(dansForme({ ...b, p0: 3 }, 10, 90)).toBe(true)
    expect(dansForme({ ...b, p0: 3 }, 90, 10)).toBe(false)
  })

  it('dedans : la normale pousse vers la sortie la plus proche', () => {
    const r = contact(b, 5, 40) // près du bord gauche
    expect(r.dist).toBeCloseTo(-5, 5)
    expect(r.nx).toBeCloseTo(-1, 5)
    expect(r.ny).toBeCloseTo(0, 5)
  })
})

describe('formes — arc', () => {
  // Boîte carrée 400×400, demi-ouverture 90°, épaisseur 0,5. La boîte est la
  // boîte englobante EXACTE de l'arc, étiré en ellipse pour la remplir :
  // échelles (320, 200), centre unitaire 0,375 — les quatre bords touchent.
  const b: FormeBox = {
    minX: -200,
    minY: -200,
    maxX: 200,
    maxY: 200,
    forme: FORME_ARC,
    p0: 0.5,
    p1: 90,
  }

  it("demi-anneau ouvert vers -x : dedans sur l'axe +x, dehors au centre du trou", () => {
    expect(dansForme(b, 75, 0)).toBe(true) // au cœur de la bande radiale
    expect(dansForme(b, 0, 150)).toBe(true) // à +90° : encore dans l'ouverture
    expect(dansForme(b, 0, 0)).toBe(false) // le trou central (décalé avec l'arc)
    expect(dansForme(b, -150, 0)).toBe(false) // le côté ouvert
  })

  it('distances radiales exactes dans la bande (centre décalé compris)', () => {
    expect(contact(b, 250, 0).dist).toBeCloseTo(50, 4) // 50 u après le bord droit
    expect(contact(b, 0, 0).dist).toBeCloseTo(40, 4) // dans le trou central
    expect(contact(b, 75, 0).dist).toBeCloseTo(-34.9, 0) // au cœur de la bande
    const r = contact(b, 250, 0)
    expect(r.nx).toBeCloseTo(1, 5)
    expect(r.ny).toBeCloseTo(0, 5)
  })

  it('à épaisseur 1, le camembert est plein', () => {
    const plein: FormeBox = { ...b, p0: 1, p1: 45 }
    expect(dansForme(plein, 100, 0)).toBe(true)
    expect(dansForme(plein, 100, 60)).toBe(true) // ≈ 20° du centre unitaire : dans l'ouverture
    expect(dansForme(plein, -200, 0)).toBe(false) // plein ouest : hors ouverture
  })

  it('la boîte englobante est EXACTE : les quatre bords touchent l’arc', () => {
    expect(Math.abs(contact(b, 200, 0).dist)).toBeLessThan(1) // bord droit : sommet de l'arc
    expect(Math.abs(contact(b, -120, 200).dist)).toBeLessThan(1) // bord haut : le passage à +90°
    expect(Math.abs(contact(b, -120, -200).dist)).toBeLessThan(1) // bord bas
    expect(Math.abs(contact(b, -200, 150).dist)).toBeLessThan(1) // bord gauche : la calotte
  })
})

describe('formes — rotation', () => {
  it('le coin pivoté de 90° change de quadrant', () => {
    const b: FormeBox = {
      minX: -50,
      minY: -50,
      maxX: 50,
      maxY: 50,
      forme: FORME_COIN,
      angle: 90,
    }
    // orientation 0 sans rotation : bas-gauche ; +90° trigo : bas-droite
    expect(dansForme(b, 30, -30)).toBe(true)
    expect(dansForme(b, -30, 30)).toBe(false)
  })

  it("l'arc pivoté de 180° s'ouvre vers +x", () => {
    const b: FormeBox = {
      minX: -200,
      minY: -200,
      maxX: 200,
      maxY: 200,
      forme: FORME_ARC,
      p0: 0.5,
      p1: 90,
      angle: 180,
    }
    expect(dansForme(b, -75, 0)).toBe(true)
    expect(dansForme(b, 150, 0)).toBe(false)
  })

  it('la normale repivote avec la forme', () => {
    const b: FormeBox = {
      minX: -100,
      minY: -20,
      maxX: 100,
      maxY: 20,
      forme: FORME_CAPSULE,
      angle: 90,
    }
    // capsule verticale après rotation : un point à droite voit une normale +x
    const r = contact(b, 60, 0)
    expect(r.dist).toBeCloseTo(40, 5)
    expect(r.nx).toBeCloseTo(1, 5)
    expect(r.ny).toBeCloseTo(0, 4)
  })
})

describe('formes — le contour est cohérent avec le champ', () => {
  it('chaque point du contour est à distance quasi nulle', () => {
    const formes: FormeBox[] = [
      {
        minX: 0,
        minY: 0,
        maxX: 200,
        maxY: 120,
        forme: FORME_DISQUE,
        angle: 30,
      },
      {
        minX: 0,
        minY: 0,
        maxX: 260,
        maxY: 90,
        forme: FORME_CAPSULE,
        angle: -45,
      },
      {
        minX: 0,
        minY: 0,
        maxX: 150,
        maxY: 100,
        forme: FORME_COIN,
        p0: 2,
        angle: 15,
      },
      {
        minX: 0,
        minY: 0,
        maxX: 300,
        maxY: 300,
        forme: FORME_ARC,
        p0: 0.4,
        p1: 120,
        angle: 60,
      },
    ]
    for (const b of formes) {
      for (const p of formeOutline(b, 48)) {
        formeContact(p.x, p.y, b, out)
        // l'ellipse est un SDF approché : tolérance large mais bornée
        expect(Math.abs(out.dist)).toBeLessThan(
          (b.forme === FORME_DISQUE ? 0.06 : 0.001) * 300,
        )
      }
    }
  })
})
