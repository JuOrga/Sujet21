import { describe, expect, it } from 'vitest'
import {
  dansBoite,
  MAT_WALL,
  type LevelDef,
  type PorteDef,
  type StructureDef,
} from '../game/level'
import {
  boxesDesStructures,
  cotesOuverts,
  STRUCT_CHAMBRE,
  STRUCT_COULOIR,
} from '../game/structures'
import { COQUE_EST, COQUE_NORD, COQUE_OUEST, COQUE_SUD } from '../game/formes'
import { canalDeCible } from '../game/laser'
import { MAX_LUMIERES } from '../render/renderer'
import {
  empriseMotif,
  motifDeSelection,
  motifDeStructure,
  pave,
  phrasePavage,
  REGLAGES_PAVAGE_DEFAUT,
  tailleMotif,
  type Motif,
  type ReglagesPavage,
} from './pavage'

// LA CELLULE DU DÉMINEUR, telle que le concepteur l'a faite : une chambre
// chanfreinée de 800 × 800 (coque de 64), sa cachette, sa pastille
// numérotée, une étiquette, et deux portes asservies posées À CHEVAL sur
// sa paroi — à l'ouest et au sud. Le tout dans une cuve juste à sa taille.
const EP = 64
const CELLULE = { minX: 0, minY: 0, maxX: 800, maxY: 800 }

function tableauDemineur(extra: Partial<LevelDef> = {}): LevelDef {
  return {
    name: 'Démineur',
    code: 'DM',
    journal: '',
    bounds: { ...CELLULE },
    spawn: { x: 400, y: 400, n: 300 },
    exit: { minX: 2000, minY: 2000, maxX: 2100, maxY: 2100 },
    boxes: [],
    sponges: [],
    labels: [{ x: 200, y: 700, text: 'CASE', tone: 'mur', cle: 'case-1' }],
    coque: 'structures',
    structures: [
      { type: STRUCT_CHAMBRE, ...CELLULE, ep: EP, chanfrein: 0.25 },
    ],
    caches: [{ minX: 200, minY: 200, maxX: 600, maxY: 600 }],
    cibles: [{ x: 650, y: 650, r: 30 }],
    portes: [
      // à l'ouest : la bande de paroi est x ∈ [0, 64], la porte la couvre
      { minX: 0, minY: 300, maxX: 64, maxY: 500, canal: 1 },
      // au sud : y ∈ [0, 64], un peu décentrée pour prouver le recentrage
      { minX: 250, minY: 0, maxX: 450, maxY: 64, canal: 1 },
    ],
    ...extra,
  }
}

const reglages = (r: Partial<ReglagesPavage> = {}): ReglagesPavage => ({
  ...REGLAGES_PAVAGE_DEFAUT,
  ...r,
})

const motifCellule = (lv: LevelDef): Motif => motifDeStructure(lv, 0)

/** De la matière en (x, y), la coque expansée en parois ? */
const matiere = (lv: LevelDef, x: number, y: number): boolean =>
  boxesDesStructures(lv.structures).some((b) => dansBoite(b, x, y))

describe('le motif — ce que le pavage répète', () => {
  it('une chambre sélectionnée emporte tout ce qui est centré dans son emprise', () => {
    const lv = tableauDemineur({
      // un meuble hors de la cellule : il n'en fait pas partie
      boxes: [{ minX: 1200, minY: 100, maxX: 1300, maxY: 200, material: MAT_WALL }],
    })
    const m = motifCellule(lv)
    expect(m.structures).toEqual([0])
    expect(m.caches).toEqual([0])
    expect(m.cibles).toEqual([0])
    expect(m.labels).toEqual([0])
    // les portes à cheval sur la paroi : leur centre est DANS la paroi,
    // donc dans l'emprise — elles suivent la cellule
    expect(m.portes).toEqual([0, 1])
    expect(m.boxes).toEqual([])
    expect(tailleMotif(m)).toBe(6)
    expect(empriseMotif(lv, m)).toEqual(CELLULE)
  })

  it('une sélection multiple est prise telle quelle, et nomme ce qui ne se copie pas', () => {
    const { motif, ignores } = motifDeSelection([
      { kind: 'structure', index: 0 },
      { kind: 'cache', index: 0 },
      { kind: 'cache', index: 0 }, // le doublon ne compte pas deux fois
      { kind: 'spawn' },
      { kind: 'exit' },
    ])
    expect(motif.structures).toEqual([0])
    expect(motif.caches).toEqual([0])
    expect(ignores).toEqual(['le départ', 'le sas'])
  })
})

describe('le pavage à paroi commune — le kit du démineur', () => {
  it('pose les copies en recouvrant les coques d’une épaisseur : UNE paroi mitoyenne', () => {
    const lv = tableauDemineur()
    const bilan = pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 2 }))
    expect(bilan.cellules).toBe(3)
    const st = lv.structures!
    expect(st.length).toBe(4)
    // le pas est la largeur MOINS l'épaisseur : la paroi est de l'une et
    // de l'autre — les colonnes vont vers l'est, les rangées vers le sud
    const pas = 800 - EP
    expect(st[1]).toMatchObject({ minX: pas, maxX: pas + 800, minY: 0 })
    expect(st[2]).toMatchObject({ minX: 0, minY: -pas, maxY: -pas + 800 })
    expect(st[3]).toMatchObject({ minX: pas, minY: -pas })
    // le mobilier suit sa cellule
    expect(lv.caches!.length).toBe(4)
    expect(lv.caches![3]).toMatchObject({ minX: 200 + pas, minY: 200 - pas })
    expect(lv.labels.length).toBe(4)
    // la CLÉ d'un panneau ne se copie pas : elle désigne UN panneau
    expect(lv.labels[0].cle).toBe('case-1')
    expect(lv.labels[1].cle).toBeUndefined()
  })

  it('force les faces en regard ouvertes des deux côtés, et referme les bords orphelins', () => {
    const lv = tableauDemineur()
    // AVANT : rien n'est deviné — la coque est seule
    expect(cotesOuverts(lv.structures![0], lv.structures!).cotes).toBe(0)
    pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 2 }))
    const [nw, ne, sw, se] = lv.structures!
    expect(nw.ouvertures).toBe(COQUE_EST | COQUE_SUD)
    expect(ne.ouvertures).toBe(COQUE_OUEST | COQUE_SUD)
    expect(sw.ouvertures).toBe(COQUE_NORD | COQUE_EST)
    expect(se.ouvertures).toBe(COQUE_NORD | COQUE_OUEST)
    // la fente prend la largeur de la porte, arrondie PAR DÉFAUT au pas du
    // format (200 → 192) : jamais plus large que la porte qui la couvre
    for (const s of lv.structures!) expect(s.porte).toBe(192)
  })

  it('la jointure est VRAIMENT percée : la coque expansée laisse passer au centre de la porte', () => {
    const lv = tableauDemineur()
    pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 2 }))
    const pas = 800 - EP
    // la paroi mitoyenne des deux cellules du haut : x ∈ [736, 800]
    // — libre au centre de la face (y = 400), pleine plus haut
    expect(matiere(lv, 768, 400)).toBe(false)
    expect(matiere(lv, 768, 150)).toBe(true)
    // la paroi mitoyenne de la colonne de gauche : y ∈ [0, 64]
    expect(matiere(lv, 400, 32)).toBe(false)
    expect(matiere(lv, 150, 32)).toBe(true)
    // et la même chose entre les deux cellules du bas
    expect(matiere(lv, 768, 400 - pas)).toBe(false)
  })

  it('reconstruit une porte par jointure, qui traverse toute la paroi et se centre sur la face', () => {
    const lv = tableauDemineur()
    const bilan = pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 2 }))
    const pas = 800 - EP
    const portes = lv.portes!
    // deux jointures verticales (une par rangée) + deux horizontales (une
    // par colonne) ; les portes d'ouest de la colonne 0 et de sud de la
    // rangée 1 tombaient sur le bord : retirées
    expect(bilan.portesJointure).toBe(4)
    expect(bilan.portesRetirees).toBe(4)
    expect(portes.length).toBe(4)
    const trouve = (r: Partial<PorteDef>): PorteDef | undefined =>
      portes.find((p) =>
        (Object.keys(r) as (keyof PorteDef)[]).every((k) => p[k] === r[k]),
      )
    // entre (0,0) et (1,0) : la porte d'OUEST de la copie, portée sur la
    // paroi commune x ∈ [736, 800], centrée sur la face (y = 400, 200 de haut)
    expect(trouve({ minX: pas, maxX: 800, minY: 300, maxY: 500 })).toBeTruthy()
    // entre (0,0) et (0,1) : la porte de SUD du motif, y ∈ [0, 64],
    // RECENTRÉE sur la face (x = 400) — elle était posée en 250..450
    expect(trouve({ minY: 0, maxY: EP, minX: 300, maxX: 500 })).toBeTruthy()
    // et les deux jointures du bas / de droite
    expect(trouve({ minX: pas, maxX: 800, minY: 300 - pas, maxY: 500 - pas })).toBeTruthy()
    expect(trouve({ minY: 0, maxY: EP, minX: 300 + pas, maxX: 500 + pas })).toBeTruthy()
  })

  it('numérote les canaux par cellule : les pastilles prennent les numéros libres, leurs portes suivent', () => {
    const lv = tableauDemineur()
    pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 2 }))
    const cibles = lv.cibles!
    expect(cibles.map((_, i) => canalDeCible(cibles, i))).toEqual([1, 2, 3, 4])
    // la copie porte son numéro EN CLAIR (le défaut « rang + 1 » ne
    // vaudrait plus rien une fois la liste allongée)
    expect(cibles[1].canal).toBe(2)
    const pas = 800 - EP
    const canalEn = (x: number, y: number): number | undefined =>
      lv.portes!.find((p) => x >= p.minX && x <= p.maxX && y >= p.minY && y <= p.maxY)?.canal
    // la porte d'une jointure appartient à la cellule qui l'apporte : celle
    // d'ouest vient de la cellule de droite (canal 2), celle de sud de la
    // cellule du haut (canal 1)
    expect(canalEn(768, 400)).toBe(2)
    expect(canalEn(400, 32)).toBe(1)
    expect(canalEn(768, 400 - pas)).toBe(4)
    expect(canalEn(400 + pas, 32)).toBe(2)
  })

  it('… ou les laisse en commun si on le demande', () => {
    const lv = tableauDemineur()
    pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 2, canaux: false }))
    const cibles = lv.cibles!
    expect(cibles.map((_, i) => canalDeCible(cibles, i))).toEqual([1, 1, 1, 1])
    expect(lv.portes!.every((p) => p.canal === 1)).toBe(true)
  })

  it('les numéros libres sautent ceux que le tableau utilise déjà ailleurs', () => {
    const lv = tableauDemineur({
      cibles: [
        { x: 650, y: 650, r: 30 },
        { x: 3000, y: 3000, r: 30, canal: 3 }, // une pastille étrangère au motif
      ],
    })
    pave(lv, motifCellule(lv), reglages({ colonnes: 3, rangees: 1 }))
    const cibles = lv.cibles!
    expect(cibles.map((_, i) => canalDeCible(cibles, i))).toEqual([1, 3, 2, 4])
  })

  it('agrandit la cuve quand le pavage déborde, et le dit', () => {
    const lv = tableauDemineur()
    const bilan = pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 2 }))
    expect(bilan.bornesEtendues).toBe(true)
    const pas = 800 - EP
    expect(lv.bounds).toEqual({ minX: 0, minY: -pas, maxX: pas + 800, maxY: 800 })
  })

  it('un motif percé à l’est ET à l’ouest ne double pas la porte de la jointure', () => {
    const lv = tableauDemineur({
      portes: [
        { minX: 0, minY: 300, maxX: 64, maxY: 500, canal: 1 },
        { minX: 736, minY: 300, maxX: 800, maxY: 500, canal: 1 },
      ],
    })
    const bilan = pave(lv, motifCellule(lv), reglages({ colonnes: 3, rangees: 1 }))
    // deux jointures, une porte chacune — la première posée (celle de la
    // cellule de gauche, son canal) l'emporte
    expect(bilan.portesJointure).toBe(2)
    expect(lv.portes!.length).toBe(2)
    expect(lv.portes!.map((p) => p.canal)).toEqual([1, 2])
    expect(bilan.portesRetirees).toBe(2) // l'ouest de la 1ʳᵉ, l'est de la 3ᵉ
  })

  it('une porte de bord qu’une coque étrangère attend n’est pas pendante : elle reste', () => {
    const lv = tableauDemineur({
      structures: [
        { type: STRUCT_CHAMBRE, ...CELLULE, ep: EP, chanfrein: 0.25 },
        // un couloir qui mord dans la paroi ouest du motif
        { type: STRUCT_COULOIR, minX: -600, minY: 300, maxX: 40, maxY: 500, ep: 24 },
      ],
    })
    // une colonne, deux rangées : l'ouest est un bord pour les deux cellules
    const bilan = pave(lv, motifCellule(lv), reglages({ colonnes: 1, rangees: 2 }))
    expect(lv.structures!.length).toBe(3)
    // la porte d'ouest de l'ORIGINAL est gardée telle quelle (le couloir
    // l'attend) ; celle de la copie, que rien n'attend, part — comme la
    // porte de sud de la copie (le bord du bas)
    expect(bilan.portesRetirees).toBe(2)
    expect(bilan.portesJointure).toBe(1)
    expect(lv.portes!.some((p) => p.minX === 0 && p.maxX === 64 && p.minY === 300)).toBe(true)
    // la face ouest de l'original reste ouverte (le couloir y est) ; la
    // copie ne connaît que le motif : fermée
    expect(lv.structures![0].ouvertures! & COQUE_OUEST).toBe(COQUE_OUEST)
    expect(lv.structures![2].ouvertures! & COQUE_OUEST).toBe(0)
  })

  it('sans porte sur une jointure, les faces s’ouvrent quand même — à la porte du kit', () => {
    const lv = tableauDemineur({ portes: [] })
    const bilan = pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 1 }))
    expect(bilan.portesJointure).toBe(0)
    expect(lv.portes).toBeUndefined()
    expect(lv.structures![0].ouvertures).toBe(COQUE_EST)
    expect(lv.structures![1].ouvertures).toBe(COQUE_OUEST)
    expect(matiere(lv, 768, 400)).toBe(false)
  })
})

describe('les autres jointures', () => {
  it('accolée : les coques se touchent, la porte traverse les DEUX parois', () => {
    const lv = tableauDemineur()
    pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 1, jointure: 'accolee' }))
    expect(lv.structures![1].minX).toBe(800)
    const porte = lv.portes!.find((p) => p.minY === 300)!
    expect(porte).toMatchObject({ minX: 800 - EP, maxX: 800 + EP })
    // les deux faces sont percées : libre d'un bout à l'autre de la porte
    expect(matiere(lv, 800 - EP / 2, 400)).toBe(false)
    expect(matiere(lv, 800 + EP / 2, 400)).toBe(false)
  })

  it('espacée : rien n’est percé, le motif est recopié tel quel à l’écart demandé', () => {
    const lv = tableauDemineur()
    const bilan = pave(
      lv,
      motifCellule(lv),
      reglages({ colonnes: 2, rangees: 2, jointure: 'espacee', ecart: 200 }),
    )
    expect(lv.structures![1].minX).toBe(1000)
    expect(lv.structures![2].minY).toBe(-1000)
    expect(lv.structures!.every((s) => s.ouvertures === undefined)).toBe(true)
    expect(bilan.portesJointure).toBe(0)
    expect(bilan.portesRetirees).toBe(0)
    expect(lv.portes!.length).toBe(8)
    // les canaux se numérotent tout de même par cellule
    expect(lv.portes!.map((p) => p.canal)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })
})

describe('les garde-fous', () => {
  it('une grille 1 × 1 ou un motif vide ne change rien', () => {
    const lv = tableauDemineur()
    const avant = JSON.stringify(lv)
    expect(pave(lv, motifCellule(lv), reglages({ colonnes: 1, rangees: 1 })).cellules).toBe(0)
    expect(pave(lv, motifDeSelection([]).motif, reglages()).cellules).toBe(0)
    expect(JSON.stringify(lv)).toBe(avant)
  })

  it('les lampes s’arrêtent au plafond du moteur, et le bilan le dit', () => {
    const lv = tableauDemineur({
      lumieres: [{ x: 400, y: 400, intensite: 1 }],
    })
    const bilan = pave(lv, motifCellule(lv), reglages({ colonnes: 3, rangees: 3 }))
    expect(lv.lumieres!.length).toBe(MAX_LUMIERES)
    expect(bilan.ignores[0]).toMatch(/lampe/)
  })

  it('une coque TOURNÉE ne fait pas de jointure : copiée, sans face forcée', () => {
    const lv = tableauDemineur({
      structures: [{ type: STRUCT_CHAMBRE, ...CELLULE, ep: EP, angle: 30 }],
      portes: [],
    })
    pave(lv, motifCellule(lv), reglages({ colonnes: 2, rangees: 1 }))
    const st: StructureDef[] = lv.structures!
    expect(st.length).toBe(2)
    // sans paroi en regard, pas de recouvrement : le pas est la largeur
    expect(st[1].minX).toBe(800)
    expect(st[0].ouvertures).toBe(0)
  })

  it('la phrase du bilan dit ce qui s’est passé', () => {
    const lv = tableauDemineur()
    const r = reglages({ colonnes: 2, rangees: 2 })
    const phrase = phrasePavage(pave(lv, motifCellule(lv), r), r)
    expect(phrase).toContain('Pavé 2 × 2 : 3 cellules ajoutées')
    expect(phrase).toContain('4 portes à cheval sur les jointures (paroi commune)')
    expect(phrase).toContain('4 portes de bord retirées')
    expect(phrase).toContain('cuve agrandie')
  })
})
