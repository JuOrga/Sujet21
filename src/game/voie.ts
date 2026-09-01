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

import {
  clampPoidsPioche,
  phaseRun,
  POIDS_PIOCHE_DEFAUTS,
  type PoidsPioche,
} from './poule'
import { FAMILLES_OPT } from './generateur'
import {
  FAMILLES_BOIZ,
  FIGURE_FAMILLES,
  FIGURE_PROFILS,
  optionFigure,
  type FigureFamille,
} from './figures'
import type { CodeAtelier } from './levelIO'

export interface PlanVoie {
  longueur: number
  diffMax: number
  graineDuJour: boolean
  /** LES SALLES GÉNÉRÉES : le seul réglage qui change la nature d'une
   * descente. Actif, chaque récompense met la suite écrite en face de
   * salles fabriquées pour le rang — au joueur de choisir. Inactif, la
   * descente enchaîne la séquence écrite (le choix du pool subsiste).
   * Tout le reste — récompenses, butin, découvertes, palmarès, rail —
   * est COMMUN : il n'y a qu'une seule descente. */
  generees: boolean
  /** LES TABLEAUX ÉCRITS au choix. Actif (l'ordinaire), la pioche du pool
   * pose un tableau fait main face aux salles générées. Coupé alors que
   * `generees` tient, la descente est TOUT PROCÉDURALE : les trois cartes
   * du rang sont fabriquées, aucun tableau écrit ne se propose — le mode
   * d'épreuve du générateur, et la façon de jouer une descente inédite
   * quand la bibliothèque est déjà connue par cœur. */
  ecrites: boolean
  // ---- LA FORME DE LA RAMPE ----------------------------------------------
  // Ces cinq réglages étaient des nombres écrits dans le code de diffAuRang
  // et reglageAuRang. Ce ne sont pas des détails d'implémentation : ce sont
  // les décisions de rythme d'une descente, et le concepteur doit pouvoir
  // les tourner sans recompiler. Les défauts reproduisent AU CHIFFRE PRÈS
  // ce que le code figeait.
  /** de combien de rangs le SOMMET recule depuis la fin (1 = avant-dernier) */
  sommetRecul: number
  /** un rang sur N creuse une RESPIRATION (−1 cran) — 0 : aucune */
  respiration: number
  /** la part du plafond au DERNIER rang, en pourcents (une victoire à prendre) */
  finale: number
  /** les premiers rangs SANS danger : une nouveauté à la fois */
  rangsSansDanger: number
  /** au MILIEU, un rang sur N prend l'esprit labyrinthe — 0 : jamais */
  cadenceLaby: number
  /** à la FIN, un rang sur N passe en éclairage contrasté — 0 : jamais */
  cadenceContraste: number
  // ---- LA PART DES FIGURES ------------------------------------------------
  /** combien des trois cartes sont des FIGURES au début de la descente */
  figuresDebut: number
  /** combien des trois cartes sont des FIGURES dès le milieu */
  figuresSuite: number
  // ---- L'ALGORITHME DE PIOCHE --------------------------------------------
  /** les quatre poids de l'écart au cahier (cf. poule.ts) */
  poids: PoidsPioche
}

export const PLAN_VOIE_DEFAUTS: PlanVoie = {
  longueur: 12,
  diffMax: 3,
  graineDuJour: false,
  generees: true,
  ecrites: true,
  sommetRecul: 1,
  respiration: 3,
  finale: 60,
  rangsSansDanger: 2,
  cadenceLaby: 2,
  cadenceContraste: 2,
  figuresDebut: 1,
  figuresSuite: 2,
  poids: { ...POIDS_PIOCHE_DEFAUTS },
}

/** La descente est-elle TOUT PROCÉDURALE ? (salles générées seules) */
export function toutProcedural(plan: PlanVoie): boolean {
  return plan.generees && !plan.ecrites
}

/** Ramène un plan (chargé du stockage, ou réglé au banc) dans les bornes. */
export function clampPlanVoie(p: Partial<PlanVoie> | null): PlanVoie {
  const n = (v: unknown, d: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : d
  const entier = (v: unknown, d: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, Math.round(n(v, d))))
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
    // absent d'un vieux réglage : les salles générées sont l'ordinaire
    generees: p?.generees !== false,
    // idem pour les tableaux écrits : un plan d'avant ce réglage les garde
    ecrites: p?.ecrites !== false,
    // LES RÉGLAGES DE RAMPE SONT NÉS APRÈS le stockage : un plan enregistré
    // avant eux n'en porte aucun, et doit retrouver EXACTEMENT la descente
    // qu'il décrivait — d'où des défauts qui sont les anciennes constantes.
    sommetRecul: entier(p?.sommetRecul, PLAN_VOIE_DEFAUTS.sommetRecul, 0, 9),
    respiration: entier(p?.respiration, PLAN_VOIE_DEFAUTS.respiration, 0, 9),
    finale: entier(p?.finale, PLAN_VOIE_DEFAUTS.finale, 0, 100),
    rangsSansDanger: entier(
      p?.rangsSansDanger,
      PLAN_VOIE_DEFAUTS.rangsSansDanger,
      0,
      40,
    ),
    cadenceLaby: entier(p?.cadenceLaby, PLAN_VOIE_DEFAUTS.cadenceLaby, 0, 9),
    cadenceContraste: entier(
      p?.cadenceContraste,
      PLAN_VOIE_DEFAUTS.cadenceContraste,
      0,
      9,
    ),
    // au plus trois : le choix ne porte que trois cartes générées
    figuresDebut: entier(p?.figuresDebut, PLAN_VOIE_DEFAUTS.figuresDebut, 0, 3),
    figuresSuite: entier(p?.figuresSuite, PLAN_VOIE_DEFAUTS.figuresSuite, 0, 3),
    poids: clampPoidsPioche(p?.poids ?? null),
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
 *  · l'enveloppe monte de 0 (rang 1) au SOMMET diffMax — placé `sommetRecul`
 *    rangs avant la fin (1 : l'avant-dernier, le pic juste avant la fin) ;
 *  · un rang sur `respiration` creuse un CREUX (−1 sous l'enveloppe) —
 *    la tension se mesure à ses relâchements ; 0 : la rampe est lisse ;
 *  · le DERNIER rang est une victoire à prendre, pas un mur : `finale` %
 *    du plafond — le joueur sort sur une réussite. */
export function diffAuRang(rang: number, plan: PlanVoie): number {
  const r = Math.max(1, rang)
  const borne = (v: number): number => Math.max(0, Math.min(9, v))
  if (r >= plan.longueur)
    return borne(Math.round((plan.diffMax * plan.finale) / 100))
  const sommet = Math.max(2, plan.longueur - Math.max(0, plan.sommetRecul))
  const t = Math.min(1, (r - 1) / Math.max(1, sommet - 1))
  let d = Math.round(t * plan.diffMax)
  // la respiration ne creuse QUE sous le sommet : au-delà, l'enveloppe est
  // plate et un creux y ferait redescendre la fin de la descente
  if (plan.respiration > 0 && r % plan.respiration === 0 && r < sommet) d -= 1
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
  const cadence = (n: number): boolean => n > 0 && rang % n === 0
  return {
    dangers: rang <= plan.rangsSansDanger ? 1 : 0,
    laby: m === 2 && cadence(plan.cadenceLaby) ? 2 : 0,
    // le DERNIER rang ne se joue jamais dans la pénombre : la sortie se voit
    contraste:
      m === 3 && cadence(plan.cadenceContraste) && rang < plan.longueur ? 1 : 0,
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

/** UN TIRAGE REPRODUCTIBLE à partir d'un texte de graine. La descente du
 * jour s'en sert pour que tous les postes voient les mêmes salles ; l'écran
 * LA DESCENTE s'en sert pour qu'un tirage à blanc puisse se REJOUER — un
 * réglage se juge en changeant une seule chose à la fois, donc à hasard
 * égal. Même suite pour la même graine, sur n'importe quel poste. */
export function aleaDeGraine(graine: string): () => number {
  let h = hachage(graine)
  return () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0
    return h / 2 ** 32
  }
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

// ---- LES FAMILLES DE FIGURE DANS LA DESCENTE -----------------------------
// Le mode FIGURE (figures.ts) — les glyphes géométriques et, surtout, les
// familles distillées des tableaux faits main de BOIZ (conduits, fusion,
// échangeur, voies) — vivait jusqu'ici dans le seul éditeur : la descente
// procédurale ne générait QUE des salles à compartiments, et pas un joueur
// ne croisait un tableau de BOIZ en run.
//
// Il s'y invite ici EN PLUS du système existant, jamais à sa place : à
// chaque rang, le choix mêle des salles à compartiments et des figures.
// Le tirage est aléatoire dans le vivier ÉLIGIBLE, et le vivier, lui, est
// tenu par trois règles :
//   · les MÉMOIRES TISSÉES — une famille qui grave du rideau dans sa
//     géométrie exige la solidification, une qui pose des surchauffeurs
//     exige la vaporisation : sans le lien, elle ne se propose pas ;
//   · la MÉCANIQUE de la carte — une carte « glace » ne porte pas une
//     famille qui réclame aussi la vapeur ;
//   · le MOMENT — un glyphe simple se lit dès le début, un réseau (les
//     conduits) attend le milieu, le cycle thermique et la tresse la fin.

/** Les familles de figure jouables à ce moment de la descente, pour une
 * carte de cette mécanique, avec ces mémoires tissées. */
export function famillesEligibles(
  moment: CodeAtelier['moment'],
  mecanique: CodeAtelier['mecanique'],
  solidification: boolean,
  vaporisation: boolean,
): FigureFamille[] {
  const glaceOK = solidification && (mecanique === 1 || mecanique === 3)
  const vapeurOK = vaporisation && (mecanique === 2 || mecanique === 3)
  return FIGURE_FAMILLES.filter((f) => {
    const p = FIGURE_PROFILS[f]
    if (p.momentMin > moment) return false
    if (p.exigeGlace && !glaceOK) return false
    if (p.exigeVapeur && !vapeurOK) return false
    return true
  })
}

/** LE MODE DES TROIS CARTES d'un rang : lesquelles sont des figures.
 * La part de figures monte avec le moment — d'ordinaire une au début, deux
 * dès le milieu, et ces deux nombres se règlent (plan.figuresDebut /
 * figuresSuite). Aux valeurs ordinaires le mélange est garanti : jamais
 * trois figures, jamais trois compartiments — le choix doit montrer DEUX
 * façons de faire une salle. Poussé à 0 ou à 3, le concepteur demande
 * explicitement un choix d'une seule espèce, et il l'obtient. */
export function figuresDuChoix(
  moment: CodeAtelier['moment'],
  alea: () => number,
  combienDebut = 1,
  combienSuite = 2,
): boolean[] {
  const combien = Math.max(
    0,
    Math.min(3, moment === 1 ? combienDebut : combienSuite),
  )
  const modes = [false, false, false]
  const rangs = [0, 1, 2]
  for (let i = rangs.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1))
    ;[rangs[i], rangs[j]] = [rangs[j], rangs[i]]
  }
  for (let k = 0; k < combien; k++) modes[rangs[k]] = true
  return modes
}

/** La valeur de l'option `figure` pour une carte : 0 (salles à
 * compartiments) si la carte n'est pas une figure ou si aucune famille
 * n'est éligible — sinon l'index d'une famille tirée du vivier. */
export function figureDeLaCarte(
  estFigure: boolean,
  moment: CodeAtelier['moment'],
  mecanique: CodeAtelier['mecanique'],
  solidification: boolean,
  vaporisation: boolean,
  alea: () => number,
): number {
  if (!estFigure) return 0
  const vivier = famillesEligibles(
    moment,
    mecanique,
    solidification,
    vaporisation,
  )
  if (vivier.length === 0) return 0
  // LE TIRAGE SE FAIT EN DEUX TEMPS, et c'est voulu. Six glyphes
  // géométriques contre quatre familles de BOIZ, et ces quatre-là sont les
  // plus contraintes (elles exigent des liens tissés, elles attendent le
  // milieu ou la fin) : un tirage plat les rendrait quasi invisibles — la
  // tresse sortait moins d'une fois sur cent. On tire donc d'abord le
  // VOCABULAIRE (glyphe ou tableau de BOIZ, à égalité quand les deux sont
  // ouverts), puis la famille dedans. Les tableaux faits main pèsent alors
  // autant que la géométrie, ce qui est leur juste part.
  const boiz = vivier.filter((f) => FAMILLES_BOIZ.includes(f))
  const glyphes = vivier.filter((f) => !FAMILLES_BOIZ.includes(f))
  const groupe =
    boiz.length === 0
      ? glyphes
      : glyphes.length === 0
        ? boiz
        : alea() < 0.5
          ? boiz
          : glyphes
  return optionFigure(groupe[Math.floor(alea() * groupe.length)])
}

/** L'AMPLEUR du champ au rang donné : la descente s'ouvre en avançant —
 * intime au début, vaste au milieu, immense à la fin. */
export function ampleurAuRang(
  rang: number,
  plan: PlanVoie,
): 0 | 1 | 2 | 3 {
  const m = momentAuRang(rang, plan)
  return m === 1 ? 1 : m === 2 ? 2 : 3
}
