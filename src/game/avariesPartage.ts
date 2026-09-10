// LES AVARIES DU MODULE, PARTAGÉES. Le tableau des avaries — l'écran du
// centre de contrôle — lisait un catalogue gravé dans le code : sept
// stations, leurs prix, leurs pannes. Un concepteur qui trouvait la
// passerelle trop chère à 60 mémoire n'avait qu'une voie : rouvrir le
// dépôt. Désormais LA RÉGIE les règle, et le document PUBLIÉ joue pour
// tout le monde — le catalogue du code reste le filet.
//
// CE QUI SE RÈGLE : le nom, la ligne du toast, le pictogramme, le prix en
// mémoire, les trois effets de la panne, l'ordre du tableau, et si la
// station fait encore partie de l'accident.
//
// CE QUI NE SE RÈGLE PAS : l'IDENTITÉ des stations. Un id est une clé
// structurelle — le plot du hub le nomme (zonesDuHub), l'ancre de
// l'éditeur le choisit dans une liste fermée, la sauvegarde le garde une
// fois la réparation payée. En inventer un depuis la régie donnerait une
// avarie sans plot : une panne que personne ne peut réparer. Un id inconnu
// est donc écarté à la lecture, et un id livré absent du document revient
// tel qu'il est livré — un document d'hier ne fait pas disparaître en
// silence une station d'aujourd'hui.

import { REPARATIONS, type ReparationDef } from './reparations'

export interface FicheAvarie {
  id: string
  nom: string
  detail: string
  icone: string
  prix: number
  /** en panne, les écrans et les pupitres du plot s'éteignent */
  eteintEcrans: boolean
  /** en panne, tout le module s'assombrit et la brume monte */
  assombrit: boolean
  /** en panne, une porte d'énergie condamne l'aile */
  porte: boolean
  /**
   * La station fait-elle partie de l'accident ? Retirée, elle n'est jamais
   * en panne : le module la donne debout d'emblée, sans rien à payer, et
   * elle quitte le tableau des avaries.
   */
  enAvarie: boolean
}

export interface DocumentAvaries {
  stations: FicheAvarie[]
}

export type SourceAvaries = 'brouillon' | 'publie' | 'livre'

export const PRIX_MAX = 999
const NOM_MAX = 40
const DETAIL_MAX = 120

function ficheDe(r: ReparationDef): FicheAvarie {
  return {
    id: r.id,
    nom: r.nom,
    detail: r.detail,
    icone: r.icone,
    prix: r.prix,
    eteintEcrans: r.eteintEcrans === true,
    assombrit: r.assombrit === true,
    porte: r.porte === true,
    enAvarie: true,
  }
}

/** Le catalogue du code, en fiches réglables — l'état livré, le filet. */
export const AVARIES_LIVREES: readonly FicheAvarie[] = REPARATIONS.map(ficheDe)

function livree(id: string): FicheAvarie | null {
  return AVARIES_LIVREES.find((f) => f.id === id) ?? null
}

function mot(brut: unknown, defaut: string, max: number): string {
  if (typeof brut !== 'string') return defaut
  const t = brut.trim().slice(0, max)
  return t || defaut
}

/** Le pictogramme : deux signes au plus — un emoji compte pour un, d'où
 *  le découpage par points de code (une paire de substitution coupée en
 *  deux ne s'affiche pas). */
function picto(brut: unknown, defaut: string): string {
  if (typeof brut !== 'string') return defaut
  const t = [...brut.trim()].slice(0, 2).join('')
  return t || defaut
}

function prixDe(brut: unknown, defaut: number): number {
  const n = Math.round(Number(brut))
  return Number.isFinite(n) ? Math.max(0, Math.min(PRIX_MAX, n)) : defaut
}

function drapeau(brut: unknown, defaut: boolean): boolean {
  return typeof brut === 'boolean' ? brut : defaut
}

function lisFiche(brut: unknown, base: FicheAvarie): FicheAvarie {
  const o = (brut ?? {}) as Record<string, unknown>
  return {
    id: base.id,
    nom: mot(o.nom, base.nom, NOM_MAX),
    detail: mot(o.detail, base.detail, DETAIL_MAX),
    icone: picto(o.icone, base.icone),
    prix: prixDe(o.prix, base.prix),
    eteintEcrans: drapeau(o.eteintEcrans, base.eteintEcrans),
    assombrit: drapeau(o.assombrit, base.assombrit),
    porte: drapeau(o.porte, base.porte),
    enAvarie: drapeau(o.enAvarie, base.enAvarie),
  }
}

/**
 * Le document tel qu'il arrive (magasin ou brouillon de poste), ramené
 * dans ses bornes : TOUTES les stations livrées, dans l'ordre du document
 * — les ids inconnus écartés, les ids manquants rendus à la fin tels
 * qu'ils sont livrés.
 */
export function lisAvaries(document: unknown): FicheAvarie[] {
  const o = (typeof document === 'object' && document !== null ? document : {}) as Record<string, unknown>
  const brutes = Array.isArray(o.stations) ? o.stations : []
  const out: FicheAvarie[] = []
  const vues = new Set<string>()
  for (const brut of brutes) {
    const id = typeof (brut as { id?: unknown })?.id === 'string' ? ((brut as { id: string }).id) : ''
    const base = livree(id)
    if (!base || vues.has(id)) continue // inconnue, ou dite deux fois
    vues.add(id)
    out.push(lisFiche(brut, base))
  }
  for (const f of AVARIES_LIVREES) if (!vues.has(f.id)) out.push({ ...f })
  return out
}

/** Ce qu'on publie : le document du magasin, à partir des fiches réglées. */
export function documentAvaries(fiches: readonly FicheAvarie[]): DocumentAvaries {
  return { stations: lisAvaries({ stations: fiches }) }
}

/**
 * Le catalogue que le jeu joue : les stations EN AVARIE, dans l'ordre des
 * fiches. Les pancartes cachées (labelsCaches) restent celles du code —
 * ce sont des clés de signalétique, pas un réglage.
 */
export function catalogueAvaries(fiches: readonly FicheAvarie[]): ReparationDef[] {
  const out: ReparationDef[] = []
  for (const f of lisAvaries({ stations: fiches })) {
    if (!f.enAvarie) continue
    const base = REPARATIONS.find((r) => r.id === f.id)
    if (!base) continue
    out.push({
      id: f.id,
      nom: f.nom,
      detail: f.detail,
      icone: f.icone,
      prix: f.prix,
      labelsCaches: base.labelsCaches,
      ...(f.eteintEcrans ? { eteintEcrans: true } : {}),
      ...(f.assombrit ? { assombrit: true } : {}),
      ...(f.porte ? { porte: true } : {}),
    })
  }
  return out
}

/** Deux réglages disent-ils les mêmes avaries ? (comparés dans leurs bornes) */
export function memesAvaries(a: readonly FicheAvarie[] | null, b: readonly FicheAvarie[] | null): boolean {
  if (a === null || b === null) return a === b
  return JSON.stringify(documentAvaries(a)) === JSON.stringify(documentAvaries(b))
}

/**
 * QUI JOUE QUELLES AVARIES au démarrage — la même règle que le plan de la
 * descente (planPartage.ts) : un JOUEUR joue le publié, sinon le livré (un
 * brouillon qui traînerait sur son poste ne compte pas) ; un CONCEPTEUR
 * joue son brouillon s'il en a un — il est en train de régler.
 */
export function avariesAuDemarrage(entree: {
  brouillon: readonly FicheAvarie[] | null
  publie: readonly FicheAvarie[] | null
  concepteur: boolean
}): { fiches: FicheAvarie[]; source: SourceAvaries } {
  if (entree.concepteur && entree.brouillon) return { fiches: lisAvaries({ stations: entree.brouillon }), source: 'brouillon' }
  if (entree.publie) return { fiches: lisAvaries({ stations: entree.publie }), source: 'publie' }
  return { fiches: lisAvaries(null), source: 'livre' }
}

/** Ce que l'écran affiche : d'où viennent les avaries qui jouent ici. */
export function etatAvaries(entree: {
  courant: readonly FicheAvarie[]
  publie: readonly FicheAvarie[] | null
}): { source: SourceAvaries; identiqueAuPublie: boolean; identiqueAuLivre: boolean } {
  const identiqueAuPublie = entree.publie !== null && memesAvaries(entree.courant, entree.publie)
  const identiqueAuLivre = memesAvaries(entree.courant, AVARIES_LIVREES)
  const source: SourceAvaries = identiqueAuPublie ? 'publie' : entree.publie === null && identiqueAuLivre ? 'livre' : 'brouillon'
  return { source, identiqueAuPublie, identiqueAuLivre }
}
