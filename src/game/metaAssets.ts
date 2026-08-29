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

// ---- LES RAPPORTS DES PIÈCES LIVRÉES ----------------------------------
// Un décalque ÉPOUSAIT le rectangle posé : l'alcôve s'élargissait, le pupitre
// s'écrasait. Les pièces ont une forme — on la respecte : le décalque se pose
// ENTIER dans le rectangle, centré, à son propre rapport. Ces valeurs suivent
// les fichiers de public/assets ; changer une image sans changer son rapport
// ici la déformerait de nouveau.
export const RAPPORT_ALCOVE = 1.337
export const RAPPORT_BANC = 2.188
export const RAPPORT_MARCHAND = 0.426

/** La hauteur du marchand, en unités monde : la capsule du Sujet 12, calée
 *  sur sa chambre de l'Économat (400 → 780, derrière la grille). */
export const MARCHAND_HAUTEUR = 380

/** L'opacité des pièces du méta : plus franche que le décor ordinaire
 *  (0,55), parce qu'une alcôve d'achat doit se remarquer de loin. */
const FONDU_META = 0.75

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Le rectangle QUE LA PIÈCE OCCUPE dans un rectangle posé : au centre, à son
 *  rapport, aussi grande que possible sans jamais déborder. Le décalque et le
 *  tracé 2D le partagent — c'est ce qui empêche le cadre dessiné et le cadre
 *  en pointillés de se doubler l'un l'autre. */
export function cadreAuRapport(r: Rect, rapport: number): Rect {
  const w = Math.min(r.maxX - r.minX, (r.maxY - r.minY) * rapport)
  const h = w / rapport
  const cx = (r.minX + r.maxX) / 2
  const cy = (r.minY + r.maxY) / 2
  return {
    minX: cx - w / 2,
    minY: cy - h / 2,
    maxX: cx + w / 2,
    maxY: cy + h / 2,
  }
}

/** Le cadre de l'alcôve d'un plot : la où la niche se dessine. */
export function cadreAlcove(plot: Rect): Rect {
  return cadreAuRapport(plot, RAPPORT_ALCOVE)
}

function poseAuRapport(
  r: Rect,
  rapport: number,
  kind: DecalDef['kind'],
): DecalDef {
  const c = cadreAuRapport(r, rapport)
  return {
    // le centre se lit sur le rectangle POSÉ, pas sur le cadre calculé : le
    // détour par les bords ferait dériver le centre d'un souffle de virgule
    x: (r.minX + r.maxX) / 2,
    y: (r.minY + r.maxY) / 2,
    w: c.maxX - c.minX,
    h: c.maxY - c.minY,
    kind,
    fade: FONDU_META,
  }
}

/** Les décalques que le méta d'un tableau ajoute au décor posé. Vide quand
 *  le tableau n'a pas de méta — le cas de l'immense majorité des salles. */
export function decalsDuMeta(level: LevelDef): DecalDef[] {
  const out: DecalDef[] = []
  for (const p of level.plots ?? []) {
    out.push(poseAuRapport(p, RAPPORT_ALCOVE, 'meta-alcove'))
  }
  if (level.bancMemoires) {
    out.push(poseAuRapport(level.bancMemoires, RAPPORT_BANC, 'meta-banc'))
  }
  if (level.marchand) {
    out.push({
      x: level.marchand.x,
      y: level.marchand.y,
      w: MARCHAND_HAUTEUR * RAPPORT_MARCHAND,
      h: MARCHAND_HAUTEUR,
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

/** L'icône d'un article POUR L'INTERFACE : une pastille qui découpe la
 *  planche en fond, à la taille du texte autour. L'emoji reste le repli —
 *  pour un id sans case, et pour les écrans qu'on n'a pas encore repris. */
export function iconeMetaHTML(id: string, secours: string): string {
  const c = caseIcone(id)
  if (c === null) return `<i>${secours}</i>`
  const col = c % ICONES_COLONNES
  const rang = Math.floor(c / ICONES_COLONNES)
  return `<i class="ico-meta" style="--ic-x:${col};--ic-y:${rang}"></i>`
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
