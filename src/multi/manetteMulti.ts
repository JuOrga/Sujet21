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
//   B ou RB         le DASH (la touche Maj)
//   X ou Y          la GLACE, tant qu'on tient (la touche F)
//   stick au repos + A   se rassembler
//   Start           recommencer            Select   quitter la partie
//
// AU SALON (et sur un message qui barre l'écran) : la croix ou le stick
// passent d'un bouton à l'autre, A valide, B revient en arrière. Pour
// REJOINDRE, le code se compose à la croix : ←→ choisit la case, ↑↓ fait
// défiler les caractères — cinq cases, pas de clavier à l'écran.
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
const RB = 5
const LT = 6
const RT = 7
const B = 1
const X = 2
const Y = 3
const SELECT = 8
const START = 9
const HAUT = 12
const BAS = 13
const GAUCHE = 14
const DROITE = 15
/** Au salon, le stick vaut une croix au-delà de cette inclinaison. */
const SEUIL_MENU = 0.6
/** Une direction TENUE se répète : après ce délai, puis à cette cadence (ms). */
const REPETE_APRES = 380
const REPETE_TOUS = 130
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
  /** Le bouton du dash est tenu (c'est l'hôte qui en lit l'appui). */
  dash: boolean
  /** Le bouton de la glace est tenu. */
  glace: boolean
  /** Start vient d'être pressé (un front : vrai une lecture seulement). */
  recommence: boolean
  /** Select vient d'être pressé : quitter la partie. */
  quitte: boolean
  /** Cette lecture a vu une entrée : la manette prend la main. */
  vie: boolean
  startTenu: boolean
  selectTenu: boolean
}

export function nouvelEtatManette(): EtatManette {
  return { connectee: false, dirX: 1, dirY: 0, force: 0, pousse: false, ouvert: false, dash: false, glace: false, recommence: false, quitte: false, vie: false, startTenu: false, selectTenu: false }
}

/** Relève la manette dans `e`. `pad` nul : débranchée, plus rien n'est tenu. */
export function litManette(pad: PadLu | null, e: EtatManette): void {
  e.recommence = false
  e.quitte = false
  e.vie = false
  if (!pad) {
    e.connectee = false
    e.force = 0
    e.pousse = false
    e.ouvert = false
    e.dash = false
    e.glace = false
    e.startTenu = false
    e.selectTenu = false
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
  e.dash = presse(B) || presse(RB)
  e.glace = presse(X) || presse(Y)
  const start = presse(START)
  e.recommence = start && !e.startTenu
  e.startTenu = start
  const select = presse(SELECT)
  e.quitte = select && !e.selectTenu
  e.selectTenu = select
  if (e.pousse || e.ouvert || e.dash || e.glace || start || select) e.vie = true
}

// ---- le salon ---------------------------------------------------------------

/** Ce qu'il faut retenir d'une lecture à l'autre pour lire des APPUIS. */
export interface EtatMenu {
  /** La direction tenue (0 : aucune ; 1 haut, 2 bas, 3 gauche, 4 droite) et
   *  l'heure de sa prochaine répétition. */
  tenue: number
  prochaine: number
  aTenu: boolean
  bTenu: boolean
}
export function nouvelEtatMenu(): EtatMenu {
  // A et B « déjà tenus » : le bouton encore enfoncé quand le salon s'ouvre
  // (on vient de valider MULTI sur l'accueil) ne doit pas valider ici aussi
  return { tenue: 0, prochaine: 0, aTenu: true, bTenu: true }
}

/** Un geste de salon : un pas dans une direction, valider, revenir. */
export interface GesteMenu {
  dx: number
  dy: number
  valide: boolean
  retour: boolean
}

/** Lit un geste de salon. `maintenant` en millisecondes. Une direction
 *  tenue donne un pas tout de suite, puis se répète. */
export function litMenu(pad: PadLu | null, e: EtatMenu, maintenant: number): GesteMenu {
  const g: GesteMenu = { dx: 0, dy: 0, valide: false, retour: false }
  if (!pad) {
    e.tenue = 0
    e.aTenu = false
    e.bTenu = false
    return g
  }
  const presse = (i: number): boolean => {
    const b = pad.buttons[i]
    return b ? b.pressed || b.value > 0.5 : false
  }
  const ax = pad.axes[0] ?? 0
  const ay = pad.axes[1] ?? 0
  let dir = 0
  if (presse(HAUT)) dir = 1
  else if (presse(BAS)) dir = 2
  else if (presse(GAUCHE)) dir = 3
  else if (presse(DROITE)) dir = 4
  else if (Math.abs(ay) > SEUIL_MENU && Math.abs(ay) >= Math.abs(ax)) dir = ay < 0 ? 1 : 2
  else if (Math.abs(ax) > SEUIL_MENU) dir = ax < 0 ? 3 : 4
  let pas = false
  if (dir !== e.tenue) {
    e.tenue = dir
    e.prochaine = maintenant + REPETE_APRES
    pas = dir !== 0
  } else if (dir !== 0 && maintenant >= e.prochaine) {
    e.prochaine = maintenant + REPETE_TOUS
    pas = true
  }
  if (pas) {
    if (dir === 1) g.dy = -1
    else if (dir === 2) g.dy = 1
    else if (dir === 3) g.dx = -1
    else g.dx = 1
  }
  const a = presse(A)
  const b = presse(B)
  g.valide = a && !e.aTenu
  g.retour = b && !e.bTenu
  e.aTenu = a
  e.bTenu = b
  return g
}

/** Le bouton vers lequel mène un pas, parmi ceux de l'écran : le plus proche
 *  dans la direction demandée, en préférant celui qui est bien dans l'axe.
 *  −1 si rien n'est de ce côté-là. `depuis` et `boutons` sont des centres. */
export function voisinMenu(depuis: { x: number; y: number }, boutons: readonly { x: number; y: number }[], dx: number, dy: number): number {
  let meilleur = -1
  let cout = Infinity
  for (let i = 0; i < boutons.length; i++) {
    const ex = boutons[i].x - depuis.x
    const ey = boutons[i].y - depuis.y
    const avance = ex * dx + ey * dy
    if (avance < 4) continue // pas de ce côté (ou le bouton lui-même)
    const travers = Math.abs(ex * dy) + Math.abs(ey * dx)
    // presque à la perpendiculaire : ce n'est pas « de ce côté », c'est
    // ailleurs (un bouton à 40 px à gauche mais 180 px plus bas)
    if (avance < travers * 0.5) continue
    // l'écart de travers coûte double : on reste sur sa ligne tant qu'on peut
    const c = avance + travers * 2
    if (c < cout) {
      cout = c
      meilleur = i
    }
  }
  return meilleur
}

/** Fait défiler UN caractère du code : `sens` vaut +1 ou −1, et l'alphabet
 *  boucle. Un caractère hors de l'alphabet repart du premier. */
export function defileCaractere(alphabet: string, caractere: string, sens: number): string {
  const i = alphabet.indexOf(caractere)
  if (i < 0) return alphabet[0]
  return alphabet[(i + sens + alphabet.length) % alphabet.length]
}

/** La commande que donne la manette, pour un corps dont le cœur est en
 *  (cx, cy). Stick au repos et bouton de poussée tenu : on vise son propre
 *  cœur — c'est le geste du rassemblement. */
export function commandeManette(e: EtatManette, cx: number, cy: number): Commande {
  if (e.force === 0 && e.pousse) return { pousse: true, ouvert: e.ouvert, x: cx, y: cy, aller: true, dash: e.dash, glace: e.glace }
  const portee = PORTEE_MIN + (PORTEE_MAX - PORTEE_MIN) * e.force
  return {
    // sans inclinaison on ne pousse pas : la direction mémorisée ne sert
    // qu'au trait de visée du palet
    pousse: e.pousse && e.force > 0,
    ouvert: e.ouvert,
    x: cx + e.dirX * portee,
    y: cy + e.dirY * portee,
    aller: true,
    dash: e.dash,
    glace: e.glace,
  }
}

// ---- ce que le navigateur voit ------------------------------------------------
//
// LE DIAGNOSTIC. Le concepteur (22/11) : « j'ai essayé en écran partagé mais
// aucune manette ne fonctionne alors que j'en ai deux connectées en
// Bluetooth, une Xbox One et une PS4 ». Le mode à deux avait été essayé avec
// des manettes SIMULÉES : ce qu'un vrai navigateur rend pour de vraies
// manettes n'avait jamais été vu. Plusieurs causes donnent le même écran
// mort, et l'écran ne permettait pas de les distinguer :
//  - le navigateur ne montre une manette qu'après un APPUI sur l'un de ses
//    boutons, la page au premier plan — avant, il n'en rend aucune ;
//  - certains navigateurs ne donnent pas du tout accès aux manettes (une
//    protection contre le pistage, par exemple) ;
//  - une manette vue en disposition NON STANDARD n'a pas ses boutons aux
//    places attendues : A n'est plus le bouton 0, les gâchettes peuvent être
//    des axes — elle est là, et rien ne répond.
// Le salon et la partie à deux disent donc ce que le navigateur voit : chaque
// manette, sa disposition, et les boutons tenus en ce moment.

/** Une manette telle que le navigateur la décrit. */
export interface PadVu extends PadLu {
  readonly id: string
  readonly mapping: string
}

/** Les noms des boutons de la disposition standard, dans l'ordre. */
const NOMS_BOUTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Guide']

/** Un nom lisible pour une manette, d'après ce que le navigateur en dit.
 *  Chrome écrit « Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e
 *  Product: 02fd) », Firefox « 045e-02fd-Xbox Wireless Controller », Safari
 *  le seul nom : on reconnaît le fabricant à son numéro (045e Microsoft,
 *  054c Sony) ou à son nom, sinon on garde le nom, nettoyé. */
export function nomManette(id: string): string {
  const bas = id.toLowerCase()
  if (/\b045e\b|xbox|xinput/.test(bas)) return 'manette Xbox'
  if (/\b054c\b|dualshock|dualsense|playstation|ps4|ps5/.test(bas) || /^wireless controller\b/.test(bas)) return 'manette PlayStation'
  const propre = id
    .replace(/\s*\(.*\)\s*$/, '')
    .replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '')
    .trim()
  if (!propre) return 'manette'
  return propre.length > 28 ? propre.slice(0, 27) + '…' : propre
}

/** Ce qu'on tient en ce moment sur cette manette : les boutons (par leur nom
 *  en disposition standard, par leur numéro sinon) et le stick incliné. */
export function tenusSur(pad: PadVu): string[] {
  const standard = pad.mapping === 'standard'
  const tenus: string[] = []
  for (let i = 0; i < pad.buttons.length; i++) {
    const b = pad.buttons[i]
    if (!b || !(b.pressed || b.value > 0.5)) continue
    tenus.push(standard && i < NOMS_BOUTONS.length ? NOMS_BOUTONS[i] : `bouton ${i}`)
  }
  if (standard) {
    if (Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > MORT) tenus.push('stick')
  } else {
    // hors disposition standard, on ne sait pas quel axe est quel stick :
    // on les nomme tous, c'est ce qui permettra de les replacer
    for (let i = 0; i < pad.axes.length; i++) if (Math.abs(pad.axes[i] ?? 0) > 0.5) tenus.push(`axe ${i}`)
  }
  return tenus
}

/** Une manette décrite en une ligne : son nom, sa disposition si elle n'est
 *  pas standard, et ce qu'on y tient. */
export function decritManette(pad: PadVu): string {
  const tenus = tenusSur(pad)
  return nomManette(pad.id) + (pad.mapping === 'standard' ? '' : ' (disposition non standard : ses boutons peuvent ne pas répondre)') + (tenus.length > 0 ? ` — ${tenus.join(', ')}` : '')
}

/** La ligne du salon : ce que le navigateur voit. `pads` est null quand le
 *  navigateur ne donne pas accès aux manettes. */
export function ligneManettes(pads: readonly PadVu[] | null): string {
  if (pads === null) return 'MANETTES : ce navigateur ne donne pas accès aux manettes.'
  if (pads.length === 0) return 'MANETTES : aucune vue par le navigateur. Appuyez sur un bouton de chacune, cette page au premier plan — le navigateur ne les montre qu’après un appui.'
  return `MANETTES : ${pads.map((p, k) => `${k + 1}. ${decritManette(p)}`).join(' · ')}`
}

/** À DEUX SUR CET ÉCRAN : la manette de chaque joueur. Deux manettes ou
 *  plus : la première au joueur 1, la deuxième au joueur 2. Une seule : elle
 *  est au joueur 2, le joueur 1 garde souris et clavier. */
export function manettesDuLocal<P>(pads: readonly P[]): [P | null, P | null] {
  if (pads.length >= 2) return [pads[0], pads[1]]
  return [null, pads[0] ?? null]
}

/** La ligne d'état d'une partie à deux sur cet écran : qui joue avec quoi. */
export function ligneLocale(pads: readonly PadVu[] | null): string {
  if (pads === null) return 'à deux sur cet écran — ce navigateur ne donne pas accès aux manettes'
  const [p1, p2] = manettesDuLocal(pads)
  const j1 = p1 ? nomManette(p1.id) : 'souris et clavier'
  const j2 = p2 ? nomManette(p2.id) : 'aucune manette vue — appuyez sur l’un de ses boutons'
  const nonStandard = [p1, p2].some((p) => p && p.mapping !== 'standard') ? ' · disposition non standard : des boutons peuvent ne pas répondre' : ''
  return `à deux sur cet écran — J1 : ${j1} · J2 : ${j2}${nonStandard}`
}
