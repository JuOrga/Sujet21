// Les assets du méta : les décalques synthétisés collent aux données posées,
// et la planche d'icônes couvre tout ce que le commerce sait vendre.
import { describe, expect, it } from 'vitest'
import {
  ICONES_COLONNES,
  ICONES_RANGEES,
  MARCHAND_TAILLE,
  caseIcone,
  decalsDuMeta,
  vuesEclat,
} from './metaAssets'
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

  it('chaque plot pose son alcôve, exactement sur son rectangle', () => {
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
      expect(d!.w).toBe(a.plot.maxX - a.plot.minX)
      expect(d!.h).toBe(a.plot.maxY - a.plot.minY)
    }
  })

  it('le marchand pose sa masse sur son point, le banc sur son rectangle', () => {
    const eco = decalsDuMeta(TABLEAU_ECONOMAT)
    const m = eco.find((d) => d.kind === 'meta-marchand')
    expect(m).toBeDefined()
    expect(m!.x).toBe(TABLEAU_ECONOMAT.marchand!.x)
    expect(m!.y).toBe(TABLEAU_ECONOMAT.marchand!.y)
    expect(m!.w).toBe(MARCHAND_TAILLE)
    expect(m!.h).toBe(MARCHAND_TAILLE)

    const hub = decalsDuMeta(TABLEAU_HUB)
    const b = hub.find((d) => d.kind === 'meta-banc')
    const banc = TABLEAU_HUB.bancMemoires!
    expect(b).toBeDefined()
    expect(b!.w).toBe(banc.maxX - banc.minX)
    expect(b!.h).toBe(banc.maxY - banc.minY)
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
