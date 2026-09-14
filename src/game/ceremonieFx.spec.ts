import { describe, expect, it } from 'vitest'
import { Feu, PLAFOND_PARTICULES } from './ceremonieFx'

/** Un hasard figé : la même suite à chaque test. */
function alea(graine = 7): () => number {
  let s = graine
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

describe('le feu de la cérémonie', () => {
  it('jette autant de particules que demandé, au point voulu', () => {
    const f = new Feu()
    f.eclate(100, 50, { n: 24, teintes: ['#fff'], vitesse: 300 }, alea())
    expect(f.particules).toHaveLength(24)
    expect(f.vivant).toBe(true)
    for (const p of f.particules) {
      expect(p.x).toBe(100)
      expect(p.y).toBe(50)
      expect(p.age).toBe(0)
      expect(p.teinte).toBe('#fff')
    }
  })

  it('s’éteint de lui-même : plus rien après la plus longue vie', () => {
    const f = new Feu()
    f.eclate(0, 0, { n: 40, teintes: ['#fff'], vitesse: 200, duree: 0.8 }, alea())
    const plusLongue = Math.max(...f.particules.map((p) => p.duree))
    expect(plusLongue).toBeLessThan(0.8 * 1.4 + 1e-9) // la vie s'étale autour de la moyenne
    let t = 0
    while (t < plusLongue + 0.05) {
      f.pas(1 / 60)
      t += 1 / 60
    }
    expect(f.particules).toHaveLength(0)
    expect(f.vivant).toBe(false)
  })

  it('tombe sous la gravité et freine : une particule lancée vers le haut redescend', () => {
    const f = new Feu()
    f.eclate(0, 0, { n: 1, teintes: ['#fff'], vitesse: 400, gravite: 800, duree: 3, cone: { angle: -Math.PI / 2, ouverture: 0 } }, alea())
    const p = f.particules[0]
    expect(p.vy).toBeLessThan(0) // vers le haut (l'écran a l'axe Y vers le bas)
    for (let i = 0; i < 60; i++) f.pas(1 / 60)
    expect(p.vy).toBeGreaterThan(0) // une seconde plus tard, elle retombe
  })

  it('les éclats sans gravité flottent : leur hauteur ne dérive pas', () => {
    const f = new Feu()
    f.eclate(0, 0, { n: 1, teintes: ['#fff'], vitesse: 100, gravite: 0, duree: 3, cone: { angle: 0, ouverture: 0 } }, alea())
    for (let i = 0; i < 30; i++) f.pas(1 / 60)
    expect(f.particules[0].y).toBeCloseTo(0, 6)
    expect(f.particules[0].x).toBeGreaterThan(0)
  })

  it('borne un pas de temps fou : l’onglet revenu après une minute ne projette rien hors de l’écran', () => {
    const f = new Feu()
    f.eclate(0, 0, { n: 1, teintes: ['#fff'], vitesse: 100, gravite: 0, duree: 30, cone: { angle: 0, ouverture: 0 } }, alea())
    f.pas(60)
    expect(f.particules[0].x).toBeLessThan(20) // un pas de 50 ms au plus
  })

  it('ne dépasse jamais le plafond — les plus vieilles cèdent la place', () => {
    const f = new Feu()
    f.eclate(0, 0, { n: 500, teintes: ['#a'], vitesse: 100 }, alea())
    f.pas(0.1)
    f.eclate(0, 0, { n: 700, teintes: ['#b'], vitesse: 100 }, alea())
    expect(f.particules).toHaveLength(PLAFOND_PARTICULES)
    // les 700 neuves sont toutes là, ce sont des vieilles qui ont sauté
    expect(f.particules.filter((p) => p.teinte === '#b')).toHaveLength(700)
    expect(f.particules[0].age).toBeGreaterThan(0)
  })

  it('un cône lance dans la direction demandée', () => {
    const f = new Feu()
    f.eclate(0, 0, { n: 50, teintes: ['#fff'], vitesse: 100, cone: { angle: 0, ouverture: 0.4 } }, alea())
    for (const p of f.particules) {
      expect(p.vx).toBeGreaterThan(0)
      expect(Math.abs(p.vy)).toBeLessThan(p.vx)
    }
  })

  it('se vide d’un geste à la fermeture de la cérémonie', () => {
    const f = new Feu()
    f.eclate(0, 0, { n: 10, teintes: ['#fff'], vitesse: 100 }, alea())
    f.vide()
    expect(f.vivant).toBe(false)
  })
})
