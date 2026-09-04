// L'ATELIER DES RÉCOMPENSES : fabriquer une carte sans écrire une ligne.
//
// Le catalogue livré (instruments.ts) et les cartes FABRIQUÉES vivent côte
// à côte : même forme, même grammaire d'effets, même chemin dans le jeu.
// Une carte d'atelier n'est pas une maquette — elle se tire au hasard, elle
// s'emporte, elle agit, exactement comme une carte gravée dans le code.
// Ce qui les sépare tient en un drapeau (`perso`) et en un lieu de rangement.
// Les cartes du POSTE sont le BROUILLON du concepteur ; les cartes PUBLIÉES
// (magasin partagé, /api/reglages) jouent pour tout le monde. Un joueur ne
// fabrique rien : il joue les publiées ; un concepteur joue son brouillon
// s'il en a un, sinon les publiées — comme le plan de la descente. Graver
// dans le code (exporter, coller dans instruments.ts) reste possible : c'est
// le filet, plus la seule voie.

import {
  INSTRUMENTS,
  type InstrumentDef,
  descriptionInstrument,
} from './instruments'
import { levierDef, type Effet } from './leviers'

const CLE = 'projet21.recompenses.v1'

function stockage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null // navigation privée, stockage refusé : l'atelier reste en RAM
  }
}

let perso: InstrumentDef[] | null = null

/** Les cartes fabriquées sur ce poste. Lues une fois, gardées en mémoire. */
export function recompensesPerso(): InstrumentDef[] {
  if (perso) return perso
  perso = []
  try {
    const brut = stockage()?.getItem(CLE)
    if (brut) {
      const d = JSON.parse(brut)
      if (Array.isArray(d)) perso = d.map(nettoie).filter((x) => x !== null)
    }
  } catch {
    perso = [] // registre illisible : l'atelier repart vide, le jeu tourne
  }
  return perso
}

// ---- LES PUBLIÉES, ET CE QUI SE JOUE -----------------------------------------

let publiees: InstrumentDef[] | null = null // null : rien de publié, ou pas lu
let concepteur = false

/** Le mode concepteur décide si le brouillon du poste prime. */
export function poseConcepteurRecompenses(on: boolean): void {
  concepteur = on
}

/** Pose les cartes publiées (le document du magasin) — null les retire. */
export function poseRecompensesPubliees(brut: unknown): InstrumentDef[] | null {
  const liste = (brut && typeof brut === 'object' ? (brut as { cartes?: unknown }).cartes : null) ?? brut
  publiees = Array.isArray(liste) ? (liste.map(nettoie).filter((x) => x !== null) as InstrumentDef[]) : null
  return publiees
}

export function recompensesPubliees(): InstrumentDef[] | null {
  return publiees
}

/** Le brouillon du poste est-il ce qui se joue ici ? Oui tant que rien
 *  n'est publié (rien ne change pour un poste hors-ligne), et pour un
 *  concepteur qui a des cartes en atelier. */
export function brouillonRecompensesActif(): boolean {
  return publiees === null || (concepteur && recompensesPerso().length > 0)
}

/** Les cartes JOUÉES au-delà des livrées : le brouillon s'il prime, sinon
 *  les publiées. */
export function recompensesJouees(): InstrumentDef[] {
  return brouillonRecompensesActif() ? recompensesPerso() : (publiees ?? [])
}

/** Le document à publier : les cartes du poste, telles quelles. */
export function documentRecompenses(): { cartes: InstrumentDef[] } {
  return { cartes: recompensesPerso().map((c) => ({ ...c, effets: c.effets.map((e) => ({ ...e })) })) }
}

/** Reprend les publiées comme brouillon (le poste repart de ce qui joue). */
export function reprendRecompensesPubliees(): number {
  perso = (publiees ?? []).map((c) => ({ ...c, effets: c.effets.map((e) => ({ ...e })) }))
  ecrit()
  return perso.length
}

/** Le catalogue COMPLET : les cartes livrées, puis celles qui se jouent. */
export function catalogueRecompenses(): InstrumentDef[] {
  return [...INSTRUMENTS, ...recompensesJouees()]
}

function ecrit(): void {
  try {
    stockage()?.setItem(CLE, JSON.stringify(recompensesPerso()))
  } catch {
    // plein ou refusé : la carte vit pour la session, on ne perd pas la main
  }
}

/** Remet une carte lue du stockage dans les clous — ou la refuse. */
function nettoie(x: unknown): InstrumentDef | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const effets = Array.isArray(o.effets)
    ? (o.effets as Record<string, unknown>[])
        .map((e) => ({
          levier: String(e.levier),
          valeur: Number(e.valeur),
        }))
        .filter((e) => levierDef(e.levier) && Number.isFinite(e.valeur))
    : []
  if (typeof o.id !== 'string' || !o.id || effets.length === 0) return null
  return {
    id: o.id,
    nom: typeof o.nom === 'string' && o.nom ? o.nom : o.id,
    desc: typeof o.desc === 'string' ? o.desc : '',
    icone: typeof o.icone === 'string' && o.icone ? o.icone : '✦',
    effets: effets as Effet[],
    perso: true,
  }
}

/** Un identifiant tiré du nom : lisible dans un fichier, stable à l'œil. */
export function idDepuisNom(nom: string): string {
  const base = nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return base || 'carte'
}

/**
 * Les refus, dits en clair — l'atelier explique, il ne se contente pas de
 * griser un bouton. Une carte qui passe ici est jouable telle quelle.
 */
export function valideRecompense(
  d: Partial<InstrumentDef>,
  idOrigine?: string,
): string[] {
  const refus: string[] = []
  const nom = (d.nom ?? '').trim()
  if (nom.length < 3) refus.push('Il faut un nom d’au moins trois lettres.')
  const icone = (d.icone ?? '').trim()
  if (!icone) refus.push('Il faut une icône : la carte se reconnaît au glyphe.')
  const effets = d.effets ?? []
  if (effets.length === 0)
    refus.push('Une carte sans effet ne récompense rien : ajoutez un levier.')
  const vus = new Set<string>()
  for (const e of effets) {
    const l = levierDef(e.levier)
    if (!l) {
      refus.push(`Levier inconnu : ${e.levier}.`)
      continue
    }
    if (vus.has(e.levier))
      refus.push(`Le levier « ${l.nom} » est posé deux fois sur la même carte.`)
    vus.add(e.levier)
    if (!Number.isFinite(e.valeur) || e.valeur < l.min || e.valeur > l.max)
      refus.push(
        `« ${l.nom} » se règle entre ${l.min} et ${l.max} (reçu ${e.valeur}).`,
      )
    const neutre = l.mode === 'mult' ? 1 : 0
    if (e.valeur === neutre)
      refus.push(`« ${l.nom} » à sa valeur neutre ne fait rien.`)
  }
  // l'unicité, sur TOUT le catalogue : un identifiant ou une icône en double
  // rendrait deux cartes indiscernables une fois embarquées
  const autres = catalogueRecompenses().filter((c) => c.id !== idOrigine)
  if (d.id && autres.some((c) => c.id === d.id))
    refus.push('Une carte porte déjà cet identifiant.')
  if (icone && autres.some((c) => c.icone === icone))
    refus.push(`L’icône ${icone} est déjà prise par « ${autres.find((c) => c.icone === icone)?.nom} ».`)
  return refus
}

/** Fabrique ou remplace une carte. Retourne les refus (vide = enregistrée). */
export function poseRecompense(
  d: Partial<InstrumentDef>,
  idOrigine?: string,
): string[] {
  const id = d.id || idDepuisNom(d.nom ?? '')
  const carte: InstrumentDef = {
    id,
    nom: (d.nom ?? '').trim(),
    desc: (d.desc ?? '').trim(),
    icone: (d.icone ?? '').trim(),
    effets: (d.effets ?? []).map((e) => ({ ...e })),
    perso: true,
  }
  const refus = valideRecompense(carte, idOrigine)
  if (refus.length > 0) return refus
  const liste = recompensesPerso()
  const i = liste.findIndex((c) => c.id === (idOrigine ?? id))
  if (i >= 0) liste[i] = carte
  else liste.push(carte)
  ecrit()
  return []
}

export function retireRecompense(id: string): boolean {
  const liste = recompensesPerso()
  const i = liste.findIndex((c) => c.id === id)
  if (i < 0) return false
  liste.splice(i, 1)
  ecrit()
  return true
}

/** Le JSON de l'atelier : ce qu'on colle dans instruments.ts pour graver. */
export function exporteRecompenses(): string {
  return JSON.stringify(
    recompensesPerso().map((c) => ({
      id: c.id,
      nom: c.nom,
      desc: descriptionInstrument(c),
      icone: c.icone,
      effets: c.effets,
    })),
    null,
    2,
  )
}

/** Reprend un export. Retourne le nombre de cartes reçues, ou -1 si illisible. */
export function importeRecompenses(texte: string): number {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return -1
  }
  if (!Array.isArray(brut)) return -1
  let n = 0
  for (const x of brut) {
    const c = nettoie(x)
    if (!c) continue
    if (poseRecompense(c, c.id).length === 0) n++
  }
  return n
}

/** Remet l'atelier à zéro (les cartes livrées ne bougent pas). */
export function videAtelier(): void {
  perso = []
  ecrit()
}
