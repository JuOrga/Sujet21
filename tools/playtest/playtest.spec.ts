import { describe, expect, it } from 'vitest'
import {
  EPONGE,
  SOLIDE,
  celluleDe,
  champDepuisLeSas,
  construitGrille,
  directionVersLeSas,
  distanceAuSas,
  distanceAuxParois,
  indice,
  largeurDuPassage,
} from './carte'
import { audite } from './audit'
import { avance, nouveauMonde, verdictCourant, volumeLivre } from './monde'
import { REGLAGES, joue, reussi } from './pilote'
import { compare, type Rapport } from './rapport'
import { MAT_WALL, type LevelDef } from '../../src/game/level'

/** Une salle nue de 1200 × 600, le corps à gauche, le sas à droite. Assez
 *  petite pour que les essais tiennent en quelques secondes. */
function salle(boxes: LevelDef['boxes'] = []): LevelDef {
  return {
    name: 'banc',
    code: 'TEST',
    journal: '',
    bounds: { minX: -600, minY: -300, maxX: 600, maxY: 300 },
    spawn: { x: -450, y: 0, n: 300 },
    exit: { minX: 440, minY: -80, maxX: 560, maxY: 80 },
    boxes,
    sponges: [],
    labels: [],
  }
}

const mur = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): LevelDef['boxes'][number] => ({ minX, minY, maxX, maxY, material: MAT_WALL })

describe('carte — la grille et le champ de flux', () => {
  it('rastérise une paroi et laisse le reste libre', () => {
    const g = construitGrille(salle([mur(-40, -300, 40, 300)]))
    const [cx, cy] = celluleDe(g, 0, 0)
    expect(g.cells[indice(g, cx, cy)]).toBe(SOLIDE)
    const [lx, ly] = celluleDe(g, -400, 0)
    expect(g.cells[indice(g, lx, ly)]).not.toBe(SOLIDE)
  })

  it('marque une éponge traversable, jamais solide', () => {
    const lv = salle()
    lv.sponges = [
      { minX: -40, minY: -300, cols: 3, rows: 25, cellSize: 24, capacityPerCell: 5 },
    ]
    const g = construitGrille(lv)
    const [cx, cy] = celluleDe(g, 0, 0)
    expect(g.cells[indice(g, cx, cy)]).toBe(EPONGE)
  })

  it('déclare le sas inatteignable derrière une cloison pleine', () => {
    const lv = salle([mur(200, -300, 260, 300)])
    const champ = champDepuisLeSas(construitGrille(lv), lv)
    expect(distanceAuSas(champ, lv.spawn.x, lv.spawn.y)).toBe(Infinity)
  })

  it('trouve la brèche d’une cloison percée', () => {
    const lv = salle([mur(200, -300, 260, -60), mur(200, 60, 260, 300)])
    const champ = champDepuisLeSas(construitGrille(lv), lv)
    expect(distanceAuSas(champ, lv.spawn.x, lv.spawn.y)).toBeLessThan(Infinity)
  })

  it('pointe le cap DROIT vers le sas en salle nue, sans biais diagonal', () => {
    // La régression que ce test verrouille : prendre le minimum d'une fenêtre
    // carrée sur un champ presque plat rendait le premier minimum balayé,
    // donc un cap systématiquement en diagonale.
    const lv = salle()
    const champ = champDepuisLeSas(construitGrille(lv), lv)
    const d = directionVersLeSas(champ, lv.spawn.x, 0, 4)
    expect(d).not.toBeNull()
    expect(d?.x).toBeGreaterThan(0.9)
    expect(Math.abs(d?.y ?? 1)).toBeLessThan(0.2)
  })

  it('mesure la section du plus large passage', () => {
    const lv = salle([mur(200, -300, 260, -60), mur(200, 60, 260, 300)])
    const g = construitGrille(lv)
    const largeur = largeurDuPassage(
      g,
      distanceAuxParois(g),
      lv,
      lv.spawn.x,
      lv.spawn.y,
    ) * 2
    // la brèche fait 120 u de haut ; la mesure passe par une grille de 12
    expect(largeur).toBeGreaterThan(80)
    expect(largeur).toBeLessThan(160)
  })
})

describe('audit — les contrôles sans simulation', () => {
  it('ne trouve rien à redire à une salle saine', () => {
    const a = audite(salle())
    expect(a.constats.filter((c) => c.gravite === 'erreur')).toEqual([])
    expect(a.accessible).toBe(true)
    expect(a.etatsQuiPassent).toContain('eau')
  })

  it('lève une erreur quand le sas est muré dans tous les états', () => {
    const a = audite(salle([mur(200, -300, 260, 300)]))
    expect(a.etatsQuiPassent).toEqual([])
    expect(a.constats.map((c) => c.code)).toContain('sas-inatteignable')
  })

  it('lève une erreur quand le corps naît dans une paroi', () => {
    const a = audite(salle([mur(-500, -100, -400, 100)]))
    expect(a.constats.map((c) => c.code)).toContain('spawn-mure')
  })

  it('mesure un diamètre de corps plausible', () => {
    const a = audite(salle())
    expect(a.diametreCorps).toBeGreaterThan(20)
    expect(a.diametreCorps).toBeLessThan(400)
  })
})

describe('monde — le tableau sans navigateur', () => {
  it('rejoue à l’identique : deux parties menées pareil finissent pareil', () => {
    // C'est l'hypothèse sur laquelle repose tout l'outil : sans déterminisme,
    // une différence entre deux exécutions ne prouverait rien.
    const trace = (): string => {
      const m = nouveauMonde(salle())
      for (let s = 0; s < 600; s++) {
        const c = m.sim.stats
        avance(m, s < 240 ? { x: c.centroidX - 300, y: c.centroidY } : null)
      }
      return `${m.sim.stats.centroidX.toFixed(6)}|${m.sim.playerCount}|${volumeLivre(m).toFixed(6)}`
    }
    expect(trace()).toBe(trace())
  })

  it('conclut quand le sas a bu le corps', () => {
    const m = nouveauMonde(salle())
    for (let s = 0; s < 4000 && verdictCourant(m) === 'encours'; s++) {
      const c = m.sim.stats
      avance(m, s < 300 ? { x: c.centroidX - 300, y: c.centroidY } : null)
    }
    expect(['bu', 'atteint']).toContain(verdictCourant(m))
  })
})

describe('pilote — le bot qui joue', () => {
  it('franchit une salle nue et y laisse l’essentiel de son volume', () => {
    const e = joue(salle(), REGLAGES[0], { tempsMax: 60 })
    expect(reussi(e.verdict)).toBe(true)
    expect(e.impulsions).toBeGreaterThan(0)
    expect(e.rendement).toBeGreaterThan(0.4)
  })

  it('contourne une cloison percée', () => {
    const lv = salle([mur(0, -300, 60, -60), mur(0, 60, 60, 300)])
    const e = joue(lv, REGLAGES[0], { tempsMax: 90 })
    expect(reussi(e.verdict)).toBe(true)
  })
})

describe('rapport — la comparaison à une référence', () => {
  const ligne = (accessible: boolean, verdict: 'bu' | 'bloque'): Rapport => ({
    genere: '',
    tableaux: [
      {
        code: 'TEST',
        nom: 'banc',
        audit: {
          code: 'TEST',
          nom: 'banc',
          constats: [],
          accessible,
          etatsQuiPassent: accessible ? ['eau'] : [],
          largeurPassage: 100,
          diametreCorps: 80,
        },
        essais: [
          {
            reglage: 'économe',
            verdict,
            temps: 10,
            impulsions: 2,
            litres: 1,
            rendement: 0.8,
            distanceDepart: 100,
            distanceMin: 0,
          },
        ],
      },
    ],
  })

  it('signale un sas devenu inatteignable', () => {
    const ecarts = compare(ligne(true, 'bu'), ligne(false, 'bloque'))
    expect(ecarts.some((e) => e.gravite === 'regression')).toBe(true)
  })

  it('ne signale rien quand rien ne bouge', () => {
    expect(compare(ligne(true, 'bu'), ligne(true, 'bu'))).toEqual([])
  })
})
