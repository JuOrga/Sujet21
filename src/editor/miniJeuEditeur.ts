// LE MENU « MINI-JEU » de l'éditeur (le concepteur, 23/09 : « comment
// faire pour mettre un niveau en tant que mini-jeu ? »). Jusque-là, un
// tableau ne devenait mini-jeu qu'en ouvrant la copie d'une salle du code,
// ou en greffant la clé `minijeu` à la main dans le JSON.
//
// Deux choses ne se voient pas depuis le menu, d'où la note qu'il affiche :
//  - le nœud « mini-jeu » de la descente ne cherche pas « un tableau qui a
//    un mini-jeu » : il tire un TYPE, puis prend la salle publiée sous le
//    code de ce type (`salleMiniJeu`, main.ts). Hors de ce code, le tableau
//    se joue en mini-jeu à l'essai, jamais en descente ;
//  - `estMiniJeu` juge aussi au seul code : un tableau publié sous
//    `MJ-PALET` SANS mini-jeu n'a plus de sas et ne se conclut jamais.
//
// Le couperet n'est pas au menu : en descente il est toujours bâti par le
// code (son trait se tire à la graine), une copie publiée ne serait jamais
// jouée.

import {
  CODE_CIBLES,
  CODE_COUPERET,
  CODE_ORBITES,
  CODE_PALET,
  CODE_RAFALES,
  NOMS_MINI_JEU,
  tableauCibles,
  tableauOrbites,
  tableauPalet,
  tableauRafales,
  type MiniJeuDef,
  type MiniJeuId,
} from '../game/minijeux'

export type MiniJeuMenu = Exclude<MiniJeuId, 'couperet'>

/** Les mini-jeux qu'on peut poser sur un tableau, dans l'ordre du menu. */
export const MINI_JEUX_MENU: readonly MiniJeuMenu[] = ['palet', 'rafales', 'orbites', 'cibles']

/** Le code sous lequel publier pour que la descente tire ce tableau. */
export const CODE_DU_MINI_JEU: Record<MiniJeuMenu, string> = {
  palet: CODE_PALET,
  rafales: CODE_RAFALES,
  orbites: CODE_ORBITES,
  cibles: CODE_CIBLES,
}

const CODES_MJ = [CODE_COUPERET, CODE_PALET, CODE_RAFALES, CODE_ORBITES, CODE_CIBLES]

/** Un mini-jeu neuf : celui de la salle du code, règles ET réglages — pris
 *  au constructeur plutôt qu'aux seules règles, sans quoi le palet perdait
 *  son banc (la glace qui glisse). Les réglages que les cibles portent AU
 *  TABLEAU (le tir de glace) ne suivent pas : ils écraseraient ceux du
 *  décor, la note renvoie au préréglage. Copie profonde : une retouche dans
 *  l'éditeur ne doit pas toucher les constantes. */
export function miniJeuNeuf(type: MiniJeuMenu): MiniJeuDef {
  const salle =
    type === 'palet' ? tableauPalet() : type === 'rafales' ? tableauRafales() : type === 'orbites' ? tableauOrbites() : tableauCibles()
  return JSON.parse(JSON.stringify(salle.minijeu)) as MiniJeuDef
}

/** La valeur du menu pour un tableau (« » = aucun ; le couperet, hors menu,
 *  s'affiche tel quel pour ne pas être effacé en silence). */
export function valeurMenu(level: { minijeu?: MiniJeuDef }): string {
  return level.minijeu?.type ?? ''
}

/** La note sous le menu : ce qu'il reste à faire pour que la descente joue
 *  ce tableau, ou le piège d'un code de mini-jeu sans mini-jeu. */
export function noteMiniJeu(level: { code: string; minijeu?: MiniJeuDef }): string {
  const mj = level.minijeu
  if (!mj) {
    return CODES_MJ.includes(level.code)
      ? `⚠ Le code ${level.code} fait de ce tableau un mini-jeu sans règles : pas de sas, et la partie ne se conclut jamais. Choisissez un mini-jeu, ou changez le code.`
      : ''
  }
  if (mj.type === 'couperet') return 'Le couperet est toujours bâti par le code en descente : cette copie ne se joue qu’à l’essai.'
  const code = CODE_DU_MINI_JEU[mj.type]
  const nom = NOMS_MINI_JEU[mj.type]
  const positions = 'Les règles (positions, puits, arrivée…) sont celles de la salle d’origine : à accorder au décor.'
  const cibles = mj.type === 'cibles' ? ' Les cibles se posent à l’outil Mire ; le tir se règle au préréglage « ⚙ Tir de glace ».' : ''
  return (
    (level.code === code
      ? `Publié sous ${code}, ce tableau remplace ${nom} de la descente. `
      : `Ce tableau se joue en mini-jeu à l’essai. Pour que la descente le tire à la place de ${nom}, donnez-lui le code ${code} puis publiez. `) +
    positions +
    cibles
  )
}
