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
  cheminLePlusCourt,
  estHalte,
  liensDepuis,
  moduleParId,
  moduleRevele,
  orbeRequis,
  plusCourtVers,
  REVELATIONS,
  type CarteStation,
  type LienCarte,
  type ModuleCarte,
  type TypeModule,
} from './carteStation'
import { TRANSFOS_CYCLE, transfoTenue } from './cycle'
import type { OptionsGen } from './generateur'

/** Où en est la run sur la carte. */
export interface EtatCarteRun {
  /** le module où l'on joue */
  module: string
  /** les salles déjà FRANCHIES dans ce module */
  niveau: number
  /** les modules traversés, dans l'ordre */
  visites: string[]
  /** LES RÉVÉLATIONS : la nature tirée pour chaque module « ? » entré —
   *  par id. Écrite dans la sauvegarde : un « ? » révélé ne se retire pas. */
  revelations: Record<string, TypeModule>
  /** LA MINI-CARTE À VOIES du module (voiesModule.ts) : la graine de son
   *  tissage — vide : pas de voies (un outil, une carte d'avant) — et la
   *  voie ouverte à chaque salle, dans l'ordre. */
  tissage: string
  trace: number[]
  /** LA GRAINE DE LA RUN : celle dont dérive le tissage de CHAQUE module
   *  (`graine@module`), tirée au départ — la descente du jour donne la
   *  date. C'est ce qui permet de tisser un module AVANT d'y entrer, pour
   *  dire au survol ce qu'on y trouvera. Vide : d'avant, ou un outil. */
  graineRun: string
}

/** La graine du tissage d'un module, dérivée de celle de la run. */
export function graineModule(e: EtatCarteRun, id: string): string {
  return e.graineRun ? `${e.graineRun}@${id}` : ''
}

export function departCarte(c: CarteStation): EtatCarteRun {
  return { module: c.regles.depart, niveau: 0, visites: [], revelations: {}, tissage: '', trace: [], graineRun: '' }
}

/** OUVRIR UNE PORTE de la mini-carte : la voie choisie pour la salle qui
 *  vient s'ajoute à la trace — la salle suivante ne s'ouvrira que depuis
 *  ce nœud. */
export function choisitVoie(e: EtatCarteRun, voie: number): EtatCarteRun {
  return { ...e, trace: [...e.trace.slice(0, e.niveau), Math.max(0, Math.floor(voie))] }
}

/** La voie d'où l'on vient pour la salle `niveau` : null au premier rang,
 *  ou quand la trace n'en sait rien (sauvegarde d'avant les voies). */
export function derniereVoie(e: EtatCarteRun): number | null {
  if (e.niveau === 0) return null
  const v = e.trace[e.niveau - 1]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** LE MODULE TEL QU'IL SE JOUE : un « ? » révélé prend sa nature tirée
 *  (moduleRevele) ; tout autre module est lui-même. */
export function moduleEffectif(c: CarteStation, e: EtatCarteRun, m: ModuleCarte | undefined): ModuleCarte | undefined {
  if (!m) return undefined
  const nature = e.revelations[m.id]
  return m.type === 'inconnu' && nature ? moduleRevele(c, m, nature) : m
}

/** Le module où l'on joue, révélé s'il y a lieu : c'est lui que lisent
 *  moduleFini, niveauxRestants et la posture des salles. */
export function moduleCourant(c: CarteStation, e: EtatCarteRun): ModuleCarte | undefined {
  return moduleEffectif(c, e, moduleParId(c, e.module))
}

/** RÉVÉLER UN « ? » : sa nature se tire parmi REVELATIONS au premier
 *  passage, et se grave dans l'état de la run. Un module déjà révélé, ou
 *  qui n'est pas un « ? », rend l'état tel quel. `alea` vient de l'appelant :
 *  la descente du jour tire le même « ? » pour tous les postes. */
export function reveleInconnu(
  c: CarteStation,
  e: EtatCarteRun,
  id: string,
  alea: () => number,
): EtatCarteRun {
  const m = moduleParId(c, id)
  if (!m || m.type !== 'inconnu' || e.revelations[id]) return e
  const nature = REVELATIONS[Math.min(REVELATIONS.length - 1, Math.floor(alea() * REVELATIONS.length))]
  return { ...e, revelations: { ...e.revelations, [id]: nature } }
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
  /** REVENIR SUR SES PAS : pas une coursive de la carte, le chemin du
   *  retour — offert seulement quand l'objectif est hors de portée d'ici */
  retour: boolean
}

/** LE MODULE D'OÙ L'ON VIENT : le dernier traversé qui mène ici par une
 *  coursive. Pas simplement le dernier de la liste — au retour d'une cache,
 *  le dernier traversé EST la cache, et l'on ne va pas y retourner. */
export function moduleDOuLOnVient(c: CarteStation, e: EtatCarteRun): ModuleCarte | undefined {
  for (let i = e.visites.length - 1; i >= 0; i--) {
    const id = e.visites[i]
    if (id === e.module) continue
    if (c.liens.some((l) => l.de === id && l.vers === e.module)) return moduleParId(c, id)
  }
  return undefined
}

/** Les modules au bout d'une coursive partant d'ici, ouverts ou non — et,
 *  quand l'objectif est HORS DE PORTÉE d'ici (une cache, un cul-de-sac),
 *  le retour vers le module d'où l'on vient. Une cache est un détour, pas
 *  un piège : la run ne s'y arrête pas (revue du 03/09 — un joueur entré
 *  dans S1b n'avait plus aucune porte, sauvegarde comprise). */
export function choixModules(
  c: CarteStation,
  e: EtatCarteRun,
  orbes: readonly string[],
): ChoixModule[] {
  const out: ChoixModule[] = []
  for (const lien of liensDepuis(c, e.module)) {
    const module = moduleParId(c, lien.vers)
    if (!module) continue
    out.push({ module, lien, orbeManquant: orbeRequis(c, lien, orbes), retour: false })
  }
  if (e.module !== c.regles.objectif && plusCourtVers(c, e.module, c.regles.objectif) === null) {
    const prec = moduleDOuLOnVient(c, e)
    if (prec && !out.some((x) => x.module.id === prec.id))
      out.push({
        module: prec,
        lien: { de: e.module, vers: prec.id, type: 'retour' },
        orbeManquant: null,
        retour: true,
      })
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
  tissage = '',
): EtatCarteRun | null {
  const choix = choixModules(c, e, orbes).find((x) => x.module.id === id)
  if (!choix || choix.orbeManquant) return null
  // UN MODULE TRAVERSÉ EST ÉPUISÉ POUR LA RUN — au retour sur ses pas, et
  // tout autant par une coursive ordinaire : sur une carte qui boucle, un
  // joueur rentrait dans un secteur déjà joué et en rejouait les salles
  // (et leur mémoire). La carte se rouvre aussitôt sur ses coursives.
  const dejaTraverse = choix.retour || e.visites.includes(id)
  const niveau = dejaTraverse ? Math.max(0, choix.module.niveaux) : 0
  return {
    module: id,
    niveau,
    visites: [...e.visites, e.module],
    revelations: e.revelations,
    // la graine du module : celle donnée, sinon dérivée de la run
    tissage: tissage || graineModule(e, id),
    trace: [],
    graineRun: e.graineRun,
  }
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
  // les révélations d'une sauvegarde : seules celles d'un « ? » encore sur
  // la carte, vers une nature qui existe — le reste se retirera à l'entrée
  const revelations: Record<string, TypeModule> = {}
  if (typeof o.revelations === 'object' && o.revelations !== null)
    for (const [id, nature] of Object.entries(o.revelations as Record<string, unknown>))
      if (moduleParId(c, id)?.type === 'inconnu' && REVELATIONS.includes(nature as TypeModule))
        revelations[id] = nature as TypeModule
  const tissage = typeof o.tissage === 'string' ? o.tissage : ''
  const trace = Array.isArray(o.trace)
    ? o.trace.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).map((v) => Math.max(0, Math.floor(v)))
    : []
  const graineRun = typeof o.graineRun === 'string' ? o.graineRun : ''
  return { module: o.module, niveau, visites, revelations, tissage, trace, graineRun }
}

// ---- LA NATURE DU MODULE COMMANDE LA SALLE -------------------------------
// Sur le plan, la nature (combat, énigme, cache) n'était qu'un glyphe : la
// pioche tirait la même salle sous n'importe quel fût. Un nœud typé n'a de
// sens que s'il tient sa promesse — c'est ce qui fait qu'un joueur de Slay
// the Spire choisit sa route en lisant les icônes. Ici la nature POSE la
// salle générée : ses dangers, ses faisceaux, sa cachette.

/** LA POSTURE DU MODULE : ce que sa nature impose aux options du
 *  générateur, par-dessus le réglage du rang.
 *  · COMBAT — les dangers sont FRÉQUENTS (sauf les premiers rangs sans
 *    danger, qui restent la leçon du début), aucune énigme au faisceau ;
 *  · ÉNIGME — aucun danger, une énigme au faisceau garde le passage ;
 *  · CACHE — la cachette est toujours là : c'est ce qu'on vient chercher ;
 *  · le reste (le terminal, un module d'avant les natures) — l'auto. */
export function postureDuModule(
  m: ModuleCarte | undefined,
  sansDanger: boolean,
): Partial<OptionsGen> {
  switch (m?.type) {
    case 'combat':
      return { dangers: sansDanger ? 1 : 3, mecanismes: 1 }
    case 'enigme':
      return { dangers: 1, mecanismes: 2 }
    case 'coffre':
      return { cachette: 2 }
    default:
      return {}
  }
}

/** LA DIFFICULTÉ SOUS CONFINEMENT : la rampe du plan, plus le cran du
 *  module — borné à 9, le plafond de la nomenclature atelier. */
export function difficulteSousCran(difficulte: number, m: ModuleCarte | undefined): number {
  return Math.max(0, Math.min(9, Math.round(difficulte) + Math.max(0, m?.cran ?? 0)))
}

/** LA PRIME DE MÉMOIRE d'un module : « plus difficile, plus généreux » —
 *  la mémoire gravée au sas de ses salles se multiplie par 1 + cran. */
export function primeMemoire(m: ModuleCarte | undefined): number {
  return 1 + Math.max(0, m?.cran ?? 0)
}

/** LE CLIMAT DU MODULE : sa température pose le climat des dangers des
 *  salles générées — sous 10 °C le froid (hublots fendus), dès 45 °C le
 *  chaud (chaudières), entre les deux l'auto. Une route froide se joue en
 *  glace, une route chaude en vapeur : deux joueurs aux mémoires
 *  différentes ne prennent plus la même route. */
export function climatDuModule(m: ModuleCarte | undefined): OptionsGen['climat'] {
  if (!m) return 0
  return m.temp < 10 ? 1 : m.temp >= 45 ? 2 : 0
}

// ---- L'ALCÔVE DE REPOS -----------------------------------------------------
// Une halte de la carte, un choix — comme le feu de camp de Slay the Spire
// oppose soigner et améliorer. Trois offres, une seule se prend : le
// souffle (une vie, la survie), la réserve (la bonbonne, la livraison), le
// condensat (la bourse, l'achat). Puis la carte se rouvre.

export const REPOS_RESERVE_L = 0.5
export const REPOS_CONDENSAT_CL = 40

export interface OffreRepos {
  id: 'souffle' | 'reserve' | 'condensat'
  nom: string
  detail: string
  icone: string
  /** false : l'offre ne peut rien donner (vies au plafond, bonbonne pleine) */
  possible: boolean
}

/** Les trois offres de l'alcôve, jugées sur ce que la run possède : une
 *  offre qui ne donnerait rien se montre grisée — le choix reste lisible,
 *  il ne ment pas. */
export function offresRepos(run: {
  vies: number
  viesMax: number
  bonbonne: number
  cap: number
}): OffreRepos[] {
  return [
    {
      id: 'souffle',
      nom: 'SECOND SOUFFLE',
      detail: run.vies < run.viesMax ? '+1 échantillon de secours' : 'échantillons au plafond',
      icone: '💠',
      possible: run.vies < run.viesMax,
    },
    {
      id: 'reserve',
      nom: 'RÉSERVE',
      detail: run.bonbonne < run.cap ? `+${REPOS_RESERVE_L.toFixed(1).replace('.', ',')} L en bonbonne` : 'bonbonne pleine',
      icone: '🫙',
      possible: run.bonbonne < run.cap,
    },
    {
      id: 'condensat',
      nom: 'CONDENSAT',
      detail: `+${REPOS_CONDENSAT_CL} cL dans la bourse`,
      icone: '💧',
      possible: true,
    },
  ]
}

// ---- LE SURVOL QUI PROJETTE ------------------------------------------------
// Compter les étages avant le boss est le geste réflexe du joueur de Slay
// the Spire. Ici, survoler un module projette la route la plus courte
// qui en part jusqu'à l'objectif : combien de salles, quels arrêts, quels
// confinements — la fiche le dit, le dessin l'allume.

export interface ProjectionRoute {
  /** la suite des modules, du module survolé à l'objectif */
  chemin: string[]
  /** les salles à jouer, module survolé compris */
  salles: number
  /** les arrêts sur la route (haltes et caches), par leur nom */
  arrets: string[]
  /** la somme des crans de confinement sur la route */
  crans: number
  /** ce qui s'ouvre JUSTE APRÈS le module survolé, par leur nom — c'est là
   *  que deux portes voisines se distinguent quand leurs routes se
   *  rejoignent ensuite */
  prochains: string[]
}

/** La route la plus courte depuis un module jusqu'à l'objectif, mesurée.
 *  Null : l'objectif est hors de portée d'ici (un cul-de-sac). */
export function projectionDepuis(c: CarteStation, id: string): ProjectionRoute | null {
  const chemin = cheminLePlusCourt(c, id, c.regles.objectif)
  if (!chemin) return null
  const modules = chemin.map((m) => moduleParId(c, m)).filter((m): m is ModuleCarte => !!m)
  return {
    chemin,
    salles: modules.reduce((t, m) => t + Math.max(0, m.niveaux), 0),
    arrets: modules.filter((m) => estHalte(m) || m.type === 'coffre').map((m) => m.nom),
    crans: modules.reduce((t, m) => t + Math.max(0, m.cran), 0),
    prochains: liensDepuis(c, id)
      .map((l) => moduleParId(c, l.vers))
      .filter((m): m is ModuleCarte => !!m)
      .map((m) => m.nom),
  }
}

/** La projection en une ligne, pour la fiche de la carte. */
export function ditProjection(c: CarteStation, p: ProjectionRoute): string {
  const objectif = moduleParId(c, c.regles.objectif)?.nom ?? c.regles.objectif
  // LES PROCHAINS d'abord : trois transformateurs mènent aux mêmes
  // profondeurs, et la route la plus courte se confondait d'une porte à
  // l'autre (revue du 16/09) — ce qui les distingue, c'est ce qu'ils
  // ouvrent tout de suite après, et le reste ne vient qu'ensuite
  const prochains = p.prochains.filter((n) => n !== objectif) // « ensuite l'objectif » ne dit rien
  const puis = prochains.length > 0 ? ` · ensuite ${prochains.join(' ou ')}` : ''
  return (
    `par ici : ${p.salles} salle${p.salles > 1 ? 's' : ''} jusqu’à ${objectif}` +
    puis +
    (p.arrets.length ? ` · ${p.arrets.join(', ')}` : '') +
    (p.crans > 0 ? ` · confinement +${p.crans} sur la route` : '')
  )
}

/** LE DON — une bonbonne oubliée : de la réserve s'il y a de la place,
 *  sinon du condensat. Une seule offre, on la prend, la carte se rouvre. */
export function offreDon(run: { bonbonne: number; cap: number }): OffreRepos {
  const [, reserve, condensat] = offresRepos({ vies: 0, viesMax: 1, bonbonne: run.bonbonne, cap: run.cap })
  return reserve.possible
    ? { ...reserve, nom: 'UNE BONBONNE OUBLIÉE' }
    : { ...condensat, nom: 'UN FÛT DE CONDENSAT' }
}
