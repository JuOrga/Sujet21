import { beforeEach, describe, expect, it } from 'vitest'
import {
  LANGUES,
  LANGUE_SOURCE,
  applique,
  avance,
  exporteTextes,
  importeTextes,
  poseTexte,
  retireTexte,
  surcharges,
  videLangue,
} from './atelier'
import { catalogueTextes } from './catalogue'

// RÉÉCRIRE ET TRADUIRE SONT LE MÊME GESTE.
// Une retouche française remplace la source ; une entrée anglaise remplit
// un vide. Ces tests vérifient que le mécanisme tient les deux emplois
// avec les mêmes règles — c'est ce qui permettra d'ajouter une langue sans
// rien réécrire.

const CAT = catalogueTextes()
const UNE = CAT[0]

describe('L’atelier des textes', () => {
  beforeEach(() => {
    for (const l of LANGUES) videLangue(l.code)
  })

  it('déclare une seule langue SOURCE, et c’est celle du code', () => {
    const sources = LANGUES.filter((l) => l.source)
    expect(sources).toHaveLength(1)
    expect(sources[0].code).toBe(LANGUE_SOURCE)
  })

  it('sans retouche, le français rend la source telle quelle', () => {
    const vu = applique(CAT, 'fr')
    expect(vu).toHaveLength(CAT.length)
    for (const e of vu) {
      expect(e.texte).toBe(e.source)
      expect(e.etat).toBe('origine')
    }
  })

  it('sans traduction, l’anglais est VIDE — un trou doit se voir', () => {
    const vu = applique(CAT, 'en')
    for (const e of vu) {
      expect(e.texte).toBe('')
      expect(e.etat).toBe('a-traduire')
      // …mais la source reste sous la main : on traduit en la lisant
      expect(e.source.length).toBeGreaterThan(0)
    }
    expect(avance(vu).faits).toBe(0)
  })

  it('une retouche française remplace la source, et se signale', () => {
    poseTexte('fr', UNE.cle, 'Une prose entièrement neuve.', UNE.texte)
    const e = applique(CAT, 'fr').find((x) => x.cle === UNE.cle)!
    expect(e.texte).toBe('Une prose entièrement neuve.')
    expect(e.source).toBe(UNE.texte) // la source ne bouge jamais
    expect(e.etat).toBe('retouche')
    expect(avance(applique(CAT, 'fr')).faits).toBe(1)
  })

  it('une traduction remplit le vide, sans toucher au français', () => {
    poseTexte('en', UNE.cle, 'A brand new prose.', UNE.texte)
    const en = applique(CAT, 'en').find((x) => x.cle === UNE.cle)!
    expect(en.texte).toBe('A brand new prose.')
    expect(en.etat).toBe('traduit')
    // le français, lui, est resté à l'origine
    const fr = applique(CAT, 'fr').find((x) => x.cle === UNE.cle)!
    expect(fr.texte).toBe(UNE.texte)
    expect(fr.etat).toBe('origine')
  })

  it('une retouche IDENTIQUE à la source ne s’enregistre pas', () => {
    // sinon le compteur d'avancement mentirait : il compterait comme fait
    // un texte que personne n'a touché
    poseTexte('fr', UNE.cle, UNE.texte, UNE.texte)
    expect(surcharges('fr')[UNE.cle]).toBeUndefined()
    poseTexte('fr', UNE.cle, `  ${UNE.texte}  `, UNE.texte) // aux espaces près
    expect(surcharges('fr')[UNE.cle]).toBeUndefined()
    expect(avance(applique(CAT, 'fr')).faits).toBe(0)
  })

  it('un texte vidé efface la retouche : on revient à la source', () => {
    poseTexte('fr', UNE.cle, 'autre chose', UNE.texte)
    expect(surcharges('fr')[UNE.cle]).toBe('autre chose')
    poseTexte('fr', UNE.cle, '   ', UNE.texte)
    expect(surcharges('fr')[UNE.cle]).toBeUndefined()
    expect(applique(CAT, 'fr').find((x) => x.cle === UNE.cle)!.texte).toBe(
      UNE.texte,
    )
  })

  it('se retire, et se vide en bloc', () => {
    poseTexte('en', UNE.cle, 'one', UNE.texte)
    poseTexte('en', CAT[1].cle, 'two', CAT[1].texte)
    expect(Object.keys(surcharges('en'))).toHaveLength(2)
    retireTexte('en', UNE.cle)
    expect(Object.keys(surcharges('en'))).toHaveLength(1)
    videLangue('en')
    expect(Object.keys(surcharges('en'))).toHaveLength(0)
  })

  it('l’avancement compte ce qui est fait, pas ce qui existe', () => {
    const total = CAT.length
    expect(avance(applique(CAT, 'en'))).toEqual({ total, faits: 0, signes: 0 })
    poseTexte('en', UNE.cle, 'Twelve chars', UNE.texte)
    const a = avance(applique(CAT, 'en'))
    expect(a.total).toBe(total)
    expect(a.faits).toBe(1)
    expect(a.signes).toBe('Twelve chars'.length)
  })

  it('l’export se relit, et la langue du DOCUMENT fait foi', () => {
    poseTexte('en', UNE.cle, 'the sample', UNE.texte)
    const json = exporteTextes('en')
    expect(JSON.parse(json).langue).toBe('en')
    videLangue('en')
    expect(Object.keys(surcharges('en'))).toHaveLength(0)
    // on le reprend alors qu'on « regarde » le français : il doit malgré
    // tout atterrir en anglais, sinon un fichier se déverse dans la
    // mauvaise langue parce qu'un onglet était ouvert au mauvais endroit
    const r = importeTextes(json)
    expect(r.langue).toBe('en')
    expect(r.repris).toBe(1)
    expect(surcharges('en')[UNE.cle]).toBe('the sample')
    expect(surcharges('fr')[UNE.cle]).toBeUndefined()
  })

  it('l’export trie ses clés : deux exports se comparent au diff', () => {
    poseTexte('en', 'zzz.b.c', 'z', 'z')
    poseTexte('en', 'aaa.b.c', 'a', 'a')
    const cles = Object.keys(JSON.parse(exporteTextes('en')).textes)
    expect(cles).toEqual([...cles].sort())
  })

  it('refuse ce qui n’est pas un export : rien ne se perd en silence', () => {
    expect(importeTextes('pas du json').repris).toBe(-1)
    expect(importeTextes('{}').repris).toBe(-1) // sans langue
    expect(importeTextes('{"langue":"klingon","textes":{}}').repris).toBe(-1)
    expect(importeTextes('{"langue":"en"}').repris).toBe(-1) // sans textes
    // et les valeurs qui ne sont pas du texte sont ignorées, pas plantées
    const r = importeTextes('{"langue":"en","textes":{"a.b.c":42,"d.e.f":"ok"}}')
    expect(r.repris).toBe(1)
    expect(surcharges('en')['d.e.f']).toBe('ok')
  })
})
