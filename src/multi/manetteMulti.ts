// LA MANETTE DU MULTI — Steam Deck, Xbox, DualSense : l'API Gamepad standard.
//
// Le jeu a sa manette (game/manette.ts), mais il ne la relève pas tant que le
// multi couvre l'écran, et elle porte tout ce qui n'a pas cours ici (la
// caméra, le zoom, la glace, la vapeur, les menus). Le multi lit donc la
// sienne, en quelques lignes, et sans minuterie : une lecture par image.
//
// LE SCHÉMA :
//   stick gauche    où l'on VA — et par où partira le palet
//   A ou RT         pousser (le clic maintenu)
//   LT ou LB        s'OUVRIR, tant qu'on tient (la barre d'espace)
//   stick au repos + A   se rassembler
//   Start           recommencer
//
// POURQUOI « OÙ L'ON VA ». À la souris on vise où part le JET, et le corps
// file à l'opposé : pour aller à droite on clique à gauche. Le pointeur s'y
// prête, on vise un point de l'écran ; un stick, lui, se pousse du côté où
// l'on veut aller — le pousser à l'inverse de sa route, c'est piloter à
// l'envers. La commande porte donc un drapeau, `aller` : la visée dit où
// aller, l'hôte tire le jet à l'opposé. Et le palet, lui, part bien vers la
// visée : au hockey on pousse le stick vers la cage et on relâche.

import type { Commande } from './trame'

/** Ce qu'on lit d'un Gamepad (le strict nécessaire : les tests en posent un
 *  faux, sans navigateur). */
export interface PadLu {
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[]
  readonly axes: readonly number[]
}

const A = 0
const LB = 4
const LT = 6
const RT = 7
const START = 9
/** La zone morte radiale du stick, celle du jeu. */
const MORT = 0.18
/** La distance du point visé au cœur du corps : au repos du stick puis à
 *  pleine inclinaison. Elle doit dépasser le corps (~105 u de rayon, et le
 *  jeu tient pour « sur le corps » ce qui en est à 19 u) : en deçà, pousser
 *  rassemblerait au lieu de faire avancer. */
const PORTEE_MIN = 220
const PORTEE_MAX = 380

export interface EtatManette {
  connectee: boolean
  /** La direction du stick, mémorisée : relâché, il la garde (le trait de
   *  visée du palet ne saute pas). Unitaire, y vers le bas comme l'écran. */
  dirX: number
  dirY: number
  /** L'inclinaison du stick, de 0 à 1 après la zone morte. */
  force: number
  pousse: boolean
  ouvert: boolean
  /** Start vient d'être pressé (un front : vrai une lecture seulement). */
  recommence: boolean
  /** Cette lecture a vu une entrée : la manette prend la main. */
  vie: boolean
  startTenu: boolean
}

export function nouvelEtatManette(): EtatManette {
  return { connectee: false, dirX: 1, dirY: 0, force: 0, pousse: false, ouvert: false, recommence: false, vie: false, startTenu: false }
}

/** Relève la manette dans `e`. `pad` nul : débranchée, plus rien n'est tenu. */
export function litManette(pad: PadLu | null, e: EtatManette): void {
  e.recommence = false
  e.vie = false
  if (!pad) {
    e.connectee = false
    e.force = 0
    e.pousse = false
    e.ouvert = false
    e.startTenu = false
    return
  }
  e.connectee = true
  const presse = (i: number): boolean => {
    const b = pad.buttons[i]
    return b ? b.pressed || b.value > 0.5 : false
  }
  const ax = pad.axes[0] ?? 0
  const ay = pad.axes[1] ?? 0
  const mag = Math.hypot(ax, ay)
  if (mag > MORT) {
    e.force = Math.min(1, (mag - MORT) / (1 - MORT))
    e.dirX = ax / mag
    e.dirY = ay / mag
    e.vie = true
  } else {
    e.force = 0
  }
  e.pousse = presse(A) || presse(RT)
  e.ouvert = presse(LT) || presse(LB)
  const start = presse(START)
  e.recommence = start && !e.startTenu
  e.startTenu = start
  if (e.pousse || e.ouvert || start) e.vie = true
}

/** La commande que donne la manette, pour un corps dont le cœur est en
 *  (cx, cy). Stick au repos et bouton de poussée tenu : on vise son propre
 *  cœur — c'est le geste du rassemblement. */
export function commandeManette(e: EtatManette, cx: number, cy: number): Commande {
  if (e.force === 0 && e.pousse) return { pousse: true, ouvert: e.ouvert, x: cx, y: cy, aller: true }
  const portee = PORTEE_MIN + (PORTEE_MAX - PORTEE_MIN) * e.force
  return {
    // sans inclinaison on ne pousse pas : la direction mémorisée ne sert
    // qu'au trait de visée du palet
    pousse: e.pousse && e.force > 0,
    ouvert: e.ouvert,
    x: cx + e.dirX * portee,
    y: cy + e.dirY * portee,
    aller: true,
  }
}
