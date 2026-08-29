// L'ÉCHELLE DE RENDU ADAPTATIVE : viser, pas tâtonner.
//
// MESURÉ sur iPad Pro M1 (29/08/2026) : 2,83 Mpx → 18 im/s, 1,26 Mpx →
// 45 im/s. Soit 19,6 puis 17,7 ms par mégapixel — le coût d'une image est
// PROPORTIONNEL au nombre de pixels, sans surcoût fixe. Couper l'éclairage
// ou l'éclairage de volume n'y change rien ; changer de moteur physique non
// plus. Le shader de composition est limité par le REMPLISSAGE.
//
// Tout découle de là. Le temps d'une image varie comme le CARRÉ de
// l'échelle, donc l'échelle qui atteint la cible SE CALCULE :
//
//     echelle_voulue = echelle × √(im/s mesurées ÷ cible)
//
// L'ancienne mécanique tâtonnait par paliers de 25 à 33 % (44 à 56 % de
// pixels d'un cran à l'autre) : un seul cran faisait passer de 26 à 41
// im/s, et pour tenir 60 il fallait tomber si bas que l'image devenait
// floue. Un contrôleur qui calcule atteint le même point sans le dépasser.

/** Au-delà, on peint pour un œil qui ne voit plus la différence. */
export const PLAFOND_DPR = 2

/**
 * LE PLANCHER DE NETTETÉ, et c'est le concepteur qui l'a fixé : « en faible
 * c'est bien encore la qualité ». Le mode fixe « faible » vaut exactement
 * 0,5 — l'adaptatif ne descendra donc JAMAIS plus bas que ce qui a été vu
 * et validé. Sur l'iPad cela le pose à ~45 im/s plutôt qu'à 60 : c'est un
 * choix assumé, mieux vaut 45 nettes que 60 floues. Le jour où l'on
 * préférera l'inverse, c'est ce seul nombre qui bouge.
 */
export const ECHELLE_MIN = 0.5

/** Au démarrage il n'y a pas encore de mesure : plutôt que de peindre cinq
 * mégapixels « pour voir », on part sous un plafond. Une seconde plus tard
 * la première mesure corrige. */
export const BUDGET_PX_DEPART = 3.5e6

/** ZONE MORTE autour de la cible : en deçà, on ne touche à rien. Sans
 * elle, l'échelle tremblerait en permanence autour du point juste. */
export const ZONE_BASSE = 0.94
export const ZONE_HAUTE = 1.04

/** Bornes d'un ajustement : jamais plus de −25 % ou +12 % d'un coup. Un
 * à-coup isolé ne doit pas emporter l'échelle, et la remontée reste
 * discrète — on préfère remonter en deux fois que faire clignoter. */
export const PAS_BAISSE = 0.75
export const PAS_HAUSSE = 1.12

/** L'échelle de départ, sous le plafond de pixels. */
export function echelleDepart(pxNatifs: number): number {
  return arrondi(
    Math.min(1, Math.sqrt(BUDGET_PX_DEPART / Math.max(1, pxNatifs))),
  )
}

/** Au centième : l'échelle ne doit pas frémir sous le bruit de mesure. */
function arrondi(v: number): number {
  return Math.round(v * 100) / 100
}

export interface Ajustement {
  /** `baisse` : on rend moins de pixels. `hausse` : on en rend plus. */
  sens: 'baisse' | 'hausse'
  echelle: number
}

/**
 * L'échelle à viser, ou `null` s'il n'y a rien à faire (on est dans la zone
 * morte, on est déjà au plancher, ou la correction serait imperceptible).
 * Le TEMPS (attendre 1,2 s pour descendre, 5 s pour remonter) reste à
 * l'appelant : cette fonction est pure, elle ne connaît que les nombres.
 */
export function viseEchelle(
  echelle: number,
  fps: number,
  cible: number,
): Ajustement | null {
  if (!(fps > 0) || !(cible > 0)) return null
  const ratio = fps / cible
  const baisse = ratio < ZONE_BASSE
  const hausse = ratio > ZONE_HAUTE && echelle < 1
  if (!baisse && !hausse) return null
  // le temps varie comme le carré de l'échelle : la racine donne le facteur
  const vise = echelle * Math.sqrt(Math.max(0.05, ratio))
  const borne = Math.min(
    echelle * PAS_HAUSSE,
    Math.max(echelle * PAS_BAISSE, vise),
  )
  const neuve = arrondi(Math.min(1, Math.max(ECHELLE_MIN, borne)))
  if (Math.abs(neuve - echelle) < 0.005) return null
  return { sens: baisse ? 'baisse' : 'hausse', echelle: neuve }
}
