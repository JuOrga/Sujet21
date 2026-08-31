import { describe, expect, it } from 'vitest'
import { dansBoite, MAT_GRILLE, type ObstacleBox, type StructureDef } from './level'
import { COQUE_EST, COQUE_NORD, FORME_COQUE, coqueUnpack } from './formes'
import {
  boiteRaccordee,
  boxesDeStructure,
  boxesDesStructures,
  epaisseurDessinee,
  cotesOuverts,
  coutStructures,
  empriseDessinee,
  gommeStructure,
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

  it('LE RACCORD : un couloir s’arrête à la face intérieure de ce qu’il rejoint', () => {
    const ch = chambre([-900, -600, 0, 600])
    // le couloir MORD dans la chambre : c'est ainsi qu'on dit « raccorde »
    const co = couloir([-160, -200, 900, 200])
    const r = boiteRaccordee(co, [ch, co])
    // il repart de la face INTÉRIEURE du mur est, pas de son emprise tracée
    expect(r.minX).toBe(0 - epaisseurDessinee(ch))
    expect(r.maxX).toBe(900) // le bout libre ne bouge pas
    // et plus rien du couloir ne dépasse dans la salle
    const b = boxesDesStructures([ch, co])
    expect(matiere(b, -200, 180)).toBe(false)
    // la porte reste ouverte : le raccord ne referme rien
    expect(libre(b, -450, 0, 860, 0)).toBe(true)
  })

  it('un couloir raccordé des DEUX bouts tient exactement l’écart', () => {
    const g = chambre([-900, -600, 0, 600])
    const d = chambre([600, -600, 1500, 600])
    const co = couloir([-160, -200, 760, 200])
    const r = boiteRaccordee(co, [g, d, co])
    expect(r.minX).toBe(0 - epaisseurDessinee(g))
    expect(r.maxX).toBe(600 + epaisseurDessinee(d))
    expect(libre(boxesDesStructures([g, d, co]), -450, 0, 1050, 0)).toBe(true)
  })

  it('le concepteur peut refuser le raccord', () => {
    const ch = chambre([-900, -600, 0, 600])
    const co = couloir([-160, -200, 900, 200], { raccord: false })
    expect(boiteRaccordee(co, [ch, co]).minX).toBe(-160)
  })

  it('un couloir qui ne touche rien garde son emprise', () => {
    const co = couloir([-700, -200, 700, 200])
    const r = boiteRaccordee(co, [co])
    expect(r.minX).toBe(-700)
    expect(r.maxX).toBe(700)
  })

  it('structureNeuve pose les défauts et devine l’axe d’un couloir', () => {
    expect(structureNeuve(STRUCT_COULOIR, { minX: 0, minY: 0, maxX: 200, maxY: 900 }).axe).toBe(1)
    expect(structureNeuve(STRUCT_CHAMBRE, { minX: 300, minY: 0, maxX: 0, maxY: 300 }).minX).toBe(0)
  })
})

describe('la gomme face à une coque — tout ou rien', () => {
  const zone = (minX: number, minY: number, maxX: number, maxY: number) => ({
    minX,
    minY,
    maxX,
    maxY,
  })

  it('une chambre entièrement couverte s’efface', () => {
    const ch = chambre([-600, -400, 600, 400])
    expect(gommeStructure(ch, [ch], zone(-700, -500, 700, 500))).toBe('effacee')
  })

  it('une zone qui la traverse et ressort suffit : pas besoin de la couvrir', () => {
    // le geste franc : on part du dehors, on passe le cœur, on s'arrête
    // avant le mur d'en face. Exiger la couverture totale rendait la gomme
    // inutilisable — une chambre tient rarement dans l'écran
    const ch = chambre([-600, -400, 600, 400])
    expect(gommeStructure(ch, [ch], zone(-800, -100, 200, 100))).toBe('effacee')
  })

  it('une zone qui passe à côté la laisse intacte', () => {
    const ch = chambre([-600, -400, 600, 400])
    expect(gommeStructure(ch, [ch], zone(800, 800, 1200, 1200))).toBe('intacte')
  })

  it('gommer DANS une chambre efface le mobilier, pas la chambre', () => {
    // le piège : le cœur d'une chambre est du vide — c'est là qu'on pose
    // les meubles, et c'est là qu'on les gomme. Même large, même à cheval
    // sur le centre, une zone qui ne touche aucun mur ne la concerne pas
    const ch = chambre([-600, -400, 600, 400])
    expect(gommeStructure(ch, [ch], zone(-200, -150, 200, 150))).toBe('intacte')
    expect(gommeStructure(ch, [ch], zone(-540, -340, 540, 340))).toBe('intacte')
  })

  it('mordue sur un bord, loin du cœur, elle est épargnée', () => {
    // gommer un meuble adossé au mur ne doit pas emporter la pièce
    const ch = chambre([-600, -400, 600, 400])
    expect(gommeStructure(ch, [ch], zone(-800, -450, -400, -100))).toBe(
      'epargnee',
    )
  })

  it('une coque tournée est jugée sur l’emprise que sa rotation lui donne', () => {
    const ch = chambre([-600, -400, 600, 400], { angle: 45 })
    const e = empriseDessinee(ch, [ch])
    expect(e.maxY).toBeGreaterThan(400)
    expect(
      gommeStructure(ch, [ch], zone(e.minX - 1, e.minY - 1, e.maxX + 1, e.maxY + 1)),
    ).toBe('effacee')
    // un coin de l'emprise tournée : des murs, mais pas le cœur
    expect(gommeStructure(ch, [ch], zone(e.minX - 20, e.minY - 20, e.minX + 120, e.minY + 120))).toBe(
      'epargnee',
    )
  })

  it('un couloir raccordé se juge sur sa longueur RÉELLE, pas sur son emprise', () => {
    const ch = chambre([-900, -600, 0, 600])
    const co = couloir([-160, -200, 900, 200])
    const plan = [ch, co]
    const e = empriseDessinee(co, plan)
    expect(e.minX).toBeGreaterThan(-160)
    // le cœur du tube est au milieu de sa longueur RACCORDÉE
    expect(gommeStructure(co, plan, zone((e.minX + e.maxX) / 2 - 20, -300, 1000, 300))).toBe(
      'effacee',
    )
  })
})
