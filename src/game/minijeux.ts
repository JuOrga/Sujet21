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
import { MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_WALL, type LevelDef, type ObstacleBox, type PorteDef } from './level'
import type { SimParams } from '../sim/params'

export type MiniJeuId = 'couperet' | 'palet' | 'flipper'

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
export type MiniJeuDef = CouperetDef | PaletDef | FlipperDef

export const CODE_COUPERET = 'MJ-COUPERET'
export const CODE_PALET = 'MJ-PALET'
export const CODE_FLIPPER = 'MJ-FLIPPER'

/** LE CATALOGUE : les mini-jeux qu'un nœud de la mini-carte peut servir. */
export const MINI_JEUX: readonly MiniJeuId[] = ['couperet', 'palet', 'flipper']

/** LE TIRAGE du mini-jeu d'un nœud : au hasard du catalogue, à la graine. */
export function tireMiniJeu(alea: () => number): MiniJeuId {
  const i = Math.min(MINI_JEUX.length - 1, Math.floor(Math.max(0, Math.min(0.999999, alea())) * MINI_JEUX.length))
  return MINI_JEUX[i]
}

export const NOMS_MINI_JEU: Record<MiniJeuId, string> = { couperet: 'LE COUPERET', palet: 'LE PALET', flipper: 'LE FLIPPER' }

/** Ce tableau est-il un mini-jeu ? (il n'a pas de sas : il mesure) */
export function estMiniJeu(level: { code: string; minijeu?: MiniJeuDef }): boolean {
  return !!level.minijeu || level.code === CODE_COUPERET || level.code === CODE_PALET || level.code === CODE_FLIPPER
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

// ---- LE FLIPPER --------------------------------------------------------------
//
// LE FLIPPER. Le solveur a déjà un vrai bumper — un palet de glace sur une
// paroi hydrophobe repart avec plus de vitesse qu'il n'en avait, et une
// pichenette minimale — et personne ne jouait avec. Une table portrait : un
// courant (chasse) tire vers le bas, c'est la gravité ; une zone de glace
// couvre la table, le corps EST la bille ; trois bumpers ronds et deux
// slingshots hydrophobes marquent les points ; deux flippers sont des portes
// ÉVENTAIL scénarisées, dont le front pivotant POUSSE la bille quand le
// joueur presse (à gauche du centre : le flipper gauche, à droite : le
// droit) ; entre les deux, le trou. Trois billes, les points s'additionnent.

export interface ReglesFlipper {
  /** le trou : la bille dont le centre y entre est perdue */
  trou: { minX: number; minY: number; maxX: number; maxY: number }
  /** l'abscisse qui sépare les deux flippers (à gauche : le gauche) */
  centre: number
  billes: number
  /** une bille qui traîne plus longtemps est rendue (une bille coincée) */
  dureeMax: number
  /** deux chocs plus rapprochés que cela sont le même coup */
  coupMin: number
  /** les points, du meilleur au moindre : ≥ p0 grand chelem, ≥ p1 belle partie, ≥ p2 quelques points */
  paliers: [number, number, number]
}

export const REGLES_FLIPPER: ReglesFlipper = {
  trou: { minX: -150, minY: -1000, maxX: 150, maxY: -880 },
  centre: 0,
  billes: 3,
  dureeMax: 75,
  coupMin: 0.12,
  paliers: [24, 12, 4],
}

export interface FlipperDef {
  type: 'flipper'
  regles: ReglesFlipper
  reglages?: Partial<SimParams>
}

export interface EtatFlipper {
  /** les points de chaque bille jouée */
  billes: number[]
  /** la bille en cours : depuis quand, les points, le compte de chocs du solveur déjà lu, l'instant du dernier coup */
  enCours: { debut: number; points: number; chocsLus: number; dernierCoup: number } | null
  fini: boolean
}

export const ETAT_FLIPPER_NEUF: EtatFlipper = { billes: [], enCours: null, fini: false }

export interface ObservationFlipper {
  t: number
  x: number
  y: number
  /** le compte cumulé des chocs de bumper du solveur */
  chocs: number
}

export function pointsFlipper(e: EtatFlipper): number {
  return e.billes.reduce((s, p) => s + p, 0) + (e.enCours?.points ?? 0)
}

export function noteFlipper(points: number, paliers: ReglesFlipper['paliers'], bareme: BaremeTrait = BAREME_TRAIT): NoteTrait {
  const verdict: NoteTrait['verdict'] = points >= paliers[0] ? 'juste' : points >= paliers[1] ? 'proche' : points >= paliers[2] ? 'loin' : 'rate'
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart: points, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_FLIPPER: Record<NoteTrait['verdict'], string> = {
  juste: 'GRAND CHELEM',
  proche: 'BELLE PARTIE',
  loin: 'QUELQUES POINTS',
  rate: 'BILLE PERDUE',
}

/** LE FLIPPER AVANCE d'une observation : la bille en jeu marque un point
 *  par choc de bumper (deux chocs plus rapprochés que `coupMin` sont le
 *  même coup) ; elle est perdue quand son centre entre dans le trou, ou
 *  rendue après `dureeMax` (coincée) ; après la dernière bille, c'est fini.
 *  Pur : rend un état neuf, jamais ne touche l'ancien. */
export function avanceFlipper(e: EtatFlipper, o: ObservationFlipper, r: ReglesFlipper = REGLES_FLIPPER): EtatFlipper {
  if (e.fini) return e
  if (!e.enCours) return { ...e, enCours: { debut: o.t, points: 0, chocsLus: o.chocs, dernierCoup: -Infinity } }
  const c = e.enCours
  let points = c.points
  let dernierCoup = c.dernierCoup
  if (o.chocs > c.chocsLus && o.t - c.dernierCoup >= r.coupMin) {
    points++
    dernierCoup = o.t
  }
  const dansTrou = o.x >= r.trou.minX && o.x <= r.trou.maxX && o.y >= r.trou.minY && o.y <= r.trou.maxY
  if (!dansTrou && o.t - c.debut < r.dureeMax)
    return { billes: e.billes, enCours: { debut: c.debut, points, chocsLus: o.chocs, dernierCoup }, fini: false }
  const billes = [...e.billes, points]
  return { billes, enCours: null, fini: billes.length >= r.billes }
}

/** LES RÉGLAGES DU FLIPPER : la bille prend vite, rebondit franchement sur
 *  les parois, et les bumpers claquent — plus de retour que d'aller, une
 *  pichenette nette. Aucune glisse freinée : une bille roule. */
export const REGLAGES_FLIPPER: Partial<SimParams> = {
  freezeSelfTime: 0.2,
  iceRestitution: 0.75,
  hydrophobeIceRestitution: 1.3,
  hydrophobeIceKick: 420,
  iceSlideDrag: 0,
}

/** LA TABLE DU FLIPPER : portrait, la bille naît en haut, le courant la
 *  tire vers le bas, deux guides l'amènent aux flippers. Les flippers sont
 *  deux portes éventail sur charnière extérieure (nord-ouest à gauche, en
 *  sens trigonométrique ; nord-est à droite, en sens horaire) : leur front
 *  balaie du bas vers le centre et pousse la bille vers le haut. */
export function tableauFlipper(regles: ReglesFlipper = REGLES_FLIPPER, reglages: Partial<SimParams> = REGLAGES_FLIPPER): LevelDef {
  const bumper = (x: number, y: number, r: number): ObstacleBox => ({ minX: x - r, minY: y - r, maxX: x + r, maxY: y + r, material: MAT_HYDROPHOBE, forme: 1 })
  const flippers: PorteDef[] = [
    { minX: -430, minY: -900, maxX: -150, maxY: -760, canal: -1, materialisation: 'eventail', pivot: 6, allure: 3200 },
    { minX: 150, minY: -900, maxX: 430, maxY: -760, canal: -1, materialisation: 'eventail', pivot: 4, horaire: true, allure: 3200 },
  ]
  return {
    name: 'Le flipper',
    code: CODE_FLIPPER,
    journal:
      `Une table, trois bumpers, deux flippers, un trou. Vous êtes la bille : la table vous gèle, le courant vous tire vers le bas. ` +
      `Pressez à gauche du centre pour le flipper gauche, à droite pour le droit — chaque bumper touché marque un point. ` +
      `Trois billes, les points s'additionnent. Au-delà de ${regles.paliers[0]} points, la mémoire triple.`,
    par: 4,
    bounds: { minX: -700, minY: -1000, maxX: 700, maxY: 1000 },
    spawn: { x: 0, y: 820, n: 900 },
    exit: { minX: 800, minY: -60, maxX: 860, maxY: 60 },
    boxes: [
      // les bumpers : trois disques hydrophobes, en triangle
      bumper(-260, 300, 90),
      bumper(260, 300, 90),
      bumper(0, 540, 90),
      // les slingshots : deux coins hydrophobes au-dessus des flippers
      { minX: -600, minY: -560, maxX: -440, maxY: -360, material: MAT_HYDROPHOBE, forme: 3, p0: 1 },
      { minX: 440, minY: -560, maxX: 600, maxY: -360, material: MAT_HYDROPHOBE, forme: 3, p0: 0 },
      // les guides : deux parois inclinées qui mènent aux flippers
      { minX: -700, minY: -700, maxX: -380, maxY: -640, material: MAT_WALL, angle: -32, skin: 5 },
      { minX: 380, minY: -700, maxX: 700, maxY: -640, material: MAT_WALL, angle: 32, skin: 5 },
      // le fond, de part et d'autre du trou : la bille qui manque les flippers y tombe
      { minX: -700, minY: -1000, maxX: -150, maxY: -900, material: MAT_WALL, skin: 4 },
      { minX: 150, minY: -1000, maxX: 700, maxY: -900, material: MAT_WALL, skin: 4 },
    ],
    portes: flippers,
    // la gravité : un courant permanent vers le bas, sur toute la table
    chasses: [{ minX: -700, minY: -1000, maxX: 700, maxY: 1000, angle: -90, allure: 260 }],
    // la bille : la table entière impose la glace
    zones: [{ minX: -700, minY: -1000, maxX: 700, maxY: 1000, force: 'glace' }],
    sponges: [],
    labels: [
      { x: 0, y: 930, text: 'LE FLIPPER', tone: 'mur' },
      { x: 0, y: 700, text: '1 · VOUS ÊTES LA BILLE : LE COURANT VOUS TIRE VERS LE BAS', tone: 'mur' },
      { x: 0, y: 100, text: '2 · CHAQUE BUMPER TOUCHÉ MARQUE UN POINT', tone: 'mur' },
      { x: 0, y: -960, text: 'PRESSEZ À GAUCHE OU À DROITE : LE FLIPPER DU MÊME CÔTÉ', tone: 'mur' },
    ],
    minijeu: { type: 'flipper', regles, reglages },
  }
}
