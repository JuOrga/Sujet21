// LA BONBONNE AU HUB — la règle, sortie de main.ts pour être vérifiable.
//
// POURQUOI CE FICHIER EXISTE. La décision « faut-il verser maintenant ? »
// tenait, comme le reste, dans les douze mille lignes de main.ts, où aucun
// test ne va. Elle est ici en fonctions pures : mêmes entrées, même
// réponse, sans DOM ni solveur. main.ts ne fait plus qu'obéir.
//
// LA RÈGLE, EN DEUX PHRASES. Au HUB, la réserve est INFINIE : le vaisseau
// est chez soi, on ne s'y assèche pas, et personne n'a envie de perdre un
// corps en allant parler au marchand. Et elle se verse TOUTE SEULE, avant
// que la première alerte n'ait eu le temps de s'afficher — au hub, la
// jauge basse n'est pas une tension de jeu, c'est une gêne.
//
// EN DESCENTE, RIEN NE CHANGE : la réserve reste comptée, le versement
// reste un geste, et la jauge qui descend reste la tension du tableau.

/** Le hub est le seul endroit où la réserve ne se compte pas. */
export function bonbonneIllimitee(auHub: boolean): boolean {
  return auHub
}

// LE SEUIL A ÉTÉ LE DÉFAUT, et il vaut d'être raconté. Le versement se
// déclenchait 25 % au-dessus de `lastCallLiters` (0,6 L), pour que la
// bannière d'alerte n'ait jamais l'occasion de paraître au hub. L'intention
// était bonne, le réglage désastreux : 0,75 L sur un corps plein de 4,50 L,
// c'est attendre 17 % du volume de départ pour renflouer d'un coup les 83 %
// qui manquent. MESURÉ : 750 particules rendues en une image, le corps
// multiplié par SIX — et comme le recul d'une éjection se répartit sur tout
// le corps, la propulsion se trouvait divisée par six dans le même
// instant. Le joueur voyait son volume exploser et sa poussée mourir.
//
// LA RÈGLE EST DONC EN DEUX TEMPS : un SEUIL D'AMORÇAGE, franc, et un
// renflouement PROGRESSIF. Sous 30 % du volume de départ, le renflouement
// s'engage ; il rend ensuite une DOSE par repos jusqu'au plein, puis se
// relâche. Ni le volume ni la poussée ne sautent — et le corps garde le
// droit de maigrir jusqu'à 30 %, donc de rester nerveux, ce qu'un
// entretien permanent lui aurait retiré.
//
// L'HYSTÉRÉSIS EST NÉCESSAIRE, et ce n'est pas un raffinement. Avec un
// seuil unique, la première dose repasserait au-dessus de 30 % et le
// versement s'arrêterait là : le corps vivrait collé à son seuil, à un
// souffle de l'alerte. On s'amorce donc à 30 %, on relâche au PLEIN, et
// entre les deux l'appelant porte le drapeau.

/** La part du volume de départ qu'un versement automatique rend au plus.
 *  Huit pour cent : au-dessus, le saut de propulsion se sent (le recul se
 *  divise par le volume) ; au-dessous, le débit ne suit plus une poussée
 *  soutenue, qui dépense environ 3,5 % du corps par seconde. */
export const DOSE_AUTO = 0.08

/** Le creux en deçà duquel on ne verse pas : sans lui, le versement
 *  repartirait pour une particule à chaque repos, indéfiniment. */
export const CREUX_MINI = 0.02

/** LE SEUIL D'AMORÇAGE, en part du volume de départ. Sous lui, le
 *  renflouement s'engage. Trente pour cent : au-dessus, le corps n'aurait
 *  plus le droit de maigrir et le hub perdrait sa nervosité ; au-dessous,
 *  on retomberait dans la zone d'alerte que ce mécanisme existe pour
 *  éviter (l'alerte se lève à 0,6 L, soit 13 % d'un corps de 4,50 L). */
export const SEUIL_RENFLOUEMENT = 0.3

export interface EtatVersement {
  auHub: boolean
  litres: number
  /** volume visé : celui du départ du tableau */
  litresPleins: number
  /** l'un des états qui refusent le versement (glace, vapeur, pause…) */
  empeche: boolean
  /** secondes écoulées depuis le dernier versement automatique */
  depuisDernier: number
  /** un renflouement est-il DÉJÀ engagé ? (l'hystérésis, portée par
   *  l'appelant : c'est la seule mémoire de la règle) */
  renflouement: boolean
}

/** LE RENFLOUEMENT EST-IL ENGAGÉ après cette image ? Il s'amorce sous le
 *  seuil et ne se relâche qu'une fois le plein rejoint — un état empêché
 *  (glace, vapeur, pause) ne le relâche PAS : on reprendra où l'on en
 *  était, sinon un passage en glace annulerait le renflouement en cours. */
export function renflouementEngage(e: EtatVersement): boolean {
  if (!e.auHub) return false
  if (e.litres >= e.litresPleins * (1 - CREUX_MINI)) return false
  if (e.renflouement) return true
  return e.litres < e.litresPleins * SEUIL_RENFLOUEMENT
}

/** LA DOSE d'un versement automatique, en litres : ce qui manque, borné à
 *  DOSE_AUTO du volume de départ. C'est elle qui remplace le renflouement
 *  d'un coup — et c'est elle qui garantit que le volume ne saute jamais. */
export function doseVersementAuto(
  litres: number,
  litresPleins: number,
): number {
  return Math.max(0, Math.min(litresPleins - litres, litresPleins * DOSE_AUTO))
}

/** Le délai minimal entre deux versements automatiques. Sans lui, un corps
 *  qui n'arrive pas à absorber (creux pleins, particules mal placées)
 *  relancerait le versement à chaque image — et le son de collecte
 *  crépiterait. */
export const REPOS_VERSEMENT_S = 0.75

/** Faut-il verser maintenant, tout seul ? */
export function doitVerserAuto(e: EtatVersement): boolean {
  if (!renflouementEngage(e)) return false // en descente aussi : c'est un GESTE
  if (e.empeche) return false
  // Un « depuis » NÉGATIF n'est pas un repos, c'est une horloge qui vient de
  // repartir de zéro (changement de salle). Le prendre pour un repos muselait
  // le versement au hub pendant tout le temps écoulé dans la salle d'avant.
  if (e.depuisDernier >= 0 && e.depuisDernier < REPOS_VERSEMENT_S) return false
  return true
}
