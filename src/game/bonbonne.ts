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
// EN DESCENTE, la réserve reste COMPTÉE et la jauge qui descend reste la
// tension du tableau. Le versement y est un geste — mais un geste qu'on
// PROPOSE, et qu'un secours rattrape au dernier moment : voir la seconde
// moitié du fichier, « l'invite, puis le secours ».

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

// ---- EN DESCENTE : L'INVITE, PUIS LE SECOURS ---------------------------
//
// POURQUOI CETTE SECONDE MOITIÉ. En descente, la bonbonne ne servait
// JAMAIS (signalé). Le geste existait — une fiole de 12 px dans le coin
// haut-gauche, la touche V, la croix ↑ — mais rien ne le proposait là où
// le joueur regarde, ni au moment où il en a besoin : on mourait à sec
// avec deux litres au dos. Une réserve qu'on emporte au sas suivant sans
// y avoir touché n'est pas une tension de jeu, c'est une ligne de score.
//
// LA RÈGLE, EN TROIS MARCHES, de la plus discrète à la plus franche :
//  1. OFFERTE — le corps a perdu la moitié de son volume et la réserve
//     peut en rendre une part qui compte : la fiole se déplie en bouton
//     (« V · VERSER +0,80 L »), et la jauge montre en hachures ce que le
//     geste rendrait. Rien ne presse, mais le geste est NOMMÉ.
//  2. PRESSANTE — le corps entre dans la zone d'alerte : la bannière
//     d'alarme, celle qu'on ne peut pas rater, porte le geste et se touche.
//  3. LE SECOURS — au seuil de la dernière impulsion, la bonbonne se verse
//     TOUTE SEULE. Mourir avec une réserve pleine n'apprenait rien ; se
//     voir sauvé par elle apprend qu'elle existe. Le geste garde son
//     intérêt : verser TÔT, c'est choisir son moment (avant une traversée,
//     pas au milieu) — le secours, lui, ne choisit rien.
//
// Tout est en fonctions pures : main.ts ne fait qu'obéir, comme au hub.

/** Sous cette part du volume de départ, le geste est OFFERT. La moitié :
 *  plus haut, l'invite s'allumerait à la première éjection soutenue et
 *  ferait partie du décor ; plus bas, on rejoindrait l'alerte, et les deux
 *  marches n'en feraient qu'une. */
export const SEUIL_INVITE = 0.5

/** Ce que le versement doit rendre, en part du volume de départ, pour
 *  qu'on prenne la peine de l'OFFRIR. Un fond de bonbonne (trois gouttes)
 *  ne mérite pas un bouton — il reste versable, et le secours le prendra. */
export const GAIN_UTILE = 0.05

export interface EtatDescente {
  /** une salle de run se joue, là, maintenant (ni hub, ni essai, ni
   *  cérémonie, ni pause, ni dispersion, ni sas qui boit) */
  actif: boolean
  litres: number
  /** volume visé : celui du départ du tableau */
  litresPleins: number
  /** ce que la bonbonne contient */
  reserveL: number
  /** un litre de particule : le versement se compte en gouttes entières */
  litreParticule: number
  /** le volume d'ALERTE (params.lastCallLiters) */
  alerteL: number
  /** le volume CRITIQUE (params.criticalVolumeLiters) : sous lui, la
   *  prochaine impulsion est la dernière */
  critiqueL: number
  /** seul l'état liquide absorbe (la glace refuse, le nuage disperserait) */
  liquide: boolean
}

/** CE QUE LE GESTE RENDRAIT, en litres : le creux du corps, borné à la
 *  réserve, en gouttes ENTIÈRES — c'est le chiffre que l'invite annonce,
 *  il doit être celui que le versement tiendra. */
export function gainVersement(e: {
  litres: number
  litresPleins: number
  reserveL: number
  litreParticule: number
}): number {
  if (!(e.litreParticule > 0)) return 0
  const creux = Math.max(0, e.litresPleins - e.litres)
  // l'epsilon rattrape la division flottante (0,8 / 0,005 = 159,99…) sans
  // jamais inventer une goutte
  const gouttes = Math.floor(Math.min(creux, Math.max(0, e.reserveL)) / e.litreParticule + 1e-6)
  return gouttes * e.litreParticule
}

export type InviteBonbonne = 'aucune' | 'offerte' | 'pressante'

/** OÙ EN EST L'INVITE. Pressante dès l'alerte, même hors liquide — c'est à
 *  ce moment qu'il faut SAVOIR qu'on a de quoi tenir, quitte à devoir
 *  d'abord fondre ; offerte seulement si le geste répondrait à l'instant. */
export function inviteBonbonne(e: EtatDescente): InviteBonbonne {
  if (!e.actif) return 'aucune'
  const gain = gainVersement(e)
  if (gain < e.litreParticule) return 'aucune'
  if (e.litres <= e.alerteL) return 'pressante'
  if (!e.liquide) return 'aucune'
  if (e.litres >= e.litresPleins * SEUIL_INVITE) return 'aucune'
  return gain >= e.litresPleins * GAIN_UTILE ? 'offerte' : 'aucune'
}

/** LE SECOURS : faut-il verser tout seul, maintenant ? Au seuil critique,
 *  et seulement si le corps peut absorber — en glace ou en vapeur, la
 *  bannière dit de revenir au liquide, et le secours attend. */
export function doitSecourir(e: EtatDescente): boolean {
  if (!e.actif || !e.liquide) return false
  if (e.litres > e.critiqueL) return false
  return gainVersement(e) >= e.litreParticule
}

/** LA JAUGE, EN DEUX SEGMENTS (en part du volume de départ, 0..1) : le
 *  corps, puis — en hachures — ce que la bonbonne lui rendrait. Les deux
 *  ne dépassent jamais le plein : la jauge est graduée sur le départ. */
export function segmentsJauge(
  litres: number,
  litresPleins: number,
  gain: number,
): { corps: number; reserve: number } {
  if (!(litresPleins > 0)) return { corps: 0, reserve: 0 }
  const corps = Math.max(0, Math.min(1, litres / litresPleins))
  const reserve = Math.max(0, Math.min(1 - corps, gain / litresPleins))
  return { corps, reserve }
}
