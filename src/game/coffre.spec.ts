// Le contrat du coffre : trois emplacements, un document par emplacement,
// la façade qui ne voit que l'actif, la migration de l'héritage qui ne se
// rejoue pas, le résumé qui lit sans importer, la lecture seule d'un
// document plus récent, et l'aller-retour export → import.
import { describe, expect, it } from 'vitest'
import {
  CLE_ACTIF,
  CLES_PROGRESSION,
  Coffre,
  FORMAT_COFFRE,
  balaieHeritage,
  cleEmplacement,
  litDocument,
  migreHeritage,
  stockageMemoire,
  type DocumentCoffre,
} from './coffre'

const HORLOGE = () => '2026-09-05T10:00:00.000Z'
const MACHINE = () => 'poste-a'

function neuf(dos = stockageMemoire()): { dos: ReturnType<typeof stockageMemoire>; c: Coffre } {
  return { dos, c: new Coffre(dos, { maintenant: HORLOGE, machine: MACHINE }) }
}

function registres(operator: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    essais: 4,
    operator,
    tableaux: { '21-A': {}, '21-B': {} },
    expedition: null,
    history: [],
    memoire: 37,
    fioles: ['f1'],
    ...extra,
  })
}

describe('Le coffre — trois emplacements', () => {
  it('un coffre neuf : trois emplacements vides, l’actif est le 1, la machine est posée une fois', () => {
    const { dos, c } = neuf()
    expect(c.actif).toBe(1)
    expect(c.machine).toBe('poste-a')
    expect(c.resumes().map((r) => r.vide)).toEqual([true, true, true])
    expect(c.lectureSeule).toBe(false)
    // la machine ne se retire pas : un second coffre sur le même dos la relit
    const c2 = new Coffre(dos, { maintenant: HORLOGE, machine: () => 'autre' })
    expect(c2.machine).toBe('poste-a')
  })

  it('la façade écrit le document EN ENTIER, avec format, date et machine', () => {
    const { dos, c } = neuf()
    c.stockage.setItem('projet21.registres.v1', registres('REX'))
    c.stockage.setItem('sujet21-eveil-v3', '1')
    const texte = dos.getItem(cleEmplacement(1))
    expect(texte).not.toBeNull()
    const doc = JSON.parse(texte!) as DocumentCoffre
    expect(doc.format).toBe(FORMAT_COFFRE)
    expect(doc.majAt).toBe('2026-09-05T10:00:00.000Z')
    expect(doc.machine).toBe('poste-a')
    expect(doc.cles['sujet21-eveil-v3']).toBe('1')
    expect(c.stockage.getItem('projet21.registres.v1')).toBe(registres('REX'))
    // les clés des modules ne se retrouvent JAMAIS à plat dans le dos
    expect(dos.getItem('projet21.registres.v1')).toBeNull()
    // retirer la dernière clé vide l'emplacement pour de bon
    c.stockage.removeItem('projet21.registres.v1')
    c.stockage.removeItem('sujet21-eveil-v3')
    expect(dos.getItem(cleEmplacement(1))).toBeNull()
    expect(c.resume(1).vide).toBe(true)
  })

  it('l’héritage : les clés d’avant deviennent l’emplacement 1, les préférences restent, et rien ne se rejoue', () => {
    const dos = stockageMemoire()
    dos.setItem('projet21.registres.v1', registres('JU'))
    dos.setItem('sujet21-trophees', JSON.stringify({ 'palet-parfait': '2026-09-01' }))
    dos.setItem('sujet21-run-v1', JSON.stringify({ index: 3 }))
    dos.setItem('sujet21-res', 'faible') // une préférence d'appareil
    dos.setItem('projet21.editeur.v1', '{}') // un brouillon du concepteur
    const { c } = neuf(dos)
    const r = c.resume(1)
    expect(r).toMatchObject({
      vide: false,
      operateur: 'JU',
      essais: 4,
      memoire: 37,
      salles: 2,
      fioles: 1,
      trophees: 1,
      runEnCours: true,
    })
    // les préférences et les brouillons ne sont pas emportés
    const doc = litDocument(dos.getItem(cleEmplacement(1))).doc!
    expect(Object.keys(doc.cles).sort()).toEqual(
      ['projet21.registres.v1', 'sujet21-run-v1', 'sujet21-trophees'].sort(),
    )
    // les clés d'origine restent CE démarrage-là (filet) : le suivant les balaie,
    // et la migration ne se rejoue pas
    expect(dos.getItem('projet21.registres.v1')).not.toBeNull()
    const { c: c2 } = neuf(dos)
    expect(c2.resume(1).operateur).toBe('JU')
    expect(dos.getItem('projet21.registres.v1')).toBeNull()
    expect(dos.getItem('sujet21-trophees')).toBeNull()
    expect(dos.getItem('sujet21-run-v1')).toBeNull()
    // les préférences et les brouillons ne sont pas balayés
    expect(dos.getItem('sujet21-res')).toBe('faible')
    expect(dos.getItem('projet21.editeur.v1')).toBe('{}')
    // l'emplacement 1 vidé puis un coffre neuf → toujours vide, rien ne revient
    c2.efface(1)
    const { c: c3 } = neuf(dos)
    expect(c3.resume(1).vide).toBe(true)
    expect(migreHeritage(dos, HORLOGE(), 'x')).toBe(0)
  })

  it('le balayage n’a lieu que sous la preuve d’un emplacement 1 lisible — jamais sur un document cassé ni avant la migration', () => {
    // avant toute migration : rien ne bouge
    const dos = stockageMemoire()
    dos.setItem('projet21.registres.v1', registres('JU'))
    expect(balaieHeritage(dos)).toBe(0)
    expect(dos.getItem('projet21.registres.v1')).not.toBeNull()
    // migré, mais l'emplacement 1 est un texte tronqué : les sources restent
    neuf(dos)
    dos.setItem(cleEmplacement(1), '{"format":1,"cles":{"projet21.registres.v1":"…')
    expect(balaieHeritage(dos)).toBe(0)
    expect(dos.getItem('projet21.registres.v1')).not.toBeNull()
    const { c } = neuf(dos)
    expect(dos.getItem('projet21.registres.v1')).not.toBeNull()
    expect(c.resume(1).vide).toBe(true) // le document cassé se lit vide, sans écraser les sources
    // l'emplacement 1 relisible : le balayage passe, et ne compte que ce qu'il efface
    dos.setItem(cleEmplacement(1), JSON.stringify({ format: 1, majAt: '', machine: '', cles: { 'projet21.registres.v1': registres('JU') } }))
    dos.setItem('sujet21-eveil-v3', '1')
    expect(balaieHeritage(dos)).toBe(2)
    expect(balaieHeritage(dos)).toBe(0)
    expect(dos.getItem('sujet21-eveil-v3')).toBeNull()
  })

  it('l’héritage ne touche pas un coffre qui a déjà un emplacement', () => {
    const dos = stockageMemoire()
    dos.setItem(cleEmplacement(2), JSON.stringify({ format: 1, majAt: '', machine: '', cles: { a: '1' } }))
    dos.setItem('projet21.registres.v1', registres('VIEUX'))
    const { c } = neuf(dos)
    expect(c.resume(1).vide).toBe(true)
    expect(c.resume(2).vide).toBe(false)
  })

  it('toutes les clés de progression migrent, aucune ne s’oublie', () => {
    const dos = stockageMemoire()
    for (const k of CLES_PROGRESSION) dos.setItem(k, `v:${k}`)
    expect(migreHeritage(dos, HORLOGE(), 'm')).toBe(CLES_PROGRESSION.length)
    const doc = litDocument(dos.getItem(cleEmplacement(1))).doc!
    for (const k of CLES_PROGRESSION) expect(doc.cles[k]).toBe(`v:${k}`)
  })

  it('changer d’emplacement : le pointeur, puis un coffre neuf lit l’autre — et les deux ne se voient pas', () => {
    const { dos, c } = neuf()
    c.stockage.setItem('projet21.registres.v1', registres('UN'))
    c.choisit(2)
    expect(dos.getItem(CLE_ACTIF)).toBe('2')
    const { c: c2 } = neuf(dos)
    expect(c2.actif).toBe(2)
    expect(c2.stockage.getItem('projet21.registres.v1')).toBeNull()
    c2.stockage.setItem('projet21.registres.v1', registres('DEUX'))
    expect(c2.resume(1).operateur).toBe('UN')
    expect(c2.resume(2).operateur).toBe('DEUX')
    expect(litDocument(dos.getItem(cleEmplacement(1))).doc!.cles['projet21.registres.v1']).toBe(
      registres('UN'),
    )
    // un pointeur absurde retombe sur le 1
    dos.setItem(CLE_ACTIF, '9')
    expect(neuf(dos).c.actif).toBe(1)
  })

  it('un document d’un jeu plus récent se lit, se résume, et ne s’écrase jamais', () => {
    const dos = stockageMemoire()
    const futur = JSON.stringify({
      format: FORMAT_COFFRE + 1,
      majAt: '2027-01-01T00:00:00.000Z',
      machine: 'deck',
      cles: { 'projet21.registres.v1': registres('DEMAIN'), 'cle-inconnue': '?' },
    })
    dos.setItem(cleEmplacement(1), futur)
    const { c } = neuf(dos)
    expect(c.lectureSeule).toBe(true)
    expect(c.resume(1)).toMatchObject({ lectureSeule: true, operateur: 'DEMAIN', machine: 'deck' })
    expect(c.stockage.getItem('projet21.registres.v1')).toBe(registres('DEMAIN'))
    c.stockage.setItem('projet21.registres.v1', registres('ECRASE'))
    c.stockage.removeItem('cle-inconnue')
    expect(dos.getItem(cleEmplacement(1))).toBe(futur)
  })

  it('un texte qui n’est pas un document : emplacement lu comme vide', () => {
    expect(litDocument(null).doc).toBeNull()
    expect(litDocument('{pas du json').doc).toBeNull()
    expect(litDocument('[]').doc).toBeNull()
    expect(litDocument(JSON.stringify({ format: 0, cles: {} })).doc).toBeNull()
    // les valeurs qui ne sont pas des textes sont ignorées, pas fatales
    const doc = litDocument(JSON.stringify({ format: 1, cles: { a: '1', b: 2, c: null } })).doc!
    expect(doc.cles).toEqual({ a: '1' })
  })

  it('export puis import : la partie voyage d’un emplacement à l’autre, l’import refuse n’importe quoi', () => {
    const { c } = neuf()
    c.stockage.setItem('projet21.registres.v1', registres('PORTE'))
    const fichier = c.exporte(1)!
    expect(c.importe(3, fichier)).toBe(true)
    expect(c.resume(3)).toMatchObject({ operateur: 'PORTE', vide: false })
    expect(c.exporte(2)).toBeNull()
    expect(c.importe(2, 'ceci n’est pas une sauvegarde')).toBe(false)
    expect(c.resume(2).vide).toBe(true)
    // l'actif importé : la façade relit aussitôt le contenu importé
    const { c: d } = neuf()
    d.stockage.setItem('projet21.registres.v1', registres('AVANT'))
    expect(d.importe(1, fichier)).toBe(true)
    expect(d.stockage.getItem('projet21.registres.v1')).toBe(registres('PORTE'))
  })

  it('effacer l’actif vide aussi la mémoire : les modules continuent sur du vide', () => {
    const { dos, c } = neuf()
    c.stockage.setItem('sujet21-eveil-v3', '1')
    c.efface(1)
    expect(dos.getItem(cleEmplacement(1))).toBeNull()
    expect(c.stockage.getItem('sujet21-eveil-v3')).toBeNull()
    expect(c.resume(1).vide).toBe(true)
  })

  it('un dos qui refuse d’écrire ne casse rien : la progression tient la session', () => {
    const muet = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('refusé')
      },
    }
    const c = new Coffre(muet, { maintenant: HORLOGE, machine: MACHINE })
    expect(() => c.stockage.setItem('projet21.registres.v1', registres('X'))).not.toThrow()
    expect(c.stockage.getItem('projet21.registres.v1')).toBe(registres('X'))
    expect(c.resume(1).operateur).toBe('X')
    expect(() => c.choisit(2)).not.toThrow()
    expect(() => c.efface(1)).not.toThrow()
  })
})
