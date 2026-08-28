// LA VOIE SEMI-PROCÉDURALE : le PLAN DE DESCENTE — le cycle de vie complet
// d'une run, début · milieu · fin, jouable de bout en bout avec la seule
// génération procédurale. Le plan est PARAMÉTRABLE (banc de réglage) :
//   · longueur : le nombre de salles de la descente — la voie se BOUCLE au
//     bout, que la séquence écrite soit longue, courte ou vide ;
//   · diffMax  : la difficulté atteinte en fin de descente — la rampe monte
//     de 0 au départ jusqu'à ce plafond, linéairement ;
//   · graineDuJour : la DESCENTE DU JOUR — les salles générées sont les
//     mêmes pour tout le monde ce jour-là (la graine vient de la date), le
//     palmarès se compare entre postes.
// Le moment (début/milieu/fin) se calcule par tiers de la longueur, comme
// la phase de run du pool (poule.ts).

import { phaseRun } from './poule'
import { FAMILLES_OPT } from './generateur'
import type { CodeAtelier } from './levelIO'

export interface PlanVoie {
  longueur: number
  diffMax: number
  graineDuJour: boolean
}

export const PLAN_VOIE_DEFAUTS: PlanVoie = {
  longueur: 12,
  diffMax: 3,
  graineDuJour: false,
}

/** Ramène un plan (chargé du stockage, ou réglé au banc) dans les bornes. */
export function clampPlanVoie(p: Partial<PlanVoie> | null): PlanVoie {
  const n = (v: unknown, d: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : d
  return {
    longueur: Math.max(
      3,
      Math.min(40, Math.round(n(p?.longueur, PLAN_VOIE_DEFAUTS.longueur))),
    ),
    diffMax: Math.max(
      0,
      Math.min(9, Math.round(n(p?.diffMax, PLAN_VOIE_DEFAUTS.diffMax))),
    ),
    graineDuJour: p?.graineDuJour === true,
  }
}

/** Le MOMENT du rang (1-based) dans le plan : par tiers de la longueur. */
export function momentAuRang(
  rang: number,
  plan: PlanVoie,
): CodeAtelier['moment'] {
  return phaseRun(rang, plan.longueur)
}

/** La DIFFICULTÉ du rang : la rampe en DENTS DE SCIE, pas en pente.
 *  · l'enveloppe monte de 0 (rang 1) au SOMMET diffMax — placé à
 *    l'AVANT-DERNIER rang : le pic se joue juste avant la fin ;
 *  · un rang sur trois creuse une RESPIRATION (−1 sous l'enveloppe) —
 *    la tension se mesure à ses relâchements ;
 *  · le DERNIER rang est une victoire à prendre, pas un mur : nettement
 *    sous le sommet (60 % du plafond) — le joueur sort sur une réussite. */
export function diffAuRang(rang: number, plan: PlanVoie): number {
  const r = Math.max(1, rang)
  const borne = (v: number): number => Math.max(0, Math.min(9, v))
  if (r >= plan.longueur) return borne(Math.round(plan.diffMax * 0.6))
  const sommet = Math.max(2, plan.longueur - 1)
  const t = Math.min(1, (r - 1) / Math.max(1, sommet - 1))
  let d = Math.round(t * plan.diffMax)
  if (r % 3 === 0 && r < sommet) d -= 1 // la respiration
  return borne(d)
}

// ---- Le RÉGLAGE DU RANG : enseigner, éprouver, tordre --------------------
// Au-delà du chiffre de difficulté, le rang commande la POSTURE de la
// salle générée :
//   · le DÉBUT enseigne — la leçon est PURE (les familles de maillons se
//     resserrent sur la mécanique de la salle) et les deux premiers rangs
//     sont SANS danger : une nouveauté à la fois, d'abord la mécanique ;
//   · le MILIEU éprouve — un rang sur deux prend l'esprit labyrinthe :
//     la même mécanique, la structure qui se tord ;
//   · la FIN tord la lecture — un rang sur deux passe en éclairage
//     contrasté : la même mécanique, dans la pénombre sculptée.
// Deux rangs consécutifs ne se ressemblent donc jamais tout à fait — la
// foulée varie, et tout voyage dans le code de la salle (suffixe ~).

export interface ReglageRang {
  dangers: 0 | 1
  laby: 0 | 2
  contraste: 0 | 1
  /** moment 1 : la leçon pure — familles resserrées sur la mécanique */
  purete: boolean
}

export function reglageAuRang(rang: number, plan: PlanVoie): ReglageRang {
  const m = momentAuRang(rang, plan)
  return {
    dangers: rang <= 2 ? 1 : 0,
    laby: m === 2 && rang % 2 === 0 ? 2 : 0,
    contraste: m === 3 && rang % 2 === 1 && rang < plan.longueur ? 1 : 0,
    purete: m === 1,
  }
}

/** Le MASQUE de familles d'une mécanique (bits de FAMILLES_OPT) — la
 * leçon pure du début : la salle ne parle que sa propre langue. */
export function masqueMecanique(mec: CodeAtelier['mecanique']): number {
  const noms: Record<number, readonly string[]> = {
    0: ['membrane'],
    1: ['rideau', 'porte', 'et'],
    2: ['grille', 'rail', 'nor'],
    3: [],
  }
  const familles = noms[mec]
  if (familles.length === 0) return 127
  let masque = 0
  for (const n of familles) {
    const bit = FAMILLES_OPT.indexOf(n as (typeof FAMILLES_OPT)[number])
    if (bit >= 0) masque |= 1 << bit
  }
  return masque || 127
}

/** Les MÉCANIQUES que les mémoires tissées permettent : la glace (1)
 * demande la SOLIDIFICATION au bouton, la vapeur (2) la VAPORISATION,
 * « toutes » (3) les deux. La 0 (aucune) reste toujours ouverte — la
 * descente ne propose jamais une salle qui exige un lien non tissé. */
export function mecaniquesPermises(
  solidification: boolean,
  vaporisation: boolean,
): CodeAtelier['mecanique'][] {
  const permises: CodeAtelier['mecanique'][] = [0]
  if (solidification) permises.push(1)
  if (vaporisation) permises.push(2)
  if (solidification && vaporisation) permises.push(3)
  return permises
}

/** Le masque de FAMILLES de maillons permis par les mémoires : les
 * maillons glaceux (rideau, porte, et) et vaporeux (grille, rail, nor)
 * disparaissent tant que leur lien manuel n'est pas tissé — la membrane
 * (l'eau) reste toujours. */
export function masquePermis(
  solidification: boolean,
  vaporisation: boolean,
): number {
  let masque = 0
  for (const [nom, permis] of [
    ['membrane', true],
    ['rideau', solidification],
    ['porte', solidification],
    ['et', solidification],
    ['grille', vaporisation],
    ['rail', vaporisation],
    ['nor', vaporisation],
  ] as const) {
    if (permis) masque |= 1 << FAMILLES_OPT.indexOf(nom)
  }
  return masque
}

/** Hachage FNV-1a 32 bits : stable, sans dépendance — la graine du jour. */
export function hachage(txt: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** La VARIANTE du rang pour la descente du jour : la même pour tous les
 * postes le même jour, différente à chaque rang et chaque jour. */
export function varianteDuJour(jourIso: string, rang: number): string {
  return (hachage(`${jourIso}#${rang}`) % 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')
}

/** TROIS MÉCANIQUES distinctes pour les cartes du choix — la première
 * évite celle de la salle écrite (si elle existe) pour que le choix
 * parle, ET celle de la salle qu'on vient de jouer (la foulée varie)
 * quand c'est possible sans vider le chapeau. Le chapeau lui-même se
 * restreint aux mécaniques PERMISES par les mémoires : s'il en reste
 * moins de trois, les cartes répètent (trois salles, mêmes mécaniques,
 * variantes différentes) plutôt que d'exiger un lien non tissé. */
export function mecaniquesDuChoix(
  exclue: number | null,
  alea: () => number,
  eviter: number | null = null,
  permises: readonly CodeAtelier['mecanique'][] = [0, 1, 2, 3],
): [
  CodeAtelier['mecanique'],
  CodeAtelier['mecanique'],
  CodeAtelier['mecanique'],
] {
  const toutes = permises.length > 0 ? permises : ([0] as const)
  let candidates = toutes.filter((m) => m !== exclue && m !== eviter)
  if (candidates.length === 0) candidates = toutes.filter((m) => m !== exclue)
  if (candidates.length === 0) candidates = [...toutes]
  const tire = (liste: readonly CodeAtelier['mecanique'][]) =>
    liste[Math.floor(alea() * liste.length)]
  const a = tire(candidates)
  const restantes = toutes.filter((m) => m !== a)
  const b = restantes.length > 0 ? tire(restantes) : tire(toutes)
  const dernieres = toutes.filter((m) => m !== a && m !== b)
  const c = dernieres.length > 0 ? tire(dernieres) : tire(toutes)
  return [a, b, c]
}

// ---- Le PALMARÈS de la voie : ce qui donne envie de redescendre ----------
// Par poste (localStorage, la clé est gérée par l'appelant) : combien de
// descentes entamées, combien BOUCLÉES, la profondeur record, le meilleur
// volume livré sur une voie bouclée.

export interface PalmaresVoie {
  descentes: number
  bouclees: number
  profondeurRecord: number
  meilleurLivre: number
}

export const PALMARES_VOIE_VIERGE: PalmaresVoie = {
  descentes: 0,
  bouclees: 0,
  profondeurRecord: 0,
  meilleurLivre: 0,
}

export function litPalmaresVoie(brut: string | null): PalmaresVoie {
  try {
    const o = JSON.parse(brut ?? '{}') as Partial<PalmaresVoie>
    const n = (v: unknown): number =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
    return {
      descentes: Math.round(n(o.descentes)),
      bouclees: Math.round(n(o.bouclees)),
      profondeurRecord: Math.round(n(o.profondeurRecord)),
      meilleurLivre: n(o.meilleurLivre),
    }
  } catch {
    return { ...PALMARES_VOIE_VIERGE }
  }
}
