// LES MINI-JEUX — des salles où LA PHYSIQUE EST LE JEU. Le concepteur veut
// des salles qui soient « des mini-jeux à partir du volume du joueur »
// (16/09). Sujet 21 a un atout qu'aucun deck-builder n'a : le corps est une
// simulation de fluide, et tout ce qu'on lui fait faire est déjà une règle.
// Le premier, LA PESÉE, prouve la forme : remplir une cuve graduée avec
// exactement N litres de soi — ni plus, ni moins — et la précision paie en
// mémoire. Un nœud de la mini-carte (nature « minijeu »), posé comme une
// halte ; sa salle se construit ici, en code, comme l'Économat.
import { MAT_WALL, type LevelDef, type ObstacleBox } from './level'

export type MiniJeuId = 'pesee'

/** Ce que porte un tableau de mini-jeu (LevelDef.minijeu). */
export interface MiniJeuDef {
  type: MiniJeuId
  /** la pesée : les litres demandés dans la cuve */
  cible: number
}

export const CODE_PESEE = 'MJ-PESEE'

/** Ce tableau est-il un mini-jeu ? (son sas ne collecte pas : il mesure) */
export function estMiniJeu(level: { code: string; minijeu?: MiniJeuDef }): boolean {
  return !!level.minijeu || level.code === CODE_PESEE
}

/** LA CIBLE DE LA PESÉE : une part du volume de départ, entre 35 et 70 %,
 *  arrondie au décilitre — assez pour qu'il faille se couper, jamais tout.
 *  `alea` vient de l'appelant (la graine du module ou le hasard du poste). */
export function tirePesee(volumeDepartL: number, alea: () => number): number {
  const part = 0.35 + Math.max(0, Math.min(1, alea())) * 0.35
  const l = Math.max(0.1, Math.round(volumeDepartL * part * 10) / 10)
  return l
}

/** LE BARÈME : l'écart relatif au trait, et ce qu'il paie. La mémoire de
 *  base est celle d'un sas ordinaire (5) ; juste au trait, elle triple ;
 *  proche, elle vaut ; loin, la moitié ; ratée, rien. */
export interface BaremePesee {
  base: number
  juste: number // ≤ 5 %
  proche: number // ≤ 15 %
  loin: number // ≤ 30 %
}
export const BAREME_PESEE: BaremePesee = { base: 5, juste: 3, proche: 1, loin: 0.5 }

export interface NotePesee {
  /** l'écart relatif au trait (0 = juste) */
  ecart: number
  verdict: 'juste' | 'proche' | 'loin' | 'rate'
  memoire: number
}

export function notePesee(verseL: number, cibleL: number, bareme: BaremePesee = BAREME_PESEE): NotePesee {
  const cible = Math.max(0.05, cibleL)
  const ecart = Math.abs(verseL - cible) / cible
  const verdict: NotePesee['verdict'] = ecart <= 0.05 + 1e-9 ? 'juste' : ecart <= 0.15 + 1e-9 ? 'proche' : ecart <= 0.3 + 1e-9 ? 'loin' : 'rate'
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_PESEE: Record<NotePesee['verdict'], string> = {
  juste: 'AU TRAIT',
  proche: 'PROCHE',
  loin: 'LOIN DU TRAIT',
  rate: 'RATÉ',
}

function box(minX: number, minY: number, maxX: number, maxY: number, skin?: number): ObstacleBox {
  return skin ? { minX, minY, maxX, maxY, material: MAT_WALL, skin } : { minX, minY, maxX, maxY, material: MAT_WALL }
}

/** LA SALLE DE LA PESÉE : une cuve à gauche où l'on naît, la CUVE GRADUÉE
 *  à droite (le sas, qui boit ce qu'on lui donne et le garde), et au milieu
 *  deux piliers qui laissent un passage — de quoi se couper en deux sans
 *  rien d'autre à craindre. Le journal dit le trait. */
export function tableauPesee(cible: number): LevelDef {
  const l = `${cible.toFixed(1).replace('.', ',')} L`
  return {
    name: 'La pesée',
    code: CODE_PESEE,
    journal: `Une cuve graduée, un trait à ${l}. Versez-y exactement ce qu'elle demande — ni plus, ni moins. Ce qui reste de vous reste dehors ; la cuve garde ce qu'on lui donne. La précision paie en mémoire.`,
    par: 4,
    bounds: { minX: -1600, minY: -800, maxX: 1600, maxY: 800 },
    spawn: { x: -1300, y: 0, n: 900 },
    exit: { minX: 1380, minY: -130, maxX: 1560, maxY: 130 },
    boxes: [
      // deux piliers, un passage au milieu : se scinder demande un appui
      box(-140, -800, -60, -260, 5),
      box(-140, 260, -60, 800, 5),
      // une margelle devant la cuve : on y pose ce qu'on ne verse pas
      box(1000, 380, 1380, 440, 2),
    ],
    sponges: [],
    labels: [
      { x: 1470, y: -200, text: `TRAIT ${l}`, tone: 'mur' },
      { x: -1300, y: -220, text: 'LA PESÉE', tone: 'mur' },
    ],
    minijeu: { type: 'pesee', cible },
  }
}
