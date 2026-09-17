// LES MINI-JEUX — des salles où LA PHYSIQUE EST LE JEU. Le concepteur veut
// des salles qui soient « des mini-jeux à partir du volume du joueur »
// (16/09). Sujet 21 a un atout qu'aucun deck-builder n'a : le corps est une
// simulation de fluide, et tout ce qu'on lui fait faire est déjà une
// règle. Un nœud de la mini-carte (nature « minijeu »), posé comme une
// halte ; sa salle se construit ici, en code, comme l'Économat.
//
// LA LEÇON DE LA PESÉE (17/09). Le premier mini-jeu demandait de VERSER N
// litres dans une cuve : le sas boit tout ce qui arrive, et le seul verbe
// du jeu est jeter — la meilleure façon de jouer était donc de se caler dos
// au mur et d'arroser le sas depuis l'autre bout de la salle. Le défaut
// était dans la règle, pas dans le réglage : tout mini-jeu qui compte ce qui
// entre dans un trou finit pareil. Deux règles en sont sorties :
//  · on pèse LE CORPS, pas les gouttes — seul ce qui fait corps compte (la
//    composante connexe du joueur, celle des gouttes en prêt) ;
//  · entrer doit être UN GESTE DU CORPS — se placer, s'étirer dans un col —
//    ce qu'une goutte tirée du fond de la salle ne sait pas faire.
//
// LE COUPERET les tient. Un trait au sol, une lame au-dessus qui tombe en
// rythme. On amène son corps à cheval sur le trait, on en laisse dépasser
// exactement N litres, et la lame tranche : ce qui est au-delà ET d'un seul
// tenant avec vous est pesé, la cuve le boit, vous repartez avec le reste.
// On lit son volume dans sa silhouette — c'est le pilier du jeu.
import { MAT_HYDROPHILE, MAT_WALL, type LevelDef, type ObstacleBox, type PorteDef } from './level'

export type MiniJeuId = 'couperet'

/** Ce que porte un tableau de mini-jeu (LevelDef.minijeu). */
export interface MiniJeuDef {
  type: MiniJeuId
  /** les litres demandés au-delà du trait */
  cible: number
  /** l'abscisse du trait (monde) : la lame tombe dessus */
  trait: number
  /** le rythme de la lame */
  rythme: RythmeCouperet
}

export const CODE_COUPERET = 'MJ-COUPERET'

/** Ce tableau est-il un mini-jeu ? (son sas ne collecte pas : il mesure) */
export function estMiniJeu(level: { code: string; minijeu?: MiniJeuDef }): boolean {
  return !!level.minijeu || level.code === CODE_COUPERET
}

/** LE TRAIT : une part du volume de départ, entre 35 et 70 %, arrondie au
 *  décilitre — assez pour qu'il faille se couper, jamais tout. `alea` vient
 *  de l'appelant (la graine du module ou le hasard du poste). */
export function tireTrait(volumeDepartL: number, alea: () => number): number {
  const part = 0.35 + Math.max(0, Math.min(1, alea())) * 0.35
  return Math.max(0.1, Math.round(volumeDepartL * part * 10) / 10)
}

/** LE BARÈME : l'écart relatif au trait, et ce qu'il paie. La mémoire de
 *  base est celle d'un sas ordinaire (5) ; juste au trait, elle triple ;
 *  proche, elle vaut ; loin, la moitié ; ratée, rien. */
export interface BaremeTrait {
  base: number
  juste: number // ≤ 5 %
  proche: number // ≤ 15 %
  loin: number // ≤ 30 %
}
export const BAREME_TRAIT: BaremeTrait = { base: 5, juste: 3, proche: 1, loin: 0.5 }

export interface NoteTrait {
  /** l'écart relatif au trait (0 = juste) */
  ecart: number
  verdict: 'juste' | 'proche' | 'loin' | 'rate'
  memoire: number
}

export function noteTrait(peseL: number, cibleL: number, bareme: BaremeTrait = BAREME_TRAIT): NoteTrait {
  const cible = Math.max(0.05, cibleL)
  const ecart = Math.abs(peseL - cible) / cible
  const verdict: NoteTrait['verdict'] = ecart <= 0.05 + 1e-9 ? 'juste' : ecart <= 0.15 + 1e-9 ? 'proche' : ecart <= 0.3 + 1e-9 ? 'loin' : 'rate'
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_TRAIT: Record<NoteTrait['verdict'], string> = {
  juste: 'AU TRAIT',
  proche: 'PROCHE',
  loin: 'LOIN DU TRAIT',
  rate: 'RATÉ',
}

/** LE RYTHME DE LA LAME : elle tombe toutes les `periode` secondes et reste
 *  baissée `garde` secondes. La première chute attend une période entière :
 *  le temps de lire la salle et de se mettre en place. */
export interface RythmeCouperet {
  periode: number
  garde: number
}
export const RYTHME_COUPERET: RythmeCouperet = { periode: 4, garde: 1 }

/** OÙ EN EST LA LAME à l'instant t : baissée ou non, et le temps qu'il
 *  reste avant la prochaine chute (0 tant qu'elle est baissée). */
export function phaseCouperet(t: number, r: RythmeCouperet = RYTHME_COUPERET): { tombee: boolean; avant: number } {
  const periode = Math.max(0.5, r.periode)
  const garde = Math.max(0, Math.min(periode - 0.1, r.garde))
  if (t < periode) return { tombee: false, avant: periode - t }
  const dansCycle = (t - periode) % periode
  if (dansCycle < garde) return { tombee: true, avant: 0 }
  return { tombee: false, avant: periode - dansCycle }
}

/** CE QUI EST AU-DELÀ DU TRAIT ET FAIT CORPS : le nombre de particules du
 *  corps (`duCorps`) dont l'abscisse dépasse le trait. Les gouttes libres
 *  ne comptent pas — c'est ce qui rend l'arrosage inutile. */
export function compteAuDela(n: number, posX: ArrayLike<number>, trait: number, duCorps: (i: number) => boolean): number {
  let c = 0
  for (let i = 0; i < n; i++) if (posX[i] > trait && duCorps(i)) c++
  return c
}

function box(minX: number, minY: number, maxX: number, maxY: number, material = MAT_WALL, skin?: number): ObstacleBox {
  return skin ? { minX, minY, maxX, maxY, material, skin } : { minX, minY, maxX, maxY, material }
}

/** LE COL du couperet : le passage entre les deux montants, là où la lame
 *  tombe. Étroit pour que le corps doive s'y étirer. */
export const COL_COUPERET = { trait: 620, demiLargeur: 60, demiHauteur: 210 }

/** LA SALLE DU COUPERET : on naît à gauche ; au milieu, deux montants
 *  serrent un col et la lame y tombe en rythme ; à droite, rien — la part
 *  tranchée reste scellée derrière la lame, il n'y a PAS de sas (le
 *  concepteur, 17/09 : « pas besoin de sas au final »). Le rectangle de
 *  sortie que LevelDef exige est posé hors des bornes et ne se dessine pas.
 *  Un pad hydrophile derrière le trait aide à tenir sa place, une margelle
 *  devant permet de se poser. La consigne est écrite dans la salle, en
 *  trois pancartes numérotées : on doit comprendre sans lire le journal. */
export function tableauCouperet(cible: number, rythme: RythmeCouperet = RYTHME_COUPERET): LevelDef {
  const l = `${cible.toFixed(1).replace('.', ',')} L`
  const { trait, demiLargeur, demiHauteur } = COL_COUPERET
  const lame: PorteDef = { minX: trait - 18, minY: -demiHauteur, maxX: trait + 18, maxY: demiHauteur, canal: -1 }
  return {
    name: 'Le couperet',
    code: CODE_COUPERET,
    journal:
      `Nagez jusqu'au trait et placez-y votre corps à cheval, de façon qu'exactement ${l} dépassent à droite. ` +
      `La lame tombe toutes les ${rythme.periode} secondes : ce qu'elle tranche à droite du trait est pesé, vous repartez avec le reste. ` +
      `Seul ce qui fait corps compte — les gouttes jetées ne pèsent rien. Au trait, la mémoire triple.`,
    par: 4,
    bounds: { minX: -1600, minY: -800, maxX: 1600, maxY: 800 },
    spawn: { x: -1100, y: 0, n: 900 },
    exit: { minX: 1700, minY: -60, maxX: 1760, maxY: 60 },
    boxes: [
      // les deux montants du col : le corps s'y étire pour passer le trait
      box(trait - demiLargeur, -800, trait + demiLargeur, -demiHauteur, MAT_WALL, 5),
      box(trait - demiLargeur, demiHauteur, trait + demiLargeur, 800, MAT_WALL, 5),
      // une margelle devant le trait : on s'y pose pour viser sa place
      box(trait - 420, demiHauteur + 40, trait - demiLargeur, demiHauteur + 100, MAT_WALL, 2),
      // le pad hydrophile derrière le trait : ce qui dépasse s'y accroche
      box(trait + demiLargeur, demiHauteur + 40, trait + 420, demiHauteur + 100, MAT_HYDROPHILE),
    ],
    portes: [lame],
    sponges: [],
    labels: [
      { x: -1100, y: -260, text: 'LE COUPERET', tone: 'mur' },
      { x: -1100, y: 300, text: '1 · NAGEZ JUSQU’AU TRAIT', tone: 'mur' },
      { x: trait, y: -demiHauteur - 60, text: `TRAIT ${l}`, tone: 'mur' },
      { x: trait, y: demiHauteur + 180, text: `2 · LAISSEZ DÉPASSER ${l} À DROITE DU TRAIT`, tone: 'mur' },
      { x: trait + 520, y: -300, text: `3 · LA LAME TOMBE TOUTES LES ${rythme.periode} s`, tone: 'mur' },
      { x: trait + 520, y: -380, text: 'CE QUI DÉPASSE EST PESÉ, LE RESTE REPART', tone: 'mur' },
    ],
    minijeu: { type: 'couperet', cible, trait, rythme },
  }
}
