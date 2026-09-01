// L'APERÇU D'UNE DESCENTE : ce que le plan PRODUIRA, avant d'y jouer.
//
// Le plan de la voie (voie.ts) est une poignée de nombres ; ce que ces
// nombres donnent — la rampe rang par rang, la posture des salles, les
// tableaux que la pioche ira chercher — ne se voyait NULLE PART. Il fallait
// descendre pour le savoir, une salle à la fois, et une descente de douze
// rangs prend un quart d'heure. Le concepteur réglait donc à l'aveugle, et
// c'est la raison d'être de ce fichier : dérouler le plan SANS JOUER.
//
// Rien ici ne construit de salle. La génération d'un tableau coûte des
// dizaines de millisecondes et peut échouer sur une graine ingrate : un
// aperçu qui générerait figerait l'écran et mentirait sur les échecs. On ne
// déroule que les DÉCISIONS — moment, difficulté, posture, mécaniques
// tirées, tableau pioché — c'est-à-dire exactement ce que les réglages
// commandent. Ce qu'on voit est donc vrai, et instantané.
//
// Deux outils s'appuient dessus, et ils répondent à deux questions
// différentes :
//   · le TIRAGE À BLANC (tireDescente) — « à quoi ressemble UNE descente ? »
//     une seule, rejouable à la graine près ;
//   · le BILAN (bilanDescentes) — « et sur cent ? » : quels tableaux
//     sortent, lesquels ne sortent JAMAIS. Un tableau qu'aucune descente ne
//     propose est un tableau mort, et c'est invisible autrement.

import type { LevelDef } from './level'
import type { CodeAtelier } from './levelIO'
import { decodeCodeAtelier } from './levelIO'
import { piocheEcrite } from './poule'
import {
  aleaDeGraine,
  ampleurAuRang,
  diffAuRang,
  figuresDuChoix,
  mecaniquesDuChoix,
  mecaniquesPermises,
  momentAuRang,
  reglageAuRang,
  type PlanVoie,
} from './voie'

/** Une case du plan, telle que la descente la posera. */
export interface RangApercu {
  rang: number
  moment: CodeAtelier['moment']
  difficulte: number
  ampleur: 0 | 1 | 2 | 3
  /** 1 : le rang se joue SANS danger (une nouveauté à la fois) */
  dangers: 0 | 1
  /** 2 : la salle prend l'esprit labyrinthe */
  laby: 0 | 2
  /** 1 : la salle se joue en éclairage contrasté */
  contraste: 0 | 1
  /** la leçon pure : les familles se resserrent sur la mécanique */
  purete: boolean
  /** combien des trois cartes générées seront des FIGURES */
  figures: number
}

/** LE PLAN DÉROULÉ, rang par rang — sans rien générer. C'est le tableau que
 * l'écran affiche : une ligne par salle de la descente. */
export function apercuDescente(plan: PlanVoie): RangApercu[] {
  const out: RangApercu[] = []
  for (let rang = 1; rang <= plan.longueur; rang++) {
    const moment = momentAuRang(rang, plan)
    const regl = reglageAuRang(rang, plan)
    out.push({
      rang,
      moment,
      difficulte: diffAuRang(rang, plan),
      ampleur: ampleurAuRang(rang, plan),
      dangers: regl.dangers,
      laby: regl.laby,
      contraste: regl.contraste,
      purete: regl.purete,
      figures: Math.max(
        0,
        Math.min(3, moment === 1 ? plan.figuresDebut : plan.figuresSuite),
      ),
    })
  }
  return out
}

/** Ce que le choix d'un rang proposera : le tableau pioché (s'il y en a un)
 * et les trois mécaniques des salles générées. */
export interface RangTirage extends RangApercu {
  /** le tableau ÉCRIT pioché dans le pool — null : la case reste procédurale */
  ecrite: { code: string; nom: string; cahier: CodeAtelier | null } | null
  /** les trois mécaniques des cartes générées */
  mecaniques: CodeAtelier['mecanique'][]
}

/** Les mémoires tissées, qui bornent ce que la descente ose proposer. */
export interface MemoiresTissees {
  solidification: boolean
  vaporisation: boolean
}

const TOUT_TISSE: MemoiresTissees = {
  solidification: true,
  vaporisation: true,
}

/** UN TIRAGE À BLANC : la descente entière, décidée mais pas jouée.
 *  · `niveaux` — la bibliothèque jouable (hub déjà écarté par l'appelant) ;
 *  · `graine` — le texte de graine : deux appels avec la même graine
 *    donnent la MÊME descente, ce qui permet de comparer deux réglages
 *    toutes choses égales par ailleurs ;
 *  · `memoires` — les liens tissés : sans eux, les mécaniques de glace et
 *    de vapeur ne se proposent pas, exactement comme en jeu.
 * La suite des salles vues se garnit au fil des rangs : la pioche ne
 * repropose pas un tableau déjà passé, comme dans une vraie descente. */
export function tireDescente(
  niveaux: LevelDef[],
  plan: PlanVoie,
  graine: string,
  memoires: MemoiresTissees = TOUT_TISSE,
): RangTirage[] {
  const alea = aleaDeGraine(graine)
  const permises = mecaniquesPermises(
    memoires.solidification,
    memoires.vaporisation,
  )
  const vues = new Set<string>()
  // un tableau qui EXIGE un état non tissé n'est pas jouable — le même
  // filtre qu'en jeu, sinon l'aperçu proposerait des salles injouables
  const jouable = (lv: LevelDef): boolean =>
    (lv.exige ?? []).every((e) =>
      e === 'glace' ? memoires.solidification : memoires.vaporisation,
    )
  let jouee: CodeAtelier['mecanique'] | null = null
  return apercuDescente(plan).map((a) => {
    const ecrite = plan.ecrites
      ? piocheEcrite(
          niveaux,
          { moment: a.moment, mecanique: 3, difficulte: a.difficulte },
          vues,
          jouable,
          alea,
          jouee,
          plan.poids,
        )
      : null
    const cahier = ecrite ? decodeCodeAtelier(ecrite.code) : null
    const mecaniques = mecaniquesDuChoix(
      cahier?.mecanique ?? null,
      alea,
      jouee,
      permises,
    )
    // le rang consomme aussi son tirage de figures : sans cet appel, le
    // hasard de l'aperçu dériverait de celui du jeu et la graine ne
    // rejouerait plus la même descente
    figuresDuChoix(a.moment, alea, plan.figuresDebut, plan.figuresSuite)
    // en jeu, la salle RETENUE est celle que le joueur choisit ; ici nul ne
    // choisit, et l'on suit le tableau pioché quand il y en a un — c'est le
    // seul chemin déterministe, et celui qui montre le mieux le pool
    if (ecrite) {
      vues.add(ecrite.code)
      jouee = cahier?.mecanique ?? null
    } else {
      jouee = mecaniques[0]
    }
    return {
      ...a,
      ecrite: ecrite
        ? { code: ecrite.code, nom: ecrite.name, cahier }
        : null,
      mecaniques: [...mecaniques],
    }
  })
}

/** Le bilan de N descentes tirées à blanc. */
export interface BilanDescentes {
  /** combien de descentes ont été tirées */
  descentes: number
  /** les tableaux du pool, du plus proposé au moins proposé */
  parCode: { code: string; nom: string; tirages: number; part: number }[]
  /** ceux qu'AUCUNE descente n'a proposés — les tableaux morts */
  oublies: { code: string; nom: string }[]
  /** le nombre moyen de tableaux écrits par descente */
  ecritesParDescente: number
  /** combien de cartes générées par mécanique (0 aucune · 1 glace · 2 vapeur · 3 toutes) */
  parMecanique: [number, number, number, number]
}

/** LE BILAN : on tire N descentes et l'on compte. La question à laquelle il
 * répond ne se pose pas autrement — « ce tableau, une descente le
 * propose-t-elle jamais ? » — et sa réponse condamne ou sauve un réglage.
 * Chaque descente prend une graine distincte dérivée de la graine mère :
 * le bilan entier se rejoue donc à l'identique. */
export function bilanDescentes(
  niveaux: LevelDef[],
  plan: PlanVoie,
  combien: number,
  graine: string,
  memoires: MemoiresTissees = TOUT_TISSE,
): BilanDescentes {
  const n = Math.max(1, Math.round(combien))
  const comptes = new Map<string, number>()
  const parMecanique: [number, number, number, number] = [0, 0, 0, 0]
  let ecrites = 0
  for (let i = 0; i < n; i++) {
    for (const r of tireDescente(niveaux, plan, `${graine}#${i}`, memoires)) {
      if (r.ecrite) {
        ecrites++
        comptes.set(r.ecrite.code, (comptes.get(r.ecrite.code) ?? 0) + 1)
      }
      for (const m of r.mecaniques) parMecanique[m]++
    }
  }
  const nom = new Map(niveaux.map((lv) => [lv.code, lv.name]))
  const parCode = [...comptes.entries()]
    .map(([code, tirages]) => ({
      code,
      nom: nom.get(code) ?? code,
      tirages,
      part: tirages / n,
    }))
    .sort((a, b) => b.tirages - a.tirages || a.code.localeCompare(b.code))
  return {
    descentes: n,
    parCode,
    oublies: niveaux
      .filter((lv) => !comptes.has(lv.code))
      .map((lv) => ({ code: lv.code, nom: lv.name })),
    ecritesParDescente: ecrites / n,
    parMecanique,
  }
}
