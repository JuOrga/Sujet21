import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  condensatDuSas,
  gainsDeModule,
  gainsDeSalle,
  instrumentsGagnes,
  litRecolte,
  litresDuModule,
  memoireDuSas,
  pastillesDeSalles,
  recolteNeuve,
  virgule,
  type RecolteModule,
} from './recolte'

describe('le condensat du sas', () => {
  it('verse un centilitre par centilitre livré', () => {
    const c = condensatDuSas({ surplusL: 4.5, rendement: 1, primeDouble: false, pastillesCl: 0 })
    expect(c.verse).toBe(450)
    expect(c.total).toBe(450)
    expect(c.detail).toBe('livraison 450 cL')
  })

  it('compte le DOUBLEMENT de la salle scellée dans ce qu’il affiche', () => {
    // la panne : le sas créditait 900 et l'écran annonçait +450
    const c = condensatDuSas({ surplusL: 4.5, rendement: 1, primeDouble: true, pastillesCl: 0 })
    expect(c.verse).toBe(900)
    expect(c.total).toBe(900)
    expect(c.detail).toContain('salle scellée ×2')
  })

  it('ajoute les pastilles au gain affiché, pas au versement — elles sont déjà en bourse', () => {
    const c = condensatDuSas({ surplusL: 2, rendement: 1.25, primeDouble: true, pastillesCl: 30 })
    expect(c.verse).toBe(500) // 200 × 1,25 × 2 : les pastilles ne doublent pas
    expect(c.total).toBe(530)
    expect(c.detail).toBe('livraison 200 cL · filtre ×1,25 · salle scellée ×2 · pastilles +30 cL')
  })

  it('ne lève ni ne rend de négatif sur une entrée cassée', () => {
    const c = condensatDuSas({ surplusL: -3, rendement: NaN, primeDouble: false, pastillesCl: -5 })
    expect(c.verse).toBe(0)
    expect(c.total).toBe(0)
  })
})

describe('la mémoire du sas', () => {
  const rien = { premiereFois: false, newVolume: false, newChrono: false, primeMur: 0, facteurModule: 1, primeDouble: false }

  it('grave cinq à chaque traversée', () => {
    expect(memoireDuSas(rien)).toEqual({ brut: 5, detail: 'traversée +5' })
  })

  it('ajoute la première fois et les records, mur compris', () => {
    const m = memoireDuSas({ ...rien, premiereFois: true, newVolume: true, newChrono: true, primeMur: 2 })
    expect(m.brut).toBe(16)
    expect(m.detail).toBe('traversée +5 · première fois +5 · record +6')
  })

  it('multiplie par le confinement du module, puis double sous une salle scellée', () => {
    const m = memoireDuSas({ ...rien, premiereFois: true, facteurModule: 1.5, primeDouble: true })
    expect(m.brut).toBe(30) // (5 + 5) × 1,5 × 2
    expect(m.detail).toBe('traversée +5 · première fois +5 · confinement ×1,5 · salle scellée ×2')
  })
})

describe('les tuiles d’une fin de salle', () => {
  const base = {
    condensat: condensatDuSas({ surplusL: 4.5, rendement: 1, primeDouble: false, pastillesCl: 12 }),
    bourseCl: 800,
    memoire: 10,
    memoireDetail: 'traversée +5 · première fois +5',
    memoireSolde: 142,
    tirageGaranti: false,
    orbe: null,
  }

  it('montrent la bourse ET la mémoire — celle-ci ne se taisait que trop', () => {
    const g = gainsDeSalle(base)
    expect(g.map((x) => x.cle)).toEqual(['condensat', 'memoire'])
    expect(g[0].valeur).toBe('+462 cL')
    expect(g[0].solde).toEqual({ nom: 'EN BOURSE', valeur: '800 cL' })
    expect(g[1].valeur).toBe('+10')
    expect(g[1].solde).toEqual({ nom: 'AUX REGISTRES', valeur: '142' })
  })

  it('disent à quoi sert chaque monnaie, et d’où vient chaque gain', () => {
    for (const x of gainsDeSalle(base)) {
      expect(x.role.length).toBeGreaterThan(20)
      expect(x.detail.length).toBeGreaterThan(0)
    }
  })

  it('font rouler le compteur jusqu’à la valeur écrite, exactement', () => {
    for (const x of gainsDeSalle(base))
      if (x.n > 0) expect(`${x.prefixe}${x.n}${x.suffixe}`).toBe(x.valeur)
  })

  it('n’affichent pas de mémoire quand rien ne s’est gravé', () => {
    expect(gainsDeSalle({ ...base, memoire: 0 }).map((x) => x.cle)).toEqual(['condensat'])
  })

  it('ajoutent le tirage garanti et l’orbe quand la salle les rend', () => {
    const g = gainsDeSalle({ ...base, tirageGaranti: true, orbe: 'Solidification' })
    expect(g.map((x) => x.cle)).toEqual(['condensat', 'memoire', 'tirage', 'orbe'])
    expect(g[3].valeur).toBe('Solidification')
  })
})

describe('la récolte d’un module', () => {
  const pleine = (): RecolteModule => ({
    ...recolteNeuve('M1', ['vanne'], 1),
    salles: [
      { code: '21-01', pct: 1, litres: 4.5 },
      { code: '21-02', pct: 0.6, litres: 2.25 },
    ],
    haltes: 1,
    condensatCl: 700,
    memoire: 24,
    orbes: ['Vaporisation'],
  })
  const etat = (r: RecolteModule) => ({
    recolte: r,
    bourseCl: 550,
    memoireSolde: 300,
    instruments: ['vanne', 'filtre', 'tamis'],
    nomInstrument: (id: string) => (id === 'inconnu' ? null : { icone: '•', nom: id.toUpperCase() }),
    paliers: 3,
  })

  it('part de zéro, et retient ce qu’on tenait à l’entrée', () => {
    const r = recolteNeuve('M1', ['a', 'b'], 2)
    expect(r.salles).toEqual([])
    expect(r.instrumentsEntree).toEqual(['a', 'b'])
    expect(r.paliersEntree).toBe(2)
    expect(litresDuModule(r)).toBe(0)
  })

  it('additionne les litres des salles', () => {
    expect(litresDuModule(pleine())).toBeCloseTo(6.75)
  })

  it('ne compte comme butin que les instruments pris DEPUIS l’entrée', () => {
    expect(instrumentsGagnes(['a'], ['a', 'b', 'c'])).toEqual(['b', 'c'])
    // un second exemplaire d'une carte déjà tenue est un gain ; une carte rendue n'en retire pas
    expect(instrumentsGagnes(['a'], ['a', 'a'])).toEqual(['a'])
    expect(instrumentsGagnes(['a', 'b'], ['b'])).toEqual([])
  })

  it('dit tout ce que le module a rendu, dans l’ordre de lecture', () => {
    const g = gainsDeModule(etat(pleine()))
    expect(g.map((x) => x.cle)).toEqual(['livre', 'condensat', 'memoire', 'maitrise', 'instruments', 'orbe'])
    expect(g[0].valeur).toBe('6,75 L')
    expect(g[0].detail).toBe('2 salles franchies')
    expect(g[1].valeur).toBe('+700 cL')
    expect(g[2].valeur).toBe('+24')
    expect(g[3].valeur).toBe('+2 paliers')
    expect(g[4].valeur).toBe('+2')
    // le détail finit en infobulle (texte brut) : l'émoji d'un instrument y
    // disparaît au profit de son nom — il n'y a pas d'icône rendue en title
    expect(g[4].detail).toBe('FILTRE · TAMIS')
    expect(g[5].valeur).toBe('Vaporisation')
  })

  it('dit « aucun » plutôt que de cacher une ligne vide', () => {
    const g = gainsDeModule({ ...etat(recolteNeuve('M1', ['vanne', 'filtre', 'tamis'], 3)) })
    expect(g.find((x) => x.cle === 'instruments')?.valeur).toBe('aucun')
    expect(g.find((x) => x.cle === 'maitrise')?.valeur).toBe('aucun palier')
    expect(g.some((x) => x.cle === 'orbe')).toBe(false)
  })

  it('range chaque salle sous son régime d’écoulement', () => {
    expect(pastillesDeSalles(pleine()).map((p) => [p.code, p.nom, p.litres])).toEqual([
      ['21-01', 'SUPERFLUIDE', '4,50 L'],
      ['21-02', 'TURBULENT', '2,25 L'],
    ])
  })

  // la fin de module pose un petit sceau par salle : il lui faut la lettre du
  // rang (la case de la planche), pas seulement le nom et la teinte
  it('donne à chaque salle la lettre de son sceau', () => {
    expect(pastillesDeSalles(pleine()).map((p) => p.rang)).toEqual(['S', 'B'])
  })

  it('se relit d’une sauvegarde, et repart à neuf si elle parle d’un autre module', () => {
    const r = pleine()
    expect(litRecolte(JSON.parse(JSON.stringify(r)), 'M1', ['x'], 9)).toEqual(r)
    const autre = litRecolte(JSON.parse(JSON.stringify(r)), 'M2', ['x'], 9)
    expect(autre).toEqual(recolteNeuve('M2', ['x'], 9))
  })

  it('tolère une sauvegarde d’avant ce compte, ou abîmée', () => {
    expect(litRecolte(undefined, 'M1', ['x'], 2)).toEqual(recolteNeuve('M1', ['x'], 2))
    const abimee = litRecolte(
      { module: 'M1', salles: [null, { code: 7, pct: 'x', litres: -2 }], condensatCl: 'beaucoup', memoire: -4, orbes: [3, 'Gel'] },
      'M1',
      ['x'],
      2,
    )
    expect(abimee.salles).toEqual([{ code: '?', pct: 0, litres: 0 }])
    expect(abimee.condensatCl).toBe(0)
    expect(abimee.memoire).toBe(0)
    expect(abimee.orbes).toEqual(['Gel'])
    expect(abimee.instrumentsEntree).toEqual(['x'])
  })
})

// LE CALCUL NE PROTÈGE QUE S'IL EST BRANCHÉ : main.ts doit créditer ce que
// condensatDuSas dit de verser, et afficher la mémoire que gagneMemoireRun a
// réellement gravée — c'est ce lien qui manquait (deux formules écrites à
// cent lignes d'écart, l'une doublée par la prime, l'autre pas).
describe('le sas crédite ce que l’écran affiche', () => {
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

  it('verse en bourse le montant de condensatDuSas, et le passe tel quel aux tuiles', () => {
    expect(MAIN).toMatch(/const condSas = condensatDuSas\(/)
    expect(MAIN).toMatch(/gagneCondensat\(condSas\.verse\)/)
    expect(MAIN).toMatch(/condensat: condSas,/)
    // plus de seconde formule du gain, écrite à part
    expect(MAIN).not.toMatch(/gainCl/)
  })

  it('affiche la mémoire réellement gravée, pas un recalcul', () => {
    expect(MAIN).toMatch(/const memoireGravee = gagneMemoireRun\(memSas\.brut\)/)
    expect(MAIN).toMatch(/memoire: memoireGravee,/)
  })

  it('compte tout gain à la récolte du module, d’où qu’il vienne', () => {
    expect(MAIN).toMatch(/run\.recolte\.condensatCl \+= Math\.round\(cl\)/)
    expect(MAIN).toMatch(/run\.recolte\.memoire \+= majore/)
  })
})

describe('les nombres de la cérémonie', () => {
  it('s’écrivent à la française', () => {
    expect(virgule(4.5)).toBe('4,50')
    expect(virgule(4.5, 1)).toBe('4,5')
  })

  // LA PANNE : le relevé écrivait « 4.50 L » (toFixed nu) à deux lignes du
  // versement qui écrivait « 4,50 L ». Ce test garde la cérémonie entière :
  // plus un litre ne s'y écrit par toFixed sans passer par la virgule.
  it('main.ts n’écrit plus un litre au point dans la cérémonie', () => {
    const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    const debut = MAIN.indexOf('function fermeMiseEnBonbonne')
    const fin = MAIN.indexOf('const dashAimEl')
    expect(debut).toBeGreaterThan(0)
    expect(fin).toBeGreaterThan(debut)
    const ceremonie = MAIN.slice(debut, fin)
    const fautifs = [...ceremonie.matchAll(/\$\{[^{}]*\.toFixed\(\d\)\} L/g)].map((m) => m[0])
    expect(fautifs).toEqual([])
  })
})
