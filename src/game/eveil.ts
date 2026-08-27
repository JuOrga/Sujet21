// L'ARBRE DE L'ÉVEIL : la conscience du Sujet, payée en MÉMOIRE — la
// monnaie qui survit à la purge. Les branches suivent le schéma des états
// de la matière (le document du concepteur) : chaque TRANSITION est un
// pouvoir, chaque ÉTAT une branche.
//
//   liquide (l'origine) → solidification (la glace) → vaporisation (la
//   vapeur) → les transitions directes (sublimation, condensation) → le
//   plasma (le quatrième état).
//
// Trois statuts de nœud :
//   · achetable — coût en mémoire, prérequis éventuels ;
//   · pré-acquis — les pouvoirs d'état (glace, vapeur) sont à toi
//     D'ORIGINE tant que la carte ISS n'a pas re-séquencé les tableaux :
//     le déblocage PROGRESSIF (glace après quelques niveaux, puis vapeur)
//     s'activera avec la re-parcellisation — l'arbre est prêt ;
//   · à venir — sublimation, condensation, plasma : annoncés, verrouillés,
//     leurs chantiers moteur arrivent.

export type BrancheEveil =
  | 'liquide'
  | 'solidification'
  | 'vaporisation'
  | 'transitions'
  | 'plasma'

export interface NoeudEveil {
  id: string
  branche: BrancheEveil
  nom: string
  desc: string
  icone: string
  cout: number // en mémoire (0 : pré-acquis)
  prereq?: string[]
  etat?: 'pre-acquis' | 'a-venir'
}

export const BRANCHES_EVEIL: Record<BrancheEveil, string> = {
  liquide: 'LIQUIDE — l’origine',
  solidification: 'SOLIDIFICATION — la glace',
  vaporisation: 'VAPORISATION — la vapeur',
  transitions: 'TRANSITIONS DIRECTES',
  plasma: 'PLASMA — le quatrième état',
}

export const NOEUDS_EVEIL: NoeudEveil[] = [
  // ——— LIQUIDE : l'origine ————————————————————————————————————————
  {
    id: 'volume',
    branche: 'liquide',
    nom: 'LE CORPS AMPLE',
    desc: 'le corps naît avec 40 gouttes de plus, à chaque tableau',
    icone: '💧',
    cout: 20,
  },
  {
    id: 'bourse',
    branche: 'liquide',
    nom: 'LA MATIÈRE RETENUE',
    desc: 'les pastilles de condensat rendent 25 % de plus',
    icone: '🫙',
    cout: 25,
  },
  {
    id: 'coque',
    branche: 'liquide',
    nom: 'L’ÉCHANTILLON PRUDENT',
    desc: 'chaque run commence avec un échantillon de secours de plus',
    icone: '💠',
    cout: 45,
  },
  // ——— SOLIDIFICATION ————————————————————————————————————————————
  {
    id: 'solidification',
    branche: 'solidification',
    nom: 'SOLIDIFICATION',
    desc: 'le pouvoir de GLACE — acquis d’origine ; son déblocage progressif s’activera avec la carte ISS',
    icone: '❄',
    cout: 0,
    etat: 'pre-acquis',
  },
  // ——— VAPORISATION ——————————————————————————————————————————————
  {
    id: 'vaporisation',
    branche: 'vaporisation',
    nom: 'VAPORISATION',
    desc: 'le pouvoir de VAPEUR — acquis d’origine ; son déblocage progressif s’activera avec la carte ISS',
    icone: '🌫',
    cout: 0,
    etat: 'pre-acquis',
  },
  {
    id: 'souffle',
    branche: 'vaporisation',
    nom: 'LE SOUFFLE LONG',
    desc: 'la réserve d’impulsions gagne un dash, à chaque tableau',
    icone: '💨',
    cout: 40,
    prereq: ['vaporisation'],
  },
  {
    id: 'peage-1',
    branche: 'vaporisation',
    nom: 'LA BASCULE ÉCONOME',
    desc: 'le péage de vaporisation passe de 20 % à 17 % du volume',
    icone: '⚖',
    cout: 35,
    prereq: ['vaporisation'],
  },
  {
    id: 'peage-2',
    branche: 'vaporisation',
    nom: 'LA BASCULE MAÎTRISÉE',
    desc: 'le péage de vaporisation passe de 17 % à 15 % du volume',
    icone: '⚖',
    cout: 70,
    prereq: ['peage-1'],
  },
  // ——— TRANSITIONS DIRECTES : annoncées, à venir ——————————————————
  {
    id: 'sublimation',
    branche: 'transitions',
    nom: 'SUBLIMATION',
    desc: 'glace → vapeur d’un souffle, sans repasser par l’eau — chantier à venir',
    icone: '✨',
    cout: 120,
    prereq: ['solidification', 'vaporisation'],
    etat: 'a-venir',
  },
  {
    id: 'condensation',
    branche: 'transitions',
    nom: 'CONDENSATION',
    desc: 'vapeur → glace d’un claquement — chantier à venir',
    icone: '🜄',
    cout: 120,
    prereq: ['solidification', 'vaporisation'],
    etat: 'a-venir',
  },
  // ——— PLASMA ————————————————————————————————————————————————————
  {
    id: 'ionisation',
    branche: 'plasma',
    nom: 'IONISATION',
    desc: 'le QUATRIÈME état : le corps alimente les pastilles au contact et brûle son volume — chantier moteur à venir',
    icone: '⚡',
    cout: 200,
    prereq: ['sublimation', 'condensation'],
    etat: 'a-venir',
  },
]

export function noeudEveil(id: string): NoeudEveil | null {
  return NOEUDS_EVEIL.find((n) => n.id === id) ?? null
}

/** Un nœud est-il TENU (acheté, ou pré-acquis) ? */
export function noeudTenu(id: string, acquis: readonly string[]): boolean {
  const n = noeudEveil(id)
  if (!n) return false
  return n.etat === 'pre-acquis' || acquis.includes(id)
}

/** Un nœud est-il ACHETABLE : ni tenu, ni à venir, prérequis tenus ? */
export function noeudAchetable(id: string, acquis: readonly string[]): boolean {
  const n = noeudEveil(id)
  if (!n || n.etat === 'a-venir' || noeudTenu(id, acquis)) return false
  return (n.prereq ?? []).every((p) => noeudTenu(p, acquis))
}

/** Le facteur de PÉAGE de vaporisation selon les nœuds tenus (1 = 20 %). */
export function facteurPeage(acquis: readonly string[]): number {
  if (noeudTenu('peage-2', acquis)) return 0.75 // 15 %
  if (noeudTenu('peage-1', acquis)) return 0.85 // 17 %
  return 1
}
