// Le DOSSIER DE DESCENTE, ses morceaux PURS : qui a la main (manette,
// clavier ou doigt), quel geste l'écran doit afficher, et le mot qui dit la
// coque. Sortis de main.ts pour qu'un test les tienne : le pied du panneau
// écrivait « TAB FERMER » en dur, y compris à celui qui l'avait ouvert d'un
// clic de stick et n'a pas de touche Tab sous la main.

import { nomBouton, nomTouche } from './commandes'
import { BOUTON } from './manette'

export type Peripherique = 'manette' | 'clavier' | 'tactile'

/** Qui a parlé en DERNIER. La manette ne compare d'ordinaire qu'au pointeur
 *  (manette.lastActivity > input.lastPointerAt) ; le dossier compte aussi le
 *  clavier, sans quoi Tab, pressé après une partie à la manette, ouvrait un
 *  panneau qui réclamait « B » à un joueur revenu au clavier. Le doigt
 *  n'a ni touche ni bouton : il ferme au ✕. */
export function peripheriqueALaMain(o: {
  manetteConnectee: boolean
  manetteAt: number
  pointeurAt: number
  clavierAt: number
  tactile: boolean
}): Peripherique {
  if (o.manetteConnectee && o.manetteAt > Math.max(o.pointeurAt, o.clavierAt))
    return 'manette'
  if (o.tactile && o.pointeurAt >= o.clavierAt) return 'tactile'
  return 'clavier'
}

/** Le nom d'un bouton, sans sa précision entre parenthèses : l'écran des
 *  commandes a la place d'écrire « R3 (stick D) », un pied de panneau non. */
export function nomBoutonCourt(i: number | null): string {
  return nomBouton(i).replace(/\s*\(.*\)$/, '')
}

/** Le geste qui REFERME le dossier, pour qui a la main. À la manette, B
 *  referme toujours (le dossier est une couche légère, comme la légende) et
 *  le bouton du dossier, quel qu'il soit après redéfinition, le rebascule ;
 *  au clavier, la touche du dossier ; au doigt, la croix. */
export function gestesFermerDossier(
  p: Peripherique,
  touche: string | null,
  bouton: number | null,
): string[] {
  if (p === 'manette') {
    const g = ['B']
    if (bouton !== null && bouton !== BOUTON.B) g.push(nomBoutonCourt(bouton))
    return g
  }
  if (p === 'clavier' && touche !== null) return [nomTouche(touche)]
  return ['✕']
}

/** La commande d'un ÉTAT à afficher, pour qui a la main — ou null s'il n'y
 *  en a pas (au doigt, on touche le cadran : une touche serait un mensonge).
 *  À défaut de la commande de son appareil, l'autre vaut mieux que rien. */
export function gesteEtat(
  p: Peripherique,
  touche: string | null,
  bouton: number | null,
): string | null {
  if (p === 'tactile') return null
  if (p === 'manette') {
    if (bouton !== null) return nomBoutonCourt(bouton)
    return touche !== null ? nomTouche(touche) : null
  }
  if (touche !== null) return nomTouche(touche)
  return bouton !== null ? nomBoutonCourt(bouton) : null
}

/** La coque en un mot : c'est lui qu'on lit en jouant, les degrés vont
 *  dans l'infobulle. */
export function motCoque(degres: number): string {
  if (degres <= -40) return 'glaciale'
  if (degres <= -10) return 'froide'
  if (degres <= 5) return 'fraîche'
  return 'tiède'
}
