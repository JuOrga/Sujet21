// LA RÉCOLTE — ce qu'une salle, puis un module, rapportent VRAIMENT.
//
// La cérémonie de fin de salle montrait le volume livré trois fois (le grand
// chiffre, la ligne « volume », la goutte du versement) et taisait le reste :
// la MÉMOIRE gravée au sas — la seule monnaie qui survit à la purge — ne
// s'affichait nulle part, le condensat annonçait un gain faux sous une salle
// scellée (le doublement de la prime était versé mais pas compté à l'écran),
// et un module traversé rouvrait le plan sans un mot sur ce qu'il avait rendu.
//
// Ce module tient ce qui se DÉCIDE : combien le sas verse, d'où vient chaque
// part, à quoi sert chaque monnaie, ce qu'un module a accumulé. Le spectacle
// (tuiles, compteurs qui roulent) reste dans main.ts et la feuille de style.
// Une seule règle : l'écran ne dit que ce qui a été réellement crédité — le
// même calcul sert au crédit et à l'affichage, ils ne peuvent plus diverger.

import { rangDeSalle, type Rang } from './ceremonie'

/** Un nombre à la française : la virgule, pas le point. */
export function virgule(n: number, decimales = 2): string {
  return n.toFixed(decimales).replace('.', ',')
}

// ---- LE CONDENSAT DU SAS ------------------------------------------------

export interface EntreeCondensat {
  /** le surplus livré, en litres (prime de glace comprise) */
  surplusL: number
  /** le rendement du sas : 1, ou 1,25 sous le FILTRE À CONDENSAT */
  rendement: number
  /** la salle était SCELLÉE à prime de condensat : le sas paie double */
  primeDouble: boolean
  /** les pastilles bues dans la salle — déjà en bourse, comptées au gain */
  pastillesCl: number
}

export interface CondensatDuSas {
  /** ce que le SAS verse maintenant (les pastilles sont déjà en bourse) */
  verse: number
  /** ce que la salle entière a rapporté : le sas, plus les pastilles */
  total: number
  /** d'où vient le total, part par part */
  detail: string
}

/** Le condensat d'une salle. `verse` est ce qu'il faut créditer ; `total`,
 *  ce qu'il faut afficher — la salle scellée double le sas, pas les
 *  pastilles (elles sont bues avant lui). */
export function condensatDuSas(e: EntreeCondensat): CondensatDuSas {
  const livraison = Math.max(0, e.surplusL) * 100
  const rendement = Number.isFinite(e.rendement) && e.rendement > 0 ? e.rendement : 1
  const verse = Math.round(livraison * rendement * (e.primeDouble ? 2 : 1))
  const pastilles = Math.max(0, Math.round(e.pastillesCl))
  const parts = [`livraison ${Math.round(livraison)} cL`]
  if (Math.abs(rendement - 1) > 1e-6) parts.push(`filtre ×${virgule(rendement, 2).replace(/,?0+$/, '')}`)
  if (e.primeDouble) parts.push('salle scellée ×2')
  if (pastilles > 0) parts.push(`pastilles +${pastilles} cL`)
  return { verse, total: verse + pastilles, detail: parts.join(' · ') }
}

// ---- LA MÉMOIRE DU SAS --------------------------------------------------

export interface EntreeMemoire {
  /** la toute première traversée de ce tableau sur ce poste */
  premiereFois: boolean
  /** un record de volume, de chrono, vient de tomber */
  newVolume: boolean
  newChrono: boolean
  /** la part du MUR DES RECORDS réparé (0 s'il est en panne) */
  primeMur: number
  /** le facteur du module : 1 + son cran de confinement, au taux du plan */
  facteurModule: number
  /** la salle était SCELLÉE à prime de mémoire : le sas grave double */
  primeDouble: boolean
}

export interface MemoireDuSas {
  /** ce qu'il faut graver (avant la majoration de la fiole de souvenir) */
  brut: number
  detail: string
}

/** La mémoire qu'un sas grave : +5 la traversée, +5 la première fois, +2
 *  par record (le mur réparé y ajoute sa part), le tout multiplié par le
 *  confinement du module, puis doublé par une salle scellée. */
export function memoireDuSas(e: EntreeMemoire): MemoireDuSas {
  const records = (e.newVolume ? 2 : 0) + (e.newChrono ? 2 : 0) + Math.max(0, e.primeMur)
  const base = 5 + (e.premiereFois ? 5 : 0) + records
  const facteur = Number.isFinite(e.facteurModule) && e.facteurModule > 0 ? e.facteurModule : 1
  const parts = ['traversée +5']
  if (e.premiereFois) parts.push('première fois +5')
  if (records > 0) parts.push(`record +${records}`)
  if (Math.abs(facteur - 1) > 1e-6) parts.push(`confinement ×${virgule(facteur, 2).replace(/,?0+$/, '')}`)
  if (e.primeDouble) parts.push('salle scellée ×2')
  return { brut: base * facteur * (e.primeDouble ? 2 : 1), detail: parts.join(' · ') }
}

// ---- LES TUILES DE LA RÉCOLTE -------------------------------------------

/** Une TUILE de récolte : ce qu'on a gagné, d'où ça vient, à quoi ça sert
 *  et où en est le solde. Tout ce qu'il faut pour ne rien avoir à deviner. */
export interface Gain {
  cle: 'livre' | 'condensat' | 'memoire' | 'maitrise' | 'instruments' | 'tirage' | 'orbe'
  icone: string
  nom: string
  /** le gain en clair, tel qu'il s'écrit : « +450 cL » */
  valeur: string
  /** le nombre que le compteur fait rouler jusqu'à `valeur` (0 : rien ne roule) */
  n: number
  /** le gabarit de `valeur` autour du nombre qui roule */
  prefixe: string
  suffixe: string
  /** À QUOI ÇA SERT — la ligne qui manquait */
  role: string
  /** D'OÙ ÇA VIENT, part par part ('' : rien à détailler) */
  detail: string
  /** le solde après le gain, s'il a un sens */
  solde: { nom: string; valeur: string } | null
}

export const ROLE_CONDENSAT =
  'la bourse de cette descente : elle paie les instruments et l’Économat, puis se purge à la fin'
export const ROLE_MEMOIRE =
  'gravée pour de bon : elle survit à la purge et paie réparations, orbes et améliorations au hub'

export interface EntreeGainsSalle {
  condensat: CondensatDuSas
  /** la bourse APRÈS le versement du sas */
  bourseCl: number
  /** la mémoire RÉELLEMENT gravée (fiole de souvenir comprise) */
  memoire: number
  memoireDetail: string
  /** le solde de mémoire aux registres, après le gain */
  memoireSolde: number
  /** la salle scellée garantit un tirage d'instrument */
  tirageGaranti: boolean
  /** l'orbe rendu par la cache du module, s'il vient d'être pris */
  orbe: string | null
}

/** Les tuiles d'une FIN DE SALLE, dans l'ordre de lecture : la bourse, la
 *  mémoire, puis l'exceptionnel (tirage garanti, orbe). Le surplus n'y est
 *  pas : c'est le grand chiffre du relevé, et le versement en décide. */
export function gainsDeSalle(e: EntreeGainsSalle): Gain[] {
  const gains: Gain[] = [
    {
      cle: 'condensat',
      icone: '◈',
      nom: 'CONDENSAT',
      valeur: `+${e.condensat.total} cL`,
      n: e.condensat.total,
      prefixe: '+',
      suffixe: ' cL',
      role: ROLE_CONDENSAT,
      detail: e.condensat.detail,
      solde: { nom: 'EN BOURSE', valeur: `${Math.round(e.bourseCl)} cL` },
    },
  ]
  // la mémoire se montre dès qu'il y en a — c'est elle qu'on taisait
  if (e.memoire > 0)
    gains.push({
      cle: 'memoire',
      icone: '✦',
      nom: 'MÉMOIRE',
      valeur: `+${Math.round(e.memoire)}`,
      n: Math.round(e.memoire),
      prefixe: '+',
      suffixe: '',
      role: ROLE_MEMOIRE,
      detail: e.memoireDetail,
      solde: { nom: 'AUX REGISTRES', valeur: String(Math.round(e.memoireSolde)) },
    })
  if (e.tirageGaranti)
    gains.push({
      cle: 'tirage',
      icone: '🂠',
      nom: 'TIRAGE GARANTI',
      valeur: '+1 tirage',
      n: 0,
      prefixe: '',
      suffixe: '',
      role: 'la salle était scellée : un tirage d’instrument s’ouvre, quel que soit le versement',
      detail: '',
      solde: null,
    })
  if (e.orbe)
    gains.push({
      cle: 'orbe',
      icone: '🔮',
      nom: 'ORBE D’ESSENCE',
      valeur: e.orbe,
      n: 0,
      prefixe: '',
      suffixe: '',
      role: 'il ouvre les cadenas de la carte, et se tisse au banc des mémoires',
      detail: 'rendu par la cache du module',
      solde: null,
    })
  return gains
}

// ---- LA RÉCOLTE D'UN MODULE ---------------------------------------------

export interface SalleRecoltee {
  code: string
  /** la part du volume de départ livrée (0..1+) : le rang s'en déduit */
  pct: number
  litres: number
}

/** Ce qu'un module a rendu depuis qu'on y est entré. Tenu salle après
 *  salle, écrit avec la sauvegarde de la run : une reprise en plein module
 *  ne perd pas le début de son compte. */
export interface RecolteModule {
  /** l'identifiant du module compté — un autre module, et le compte repart */
  module: string
  salles: SalleRecoltee[]
  /** les nœuds traversés qui ne sont pas des salles : rencontres, haltes, caches */
  haltes: number
  condensatCl: number
  memoire: number
  /** les orbes pris en route, par leur nom */
  orbes: string[]
  /** les instruments tenus À L'ENTRÉE : ce qui s'y ajoute est le butin du module */
  instrumentsEntree: string[]
  /** les paliers de maîtrise atteints à l'entrée */
  paliersEntree: number
}

export function recolteNeuve(
  module: string,
  instruments: readonly string[] = [],
  paliers = 0,
): RecolteModule {
  return {
    module,
    salles: [],
    haltes: 0,
    condensatCl: 0,
    memoire: 0,
    orbes: [],
    instrumentsEntree: instruments.slice(),
    paliersEntree: Math.max(0, Math.round(paliers)),
  }
}

const nombre = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
const textes = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/** LECTURE TOLÉRANTE d'une récolte sauvegardée. Une sauvegarde d'avant ce
 *  compte, abîmée, ou qui parle d'un AUTRE module rend un compte neuf — pris
 *  à l'état présent de la run : le bilan sous-compte alors, il n'invente rien. */
export function litRecolte(
  brut: unknown,
  module: string,
  instruments: readonly string[],
  paliers: number,
): RecolteModule {
  const neuve = recolteNeuve(module, instruments, paliers)
  if (!brut || typeof brut !== 'object') return neuve
  const d = brut as Record<string, unknown>
  if (d.module !== module) return neuve
  const salles = Array.isArray(d.salles)
    ? d.salles
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map((s) => ({
          code: typeof s.code === 'string' ? s.code : '?',
          pct: nombre(s.pct),
          litres: nombre(s.litres),
        }))
    : []
  return {
    module,
    salles,
    haltes: Math.round(nombre(d.haltes)),
    condensatCl: Math.round(nombre(d.condensatCl)),
    memoire: Math.round(nombre(d.memoire)),
    orbes: textes(d.orbes),
    instrumentsEntree: Array.isArray(d.instrumentsEntree) ? textes(d.instrumentsEntree) : neuve.instrumentsEntree,
    paliersEntree: typeof d.paliersEntree === 'number' ? Math.round(nombre(d.paliersEntree)) : neuve.paliersEntree,
  }
}

/** Les instruments gagnés depuis l'entrée : la différence, exemplaire par
 *  exemplaire — une carte déjà tenue qu'on reprend compte, une carte
 *  rendue en route ne fait pas un gain négatif. */
export function instrumentsGagnes(
  entree: readonly string[],
  maintenant: readonly string[],
): string[] {
  const reste = new Map<string, number>()
  for (const id of entree) reste.set(id, (reste.get(id) ?? 0) + 1)
  const gagnes: string[] = []
  for (const id of maintenant) {
    const n = reste.get(id) ?? 0
    if (n > 0) reste.set(id, n - 1)
    else gagnes.push(id)
  }
  return gagnes
}

/** Le total livré dans le module. */
export function litresDuModule(r: RecolteModule): number {
  return r.salles.reduce((s, x) => s + x.litres, 0)
}

export interface EntreeGainsModule {
  recolte: RecolteModule
  /** l'état présent de la run */
  bourseCl: number
  memoireSolde: number
  /** les instruments tenus maintenant (ids), et de quoi les nommer */
  instruments: readonly string[]
  nomInstrument: (id: string) => { icone: string; nom: string } | null
  paliers: number
}

/** Les tuiles d'une FIN DE MODULE : tout ce que la traversée a rendu, du
 *  volume livré à l'orbe — et, quand une ligne est vide, elle le dit (un
 *  module sans instrument n'en cache pas un). */
export function gainsDeModule(e: EntreeGainsModule): Gain[] {
  const r = e.recolte
  const litres = litresDuModule(r)
  const n = r.salles.length
  const gagnes = instrumentsGagnes(r.instrumentsEntree, e.instruments)
    .map((id) => e.nomInstrument(id))
    .filter((x): x is { icone: string; nom: string } => x !== null)
  const paliers = Math.max(0, e.paliers - r.paliersEntree)
  const gains: Gain[] = [
    {
      cle: 'livre',
      icone: '💧',
      nom: 'VOLUME LIVRÉ',
      valeur: `${virgule(litres)} L`,
      n: litres,
      prefixe: '',
      suffixe: ' L',
      role: 'le surplus de chaque sas — versé, à votre choix, dans la réserve ou la maîtrise',
      detail: `${n} salle${n > 1 ? 's' : ''} franchie${n > 1 ? 's' : ''}`,
      solde: null,
    },
    {
      cle: 'condensat',
      icone: '◈',
      nom: 'CONDENSAT',
      valeur: `+${r.condensatCl} cL`,
      n: r.condensatCl,
      prefixe: '+',
      suffixe: ' cL',
      role: ROLE_CONDENSAT,
      detail: '',
      solde: { nom: 'EN BOURSE', valeur: `${Math.round(e.bourseCl)} cL` },
    },
    {
      cle: 'memoire',
      icone: '✦',
      nom: 'MÉMOIRE',
      valeur: `+${r.memoire}`,
      n: r.memoire,
      prefixe: '+',
      suffixe: '',
      role: ROLE_MEMOIRE,
      detail: '',
      solde: { nom: 'AUX REGISTRES', valeur: String(Math.round(e.memoireSolde)) },
    },
    {
      cle: 'maitrise',
      icone: '⬡',
      nom: 'MAÎTRISE',
      valeur: paliers > 0 ? `+${paliers} palier${paliers > 1 ? 's' : ''}` : 'aucun palier',
      n: 0,
      prefixe: '',
      suffixe: '',
      role: 'les litres versés à la maîtrise : chaque palier franchi ouvre un tirage d’instrument',
      detail: '',
      solde: { nom: 'PALIER', valeur: String(Math.max(0, Math.round(e.paliers))) },
    },
    {
      cle: 'instruments',
      icone: '🧰',
      nom: 'INSTRUMENTS',
      valeur: gagnes.length > 0 ? `+${gagnes.length}` : 'aucun',
      n: 0,
      prefixe: '',
      suffixe: '',
      role: 'des avantages pour le reste de la descente — perdus à la purge',
      // le détail finit en infobulle, du texte brut : l'émoji d'un instrument
      // s'y dessinerait autrement selon la machine — son nom suffit
      detail: gagnes.map((g) => g.nom).join(' · '),
      solde: { nom: 'EMBARQUÉS', valeur: String(e.instruments.length) },
    },
  ]
  for (const orbe of r.orbes)
    gains.push({
      cle: 'orbe',
      icone: '🔮',
      nom: 'ORBE D’ESSENCE',
      valeur: orbe,
      n: 0,
      prefixe: '',
      suffixe: '',
      role: 'il ouvre les cadenas de la carte, et se tisse au banc des mémoires',
      detail: '',
      solde: null,
    })
  return gains
}

/** La ligne des salles d'un module : une pastille par salle, à la teinte et
 *  au nom de son régime — le parcours se relit d'un regard. La lettre du
 *  rang choisit le petit sceau de la salle (la case de la planche). */
export function pastillesDeSalles(
  r: RecolteModule,
): { code: string; rang: Rang; nom: string; teinte: string; etoiles: number; litres: string }[] {
  return r.salles.map((s) => {
    const v = rangDeSalle(s.pct)
    return { code: s.code, rang: v.rang, nom: v.nom, teinte: v.teinte, etoiles: v.etoiles, litres: `${virgule(s.litres)} L` }
  })
}
