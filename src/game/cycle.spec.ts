import { describe, expect, it } from 'vitest'
import { Records, type StorageLike } from './records'
import {
  ETATS_CYCLE,
  TRANSFOS_CYCLE,
  transfoAchetable,
  transfoCycle,
  transfoEntre,
  transfoTenue,
} from './cycle'

function memoryStorage(): StorageLike {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

describe('Le cycle des états — l’écran des mémoires', () => {
  it('le croquis est respecté : six transformations classiques, bons sens', () => {
    // chaque transformation du programme de physique relie les bons états
    expect(transfoCycle('fusion')).toMatchObject({
      de: 'solide',
      vers: 'liquide',
    })
    expect(transfoCycle('solidification')).toMatchObject({
      de: 'liquide',
      vers: 'solide',
    })
    expect(transfoCycle('vaporisation')).toMatchObject({
      de: 'liquide',
      vers: 'gaz',
    })
    expect(transfoCycle('liquefaction')).toMatchObject({
      de: 'gaz',
      vers: 'liquide',
    })
    expect(transfoCycle('sublimation')).toMatchObject({
      de: 'solide',
      vers: 'gaz',
    })
    expect(transfoCycle('condensation')).toMatchObject({
      de: 'gaz',
      vers: 'solide',
    })
    // le quatrième état n'est relié qu'au gaz, et voilé
    for (const t of TRANSFOS_CYCLE.filter(
      (x) => x.de === 'plasma' || x.vers === 'plasma',
    ))
      expect(t.etat).toBe('mystere')
    expect(ETATS_CYCLE.plasma.mystere).toBe(true)
  })

  it('au départ : seuls la fusion et la liquéfaction sont tenues — le retour au liquide, rien d’autre', () => {
    const rien: string[] = []
    expect(transfoTenue('fusion', rien)).toBe(true)
    expect(transfoTenue('liquefaction', rien)).toBe(true)
    for (const id of [
      'solidification',
      'vaporisation',
      'sublimation',
      'condensation',
    ])
      expect(transfoTenue(id, rien)).toBe(false)
    // autrement dit : depuis le liquide, AUCUN lien tenu ne part — pas de
    // bouton glace ni vapeur en début de partie
    const departs = TRANSFOS_CYCLE.filter(
      (t) => t.de === 'liquide' && transfoTenue(t.id, rien),
    )
    expect(departs).toHaveLength(0)
    // et depuis un état imposé (zone), le retour au liquide existe toujours
    expect(transfoEntre('solide', 'liquide')!.id).toBe('fusion')
    expect(transfoEntre('gaz', 'liquide')!.id).toBe('liquefaction')
  })

  it('les mystères ne se tissent jamais, les autres liens n’ont aucun prérequis', () => {
    const rien: string[] = []
    expect(transfoAchetable('ionisation', rien)).toBe(false)
    expect(transfoAchetable('deionisation', rien)).toBe(false)
    // la sublimation se tisse sans posséder ni solidification ni vaporisation
    expect(transfoAchetable('sublimation', rien)).toBe(true)
    // une transformation tissée n'est plus à tisser
    expect(transfoAchetable('sublimation', ['sublimation'])).toBe(false)
    // les acquises d'origine non plus (rien à payer, jamais)
    expect(transfoAchetable('fusion', rien)).toBe(false)
  })

  it('les verrous narratifs ferment même les liens offerts — et le payé résiste', () => {
    const rien: string[] = []
    const verrous = ['fusion', 'liquefaction']
    // l'acte 0 peut fermer le retour au liquide : ils redeviennent à tisser
    expect(transfoTenue('fusion', rien, verrous)).toBe(false)
    expect(transfoTenue('liquefaction', rien, verrous)).toBe(false)
    expect(transfoAchetable('fusion', rien, verrous)).toBe(true)
    expect(transfoCycle('fusion')!.cout).toBeGreaterThan(0) // un prix existe
    // ce qu'on a tissé de sa propre mémoire, aucun scénario ne le reprend
    expect(transfoTenue('fusion', ['fusion'], verrous)).toBe(true)
    expect(transfoAchetable('fusion', ['fusion'], verrous)).toBe(false)
    // un verrou sur un mystère ne le rend pas achetable pour autant
    expect(transfoAchetable('ionisation', rien, ['ionisation'])).toBe(false)
    // sans verrou, rien ne change : le cycle nominal
    expect(transfoTenue('fusion', rien)).toBe(true)
  })

  it('transfoEntre : les paires sans lien direct rendent null', () => {
    expect(transfoEntre('liquide', 'liquide')).toBeNull()
    expect(transfoEntre('solide', 'plasma')).toBeNull()
    expect(transfoEntre('liquide', 'plasma')).toBeNull()
  })

  it('le tissage est atomique et persiste (Records) : débit + lien gravé', () => {
    const st = memoryStorage()
    const r = new Records(st)
    r.gagneMemoire(12)
    const solidif = transfoCycle('solidification')!
    expect(r.acquiertEveil(solidif.id, solidif.cout)).toBe(true)
    expect(r.memoire()).toBe(2)
    // solde insuffisant : rien ne bouge
    const vapo = transfoCycle('vaporisation')!
    expect(r.acquiertEveil(vapo.id, vapo.cout)).toBe(false)
    expect(r.memoire()).toBe(2)
    // rechargé depuis le stockage : le lien tient toujours
    const r2 = new Records(st)
    expect(transfoTenue('solidification', r2.eveilAcquis())).toBe(true)
    expect(transfoTenue('vaporisation', r2.eveilAcquis())).toBe(false)
  })

  it('les verrous se posent, se lèvent et persistent dans les registres', () => {
    const st = memoryStorage()
    const r = new Records(st)
    expect(r.verrousCycle()).toEqual([])
    expect(r.basculeVerrouCycle('fusion')).toBe(true)
    expect(r.verrousCycle()).toEqual(['fusion'])
    // relu du stockage : le verrou tient, et la fusion n'est plus tenue
    const r2 = new Records(st)
    expect(transfoTenue('fusion', r2.eveilAcquis(), r2.verrousCycle())).toBe(
      false,
    )
    // on la rachète : elle redevient tenue malgré le verrou
    r2.gagneMemoire(50)
    expect(r2.acquiertEveil('fusion', transfoCycle('fusion')!.cout)).toBe(true)
    expect(transfoTenue('fusion', r2.eveilAcquis(), r2.verrousCycle())).toBe(
      true,
    )
    // et la levée du verrou est symétrique
    expect(r2.basculeVerrouCycle('fusion')).toBe(false)
    expect(r2.verrousCycle()).toEqual([])
  })

  it('migration de l’ancien arbre : les nœuds utilitaires sont remboursés, une seule fois', () => {
    const st = memoryStorage()
    st.setItem(
      'projet21.registres.v1',
      JSON.stringify({
        essais: 3,
        operator: 'REX',
        tableaux: {},
        expedition: null,
        history: [],
        memoire: 7,
        fioles: [],
        fiolesEquipees: [],
        eveil: ['volume', 'souffle', 'peage-1'],
      }),
    )
    const r = new Records(st)
    // volume 20 + souffle 40 + peage-1 35 remboursés sur les 7 restants
    expect(r.memoire()).toBe(7 + 20 + 40 + 35)
    expect(r.eveilAcquis()).toEqual([])
    // la migration s'est réécrite : une relecture ne rembourse pas deux fois
    const r2 = new Records(st)
    expect(r2.memoire()).toBe(102)
  })
})
