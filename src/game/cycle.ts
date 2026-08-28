// LE CYCLE DES ÉTATS : l'écran des mémoires. Le schéma du concepteur
// (croquis du 28/08) remplace l'arbre : QUATRE états — solide, liquide,
// gaz, et une entité mystère (le plasma) — et les TRANSFORMATIONS entre
// eux, qui sont les liens à tisser. Chaque transformation MANUELLE (au
// bouton) doit être une mémoire tissée ; les régimes du décor (zones
// forcées, chaudière, froid) transforment toujours, eux — c'est même le
// sens du départ : on commence liquide avec seulement FUSION et
// LIQUÉFACTION, juste de quoi REDEVENIR liquide après une zone imposée.
//
// Statuts d'un lien :
//   · acquis d'origine — fusion et liquéfaction : le retour au liquide
//     n'est pas un achat… TANT QUE le scénario ne les VERROUILLE pas ;
//   · à tisser — un coût en mémoire, l'achat se fait à l'écran des
//     mémoires (aucun prérequis : chaque lien est sa propre mémoire) ;
//   · mystère — les liens du quatrième état : montrés voilés (« ??? »),
//     rien à acheter tant que le chantier moteur n'existe pas.
//
// LES VERROUS NARRATIFS : le déblocage progressif de l'acte 0 peut fermer
// N'IMPORTE QUEL lien, les deux offerts compris — le Sujet sort de cuve
// sans rien savoir, et réapprend jusqu'à revenir liquide. Un lien verrouillé
// se tisse alors comme les autres, à son prix (d'où un coût sur fusion et
// liquéfaction : il ne sert QUE dans ce cas). Un lien explicitement acquis
// l'emporte toujours sur son verrou : ce qu'on a payé, on le garde.

/** Les états que le corps peut prendre. Le plasma est annoncé, pas joué. */
export type EtatCycle = 'solide' | 'liquide' | 'gaz' | 'plasma'

export interface FicheEtat {
  nom: string
  icone: string
  couleur: string // la teinte de l'état, partagée écran des mémoires / HUD
  mystere?: boolean
}

export const ETATS_CYCLE: Record<EtatCycle, FicheEtat> = {
  solide: { nom: 'SOLIDE', icone: '❄', couleur: '#a7ddf5' },
  liquide: { nom: 'LIQUIDE', icone: '💧', couleur: '#63b7e6' },
  gaz: { nom: 'GAZ', icone: '💨', couleur: '#f2c98e' },
  plasma: { nom: '???', icone: '?', couleur: '#c99aff', mystere: true },
}

export interface TransfoCycle {
  id: string
  de: EtatCycle
  vers: EtatCycle
  nom: string
  desc: string
  cout: number // en mémoire (0 : acquis d'origine)
  etat?: 'acquis-depart' | 'mystere'
}

// L'ordre suit le croquis : les liens courts autour du liquide d'abord,
// puis les arcs extérieurs, puis le voile du quatrième état.
export const TRANSFOS_CYCLE: TransfoCycle[] = [
  {
    id: 'fusion',
    de: 'solide',
    vers: 'liquide',
    nom: 'FUSION',
    desc: 'la glace redevient liquide — offert, sauf verrou du scénario',
    cout: 5,
    etat: 'acquis-depart',
  },
  {
    id: 'liquefaction',
    de: 'gaz',
    vers: 'liquide',
    nom: 'LIQUÉFACTION',
    desc: 'la vapeur se recondense en liquide — offerte, sauf verrou du scénario',
    cout: 5,
    etat: 'acquis-depart',
  },
  {
    id: 'solidification',
    de: 'liquide',
    vers: 'solide',
    nom: 'SOLIDIFICATION',
    desc: 'se changer en GLACE au bouton : le bloc garde son élan',
    cout: 10,
  },
  {
    id: 'vaporisation',
    de: 'liquide',
    vers: 'gaz',
    nom: 'VAPORISATION',
    desc: 'se changer en VAPEUR au bouton : passer les évents, viser, dasher',
    cout: 15,
  },
  {
    id: 'sublimation',
    de: 'solide',
    vers: 'gaz',
    nom: 'SUBLIMATION',
    desc: 'glace → vapeur d’un souffle, sans repasser par le liquide',
    cout: 60,
  },
  {
    id: 'condensation',
    de: 'gaz',
    vers: 'solide',
    nom: 'CONDENSATION',
    desc: 'vapeur → glace d’un claquement, sans repasser par le liquide',
    cout: 60,
  },
  {
    id: 'ionisation',
    de: 'gaz',
    vers: 'plasma',
    nom: '???',
    desc: 'le lien se devine, la mémoire ne se tisse pas encore',
    cout: 0,
    etat: 'mystere',
  },
  {
    id: 'deionisation',
    de: 'plasma',
    vers: 'gaz',
    nom: '???',
    desc: 'le chemin du retour, voilé lui aussi',
    cout: 0,
    etat: 'mystere',
  },
]

export function transfoCycle(id: string): TransfoCycle | null {
  return TRANSFOS_CYCLE.find((t) => t.id === id) ?? null
}

/** Le lien qui mène d'un état à un autre (null : aucun lien direct —
 * liquide → liquide, ou solide → plasma par exemple). */
export function transfoEntre(
  de: EtatCycle,
  vers: EtatCycle,
): TransfoCycle | null {
  return TRANSFOS_CYCLE.find((t) => t.de === de && t.vers === vers) ?? null
}

/** Un lien est-il TENU (tissé, ou offert d'origine) ? Un mystère, jamais ;
 * un lien sous VERROU narratif non plus — sauf s'il a été payé, car ce
 * qu'on a tissé de sa propre mémoire, aucun scénario ne le reprend. */
export function transfoTenue(
  id: string,
  acquis: readonly string[],
  verrous: readonly string[] = [],
): boolean {
  const t = transfoCycle(id)
  if (!t || t.etat === 'mystere') return false
  if (acquis.includes(id)) return true
  if (verrous.includes(id)) return false
  return t.etat === 'acquis-depart'
}

/** Un lien est-il À TISSER : ni tenu, ni mystère ? (Aucun prérequis :
 * chaque transformation est sa propre mémoire.) */
export function transfoAchetable(
  id: string,
  acquis: readonly string[],
  verrous: readonly string[] = [],
): boolean {
  const t = transfoCycle(id)
  if (!t || t.etat === 'mystere') return false
  return !transfoTenue(id, acquis, verrous)
}
