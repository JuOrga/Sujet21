// LA DESCENTE PILOTÉE PAR LA CARTE : où le sujet en est sur le plan de la
// station, et ce que cela commande.
//
// Avant, la descente était une FILE : douze rangs, un module toutes les n
// salles, la longueur réglée au banc. Le concepteur a tranché (03/09) : un
// module est un BIOME — un ensemble de niveaux —, au bout de ces niveaux la
// carte s'ouvre et le joueur choisit la coursive, et la longueur d'une run
// DÉCOULE du trajet. Ce fichier tient l'état de cette progression et
// répond aux questions PURES que main.ts se pose : le module est-il fini,
// quels modules sont au bout d'une coursive, l'objectif est-il atteint,
// combien de salles fait cette run — sans DOM, sans état global, donc
// testé sans navigateur.
//
// LES ORBES, EN ATTENDANT LES ORBES. Un cadenas de la carte s'ouvre quand
// l'orbe est acquis. La monnaie des orbes (étape 3) n'existe pas encore :
// d'ici là, un orbe est tenu pour acquis quand la transformation qu'il
// nomme est TISSÉE au cycle des mémoires (et un orbe d'état, quand une
// transformation qui y mène l'est). C'est la règle qui vaut déjà pour la
// pioche — « la descente ne propose jamais une salle qui exige une
// transformation non tissée » — appliquée aux coursives.

import {
  liensDepuis,
  moduleParId,
  orbeRequis,
  plusCourtVers,
  type CarteStation,
  type LienCarte,
  type ModuleCarte,
} from './carteStation'
import { TRANSFOS_CYCLE, transfoTenue } from './cycle'

/** Où en est la run sur la carte. */
export interface EtatCarteRun {
  /** le module où l'on joue */
  module: string
  /** les salles déjà FRANCHIES dans ce module */
  niveau: number
  /** les modules traversés, dans l'ordre */
  visites: string[]
}

export function departCarte(c: CarteStation): EtatCarteRun {
  return { module: c.regles.depart, niveau: 0, visites: [] }
}

export function moduleCourant(c: CarteStation, e: EtatCarteRun): ModuleCarte | undefined {
  return moduleParId(c, e.module)
}

/** Le module est-il ÉPUISÉ — toutes ses salles franchies ? Un module
 *  inconnu (carte changée sous une sauvegarde) l'est : on rouvre la carte. */
export function moduleFini(c: CarteStation, e: EtatCarteRun): boolean {
  const m = moduleCourant(c, e)
  return !m || e.niveau >= Math.max(0, m.niveaux)
}

export function niveauxRestants(c: CarteStation, e: EtatCarteRun): number {
  const m = moduleCourant(c, e)
  return m ? Math.max(0, m.niveaux - e.niveau) : 0
}

/** L'objectif est atteint quand on est dans le module objectif ET qu'il
 *  est épuisé : c'est la fin de l'expédition. */
export function objectifAtteint(c: CarteStation, e: EtatCarteRun): boolean {
  return e.module === c.regles.objectif && moduleFini(c, e)
}

/** Une salle de plus franchie dans le module courant. */
export function franchitSalle(e: EtatCarteRun): EtatCarteRun {
  return { ...e, niveau: e.niveau + 1 }
}

export interface ChoixModule {
  module: ModuleCarte
  lien: LienCarte
  /** l'orbe qui manque pour passer — null : la coursive est ouverte */
  orbeManquant: string | null
}

/** Les modules au bout d'une coursive partant d'ici, ouverts ou non. */
export function choixModules(
  c: CarteStation,
  e: EtatCarteRun,
  orbes: readonly string[],
): ChoixModule[] {
  const out: ChoixModule[] = []
  for (const lien of liensDepuis(c, e.module)) {
    const module = moduleParId(c, lien.vers)
    if (!module) continue
    out.push({ module, lien, orbeManquant: orbeRequis(c, lien, orbes) })
  }
  return out
}

/** Entrer dans un module : il faut une coursive ouverte depuis ici. Rend le
 *  nouvel état, ou null si la porte n'existe pas ou reste close. */
export function entreModule(
  c: CarteStation,
  e: EtatCarteRun,
  id: string,
  orbes: readonly string[],
): EtatCarteRun | null {
  const choix = choixModules(c, e, orbes).find((x) => x.module.id === id)
  if (!choix || choix.orbeManquant) return null
  return { module: id, niveau: 0, visites: [...e.visites, e.module] }
}

/** LA LONGUEUR DE LA RUN, déduite du trajet : les salles déjà franchies,
 *  celles qui restent dans le module, et le plus court chemin en niveaux
 *  jusqu'à l'objectif. Elle s'affine à chaque coursive choisie ; elle
 *  n'est jamais plus petite que le rang. Objectif inatteignable d'ici
 *  (cul-de-sac) : il ne reste que le module. */
export function longueurRun(c: CarteStation, e: EtatCarteRun, rang: number): number {
  const reste = niveauxRestants(c, e)
  const loin = plusCourtVers(c, e.module, c.regles.objectif) ?? 0
  return Math.max(1, rang + reste + loin)
}

/** LES ORBES TENUS POUR ACQUIS depuis le cycle des mémoires : chaque
 *  transformation tissée (ou offerte, sauf verrou), et chaque état où l'une
 *  d'elles mène — le liquide toujours, on naît liquide. */
export function orbesDuCycle(acquis: readonly string[], verrous: readonly string[] = []): string[] {
  const out = new Set<string>(['liquide'])
  for (const t of TRANSFOS_CYCLE)
    if (transfoTenue(t.id, acquis, verrous)) {
      out.add(t.id)
      out.add(t.vers)
    }
  return [...out]
}

/** L'état lu d'une sauvegarde — une sauvegarde d'avant la carte, ou qui
 *  cite un module disparu, repart du départ : jamais une run bloquée. */
export function litEtatCarteRun(brut: unknown, c: CarteStation): EtatCarteRun {
  const depart = departCarte(c)
  if (typeof brut !== 'object' || brut === null) return depart
  const o = brut as Record<string, unknown>
  if (typeof o.module !== 'string' || !moduleParId(c, o.module)) return depart
  const niveau = typeof o.niveau === 'number' && Number.isFinite(o.niveau) ? Math.max(0, Math.floor(o.niveau)) : 0
  const visites = Array.isArray(o.visites)
    ? o.visites.filter((v): v is string => typeof v === 'string' && !!moduleParId(c, v))
    : []
  return { module: o.module, niveau, visites }
}
