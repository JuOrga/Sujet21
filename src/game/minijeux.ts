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
import { MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_WALL, type ImpulsionDef, type LevelDef, type MireDef, type ObstacleBox, type PorteDef, type PuitsDef } from './level'
import { FORME_ARC } from './formes'
import type { SimParams } from '../sim/params'

export type MiniJeuId = 'couperet' | 'palet' | 'rafales' | 'orbites' | 'cibles'

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
export type MiniJeuDef = CouperetDef | PaletDef | RafalesDef | OrbitesDef | CiblesDef

export const CODE_COUPERET = 'MJ-COUPERET'
export const CODE_PALET = 'MJ-PALET'
export const CODE_RAFALES = 'MJ-RAFALES'
export const CODE_ORBITES = 'MJ-ORBITES'
export const CODE_CIBLES = 'MJ-CIBLES'

/** LE CATALOGUE : les mini-jeux qu'un nœud de la mini-carte peut servir. */
export const MINI_JEUX: readonly MiniJeuId[] = ['couperet', 'palet', 'rafales', 'orbites', 'cibles']

/** LE TIRAGE du mini-jeu d'un nœud : au hasard du catalogue, à la graine. */
export function tireMiniJeu(alea: () => number): MiniJeuId {
  const i = Math.min(MINI_JEUX.length - 1, Math.floor(Math.max(0, Math.min(0.999999, alea())) * MINI_JEUX.length))
  return MINI_JEUX[i]
}

export const NOMS_MINI_JEU: Record<MiniJeuId, string> = { couperet: 'LE COUPERET', palet: 'LE PALET', rafales: 'LES RAFALES', orbites: 'LES ORBITES', cibles: 'LES CIBLES' }

/** Ce tableau est-il un mini-jeu ? (il n'a pas de sas : il mesure) */
export function estMiniJeu(level: { code: string; minijeu?: MiniJeuDef }): boolean {
  return !!level.minijeu || level.code === CODE_COUPERET || level.code === CODE_PALET || level.code === CODE_RAFALES || level.code === CODE_ORBITES || level.code === CODE_CIBLES
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
  const a = r.arrivee
  return x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY
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

// ---- LES ORBITES ---------------------------------------------------------------
//
// LES ORBITES. Trois puits de gravité en quinconce, le corps LANCÉ à une
// vitesse exacte, et la gravité qui le porte : autour du premier puits,
// entre les deux, autour du deuxième de l'autre côté, autour du troisième,
// puis dans le croissant (le croquis du concepteur, 17/09). Trois anneaux
// jalonnent ce chemin, dans l'ordre. À chaque seconde, l'alternative est
// lisible : LAISSER PORTER (gratuit — le prochain anneau dit où ça mène, et
// P dessine la trajectoire exacte) ou CORRIGER d'une éjection (chaque
// goutte coûte, la jauge et la silhouette le disent ; la ligne pointillée
// du point-masse, elle, reste dans l'éditeur). Ce qui compte : la part gardée, un
// palier de moins par anneau manqué, et rien si l'on ne finit pas dans le
// croissant. Le corps reste liquide et pilotable : c'est lui le sujet.

export interface ReglesOrbites {
  puits: PuitsDef[]
  depart: { x: number; y: number; impulsion: ImpulsionDef }
  /** les anneaux à passer, DANS L'ORDRE, posés sur la trajectoire idéale */
  anneaux: { x: number; y: number; r: number }[]
  /** la cible : le centre du corps doit y entrer pour conclure */
  cible: { x: number; y: number; r: number }
  dureeMax: number
  /** la part du volume gardée : ≥ p0 intact, ≥ p1 écorné, ≥ p2 entamé */
  paliers: [number, number, number]
}

export interface OrbitesDef {
  type: 'orbites'
  regles: ReglesOrbites
  reglages?: Partial<SimParams>
}

export interface EtatOrbites {
  anneauxPasses: number
  fini: boolean
  fin: 'cible' | 'temps' | null
}

export const ETAT_ORBITES_NEUF: EtatOrbites = { anneauxPasses: 0, fini: false, fin: null }

export interface ObservationOrbites {
  t: number
  x: number
  y: number
}

/** LES ORBITES AVANCENT d'une observation : le prochain anneau se passe
 *  quand le centre y entre (dans l'ordre, jamais un autre) ; la cible
 *  conclut ; le temps aussi. Pur. */
export function avanceOrbites(e: EtatOrbites, o: ObservationOrbites, r: ReglesOrbites): EtatOrbites {
  if (e.fini) return e
  let anneauxPasses = e.anneauxPasses
  const prochain = r.anneaux[anneauxPasses]
  if (prochain && Math.hypot(o.x - prochain.x, o.y - prochain.y) <= prochain.r) anneauxPasses++
  if (Math.hypot(o.x - r.cible.x, o.y - r.cible.y) <= r.cible.r) return { anneauxPasses, fini: true, fin: 'cible' }
  if (o.t >= r.dureeMax) return { anneauxPasses, fini: true, fin: 'temps' }
  return anneauxPasses === e.anneauxPasses ? e : { anneauxPasses, fini: false, fin: null }
}

/** LE VERDICT DES ORBITES : la part gardée dit le palier, chaque anneau
 *  manqué en retire un, et ne pas finir dans le croissant vaut rien. */
export function noteOrbites(partGardee: number, anneauxPasses: number, fin: EtatOrbites['fin'], r: ReglesOrbites, bareme: BaremeTrait = BAREME_TRAIT): NoteTrait {
  const ordre: NoteTrait['verdict'][] = ['juste', 'proche', 'loin', 'rate']
  let rang = partGardee >= r.paliers[0] ? 0 : partGardee >= r.paliers[1] ? 1 : partGardee >= r.paliers[2] ? 2 : 3
  rang = Math.min(3, rang + (r.anneaux.length - anneauxPasses))
  if (fin !== 'cible') rang = 3
  const verdict = ordre[rang]
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart: partGardee, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_ORBITES: Record<NoteTrait['verdict'], string> = {
  juste: 'EN ORBITE',
  proche: 'DÉVIÉ',
  loin: 'CAHOTÉ',
  rate: 'PERDU',
}

/** LE CROISSANT : l'arc hydrophile qui reçoit le corps au bout du chemin —
 *  le corps s'y colle, c'est l'arrivée. Son rayon extérieur est celui de la
 *  cible : le centre du corps n'entre dans la cible QUE par l'ouverture (de
 *  l'extérieur, la bande le tient à un rayon de corps du cercle). `angle`
 *  oriente la bande : elle se pose EN FACE du corps qui arrive, l'ouverture
 *  du côté d'où il vient. */
export function croissantOrbites(cible: { x: number; y: number; r: number }, angle: number): ObstacleBox {
  const R = cible.r
  return { minX: cible.x - R, minY: cible.y - R, maxX: cible.x + R, maxY: cible.y + R, material: MAT_HYDROPHILE, forme: FORME_ARC, p0: 0.3, p1: 110, p2: 0, angle }
}

// LES PUITS DES ORBITES : trois, EN QUINCONCE (le croquis les alignait ;
// mesuré par la recherche le 17/09 : alignés à 700 u, trois lancers sur
// huit mille enroulent les trois puits et aucun sans rebondir sur un bord ;
// en quinconce à ±350 u, des centaines de lancers propres).
// UN CŒUR DE 450 ET UNE FORCE DE 300, PAS LES DÉFAUTS (la revue du 17/09,
// sur le vrai corps) : aux défauts (300, 540), le meilleur enchaînement de
// trois virages laissait 55 % du corps au croissant — 8 % pour le lancer
// alors gelé. Un virage pris près de la lisière étire le corps (rms 73 →
// 200 u), le suivant déchire la traîne ; et un corps qui s'éloigne
// lentement d'un cœur s'étire dans son halo (la marée). Mesuré, le vrai
// corps dans la vraie salle (croissant compris, relabel au pas du jeu) sur
// les meilleurs lancers du point-masse : cœur 300 → 55 % au mieux ; cœur
// 450 → 73 % (force 400), 100 % (force 300, deux lancers voisins, jamais
// sous 100 % en route, verdict en 8,8 s). Les cœurs restent disjoints
// (955 u d'un puits à l'autre, 900 de cœurs) ; période du cœur 7,7 s.
const PUITS_ORBITES: PuitsDef[] = [
  { x: -350, y: 650, force: 300, rayon: 450 },
  { x: 350, y: 0, force: 300, rayon: 450 },
  { x: -350, y: -650, force: 300, rayon: 450 },
]

export const REGLES_ORBITES: ReglesOrbites = {
  puits: PUITS_ORBITES,
  // L'IMPULSION, LES ANNEAUX ET LA CIBLE : trouvés par orbites.recherche.spec.ts
  // le 17/09 (RECHERCHE_ORBITES=1 RECHERCHE_ORBITES_F=300 RECHERCHE_ORBITES_R=450
  // RECHERCHE_ORBITES_VRAIS=64 pnpm vitest run src/game/orbites.recherche.spec.ts,
  // balayage y0 −600…900, angle −60…40°, vitesse 150…600 ; 782 lancers
  // enroulent les trois puits d'un vrai virage — au moins un tiers de tour,
  // à 0,3-0,75 rayon du centre —, et le VRAI CORPS rejoue les 64 meilleurs
  // dans la vraie salle : celui-ci arrive ENTIER (100 %, jamais sous 100 %
  // en route), verdict en 8,8 s : autour du premier à 181 u, du deuxième à
  // 170 u, du troisième à 161 u, tous en sens horaire, puis il sort du
  // troisième cœur vers le croissant, cap 122°). Les anneaux sont posés à
  // mi-virage, la cible une demi-seconde après la sortie du troisième cœur
  // (le corps encore rond). À refaire si les puits, leur force ou leur
  // rayon changent.
  depart: { x: -900, y: 750, impulsion: { angle: 36, vitesse: 260 } },
  anneaux: [
    { x: -303, y: 825, r: 90 },
    { x: 528, y: -21, r: 90 },
    { x: -434, y: -791, r: 90 },
  ],
  cible: { x: -900, y: -459, r: 260 },
  dureeMax: 20,
  paliers: [0.9, 0.7, 0.45],
}
/** L'ORIENTATION DU CROISSANT : le corps arrive en montant vers la gauche (cap 122°) — la bande se pose en face, l'ouverture vers le bas-droite d'où il vient. */
export const CROISSANT_ORBITES_ANGLE = 122

/** La salle des orbites. `angleCroissant` : l'orientation de la bande (la
 *  recherche en essaie d'autres, avec d'autres règles ; le jeu prend la gelée). */
export function tableauOrbites(regles: ReglesOrbites = REGLES_ORBITES, angleCroissant: number = CROISSANT_ORBITES_ANGLE): LevelDef {
  return {
    name: 'Les orbites',
    code: CODE_ORBITES,
    journal:
      `Trois puits de gravité, et vous êtes lancé : leur gravité vous porte d'un virage à l'autre. ` +
      `Passez les trois anneaux dans l'ordre et finissez dans le croissant. Laisser porter ne coûte rien ; éjecter corrige la route, et chaque goutte compte. ` +
      `Intact au croissant, la mémoire triple ; chaque anneau manqué retire un palier.`,
    par: 4,
    bounds: { minX: -1200, minY: -1000, maxX: 1200, maxY: 1000 },
    spawn: { x: regles.depart.x, y: regles.depart.y, n: 900, impulsion: regles.depart.impulsion },
    exit: { minX: 1300, minY: -60, maxX: 1360, maxY: 60 },
    boxes: [croissantOrbites(regles.cible, angleCroissant)],
    puits: regles.puits,
    sponges: [],
    labels: [
      { x: -900, y: 930, text: 'LES ORBITES', tone: 'mur' },
      { x: -900, y: 600, text: '1 · VOUS ÊTES LANCÉ : LA GRAVITÉ VOUS PORTE', tone: 'mur' },
      { x: 850, y: -850, text: '2 · PASSEZ LES TROIS ANNEAUX — ÉJECTER CORRIGE, ET COÛTE', tone: 'mur' },
      { x: -900, y: -60, text: '3 · FINISSEZ DANS LE CROISSANT', tone: 'mur' },
    ],
    minijeu: { type: 'orbites', regles },
  }
}

// ---- LES CIBLES ----------------------------------------------------------------
//
// LES CIBLES (le concepteur, 17/09, croquis). Le corps EN GLACE tourne sans
// fin entre trois puits (la ronde, couchée) ; en dessous, trois MIRES — des
// cibles à points, 10 · 5 · 10 — sous des arcs qui les coiffent (hydrophobes
// sur les côtés, amorphe au milieu) et au-dessus d'un sol hydrophobe qui
// renvoie. LE TIR DE GLACE : viser ralentit le temps comme le dash de
// vapeur, relâcher détache un éclat qui file vers le doigt. Une touche vaut
// les points de la mire AU PRORATA DE LA TAILLE de ce qui touche — l'éclat
// du premier tir vaut 100 %, un amas d'éclats agglomérés davantage,
// jusqu'au double — ; l'éclat disparaît, la mire reste. Le corps rétrécit à
// chaque tir et ne s'épuise jamais (les éclats rapetissent). Trente
// secondes ; le verdict à des paliers de points. Le geste n'existe que par
// les RÉGLAGES du tableau (glaceTir) : ailleurs, en glace, rien ne part.

export interface ReglesCibles {
  puits: PuitsDef[]
  depart: { x: number; y: number; impulsion: ImpulsionDef }
  /** la durée de la partie (s), à partir du lancer */
  duree: number
  /** la part du corps de départ que vaut un éclat de référence (= glaceTir) : une touche vaut points × taille / (part × corps de départ) */
  reference: number
  /** le plafond du prorata : un amas ne vaut jamais plus que ce multiple des points */
  plafond: number
  /** les paliers de points : juste ≥ [0], proche ≥ [1], loin ≥ [2] */
  paliers: [number, number, number]
}

export interface CiblesDef {
  type: 'cibles'
  regles: ReglesCibles
  reglages?: Partial<SimParams>
}

export interface EtatCibles {
  points: number
  touches: number
  fini: boolean
}
export const ETAT_CIBLES_NEUF: EtatCibles = { points: 0, touches: 0, fini: false }

/** UNE TOUCHE : la mire touchée et la taille (en particules) de ce qui l'a touchée. */
export interface ToucheMire {
  mire: number
  taille: number
}

/** LES POINTS D'UNE TOUCHE : au prorata de la taille, plafonné. */
export function pointsTouche(mire: MireDef, taille: number, corpsDepart: number, r: ReglesCibles): number {
  const reference = Math.max(1, corpsDepart * r.reference)
  return Math.round(mire.points * Math.min(r.plafond, taille / reference))
}

/** AVANCER : les touches de l'image s'ajoutent ; le temps conclut. Pur. */
export function avanceCibles(e: EtatCibles, t: number, touches: readonly ToucheMire[], mires: readonly MireDef[], corpsDepart: number, r: ReglesCibles): EtatCibles {
  if (e.fini) return e
  let points = e.points
  let n = e.touches
  for (const tc of touches) {
    const m = mires[tc.mire]
    if (!m) continue
    points += pointsTouche(m, tc.taille, corpsDepart, r)
    n++
  }
  if (t >= r.duree) return { points, touches: n, fini: true }
  return points === e.points && n === e.touches ? e : { points, touches: n, fini: false }
}

/** LE VERDICT DES CIBLES : les points aux paliers. */
export function noteCibles(points: number, r: ReglesCibles, bareme: BaremeTrait = BAREME_TRAIT): NoteTrait {
  const verdict: NoteTrait['verdict'] = points >= r.paliers[0] ? 'juste' : points >= r.paliers[1] ? 'proche' : points >= r.paliers[2] ? 'loin' : 'rate'
  const facteur = verdict === 'juste' ? bareme.juste : verdict === 'proche' ? bareme.proche : verdict === 'loin' ? bareme.loin : 0
  return { ecart: points, verdict, memoire: Math.round(bareme.base * facteur) }
}

export const VERDICTS_CIBLES: Record<NoteTrait['verdict'], string> = {
  juste: 'EN PLEIN',
  proche: 'TOUCHÉ',
  loin: 'EFFLEURÉ',
  rate: 'MANQUÉ',
}

/** LE PRESET « TIR DE GLACE » : ce que le tableau recouvre du banc — le
 *  geste lui-même (une part de 10 % du corps par éclat, 900 u/s à pleine
 *  puissance), et une glace qui rebondit franchement sur les bandes. */
export const REGLAGES_CIBLES: Partial<SimParams> = {
  glaceTir: 0.1,
  glaceTirVitesse: 900,
  iceRestitution: 0.8,
  hydrophobeIceRestitution: 1.1,
}

// LA RONDE COUCHÉE : les puits de la ronde (ronde.ts : cœur 350, force 600,
// écart 800, lancer à 200 du puits du milieu à 451 u/s — l'orbite fermée
// tirée le 17/09), tournée d'un quart de tour pour que les trois lobes
// s'étalent en largeur au-dessus des mires. Le plan de la salle est celui du
// croquis : les mires en bas, chacune sous son arc, le sol qui renvoie.
const Y_RONDE = 350
const Y_MIRES = -650
export const REGLES_CIBLES: ReglesCibles = {
  puits: [
    { x: -800, y: Y_RONDE, force: 600, rayon: 350 },
    { x: 0, y: Y_RONDE, force: 600, rayon: 350 },
    { x: 800, y: Y_RONDE, force: 600, rayon: 350 },
  ],
  depart: { x: 0, y: Y_RONDE + 200, impulsion: { angle: 0, vitesse: 451 } },
  duree: 30,
  reference: 0.1,
  plafond: 2,
  // UNE HYPOTHÈSE, à éprouver en main : le corps passe au-dessus d'une mire
  // toutes les quatre à cinq secondes, un tir posé vaut dix — soixante
  // points, c'est six tirs en plein en trente secondes
  paliers: [60, 30, 10],
}
export const MIRES_CIBLES: MireDef[] = [
  { x: -800, y: Y_MIRES, r: 70, points: 10 },
  { x: 0, y: Y_MIRES, r: 110, points: 5 },
  { x: 800, y: Y_MIRES, r: 70, points: 10 },
]

/** L'ARC qui coiffe une mire : la bande en haut, ouverte vers le bas (les
 *  éclats n'entrent que de biais, ou par le sol qui renvoie). */
function arcMire(m: MireDef, material: number): ObstacleBox {
  const R = 230
  return { minX: m.x - R, minY: m.y - R, maxX: m.x + R, maxY: m.y + R, material, forme: FORME_ARC, p0: 0.22, p1: 75, p2: 0, angle: 90 }
}

export function tableauCibles(regles: ReglesCibles = REGLES_CIBLES, mires: MireDef[] = MIRES_CIBLES): LevelDef {
  const b = { minX: -1300, minY: -1000, maxX: 1300, maxY: 900 }
  return {
    name: 'Les cibles',
    code: CODE_CIBLES,
    journal:
      `En glace, lancé entre trois puits : la gravité vous porte. Visez, le temps ralentit ; relâchez, un éclat part vers le doigt — plus loin le doigt, plus vite. ` +
      `Trois cibles en bas, sous leurs arcs : une touche vaut ses points, à la taille de l'éclat. Chaque tir vous rétrécit, jamais jusqu'au bout. ` +
      `${regles.duree} secondes : le plus de points possible.`,
    par: 6,
    bounds: b,
    spawn: { x: regles.depart.x, y: regles.depart.y, n: 900, impulsion: regles.depart.impulsion },
    exit: { minX: 1500, minY: -60, maxX: 1560, maxY: 60 },
    boxes: [
      arcMire(mires[0], MAT_HYDROPHOBE),
      arcMire(mires[1], MAT_WALL),
      arcMire(mires[2], MAT_HYDROPHOBE),
      // le sol qui renvoie : un tir manqué remonte sous les arcs
      { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.minY + 40, material: MAT_HYDROPHOBE },
    ],
    sponges: [],
    zones: [{ ...b, force: 'glace', label: 'GLACE' }],
    puits: regles.puits,
    mires,
    labels: [
      { x: -1000, y: 820, text: 'LES CIBLES', tone: 'mur' },
      { x: 1000, y: 820, text: '1 · EN GLACE : VISEZ, LE TEMPS RALENTIT — RELÂCHEZ, UN ÉCLAT PART', tone: 'mur' },
      { x: -400, y: -880, text: '2 · TOUCHEZ LES CIBLES : LES POINTS VONT À LA TAILLE DE L’ÉCLAT', tone: 'mur' },
      { x: 400, y: -880, text: `3 · ${regles.duree} SECONDES — CHAQUE TIR VOUS RÉTRÉCIT`, tone: 'mur' },
    ],
    minijeu: { type: 'cibles', regles, reglages: REGLAGES_CIBLES },
  }
}
