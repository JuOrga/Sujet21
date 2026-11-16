import { describe, expect, it } from 'vitest'
import {
  avancerRecepteurs,
  canalActif,
  cibleActive,
  CIBLE_PERSISTANCE,
  creerEtatRecepteurs,
  etatPorte,
} from './laser'
import type { CibleMode } from './level'

// LES FONCTIONS LOGIQUES (25/10) : les récepteurs qui vont et viennent,
// le OU exclusif, et la porte ouverte au repos — ce qu'il manquait au
// concepteur pour écrire des énigmes.

const P = CIBLE_PERSISTANCE
const une = (mode: CibleMode) => [{ mode }]

describe('le récepteur MAINTIEN — le bouton-poussoir', () => {
  it('actif sous le faisceau, éteint dès qu’il part, rallumable sans fin', () => {
    const cibles = une('maintien')
    const etat = creerEtatRecepteurs(1)
    expect(cibleActive(cibles[0], etat, 0, 0)).toBe(false)
    avancerRecepteurs(cibles, [0], etat, 1)
    expect(cibleActive(cibles[0], etat, 0, 1)).toBe(true)
    // le faisceau part : éteint après la persistance — et jamais grillé
    avancerRecepteurs(cibles, [], etat, 1 + P + 0.05)
    expect(cibleActive(cibles[0], etat, 0, 1 + P + 0.05)).toBe(false)
    expect(etat.scellees[0]).toBe(false)
    // il revient : rallumé
    avancerRecepteurs(cibles, [0], etat, 3)
    expect(cibleActive(cibles[0], etat, 0, 3)).toBe(true)
  })

  it('une micro-coupure sous la persistance ne l’éteint pas', () => {
    const cibles = une('maintien')
    const etat = creerEtatRecepteurs(1)
    avancerRecepteurs(cibles, [0], etat, 1)
    expect(cibleActive(cibles[0], etat, 0, 1 + P * 0.5)).toBe(true)
  })
})

describe('le récepteur BASCULE — l’interrupteur', () => {
  it('chaque NOUVEAU passage inverse son état ; un faisceau qui tient ne compte qu’une fois', () => {
    const cibles = une('bascule')
    const etat = creerEtatRecepteurs(1)
    expect(cibleActive(cibles[0], etat, 0, 0)).toBe(false) // éteinte au départ
    avancerRecepteurs(cibles, [0], etat, 1)
    expect(cibleActive(cibles[0], etat, 0, 1)).toBe(true)
    // le faisceau TIENT, image après image : rien ne bascule
    // (vérifié À CHAQUE IMAGE : sur un nombre pair d'images, une bascule
    // qui battrait à chaque photon retomberait sur son état par hasard)
    for (let t = 1.016; t < 2; t += 0.016) {
      avancerRecepteurs(cibles, [0], etat, t)
      expect(cibleActive(cibles[0], etat, 0, t)).toBe(true)
    }
    // il part (l'état reste), puis revient : elle s'éteint
    avancerRecepteurs(cibles, [], etat, 2 + P + 0.05)
    expect(cibleActive(cibles[0], etat, 0, 2 + P + 0.05)).toBe(true)
    avancerRecepteurs(cibles, [0], etat, 3)
    expect(cibleActive(cibles[0], etat, 0, 3)).toBe(false)
    // et encore : rallumée
    avancerRecepteurs(cibles, [0], etat, 4)
    expect(cibleActive(cibles[0], etat, 0, 4)).toBe(true)
  })

  it('deux faisceaux sur la même pastille dans la même image : un seul basculement', () => {
    const cibles = une('bascule')
    const etat = creerEtatRecepteurs(1)
    avancerRecepteurs(cibles, [0, 0], etat, 1)
    expect(cibleActive(cibles[0], etat, 0, 1)).toBe(true)
  })

  it('un scintillement sous la persistance ne rebascule pas', () => {
    const cibles = une('bascule')
    const etat = creerEtatRecepteurs(1)
    avancerRecepteurs(cibles, [0], etat, 1)
    avancerRecepteurs(cibles, [0], etat, 1 + P * 0.5) // revenu avant la persistance
    expect(cibleActive(cibles[0], etat, 0, 1 + P * 0.5)).toBe(true)
  })
})

describe('le OU EXCLUSIF — une seule source, pas plus', () => {
  it('aucune : fermé ; une : ouvert ; deux : fermé', () => {
    const cibles = [{ canal: 1, mode: 'maintien' as const }, { canal: 1, mode: 'maintien' as const }]
    const etat = creerEtatRecepteurs(2)
    expect(canalActif(cibles, 1, 'ouex', etat, 0)).toBe(false)
    avancerRecepteurs(cibles, [0], etat, 1)
    expect(canalActif(cibles, 1, 'ouex', etat, 1)).toBe(true)
    avancerRecepteurs(cibles, [0, 1], etat, 1.05)
    expect(canalActif(cibles, 1, 'ouex', etat, 1.05)).toBe(false)
  })

  it('une coupelle compte comme une source du canal', () => {
    const etat = creerEtatRecepteurs(0)
    expect(canalActif([], 3, 'ouex', etat, 0, [{ canal: 3, active: true }])).toBe(true)
    expect(canalActif([], 3, 'ouex', etat, 0, [{ canal: 3, active: true }, { canal: 3, active: true }])).toBe(false)
  })
})

describe('la porte OUVERTE AU REPOS — le NON', () => {
  it('fermée au repos : alimentée, elle s’ouvre ; ouverte au repos : alimentée, elle se ferme', () => {
    expect(etatPorte({}, false)).toBe(false)
    expect(etatPorte({}, true)).toBe(true)
    expect(etatPorte({ repos: 'ouverte' }, false)).toBe(true)
    expect(etatPorte({ repos: 'ouverte' }, true)).toBe(false)
  })

  it('les portes logiques s’écrivent : NON-ET, NON-OU, et le contraire du OU exclusif', () => {
    const cibles = [{ canal: 1, mode: 'maintien' as const }, { canal: 1, mode: 'maintien' as const }]
    const table = (regle: 'et' | 'ouex' | undefined, repos?: 'ouverte'): boolean[] =>
      [[], [0], [1], [0, 1]].map((allumees) => {
        const etat = creerEtatRecepteurs(2)
        avancerRecepteurs(cibles, allumees, etat, 1)
        return etatPorte({ repos }, canalActif(cibles, 1, regle, etat, 1))
      })
    //                                   00     10     01     11
    expect(table(undefined)).toEqual([false, true, true, true]) // OU
    expect(table('et')).toEqual([false, false, false, true]) // ET
    expect(table('ouex')).toEqual([false, true, true, false]) // OU exclusif
    expect(table(undefined, 'ouverte')).toEqual([true, false, false, false]) // NON-OU
    expect(table('et', 'ouverte')).toEqual([true, true, true, false]) // NON-ET
    expect(table('ouex', 'ouverte')).toEqual([true, false, false, true]) // équivalence
  })
})

// LA FONCTION MÉMOIRE (16/11) : marche / arrêt. Deux entrées distinctes —
// la MÉMOIRE s'écrit, l'EFFACE du même canal la reprend.
describe('la fonction MÉMOIRE — une pastille écrit, une autre efface', () => {
  const montage = () => {
    const cibles = [
      { canal: 1, mode: 'memoire' as const },
      { canal: 1, mode: 'efface' as const },
    ]
    return { cibles, etat: creerEtatRecepteurs(2) }
  }

  it('écrite d’un passage, elle tient sans faisceau ; l’EFFACE la remet à 0 ; elle se réécrit', () => {
    const { cibles, etat } = montage()
    expect(canalActif(cibles, 1, undefined, etat, 0)).toBe(false)
    avancerRecepteurs(cibles, [0], etat, 1)
    expect(cibleActive(cibles[0], etat, 0, 1)).toBe(true)
    // le faisceau part : le bit reste (c'est ce qui la distingue du MAINTIEN)
    avancerRecepteurs(cibles, [], etat, 5)
    expect(canalActif(cibles, 1, undefined, etat, 5)).toBe(true)
    // l'effacement
    avancerRecepteurs(cibles, [1], etat, 6)
    expect(canalActif(cibles, 1, undefined, etat, 6)).toBe(false)
    // et il reste effacé une fois le faisceau d'effacement parti
    avancerRecepteurs(cibles, [], etat, 8)
    expect(canalActif(cibles, 1, undefined, etat, 8)).toBe(false)
    // réécriture : la mémoire sert autant de fois qu'on veut
    avancerRecepteurs(cibles, [0], etat, 9)
    expect(canalActif(cibles, 1, undefined, etat, 9)).toBe(true)
  })

  it('l’effacement est PRIORITAIRE : les deux éclairées donnent 0, dans un ordre comme dans l’autre', () => {
    for (const touchees of [[0, 1], [1, 0]]) {
      const { cibles, etat } = montage()
      avancerRecepteurs(cibles, touchees, etat, 1)
      expect(cibleActive(cibles[0], etat, 0, 1)).toBe(false)
    }
  })

  it('l’EFFACE lâchée, une MÉMOIRE encore sous son faisceau se réécrit', () => {
    const { cibles, etat } = montage()
    avancerRecepteurs(cibles, [0, 1], etat, 1)
    expect(cibleActive(cibles[0], etat, 0, 1)).toBe(false)
    // l'effacement tient encore pendant sa persistance
    avancerRecepteurs(cibles, [0], etat, 1 + P * 0.5)
    expect(cibleActive(cibles[0], etat, 0, 1 + P * 0.5)).toBe(false)
    // passé la persistance, l'écriture reprend
    avancerRecepteurs(cibles, [0], etat, 1 + P + 0.05)
    expect(cibleActive(cibles[0], etat, 0, 1 + P + 0.05)).toBe(true)
  })

  it('l’EFFACE ne reprend que les MÉMOIRES de SON canal — ni les autres canaux, ni TOR, ni BASCULE', () => {
    const cibles = [
      { canal: 1, mode: 'memoire' as const },
      { canal: 2, mode: 'memoire' as const },
      { canal: 1 }, // TOR
      { canal: 1, mode: 'bascule' as const },
      { canal: 1, mode: 'efface' as const },
    ]
    const etat = creerEtatRecepteurs(5)
    avancerRecepteurs(cibles, [0, 1, 2, 3], etat, 1)
    avancerRecepteurs(cibles, [4], etat, 2)
    expect(cibles.map((t, c) => cibleActive(t, etat, c, 2))).toEqual([false, true, true, true, false])
  })

  it('l’EFFACE n’est pas une source : elle n’alimente rien et ne bloque pas le ET', () => {
    const cibles = [
      { canal: 1, mode: 'memoire' as const },
      { canal: 1, mode: 'memoire' as const },
      { canal: 1, mode: 'efface' as const },
    ]
    const etat = creerEtatRecepteurs(3)
    // seule sur son faisceau, elle n'ouvre rien
    avancerRecepteurs(cibles, [2], etat, 1)
    expect(canalActif(cibles, 1, undefined, etat, 1)).toBe(false)
    // le digicode : deux bits à écrire, la porte ET les veut tous les deux
    avancerRecepteurs(cibles, [0], etat, 2)
    expect(canalActif(cibles, 1, 'et', etat, 2)).toBe(false)
    avancerRecepteurs(cibles, [1], etat, 3)
    expect(canalActif(cibles, 1, 'et', etat, 3)).toBe(true)
    // une seule remise à zéro reprend les deux bits
    avancerRecepteurs(cibles, [2], etat, 4)
    expect(canalActif(cibles, 1, 'et', etat, 4)).toBe(false)
    expect(canalActif(cibles, 1, undefined, etat, 4)).toBe(false)
  })

  it('avec une porte ouverte au repos : écrire la FERME, effacer la ROUVRE', () => {
    const { cibles, etat } = montage()
    const porte = { repos: 'ouverte' as const }
    expect(etatPorte(porte, canalActif(cibles, 1, undefined, etat, 0))).toBe(true)
    avancerRecepteurs(cibles, [0], etat, 1)
    expect(etatPorte(porte, canalActif(cibles, 1, undefined, etat, 1))).toBe(false)
    avancerRecepteurs(cibles, [1], etat, 2)
    expect(etatPorte(porte, canalActif(cibles, 1, undefined, etat, 2))).toBe(true)
  })
})
