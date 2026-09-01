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
// LA RÈGLE EST DONC INVERSÉE : on ne RÉANIME plus, on ENTRETIENT. Dès qu'il
// manque quelque chose, une DOSE part — jamais plus d'une fraction du
// volume de départ. Le corps reste près du plein, la bannière ne paraît
// pas davantage qu'avant, et ni le volume ni la poussée ne sautent.

/** La part du volume de départ qu'un versement automatique rend au plus.
 *  Huit pour cent : au-dessus, le saut de propulsion se sent (le recul se
 *  divise par le volume) ; au-dessous, le débit ne suit plus une poussée
 *  soutenue, qui dépense environ 3,5 % du corps par seconde. */
export const DOSE_AUTO = 0.08

/** Le creux en deçà duquel on ne verse pas : sans lui, le versement
 *  repartirait pour une particule à chaque repos, indéfiniment. */
export const CREUX_MINI = 0.02

export interface EtatVersement {
  auHub: boolean
  litres: number
  /** volume visé : celui du départ du tableau */
  litresPleins: number
  /** l'un des états qui refusent le versement (glace, vapeur, pause…) */
  empeche: boolean
  /** secondes écoulées depuis le dernier versement automatique */
  depuisDernier: number
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
  if (!e.auHub) return false // en descente, le versement reste un GESTE
  if (e.empeche) return false
  // Un « depuis » NÉGATIF n'est pas un repos, c'est une horloge qui vient de
  // repartir de zéro (changement de salle). Le prendre pour un repos muselait
  // le versement au hub pendant tout le temps écoulé dans la salle d'avant.
  if (e.depuisDernier >= 0 && e.depuisDernier < REPOS_VERSEMENT_S) return false
  // rien à rendre : le corps est à son volume de départ, ou tout comme —
  // un creux d'un centième ne vaut pas un versement
  return e.litres < e.litresPleins * (1 - CREUX_MINI)
}
