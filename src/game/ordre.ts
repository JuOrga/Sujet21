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
 *  de mentir.
 *
 *  `memeGroupe` : le déplacement ne compte que les éléments du MÊME groupe
 *  de peinture. Sans lui, « tout dessus » sur une baie vitrée la mettait en
 *  fin de liste et annonçait qu'elle couvrait tout — alors qu'un fond reste
 *  sous le mobilier quel que soit son rang (rangsDePeinture) : l'écran ne
 *  bougeait pas et le message mentait. Par défaut, un seul groupe : la
 *  liste entière, le comportement d'avant. */
export function deplaceDans<T>(
  liste: T[],
  de: number,
  sens: SensOrdre,
  memeGroupe: (a: T, b: T) => boolean = () => true,
): number {
  if (!Number.isInteger(de) || de < 0 || de >= liste.length) return de
  const groupe = indicesDuGroupe(liste, de, memeGroupe)
  const pos = groupe.indexOf(de)
  const cible =
    sens === 'derriere'
      ? pos - 1
      : sens === 'devant'
        ? pos + 1
        : sens === 'fond'
          ? 0
          : groupe.length - 1
  if (cible === pos || cible < 0 || cible >= groupe.length) return de
  // retirer puis réinsérer à l'indice du voisin visé : devant lui s'il
  // était avant, derrière lui s'il était après — dans les deux cas
  // l'élément prend exactement sa place dans le groupe
  const vers = groupe[cible]
  const [item] = liste.splice(de, 1)
  liste.splice(vers, 0, item)
  return vers
}

/** Les indices des éléments du même groupe que `de`, dans l'ordre. */
export function indicesDuGroupe<T>(
  liste: readonly T[],
  de: number,
  memeGroupe: (a: T, b: T) => boolean = () => true,
): number[] {
  const out: number[] = []
  for (let i = 0; i < liste.length; i++)
    if (i === de || memeGroupe(liste[i], liste[de])) out.push(i)
  return out
}

/** Deux boîtes sont du même groupe de peinture si elles sont toutes deux
 *  des fonds, ou toutes deux du mobilier. */
export function memeGroupeDePeinture(
  a: { material: number },
  b: { material: number },
): boolean {
  return estUnFond(a.material) === estUnFond(b.material)
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
