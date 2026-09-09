import { describe, expect, it } from 'vitest'
import {
  AVARIES_LIVREES,
  avariesAuDemarrage,
  catalogueAvaries,
  documentAvaries,
  etatAvaries,
  lisAvaries,
  memesAvaries,
  PRIX_MAX,
} from './avariesPartage'
import { appliqueReparations, avaries, ficheReparation, poseAvaries, REPARATIONS, reparationDef } from './reparations'
import { TABLEAU_HUB } from './hub'
import { stations } from './avariesVue'

const livree = (id: string) => REPARATIONS.find((r) => r.id === id)!

describe('les avaries publiées', () => {
  it('le livré se relit tel quel, et se republie à l’identique', () => {
    const relues = lisAvaries(documentAvaries(AVARIES_LIVREES))
    expect(relues.map((f) => f.id)).toEqual(REPARATIONS.map((r) => r.id))
    expect(memesAvaries(relues, AVARIES_LIVREES)).toBe(true)
    expect(catalogueAvaries(relues)).toEqual(REPARATIONS)
  })

  it('un document vide, illisible ou d’un autre monde rend le livré', () => {
    for (const brut of [null, undefined, 'avaries', 42, {}, { stations: 'non' }, { stations: [{ id: 'télescope' }] }]) {
      expect(memesAvaries(lisAvaries(brut), AVARIES_LIVREES)).toBe(true)
    }
  })

  it('le prix, le nom et le pictogramme se règlent — hors bornes, ils y rentrent', () => {
    const [f] = lisAvaries({
      stations: [{ id: 'eclairage', nom: '  RÉSEAU DE SECOURS  ', prix: 4200, icone: '🔦🔦🔦' }],
    })
    expect(f.nom).toBe('RÉSEAU DE SECOURS')
    expect(f.prix).toBe(PRIX_MAX)
    expect([...f.icone]).toHaveLength(2)
    expect(lisAvaries({ stations: [{ id: 'eclairage', prix: -12 }] })[0].prix).toBe(0)
    // un champ absurde ne casse rien : la valeur livrée tient
    const livre = AVARIES_LIVREES[0]
    const g = lisAvaries({ stations: [{ id: 'eclairage', nom: '   ', prix: 'cher', icone: 7, assombrit: 'oui' }] })[0]
    expect(g.nom).toBe(livre.nom)
    expect(g.prix).toBe(livre.prix)
    expect(g.icone).toBe(livre.icone)
    expect(g.assombrit).toBe(livre.assombrit)
  })

  it('l’ordre du document fait le tableau ; une station dite deux fois ne compte qu’une', () => {
    const dernier = REPARATIONS[REPARATIONS.length - 1].id
    const fiches = lisAvaries({ stations: [{ id: dernier }, { id: dernier }] })
    expect(fiches[0].id).toBe(dernier)
    expect(fiches).toHaveLength(REPARATIONS.length)
    expect(new Set(fiches.map((f) => f.id)).size).toBe(REPARATIONS.length)
  })

  it('une station RETIRÉE de l’accident quitte le catalogue joué — et le hub la donne debout', () => {
    const fiches = lisAvaries({ stations: [{ id: 'eclairage', enAvarie: false }] })
    const catalogue = catalogueAvaries(fiches)
    expect(catalogue.map((r) => r.id)).not.toContain('eclairage')
    expect(catalogue).toHaveLength(REPARATIONS.length - 1)
    // rien de payé, et pourtant le module ne s'assombrit plus : c'est la
    // panne qui a disparu, pas la réparation qui aurait été offerte
    const avec = appliqueReparations(TABLEAU_HUB, [], {}, REPARATIONS)
    const sans = appliqueReparations(TABLEAU_HUB, [], {}, catalogue)
    expect(sans.ambiante).toBeGreaterThan(avec.ambiante ?? 0)
  })

  it('le catalogue POSÉ est celui qui joue : le prix demandé au plot suit', () => {
    const fiches = lisAvaries({ stations: [{ id: 'passerelle-4', prix: 3, nom: 'PASSERELLE' }] })
    try {
      poseAvaries(catalogueAvaries(fiches))
      expect(reparationDef('passerelle-4')).toMatchObject({ prix: 3, nom: 'PASSERELLE' })
      expect(avaries()).toHaveLength(REPARATIONS.length)
      // retirée de l'accident, la station n'est plus réparable : rien à
      // payer au contact de son plot
      poseAvaries(catalogueAvaries(lisAvaries({ stations: [{ id: 'passerelle-4', enAvarie: false }] })))
      expect(reparationDef('passerelle-4')).toBeNull()
      // …mais l'éditeur doit encore pouvoir la nommer pour poser son ancre
      expect(ficheReparation('passerelle-4')?.nom).toBe(livree('passerelle-4').nom)
    } finally {
      poseAvaries(null) // le livré reprend : les autres essais n'en savent rien
    }
    expect(reparationDef('passerelle-4')?.prix).toBe(livree('passerelle-4').prix)
  })

  it('le TABLEAU que le joueur lit suit le catalogue posé — prix, plaque, ordre', () => {
    const dernier = REPARATIONS[REPARATIONS.length - 1].id
    try {
      poseAvaries(catalogueAvaries(lisAvaries({ stations: [{ id: dernier, prix: 7, nom: 'LA PASSERELLE' }] })))
      const vues = stations({ memoire: 10, faites: [] })
      expect(vues[0]).toMatchObject({ id: dernier, rang: 1, prix: 7, nom: 'LA PASSERELLE', etat: 'payable' })
      expect(vues).toHaveLength(REPARATIONS.length)
      // retirée de l'accident, la station quitte aussi le tableau
      poseAvaries(catalogueAvaries(lisAvaries({ stations: [{ id: dernier, enAvarie: false }] })))
      expect(stations({ memoire: 0, faites: [] }).map((v) => v.id)).not.toContain(dernier)
    } finally {
      poseAvaries(null)
    }
  })

  it('les pancartes cachées ne se règlent pas : ce sont des clés, pas des mots', () => {
    const fiches = lisAvaries({ stations: [{ id: 'mur-records', labelsCaches: ['hub.rien'] }] })
    const r = catalogueAvaries(fiches).find((x) => x.id === 'mur-records')
    expect(r?.labelsCaches).toEqual(REPARATIONS.find((x) => x.id === 'mur-records')?.labelsCaches)
  })

  it('qui joue quoi : le joueur ignore le brouillon du poste, le concepteur le garde', () => {
    const brouillon = lisAvaries({ stations: [{ id: 'eclairage', prix: 1 }] })
    const publie = lisAvaries({ stations: [{ id: 'eclairage', prix: 2 }] })
    expect(avariesAuDemarrage({ brouillon, publie, concepteur: false }).source).toBe('publie')
    expect(avariesAuDemarrage({ brouillon, publie, concepteur: true }).source).toBe('brouillon')
    expect(avariesAuDemarrage({ brouillon: null, publie, concepteur: true }).fiches[0].prix).toBe(2)
    const rien = avariesAuDemarrage({ brouillon: null, publie: null, concepteur: false })
    expect(rien.source).toBe('livre')
    expect(memesAvaries(rien.fiches, AVARIES_LIVREES)).toBe(true)
  })

  it('l’écran dit d’où viennent les avaries qui jouent', () => {
    expect(etatAvaries({ courant: AVARIES_LIVREES, publie: null })).toMatchObject({ source: 'livre', identiqueAuLivre: true })
    const publie = lisAvaries({ stations: [{ id: 'eclairage', prix: 2 }] })
    expect(etatAvaries({ courant: publie, publie })).toMatchObject({ source: 'publie', identiqueAuPublie: true })
    expect(etatAvaries({ courant: AVARIES_LIVREES, publie }).source).toBe('brouillon')
    expect(memesAvaries(null, null)).toBe(true)
    expect(memesAvaries(AVARIES_LIVREES, null)).toBe(false)
  })
})
