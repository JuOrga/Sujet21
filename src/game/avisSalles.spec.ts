// Le contrat de l'avis du joueur sur une salle : un avis par personne et
// par salle, de 1 à 5 ; le carnet du poste retient le mien et ce qui attend
// le magasin ; un document d'ailleurs ne casse rien, et il ne grossit pas
// sans fin sous les salles générées.
import { describe, expect, it } from 'vitest'
import {
  avisDeTouche,
  avisSalleDe,
  carnetApresEnvoi,
  elagueAvisSalles,
  ligneMoyenne,
  lisAvisSalles,
  lisCarnetAvis,
  moyenneAvis,
  noteAuCarnet,
  poseAvisSalle,
  superposeAttente,
  type DocumentAvisSalles,
} from './avisSalles'

describe('L’avis du joueur sur une salle', () => {
  it('un document neuf n’a d’avis sur rien ; chacun pose le sien, la moyenne les porte', () => {
    const vide = lisAvisSalles(null)
    expect(vide.avis).toEqual({})
    expect(avisSalleDe(vide, 'T-01', 'JULIEN')).toBe(0)
    expect(moyenneAvis(vide, 'T-01')).toBeNull()
    expect(ligneMoyenne(vide, 'T-01')).toBe('')
    let doc = poseAvisSalle(vide, 'T-01', 5, 'JULIEN', 'd1')
    doc = poseAvisSalle(doc, 'T-01', 4, 'MARIE', 'd2')
    doc = poseAvisSalle(doc, 'T-01', 4, 'PAUL', 'd3')
    expect(avisSalleDe(doc, 'T-01', 'MARIE')).toBe(4)
    expect(moyenneAvis(doc, 'T-01')).toEqual({ n: 3, moyenne: 13 / 3 })
    // la virgule française, et le nombre d'avis toujours à côté
    expect(ligneMoyenne(doc, 'T-01')).toBe('4,3 / 5 · 3 avis')
    // poser n'a pas touché l'ancien document
    expect(vide.avis).toEqual({})
  })

  it('un seul avis par personne : le dernier fait foi, et 0 retire le sien sans toucher aux autres', () => {
    let doc = poseAvisSalle(lisAvisSalles(null), 'T-01', 2, 'JULIEN', 'd1')
    doc = poseAvisSalle(doc, 'T-01', 5, 'MARIE', 'd2')
    doc = poseAvisSalle(doc, 'T-01', 4, 'JULIEN', 'd3')
    expect(moyenneAvis(doc, 'T-01')).toEqual({ n: 2, moyenne: 4.5 })
    doc = poseAvisSalle(doc, 'T-01', 0, 'JULIEN', 'd4')
    expect(doc.avis['T-01']).toEqual({ MARIE: { avis: 5, date: 'd2' } })
    // la dernière entrée partie, la salle disparaît du document
    doc = poseAvisSalle(doc, 'T-01', 0, 'MARIE', 'd5')
    expect(doc.avis).toEqual({})
  })

  it('sans nom, l’avis se range sous « anonyme » ; une salle sans code ne reçoit rien', () => {
    const doc = poseAvisSalle(lisAvisSalles(null), 'T-01', 3, '  ', 'd1')
    expect(doc.avis['T-01']).toEqual({ anonyme: { avis: 3, date: 'd1' } })
    expect(avisSalleDe(doc, 'T-01', '')).toBe(3)
    expect(poseAvisSalle(doc, '   ', 5, 'JULIEN', 'd2')).toBe(doc)
  })

  it('la relecture écarte ce qui ne rentre pas : avis hors de 1..5, auteur vide, formes cassées', () => {
    const doc = lisAvisSalles({
      avis: {
        'T-01': {
          JULIEN: { avis: 4, date: 'd1' },
          MARIE: { avis: 6, date: 'd2' },
          PAUL: { avis: 2.5 },
          '  ': { avis: 3 },
          LEA: 'cinq',
          ZOE: { avis: 1 },
        },
        'T-02': 'rien',
        'T-03': [],
        '': { JULIEN: { avis: 5 } },
        'T-04': { MARIE: { avis: 0 } },
      },
      intrus: true,
    })
    expect(doc).toEqual({
      avis: { 'T-01': { JULIEN: { avis: 4, date: 'd1' }, ZOE: { avis: 1, date: '' } } },
    })
    expect(lisAvisSalles('texte').avis).toEqual({})
    expect(lisAvisSalles({ avis: [] }).avis).toEqual({})
  })

  it('le document se tient sous son plafond : les salles à l’avis le plus récent restent', () => {
    let doc: DocumentAvisSalles = lisAvisSalles(null)
    doc = poseAvisSalle(doc, 'G-vieux', 3, 'JULIEN', '2026-01-01')
    doc = poseAvisSalle(doc, 'T-01', 4, 'JULIEN', '2026-01-02')
    doc = poseAvisSalle(doc, 'G-neuf', 2, 'MARIE', '2026-06-01')
    // la salle écrite, rejugée hier par quelqu'un d'autre, redevient récente
    doc = poseAvisSalle(doc, 'T-01', 5, 'MARIE', '2026-06-02')
    expect(elagueAvisSalles(doc, 3)).toBe(doc)
    const garde = elagueAvisSalles(doc, 2)
    expect(Object.keys(garde.avis).sort()).toEqual(['G-neuf', 'T-01'])
    // une salle gardée garde TOUS ses avis, l'ancien compris
    expect(moyenneAvis(garde, 'T-01')).toEqual({ n: 2, moyenne: 4.5 })
  })
})

describe('La touche', () => {
  it('1 à 5 posent un avis, 0 dit PAS D’AVIS, le reste ne dit rien', () => {
    expect(['1', '2', '3', '4', '5'].map(avisDeTouche)).toEqual([1, 2, 3, 4, 5])
    expect(avisDeTouche('0')).toBe(0)
    for (const k of ['6', '9', ' ', '', 'a', 'Enter', '12', '00', 'F1']) expect(avisDeTouche(k)).toBeNull()
  })
})

describe('Le carnet du poste', () => {
  it('un carnet absent ou illisible est un carnet vide', () => {
    const vide = { miens: {}, attente: {} }
    expect(lisCarnetAvis(null)).toEqual(vide)
    expect(lisCarnetAvis('{pas du json')).toEqual(vide)
    expect(lisCarnetAvis('[1,2]')).toEqual(vide)
    expect(lisCarnetAvis('{"miens":{"T-01":{"avis":9}},"attente":{"T-01":{"avis":-1}}}')).toEqual(vide)
  })

  it('noter inscrit le mien et le met en attente ; le carnet survit à l’aller-retour du stockage', () => {
    let carnet = noteAuCarnet(lisCarnetAvis(null), 'T-01', 4, 'd1')
    carnet = noteAuCarnet(carnet, 'T-02', 2, 'd2')
    expect(carnet.miens).toEqual({ 'T-01': { avis: 4, date: 'd1' }, 'T-02': { avis: 2, date: 'd2' } })
    expect(carnet.attente).toEqual({ 'T-01': { avis: 4, date: 'd1' }, 'T-02': { avis: 2, date: 'd2' } })
    expect(lisCarnetAvis(JSON.stringify(carnet))).toEqual(carnet)
  })

  it('retirer le sien l’efface du carnet, mais le RETRAIT attend d’être publié', () => {
    let carnet = noteAuCarnet(lisCarnetAvis(null), 'T-01', 4, 'd1')
    carnet = noteAuCarnet(carnet, 'T-01', 0, 'd2')
    expect(carnet.miens).toEqual({})
    expect(carnet.attente).toEqual({ 'T-01': { avis: 0, date: 'd2' } })
    // le retrait en attente survit lui aussi au stockage
    expect(lisCarnetAvis(JSON.stringify(carnet)).attente).toEqual({ 'T-01': { avis: 0, date: 'd2' } })
  })

  it('rien ne change, rien n’attend : PAS D’AVIS sans avis, ou son cran re-pressé, ne coûte pas d’écriture', () => {
    const vide = lisCarnetAvis(null)
    // le bilan passé sur « pas d'avis » : le carnet est rendu tel quel
    expect(noteAuCarnet(vide, 'T-01', 0, 'd1')).toBe(vide)
    const pose = noteAuCarnet(vide, 'T-01', 4, 'd1')
    // re-presser son cran ne le retire pas et ne redate rien
    expect(noteAuCarnet(pose, 'T-01', 4, 'd2')).toBe(pose)
    // publié, puis PAS D'AVIS : là, le retrait attend
    const publie = carnetApresEnvoi(pose, pose.attente)
    expect(publie.attente).toEqual({})
    expect(noteAuCarnet(publie, 'T-01', 0, 'd3').attente).toEqual({ 'T-01': { avis: 0, date: 'd3' } })
  })

  it('l’attente se pose PAR-DESSUS le document relu : les avis des autres restent, le retrait retire', () => {
    let distant = poseAvisSalle(lisAvisSalles(null), 'T-01', 5, 'MARIE', 'd0')
    distant = poseAvisSalle(distant, 'T-01', 1, 'JULIEN', 'd0')
    distant = poseAvisSalle(distant, 'T-02', 3, 'JULIEN', 'd0')
    // T-02 : un avis déjà publié depuis ce poste, que PAS D'AVIS retire
    let carnet = noteAuCarnet(lisCarnetAvis(null), 'T-02', 3, 'd0')
    carnet = carnetApresEnvoi(carnet, carnet.attente)
    carnet = noteAuCarnet(carnet, 'T-01', 4, 'd1')
    carnet = noteAuCarnet(carnet, 'T-02', 0, 'd2')
    carnet = noteAuCarnet(carnet, 'T-03', 2, 'd3')
    const doc = superposeAttente(distant, carnet.attente, 'JULIEN')
    expect(doc.avis).toEqual({
      'T-01': { MARIE: { avis: 5, date: 'd0' }, JULIEN: { avis: 4, date: 'd1' } },
      'T-03': { JULIEN: { avis: 2, date: 'd3' } },
    })
  })

  it('l’envoi accepté vide l’attente — sauf la salle rejugée pendant l’écriture', () => {
    let carnet = noteAuCarnet(lisCarnetAvis(null), 'T-01', 4, 'd1')
    carnet = noteAuCarnet(carnet, 'T-02', 2, 'd2')
    const envoyees = carnet.attente
    // pendant que le magasin écrit, le joueur change d'avis sur T-02
    carnet = noteAuCarnet(carnet, 'T-02', 5, 'd3')
    const apres = carnetApresEnvoi(carnet, envoyees)
    expect(apres.attente).toEqual({ 'T-02': { avis: 5, date: 'd3' } })
    expect(apres.miens).toEqual(carnet.miens)
    // et l'envoi suivant finit de vider
    expect(carnetApresEnvoi(apres, apres.attente).attente).toEqual({})
  })
})
