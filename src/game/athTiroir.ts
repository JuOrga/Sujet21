// LE TIROIR DE L'ATH : ce qui sert une fois par salle n'a pas à rester à
// l'écran. La barre du bas montrait 14 boutons en permanence, sur deux
// rangées ; en colonne sur téléphone, elle dépassait l'écran (~459 px pour
// 390). Trois boutons restent ; le reste se range ici, chacun avec sa touche.

import type { NomPicto } from './athPictos'

export interface EntreeTiroir {
  id: string
  nom: string
  picto: NomPicto
  /** l'id de la manœuvre dans commandes.ts, pour afficher la touche EN
   *  VIGUEUR (le joueur peut l'avoir redéfinie) ; null = pas de touche */
  manoeuvre: string | null
}

const ENTREES: EntreeTiroir[] = [
  { id: 'legende', nom: 'LÉGENDE', picto: 'legende', manoeuvre: 'legende' },
  { id: 'etats', nom: 'ÉTATS', picto: 'etats', manoeuvre: 'etats' },
  { id: 'dossier', nom: 'DOSSIER', picto: 'dossier', manoeuvre: 'dossier' },
  { id: 'station', nom: 'STATION', picto: 'station', manoeuvre: 'carte' },
  { id: 'recadrer', nom: 'RECADRER', picto: 'recadrer', manoeuvre: 'recadrer' },
  { id: 'vortex', nom: 'VORTEX', picto: 'vortex', manoeuvre: null },
  { id: 'son', nom: 'SON', picto: 'son', manoeuvre: null },
  { id: 'recommencer', nom: 'RECOMMENCER', picto: 'recommencer', manoeuvre: 'recommencer' },
  { id: 'fiche', nom: 'FICHE D’ESSAI', picto: 'fiche', manoeuvre: 'fiche' },
  { id: 'banc', nom: 'BANC', picto: 'banc', manoeuvre: null },
]

/** Les entrées à montrer. `vortexActif` = params.vortexEnabled >= 0.5 : le
 *  vortex est un outil qu'un réglage du banc allume. (Ce qui RESTE à l'écran —
 *  tiroir, pause, temps, et le retour à l'éditeur pendant un essai — n'est pas
 *  une liste : ce sont trois boutons bâtis à la main dans main.ts.) */
export function entreesTiroir(ctx: { vortexActif: boolean }): EntreeTiroir[] {
  return ENTREES.filter((e) => e.id !== 'vortex' || ctx.vortexActif)
}
