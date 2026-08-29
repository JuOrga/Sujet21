// LES ASSETS DU MÉTA : où les images du commerce se branchent.
//
// La règle du projet, en une phrase : ce qui est fait de MATIÈRE descend sous
// le fluide (décalque WebGL, refroidi, effacé par l'eau — le corps passe
// devant), ce qui INFORME le joueur reste au-dessus (dessin 2D du fx-canvas,
// toujours lisible). Le méta se répartit donc en deux :
//
//  · l'alcôve d'un plot, le pupitre du banc, la masse du Sujet 12 : du décor,
//    donc des DÉCALQUES — synthétisés ici depuis les données du tableau, pas
//    posés à la main (un plot EST son alcôve : on ne dessine pas deux fois) ;
//  · l'éclat, les prix, les halos, « SERVI » : de l'état, donc du 2D.
//
// Les sortes « meta-* » n'entrent PAS dans la liste des décalques posables
// (levelIO les écarterait d'un fichier) : elles n'existent qu'à l'exécution.
// Tant que l'image manque, le renderer ne dessine rien et le tracé vectoriel
// du fx-canvas tient seul la place — on peut livrer les fichiers un par un.

import type { DecalDef, LevelDef } from './level'

/** La taille du marchand, en unités monde : la masse déborde un peu de sa
 *  capsule de l'Économat (340 × 220) — c'est du décor, pas une collision. */
export const MARCHAND_TAILLE = 360

/** L'opacité des pièces du méta : plus franche que le décor ordinaire
 *  (0,55), parce qu'une alcôve d'achat doit se remarquer de loin. */
const FONDU_META = 0.75

/** Les décalques que le méta d'un tableau ajoute au décor posé. Vide quand
 *  le tableau n'a pas de méta — le cas de l'immense majorité des salles. */
export function decalsDuMeta(level: LevelDef): DecalDef[] {
  const out: DecalDef[] = []
  for (const p of level.plots ?? []) {
    out.push({
      x: (p.minX + p.maxX) / 2,
      y: (p.minY + p.maxY) / 2,
      w: p.maxX - p.minX,
      h: p.maxY - p.minY,
      kind: 'meta-alcove',
      fade: FONDU_META,
    })
  }
  const b = level.bancMemoires
  if (b) {
    out.push({
      x: (b.minX + b.maxX) / 2,
      y: (b.minY + b.maxY) / 2,
      w: b.maxX - b.minX,
      h: b.maxY - b.minY,
      kind: 'meta-banc',
      fade: FONDU_META,
    })
  }
  if (level.marchand) {
    out.push({
      x: level.marchand.x,
      y: level.marchand.y,
      w: MARCHAND_TAILLE,
      h: MARCHAND_TAILLE,
      kind: 'meta-marchand',
      fade: FONDU_META,
    })
  }
  return out
}

// ---- LA PLANCHE D'ICÔNES ---------------------------------------------------
// Une seule image pour tout le commerce : grille 4 × 2 de cases carrées
// (l'atlas des habillages de paroi a le même dessin, 4 × 2). Elle remplace les
// EMOJI, qui changent de tracé d'une machine à l'autre — Windows, Steam Deck
// et Mac ne dessinent pas la même clef.

export const ICONES_URL = '/assets/meta-icones.webp'
export const ICONES_COLONNES = 4
export const ICONES_RANGEES = 2

/** La case de chaque article, dans l'ordre imposé de la planche. Deux
 *  articles peuvent partager une case : le VIATIQUE du comptoir et la FIOLE
 *  DE GOUTTES de l'étal sont le même objet, payé dans deux monnaies. */
export const ICONE_CASE: Record<string, number> = {
  gouttes: 0,
  viatique: 0,
  dashs: 1,
  clef: 2,
  secours: 3,
  sac: 4,
  // les monnaies et marques du méta, pour les écrans qui suivront
  memoire: 5,
  condensat: 6,
  vie: 7,
}

/** La case d'un article, ou null s'il n'en a pas (on retombe sur l'emoji). */
export function caseIcone(id: string): number | null {
  const c = ICONE_CASE[id]
  return c === undefined ? null : c
}

// ---- L'ÉCLAT DE MÉMOIRE ----------------------------------------------------
// Dessiné en 2D par-dessus le fluide : un éclat noyé qu'on ne verrait plus
// serait une information perdue. Deux formats acceptés, distingués par les
// PROPORTIONS du fichier : une vignette carrée (le moteur la fait pivoter) ou
// une bande de vues déjà tournées (le moteur y puise la vue du moment).

export const ECLAT_URL = '/assets/meta-eclat.webp'

/** Le nombre de vues d'une bande de rotation : 1 pour une vignette carrée.
 *  Une bande de 8 vues fait 8 fois plus large que haute. */
export function vuesEclat(largeur: number, hauteur: number): number {
  if (hauteur <= 0) return 1
  const rapport = largeur / hauteur
  return rapport >= 3.5 ? Math.max(1, Math.round(rapport)) : 1
}
