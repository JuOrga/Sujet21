import { describe, expect, it } from 'vitest'
import {
  CREUX_MINI,
  DOSE_AUTO,
  REPOS_VERSEMENT_S,
  SEUIL_RENFLOUEMENT,
  GAIN_UTILE,
  SEUIL_INVITE,
  bonbonneIllimitee,
  doitSecourir,
  doitVerserAuto,
  doseVersementAuto,
  gainVersement,
  inviteBonbonne,
  renflouementEngage,
  segmentsJauge,
  type EtatDescente,
  type EtatVersement,
} from './bonbonne'
import { DEFAULT_PARAMS } from '../sim/params'

const BASE: EtatVersement = {
  auHub: true,
  litres: 0.7,
  litresPleins: 3,
  empeche: false,
  depuisDernier: 10,
  renflouement: false,
}

const etat = (o: Partial<EtatVersement> = {}): EtatVersement => ({ ...BASE, ...o })

describe('La bonbonne au hub — la réserve ne s’y compte pas', () => {
  it('est illimitée au hub, comptée partout ailleurs', () => {
    expect(bonbonneIllimitee(true)).toBe(true)
    expect(bonbonneIllimitee(false)).toBe(false)
  })
})

describe('Le versement automatique — on entretient, on ne réanime pas', () => {
  // LE DÉFAUT RAPPORTÉ, et il tenait dans le seuil. Le versement attendait
  // 0,75 L — 17 % d'un corps plein de 4,50 L — puis rendait les 750
  // particules manquantes EN UNE IMAGE : le volume multiplié par six, et
  // le recul d'une éjection (qui se répartit sur tout le corps) divisé par
  // six dans le même instant. « Le volume regonfle d'un coup, et il perd
  // toute propulsion. » Les tests ci-dessous gravent la règle inverse.

  it('s’amorce à 30 % du plein, pas avant', () => {
    const plein = 4.5
    expect(doitVerserAuto(etat({ litres: plein * 0.31, litresPleins: plein }))).toBe(false)
    expect(doitVerserAuto(etat({ litres: plein * 0.29, litresPleins: plein }))).toBe(true)
    expect(SEUIL_RENFLOUEMENT).toBe(0.3)
  })

  it('UNE FOIS AMORCÉ, remonte jusqu’au PLEIN — l’hystérésis', () => {
    // sans elle, la première dose repasserait les 30 % et le versement
    // s'arrêterait là : le corps vivrait collé à son seuil, à un souffle de
    // l'alerte. Engagé, il continue tant que le plein n'est pas rejoint.
    const plein = 4.5
    const engage = etat({ litres: plein * 0.5, litresPleins: plein, renflouement: true })
    expect(doitVerserAuto(engage)).toBe(true)
    // le même volume, renflouement NON engagé : on ne verse pas
    expect(doitVerserAuto({ ...engage, renflouement: false })).toBe(false)
    // et le drapeau se relâche au plein, pas avant
    expect(renflouementEngage(engage)).toBe(true)
    expect(renflouementEngage({ ...engage, litres: plein })).toBe(false)
  })

  it('un état empêché ne relâche PAS le renflouement en cours', () => {
    // passer en glace au milieu d'un renflouement ne doit pas l'annuler :
    // on reprend où l'on en était.
    const plein = 4.5
    const gele = etat({ litres: plein * 0.5, litresPleins: plein, renflouement: true, empeche: true })
    expect(doitVerserAuto(gele)).toBe(false) // on ne verse pas maintenant
    expect(renflouementEngage(gele)).toBe(true) // mais on reste engagé
  })

  it('ne verse pas pour un creux négligeable', () => {
    const plein = 3
    expect(
      doitVerserAuto(etat({
        litres: plein * (1 - CREUX_MINI / 2),
        litresPleins: plein,
        renflouement: true,
      })),
    ).toBe(false)
    expect(doitVerserAuto(etat({ litres: plein, litresPleins: plein }))).toBe(false)
  })

  it('NE REND JAMAIS PLUS D’UNE DOSE — le test qui tombe sans le correctif', () => {
    // c'est LE contrat : quel que soit le creux, même un corps à l'agonie,
    // un versement automatique ne rend qu'une fraction du volume de départ.
    const plein = 4.5 // 900 particules à 0,005 L
    for (const litres of [0, 0.1, 0.75, 2, 4]) {
      const dose = doseVersementAuto(litres, plein)
      expect(dose, `${litres} L`).toBeLessThanOrEqual(plein * DOSE_AUTO + 1e-9)
      expect(dose).toBeGreaterThanOrEqual(0)
    }
    // à 0,75 L — le seuil de l'ancienne règle — l'ancien versement rendait
    // 3,75 L d'un coup ; la dose en rend 0,36
    expect(doseVersementAuto(0.75, plein)).toBeCloseTo(plein * DOSE_AUTO, 6)
    expect(plein - 0.75).toBeGreaterThan(doseVersementAuto(0.75, plein) * 9)
  })

  it('ne verse jamais au-delà du plein', () => {
    expect(doseVersementAuto(2.9, 3)).toBeCloseTo(0.1, 6)
    expect(doseVersementAuto(3, 3)).toBe(0)
    expect(doseVersementAuto(3.5, 3)).toBe(0)
  })

  it('la bannière d’alerte reste hors d’atteinte au hub', () => {
    // LE CONTRAT D'ORIGINE, conservé mais servi autrement : « la dernière
    // impulsion approche » ne doit jamais paraître au hub. L'ancienne règle
    // l'obtenait en renflouant JUSTE avant l'alerte ; la nouvelle l'obtient
    // en n'y descendant jamais — tout volume sous le plein réclame déjà une
    // dose, bien au-dessus du seuil d'alerte.
    const plein = 4.5
    // l'alerte se lève à 0,6 L, soit 13 % de 4,50 L — bien SOUS le seuil
    // d'amorçage : tout volume qui l'atteindrait a déjà déclenché le
    // renflouement en descendant.
    expect(DEFAULT_PARAMS.lastCallLiters).toBeLessThan(plein * SEUIL_RENFLOUEMENT)
    for (let l = 0; l <= DEFAULT_PARAMS.lastCallLiters; l += 0.05)
      expect(doitVerserAuto(etat({ litres: l, litresPleins: plein })), `${l} L`).toBe(true)
  })

  it('la dose suit une poussée soutenue', () => {
    // une poussée dépense environ 3,5 % du corps par seconde (ejectRate 32
    // sur 900 particules) ; une dose par repos doit faire au moins autant,
    // sinon le corps s'assèche quand même et le défaut revient par la porte
    const parSeconde = DEFAULT_PARAMS.ejectRate * DEFAULT_PARAMS.litersPerParticle
    const plein = 4.5
    const doseParSeconde = (plein * DOSE_AUTO) / REPOS_VERSEMENT_S
    expect(doseParSeconde).toBeGreaterThan(parSeconde)
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

// ---- EN DESCENTE : L'INVITE, PUIS LE SECOURS ---------------------------
// LE DÉFAUT RAPPORTÉ : « on ne l'utilise jamais, et très peu indiqué ». Le
// geste existait, rien ne le proposait. Ces essais tiennent les trois
// marches — offerte, pressante, secours — aux volumes RÉELS du jeu.
const P = DEFAULT_PARAMS
const DESCENTE: EtatDescente = {
  actif: true,
  litres: 4.5,
  litresPleins: 4.5,
  reserveL: 2,
  litreParticule: P.litersPerParticle,
  alerteL: P.lastCallLiters,
  critiqueL: P.criticalVolumeLiters,
  liquide: true,
}
const descente = (o: Partial<EtatDescente> = {}): EtatDescente => ({ ...DESCENTE, ...o })

describe('Le gain du versement — le chiffre que l’invite annonce', () => {
  it('rend le creux du corps quand la réserve le couvre', () => {
    expect(gainVersement(descente({ litres: 3.5 }))).toBeCloseTo(1, 6)
  })
  it('est borné à la réserve quand le creux la dépasse', () => {
    expect(gainVersement(descente({ litres: 1, reserveL: 0.8 }))).toBeCloseTo(0.8, 6)
  })
  it('compte en gouttes ENTIÈRES : un fond de bonbonne sous la goutte ne rend rien', () => {
    expect(gainVersement(descente({ litres: 1, reserveL: P.litersPerParticle * 0.9 }))).toBe(0)
    // 0,8 / 0,005 vaut 159,99… en flottant : la goutte ne doit pas se perdre
    const g = gainVersement(descente({ litres: 1, reserveL: 0.8 }))
    expect(Math.round(g / P.litersPerParticle)).toBe(160)
  })
  it('ne rend rien à un corps plein, ni d’une bonbonne vide', () => {
    expect(gainVersement(descente())).toBe(0)
    expect(gainVersement(descente({ litres: 1, reserveL: 0 }))).toBe(0)
  })
})

describe('L’invite — le geste est proposé quand il sert', () => {
  it('se tait tant que le corps garde plus de la moitié de son volume', () => {
    expect(inviteBonbonne(descente({ litres: 4.5 * SEUIL_INVITE + 0.1 }))).toBe('aucune')
  })
  it('est OFFERTE sous la moitié du volume de départ', () => {
    expect(inviteBonbonne(descente({ litres: 4.5 * SEUIL_INVITE - 0.1 }))).toBe('offerte')
  })
  it('est PRESSANTE dès le volume d’alerte', () => {
    expect(inviteBonbonne(descente({ litres: P.lastCallLiters }))).toBe('pressante')
  })
  it('se tait sans réserve : on n’invite pas à un geste qui ne rendrait rien', () => {
    expect(inviteBonbonne(descente({ litres: 0.4, reserveL: 0 }))).toBe('aucune')
  })
  it('ne s’offre pas pour un fond de bonbonne — mais presse quand même à l’alerte', () => {
    const fond = 4.5 * GAIN_UTILE * 0.5
    expect(inviteBonbonne(descente({ litres: 2, reserveL: fond }))).toBe('aucune')
    expect(inviteBonbonne(descente({ litres: 0.5, reserveL: fond }))).toBe('pressante')
  })
  it('hors liquide : pas offerte (le geste serait refusé), mais pressante à l’alerte', () => {
    expect(inviteBonbonne(descente({ litres: 2, liquide: false }))).toBe('aucune')
    expect(inviteBonbonne(descente({ litres: 0.5, liquide: false }))).toBe('pressante')
  })
  it('se tait hors d’une salle de run', () => {
    expect(inviteBonbonne(descente({ litres: 0.4, actif: false }))).toBe('aucune')
  })
})

describe('Le secours — on ne meurt plus à sec une réserve au dos', () => {
  it('ne part pas au-dessus du seuil critique : jusque-là, c’est un geste', () => {
    expect(doitSecourir(descente({ litres: P.criticalVolumeLiters + 0.05 }))).toBe(false)
  })
  it('part au seuil critique, réserve disponible', () => {
    expect(doitSecourir(descente({ litres: P.criticalVolumeLiters }))).toBe(true)
  })
  it('ne part pas d’une bonbonne vide', () => {
    expect(doitSecourir(descente({ litres: 0.2, reserveL: 0 }))).toBe(false)
  })
  it('attend le liquide : la glace n’absorbe pas, le nuage disperserait', () => {
    expect(doitSecourir(descente({ litres: 0.2, liquide: false }))).toBe(false)
  })
  it('ne part pas hors d’une salle de run (hub, essai, sas qui boit…)', () => {
    expect(doitSecourir(descente({ litres: 0.2, actif: false }))).toBe(false)
  })
  it('le seuil du secours est SOUS celui de l’invite pressante : on est prévenu avant d’être sauvé', () => {
    expect(P.criticalVolumeLiters).toBeLessThan(P.lastCallLiters)
    const entre = (P.criticalVolumeLiters + P.lastCallLiters) / 2
    expect(inviteBonbonne(descente({ litres: entre }))).toBe('pressante')
    expect(doitSecourir(descente({ litres: entre }))).toBe(false)
  })
})

describe('La jauge en deux segments — ce que le geste rendrait se voit', () => {
  it('pose la réserve à la suite du corps', () => {
    const s = segmentsJauge(1.5, 4.5, 1)
    expect(s.corps).toBeCloseTo(1 / 3, 6)
    expect(s.reserve).toBeCloseTo(1 / 4.5, 6)
  })
  it('ne dépasse jamais le plein', () => {
    const s = segmentsJauge(4, 4.5, 3)
    expect(s.corps + s.reserve).toBeLessThanOrEqual(1 + 1e-9)
  })
  it('un corps au-dessus du départ (prime) ne laisse aucune place à la réserve', () => {
    expect(segmentsJauge(5, 4.5, 1)).toEqual({ corps: 1, reserve: 0 })
  })
  it('sans volume de départ, rien à dessiner', () => {
    expect(segmentsJauge(1, 0, 1)).toEqual({ corps: 0, reserve: 0 })
  })
})
