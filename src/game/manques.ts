// LES MANQUES DU POOL — ce qu'il reste à écrire pour remplacer les salles
// générées. Le concepteur veut jouer la descente avec des tableaux déjà
// écrits derrière chaque porte de la mini-carte (générées coupées au plan),
// et savoir facilement OÙ le pool manque : quelle mécanique, quel moment,
// quel biome. Deux relevés, purs, testés à part :
//  · l'INVENTAIRE — ce que la bibliothèque contient, case par case ;
//  · le RELEVÉ DES MANQUES — ce que le jeu a dû générer faute de tableau,
//    noté à chaque porte générée pour cette raison, et gardé sur le poste.
import type { LevelDef } from './level'
import { decodeCodeAtelier, type CodeAtelier } from './levelIO'

export const MECANIQUES: readonly CodeAtelier['mecanique'][] = [0, 1, 2, 3]
export const MOMENTS: readonly CodeAtelier['moment'][] = [1, 2, 3]

/** Une case de l'inventaire : les codes des tableaux jouables pour ce
 *  biome, cette mécanique et ce moment. */
export interface CaseInventaire {
  biome: string
  mecanique: CodeAtelier['mecanique']
  moment: CodeAtelier['moment']
  codes: string[]
}

/** L'INVENTAIRE du pool, biome par biome. Un tableau SANS biome est
 *  universel : il compte pour chacun. Un tableau SANS cahier (code hors
 *  nomenclature) ne compte nulle part : il ne se pioche que par défaut, il
 *  ne remplit aucune case. Les biomes viennent de la carte ; « » (sans
 *  biome) est ajouté quand un tableau n'en porte pas, pour qu'on voie ce
 *  que valent les universels seuls. */
export function inventairePool(niveaux: readonly LevelDef[], biomes: readonly string[]): CaseInventaire[] {
  const noms = [...new Set(biomes.filter((b) => b.length > 0))]
  const out: CaseInventaire[] = []
  for (const biome of noms)
    for (const mecanique of MECANIQUES)
      for (const moment of MOMENTS) {
        const codes: string[] = []
        for (const lv of niveaux) {
          const cah = decodeCodeAtelier(lv.code)
          if (!cah || cah.mecanique !== mecanique || cah.moment !== moment) continue
          if (lv.biome && lv.biome !== biome) continue
          codes.push(lv.code)
        }
        out.push({ biome, mecanique, moment, codes })
      }
  return out
}

/** UN MANQUE vu en jeu : une porte de la mini-carte générée parce que le
 *  pool n'avait aucun tableau de cette mécanique pour ce biome. `fois`
 *  compte les occurrences, `dernier` date la plus récente. */
export interface Manque {
  biome: string
  mecanique: CodeAtelier['mecanique']
  moment: CodeAtelier['moment']
  difficulte: number
  module: string
  fois: number
  dernier: string
}

export const CLE_MANQUES = 'sujet21-manques-v1'

/** La clé d'un manque : le même trou, compté une fois — le rang et la
 *  difficulté varient d'une run à l'autre, pas le tableau à écrire. */
export function cleManque(m: Pick<Manque, 'biome' | 'mecanique' | 'moment' | 'module'>): string {
  return `${m.biome}|${m.mecanique}|${m.moment}|${m.module}`
}

/** NOTER un manque : le même trou déjà noté compte une fois de plus (la
 *  difficulté la plus récente reste) ; sinon il s'ajoute. Rend une liste
 *  neuve, triée par occurrences décroissantes. */
export function noteManque(
  liste: readonly Manque[],
  m: Omit<Manque, 'fois' | 'dernier'>,
  quand: string = new Date().toISOString(),
): Manque[] {
  const cle = cleManque(m)
  let vu = false
  const out = liste.map((x) => {
    if (cleManque(x) !== cle) return x
    vu = true
    return { ...x, difficulte: m.difficulte, fois: x.fois + 1, dernier: quand }
  })
  if (!vu) out.push({ ...m, fois: 1, dernier: quand })
  return out.sort((a, b) => b.fois - a.fois || a.biome.localeCompare(b.biome) || a.mecanique - b.mecanique)
}

/** Le relevé lu du stockage : ce qui n'est pas un manque bien formé se
 *  jette, le reste revient tel quel — jamais une exception. */
export function litManques(brut: unknown): Manque[] {
  if (!Array.isArray(brut)) return []
  const out: Manque[] = []
  for (const x of brut) {
    if (typeof x !== 'object' || x === null) continue
    const o = x as Record<string, unknown>
    const mecanique = o.mecanique
    const moment = o.moment
    if (!MECANIQUES.includes(mecanique as CodeAtelier['mecanique'])) continue
    if (!MOMENTS.includes(moment as CodeAtelier['moment'])) continue
    out.push({
      biome: typeof o.biome === 'string' ? o.biome : '',
      mecanique: mecanique as CodeAtelier['mecanique'],
      moment: moment as CodeAtelier['moment'],
      difficulte: typeof o.difficulte === 'number' && Number.isFinite(o.difficulte) ? o.difficulte : 0,
      module: typeof o.module === 'string' ? o.module : '',
      fois: typeof o.fois === 'number' && o.fois > 0 ? Math.floor(o.fois) : 1,
      dernier: typeof o.dernier === 'string' ? o.dernier : '',
    })
  }
  return out
}
