// LES LIENS DU CODEX — des fiches qui se citent, à la manière d'un wiki.
//
// Le concepteur voulait qu'on puisse « lier les entrées du codex entre
// elles, comme Wikipédia ». Un lien s'écrit DANS LE TEXTE, avec la syntaxe
// wiki, parce que c'est là que le concepteur écrit déjà (atelier des
// textes, atelier du journal) — aucun champ de plus à tenir :
//
//   [[vapeur-grille]]                → le titre de la fiche visée
//   [[vapeur-grille|la vapeur]]      → le libellé choisi
//
// ADAPTÉ AU JEU, pas copié du wiki :
//   · un lien vers une fiche ENCORE VERROUILLÉE ne ment pas et ne divulgue
//     pas : son libellé s'affiche (l'auteur l'a choisi), marqué « ? », et
//     il mène à l'INDICE de la fiche — le codex pointe ce qu'il reste à
//     tenter, c'est la curiosité qu'il récompense. Sans libellé, le titre
//     caché reste caché : « ? ? ? ».
//   · un lien vers un id INCONNU (fiche retirée, faute de frappe) se lit
//     comme du texte nu : jamais de lien mort sous le doigt du joueur.
//   · les « pages liées » (ce qui cite cette fiche) ne montrent que les
//     fiches CONNUES : un texte encore secret ne se trahit pas par ses liens.
//   · en plus des liens écrits, les fiches d'un même ÉLÉMENT (même matériau,
//     autre état) se tiennent d'office : c'est la table matériau × état que
//     le joueur remplit, et on ne devrait pas avoir à l'écrire à la main.
//
// Tout ici est pur (testé dans codexLiens.spec.ts) ; l'écran peint.

import type { CodexDef } from './codex'

/** Un morceau de texte : nu, ou lien vers une fiche (`libelle` vide : le
 *  titre de la fiche visée, résolu à l'affichage). */
export type SegmentTexte = { texte: string } | { lien: string; libelle: string }

// `[[` id `]]` ou `[[` id `|` libellé `]]` — l'id suit la règle des ids du
// codex (minuscules, chiffres, tirets), espaces tolérés autour
const LIEN = /\[\[\s*([a-z0-9-]+)\s*(?:\|([^\]]*))?\]\]/g

/** Découpe un texte en morceaux nus et en liens. Un lien vers un id que
 *  `existe` ne reconnaît pas redevient du texte nu (son libellé, ou rien
 *  de la syntaxe) : le joueur ne voit jamais de crochets. */
export function decoupeLiens(texte: string, existe: (id: string) => boolean): SegmentTexte[] {
  const out: SegmentTexte[] = []
  let nu = ''
  let depuis = 0
  for (const m of texte.matchAll(LIEN)) {
    nu += texte.slice(depuis, m.index)
    depuis = m.index + m[0].length
    const id = m[1]
    const libelle = (m[2] ?? '').trim()
    if (!existe(id)) {
      nu += libelle
      continue
    }
    if (nu) out.push({ texte: nu })
    nu = ''
    out.push({ lien: id, libelle })
  }
  nu += texte.slice(depuis)
  if (nu) out.push({ texte: nu })
  return out
}

/** Les ids qu'un texte cite, sans doublon, dans l'ordre d'apparition. */
export function liensDe(texte: string): string[] {
  return [...new Set([...texte.matchAll(LIEN)].map((m) => m[1]))]
}

/** Le texte sans la syntaxe des liens — pour tout affichage qui ne sait
 *  pas peindre un lien (le libellé reste, ou le titre de la fiche visée). */
export function texteNu(texte: string, titreDe: (id: string) => string): string {
  return texte.replace(LIEN, (_, id: string, libelle?: string) => (libelle ?? '').trim() || titreDe(id))
}

/** Les liens qui ne mènent nulle part : à signaler au concepteur, dans
 *  l'atelier, avant que le joueur ne lise du texte nu à leur place. */
export function liensBrises(texte: string, existe: (id: string) => boolean): string[] {
  return liensDe(texte).filter((id) => !existe(id))
}

/** LES PAGES LIÉES : les fiches CONNUES dont le texte cite `id` — jamais
 *  la fiche elle-même. `texteDe` lit le texte tel que le joueur le lit
 *  (retouches du concepteur comprises). */
export function liensEntrants(
  id: string,
  fiches: readonly CodexDef[],
  texteDe: (d: CodexDef) => string,
  connu: (id: string) => boolean,
): CodexDef[] {
  return fiches.filter((d) => d.id !== id && connu(d.id) && liensDe(texteDe(d)).includes(id))
}

/** LE MÊME ÉLÉMENT : les fiches du même matériau, aux autres états, dans
 *  l'ordre liquide → glace → vapeur. Vide pour une fiche sans matériau. */
export function memeElement(d: CodexDef, fiches: readonly CodexDef[]): CodexDef[] {
  if (d.mat === undefined) return []
  return fiches
    .filter((x) => x.id !== d.id && x.mat === d.mat && x.etat !== undefined)
    .sort((a, b) => (a.etat ?? 0) - (b.etat ?? 0))
}
