// LES PUPITRES : des SURFACES DE CONTACT qui ouvrent un ÉCRAN.
//
// Le banc des mémoires fut le premier (level.bancMemoires) : un rectangle
// posé dans le module, le corps qui s'y glisse, et l'écran du cycle qui
// s'ouvre. C'était un cas particulier écrit en dur — il en fallait un
// deuxième (le mur des records), un troisième (le plan de la station), et
// chacun aurait demandé son champ, son booléen d'entrée, sa ligne dans le
// format. D'où ce catalogue : UN outil d'éditeur, une liste fermée
// d'écrans, et le jeu qui ouvre celui que le pupitre nomme.
//
// La liste est FERMÉE, et c'est voulu : un pupitre ne peut ouvrir qu'un
// écran qui existe déjà au menu d'accueil. Un id inconnu est écarté à la
// lecture (levelIO) — un pupitre muet vaut mieux qu'un pupitre qui ouvre
// n'importe quoi.
//
// Ce module ne connaît RIEN du reste du jeu (pas d'import) : le format le
// lit, l'éditeur le liste, main.ts branche chaque id sur son voile.

export type EcranPupitre =
  | 'records' // les registres du labo — le palmarès des essais
  | 'station' // le plan du complexe orbital — LA CARTE
  | 'reparations' // l'état des stations du module : réparé, en panne, prix
  | 'cycle' // l'écran des mémoires (ce que faisait le banc)
  | 'codex' // le manuel écrit par la partie
  | 'fioles' // la collection d'échantillons scellés
  | 'table-depart' // le récapitulatif de ce qu'on emporte
  | 'marchand' // le Semblable du comptoir : orbes, améliorations durables, provisions

export interface FichePupitre {
  id: EcranPupitre
  nom: string // la plaque du pupitre, faute de titre posé
  icone: string
  /** La ligne du panneau d'éditeur : ce que le concepteur voit s'ouvrir. */
  note: string
}

export const PUPITRES: readonly FichePupitre[] = [
  {
    id: 'records',
    nom: 'MUR DES RECORDS',
    icone: '✦',
    note: 'Les registres du protocole : le palmarès salle par salle, la meilleure expédition, l’historique des essais.',
  },
  {
    id: 'station',
    nom: 'PLAN DE LA STATION',
    icone: '🛰️',
    note: 'LA CARTE : le plan à routes ramifiées de la station — d’où l’on vient, où l’on est, les coursives ouvertes et celles qui attendent un orbe.',
  },
  {
    id: 'reparations',
    nom: 'TABLEAU DES AVARIES',
    icone: '🛠️',
    note: 'Le récapitulatif des réparations du module : chaque station, réparée ou en panne, son prix en mémoire et ce qu’elle rend.',
  },
  {
    id: 'cycle',
    nom: 'BANC DES MÉMOIRES',
    icone: '⚛',
    note: 'L’écran du cycle des états : chaque transformation manuelle est un lien à tisser avec son orbe d’essence de conscience.',
  },
  {
    id: 'codex',
    nom: 'CODEX',
    icone: '◉',
    note: 'Le manuel écrit par la partie : une fiche par interaction vécue.',
  },
  {
    id: 'fioles',
    nom: 'ARMOIRE À FIOLES',
    icone: '⚗️',
    note: 'La collection d’échantillons scellés — deux fioles s’équipent pour la run.',
  },
  {
    id: 'table-depart',
    nom: 'TABLE DE DÉPART',
    icone: '🗺️',
    note: 'Le récapitulatif de ce qu’on emporte à la prochaine descente (vies, réserve, fioles, provisions). Un simple toast : rien à fermer.',
  },
  {
    id: 'marchand',
    nom: 'LE MARCHAND',
    icone: '🔮',
    note: 'Le Semblable du comptoir : les orbes d’essence de conscience, les améliorations durables et les provisions — payés en mémoire. Posé dans le hub, il remplace le contact de l’étal.',
  },
]

export const ECRANS_PUPITRE: readonly EcranPupitre[] = PUPITRES.map((p) => p.id)

/** La fiche d'un écran, ou null si l'id n'est pas du catalogue. */
export function fichePupitre(id: string): FichePupitre | null {
  return PUPITRES.find((p) => p.id === id) ?? null
}

/** La plaque affichée : le titre posé par l'auteur, sinon le nom du
 *  catalogue. Un titre vide (ou tout en espaces) ne compte pas — sans quoi
 *  un pupitre pourrait n'avoir aucune plaque du tout. */
export function plaquePupitre(p: {
  ecran: EcranPupitre
  titre?: string
}): string {
  const pose = (p.titre ?? '').trim()
  if (pose) return pose
  return fichePupitre(p.ecran)?.nom ?? p.ecran.toUpperCase()
}
