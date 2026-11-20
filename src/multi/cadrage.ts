// LE CADRAGE DU MULTI — une caméra pour deux.
//
// Les deux corps doivent rester à l'écran de CHACUN : on se cherche, on se
// vise, on se fuit — perdre l'autre de vue, c'est perdre le jeu. Le cadre
// enveloppe donc les deux corps avec une marge, se resserre quand ils se
// rapprochent (on voit alors la matière de près) et s'ouvre quand ils
// s'éloignent, jusqu'à montrer la salle entière. Chaque joueur calcule le
// sien, depuis les mêmes positions : les deux écrans montrent la même chose.
//
// Module PUR : des nombres en entrée, des nombres en sortie.

import type { Bornes } from './trame'

/** Ce que l'écran montre du monde : un centre et deux demi-étendues. */
export interface Cadre {
  cx: number
  cy: number
  demiL: number
  demiH: number
}

/** La marge autour des corps (u) : un corps fait ~110 u de rayon, et il
 *  faut voir où part le jet. */
export const MARGE_CORPS = 460
/** La demi-hauteur minimale (u) : le plus près qu'on regarde. Le corps y
 *  occupe à peu près un cinquième de la hauteur. */
export const DEMI_HAUTEUR_MIN = 560
/** Ce qu'on laisse voir au-delà des murs (u) : la paroi se lit comme une
 *  paroi, pas comme le bord de l'écran. */
export const DEBORD_SALLE = 70

/** Le cadre qui montre toute la salle, à ce rapport largeur/hauteur. */
export function cadreSalle(salle: Bornes, aspect: number): Cadre {
  const l = (salle.maxX - salle.minX) / 2 + DEBORD_SALLE
  const h = (salle.maxY - salle.minY) / 2 + DEBORD_SALLE
  const demiL = Math.max(l, h * aspect)
  return { cx: (salle.minX + salle.maxX) / 2, cy: (salle.minY + salle.maxY) / 2, demiL, demiH: demiL / aspect }
}

/** Le cadre VOULU pour ces corps : il les enveloppe tous, sans jamais
 *  dépasser la vue d'ensemble ni sortir de la salle. */
export function cadreVoulu(corps: readonly { x: number; y: number; disperse: boolean }[], salle: Bornes, aspect: number): Cadre {
  const ensemble = cadreSalle(salle, aspect)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of corps) {
    if (c.disperse || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue
    if (c.x < minX) minX = c.x
    if (c.x > maxX) maxX = c.x
    if (c.y < minY) minY = c.y
    if (c.y > maxY) maxY = c.y
  }
  if (minX > maxX) return ensemble // plus personne : on montre la salle
  const besoinL = (maxX - minX) / 2 + MARGE_CORPS
  const besoinH = Math.max(DEMI_HAUTEUR_MIN, (maxY - minY) / 2 + MARGE_CORPS)
  const demiL = Math.max(besoinL, besoinH * aspect)
  if (demiL >= ensemble.demiL) return ensemble
  const demiH = demiL / aspect
  // le centre est retenu dans la salle : on ne cadre pas le vide derrière
  // un mur parce qu'un corps s'y est collé
  const retient = (c: number, demi: number, min: number, max: number): number => {
    const bas = min - DEBORD_SALLE + demi
    const haut = max + DEBORD_SALLE - demi
    if (bas > haut) return (min + max) / 2
    return c < bas ? bas : c > haut ? haut : c
  }
  return {
    cx: retient((minX + maxX) / 2, demiL, salle.minX, salle.maxX),
    cy: retient((minY + maxY) / 2, demiH, salle.minY, salle.maxY),
    demiL,
    demiH,
  }
}

/** Rapproche le cadre de celui voulu, en douceur : la caméra ne saute pas
 *  quand un corps part d'un coup. `vitesse` est en « par seconde » (3 : les
 *  deux tiers du chemin en un tiers de seconde). */
export function suitCadre(actuel: Cadre, voulu: Cadre, dt: number, vitesse = 3): Cadre {
  const k = 1 - Math.exp(-vitesse * Math.max(0, dt))
  return {
    cx: actuel.cx + (voulu.cx - actuel.cx) * k,
    cy: actuel.cy + (voulu.cy - actuel.cy) * k,
    demiL: actuel.demiL + (voulu.demiL - actuel.demiL) * k,
    demiH: actuel.demiH + (voulu.demiH - actuel.demiH) * k,
  }
}

/** Du pointeur (en fraction de l'écran, 0 → 1 depuis le coin haut-gauche)
 *  au monde. Le monde a son axe y vers le BAS, comme l'écran. */
export function ecranVersMonde(c: Cadre, fx: number, fy: number): { x: number; y: number } {
  return { x: c.cx + (fx * 2 - 1) * c.demiL, y: c.cy + (fy * 2 - 1) * c.demiH }
}

/** Du monde à l'écran, en fraction (peut sortir de 0 → 1 : hors champ). */
export function mondeVersEcran(c: Cadre, x: number, y: number): { fx: number; fy: number } {
  return { fx: ((x - c.cx) / c.demiL + 1) / 2, fy: ((y - c.cy) / c.demiH + 1) / 2 }
}
