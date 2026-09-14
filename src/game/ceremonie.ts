// LA CÉRÉMONIE DE FIN DE SALLE — la règle, à part du spectacle.
//
// Le spectacle (bannière qui claque, rang qui tombe, compteurs qui roulent,
// jauge qui coule, cartes qui se retournent) vit dans main.ts et dans le
// CSS : il touche le DOM, l'horloge et le son, il ne se teste pas. Ce
// module tient ce qui se DÉCIDE — le rang d'une salle, ses étoiles, l'ordre
// et les instants des temps de la lecture, la courbe d'un compteur — et
// rien de ce qui se dessine. C'est ce qui permet de vérifier qu'une salle
// livrée à 92 % est bien un S, sans ouvrir un navigateur.

/** Le RANG d'une salle, du plus haut au plus bas — la lettre que le joueur
 *  attend à la fin de chaque salle, comme dans un jeu d'arcade. */
export type Rang = 'S' | 'A' | 'B' | 'C' | 'D'

export interface VerdictRang {
  rang: Rang
  /** le mot qui accompagne la lettre : « IMPECCABLE », « HONORABLE »… */
  mot: string
  /** la teinte de la médaille, en CSS */
  teinte: string
  /** les étoiles allumées (sur 5) : le rang se lit aussi sans lire */
  etoiles: number
}

/** Les seuils du rang, sur la PART DU VOLUME DE DÉPART LIVRÉE (0..1+).
 *  Le chrono n'entre pas dans le rang : la salle se joue d'abord à ne rien
 *  perdre, et un joueur lent qui livre tout mérite son S. La prime de glace
 *  compte dans le surplus, donc dans la part : livrer plus que le départ
 *  reste un S, jamais plus. */
export const SEUILS_RANG: ReadonlyArray<readonly [Rang, number]> = [
  ['S', 0.9],
  ['A', 0.72],
  ['B', 0.52],
  ['C', 0.3],
  ['D', 0],
]

const VERDICTS: Record<Rang, Omit<VerdictRang, 'rang'>> = {
  S: { mot: 'IMPECCABLE', teinte: '#ffd977', etoiles: 5 },
  A: { mot: 'BRILLANT', teinte: '#6dffb8', etoiles: 4 },
  B: { mot: 'HONORABLE', teinte: '#63b7e6', etoiles: 3 },
  C: { mot: 'PASSABLE', teinte: '#a9c3de', etoiles: 2 },
  D: { mot: 'LIVRÉ DE JUSTESSE', teinte: '#e0685c', etoiles: 1 },
}

/** Le rang d'une salle, d'après la part livrée. Une part hors de sens
 *  (NaN, négative) tombe au plus bas : la salle est passée, on ne la
 *  récompense pas d'un calcul cassé. */
export function rangDeSalle(pct: number): VerdictRang {
  const part = Number.isFinite(pct) ? pct : 0
  for (const [rang, seuil] of SEUILS_RANG)
    if (part >= seuil) return { rang, ...VERDICTS[rang] }
  return { rang: 'D', ...VERDICTS.D }
}

/** LES TEMPS DE LA LECTURE, en millisecondes depuis l'ouverture. Chaque
 *  chose arrive à son heure : le titre claque, le rang tombe, les litres
 *  roulent, les lignes se posent, le condensat s'égrène, puis le versement
 *  se propose. Un toucher saute tout d'un coup au versement — jamais
 *  l'inverse. Tenus ici pour que le test garde l'ordre : un temps qui
 *  passerait avant le précédent ferait tomber une ligne sur un rang pas
 *  encore posé. */
export const TEMPS_BILAN = {
  titre: 0,
  rang: 650,
  litres: 1000,
  prime: 2050,
  lignes: 2350,
  condensat: 3450,
  versement: 4900,
} as const

/** L'écart entre deux lignes du relevé : chacune tombe après l'autre. */
export const PAS_LIGNE_MS = 240

/** Sortie douce : un compteur qui file vite puis se pose. */
export function sortieDouce(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return 1 - (1 - x) * (1 - x) * (1 - x)
}

/** Douce au départ ET à l'arrivée : la jauge qui coule. */
export function douce(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** La valeur d'un compteur qui ROULE de `de` à `a`, au temps `t` (0..1) —
 *  et qui arrive EXACTEMENT à `a` : un compteur qui s'arrête à 2,49 pour
 *  2,50 L se voit, et se ressent comme une erreur. */
export function compteur(de: number, a: number, t: number): number {
  if (t >= 1) return a
  return de + (a - de) * sortieDouce(t)
}

/** La NOTE d'une salle se lit mieux qu'un chiffre nu : on lui donne
 *  une couleur de rang, et une phrase — c'est le petit mot du protocole. */
export function motDeNote(note: number): string {
  if (note >= 300) return 'une livraison de maître'
  if (note >= 180) return 'un protocole tenu'
  if (note >= 80) return 'le corps est passé'
  return 'la salle est derrière'
}
