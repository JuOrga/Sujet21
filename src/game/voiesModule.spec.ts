import { describe, expect, it } from 'vitest'
import { aleaDeGraine } from './voie'
import { dessinMiniCarteSVG, portesDuRang, tisseMiniCarte, VOIES } from './voiesModule'

const tisse = (graine: string, niveaux = 3, permises: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3], ecrites = true) =>
  tisseMiniCarte(niveaux, aleaDeGraine(graine), permises, () => 2, { debut: 1, suite: 2 }, ecrites)

describe('tisseMiniCarte — la grille de voies d’un module', () => {
  it('trois voies par rang, autant de rangs que de salles, et rien pour un module sans salle', () => {
    const mc = tisse('a')
    expect(mc.voies).toBe(VOIES)
    expect(mc.rangs).toHaveLength(3)
    for (const r of mc.rangs) expect(r.map((n) => n.voie)).toEqual([0, 1, 2])
    expect(tisse('a', 0).rangs).toEqual([])
  })

  it('se retisse à l’identique depuis la même graine, autrement depuis une autre', () => {
    expect(tisse('jour@S1')).toEqual(tisse('jour@S1'))
    const autres = [1, 2, 3, 4, 5].map((i) => JSON.stringify(tisse(`g${i}`)))
    expect(new Set(autres).size).toBeGreaterThan(1)
  })

  it('aucune voie morte : tout nœud mène au rang suivant, tout nœud d’un rang suivant a un prédécesseur', () => {
    for (let i = 0; i < 40; i++) {
      const mc = tisse(`t${i}`, 4)
      for (let r = 0; r < mc.rangs.length; r++)
        for (const nd of mc.rangs[r]) {
          if (r < mc.rangs.length - 1) {
            expect(nd.suivants.length).toBeGreaterThan(0)
            expect(nd.suivants).toContain(nd.voie) // tout droit, toujours
            for (const s of nd.suivants) expect(Math.abs(s - nd.voie)).toBeLessThanOrEqual(1)
            expect([...nd.suivants].sort()).toEqual(nd.suivants)
          } else expect(nd.suivants).toEqual([])
          if (r > 0) expect(mc.rangs[r - 1].some((p) => p.suivants.includes(nd.voie))).toBe(true)
        }
    }
  })

  it('une voie du pool par rang quand les tableaux écrits tiennent, aucune sinon ; les mécaniques restent permises', () => {
    const avec = tisse('p', 3, [0, 1])
    for (const r of avec.rangs) {
      expect(r.filter((n) => n.ecrite)).toHaveLength(1)
      for (const n of r) expect([0, 1]).toContain(n.mecanique)
    }
    const sans = tisse('p', 3, [0, 1], false)
    for (const r of sans.rangs) expect(r.some((n) => n.ecrite)).toBe(false)
  })

  it('les figures suivent le réglage du plan : deux par rang au milieu', () => {
    const mc = tisse('f')
    for (const r of mc.rangs) expect(r.filter((n) => n.figure)).toHaveLength(2)
  })
})

describe('portesDuRang — ce qu’on peut ouvrir', () => {
  it('au premier rang les trois voies, ensuite celles que le nœud d’avant annonce', () => {
    const mc = tisse('q', 3)
    expect(portesDuRang(mc, 0, null).map((n) => n.voie)).toEqual([0, 1, 2])
    const depuis = mc.rangs[0][1]
    expect(portesDuRang(mc, 1, 1).map((n) => n.voie)).toEqual(depuis.suivants)
    // origine inconnue (sauvegarde d'avant les voies) : les trois
    expect(portesDuRang(mc, 1, null)).toHaveLength(3)
    expect(portesDuRang(mc, 1, 7)).toHaveLength(3)
    // hors de la grille : rien
    expect(portesDuRang(mc, 3, 0)).toEqual([])
  })
})

describe('dessinMiniCarteSVG — la grille dessinée', () => {
  it('un nœud par salle et par voie, les portes et le chemin joué marqués', () => {
    const mc = tisse('d', 3)
    const svg = dessinMiniCarteSVG(mc, { rang: 1, trace: [2], portes: mc.rangs[0][2].suivants })
    expect(svg.startsWith('<svg')).toBe(true)
    expect((svg.match(/class="mv-noeud[ "]/g) ?? []).length).toBe(9)
    expect((svg.match(/mv-noeud mv-joue/g) ?? []).length).toBe(1)
    expect((svg.match(/ mv-porte"/g) ?? []).length).toBe(mc.rangs[0][2].suivants.length)
    expect(svg).toContain('SALLE 3')
    expect(dessinMiniCarteSVG(tisse('d', 0), { rang: 0, trace: [], portes: [] })).toBe('')
  })
})
