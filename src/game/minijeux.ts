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
//
// LE PALET (le curling) suit. On prend de la vitesse sur la piste d'élan,
// LA LIGNE GÈLE le corps quand il la franchit (le concepteur, 17/09 : « il
// faudrait que cela transforme automatiquement en glace une fois la ligne
// franchie »), et la glace doit s'arrêter le plus près du centre de la
// maison. « Geler, c'est parier sur une trajectoire » (le document
// fonctionnel) : ici c'est tout le jeu, et la vitesse à la ligne est le
// seul geste. Trois lancers, le meilleur compte, chaque relance coûte de la
// masse — il faut revenir derrière la ligne pour relancer.
//
// LES RÉGLAGES PROPRES AU MINI-JEU. Le solveur est piloté par une centaine
// de paramètres nommés, mais aucun tableau ne pouvait les surcharger : un
// mini-jeu porte les siens (`reglages`), appliqués à l'entrée de sa salle et
// rendus à la sortie — une glace qui rebondit comme une bille, un gel qui
// prend vite. C'est ce qui permet d'accorder la physique au jeu sans
// toucher au banc.
import { MAT_GRILLE, MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_WALL, type LevelDef, type ObstacleBox, type PorteDef } from './level'
import type { SimParams } from '../sim/params'

export type MiniJeuId = 'couperet' | 'palet' | 'rafales' | 'souffle'

/** LE COUPERET : ce que porte son tableau. */
export interface CouperetDef {
  type: 'couperet'
  /** les litres demandés au-delà du trait */
  cible: number
  /** l'abscisse du trait (monde) : la lame tombe dessus */
  trait: number
  /** le rythme de la lame */
  rythme: RythmeCouperet
  reglages?: Partial<SimParams>
}

/** LE PALET : ce que porte son tableau. */
export interface PaletDef {
  type: 'palet'
  regles: ReglesPalet
  reglages?: Partial<SimParams>
}

/** Ce que porte un tableau de mini-jeu (LevelDef.minijeu). */
export type MiniJeuDef = CouperetDef | PaletDef | RafalesDef | SouffleDef

export const CODE_COUPERET = 'MJ-COUPERET'
export const CODE_PALET = 'MJ-PALET'
export const CODE_RAFALES = 'MJ-RAFALES'
export const CODE_SOUFFLE = 'MJ-SOUFFLE'

/** LE CATALOGUE : les mini-jeux qu'un nœud de la mini-carte peut servir. */
export const MINI_JEUX: readonly MiniJeuId[] = ['couperet', 'palet', 'rafales', 'souffle']

/** LE TIRAGE du mini-jeu d'un nœud : au hasard du catalogue, à la graine. */
export function tireMiniJeu(alea: () => number): MiniJeuId {
  const i = Math.min(MINI_JEUX.length - 1, Math.floor(Math.max(0, Math.min(0.999999, alea())) * MINI_JEUX.length))
  return MINI_JEUX[i]
}

export const NOMS_MINI_JEU: Record<MiniJeuId, string> = { couperet: 'LE COUPERET', palet: 'LE PALET', rafales: 'LES RAFALES', souffle: 'LE SOUFFLE' }

/** Ce tableau est-il un mini-jeu ? (il n'a pas de sas : il mesure) */
export function estMiniJeu(level: { code: string; minijeu?: MiniJeuDef }): boolean {
  return !!level.minijeu || level.code === CODE_COUPERET || level.code === CODE_PALET || level.code === CODE_RAFALES || level.code === CODE_SOUFFLE
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

// ---- LE PALET -------------------------------------------------------------

/** LES RÈGLES DU PALET : la ligne de lancer (la franchir GÈLE le corps et
 *  lance), la maison (son centre, ses trois cercles : au centre, dans la
 *  maison, au bord), le nombre de lancers, et ce qui fait qu'un lancer est
 *  fini — la glace au repos (vitesse sous `reposVitesse` pendant
 *  `reposDuree`), dégelée (part gelée sous `partGel`, une fois prise), ou
 *  `dureeMax` écoulée. */
export interface ReglesPalet {
  ligne: number
  maison: { x: number; y: number }
  /** les rayons, du centre au bord : ≤ r0 au centre, ≤ r1 dans la maison, ≤ r2 au bord */
  rayons: [number, number, number]
  lancers: number
  reposVitesse: number
  reposDuree: number
  dureeMax: number
  partGel: number
}

export const REGLES_PALET: ReglesPalet = {
  ligne: -400,
  maison: { x: 900, y: 0 },
  rayons: [110, 250, 420],
  lancers: 3,
  reposVitesse: 40,
  reposDuree: 0.6,
  dureeMax: 14,
  partGel: 0.8,
}

export interface Lancer {
  /** la distance du centre du corps au centre de la maison, à la fin du lancer */
  distance: number
  verdict: NoteTrait['verdict']
  /** pourquoi le lancer a fini : au repos, dégelé, ou le temps */
  fin: 'repos' | 'degel' | 'temps'
}

export interface EtatPalet {
  lancers: Lancer[]
  /** le lancer en cours : depuis quand, la glace a-t-elle PRIS (le gel met
   *  un instant), et depuis quand elle est au repos (−1 : elle bouge) */
  enCours: { debut: number; pris: boolean; reposDepuis: number } | null
  /** le corps a été vu derrière la ligne depuis le dernier lancer : le
   *  prochain franchissement lance */
  arme: boolean
  fini: boolean
}

export const ETAT_PALET_NEUF: EtatPalet = { lancers: [], enCours: null, arme: false, fini: false }

/** Ce que le jeu observe du corps à chaque image. */
export interface ObservationPalet {
  t: number
  /** la glace est prise (part gelée ≥ partGel) */
  gele: boolean
  x: number
  y: number
  vitesse: number
}

/** LE VERDICT D'UN LANCER par sa distance au centre : les mêmes quatre
 *  paliers que le trait, le même barème de mémoire. */
export function notePalet(distance: number, rayons: ReglesPalet['rayons'], bareme: BaremeTrait = BAREME_TRAIT): NoteTrait {
  const verdict: NoteTrait['verdict'] = distance <= rayons[0] ? 'juste' : distance <= rayons[1] ? 'proche' : distance <= rayons[2] ? 'loin' : 'rate'
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart: distance, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_PALET: Record<NoteTrait['verdict'], string> = {
  juste: 'AU CENTRE',
  proche: 'DANS LA MAISON',
  loin: 'AU BORD',
  rate: 'HORS JEU',
}

/** LE PALET AVANCE d'une observation : le corps vu derrière la ligne ARME
 *  le lancer ; le franchissement de la ligne le LANCE (c'est le jeu qui
 *  gèle alors le corps — `enCours` non nul vaut ordre de gel) ; il FINIT
 *  quand la glace, une fois prise, s'arrête, se dégèle ou traîne trop ;
 *  après le dernier lancer, c'est fini. Pur : rend un état neuf, jamais ne
 *  touche l'ancien. */
export function avancePalet(e: EtatPalet, o: ObservationPalet, r: ReglesPalet = REGLES_PALET): EtatPalet {
  if (e.fini) return e
  const lancers = e.lancers
  if (!e.enCours) {
    if (o.x < r.ligne) return e.arme ? e : { ...e, arme: true }
    if (!e.arme) return e
    return { lancers, enCours: { debut: o.t, pris: o.gele, reposDepuis: -1 }, arme: false, fini: false }
  }
  const c = e.enCours
  let fin: Lancer['fin'] | null = null
  let reposDepuis = c.reposDepuis
  const pris = c.pris || o.gele
  if (c.pris && !o.gele) fin = 'degel'
  else if (o.t - c.debut >= r.dureeMax) fin = 'temps'
  else if (pris && o.vitesse < r.reposVitesse) {
    if (reposDepuis < 0) reposDepuis = o.t
    else if (o.t - reposDepuis >= r.reposDuree) fin = 'repos'
  } else reposDepuis = -1
  if (!fin) return { lancers, enCours: { debut: c.debut, pris, reposDepuis }, arme: false, fini: false }
  const distance = Math.hypot(o.x - r.maison.x, o.y - r.maison.y)
  const faits = [...lancers, { distance, verdict: notePalet(distance, r.rayons).verdict, fin }]
  return { lancers: faits, enCours: null, arme: false, fini: faits.length >= r.lancers }
}

/** LE MEILLEUR LANCER : le plus près du centre, ou rien si aucun n'est fait. */
export function meilleurLancer(e: EtatPalet): Lancer | null {
  let best: Lancer | null = null
  for (const l of e.lancers) if (!best || l.distance < best.distance) best = l
  return best
}

/** LES RÉGLAGES DU PALET : une glace qui prend vite, rebondit franchement
 *  sur les parois et S'ESSOUFFLE en glissant (en jeu elle ne freine jamais :
 *  dans le vide, une dérive reste une trajectoire — ici il faut qu'un lancer
 *  ait une longueur), des bumpers hydrophobes qui rendent plus qu'ils ne
 *  reçoivent, un freinage hydrophile net — de quoi jouer la bande. */
export const REGLAGES_PALET: Partial<SimParams> = {
  freezeSelfTime: 0.25,
  thawTime: 0.8, // le dégel après un lancer ne fait pas attendre
  iceRestitution: 0.85,
  hydrophobeIceRestitution: 1.25,
  hydrophobeIceKick: 320,
  hydrophileIceDrag: 4,
  // PRENDRE DE LA VITESSE COÛTE : le corps gagne ejectSpeed × la part de
  // lui-même qu'il éjecte. À 1 400 u/s (le jeu), atteindre 400 u/s demande
  // 29 % du corps — « pas évident de prendre assez de vitesse » (le
  // concepteur). À 2 800, 14 % ; et l'élan se prend deux fois plus vite.
  ejectSpeed: 2800,
  ejectRate: 64,
  // la pierre s'essouffle : à 0,3/s, une glace lancée à 400 u/s parcourt
  // ~1 300 u avant l'arrêt — de la ligne de lancer au centre de la maison
  iceSlideDrag: 0.3,
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

/** LA SALLE DU PALET : la piste. On naît à gauche sur la piste d'élan, la
 *  ligne de lancer est au tiers (la franchir gèle), la maison (trois
 *  cercles) aux deux tiers. Deux bumpers hydrophobes sur les longs côtés
 *  permettent de jouer la bande, un butoir hydrophile au fond freine ce qui
 *  va trop loin. Pas de sas : trois lancers, le meilleur compte, la salle
 *  conclut. */
export function tableauPalet(regles: ReglesPalet = REGLES_PALET, reglages: Partial<SimParams> = REGLAGES_PALET): LevelDef {
  const { ligne, maison } = regles
  return {
    name: 'Le palet',
    code: CODE_PALET,
    journal:
      `Une piste d'élan, une ligne, une maison. Prenez de la vitesse : la ligne vous gèle quand vous la franchissez, et la glace doit s'arrêter le plus près du centre. ` +
      `Trois lancers, le meilleur compte — revenez derrière la ligne pour relancer, chaque élan coûte de la masse. Les bandes hydrophobes renvoient, le butoir du fond freine. Au centre, la mémoire triple.`,
    par: 4,
    bounds: { minX: -1600, minY: -800, maxX: 1600, maxY: 800 },
    spawn: { x: -1150, y: 0, n: 900 },
    exit: { minX: 1700, minY: -60, maxX: 1760, maxY: 60 },
    boxes: [
      // les bumpers : la bande, pour qui veut contourner
      box(ligne + 200, -800, maison.x - 200, -740, MAT_HYDROPHOBE),
      box(ligne + 200, 740, maison.x - 200, 800, MAT_HYDROPHOBE),
      // le butoir du fond : hydrophile, il freine la glace au lieu de la renvoyer
      box(1480, -800, 1600, 800, MAT_HYDROPHILE),
      // deux plots devant la maison : un couloir droit passe, la bande aussi
      box(maison.x - 520, -800, maison.x - 460, -560, MAT_WALL, 5),
      box(maison.x - 520, 560, maison.x - 460, 800, MAT_WALL, 5),
    ],
    sponges: [],
    labels: [
      { x: -1150, y: -260, text: 'LE PALET', tone: 'mur' },
      { x: -1150, y: 300, text: '1 · PRENEZ DE LA VITESSE', tone: 'mur' },
      { x: ligne, y: -700, text: 'LA LIGNE VOUS GÈLE', tone: 'mur' },
      { x: (ligne + maison.x) / 2, y: 300, text: '2 · LA GLACE GLISSE : ARRÊTEZ-LA AU CENTRE', tone: 'mur' },
      { x: maison.x, y: -560, text: `3 LANCERS · LE MEILLEUR COMPTE`, tone: 'mur' },
    ],
    minijeu: { type: 'palet', regles, reglages },
  }
}

// ---- LES RAFALES -------------------------------------------------------------
//
// LES RAFALES. Un couloir traversé par des courants latéraux qui soufflent
// EN RYTHME — le rythme de la lame du couperet, en poussée : trois secondes
// de calme, une seconde de rafale — et des éponges sur les deux bords qui
// boivent ce que la rafale y plaque. On traverse entre deux souffles. Le
// corps reste liquide et piloté du début à la fin : le geste est celui du
// jeu, avancer en éjectant, avec un rythme à lire. Mesure : le volume avec
// lequel on arrive au bout. Une seule manche — la traversée est le lancer.

export interface ReglesRafales {
  /** l'arrivée : le corps dont le centre y entre a traversé */
  arrivee: { minX: number; minY: number; maxX: number; maxY: number }
  /** le rythme des rafales : calme `periode − garde`, souffle `garde` */
  rythme: RythmeCouperet
  /** la part du volume de départ gardée : ≥ p0 intact, ≥ p1 écorné, ≥ p2 entamé, sinon vidé */
  paliers: [number, number, number]
}

export const REGLES_RAFALES: ReglesRafales = {
  arrivee: { minX: 1380, minY: -600, maxX: 1600, maxY: 600 },
  rythme: { periode: 4, garde: 1 },
  paliers: [0.9, 0.7, 0.45],
}

export interface RafalesDef {
  type: 'rafales'
  regles: ReglesRafales
  reglages?: Partial<SimParams>
}

export function noteRafales(partGardee: number, paliers: ReglesRafales['paliers'], bareme: BaremeTrait = BAREME_TRAIT): NoteTrait {
  const verdict: NoteTrait['verdict'] =
    partGardee >= paliers[0] ? 'juste' : partGardee >= paliers[1] ? 'proche' : partGardee >= paliers[2] ? 'loin' : 'rate'
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart: partGardee, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_RAFALES: Record<NoteTrait['verdict'], string> = {
  juste: 'INTACT',
  proche: 'ÉCORNÉ',
  loin: 'ENTAMÉ',
  rate: 'VIDÉ',
}

/** Le corps a-t-il traversé ? (son centre est dans l'arrivée) */
export function arriveRafales(x: number, y: number, r: ReglesRafales = REGLES_RAFALES): boolean {
  return dansRect(x, y, r.arrivee)
}

/** LE COULOIR DES RAFALES : on naît à gauche ; trois tronçons sont balayés
 *  par des courants transversaux (haut, bas, haut) qui soufflent tous en
 *  même temps, au rythme ; sur les deux bords, des éponges boivent ce que le
 *  souffle y plaque ; l'arrivée est à droite. Les chasses sont scénarisées
 *  (canal négatif) : c'est le jeu qui les allume, au rythme. Pas de sas. */
export function tableauRafales(regles: ReglesRafales = REGLES_RAFALES): LevelDef {
  const souffle = (minX: number, maxX: number, angle: number) => ({ minX, minY: -600, maxX, maxY: 600, angle, allure: 420, canal: -1 })
  const eponge = (minX: number, minY: number, cols: number) => ({ minX, minY, cols, rows: 2, cellSize: 24, capacityPerCell: 6 })
  return {
    name: 'Les rafales',
    code: CODE_RAFALES,
    journal:
      `Un couloir, trois tronçons balayés par des rafales qui soufflent toutes les ${regles.rythme.periode} secondes, une seconde durant, ` +
      `et des éponges sur les bords qui boivent ce que le souffle y plaque. Traversez entre deux souffles. ` +
      `Ce qui compte, c'est ce qu'il vous reste à l'arrivée : intact, la mémoire triple.`,
    par: 4,
    bounds: { minX: -1600, minY: -600, maxX: 1600, maxY: 600 },
    spawn: { x: -1300, y: 0, n: 900 },
    exit: { minX: 1700, minY: -60, maxX: 1760, maxY: 60 },
    boxes: [
      // les repères des tronçons : un montant court à chaque frontière, haut et bas
      { minX: -680, minY: -600, maxX: -640, maxY: -440, material: MAT_WALL, skin: 5 },
      { minX: -680, minY: 440, maxX: -640, maxY: 600, material: MAT_WALL, skin: 5 },
      { minX: 20, minY: -600, maxX: 60, maxY: -440, material: MAT_WALL, skin: 5 },
      { minX: 20, minY: 440, maxX: 60, maxY: 600, material: MAT_WALL, skin: 5 },
      { minX: 720, minY: -600, maxX: 760, maxY: -440, material: MAT_WALL, skin: 5 },
      { minX: 720, minY: 440, maxX: 760, maxY: 600, material: MAT_WALL, skin: 5 },
    ],
    // les éponges : une bande sur chaque bord des trois tronçons
    sponges: [
      eponge(-640, 552, 28),
      eponge(-640, -600, 28),
      eponge(60, 552, 27),
      eponge(60, -600, 27),
      eponge(760, 552, 25),
      eponge(760, -600, 25),
    ],
    // les rafales : haut, bas, haut — scénarisées, allumées par le jeu au rythme
    chasses: [souffle(-640, 20, 90), souffle(60, 720, -90), souffle(760, 1380, 90)],
    labels: [
      { x: -1300, y: -300, text: 'LES RAFALES', tone: 'mur' },
      { x: -1300, y: 300, text: '1 · TRAVERSEZ ENTRE DEUX SOUFFLES', tone: 'mur' },
      { x: 390, y: 0, text: '2 · LES ÉPONGES DES BORDS BOIVENT CE QUI S’Y PLAQUE', tone: 'mur' },
      { x: 1490, y: -300, text: 'ARRIVÉE', tone: 'mur' },
    ],
    minijeu: { type: 'rafales', regles },
  }
}

// ---- LE SOUFFLE ----------------------------------------------------------------
//
// LE SOUFFLE. Une salle qui impose la vapeur, un slalom de grilles, et une
// perte au repos montée : plus on traîne, plus on s'évapore. Le dash de
// vapeur — la visée au ralenti, le départ au relâchement — est le geste le
// plus agréable du jeu, et on ne le sollicite jamais en série : ici les
// dashs sont sans compte, mais chacun chasse une part du nuage. Les grilles
// laissent passer la vapeur en la rognant (grilleGasLoss) et laissent un
// passage à leur bout, en quinconce : traverser coûte du nuage, contourner
// coûte du temps — et le temps aussi s'évapore. Mesure : le temps jusqu'à
// l'arrivée ; ce qu'il reste se lit à côté.

export interface ReglesSouffle {
  arrivee: { minX: number; minY: number; maxX: number; maxY: number }
  /** les temps, en secondes : ≤ t0 en un souffle, ≤ t1 vif, ≤ t2 essoufflé, sinon dissipé */
  paliers: [number, number, number]
}

export const REGLES_SOUFFLE: ReglesSouffle = {
  arrivee: { minX: 1380, minY: -600, maxX: 1600, maxY: 600 },
  paliers: [12, 18, 26],
}

export interface SouffleDef {
  type: 'souffle'
  regles: ReglesSouffle
  reglages?: Partial<SimParams>
}

export function noteSouffle(temps: number, paliers: ReglesSouffle['paliers'], bareme: BaremeTrait = BAREME_TRAIT): NoteTrait {
  const verdict: NoteTrait['verdict'] = temps <= paliers[0] ? 'juste' : temps <= paliers[1] ? 'proche' : temps <= paliers[2] ? 'loin' : 'rate'
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart: temps, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_SOUFFLE: Record<NoteTrait['verdict'], string> = {
  juste: 'EN UN SOUFFLE',
  proche: 'VIF',
  loin: 'ESSOUFFLÉ',
  rate: 'DISSIPÉ',
}

/** Un point est-il dans un rectangle ? (l'arrivée des traversées) */
export function dansRect(x: number, y: number, a: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY
}

/** LES RÉGLAGES DU SOUFFLE : chaque dash chasse moins de nuage qu'en jeu
 *  (on en enchaîne dix), mais le repos s'évapore six fois plus vite — c'est
 *  le temps qui coûte, pas le geste. */
export const REGLAGES_SOUFFLE: Partial<SimParams> = {
  gasDashExhaust: 0.07,
  gasIdleLossRate: 12,
}

/** LE SLALOM DU SOUFFLE : on naît à gauche, en vapeur (la salle entière
 *  l'impose) ; quatre grilles barrent le couloir en quinconce, chacune
 *  laissant un passage à un bout ; l'arrivée est à droite. Les dashs sont
 *  sans compte (dashBudget). Pas de sas. */
export function tableauSouffle(regles: ReglesSouffle = REGLES_SOUFFLE, reglages: Partial<SimParams> = REGLAGES_SOUFFLE): LevelDef {
  // une grille de toute la hauteur moins un passage de 300 u, en haut ou en bas
  const grille = (x: number, passageEnHaut: boolean): ObstacleBox =>
    passageEnHaut
      ? { minX: x - 30, minY: -600, maxX: x + 30, maxY: 300, material: MAT_GRILLE }
      : { minX: x - 30, minY: -300, maxX: x + 30, maxY: 600, material: MAT_GRILLE }
  return {
    name: 'Le souffle',
    code: CODE_SOUFFLE,
    journal:
      `Un couloir de grilles en quinconce, et vous êtes vapeur : la salle l'impose. Les dashs sont sans compte, mais chacun chasse un peu de nuage, ` +
      `et le nuage qui attend s'évapore. La vapeur passe les grilles en s'y rognant ; leur bout laisse un passage. ` +
      `Ce qui compte, c'est le temps jusqu'à l'arrivée : en moins de ${regles.paliers[0]} s, la mémoire triple.`,
    par: 4,
    bounds: { minX: -1600, minY: -600, maxX: 1600, maxY: 600 },
    spawn: { x: -1300, y: 0, n: 900 },
    exit: { minX: 1700, minY: -60, maxX: 1760, maxY: 60 },
    dashBudget: 99,
    boxes: [grille(-700, true), grille(-140, false), grille(420, true), grille(980, false)],
    sponges: [],
    zones: [{ minX: -1600, minY: -600, maxX: 1600, maxY: 600, force: 'vapeur' }],
    labels: [
      { x: -1300, y: -300, text: 'LE SOUFFLE', tone: 'mur' },
      { x: -1300, y: 300, text: '1 · VISEZ, RELÂCHEZ : LE DASH PART', tone: 'mur' },
      { x: 140, y: 0, text: '2 · TRAVERSER UNE GRILLE ROGNE LE NUAGE, LA CONTOURNER PREND DU TEMPS', tone: 'mur' },
      { x: 1490, y: -300, text: 'ARRIVÉE', tone: 'mur' },
    ],
    minijeu: { type: 'souffle', regles, reglages },
  }
}
