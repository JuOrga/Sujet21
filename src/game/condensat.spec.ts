// Le condensat ramassable : le semis est déterministe et propre (jamais
// dans une paroi, les cachettes servies d'abord), l'absorption se joue au
// contact d'assez de particules du corps.
import { describe, expect, it } from 'vitest'
import {
  absorbePastilles,
  semeFiole,
  semePastilles,
  type CorpsLecture,
} from './condensat'
import { dansForme, type FormeBox } from './formes'
import type { LevelDef } from './level'

function cuve(sur: Partial<LevelDef> = {}): LevelDef {
  return {
    name: 'Essai',
    code: '21-T',
    journal: '',
    bounds: { minX: -2000, minY: -1200, maxX: 2000, maxY: 1200 },
    spawn: { x: -1700, y: 0, n: 900 },
    exit: { minX: 1700, minY: -100, maxX: 1900, maxY: 100 },
    boxes: [
      { minX: -400, minY: -1200, maxX: -200, maxY: 600, material: 0 },
      { minX: 600, minY: -600, maxX: 800, maxY: 1200, material: 0 },
    ],
    sponges: [],
    labels: [],
    caches: [{ minX: 900, minY: -1100, maxX: 1500, maxY: -500 }],
    ...sur,
  }
}

function corps(points: [number, number][]): CorpsLecture {
  return {
    count: points.length,
    kind: new Uint8Array(points.map(() => 1)),
    posX: new Float32Array(points.map((p) => p[0])),
    posY: new Float32Array(points.map((p) => p[1])),
  }
}

describe('le condensat ramassable', () => {
  it('le semis est déterministe : même code, mêmes pastilles', () => {
    const a = semePastilles(cuve())
    const b = semePastilles(cuve())
    expect(a.length).toBeGreaterThanOrEqual(3) // la cachette + le champ
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    // un autre code sème ailleurs
    const c = semePastilles(cuve({ code: '21-U' }))
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a))
  })

  it('aucune pastille dans une paroi, loin du départ et du sas', () => {
    const lv = cuve()
    for (const p of semePastilles(lv)) {
      for (const b of lv.boxes) {
        expect(dansForme(b as unknown as FormeBox, p.x, p.y)).toBe(false)
      }
      const horsCache = !(p.x > 900 && p.x < 1500 && p.y > -1100 && p.y < -500)
      if (horsCache) {
        expect(Math.hypot(p.x - lv.spawn.x, p.y - lv.spawn.y)).toBeGreaterThan(
          400,
        )
      }
    }
  })

  it('la cachette reçoit sa pastille, et elle vaut plus que le champ', () => {
    const lv = cuve()
    const enCache = semePastilles(lv).filter(
      (p) => p.x > 900 && p.x < 1500 && p.y > -1100 && p.y < -500,
    )
    expect(enCache.length).toBeGreaterThanOrEqual(1)
    for (const p of enCache) expect(p.cl).toBe(12)
  })

  it('les pastilles posées main remplacent le semis', () => {
    const lv = cuve({ condensats: [{ x: 0, y: 900, cl: 40 }] })
    const p = semePastilles(lv)
    expect(p).toEqual([{ x: 0, y: 900, cl: 40 }])
  })

  it('la FIOLE dort dans la cachette profonde — déterministe, jamais murée', () => {
    // sans cachette assez vaste : pas de fiole
    expect(semeFiole(cuve({ caches: [] }))).toBeNull()
    // avec la grande cachette : le même code rend la même réponse
    const a = semeFiole(cuve())
    expect(JSON.stringify(semeFiole(cuve()))).toBe(JSON.stringify(a))
    // sur plusieurs codes, au moins un tableau en abrite une — et alors
    // elle est DANS la cachette, hors des parois
    let vues = 0
    for (const code of ['21-T', '21-U', '21-V', '21-W', '21-X', '21-Y']) {
      const lv = cuve({ code })
      const f = semeFiole(lv)
      if (!f) continue
      vues++
      expect(f.x).toBeGreaterThan(900)
      expect(f.x).toBeLessThan(1500)
      expect(f.y).toBeGreaterThan(-1100)
      expect(f.y).toBeLessThan(-500)
      for (const b of lv.boxes)
        expect(dansForme(b as unknown as FormeBox, f.x, f.y)).toBe(false)
    }
    expect(vues).toBeGreaterThanOrEqual(1)
  })

  it('l’absorption exige le CONTACT d’assez de particules du corps', () => {
    const pastilles = [{ x: 0, y: 0, cl: 8 }]
    // trop peu de particules à portée : rien ne se boit
    const prises1 = [false]
    expect(
      absorbePastilles(
        pastilles,
        prises1,
        corps([
          [10, 0],
          [0, 10],
        ]),
      ),
    ).toEqual([])
    expect(prises1).toEqual([false])
    // cinq particules au contact : la pastille est bue, une seule fois
    const tas: [number, number][] = [
      [8, 0],
      [-8, 4],
      [0, -9],
      [12, 6],
      [-5, -6],
    ]
    const prises2 = [false]
    expect(absorbePastilles(pastilles, prises2, corps(tas))).toEqual([0])
    expect(prises2).toEqual([true])
    expect(absorbePastilles(pastilles, prises2, corps(tas))).toEqual([])
    // les particules qui ne sont pas le CORPS (kind 0) ne comptent pas
    const libre = corps(tas)
    libre.kind.fill(0)
    const prises3 = [false]
    expect(absorbePastilles(pastilles, prises3, libre)).toEqual([])
  })
})
