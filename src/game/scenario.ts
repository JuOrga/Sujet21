// LE SCÉNARIO : le fil narratif du jeu, hors tableaux.
//
// Les cinématiques ancrées aux TABLEAUX vivent dans leurs données
// (cineAvant/cineApres, zones déclencheuses). Restent les moments qui
// n'appartiennent à aucun tableau : l'arrivée au hub, le lancement d'une
// run, une défaite, une expédition achevée. C'est le scénario — UN seul,
// global au jeu (décision du concepteur), partagé avec les cinématiques.
//
// Une LISTE DE RÈGLES ordonnées, PREMIER MATCH GAGNE : les règles
// spécifiques en haut, la générique en bas. Chaque règle peut être
// « une seule fois » — indispensable en roguelike : l'ouverture ne se
// rejoue pas au deuxième run.

export type MomentScenario =
  | 'premier-lancement'
  | 'avant-hub'
  | 'lancement-run'
  | 'run-perdue'
  | 'expedition-achevee'

export const MOMENTS: MomentScenario[] = [
  'premier-lancement',
  'avant-hub',
  'lancement-run',
  'run-perdue',
  'expedition-achevee',
]

export const MOMENT_NOMS: Record<MomentScenario, string> = {
  'premier-lancement': 'Au tout premier lancement du jeu',
  'avant-hub': 'À l’arrivée au hub',
  'lancement-run': 'Au lancement de la run (sas du hub)',
  'run-perdue': 'Quand la run est perdue',
  'expedition-achevee': 'Quand l’expédition est achevée',
}

// Les conditions puisent dans ce que le jeu mémorise DÉJÀ : rien à
// inventer, rien à tenir à jour en double.
export type ConditionScenario =
  | 'toujours'
  | 'premiere-partie'
  | 'runs-min'
  | 'salle-min'
  | 'trophee'
  | 'condensat-min'
  | 'decouvertes-min'

export const CONDITIONS: ConditionScenario[] = [
  'toujours',
  'premiere-partie',
  'runs-min',
  'salle-min',
  'trophee',
  'condensat-min',
  'decouvertes-min',
]

export const CONDITION_NOMS: Record<ConditionScenario, string> = {
  toujours: 'toujours',
  'premiere-partie': 'première partie (aucune run finie)',
  'runs-min': 'runs finies ≥ N',
  'salle-min': 'meilleure salle atteinte ≥ N',
  trophee: 'trophée débloqué',
  'condensat-min': 'condensat ≥ N',
  'decouvertes-min': 'jalons du récit servis ≥ N',
}

/** La condition a-t-elle besoin du seuil N ? (l'éditeur masque le reste) */
export function conditionAValeur(c: ConditionScenario): boolean {
  return (
    c === 'runs-min' ||
    c === 'salle-min' ||
    c === 'condensat-min' ||
    c === 'decouvertes-min'
  )
}

export interface RegleScenario {
  id: string // stable : c'est LUI que « une seule fois » mémorise
  moment: MomentScenario
  condition: ConditionScenario
  valeur: number // seuil des conditions ≥ N
  trophee: string // identifiant du trophée (condition « trophee »)
  cine: string // le code de la cinématique à jouer
  uneFois: boolean
  actif: boolean // décochée : la règle dort sans être perdue
}

export interface ScenarioDef {
  regles: RegleScenario[]
}

/** L'état du jeu au moment d'évaluer — fourni par l'appelant, jamais lu
 *  ici : ce module reste pur et testable. */
export interface EtatScenario {
  runs: number // runs terminées
  salleMax: number // meilleure salle atteinte
  condensat: number
  decouvertes: number // jalons du récit déjà servis
  trophee: (id: string) => boolean
}

export function regleVierge(id: string): RegleScenario {
  return {
    id,
    moment: 'avant-hub',
    condition: 'toujours',
    valeur: 1,
    trophee: '',
    cine: '',
    uneFois: true,
    actif: true,
  }
}

export function scenarioVierge(): ScenarioDef {
  return { regles: [] }
}

/** Un identifiant que rien d'autre ne porte — la mémoire « déjà vue »
 *  s'appuie dessus, il ne doit jamais être réattribué. */
export function idLibre(s: ScenarioDef): string {
  let n = 1
  const pris = new Set(s.regles.map((r) => r.id))
  while (pris.has(`r${n}`)) n++
  return `r${n}`
}

function conditionRemplie(r: RegleScenario, etat: EtatScenario): boolean {
  switch (r.condition) {
    case 'toujours':
      return true
    case 'premiere-partie':
      return etat.runs <= 0
    case 'runs-min':
      return etat.runs >= r.valeur
    case 'salle-min':
      return etat.salleMax >= r.valeur
    case 'condensat-min':
      return etat.condensat >= r.valeur
    case 'decouvertes-min':
      return etat.decouvertes >= r.valeur
    case 'trophee':
      return !!r.trophee && etat.trophee(r.trophee)
    default:
      return false
  }
}

/**
 * La règle qui s'applique à ce moment — PREMIER MATCH GAGNE. Sont écartées
 * les règles éteintes, celles sans cinématique, et les « une seule fois »
 * déjà vues.
 */
export function choisitRegle(
  scenario: ScenarioDef,
  moment: MomentScenario,
  etat: EtatScenario,
  vues: ReadonlySet<string>,
): RegleScenario | null {
  for (const r of scenario.regles) {
    if (!r.actif || r.moment !== moment || !r.cine) continue
    if (r.uneFois && vues.has(r.id)) continue
    if (conditionRemplie(r, etat)) return r
  }
  return null
}

// ---- IO : parse tolérant (même contrat que levelIO et cinematique — une
// règle corrompue est écartée, jamais le scénario entier).

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function parseRegle(o: unknown, secours: string): RegleScenario | null {
  if (typeof o !== 'object' || o === null) return null
  const raw = o as Record<string, unknown>
  const r = regleVierge(str(raw.id).trim().slice(0, 24) || secours)
  const moment = str(raw.moment)
  if (moment && (MOMENTS as string[]).includes(moment)) r.moment = moment as MomentScenario
  const condition = str(raw.condition)
  if (condition && (CONDITIONS as string[]).includes(condition)) {
    r.condition = condition as ConditionScenario
  }
  if (typeof raw.valeur === 'number' && Number.isFinite(raw.valeur)) {
    r.valeur = Math.max(0, Math.min(999, Math.round(raw.valeur)))
  }
  r.trophee = str(raw.trophee).trim().slice(0, 32)
  r.cine = str(raw.cine).trim().slice(0, 24)
  r.uneFois = raw.uneFois !== false
  r.actif = raw.actif !== false
  return r
}

export function parseScenario(obj: unknown): ScenarioDef | null {
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  if (!Array.isArray(o.regles)) return null
  const regles: RegleScenario[] = []
  const pris = new Set<string>()
  for (let i = 0; i < o.regles.length; i++) {
    const r = parseRegle(o.regles[i], `r${i + 1}`)
    if (!r) continue
    // deux règles ne peuvent pas partager un id : la mémoire « déjà vue »
    // confondrait les deux
    if (pris.has(r.id)) r.id = `${r.id}-${i + 1}`
    pris.add(r.id)
    regles.push(r)
  }
  return { regles }
}

export function serializeScenario(s: ScenarioDef): string {
  return JSON.stringify(s, null, 2)
}

// ---- La réserve locale : le scénario du poste et la mémoire des règles
// déjà jouées. La mémoire est DURABLE (c'est tout l'intérêt du « une seule
// fois ») ; elle se vide avec la réinitialisation du protocole.

const CLE_SCENARIO = 'sujet21-scenario-v1'
const CLE_VUES = 'sujet21-scenario-vues-v1'

// ─── LE SCÉNARIO LIVRÉ : les règles embarquées dans le code — le filet
// sous la bibliothèque partagée. Sans lui, une installation fraîche n'a
// AUCUNE règle (et la bibliothèque arrive souvent après le clic LANCER) :
// l'ouverture ne se jouait jamais. Ids préfixés « livre- » : ils ne
// heurtent ni idLibre ni les règles publiées.
export const SCENARIO_LIVRE: ScenarioDef = {
  regles: [
    {
      id: 'livre-ouverture',
      moment: 'premier-lancement',
      condition: 'toujours',
      valeur: 0,
      trophee: '',
      cine: 'ESSAI', // la cuve, l'alerte, la brèche, le sas — l'acte 0
      uneFois: true,
      actif: true,
    },
    {
      id: 'livre-revelation',
      moment: 'avant-hub',
      condition: 'decouvertes-min',
      valeur: 10,
      trophee: '',
      cine: 'REVELATION', // le sceau tombe : la route du télescope
      uneFois: true,
      actif: true,
    },
    {
      id: 'livre-depart',
      moment: 'lancement-run',
      condition: 'premiere-partie',
      valeur: 0,
      trophee: '',
      cine: 'DEPART', // le sas de lancement, la première fois
      uneFois: true,
      actif: true,
    },
  ],
}

/** Le scénario JOUÉ : les règles reçues (bibliothèque ou poste), suivies
 * du filet livré — une règle publiée sous le même id REMPLACE la livrée
 * (le montage garde la main), et l'ordre premier-match est préservé. */
export function avecScenarioLivre(s: ScenarioDef): ScenarioDef {
  const ids = new Set(s.regles.map((r) => r.id))
  return {
    regles: [...s.regles, ...SCENARIO_LIVRE.regles.filter((r) => !ids.has(r.id))],
  }
}

export function chargeScenario(): ScenarioDef {
  try {
    const raw = localStorage.getItem(CLE_SCENARIO)
    if (!raw) return scenarioVierge()
    return parseScenario(JSON.parse(raw) as unknown) ?? scenarioVierge()
  } catch {
    return scenarioVierge()
  }
}

export function sauveScenario(s: ScenarioDef): void {
  try {
    localStorage.setItem(CLE_SCENARIO, JSON.stringify(s))
  } catch {
    // stockage indisponible : le scénario vit le temps de la session
  }
}

export function chargeVues(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(CLE_VUES) ?? '[]') as unknown
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

export function noteVue(id: string): void {
  try {
    const vues = chargeVues()
    vues.add(id)
    localStorage.setItem(CLE_VUES, JSON.stringify([...vues]))
  } catch {
    // sans gravité : la règle se rejouera, elle ne bloquera rien
  }
}

export function oublieVues(): void {
  try {
    localStorage.removeItem(CLE_VUES)
  } catch {
    // sans gravité
  }
}
