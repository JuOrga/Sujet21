// LA FAÇADE DU JOURNAL : ce que le jeu peut savoir des livraisons sans en
// télécharger une seule ligne.
//
// Le journal lui-même vit dans livraisons.ts et n'est chargé QU'À LA
// DEMANDE. Mais deux choses doivent rester SYNCHRONES : la version, écrite
// sur la fiche dès l'accueil, et la dernière livraison, que le rapport de
// performance doit pouvoir citer sans attendre (rapportPerf() est appelé
// depuis des chemins qui ne peuvent pas attendre une promesse).
//
// Elles sont donc calculées À LA COMPILATION. vite.config.ts importe le
// journal — au moment de lire la configuration, hors du paquet — et
// remplace les deux constantes ci-dessous par des littéraux. Aucun chiffre
// à tenir à jour à la main : « N avance TOUT SEUL à chaque livraison », la
// règle d'origine, tient toujours. Un test vérifie que ce qui est injecté
// correspond bien au journal.

import type { Delivery } from './livraisons'

export type { Delivery }

/** Le NOMBRE de livraisons, injecté à la compilation depuis livraisons.ts. */
declare const __NB_LIVRAISONS__: number
/** La plus récente (date et titre seulement), même origine. */
declare const __DERNIERE_LIVRAISON__: { date: string; title: string }

// Le repli n'est pas décoratif : sans lui, tout outil qui exécute ce module
// hors de Vite (un script, un éditeur) planterait sur une variable inconnue.
const NB: number = typeof __NB_LIVRAISONS__ === 'number' ? __NB_LIVRAISONS__ : 0

export const DERNIERE_LIVRAISON: { date: string; title: string } =
  typeof __DERNIERE_LIVRAISON__ === 'object' && __DERNIERE_LIVRAISON__ !== null
    ? __DERNIERE_LIVRAISON__
    : { date: '', title: '' }

// La version du jeu, dérivée du journal : 0.21.N — « 21 » pour le sujet,
// N avance TOUT SEUL à chaque livraison consignée (pas de numéro à penser à
// bumper). Une seule source de vérité : la fiche, l'écran NOTES DE VERSION
// et l'export Markdown l'affichent tous depuis ici.
export const VERSION = `0.21.${NB}`

/** La version qu'avait le jeu à une entrée du journal (0 = la plus
 * récente) : chaque livraison a incrémenté le petit numéro de un. */
export const versionDe = (index: number): string => `0.21.${NB - index}`

/** LE JOURNAL, chargé à la demande. Le premier appel va chercher le morceau
 *  (Vite l'a séparé) ; les suivants le retrouvent en mémoire. */
let enCours: Promise<Delivery[]> | null = null
export function litLivraisons(): Promise<Delivery[]> {
  if (!enCours) enCours = import('./livraisons').then((m) => m.DELIVERIES)
  return enCours
}
