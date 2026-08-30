// Les assets du méta : les décalques synthétisés collent aux données posées,
// et la planche d'icônes couvre tout ce que le commerce sait vendre.
import { describe, expect, it } from 'vitest'
import {
  ICONES_COLONNES,
  ICONES_RANGEES,
  MARCHAND_HAUTEUR,
  PART_PASSAGE_SAS,
  RAPPORT_ALCOVE,
  RAPPORT_BANC,
  RAPPORT_MARCHAND,
  RAPPORT_SAS,
  caseIcone,
  decalsDuMeta,
  vuesEclat,
} from './metaAssets'
import { jonctionsDesStructures } from './structures'
import { ARTICLES_ETAL_IDS, TABLEAU_ECONOMAT, ETAL_ECONOMAT } from './economat'
import { ARTICLES_COMPTOIR_IDS, TABLEAU_HUB } from './hub'
import { TABLEAUX, type LevelDef } from './level'

const nu: LevelDef = {
  name: 'nu',
  code: 'NU',
  journal: '',
  par: 1,
  bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
  spawn: { x: 0, y: 0, n: 100 },
  exit: { minX: 50, minY: -10, maxX: 90, maxY: 10 },
  boxes: [],
  sponges: [],
  labels: [],
}

describe('les décalques du méta', () => {
  it('un tableau sans méta n’ajoute rien au décor', () => {
    expect(decalsDuMeta(nu)).toEqual([])
    // et aucun tableau livré ordinaire n'en gagne par surprise
    for (const t of TABLEAUX) expect(decalsDuMeta(t), t.code).toEqual([])
  })

  it('chaque plot pose son alcôve, centrée et JAMAIS déformée', () => {
    const metas = decalsDuMeta(TABLEAU_ECONOMAT)
    const alcoves = metas.filter((d) => d.kind === 'meta-alcove')
    expect(alcoves.length).toBe(ETAL_ECONOMAT.length)
    for (const a of ETAL_ECONOMAT) {
      const d = alcoves.find(
        (x) =>
          x.x === (a.plot.minX + a.plot.maxX) / 2 && x.kind === 'meta-alcove',
      )
      expect(d, a.id).toBeDefined()
      expect(d!.y).toBe((a.plot.minY + a.plot.maxY) / 2)
      // la pièce garde SON rapport…
      expect(d!.w / d!.h).toBeCloseTo(RAPPORT_ALCOVE, 5)
      // …et tient tout entière dans le rectangle du plot
      expect(d!.w).toBeLessThanOrEqual(a.plot.maxX - a.plot.minX + 1e-6)
      expect(d!.h).toBeLessThanOrEqual(a.plot.maxY - a.plot.minY + 1e-6)
    }
  })

  it('le marchand pose sa masse sur son point, le banc sur son rectangle', () => {
    const eco = decalsDuMeta(TABLEAU_ECONOMAT)
    const m = eco.find((d) => d.kind === 'meta-marchand')
    expect(m).toBeDefined()
    expect(m!.x).toBe(TABLEAU_ECONOMAT.marchand!.x)
    expect(m!.y).toBe(TABLEAU_ECONOMAT.marchand!.y)
    expect(m!.h).toBe(MARCHAND_HAUTEUR)
    expect(m!.w / m!.h).toBeCloseTo(RAPPORT_MARCHAND, 5)
    // la colonne DESSINÉE couvre la colonne PHYSIQUE du Sujet 12 : l'art et
    // la salle disent la même chose
    const colonne = TABLEAU_ECONOMAT.boxes.find((b) => b.forme === 2)!
    expect(m!.y - m!.h / 2).toBeCloseTo(colonne.minY, 0)
    expect(m!.y + m!.h / 2).toBeCloseTo(colonne.maxY, 0)

    const hub = decalsDuMeta(TABLEAU_HUB)
    const b = hub.find((d) => d.kind === 'meta-banc')
    const banc = TABLEAU_HUB.bancMemoires!
    expect(b).toBeDefined()
    expect(b!.w / b!.h).toBeCloseTo(RAPPORT_BANC, 5)
    expect(b!.w).toBeLessThanOrEqual(banc.maxX - banc.minX + 1e-6)
    expect(b!.h).toBeLessThanOrEqual(banc.maxY - banc.minY + 1e-6)
  })

  it('les pièces du méta ne sont jamais posables à la main (hors du format)', async () => {
    // levelIO écarte une sorte inconnue : les sortes « meta-* » n'existent
    // qu'à l'exécution, un fichier ne peut pas en porter
    const { parseLevel } = await import('./levelIO')
    const { level, rejets } = parseLevel({
      ...nu,
      decals: [{ x: 0, y: 0, w: 10, h: 10, kind: 'meta-marchand' }],
    })
    expect(level!.decals).toBeUndefined()
    expect(rejets.length).toBe(1)
  })
})

describe('la planche d’icônes du méta', () => {
  it('chaque article vendable a sa case, dans la grille', () => {
    for (const id of [...ARTICLES_ETAL_IDS, ...ARTICLES_COMPTOIR_IDS]) {
      const c = caseIcone(id)
      expect(c, id).not.toBeNull()
      expect(c!).toBeGreaterThanOrEqual(0)
      expect(c!).toBeLessThan(ICONES_COLONNES * ICONES_RANGEES)
    }
  })

  it('un id inconnu n’a pas de case : on retombe sur l’emoji', () => {
    expect(caseIcone('perlimpinpin')).toBeNull()
  })

  it('le viatique et la fiole de gouttes partagent leur case (même objet)', () => {
    expect(caseIcone('viatique')).toBe(caseIcone('gouttes'))
  })
})

describe('l’éclat : vignette ou bande de vues', () => {
  it('une image carrée est une vignette — le moteur la fera pivoter', () => {
    expect(vuesEclat(256, 256)).toBe(1)
    expect(vuesEclat(512, 400)).toBe(1)
  })

  it('une bande large donne son nombre de vues', () => {
    expect(vuesEclat(2048, 256)).toBe(8)
    expect(vuesEclat(1536, 256)).toBe(6)
  })

  it('une hauteur absurde ne casse rien', () => {
    expect(vuesEclat(256, 0)).toBe(1)
  })
})

describe('le sas de raccord — la pièce qui joint deux modules', () => {
  it('un sas par jonction de couloir, et rien sans structures', () => {
    const j = jonctionsDesStructures(TABLEAU_HUB.structures)
    const sas = decalsDuMeta(TABLEAU_HUB).filter((d) =>
      d.kind.startsWith('sas-'),
    )
    expect(j.length).toBeGreaterThan(0)
    expect(sas.length).toBe(j.length)
    // un tableau sans structure n'en pose aucun
    expect(jonctionsDesStructures(undefined)).toEqual([])
  })

  it('l’ouverture DESSINÉE tombe pile sur la porte percée', () => {
    const j0 = jonctionsDesStructures(TABLEAU_HUB.structures)
    for (const j of j0) {
      expect(j.passage).toBeGreaterThan(100)
      expect(j.profondeur).toBeGreaterThan(40)
    }
    const sas = decalsDuMeta(TABLEAU_HUB).filter((d) => d.kind.startsWith('sas-'))
    for (const d of sas) {
      const j = j0.find((k) => k.x === d.x && k.y === d.y)!
      expect(j, `${d.x},${d.y}`).toBeDefined()
      // la dimension qui porte le trou est celle du passage…
      const porteuse = j.axe === 0 ? d.h : d.w
      expect(porteuse * PART_PASSAGE_SAS).toBeCloseTo(j.passage, 6)
      // …et la planche garde son rapport, jamais étirée
      const long = j.axe === 0 ? d.w : d.h
      expect(long / porteuse).toBeCloseTo(RAPPORT_SAS, 6)
      // le col monte franchement au-dessus du passage : un sas, pas un
      // cache-misère rogné au ras de la porte
      expect(porteuse).toBeGreaterThan(j.passage * 1.5)
      // et la pièce couvre la couture qu'elle vient masquer
      expect(long).toBeGreaterThan(j.profondeur)
      expect(d.fade).toBeGreaterThan(0.5)
    }
  })

  it('une couture plus épaisse que la pièce la fait GRANDIR, pas s’étirer', () => {
    // paroi énorme, porte étroite : le cas où le calage au passage seul
    // laisserait le joint dépasser de part et d'autre du sas
    const gros = {
      ...TABLEAU_HUB,
      structures: [
        { type: 0, minX: -1200, minY: -900, maxX: 0, maxY: 900, ep: 240, porte: 128 },
        { type: 1, minX: -200, minY: -64, maxX: 1200, maxY: 64, ep: 240, porte: 128 },
      ],
    }
    const js = jonctionsDesStructures(gros.structures)
    const sas = decalsDuMeta(gros).filter((d) => d.kind.startsWith('sas-'))
    expect(sas.length).toBe(js.length)
    for (const d of sas) {
      const j = js.find((k) => k.x === d.x && k.y === d.y)!
      const porteuse = j.axe === 0 ? d.h : d.w
      const long = j.axe === 0 ? d.w : d.h
      expect(long).toBeGreaterThan(j.profondeur)
      // grandie en bloc : le rapport de la planche est intact
      expect(long / porteuse).toBeCloseTo(RAPPORT_SAS, 6)
    }
  })

  it('un couloir dont le raccord est refusé n’a pas de sas', () => {
    const sans = {
      ...TABLEAU_HUB,
      structures: (TABLEAU_HUB.structures ?? []).map((s) => ({
        ...s,
        raccord: false as const,
      })),
    }
    expect(jonctionsDesStructures(sans.structures)).toEqual([])
  })

  it('les deux orientations existent : le col et son quart de tour', () => {
    const sortes = new Set(
      decalsDuMeta(TABLEAU_HUB)
        .filter((d) => d.kind.startsWith('sas-'))
        .map((d) => d.kind),
    )
    expect(sortes.has('sas-raccord')).toBe(true)
    expect(sortes.has('sas-raccord-v')).toBe(true)
  })
})
