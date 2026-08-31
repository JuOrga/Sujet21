import { describe, expect, it } from 'vitest'
import {
  REPOS_VERSEMENT_S,
  bonbonneIllimitee,
  doitVerserAuto,
  seuilVersementAuto,
  type EtatVersement,
} from './bonbonne'
import { DEFAULT_PARAMS } from '../sim/params'

const BASE: EtatVersement = {
  auHub: true,
  litres: 0.7,
  litresPleins: 3,
  lastCallLiters: DEFAULT_PARAMS.lastCallLiters,
  empeche: false,
  depuisDernier: 10,
}

const etat = (o: Partial<EtatVersement> = {}): EtatVersement => ({ ...BASE, ...o })

describe('La bonbonne au hub — la réserve ne s’y compte pas', () => {
  it('est illimitée au hub, comptée partout ailleurs', () => {
    expect(bonbonneIllimitee(true)).toBe(true)
    expect(bonbonneIllimitee(false)).toBe(false)
  })
})

describe('Le versement automatique — avant l’alerte, jamais après', () => {
  it('se déclenche AU-DESSUS du seuil de première alerte', () => {
    // C'est tout l'objet : la bannière « la dernière impulsion approche »
    // ne doit jamais avoir l'occasion de s'afficher au hub.
    const seuil = seuilVersementAuto(DEFAULT_PARAMS.lastCallLiters)
    expect(seuil).toBeGreaterThan(DEFAULT_PARAMS.lastCallLiters)
    // et au-dessus aussi du seuil de dernière impulsion, forcément
    expect(seuil).toBeGreaterThan(DEFAULT_PARAMS.criticalVolumeLiters)
  })

  it('verse dès qu’on descend sous le seuil', () => {
    const seuil = seuilVersementAuto(DEFAULT_PARAMS.lastCallLiters)
    expect(doitVerserAuto(etat({ litres: seuil - 0.01 }))).toBe(true)
  })

  it('ne verse pas tant qu’on est au-dessus', () => {
    const seuil = seuilVersementAuto(DEFAULT_PARAMS.lastCallLiters)
    expect(doitVerserAuto(etat({ litres: seuil + 0.01 }))).toBe(false)
  })

  it('l’alerte ne peut pas être atteinte sans qu’un versement ait été demandé', () => {
    // Le vrai contrat, formulé à l'envers : pour TOUT volume qui déclenche
    // l'alerte, la décision de verser était déjà prise avant.
    for (let l = 0; l <= DEFAULT_PARAMS.lastCallLiters; l += 0.05)
      expect(doitVerserAuto(etat({ litres: l })), `${l} L`).toBe(true)
  })
})

describe('Le versement automatique — l’horloge qui l’a trahi', () => {
  it('un « depuis » NÉGATIF ne doit pas museler le versement', () => {
    // LE DÉFAUT, trouvé en revue. Le compteur du dernier versement vivait au
    // niveau du module et n'était jamais remis à zéro, alors que l'horloge
    // de tableau, elle, repart de 0 à chaque salle. Après un versement au
    // temps T, la visite suivante du hub calculait donc depuisDernier = −T
    // et se taisait pendant T secondes — la bannière d'alerte s'affichait au
    // hub, précisément ce que la mécanique promet d'éviter. La remise à zéro
    // vit désormais avec `run.tableauTime = 0` ; ce test garde la règle côté
    // décision : un « depuis » négatif n'est pas un repos.
    expect(doitVerserAuto(etat({ depuisDernier: -30, litres: 0.2 }))).toBe(true)
    expect(doitVerserAuto(etat({ depuisDernier: -0.1, litres: 0.2 }))).toBe(true)
  })
})

describe('Le versement automatique — ce qu’il ne fait pas', () => {
  it('ne se déclenche JAMAIS en descente : là, verser reste un geste', () => {
    expect(doitVerserAuto(etat({ auHub: false, litres: 0.1 }))).toBe(false)
  })

  it('ne verse pas dans un corps déjà plein', () => {
    expect(doitVerserAuto(etat({ litres: 3, litresPleins: 3 }))).toBe(false)
    // un corps plein SOUS le seuil n'existe pas, mais la garde tient quand même
    expect(doitVerserAuto(etat({ litres: 0.2, litresPleins: 0.2 }))).toBe(false)
  })

  it('se tait quand l’état l’empêche (glace, vapeur, pause)', () => {
    expect(doitVerserAuto(etat({ empeche: true, litres: 0.1 }))).toBe(false)
  })

  it('respire entre deux versements, au lieu de crépiter à chaque image', () => {
    // Un corps qui n'arrive pas à absorber relancerait le versement 60 fois
    // par seconde — et le son de collecte avec.
    expect(doitVerserAuto(etat({ depuisDernier: 0 }))).toBe(false)
    expect(doitVerserAuto(etat({ depuisDernier: REPOS_VERSEMENT_S - 0.01 }))).toBe(false)
    expect(doitVerserAuto(etat({ depuisDernier: REPOS_VERSEMENT_S }))).toBe(true)
  })
})
