// LA VUE DU TABLEAU DES AVARIES — ce que l'écran montre, calculé sans DOM.
//
// Le tableau des avaries est refait sur le même dessin que le codex et le
// marchand (maquettes « Codex v2 » et « Marchand v2 » du concepteur) : un
// rail de SECTEURS à gauche, la grille des STATIONS au centre (une carte
// par station, un filtre en pastilles), la FICHE de la station à droite,
// et la légende manette en pied. Ce fichier tient tout ce qui se calcule :
// les secteurs et ce qu'ils regroupent, l'état de chaque station face à la
// mémoire, les filtres, les libellés. L'écran (ecranAvaries.ts) ne fait
// que le peindre.
//
// CE QUE L'ÉCRAN N'EST PAS : une boutique. La réparation se paie AU
// CONTACT du plot de la station (main.ts, tenteReparation) — le tableau
// dit ce qui est debout, ce qui est en panne, ce que coûte le reste, et
// où aller le payer. C'est une console de diagnostic, et le bouton de la
// fiche est une consigne, pas une caisse.
//
// PAS D'INVENTION : les secteurs ne sont pas une donnée de plus à tenir
// dans le catalogue — ils se DÉDUISENT de ce que la panne fait
// (reparations.ts) : une porte condamne un ACCÈS, un écran éteint est une
// CONSOLE, le reste est de l'ÉNERGIE. Réécrire une station la range
// toute seule.

import { REPARATIONS, type ReparationDef } from './reparations'

export type SecteurId = 'tout' | 'energie' | 'consoles' | 'acces'

export interface Secteur {
  id: SecteurId
  nom: string
  icone: string
  teinte: string
  /** la ligne sous le nom, en tête de la grille */
  sous: string
}

export const SECTEURS: readonly Secteur[] = [
  {
    id: 'tout',
    nom: 'TOUT LE MODULE',
    icone: '⚠',
    teinte: '#ffb35c',
    sous: 'Toutes les stations du module Méduse — debout ou en panne.',
  },
  {
    id: 'energie',
    nom: 'ÉNERGIE',
    icone: '⚡',
    teinte: '#ffd977',
    sous: 'Ce qui alimente le module : la lumière, les primes du retour.',
  },
  {
    id: 'consoles',
    nom: 'CONSOLES',
    icone: '▣',
    teinte: '#63b7e6',
    sous: 'Les écrans du poste. En panne, ils s’éteignent et leur pupitre se tait.',
  },
  {
    id: 'acces',
    nom: 'ACCÈS',
    icone: '⛨',
    teinte: '#b48cff',
    sous: 'Les ailes qu’une porte d’énergie condamne tant que la station est en panne.',
  },
]

export function secteur(id: string): Secteur {
  return SECTEURS.find((s) => s.id === id) ?? SECTEURS[0]
}

/** Le secteur d'une station, déduit de ce que sa panne fait — la porte
 *  d'abord : une aile condamnée est un accès, même si elle éteint aussi
 *  des écrans. */
export function secteurDe(r: ReparationDef): Exclude<SecteurId, 'tout'> {
  if (r.porte) return 'acces'
  if (r.eteintEcrans) return 'consoles'
  return 'energie'
}

/** L'état d'une station face aux registres : rétablie, ou en panne — et
 *  alors payable au plot, ou pas encore (le solde ne suffit pas). */
export type EtatStation = 'retablie' | 'payable' | 'solde-court'

export interface StationVue {
  id: string
  secteur: Exclude<SecteurId, 'tout'>
  /** le rang dans le catalogue, à partir de 1 — « STATION N° 03 » */
  rang: number
  icone: string
  nom: string
  detail: string
  prix: number // en mémoire
  etat: EtatStation
  /** ce que la panne fait au module, ligne par ligne (déduit des drapeaux) */
  effets: string[]
}

/** Ce que l'écran lit des registres — un instantané, pas les registres. */
export interface EtatAvaries {
  memoire: number
  /** les réparations déjà payées (ids) */
  faites: readonly string[]
}

/** Ce que la panne fait, dans les mots du joueur — une ligne par drapeau
 *  de reparations.ts, et une ligne générique quand la station n'en porte
 *  aucun (le distillateur : son service est suspendu, sans plus). */
export function effetsPanne(r: ReparationDef): string[] {
  const out: string[] = []
  if (r.assombrit) out.push('Tout le module s’assombrit : les lumières faiblissent, la brume de panne monte.')
  if (r.eteintEcrans) out.push('Les écrans de la station sont éteints, et sa console ne s’ouvre plus.')
  if (r.porte) out.push('Une porte d’énergie condamne l’aile : on n’y entre pas.')
  if (out.length === 0) out.push('Son service est suspendu tant que la station n’est pas rétablie.')
  return out
}

function etatDe(r: ReparationDef, s: EtatAvaries): EtatStation {
  if (s.faites.includes(r.id)) return 'retablie'
  return s.memoire >= r.prix ? 'payable' : 'solde-court'
}

/** Toutes les stations du catalogue, lues face aux registres, dans
 *  l'ordre du catalogue (c'est aussi l'ordre des plots du module). */
export function stations(s: EtatAvaries): StationVue[] {
  return REPARATIONS.map((r, i) => ({
    id: r.id,
    secteur: secteurDe(r),
    rang: i + 1,
    icone: r.icone,
    nom: r.nom,
    detail: r.detail,
    prix: r.prix,
    etat: etatDe(r, s),
    effets: effetsPanne(r),
  }))
}

export function stationsDuSecteur(id: SecteurId, s: EtatAvaries): StationVue[] {
  const toutes = stations(s)
  return id === 'tout' ? toutes : toutes.filter((st) => st.secteur === id)
}

export function retablie(st: StationVue): boolean {
  return st.etat === 'retablie'
}

export type FiltreAvaries = 'toutes' | 'pannes' | 'retablies'

export const FILTRES_AVARIES: readonly [FiltreAvaries, string][] = [
  ['toutes', 'TOUTES'],
  ['pannes', 'EN PANNE'],
  ['retablies', 'RÉTABLIES'],
]

export function filtre(liste: readonly StationVue[], f: FiltreAvaries): StationVue[] {
  return liste.filter((st) => (f === 'toutes' ? true : f === 'pannes' ? !retablie(st) : retablie(st)))
}

export function filtreSuivant(f: FiltreAvaries): FiltreAvaries {
  const i = FILTRES_AVARIES.findIndex(([id]) => id === f)
  return FILTRES_AVARIES[(i + 1) % FILTRES_AVARIES.length][0]
}

/** Le mot de l'état d'une station — le badge de sa carte. */
export function badge(st: StationVue): string {
  switch (st.etat) {
    case 'retablie':
      return 'RÉTABLIE'
    case 'payable':
      return 'EN PANNE'
    case 'solde-court':
      return 'EN PANNE · SOLDE COURT'
  }
}

/** La ligne du bas d'une carte : où l'on en est, en deux mots. */
export function etatCourt(st: StationVue): string {
  switch (st.etat) {
    case 'retablie':
      return 'DEBOUT'
    case 'payable':
      return 'PAYABLE AU PLOT'
    case 'solde-court':
      return 'SOLDE COURT'
  }
}

export function libellePrix(prix: number): string {
  return `${prix} MÉMOIRE`
}

/** Le solde après la réparation, ou ce qui manque. */
export function apresReparation(st: StationVue, memoire: number): string {
  if (retablie(st)) return 'rien à payer'
  const reste = memoire - st.prix
  return reste >= 0 ? `reste ${reste} mémoire` : `manque ${-reste} mémoire`
}

/** La consigne de la fiche — ce que dirait le bouton d'une boutique, sauf
 *  qu'ici on ne paie pas : on dit où aller. */
export function consigne(st: StationVue, memoire: number): { titre: string; note: string } {
  switch (st.etat) {
    case 'retablie':
      return { titre: '✓ STATION RÉTABLIE', note: 'Le service est rendu. Rien à payer.' }
    case 'payable':
      return {
        titre: `RÉPARER AU PLOT — ${libellePrix(st.prix)}`,
        note: 'Posez le corps sur le plot de la station, dans le module : la mémoire se débite au contact.',
      }
    case 'solde-court':
      return {
        titre: `SOLDE COURT — MANQUE ${st.prix - memoire} MÉMOIRE`,
        note: 'La mémoire se gagne en descendant, et à chaque fiche du codex découverte.',
      }
  }
}

/** Le compte d'un secteur sur le rail : « 1 / 3 rétablies ». */
export function compteSecteur(liste: readonly StationVue[]): string {
  const n = liste.filter(retablie).length
  return `${n} / ${liste.length} rétablie${n > 1 ? 's' : ''}`
}

/** La part rétablie d'une liste, de 0 à 1 — l'anneau du rail. */
export function partRetablie(liste: readonly StationVue[]): number {
  return liste.length ? liste.filter(retablie).length / liste.length : 0
}

/** L'illustration d'une station : assets/avaries/<id>.webp — absente,
 *  l'écran garde le glyphe (public/assets/avaries/LISEZ-MOI.md). */
export function imageDe(id: string): string {
  return `/assets/avaries/${id}.webp`
}
