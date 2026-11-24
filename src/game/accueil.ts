// L'ACCUEIL — le poste d'observation. Ce que la fiche dit, sans le DOM :
// le verbe du bouton principal, la valeur courte de chaque lieu et son
// voyant, les pictogrammes des réglages. main.ts lit l'état de la partie,
// appelle ces fonctions et pose le résultat.
//
// Pourquoi un module à part : la fiche d'avant écrivait ses libellés en dur
// à huit endroits de main.ts (« REPRENDRE L'ESSAI » recopié à chaque
// fermeture), et un libellé oublié restait faux sans qu'aucun test ne le
// voie. Ici, une seule source, et des tests.

/** Le bouton principal : un verbe, et ce qu'il reprend. */
export interface Verbe {
  nom: 'COMMENCER' | 'REPRENDRE'
  /** « salle 9 / 30 », ou vide quand il n'y a pas de descente à situer */
  detail: string
}

export interface EtatVerbe {
  /** une partie tourne derrière la fiche : la fiche est une PAUSE */
  pause: boolean
  /** la partie en cours est une descente (ni le hub, ni un essai d'éditeur) */
  enDescente: boolean
  /** le rang de la salle (0 = la première) — en pause, celui de la partie ;
   *  hors partie, celui de la descente sauvée ; null s'il n'y en a pas */
  rang: number | null
  /** la longueur de la descente, en salles */
  total: number
}

const salle = (rang: number, total: number): string =>
  `salle ${Math.max(1, Math.min(rang + 1, total))} / ${total}`

export function verbeAccueil(e: EtatVerbe): Verbe {
  if (e.pause) {
    return {
      nom: 'REPRENDRE',
      detail: e.enDescente && e.rang !== null && e.total > 0 ? salle(e.rang, e.total) : '',
    }
  }
  // hors partie, une descente sauvée attend : le verbe EST la reprise
  if (e.rang !== null && e.total > 0) return { nom: 'REPRENDRE', detail: salle(e.rang, e.total) }
  return { nom: 'COMMENCER', detail: '' }
}

/** Les lieux de la fiche, dans l'ordre du rail. Les identifiants sont ceux
 *  des boutons : main.ts y a branché les écrans qu'ils ouvrent. */
export const LIEUX_ACCUEIL = [
  'home-cycle',
  'home-fioles',
  'home-codex',
  'home-station',
  'home-records',
  // les salles des joueurs : à tous depuis le 24/11 (elles étaient derrière
  // le mode concepteur, sous l'allure grise des outils de la régie). Un
  // seul lieu, qui s'ouvre sur ses deux choix (SOUS_LIEUX_COMMUNAUTE)
  'home-communaute',
  'home-sauvegardes',
] as const
export type LieuAccueil = (typeof LIEUX_ACCUEIL)[number]

/** Ce qui reste visible au tout premier lancement : un nouveau venu n'a
 *  qu'une chose à faire. Les autres lieux paraissent quand la partie leur
 *  a donné quelque chose à montrer. */
export const LIEUX_PREMIER_LANCEMENT: readonly LieuAccueil[] = ['home-sauvegardes']

export interface EtatLieux {
  orbes: number
  fiolesEquipees: number
  fiolesLogements: number
  codexConnues: number
  codexTotal: number
  /** le nombre de fiches connues à la dernière ouverture du codex */
  codexVu: number
  /** le nom du module où se trouve la descente en cours, ou vide */
  module: string
  /** la profondeur du record d'expédition, en salles (0 : aucun) */
  recordSalles: number
  emplacement: number
}

export interface ValeurLieu {
  /** la valeur courte, montrée sur la ligne visée seulement */
  val: string
  /** il y a du neuf : le voyant ambre s'allume */
  neuf: boolean
}

export function valeursLieux(e: EtatLieux): Record<LieuAccueil, ValeurLieu> {
  return {
    'home-cycle': {
      val: e.orbes > 0 ? `${e.orbes} orbe${e.orbes > 1 ? 's' : ''}` : '',
      // un orbe en poche, c'est un lien à tisser
      neuf: e.orbes > 0,
    },
    'home-fioles': { val: `${e.fiolesEquipees} / ${e.fiolesLogements}`, neuf: false },
    'home-codex': {
      val: `${e.codexConnues} / ${e.codexTotal}`,
      neuf: e.codexConnues > e.codexVu,
    },
    'home-station': { val: e.module.toLowerCase(), neuf: false },
    'home-records': {
      val: e.recordSalles > 0 ? `${e.recordSalles} salle${e.recordSalles > 1 ? 's' : ''}` : '',
      neuf: false,
    },
    'home-communaute': { val: '', neuf: false },
    'home-sauvegardes': { val: `n° ${e.emplacement}`, neuf: false },
  }
}

/** Les deux choix de COMMUNAUTÉ, dans l'ordre du sous-menu. */
export const SOUS_LIEUX_COMMUNAUTE = ['home-atelier', 'home-creations'] as const
export type SousLieuCommunaute = (typeof SOUS_LIEUX_COMMUNAUTE)[number]

export interface EtatCommunaute {
  /** les salles de MES SALLES (l'éditeur de cet emplacement) */
  sallesAtelier: number
  /** les salles publiées depuis cet emplacement */
  creationsPubliees: number
}

/** Leur valeur courte : « 3 salles » dans l'éditeur, « 1 publiée » parmi
 *  les créations ; rien à zéro. */
export function valeursCommunaute(e: EtatCommunaute): Record<SousLieuCommunaute, string> {
  return {
    'home-atelier': e.sallesAtelier > 0 ? `${e.sallesAtelier} salle${e.sallesAtelier > 1 ? 's' : ''}` : '',
    'home-creations':
      e.creationsPubliees > 0 ? `${e.creationsPubliees} publiée${e.creationsPubliees > 1 ? 's' : ''}` : '',
  }
}

// Les pictogrammes des réglages : un trait, la couleur du texte. Écrits
// ici une fois : main.ts les repose quand le son se coupe ou que le plein
// écran bascule.
const svg = (corps: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${corps}</svg>`

export const PICTOS_ACCUEIL = {
  commandes: svg('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'),
  parametres: svg('<path d="M3 7h18M3 12h18M3 17h18"/><path d="M8 5v4M16 10v4M11 15v4" stroke-width="3"/>'),
  son: svg('<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  muet: svg('<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>'),
  plein: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  quitterPlein: svg('<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>'),
} as const
