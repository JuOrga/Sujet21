import { describe, expect, it } from 'vitest'
import { dansBoite, MAT_GRILLE, type ObstacleBox, type StructureDef } from './level'
import { COQUE_EST, COQUE_NORD, FORME_COQUE, coqueUnpack } from './formes'
import {
  boxesDeStructure,
  boxesDesStructures,
  cotesOuverts,
  coutStructures,
  interieurStructure,
  niveauExpanse,
  structureNeuve,
  structureViable,
  STRUCT_CHAMBRE,
  STRUCT_COULOIR,
} from './structures'
import { TABLEAU_HUB_COMPACT } from './hub'
import { checkLevel } from './levelIO'
import { accessible } from './generateur'

const chambre = (
  r: [number, number, number, number],
  extra: Partial<StructureDef> = {},
): StructureDef => ({ type: STRUCT_CHAMBRE, minX: r[0], minY: r[1], maxX: r[2], maxY: r[3], ...extra })
const couloir = (
  r: [number, number, number, number],
  extra: Partial<StructureDef> = {},
): StructureDef => ({ type: STRUCT_COULOIR, minX: r[0], minY: r[1], maxX: r[2], maxY: r[3], ...extra })

const matiere = (boxes: ObstacleBox[], x: number, y: number) =>
  boxes.some((b) => dansBoite(b, x, y))

const libre = (boxes: ObstacleBox[], x0: number, y0: number, x1: number, y1: number): boolean => {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    if (matiere(boxes, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false
  }
  return true
}

describe('les structures de coque — une forme creuse, d’un seul tenant', () => {
  it('une chambre est UNE SEULE boîte : la forme creuse du moteur', () => {
    const b = boxesDeStructure(chambre([-600, -400, 600, 400]))
    expect(b.length).toBe(1)
    expect(b[0].forme).toBe(FORME_COQUE)
    // et ses réglages voyagent serrés dans p0/p1 — relisibles tels quels
    const r = coqueUnpack(b[0])
    expect(r.ep).toBeGreaterThan(0)
    expect(r.chanfrein).toBeGreaterThan(0)
  })

  it('l’intérieur est VIDE, la coque ÉTANCHE : aucun rayon ne sort', () => {
    const s = chambre([-600, -400, 600, 400])
    const b = boxesDeStructure(s)
    for (const p of interieurStructure(s))
      expect(matiere(b, p.x * 0.9, p.y * 0.9)).toBe(false)
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2
      let touche = false
      for (let d = 4; d <= 760; d += 3) {
        const x = Math.cos(a) * d
        const y = Math.sin(a) * d
        if (matiere(b, x, y)) { touche = true; break }
        if (Math.abs(x) > 600 || Math.abs(y) > 400) break
      }
      expect(touche, `rayon ${((a * 180) / Math.PI).toFixed(0)}°`).toBe(true)
    }
  })

  it('un couloir est ouvert à ses deux bouts, clos sur ses flancs', () => {
    const b = boxesDeStructure(couloir([-700, -200, 700, 200]))
    expect(b.length).toBe(1)
    expect(libre(b, -660, 0, 660, 0)).toBe(true)
    expect(libre(b, 0, 0, 0, 260)).toBe(false)
  })

  it('un couloir qui vient AU MILIEU d’une face y ouvre la porte', () => {
    const ch = chambre([-900, -600, 0, 600])
    const co = couloir([-80, -200, 900, 200])
    const b = boxesDesStructures([ch, co])
    expect(cotesOuverts(ch, [ch, co]).cotes & COQUE_EST).toBeTruthy()
    expect(libre(b, -450, 0, 860, 0)).toBe(true)
    // les montants de la porte tiennent : plus haut, la paroi est pleine
    expect(matiere(b, -20, 300)).toBe(true)
  })

  it('LA RÈGLE DU KIT : un module qui n’arrive pas au milieu n’ouvre rien', () => {
    const ch = chambre([-900, -600, 0, 600])
    // le même couloir, décalé vers le haut : il ne vise plus le centre
    const co = couloir([-80, 200, 900, 600])
    expect(cotesOuverts(ch, [ch, co]).cotes).toBe(0)
    expect(libre(boxesDesStructures([ch, co]), -450, 0, 860, 400)).toBe(false)
  })

  it('le concepteur peut FORCER les côtés ouverts', () => {
    const s = chambre([-600, -400, 600, 400], { ouvertures: COQUE_NORD, porte: 320 })
    const b = boxesDeStructure(s, [])
    expect(libre(b, 0, 0, 0, 460)).toBe(true)
    expect(libre(b, 0, 0, 660, 0)).toBe(false)
  })

  it('UN BLOC par coque — et un de plus pour une porte de matière', () => {
    expect(coutStructures([chambre([-600, -400, 600, 400])])).toBe(1)
    expect(coutStructures([couloir([-700, -200, 700, 200])])).toBe(1)
    expect(coutStructures([couloir([-700, -200, 700, 200], { bouchon: MAT_GRILLE })])).toBe(2)
    // une station de treize modules tient en treize blocs
    const plan = Array.from({ length: 13 }, (_, i) =>
      chambre([i * 400 - 4000, -300, i * 400 - 3700, 300]),
    )
    expect(coutStructures(plan)).toBe(13)
  })

  it('la porte de matière barre toute la largeur du passage', () => {
    const b = boxesDeStructure(couloir([-700, -200, 700, 200], { bouchon: MAT_GRILLE }))
    expect(b.some((x) => x.material === MAT_GRILLE)).toBe(true)
    for (const y of [-100, 0, 100]) expect(libre(b, -660, y, 660, y)).toBe(false)
  })

  it('une coque assez épaisse pour se refermer devient un octogone PLEIN', () => {
    const s = chambre([-200, -200, 200, 200], { ep: 240 })
    const b = boxesDeStructure(s)
    expect(matiere(b, 0, 0)).toBe(true)
    // …mais il reste un octogone : les angles sont coupés
    expect(matiere(b, 190, 190)).toBe(false)
    expect(structureViable(chambre([0, 0, 80, 80]))).toBe(false)
    expect(boxesDeStructure(chambre([0, 0, 80, 80]))).toEqual([])
  })

  it('l’expansion est DÉTERMINISTE', () => {
    const plan = [chambre([-600, -400, 600, 400]), couloir([560, -200, 1400, 200])]
    expect(JSON.stringify(boxesDesStructures(plan))).toBe(
      JSON.stringify(boxesDesStructures(plan)),
    )
  })

  it('un tableau SANS structure traverse niveauExpanse sans être touché', () => {
    expect(TABLEAU_HUB_COMPACT.structures).toBeUndefined()
    expect(niveauExpanse(TABLEAU_HUB_COMPACT)).toBe(TABLEAU_HUB_COMPACT)
  })

  it('les coques passent AVANT le mobilier posé', () => {
    const lv = { ...TABLEAU_HUB_COMPACT, structures: [chambre([-600, -400, 600, 400])] }
    const expanse = niveauExpanse(lv)
    expect(expanse.boxes.length).toBe(TABLEAU_HUB_COMPACT.boxes.length + 1)
    expect(expanse.boxes[1]).toBe(TABLEAU_HUB_COMPACT.boxes[0])
  })

  it('un tableau fait de DEUX modules et d’un couloir se traverse vraiment', () => {
    const lv = {
      name: 'Deux modules', code: 'STRUCT-1', journal: '',
      bounds: { minX: -1800, minY: -800, maxX: 1800, maxY: 800 },
      spawn: { x: -1100, y: 0, n: 300 },
      exit: { minX: 1000, minY: -90, maxX: 1160, maxY: 90 },
      boxes: [], sponges: [], labels: [],
      coque: 'structures' as const,
      structures: [
        chambre([-1600, -700, -700, 700]),
        couloir([-780, -220, 780, 220]),
        chambre([700, -700, 1600, 700]),
      ],
    }
    expect(checkLevel(lv).filter((x) => x.niveau === 'erreur')).toEqual([])
    expect(accessible(lv, new Set())).toBe(true)
    const b = boxesDesStructures(lv.structures)
    expect(libre(b, -1100, 0, 1100, 0)).toBe(true)
    expect(libre(b, -1100, 0, -1100, 760)).toBe(false)
  })

  it('structureNeuve pose les défauts et devine l’axe d’un couloir', () => {
    expect(structureNeuve(STRUCT_COULOIR, { minX: 0, minY: 0, maxX: 200, maxY: 900 }).axe).toBe(1)
    expect(structureNeuve(STRUCT_CHAMBRE, { minX: 300, minY: 0, maxX: 0, maxY: 300 }).minX).toBe(0)
  })
})
