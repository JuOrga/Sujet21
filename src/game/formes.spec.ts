// Les formes d'obstacle : le contrat du champ signé (dist < 0 dedans,
// gradient normalisé sortant) doit tenir pour chaque forme, rotation
// comprise — c'est tout ce que la physique consomme.

import { describe, expect, it } from 'vitest'
import {
  ARC_BOUT_DROIT,
  ARC_BOUT_POINTE,
  ARC_BOUT_ROND,
  FORME_ARC,
  FORME_CAPSULE,
  FORME_COIN,
  FORME_DISQUE,
  arcRayons,
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
      {
        minX: 0,
        minY: 0,
        maxX: 300,
        maxY: 280,
        forme: FORME_ARC,
        p0: 0.4,
        p1: 120,
        p2: ARC_BOUT_DROIT,
        angle: -30,
      },
      {
        minX: 0,
        minY: 0,
        maxX: 300,
        maxY: 280,
        forme: FORME_ARC,
        p0: 0.4,
        p1: 120,
        p2: ARC_BOUT_POINTE,
        angle: 210,
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

describe('formes — les BOUTS de l’arc (p2)', () => {
  // le même arc dans les trois finitions — même boîte, même ouverture. La
  // boîte collant à CHAQUE silhouette, chacune a sa propre mise à l’échelle :
  // on interroge donc chaque forme dans SON espace unitaire.
  const boite = { minX: -150, minY: -150, maxX: 150, maxY: 150 }
  const arc = (p2?: number): FormeBox => ({
    ...boite,
    forme: FORME_ARC,
    p0: 0.4,
    p1: 90,
    ...(p2 ? { p2 } : {}),
  })
  // un point donné en unitaire, ramené au monde par les échelles de SA boîte
  const monde = (b: FormeBox, ux: number, uy: number): [number, number] => {
    const { cu, sx, sy } = arcRayons(b)
    return [
      (b.minX + b.maxX) / 2 + (ux - cu) * sx,
      (b.minY + b.maxY) / 2 + uy * sy,
    ]
  }

  it('la calotte ronde déborde le plan de coupe — les bouts droits et pointus, non', () => {
    // juste au-DELÀ du plan de coupe, sur le rayon médian : dans la calotte
    // ronde (qui déborde), hors de la coupe franche et hors de la griffe
    const auDela = (b: FormeBox): boolean => {
      const { rm, ht, ouverture } = arcRayons(b)
      const c = Math.cos(ouverture)
      const s2 = Math.sin(ouverture)
      const [px, py] = monde(b, rm * c - 0.5 * ht * s2, rm * s2 + 0.5 * ht * c)
      return dansForme(b, px, py)
    }
    expect(auDela(arc())).toBe(true)
    expect(auDela(arc(ARC_BOUT_DROIT))).toBe(false)
    expect(auDela(arc(ARC_BOUT_POINTE))).toBe(false)
  })

  it('la griffe s’effile : à mi-tranchant, la pleine épaisseur n’y est plus', () => {
    // à mi-chemin des tranchants, à 80 % de l’épaisseur vers l’extérieur :
    // encore dans la bande pour les deux autres finitions, déjà dehors pour
    // la griffe — ses tranchants ont ramené le bord vers le rayon médian
    const epais = (b: FormeBox): boolean => {
      const { rm, ht, ouverture, taper } = arcRayons(b)
      const a = ouverture - taper / 2
      const L = rm + ht * 0.8
      const [px, py] = monde(b, L * Math.cos(a), L * Math.sin(a))
      return dansForme(b, px, py)
    }
    expect(epais(arc())).toBe(true)
    expect(epais(arc(ARC_BOUT_DROIT))).toBe(true)
    expect(epais(arc(ARC_BOUT_POINTE))).toBe(false)
    // le cœur de l’arc, loin des bouts : dedans dans les trois finitions
    for (const p2 of [undefined, ARC_BOUT_DROIT, ARC_BOUT_POINTE]) {
      const b = arc(p2)
      const { rm } = arcRayons(b)
      const [px, py] = monde(b, rm, 0)
      expect(dansForme(b, px, py)).toBe(true)
    }
  })

  it('coupe franche : la normale au bout est PERPENDICULAIRE à la courbe', () => {
    const b = arc(ARC_BOUT_DROIT)
    const { rm, ouverture } = arcRayons(b)
    // légèrement DANS la bande, contre la coupe : la normale du contact doit
    // être celle du plan de coupe (−sin, cos)
    const a = ouverture - 0.02
    const [px, py] = monde(b, rm * Math.cos(a), rm * Math.sin(a))
    const c = contact(b, px, py)
    expect(c.dist).toBeLessThan(0)
    const attX = -Math.sin(ouverture)
    const attY = Math.cos(ouverture)
    expect(c.nx * attX + c.ny * attY).toBeGreaterThan(0.98)
  })
})

describe('formes — la BOÎTE colle à l’arc, bouts compris', () => {
  // Pour chaque finition, la boîte doit être la boîte englobante EXACTE :
  // rien ne dépasse (sinon la physique et le rendu rejettent à tort), et
  // chaque côté est TOUCHÉ (sinon il reste de la marge morte — signalé).
  const boite = { minX: -150, minY: -140, maxX: 150, maxY: 140 }
  const cas = [
    { p1: 45, p0: 0.3 },
    { p1: 90, p0: 0.35 },
    { p1: 110, p0: 0.4 },
    { p1: 150, p0: 0.5 },
    { p1: 180, p0: 0.35 },
  ]
  const PAS = 0.1 // le pas d’échantillonnage le long d’un côté

  // balaye une ligne parallèle au côté, décalée de `dedans` vers l’intérieur
  // (négatif : vers l’extérieur) — vrai si la forme est présente sur la ligne
  const cote = (
    b: FormeBox,
    axe: 'x' | 'y',
    bord: number,
    dedans: number,
  ): boolean => {
    const v = bord + dedans
    const de = axe === 'x' ? b.minY : b.minX
    const a = axe === 'x' ? b.maxY : b.maxX
    for (let t = de; t <= a; t += PAS) {
      const px = axe === 'x' ? v : t
      const py = axe === 'x' ? t : v
      if (dansForme(b, px, py)) return true
    }
    return false
  }

  for (const bout of [ARC_BOUT_ROND, ARC_BOUT_DROIT, ARC_BOUT_POINTE]) {
    it(`bout ${bout} : rien ne dépasse, et les quatre côtés sont touchés`, () => {
      for (const c of cas) {
        const b: FormeBox = {
          ...boite,
          forme: FORME_ARC,
          p0: c.p0,
          p1: c.p1,
          ...(bout ? { p2: bout } : {}),
        }
        const quoi = `bout ${bout}, ouverture ${c.p1}`
        // DEHORS : un cheveu au-delà de chaque côté, plus rien
        const dehors = [
          `sort à gauche : ${cote(b, 'x', b.minX, -0.6)}`,
          `sort à droite : ${cote(b, 'x', b.maxX, 0.6)}`,
          `sort en bas : ${cote(b, 'y', b.minY, -0.6)}`,
          `sort en haut : ${cote(b, 'y', b.maxY, 0.6)}`,
        ].join(' · ')
        expect(`${quoi} · ${dehors}`).toBe(
          `${quoi} · sort à gauche : false · sort à droite : false · sort en bas : false · sort en haut : false`,
        )
        // DEDANS : un cheveu en deçà, la forme est là — le côté est touché
        const touche = [
          `touche à gauche : ${cote(b, 'x', b.minX, 0.8)}`,
          `touche à droite : ${cote(b, 'x', b.maxX, -0.8)}`,
          `touche en bas : ${cote(b, 'y', b.minY, 0.8)}`,
          `touche en haut : ${cote(b, 'y', b.maxY, -0.8)}`,
        ].join(' · ')
        expect(`${quoi} · ${touche}`).toBe(
          `${quoi} · touche à gauche : true · touche à droite : true · touche en bas : true · touche en haut : true`,
        )
      }
    })
  }
})
