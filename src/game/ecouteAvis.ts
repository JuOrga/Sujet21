// L'AVIS SUR UNE MUSIQUE — ce que les concepteurs pensent d'une piste de
// l'écoute, PARTAGÉ. L'écoute fait entendre les lits et leurs candidates
// dans un ordre tiré au sort ; au fil des pistes, chacun veut poser un
// verdict simple — celle-ci est bien, celle-là on n'en veut pas — et
// retrouver, à la prochaine ouverture et sur n'importe quel poste, le sien
// et celui des autres. Trois positions, comme demandé : +1, −1, ou neutre.
//
// UN AVIS PAR PERSONNE ET PAR PISTE, et le TOTAL en face : « +2 −1 » se lit
// d'un coup d'œil, et on voit qui pense quoi. La personne, c'est le nom de
// la borne (celui des records) — sans nom, « anonyme », et tous les
// anonymes ne font qu'un : c'est le prix d'un nom qu'on n'a pas donné. Le
// NEUTRE n'est pas une valeur rangée : c'est l'absence d'entrée — se
// remettre au neutre retire SON avis et rien d'autre, et un document neuf
// n'a d'avis sur rien.
//
// Le document vit dans le magasin des réglages partagés (/api/reglages,
// domaine « ecoute »). Le serveur n'en connaît pas la forme : ce module la
// relit et la ramène dans ses bornes — seules les pistes que l'écoute
// connaît comptent (un avis sur un fichier disparu ne survit pas), seuls
// +1 et −1 sont des avis, un auteur est un mot court et non vide.

import { PISTES_ECOUTE, type PisteEcoute } from './jukebox'

export type Avis = 1 | -1

export interface AvisPose {
  avis: Avis
  date: string
}

export interface DocumentAvis {
  /** par nom de fichier de la piste (PisteEcoute.fichier), puis par auteur */
  avis: Record<string, Record<string, AvisPose>>
}

export const AUTEUR_MAX = 40

/** Le nom sous lequel un avis se range : un mot court, jamais vide. */
export function auteurAvis(brut: string): string {
  return brut.trim().slice(0, AUTEUR_MAX) || 'anonyme'
}

function avisDeBrut(brut: unknown): Avis | null {
  return brut === 1 || brut === -1 ? brut : null
}

/**
 * Le document tel qu'il arrive (magasin, ou rien), ramené dans ses bornes :
 * par piste connue, par auteur non vide, +1 ou −1, une date texte. Tout ce
 * qui ne rentre pas est écarté sans bruit — un document d'hier ne casse
 * pas l'écoute d'aujourd'hui.
 */
export function lisAvisEcoute(document: unknown, pistes: readonly PisteEcoute[] = PISTES_ECOUTE): DocumentAvis {
  const objet = (v: unknown): Record<string, unknown> | null =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  const brutes = objet(objet(document)?.avis) ?? {}
  const out: Record<string, Record<string, AvisPose>> = {}
  for (const p of pistes) {
    const parAuteur = objet(brutes[p.fichier])
    if (!parAuteur) continue
    const entrees: Record<string, AvisPose> = {}
    for (const [nom, e] of Object.entries(parAuteur)) {
      const r = objet(e)
      const avis = r ? avisDeBrut(r.avis) : null
      if (avis === null) continue
      const auteur = nom.trim().slice(0, AUTEUR_MAX)
      if (!auteur) continue
      entrees[auteur] = { avis, date: typeof r!.date === 'string' ? r!.date : '' }
    }
    if (Object.keys(entrees).length > 0) out[p.fichier] = entrees
  }
  return { avis: out }
}

/** L'avis d'une personne sur une piste : +1, −1, ou 0 au neutre. */
export function avisDe(doc: DocumentAvis, fichier: string, auteur: string): Avis | 0 {
  return doc.avis[fichier]?.[auteurAvis(auteur)]?.avis ?? 0
}

/**
 * Pose l'avis d'une personne — et rend un document NEUF, l'ancien n'est
 * pas touché (le lecteur garde l'ancien tant que le magasin n'a pas
 * répondu). `0` la remet au neutre : son entrée disparaît, celles des
 * autres restent.
 */
export function poseAvis(
  doc: DocumentAvis,
  fichier: string,
  avis: Avis | 0,
  auteur: string,
  date: string,
): DocumentAvis {
  const nom = auteurAvis(auteur)
  const entrees = { ...(doc.avis[fichier] ?? {}) }
  if (avis === 0) delete entrees[nom]
  else entrees[nom] = { avis, date }
  const out = { ...doc.avis }
  if (Object.keys(entrees).length === 0) delete out[fichier]
  else out[fichier] = entrees
  return { avis: out }
}

export interface TotalAvis {
  pour: number
  contre: number
  /** pour − contre */
  total: number
}

/** Le décompte d'une piste : combien pour, combien contre, et la somme. */
export function totalDe(doc: DocumentAvis, fichier: string): TotalAvis {
  let pour = 0
  let contre = 0
  for (const e of Object.values(doc.avis[fichier] ?? {})) {
    if (e.avis === 1) pour++
    else contre++
  }
  return { pour, contre, total: pour - contre }
}

/** Le bilan de toutes les pistes, pour la ligne d'attente du lecteur : une
 *  piste est RETENUE si sa somme est positive, ÉCARTÉE si elle est négative,
 *  PARTAGÉE si des avis se neutralisent — les autres sont sans avis. */
export function bilanAvis(doc: DocumentAvis): { retenues: number; ecartees: number; partagees: number } {
  const b = { retenues: 0, ecartees: 0, partagees: 0 }
  for (const fichier of Object.keys(doc.avis)) {
    const { total } = totalDe(doc, fichier)
    if (total > 0) b.retenues++
    else if (total < 0) b.ecartees++
    else b.partagees++
  }
  return b
}

/** Deux documents disent-ils les mêmes avis ? (les dates ne comptent pas) */
export function memesAvis(a: DocumentAvis, b: DocumentAvis): boolean {
  const plat = (d: DocumentAvis): string =>
    Object.keys(d.avis)
      .sort()
      .map((f) =>
        `${f}:${Object.keys(d.avis[f])
          .sort()
          .map((n) => `${n}=${d.avis[f][n].avis}`)
          .join(',')}`,
      )
      .join(';')
  return plat(a) === plat(b)
}

function signe(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0'
}

/** Ce que le titre dit de la piste en cours : la somme, puis qui pense
 *  quoi — « +1 · JULIEN +1, MARIE +1, PAUL −1 » — ou rien au neutre. */
export function ligneAvis(doc: DocumentAvis, fichier: string): string {
  const entrees = doc.avis[fichier]
  if (!entrees) return ''
  const qui = Object.keys(entrees)
    .sort((a, b) => entrees[b].avis - entrees[a].avis || a.localeCompare(b))
    .map((n) => `${n} ${signe(entrees[n].avis)}`)
    .join(', ')
  return `${signe(totalDe(doc, fichier).total)} · ${qui}`
}

/** Ce que le titre dit à l'arrêt : le bilan, s'il y a le moindre avis. */
export function ligneBilan(doc: DocumentAvis): string {
  const { retenues, ecartees, partagees } = bilanAvis(doc)
  const s = (n: number) => (n > 1 ? 's' : '')
  const parts: string[] = []
  if (retenues > 0) parts.push(`${retenues} retenue${s(retenues)}`)
  if (ecartees > 0) parts.push(`${ecartees} écartée${s(ecartees)}`)
  if (partagees > 0) parts.push(`${partagees} partagée${s(partagees)}`)
  return parts.join(', ')
}
