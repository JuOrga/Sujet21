// Le POOL de salles : à chaque rang de la run (les deux lettres du code
// « 21XX-MMD »), plusieurs tableaux peuvent coexister — en fin de salle,
// après la récompense, le jeu en PROPOSE DEUX au choix. La sélection est
// automatique, sur les critères du code :
//   · le MOMENT le plus proche de la phase réelle de la run d'abord ;
//   · puis la DIVERSITÉ : deux mécaniques différentes si possible,
//     sinon l'écart de difficulté le plus parlant.

import type { LevelDef } from './level'
import {
  decodeCode21,
  decodeCodeAtelier,
  type Code21,
  type CodeAtelier,
} from './levelIO'

/** La phase de la run (1 début · 2 milieu · 3 fin) au rang donné. */
export function phaseRun(rang: number, total: number): 1 | 2 | 3 {
  const t = Math.max(1, total)
  const p = 1 + Math.min(2, Math.floor(((rang - 1) / t) * 3))
  return p as 1 | 2 | 3
}

/** Les candidats du POOL au rang donné : tous les tableaux dont le code
 * « 21XX-MMD » porte cet ordre. */
export function candidatsAuRang(niveaux: LevelDef[], rang: number): LevelDef[] {
  return niveaux.filter((lv) => decodeCode21(lv.code)?.ordre === rang)
}

/** Les DEUX propositions de fin de salle — ou [] si le pool du rang n'a pas
 * au moins deux tableaux (l'enchaînement reste alors linéaire). */
export function propositionsSalles(
  niveaux: LevelDef[],
  rang: number,
  totalRun: number,
): LevelDef[] {
  const cands = candidatsAuRang(niveaux, rang)
  if (cands.length < 2) return []
  const phase = phaseRun(rang, totalRun)
  const code = (lv: LevelDef): Code21 => decodeCode21(lv.code)!
  // moment le plus proche de la phase d'abord ; difficulté douce ensuite
  const tri = [...cands].sort((a, b) => {
    const da = Math.abs(code(a).atelier.moment - phase)
    const db = Math.abs(code(b).atelier.moment - phase)
    if (da !== db) return da - db
    return code(a).atelier.difficulte - code(b).atelier.difficulte
  })
  const premier = tri[0]
  const a1 = code(premier).atelier
  const reste = tri.slice(1)
  // la DIVERSITÉ fait le choix intéressant : une mécanique différente si le
  // pool en offre une — sinon l'écart de difficulté le plus grand
  const second =
    reste.find((lv) => code(lv).atelier.mecanique !== a1.mecanique) ??
    [...reste].sort(
      (a, b) =>
        Math.abs(code(b).atelier.difficulte - a1.difficulte) -
        Math.abs(code(a).atelier.difficulte - a1.difficulte),
    )[0]
  return [premier, second]
}

// ---- LA PIOCHE DU POOL : le trigramme, pas le rang ------------------------
// L'ORDRE N'EST PLUS L'ORDRE. Jusqu'ici la descente prenait le tableau écrit
// à la POSITION suivante de la bibliothèque (`seq[levelIndex + 1]`) : deux
// runs enchaînaient donc les mêmes tableaux dans le même ordre, et les deux
// lettres du code « 21XX » figeaient un rang unique. Le pool devient une
// vraie pioche : à chaque rang, le plan dit ce qu'il VEUT (moment ·
// mécanique · difficulté — le trigramme « 111 », « 213 »…) et l'on tire,
// parmi les tableaux qui s'en approchent le plus, celui qu'on n'a pas
// encore vu de la run.
//
// L'ÉCART se lit dans cet ordre, du plus lourd au plus léger :
//   · le MOMENT d'abord — un tableau de fin n'ouvre pas une descente ;
//   · la DIFFICULTÉ ensuite — c'est la rampe, elle prime sur la couleur ;
//   · la MÉCANIQUE enfin — la moins contraignante des trois, et la
//     mécanique 0 (l'eau seule) passe partout : elle n'exige aucun lien.
// À écart égal, le hasard tranche : deux descentes ne se ressemblent pas.

const ECART_MOMENT = 100
const ECART_DIFF = 10
const ECART_MECA_REPETEE = 3 // la foulée varie : on préfère changer de couleur

/** L'écart d'un tableau à la case du plan — le MOMENT pèse dix fois la
 * difficulté, la difficulté dix fois le reste : c'est la rampe qui commande.
 * Plus l'écart est petit, mieux le tableau remplit la case. */
export function ecartAuCahier(a: CodeAtelier, vise: CodeAtelier): number {
  return (
    Math.abs(a.moment - vise.moment) * ECART_MOMENT +
    Math.abs(a.difficulte - vise.difficulte) * ECART_DIFF
  )
}

/** Le coût d'un tableau SANS cahier lisible. Il est plus grand que le pire
 * écart réel (2 moments + 9 crans de difficulté = 290) : un tableau codé,
 * même mal assorti, passe toujours devant un tableau muet — mais le muet
 * reste tirable, et c'est essentiel. La convention « 21XX-MMD » existe dans
 * le code ; AUCUN tableau livré ne la porte encore (ils sont en « 21-A »,
 * « 21-07 »…). Une pioche strictement trigrammée aurait donc fait
 * DISPARAÎTRE la carte écrite de toutes les descentes. Ici la bibliothèque
 * non migrée continue de se proposer, dans son ordre, comme avant — et
 * chaque tableau qu'on code passe aussitôt devant. La migration peut se
 * faire tableau par tableau, sans palier. */
const ECART_SANS_CAHIER = 1000

/** Les tableaux du pool, avec leur cahier quand le code en porte un. Le hub
 * et ses annexes sont déjà écartés en amont (playedLevels). */
export function candidatsPool(
  niveaux: LevelDef[],
): { lv: LevelDef; atelier: CodeAtelier | null }[] {
  return niveaux.map((lv) => ({ lv, atelier: decodeCodeAtelier(lv.code) }))
}

/** LA PIOCHE : le tableau écrit qui remplit le mieux la case du plan.
 *  · `vise` — ce que le rang demande (moment · difficulté ; la mécanique
 *    du cahier visé n'entre pas dans l'écart, elle est portée par
 *    `eviteMecanique`) ;
 *  · `exclus` — les codes déjà joués dans cette run : on ne repasse pas ;
 *  · `jouable` — le filtre du jeu (un tableau qui EXIGE un état que les
 *    mémoires n'ont pas tissé est écarté) ;
 *  · `eviteMecanique` — celle qu'on vient de jouer : à écart égal, une
 *    autre couleur passe devant, sans jamais vider le chapeau ;
 *  · `alea` — départage les ex æquo, et c'est là que vit la variété.
 * Null : le pool n'a rien pour cette case — la descente reste alors
 * procédurale, ce qui est une réponse et non un échec. */
export function piocheEcrite(
  niveaux: LevelDef[],
  vise: CodeAtelier,
  exclus: ReadonlySet<string>,
  jouable: (lv: LevelDef) => boolean,
  alea: () => number,
  eviteMecanique: CodeAtelier['mecanique'] | null = null,
): LevelDef | null {
  const cands = candidatsPool(niveaux).filter(
    (c) => !exclus.has(c.lv.code) && jouable(c.lv),
  )
  if (cands.length === 0) return null
  const note = (c: { atelier: CodeAtelier | null }): number =>
    c.atelier === null
      ? ECART_SANS_CAHIER
      : ecartAuCahier(c.atelier, vise) +
        (eviteMecanique !== null && c.atelier.mecanique === eviteMecanique
          ? ECART_MECA_REPETEE
          : 0)
  let meilleur = Infinity
  for (const c of cands) meilleur = Math.min(meilleur, note(c))
  const exAequo = cands.filter((c) => note(c) === meilleur)
  // les tableaux MUETS gardent l'ordre de la bibliothèque : tant qu'ils ne
  // sont pas codés, la descente les enchaîne comme avant plutôt que de les
  // battre au hasard — le hasard ne se justifie qu'entre égaux ASSUMÉS.
  if (meilleur === ECART_SANS_CAHIER) return exAequo[0].lv
  return exAequo[Math.floor(alea() * exAequo.length)].lv
}
