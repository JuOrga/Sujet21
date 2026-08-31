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

/** LE SEUIL DU VERSEMENT AUTOMATIQUE, en litres.
 *
 *  Il se pose au-DESSUS de la première alerte (`lastCallLiters`, la
 *  bannière « la dernière impulsion approche ») : le but est que cette
 *  bannière ne s'affiche JAMAIS au hub. La marge de 25 % laisse le temps
 *  au versement de trouver sa place dans les creux autour du corps — le
 *  débit n'est pas instantané, et déclencher pile sur le seuil ferait
 *  clignoter l'alerte entre deux images. */
export function seuilVersementAuto(lastCallLiters: number): number {
  return lastCallLiters * 1.25
}

export interface EtatVersement {
  auHub: boolean
  litres: number
  /** volume visé : celui du départ du tableau */
  litresPleins: number
  lastCallLiters: number
  /** l'un des états qui refusent le versement (glace, vapeur, pause…) */
  empeche: boolean
  /** secondes écoulées depuis le dernier versement automatique */
  depuisDernier: number
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
  if (e.depuisDernier < REPOS_VERSEMENT_S) return false
  // rien à rendre : le corps est déjà à son volume de départ
  if (e.litres >= e.litresPleins) return false
  return e.litres <= seuilVersementAuto(e.lastCallLiters)
}
