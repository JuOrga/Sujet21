// LE JEU LIT LE CATALOGUE.
//
// Jusqu'ici l'atelier des textes rangeait des retouches que personne ne
// voyait jamais en jeu : on réécrivait dans le vide, et il fallait me
// rendre un export pour que quoi que ce soit paraisse. Ce module est la
// bascule. Il donne au jeu UN SEUL point de lecture — texteDe(clé, défaut)
// — et une langue courante, retenue d'une session à l'autre.
//
// LA RÈGLE DE REPLI, et elle diffère EXPRÈS de celle de l'écran des textes.
// Sur l'écran, une traduction manquante s'affiche VIDE : un trou doit se
// voir, sinon on ne saura jamais ce qui reste à traduire. En JEU, un trou
// serait une fiche blanche : on retombe donc sur le français — la retouche
// française s'il y en a une, la source du code sinon. Un joueur anglais lit
// du français là où la traduction manque ; il ne lit jamais du vide. Les
// deux règles disent la même chose vue des deux côtés : l'atelier montre le
// travail restant, le jeu ne montre jamais un manque au joueur.
//
// LE DÉFAUT PASSÉ EN ARGUMENT est toujours la source du code. Ce module ne
// peut donc pas faire disparaître un texte : au pire il rend ce que le jeu
// affichait avant qu'il n'existe.
//
// MIGRATION PAR DOMAINE. Le codex d'abord — le plus gros gisement de lore,
// et celui qui porte l'arc du récit. Les autres domaines suivront ; chacun
// pose ici son petit lecteur (codexLu…), pour que la CLÉ soit construite au
// même endroit que celle du catalogue et qu'aucune dérive ne soit possible.

import type { CodexDef } from '../game/codex'
import { cleTexte, type DomaineTexte } from './catalogue'
import { LANGUE_SOURCE, langueDef, surcharges, type Langue } from './atelier'

const CLE_LANGUE = 'projet21.langue.v1'

function stockage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

let langue: Langue | null = null

/** La langue dans laquelle le JEU s'affiche. */
export function langueLue(): Langue {
  if (langue) return langue
  langue = langueDef(String(stockage()?.getItem(CLE_LANGUE)))?.code ?? LANGUE_SOURCE
  return langue
}

export function poseLangueLue(l: Langue): void {
  langue = l
  try {
    stockage()?.setItem(CLE_LANGUE, l)
  } catch {
    // refusé : la langue vaut pour la session
  }
}

/**
 * Le texte d'une clé, dans la langue du moment. `defaut` est la source du
 * code : elle sert de dernier recours, et c'est ce qui rend l'appel sûr
 * partout, même pour une clé que le catalogue ignore.
 */
export function texteDe(cle: string, defaut: string): string {
  const l = langueLue()
  const mien = surcharges(l)[cle]
  if (mien) return mien
  if (l === LANGUE_SOURCE) return defaut
  // repli : la retouche française d'abord — si le concepteur a réécrit un
  // texte, c'est CETTE version qu'il faut montrer, pas celle d'avant
  return surcharges(LANGUE_SOURCE)[cle] ?? defaut
}

/** Une fiche du codex telle que le joueur la lit. */
export function codexLu(d: CodexDef): { titre: string; texte: string } {
  return {
    titre: texteDe(cleTexte('codex', d.id, 'titre'), d.titre.trim()),
    texte: texteDe(cleTexte('codex', d.id, 'texte'), d.texte.trim()),
  }
}

/**
 * LES DOMAINES QUE LE JEU LIT DÉJÀ. La bascule se fait domaine par domaine.
 * Tant qu'un domaine n'est pas dans cette liste, une retouche s'y range
 * bien, s'exporte bien — mais le jeu continue d'afficher la chaîne du code.
 * L'écran des textes le DIT, chiffre à l'appui : mieux vaut une mention
 * sèche que trois heures de réécriture sans effet visible.
 */
export const DOMAINES_LUS: ReadonlySet<DomaineTexte> = new Set<DomaineTexte>([
  'codex',
])
