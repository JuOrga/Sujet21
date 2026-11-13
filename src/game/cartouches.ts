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

import { iconeCeremonieHTML, type IconeCeremonie } from './iconesStation'
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

// ---- LES HALTES : glyphes, puces, plaques, offres ---------------------------
// Les données des haltes (descenteCarte.ts, evenements.ts) et les lignes
// d'issue que main.ts compose parlent en émojis : les écrans hors cérémonie
// les gardent. La cérémonie ne les écrit plus, elle les TRADUIT par cette
// table en icônes rendues — une seule table, exportée pour les autres écrans
// qui parlent encore en émojis.

/** Le glyphe d'une donnée → son icône de cérémonie. */
export const ICONE_DE_GLYPHE: Record<string, IconeCeremonie> = {
  '🫙': 'reserve',
  '💧': 'condensat',
  '🧠': 'memoire',
  '💠': 'secours',
  '🗺️': 'carte',
  '⚠️': 'danger',
  '🜄': 'profondeur',
  '🔮': 'orbe',
}

/** Le sélecteur de variante (U+FE0F) ne change pas le dessin : « 🗺️ » et
 *  « 🗺 » sont le même glyphe, l'un ou l'autre selon qui l'a tapé. */
const sansVariante = (g: string): string => g.replace(/\uFE0F/g, '')
const PAR_GLYPHE = new Map(Object.entries(ICONE_DE_GLYPHE).map(([g, i]) => [sansVariante(g), i]))

/** L'icône d'un glyphe, ou null si la table ne le connaît pas. */
export function iconeDuGlyphe(glyphe: string): IconeCeremonie | null {
  return PAR_GLYPHE.get(sansVariante(glyphe)) ?? null
}

/** L'ALVÉOLE d'un glyphe : son icône rendue, ou — glyphe inconnu (l'émoji
 *  d'un instrument, un glyphe ajouté plus tard) — le glyphe lui-même, écrit.
 *  Jamais une alvéole vide. `autre` laisse l'appelant dessiner ce que la
 *  table ignore (l'icône rendue d'un instrument). */
function alveoleDuGlyphe(glyphe: string, autre?: string | null): string {
  const icone = iconeDuGlyphe(glyphe)
  const dedans = icone ? iconeCeremonieHTML(icone) : (autre ?? `<i class="mb-glyphe">${echappe(glyphe)}</i>`)
  return `<span class="mb-cartouche-alv">${dedans}</span>`
}

/** LA PUCE D'UNE ISSUE : une ligne de ce qu'une rencontre a donné
 *  (« 🫙 réserve +1,5 L »). Le glyphe de tête passe dans l'alvéole, la
 *  phrase reste. Une ligne qui ne commence pas par un glyphe (une lettre, un
 *  chiffre : « +1 échantillon ») se pose sans alvéole. */
export function puceHTML(
  ligne: string,
  i: number,
  autre?: (glyphe: string, texte: string) => string | null,
): string {
  const m = /^(\S+)\s+([\s\S]*)$/u.exec(ligne)
  const glyphe = m && !/[\p{L}\p{N}]/u.test(m[1]) ? m[1] : null
  const texte = glyphe ? m![2] : ligne
  return (
    `<li class="mb-cartouche mb-puce${glyphe ? '' : ' mb-puce-nue'}" style="--i:${i}">` +
    (glyphe ? alveoleDuGlyphe(glyphe, autre?.(glyphe, texte)) : '') +
    `<span class="mb-puce-texte">${echappe(texte)}</span></li>`
  )
}

/** UNE PLAQUE : un chiffre et un nom, comme une cartouche de gain, pour ce
 *  qui n'est pas un gain (les jauges de la fin, la mémoire d'un mini-jeu).
 *  `cle` choisit le liseré (.mb-cartouche-<cle>). */
export function plaqueHTML(
  p: { cle: string; icone: IconeCeremonie; valeur: string; nom: string; titre?: string },
  i: number,
): string {
  return (
    `<div class="mb-cartouche mb-cartouche-${p.cle}" style="--i:${i}"${p.titre ? ` title="${echappe(p.titre)}"` : ''}>` +
    `<span class="mb-cartouche-alv">${iconeCeremonieHTML(p.icone)}</span>` +
    `<b class="mb-cartouche-val">${echappe(p.valeur)}</b>` +
    `<span class="mb-cartouche-nom">${echappe(p.nom)}</span>` +
    `</div>`
  )
}

/** LE DEDANS D'UNE OFFRE (le bouton est à l'appelant, qui tient le choix) :
 *  l'alvéole (un glyphe de donnée, ou une icône), le nom, le détail — voilé
 *  pour une offre de rencontre jamais prise —, et une mention écrite par
 *  l'appelant (« ⚄ 3 issues possibles »). */
export function offreHTML(o: {
  glyphe?: string
  icone?: IconeCeremonie
  nom: string
  detail: string
  voile?: boolean
  mention?: string
}): string {
  const alv = o.icone
    ? `<span class="mb-cartouche-alv">${iconeCeremonieHTML(o.icone)}</span>`
    : o.glyphe
      ? alveoleDuGlyphe(o.glyphe)
      : ''
  return (
    alv +
    `<b class="mb-offre-nom">${echappe(o.nom)}</b>` +
    `<small class="mb-offre-detail${o.voile ? ' mb-ev-voile' : ''}">${echappe(o.detail)}</small>` +
    (o.mention ?? '')
  )
}
