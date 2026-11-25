// LE CORPS BU JUSQU'À LA DERNIÈRE GOUTTE est une sortie, pas une perte.
//
// Panne vécue (le concepteur, 25/11) : le joueur atteint le sas sous la
// DERNIÈRE IMPULSION — réserve à sec, le corps figé qui dérive — et la
// salle finit sur l'écran de DÉFAITE. Le sas buvait bien le corps, mais
// aucune des conclusions ne s'ouvrait :
//   - « tout bu » (count ≤ 2 % du volume de départ) compte TOUTES les
//     particules de la salle : les gouttes éjectées par chaque impulsion
//     traînent encore loin du sas, le seuil n'est jamais atteint ;
//   - CONTINUER exige un dixième du volume de départ en bonbonne : un corps
//     passé sous le seuil critique (0,3 L, 60 gouttes) n'y suffit pas.
// Le corps disparu dans la bouche, rien ne concluait ; le sursis de la
// réserve à sec (ou celui de la dispersion, si l'impulsion tenue achevait de
// défaire le corps dans l'emprise) courait, et l'écran de défaite tombait.
//
// Un corps qui n'existe plus parce que le SAS l'a bu a franchi la salle :
// il n'y a plus rien à piloter, plus rien à aller cueillir.

/** Ce qu'il faut savoir pour trancher, lu sur la simulation et la boucle. */
export interface EtatCorpsAuSas {
  /** particules avalées par le sas depuis l'entrée du tableau */
  swallowed: number
  /** particules encore dans le corps */
  playerCount: number
  /** le corps était dans l'emprise du sas il y a un instant (cette image
   *  ou presque) : c'est le sas qui l'a fait disparaître, pas un danger */
  empriseRecente: boolean
  /** le VIDE tient le corps : ce qu'il avale n'est pas bu par le sas */
  videPris: boolean
}

/** Vrai quand le corps a été entièrement bu par le sas. Moins de deux
 *  gouttes : la règle du solveur, en dessous il n'y a plus de corps. */
export function corpsBuParLeSas(e: EtatCorpsAuSas): boolean {
  return !e.videPris && e.swallowed > 0 && e.playerCount < 2 && e.empriseRecente
}
