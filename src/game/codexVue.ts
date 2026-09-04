// LA VUE DU CODEX — ce que l'écran montre, calculé sans DOM.
//
// Le concepteur a dessiné un codex neuf (maquette « Codex v2 », 04/09) :
// une progression en tête, un rail d'ÉTATS à gauche avec un anneau de
// complétion, la grille des fiches au centre, et à droite la fiche lue —
// avec, pour chaque fiche connue, une VIDÉO de l'effet. Ce fichier tient
// tout ce qui se calcule : les rayons (états) et ce qu'ils contiennent, la
// progression, l'ordre de navigation, l'indice d'une fiche verrouillée,
// les objectifs suivis, l'adresse d'une vidéo. L'écran (ecranCodex.ts) ne
// fait que le peindre.
//
// PAS D'INVENTION : la maquette montrait des récompenses par palier, des
// raretés et des fins — rien de cela n'existe dans le jeu. On montre ce que
// le jeu sait : la progression, la date de découverte, l'indice déduit de
// la combinaison matériau × état. Le reste est une décision de conception
// à prendre, pas un chiffre à afficher.

import { fichesCodex, type CodexDef, type CodexGroupe } from './codex'
import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_MIROIR,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
} from './level'

export type ModeCodex = 'fiches' | 'journal'
export type FiltreCodex = 'tous' | 'ok' | 'non'

export interface RayonCodex {
  id: string
  /** le groupe du codex qu'il montre — null : un rayon sans fiche (scellé) */
  groupe: CodexGroupe | null
  nom: string
  icone: string
  teinte: string
  sous: string
  scelle?: boolean
}

/** Les rayons des FICHES : les trois états, les phénomènes, et le
 *  quatrième état sous clé — annoncé, pas joué (le plasma). */
export const RAYONS_FICHES: readonly RayonCodex[] = [
  { id: 'eau', groupe: 'eau', nom: 'LIQUIDE', icone: '💧', teinte: '#63b7e6', sous: 'Ce que le fluide fait quand il coule' },
  { id: 'glace', groupe: 'glace', nom: 'SOLIDE', icone: '❄', teinte: '#a7ddf5', sous: 'Ce que la glace endure et brise' },
  { id: 'vapeur', groupe: 'vapeur', nom: 'GAZ', icone: '💨', teinte: '#ffdda6', sous: 'Ce que la vapeur traverse et pousse' },
  { id: 'phenomenes', groupe: 'phenomenes', nom: 'PHÉNOMÈNES', icone: '✦', teinte: '#3fd69b', sous: 'Ce que le vaisseau fait au sujet' },
  { id: 'scelle', groupe: null, nom: 'SCELLÉ', icone: '⚛', teinte: '#b48cff', sous: 'Le quatrième état. Secteur sous clé.', scelle: true },
]

/** Le JOURNAL : le récit et les FINS, des paliers numérotés servis dans
 *  l'ordre, une entrée par expédition bouclée. */
export const RAYONS_JOURNAL: readonly RayonCodex[] = [
  { id: 'recit', groupe: 'recit', nom: 'LE RÉCIT', icone: '🛰', teinte: '#ffdda6', sous: 'Ce que le laboratoire a laissé derrière lui' },
  { id: 'fins', groupe: 'fins', nom: 'LES FINS', icone: '🚪', teinte: '#b48cff', sous: 'Ce que devient le sujet quand l’expédition se boucle' },
]

export function rayonsDe(mode: ModeCodex): readonly RayonCodex[] {
  return mode === 'journal' ? RAYONS_JOURNAL : RAYONS_FICHES
}

export function fichesDuRayon(r: RayonCodex): CodexDef[] {
  return r.groupe ? fichesCodex().filter((d) => d.groupe === r.groupe) : []
}

export function visibles(r: RayonCodex, filtre: FiltreCodex, connu: (id: string) => boolean): CodexDef[] {
  return fichesDuRayon(r).filter((d) =>
    filtre === 'tous' ? true : filtre === 'ok' ? connu(d.id) : !connu(d.id),
  )
}

/** La progression d'un mode : les fiches connues sur toutes celles du mode. */
export function progression(
  mode: ModeCodex,
  connu: (id: string) => boolean,
): { faites: number; total: number; pct: number } {
  const toutes = rayonsDe(mode).flatMap(fichesDuRayon)
  const faites = toutes.filter((d) => connu(d.id)).length
  const total = toutes.length
  return { faites, total, pct: total ? Math.round((faites / total) * 100) : 0 }
}

/** La fiche voisine dans une liste, en boucle. */
export function voisine(liste: readonly CodexDef[], id: string | null, sens: 1 | -1): CodexDef | null {
  if (liste.length === 0) return null
  const i = liste.findIndex((d) => d.id === id)
  if (i < 0) return liste[0]
  return liste[(i + sens + liste.length) % liste.length]
}

const ETATS = ['liquide', 'glace', 'vapeur'] as const
const MATERIAUX: Record<number, string> = {
  [MAT_WALL]: 'une paroi nue',
  [MAT_HYDROPHILE]: 'une surface hydrophile (liseré turquoise)',
  [MAT_HYDROPHOBE]: 'une surface hydrophobe (liseré violet)',
  [MAT_FROID]: 'une plaque froide',
  [MAT_GRILLE]: 'un évent',
  [MAT_CHAUD]: 'une chaudière',
  [MAT_MEMBRANE]: 'une membrane',
  [MAT_RIDEAU]: 'un rideau lamellaire',
  [MAT_SURCHAUFFEUR]: 'une borne surchauffeur',
  [MAT_MIROIR]: 'un miroir',
}

/** L'INDICE d'une fiche verrouillée : déduit de la combinaison matériau ×
 *  état quand la fiche en porte une (le titre, lui, reste caché : il dirait
 *  la réponse). Les phénomènes et le récit se découvrent autrement. */
export function indice(d: CodexDef): string {
  if (d.mat !== undefined && d.etat !== undefined) {
    const mat = MATERIAUX[d.mat] ?? 'un élément du vaisseau'
    return `Toucher ${mat} à l’état ${ETATS[d.etat]}.`
  }
  if (d.groupe === 'recit')
    return 'Un fragment du récit reste à révéler — il se livre à chaque expédition bouclée.'
  if (d.groupe === 'fins')
    return 'Une fin reste à atteindre — elle se révèle quand une expédition se boucle, dans l’ordre.'
  return 'Un phénomène du protocole reste à provoquer en jouant.'
}

// ---- LE JOURNAL, EN JALONS ---------------------------------------------------
// Le récit et les fins ne se lisent pas comme des fiches d'expérience : ce
// sont des ÉTAPES, numérotées, servies dans l'ordre. Le concepteur les
// voulait présentées comme des jalons — « FIN I », « FIN II »… — avec, sous
// une entrée encore scellée, ce qui l'ouvre. D'où ces trois calculs.

const ROMAINS: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

/** Un rang en chiffres romains — 0 ou moins : le chiffre nu (garde-fou). */
export function romain(n: number): string {
  let reste = Math.floor(n)
  if (!Number.isFinite(reste) || reste < 1) return String(n)
  let out = ''
  for (const [v, s] of ROMAINS) {
    while (reste >= v) {
      out += s
      reste -= v
    }
  }
  return out
}

/** L'ordinal français d'un rang : 1re, 2e, 3e… */
export function ordinal(n: number): string {
  return n === 1 ? '1re' : `${n}e`
}

/** Ce qui ouvre une entrée du journal encore scellée. Récit et fins se
 *  servent DANS L'ORDRE, une par expédition bouclée (journal.ts) : le rang
 *  dit donc combien d'expéditions il reste à boucler. */
export function conditionJournal(groupe: CodexGroupe | null, rang: number): string {
  return groupe === 'fins'
    ? `Se révèle à la ${ordinal(rang)} expédition bouclée.`
    : `Se livre au ${ordinal(rang)} fragment servi.`
}

/** L'étiquette de rang d'une entrée du journal : « FIN III », « FRAGMENT V ». */
export function rangJournal(groupe: CodexGroupe | null, rang: number): string {
  return `${groupe === 'fins' ? 'FIN' : 'FRAGMENT'} ${romain(rang)}`
}

/** Une date ISO de découverte, lisible — vide si inconnue. */
export function formateQuand(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ---- LES OBJECTIFS SUIVIS : les fiches que le joueur s'est promis --------
export const CLE_CIBLES = 'projet21.codex.cibles.v1'

export function litCibles(storage: { getItem(k: string): string | null } | null): Set<string> {
  try {
    const brut = JSON.parse(storage?.getItem(CLE_CIBLES) ?? '[]') as unknown
    return new Set(Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function ecritCibles(storage: { setItem(k: string, v: string): void } | null, cibles: Set<string>): void {
  try {
    storage?.setItem(CLE_CIBLES, JSON.stringify([...cibles]))
  } catch {
    // stockage refusé : l'objectif tiendra la session
  }
}

// ---- LA VIDÉO D'UNE FICHE ----------------------------------------------------
// Une vidéo par fiche, nommée par son id, dans public/assets/codex/ (voir le
// LISEZ-MOI du dossier) — ou ENVOYÉE depuis l'atelier du codex, et alors
// c'est elle qui prime (codexReglages.ts). Absente, l'écran montre le
// glyphe : rien ne casse.
export function videoDe(id: string, envoyee = ''): { src: string; poster: string } {
  if (envoyee) return { src: envoyee, poster: '' }
  return { src: `/assets/codex/${id}.webm`, poster: `/assets/codex/${id}.webp` }
}
