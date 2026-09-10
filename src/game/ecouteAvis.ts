// L'AVIS SUR UNE MUSIQUE — ce que le concepteur pense d'une piste de
// l'écoute, PARTAGÉ. L'écoute fait entendre les lits et leurs candidates
// dans un ordre tiré au sort ; au fil des pistes, le concepteur veut poser
// un verdict simple — celle-ci est bien, celle-là on n'en veut pas — et le
// retrouver à la prochaine ouverture, sur n'importe quel poste. Trois
// positions, comme demandé : +1, −1, ou neutre.
//
// UN VERDICT PAR PISTE, le dernier fait foi, signé de son auteur et daté :
// ce n'est pas un vote à dépouiller, c'est une note de tri qu'on pose et
// qu'on peut reprendre. Le NEUTRE n'est pas une valeur rangée : c'est
// l'absence d'entrée — remettre une piste au neutre retire sa ligne, et un
// document neuf n'a d'avis sur rien.
//
// Le document vit dans le magasin des réglages partagés (/api/reglages,
// domaine « ecoute »). Le serveur n'en connaît pas la forme : ce module la
// relit et la ramène dans ses bornes — seules les pistes que l'écoute
// connaît comptent (un avis sur un fichier disparu ne survit pas), seuls
// +1 et −1 sont des avis, l'auteur est un mot court.

import { PISTES_ECOUTE, type PisteEcoute } from './jukebox'

export type Avis = 1 | -1

export interface AvisPiste {
  avis: Avis
  auteur: string
  date: string
}

export interface DocumentAvis {
  /** par nom de fichier de la piste (PisteEcoute.fichier) */
  avis: Record<string, AvisPiste>
}

const AUTEUR_MAX = 40

function avisDeBrut(brut: unknown): Avis | null {
  return brut === 1 || brut === -1 ? brut : null
}

/**
 * Le document tel qu'il arrive (magasin, ou rien), ramené dans ses bornes :
 * une entrée par piste connue, +1 ou −1, un auteur court, une date texte.
 * Tout ce qui ne rentre pas est écarté sans bruit — un document d'hier ne
 * casse pas l'écoute d'aujourd'hui.
 */
export function lisAvisEcoute(document: unknown, pistes: readonly PisteEcoute[] = PISTES_ECOUTE): DocumentAvis {
  const o = (typeof document === 'object' && document !== null ? document : {}) as Record<string, unknown>
  const brutes = (typeof o.avis === 'object' && o.avis !== null && !Array.isArray(o.avis) ? o.avis : {}) as Record<string, unknown>
  const out: Record<string, AvisPiste> = {}
  for (const p of pistes) {
    const e = brutes[p.fichier]
    if (typeof e !== 'object' || e === null) continue
    const r = e as Record<string, unknown>
    const avis = avisDeBrut(r.avis)
    if (avis === null) continue
    out[p.fichier] = {
      avis,
      auteur: typeof r.auteur === 'string' ? r.auteur.trim().slice(0, AUTEUR_MAX) : '',
      date: typeof r.date === 'string' ? r.date : '',
    }
  }
  return { avis: out }
}

/** L'avis posé sur une piste, ou null : neutre. */
export function avisDe(doc: DocumentAvis, fichier: string): AvisPiste | null {
  return doc.avis[fichier] ?? null
}

/**
 * Pose un avis — et rend un document NEUF, l'ancien n'est pas touché (le
 * lecteur garde l'ancien tant que le magasin n'a pas répondu). `0` remet
 * la piste au neutre : sa ligne disparaît.
 */
export function poseAvis(
  doc: DocumentAvis,
  fichier: string,
  avis: Avis | 0,
  auteur: string,
  date: string,
): DocumentAvis {
  const out: Record<string, AvisPiste> = { ...doc.avis }
  if (avis === 0) delete out[fichier]
  else out[fichier] = { avis, auteur: auteur.trim().slice(0, AUTEUR_MAX), date }
  return { avis: out }
}

/** Le compte, pour la ligne d'attente du lecteur : combien de retenues,
 *  combien d'écartées — le reste est sans avis. */
export function bilanAvis(doc: DocumentAvis): { retenues: number; ecartees: number } {
  let retenues = 0
  let ecartees = 0
  for (const e of Object.values(doc.avis)) {
    if (e.avis === 1) retenues++
    else ecartees++
  }
  return { retenues, ecartees }
}

/** Deux documents disent-ils les mêmes avis ? (comparés dans leurs bornes) */
export function memesAvis(a: DocumentAvis, b: DocumentAvis): boolean {
  const cles = (d: DocumentAvis) => Object.keys(d.avis).sort()
  const ka = cles(a)
  const kb = cles(b)
  if (ka.length !== kb.length) return false
  return ka.every((k, i) => k === kb[i] && a.avis[k].avis === b.avis[k].avis)
}

/** Ce que le titre dit de la piste en cours : « retenue par JULIEN »,
 *  « écartée par JULIEN », ou rien au neutre. */
export function ligneAvis(a: AvisPiste | null): string {
  if (!a) return ''
  return `${a.avis === 1 ? 'retenue' : 'écartée'} par ${a.auteur || 'anonyme'}`
}

/** Ce que le titre dit à l'arrêt : le bilan, s'il y a le moindre avis. */
export function ligneBilan(doc: DocumentAvis): string {
  const { retenues, ecartees } = bilanAvis(doc)
  if (retenues === 0 && ecartees === 0) return ''
  const s = (n: number) => (n > 1 ? 's' : '')
  return `${retenues} retenue${s(retenues)}, ${ecartees} écartée${s(ecartees)}`
}
