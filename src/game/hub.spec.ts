import { describe, expect, it } from 'vitest'
import {
  BANC_MEMOIRES_HUB,
  ETAL_HUB,
  SAS_GIVRE_HUB,
  SAS_VAPEUR_HUB,
  TABLEAU_HUB,
} from './hub'
import { MAT_GRILLE, MAT_RIDEAU, MAT_WALL } from './level'
import { checkLevel } from './levelIO'
import { accessible } from './generateur'

type Rect = { minX: number; minY: number; maxX: number; maxY: number }
const dedans = (r: Rect, b: Rect): boolean =>
  r.minX >= b.minX && r.maxX <= b.maxX && r.minY >= b.minY && r.maxY <= b.maxY
const chevauche = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

describe('hub v4 — le méta a pris ses murs', () => {
  it('le tableau reste valide et le sas principal se rejoint', () => {
    const erreurs = checkLevel(TABLEAU_HUB).filter((v) => v.niveau === 'erreur')
    expect(erreurs.map((e) => e.message)).toEqual([])
    // spawn → sas, à la marge du corps (les filtres comptent passants)
    expect(accessible(TABLEAU_HUB, new Set())).toBe(true)
  })

  it('les trois sas et le banc tiennent dans les bornes, hors des murs', () => {
    const b = TABLEAU_HUB.bounds
    for (const zone of [
      TABLEAU_HUB.exit,
      SAS_GIVRE_HUB,
      SAS_VAPEUR_HUB,
      ...ETAL_HUB.map((a) => a.plot),
    ]) {
      expect(dedans(zone, b)).toBe(true)
      for (const box of TABLEAU_HUB.boxes)
        if (box.material === MAT_WALL)
          expect(chevauche(zone, box), JSON.stringify(zone)).toBe(false)
    }
    // la zone du banc, elle, ENVELOPPE la machine : le contact du corps
    // contre le banc ouvre l'écran des mémoires
    expect(dedans(BANC_MEMOIRES_HUB, b)).toBe(true)
    const machine = TABLEAU_HUB.boxes.find(
      (bx) => bx.minX === 1400 && bx.minY === 120,
    )
    expect(machine && dedans(machine, BANC_MEMOIRES_HUB)).toBe(true)
  })

  it('la chambre de givre ne s’ouvre que par un RIDEAU, celle de vapeur par une GRILLE', () => {
    // la cloison nord (y 550..640) court de 3290 à 4000 : murs + UN rideau
    const bande = (y0: number, y1: number) =>
      TABLEAU_HUB.boxes.filter((bx) => bx.minY === y0 && bx.maxY === y1)
    const nord = bande(550, 640).sort((a, b2) => a.minX - b2.minX)
    expect(nord.map((bx) => bx.material)).toEqual([
      MAT_WALL,
      MAT_RIDEAU,
      MAT_WALL,
    ])
    expect(nord[0].minX).toBe(3290)
    expect(nord[2].maxX).toBe(4000)
    for (let i = 1; i < nord.length; i++)
      expect(nord[i].minX).toBe(nord[i - 1].maxX) // sans fente
    // la cloison sud (y −640..−550) : murs + UNE grille, épaulée du mur ouest
    const sud = bande(-640, -550).sort((a, b2) => a.minX - b2.minX)
    expect(sud.map((bx) => bx.material)).toEqual([MAT_GRILLE, MAT_WALL])
    expect(sud[1].maxX).toBe(4000)
    const ouest = TABLEAU_HUB.boxes.find(
      (bx) => bx.minX === 3470 && bx.minY === -1800,
    )
    expect(ouest?.material).toBe(MAT_WALL)
    expect(ouest?.maxY).toBe(-550)
    expect(sud[0].minX).toBe(ouest?.maxX)
  })

  it('le comptoir : quatre articles, identités uniques, prix en mémoire', () => {
    expect(ETAL_HUB.length).toBe(4)
    expect(new Set(ETAL_HUB.map((a) => a.id)).size).toBe(4)
    for (const a of ETAL_HUB) {
      expect(a.prix).toBeGreaterThan(0)
      expect(a.nom.length).toBeGreaterThan(3)
      // chaque alcôve a son étiquette de prix dans le tableau
      expect(
        TABLEAU_HUB.labels.some(
          (l) => l.text.includes(a.nom) && l.text.includes(`${a.prix} MÉMOIRE`),
        ),
        a.id,
      ).toBe(true)
    }
  })

  it('la signalétique annonce les routes et le banc', () => {
    const textes = TABLEAU_HUB.labels.map((l) => l.text).join(' · ')
    expect(textes).toContain('SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE')
    expect(textes).toContain('SORTIE DE VAPEUR|LA DESCENTE DU JOUR')
    expect(textes).toContain('LE BANC DES MÉMOIRES|TISSER LES LIENS')
    expect(textes).toContain('LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE')
    // l'écran de contrôle est SOUS TENSION : le méta est branché
    expect(TABLEAU_HUB.decals?.some((d) => d.kind === 'ecran-on')).toBe(true)
  })
})
