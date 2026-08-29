import { describe, expect, it } from 'vitest'
import { dansBoite, MAT_GRILLE, MAT_WALL, type StructureDef } from './level'
import {
  boxesDeStructure,
  boxesDesStructures,
  coutStructures,
  chanfreinDe,
  interieurStructure,
  niveauExpanse,
  structureNeuve,
  structureViable,
  STRUCT_CHAMBRE,
  STRUCT_COULOIR,
} from './structures'
import { TABLEAU_HUB } from './hub'
import { checkLevel } from './levelIO'
import { accessible } from './generateur'

const chambre = (
  r: [number, number, number, number],
  extra: Partial<StructureDef> = {},
): StructureDef => ({
  type: STRUCT_CHAMBRE,
  minX: r[0],
  minY: r[1],
  maxX: r[2],
  maxY: r[3],
  ...extra,
})
const couloir = (
  r: [number, number, number, number],
  extra: Partial<StructureDef> = {},
): StructureDef => ({
  type: STRUCT_COULOIR,
  minX: r[0],
  minY: r[1],
  maxX: r[2],
  maxY: r[3],
  ...extra,
})

/** De la matière en ce point ? (formes et angles compris) */
const matiere = (boxes: ReturnType<typeof boxesDesStructures>, x: number, y: number) =>
  boxes.some((b) => dansBoite(b, x, y))

/** Le segment traverse-t-il du vide de bout en bout ? */
const libre = (
  boxes: ReturnType<typeof boxesDesStructures>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean => {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    if (matiere(boxes, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false
  }
  return true
}

describe('les structures de coque — le kit de construction', () => {
  it('une chambre sans chanfrein est un anneau de QUATRE pans droits', () => {
    const b = boxesDeStructure(chambre([-600, -400, 600, 400], { chanfrein: 0 }))
    expect(b.length).toBe(4)
    for (const bx of b) expect(bx.angle).toBeUndefined()
  })

  it('une chambre chanfreinée est un octogone : huit pans, dont quatre à 45°', () => {
    const b = boxesDeStructure(chambre([-600, -400, 600, 400]))
    expect(b.length).toBe(8)
    const obliques = b.filter((bx) => bx.angle !== undefined)
    expect(obliques.length).toBe(4)
    for (const bx of obliques) expect(Math.abs(Math.abs(bx.angle!) - 45)).toBeLessThan(0.01)
  })

  it('l’intérieur d’une chambre est VIDE, et rien ne dépasse de l’emprise', () => {
    const s = chambre([-600, -400, 600, 400])
    const b = boxesDeStructure(s)
    for (const p of interieurStructure(s))
      // le contour intérieur lui-même est libre, rentré d'un cheveu
      expect(matiere(b, p.x * 0.97, p.y * 0.97)).toBe(false)
    // les quatre coins de chaque pan, rotation comprise, tiennent dans l'emprise
    for (const bx of b) {
      const cx = (bx.minX + bx.maxX) / 2
      const cy = (bx.minY + bx.maxY) / 2
      const hx = (bx.maxX - bx.minX) / 2
      const hy = (bx.maxY - bx.minY) / 2
      const a = ((bx.angle ?? 0) * Math.PI) / 180
      for (const [sx, sy] of [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ]) {
        const px = cx + Math.cos(a) * sx * hx - Math.sin(a) * sy * hy
        const py = cy + Math.sin(a) * sx * hx + Math.cos(a) * sy * hy
        expect(Math.abs(px)).toBeLessThanOrEqual(600 + 1)
        expect(Math.abs(py)).toBeLessThanOrEqual(400 + 1)
      }
    }
  })

  it('la coque d’une chambre est ÉTANCHE : aucun rayon ne sort par une fente', () => {
    const s = chambre([-600, -400, 600, 400])
    const b = boxesDeStructure(s)
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2
      let touche = false
      for (let d = 4; d <= 760; d += 3) {
        const x = Math.cos(a) * d
        const y = Math.sin(a) * d
        if (matiere(b, x, y)) {
          touche = true
          break
        }
        if (Math.abs(x) > 600 || Math.abs(y) > 400) break
      }
      expect(touche, `rayon ${i} · ${((a * 180) / Math.PI).toFixed(0)}°`).toBe(true)
    }
  })

  it('un couloir est un tube : deux pans, ouvert aux deux bouts', () => {
    const b = boxesDeStructure(couloir([-500, -100, 500, 100]))
    expect(b.length).toBe(2)
    // on entre par un bout et on ressort par l'autre
    expect(libre(b, -480, 0, 480, 0)).toBe(true)
  })

  it('un couloir posé en travers d’une chambre y PERCE une porte', () => {
    const ch = chambre([-600, -400, 600, 400])
    const co = couloir([560, -90, 1400, 90])
    const b = boxesDesStructures([ch, co])
    // du cœur de la chambre au cœur du couloir : plus rien ne barre
    expect(libre(b, 0, 0, 1200, 0)).toBe(true)
    // et les flancs de la porte, eux, restent pleins
    expect(matiere(b, 580, 160)).toBe(true)
    expect(matiere(b, 580, -160)).toBe(true)
  })

  it('un couloir OBLIQUE perce une porte lui aussi, et elle est étanche', () => {
    for (const angle of [30, 45, 127, -63]) {
      const ch = chambre([-600, -400, 600, 400], { chanfrein: 0 })
      const rad = (angle * Math.PI) / 180
      const cx = Math.cos(rad) * 900
      const cy = Math.sin(rad) * 900
      const co = couloir([cx - 500, cy - 90, cx + 500, cy + 90], { angle })
      const b = boxesDesStructures([ch, co])
      expect(libre(b, 0, 0, cx, cy), `oblique ${angle}°`).toBe(true)
    }
  })

  it('deux structures qui ne se touchent pas restent CLOSES', () => {
    const b = boxesDesStructures([
      chambre([-600, -400, 600, 400]),
      chambre([1200, -400, 2400, 400]),
    ])
    expect(libre(b, 0, 0, 1800, 0)).toBe(false)
  })

  it('le bouchon d’un couloir barre toute sa largeur', () => {
    const b = boxesDeStructure(couloir([-500, -100, 500, 100], { bouchon: MAT_GRILLE }))
    expect(b.length).toBe(3)
    expect(b.some((bx) => bx.material === MAT_GRILLE)).toBe(true)
    expect(libre(b, -480, 0, 480, 0)).toBe(false)
    expect(libre(b, -480, 50, 480, 50)).toBe(false)
  })

  it('le prix de chaque pièce, en blocs dessinés', () => {
    expect(coutStructures([chambre([-600, -400, 600, 400], { chanfrein: 0 })])).toBe(4)
    expect(coutStructures([chambre([-600, -400, 600, 400])])).toBe(8)
    expect(coutStructures([couloir([-500, -100, 500, 100])])).toBe(2)
    expect(coutStructures([couloir([-500, -100, 500, 100], { bouchon: MAT_WALL })])).toBe(3)
  })

  it('deux chambres qui se recouvrent communiquent, sans payer plus cher', () => {
    const plan = [
      chambre([-600, -400, 600, 400], { chanfrein: 0 }),
      chambre([500, -300, 1600, 300], { chanfrein: 0 }),
    ]
    const seules = plan.reduce((n, s) => n + coutStructures([s]), 0)
    expect(coutStructures(plan)).toBeLessThanOrEqual(seules)
    // et surtout : on passe de l'une à l'autre
    expect(libre(boxesDesStructures(plan), 0, 0, 1050, 0)).toBe(true)
  })

  it('le chanfrein est borné : jamais assez grand pour refermer la chambre', () => {
    const fou = chambre([-600, -400, 600, 400], { chanfrein: 9 })
    expect(chanfreinDe(fou)).toBeLessThanOrEqual(400 - 40)
    expect(boxesDeStructure(fou).length).toBeGreaterThan(3)
    // et une structure sans intérieur n'est pas une coque
    expect(structureViable(chambre([0, 0, 80, 80]))).toBe(false)
    expect(boxesDeStructure(chambre([0, 0, 80, 80]))).toEqual([])
  })

  it('l’expansion est DÉTERMINISTE : deux appels rendent le même plan', () => {
    const plan = [
      chambre([-600, -400, 600, 400]),
      couloir([560, -90, 1400, 90]),
      chambre([1360, -300, 2200, 300], { chanfrein: 0.5 }),
    ]
    expect(JSON.stringify(boxesDesStructures(plan))).toBe(
      JSON.stringify(boxesDesStructures(plan)),
    )
  })

  it('un tableau SANS structure traverse niveauExpanse sans être touché', () => {
    // la promesse de non-régression : tout ce qui existe garde sa référence
    expect(niveauExpanse(TABLEAU_HUB)).toBe(TABLEAU_HUB)
  })

  it('les structures passent AVANT le mobilier posé', () => {
    const lv = {
      ...TABLEAU_HUB,
      structures: [chambre([-600, -400, 600, 400], { chanfrein: 0 })],
    }
    const expanse = niveauExpanse(lv)
    expect(expanse).not.toBe(lv)
    expect(expanse.boxes.length).toBe(TABLEAU_HUB.boxes.length + 4)
    expect(expanse.boxes[4]).toBe(TABLEAU_HUB.boxes[0])
  })

  it('un tableau fait de DEUX modules et d’un couloir se traverse vraiment', () => {
    // la promesse du kit : on pose des coques, le terrain de jeu existe —
    // le départ est dans l'une, le sas dans l'autre, et le corps passe
    const lv = {
      name: 'Deux modules',
      code: 'STRUCT-1',
      journal: '',
      bounds: { minX: -1600, minY: -700, maxX: 1600, maxY: 700 },
      spawn: { x: -1000, y: 0, n: 300 },
      exit: { minX: 1000, minY: -70, maxX: 1140, maxY: 70 },
      boxes: [],
      sponges: [],
      labels: [],
      coque: 'structures' as const,
      structures: [
        chambre([-1500, -600, -600, 600]),
        couloir([-660, -110, 660, 110]),
        chambre([600, -600, 1500, 600]),
      ],
    }
    expect(checkLevel(lv).filter((x) => x.niveau === 'erreur')).toEqual([])
    expect(accessible(lv, new Set())).toBe(true)
    // et le dehors reste clos : depuis le départ, on ne sort pas des coques
    const b = boxesDesStructures(lv.structures)
    expect(libre(b, -1000, 0, -1000, 660)).toBe(false)
    expect(libre(b, -1000, 0, 1070, 0)).toBe(true)
  })

  it('structureNeuve pose les défauts et devine l’axe d’un couloir', () => {
    const c = structureNeuve(STRUCT_COULOIR, { minX: 0, minY: 0, maxX: 200, maxY: 900 })
    expect(c.axe).toBe(1)
    expect(structureNeuve(STRUCT_CHAMBRE, { minX: 300, minY: 0, maxX: 0, maxY: 300 }).minX).toBe(0)
  })
})
