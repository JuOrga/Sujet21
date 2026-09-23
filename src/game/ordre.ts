// L'ORDRE DE PEINTURE — qui passe DEVANT qui.
//
// Le décor se peint dans l'ordre des listes : les coques d'abord, dans
// l'ordre de `structures`, puis le mobilier, dans l'ordre de `boxes`
// (niveauExpanse, structures.ts). Le dernier peint est donc DESSUS — et
// c'est la seule chose qui décide, en cas de chevauchement, quelle matière
// se voit. Depuis que les liserés fusionnent (render/fusion.ts), plus rien
// ne trahit la couture : ne reste que ce choix-là, et il se règle ici.
//
// Ces fonctions ne déplacent qu'UN élément à la fois, et rendent son NOUVEL
// indice : l'appelant garde ainsi sa sélection sur l'élément qu'il vient de
// bouger, au lieu de la voir sauter sur le voisin.

import { estUnFond } from './level'

export type SensOrdre = 'derriere' | 'devant' | 'fond' | 'dessus'

/** Déplace l'élément `de` dans la liste et rend son nouvel indice. Un
 *  déplacement impossible (déjà au bout, indice hors liste) ne touche à
 *  rien et rend l'indice d'origine — le bouton reste sans effet plutôt que
 *  de mentir. */
export function deplaceDans<T>(
  liste: T[],
  de: number,
  sens: SensOrdre,
): number {
  if (!Number.isInteger(de) || de < 0 || de >= liste.length) return de
  const vers =
    sens === 'derriere'
      ? de - 1
      : sens === 'devant'
        ? de + 1
        : sens === 'fond'
          ? 0
          : liste.length - 1
  if (vers === de || vers < 0 || vers >= liste.length) return de
  const [item] = liste.splice(de, 1)
  liste.splice(vers, 0, item)
  return vers
}

/** Ce que le bouton doit dire une fois le geste fait — le mouvement se
 *  raconte, sinon rien à l'écran ne dit ce qui vient de changer. */
export function ditLeDeplacement(
  sens: SensOrdre,
  avant: number,
  apres: number,
  total: number,
): string {
  if (avant === apres) {
    return sens === 'derriere' || sens === 'fond'
      ? 'Déjà tout au fond : rien devant quoi passer.'
      : 'Déjà tout dessus : rien derrière quoi passer.'
  }
  const rang = `${apres + 1} / ${total}`
  switch (sens) {
    case 'fond':
      return `Envoyé tout au fond (${rang}) — tout le reste se peint par-dessus.`
    case 'dessus':
      return `Amené tout devant (${rang}) — il couvre désormais tout le reste.`
    case 'derriere':
      return `Reculé d'un rang (${rang}) — son voisin passe devant.`
    default:
      return `Avancé d'un rang (${rang}) — il passe devant son voisin.`
  }
}

/** L'ORDRE RÉEL DE PEINTURE des `n` premières boîtes : leurs indices, les
 *  FONDS d'abord (estUnFond — la baie vitrée), puis tout le reste. Dans
 *  chaque groupe, l'ordre de la liste tient : c'est toujours lui que
 *  l'éditeur règle. Un fond passe ainsi sous le mobilier, comme une zone
 *  d'état — le rendu et l'éditeur peignent dans cet ordre-là. `out` évite
 *  une allocation par image au rendu. */
export function rangsDePeinture(
  boxes: readonly { material: number }[],
  n = boxes.length,
  out: number[] = [],
): number[] {
  out.length = 0
  const m = Math.min(n, boxes.length)
  for (let i = 0; i < m; i++) if (estUnFond(boxes[i].material)) out.push(i)
  for (let i = 0; i < m; i++) if (!estUnFond(boxes[i].material)) out.push(i)
  return out
}
