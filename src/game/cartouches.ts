// ---- LES CARTOUCHES DE GAIN -------------------------------------------------
// Ce que la salle (ou le module) rapporte, une cartouche par chose gagnée. La
// tuile d'avant (mbGainHTML, dans main.ts) répétait à CHAQUE salle un
// paragraphe sur l'usage de la monnaie, sa provenance part par part et son
// solde en toutes lettres : on lisait un relevé de compte, on ne voyait pas
// tomber un gain. La cartouche dit un chiffre et un nom, avec l'icône rendue ;
// le rôle et la provenance passent dans l'infobulle (et le codex). Sortie de
// main.ts pour être testée, et réemployée par la fin de module.
// La forme (.mb-cartouche : coins coupés, liseré, alvéole) vit dans la
// feuille de la cérémonie ; recolte.ts dit ce que chaque gain contient.

import { iconeCeremonieHTML } from './iconesStation'
import type { Gain } from './recolte'

/** Échappe ce qui finit dans un nœud ou un attribut : un nom d'orbe ou
 *  d'instrument peut venir de l'éditeur. */
function echappe(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** UNE CARTOUCHE : l'icône dans son alvéole, le gros chiffre, le nom, et le
 *  solde en petit chiffre s'il a un sens. `i` est son rang d'arrivée (--i),
 *  que la feuille et le claquement lisent. */
export function cartoucheHTML(g: Gain, i: number): string {
  const titre = [g.role, g.detail].filter((t) => t !== '').join(' — ')
  return (
    `<div class="mb-cartouche mb-cartouche-${g.cle}" style="--i:${i}" title="${echappe(titre)}">` +
    `<span class="mb-cartouche-alv">${iconeCeremonieHTML(g.cle)}</span>` +
    `<b class="mb-cartouche-val">${echappe(g.valeur)}</b>` +
    `<span class="mb-cartouche-nom">${echappe(g.nom)}</span>` +
    // le solde : un chiffre, son nom (« EN BOURSE ») en infobulle
    (g.solde ? `<small class="mb-cartouche-solde" title="${echappe(g.solde.nom)}">${echappe(g.solde.valeur)}</small>` : '') +
    `</div>`
  )
}
