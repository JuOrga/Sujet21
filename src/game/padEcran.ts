// LE PILOTAGE MANETTE D'UN ÉCRAN À RAYONS — le schéma des maquettes
// « Marchand v2 » et « Codex v2 » du concepteur (04/09).
//
// Le parcours générique des menus (main.ts, navigueMenu) va « au bouton le
// plus proche dans la direction pressée » : il suffit à une fiche ou à un
// panneau de réglages, pas à un écran de boutique — trois colonnes, des
// rayons, des filtres, une action principale. Le concepteur a dessiné un
// schéma fixe pour ces écrans-là, et c'est lui que ce module donne :
//
//   croix / stick gauche   parcourir la grille (une case à la fois)
//   LB / RB                le rayon précédent / suivant
//   A                      l'action principale (acheter, marquer l'objectif)
//   X · Y                  les bascules de l'écran (filtre, mode)
//   B                      quitter
//
// Le clavier suit le même schéma (flèches, ⏎, Q/E, F/R, Échap), et la
// légende en pied de l'écran dit les touches dans la langue de ce qui a la
// main — les boutons colorés de la manette, ou les touches du clavier.
//
// Tout ici est calcul pur, testable sans DOM : les écrans ne font que
// relever les gestes et peindre la légende.

import { BOUTON } from './manette'

export type Geste =
  | 'haut'
  | 'bas'
  | 'gauche'
  | 'droite'
  | 'A'
  | 'B'
  | 'X'
  | 'Y'
  | 'LB'
  | 'RB'

/** Ce que le pilote lit d'une manette : les fronts des boutons et le
 *  stick gauche (la classe Manette les fournit tels quels). */
export interface LectureManette {
  edge(i: number): boolean
  force: number
  dirX: number
  dirY: number
}

// la cadence du stick : un cran, une attente, puis la répétition douce —
// les mêmes temps que le parcours générique, pour que la main ne sente
// pas la différence d'un écran à l'autre
const ATTENTE_REPETITION = 0.34
const CADENCE_REPETITION = 0.12
const SEUIL_STICK = 0.55
const RELACHE_STICK = 0.3

const BOUTONS: readonly [number, Geste][] = [
  [BOUTON.A, 'A'],
  [BOUTON.B, 'B'],
  [BOUTON.X, 'X'],
  [BOUTON.Y, 'Y'],
  [BOUTON.LB, 'LB'],
  [BOUTON.RB, 'RB'],
]

/** Relève les gestes d'une image : les boutons au front montant, puis AU
 *  PLUS une direction — la croix d'abord, sinon le stick, avec un cran
 *  anti-répétition puis la répétition au maintien. */
export class PiloteEcran {
  private stickTenu = false
  private depuis = 0

  lit(m: LectureManette, now: number): Geste[] {
    const out: Geste[] = []
    for (const [i, g] of BOUTONS) if (m.edge(i)) out.push(g)
    let dir: Geste | null = null
    if (m.edge(BOUTON.HAUT)) dir = 'haut'
    else if (m.edge(BOUTON.BAS)) dir = 'bas'
    else if (m.edge(BOUTON.GAUCHE)) dir = 'gauche'
    else if (m.edge(BOUTON.DROITE)) dir = 'droite'
    else if (m.force > SEUIL_STICK) {
      if (!this.stickTenu || now - this.depuis > ATTENTE_REPETITION) {
        dir =
          Math.abs(m.dirY) > Math.abs(m.dirX)
            ? m.dirY > 0
              ? 'bas'
              : 'haut'
            : m.dirX > 0
              ? 'droite'
              : 'gauche'
        // la première répétition attend, les suivantes viennent plus vite
        this.depuis = this.stickTenu
          ? now - (ATTENTE_REPETITION - CADENCE_REPETITION)
          : now
        this.stickTenu = true
      }
    }
    if (m.force < RELACHE_STICK) this.stickTenu = false
    if (dir) out.push(dir)
    return out
  }
}

/** Le même schéma au clavier — null : la touche n'en fait pas partie. */
export function gesteClavier(key: string): Geste | null {
  switch (key) {
    case 'ArrowUp':
      return 'haut'
    case 'ArrowDown':
      return 'bas'
    case 'ArrowLeft':
      return 'gauche'
    case 'ArrowRight':
      return 'droite'
    case 'Enter':
      return 'A'
    case 'Escape':
      return 'B'
  }
  switch (key.toLowerCase()) {
    case 'q':
      return 'LB'
    case 'e':
      return 'RB'
    case 'f':
      return 'X'
    case 'r':
      return 'Y'
  }
  return null
}

// ---- LA GRILLE ----------------------------------------------------------------

/** La case voisine dans une grille de `n` cases sur `cols` colonnes, depuis
 *  la case `i`. À l'horizontale, on boucle ; à la verticale, on s'arrête
 *  aux bords — et descendre sur une dernière rangée incomplète mène à sa
 *  dernière case plutôt que nulle part. null : rien à faire. */
export function voisinGrille(
  n: number,
  i: number,
  dx: number,
  dy: number,
  cols: number,
): number | null {
  if (n <= 0) return null
  if (i < 0 || i >= n) return 0 // rien de choisi : on part du début
  const c = Math.max(1, Math.floor(cols))
  if (dx !== 0) return (i + dx + n) % n
  if (dy === 0) return null
  const cible = i + dy * c
  if (cible >= 0 && cible < n) return cible
  if (dy > 0 && Math.floor(i / c) < Math.floor((n - 1) / c)) return n - 1
  return null
}

/** Le nombre de colonnes d'une grille CSS, lu sur son rendu — 1 à défaut. */
export function colonnesDe(grille: Element | null): number {
  if (!grille || typeof getComputedStyle !== 'function') return 1
  const cols = getComputedStyle(grille).gridTemplateColumns
  if (!cols || cols === 'none') return 1
  return Math.max(1, cols.trim().split(/\s+/).length)
}

// ---- LA LÉGENDE -------------------------------------------------------------------

export type BoutonLegende = 'A' | 'B' | 'X' | 'Y' | 'LBRB' | 'CROIX'

export interface EntreeLegende {
  b: BoutonLegende
  /** le libellé — vide : le bouton ne fait rien ici, on le montre en creux */
  t: string
}

const GLYPHES_MANETTE: Record<BoutonLegende, string[]> = {
  A: ['A'],
  B: ['B'],
  X: ['X'],
  Y: ['Y'],
  LBRB: ['LB', 'RB'],
  CROIX: ['✚'],
}
const GLYPHES_CLAVIER: Record<BoutonLegende, string[]> = {
  A: ['⏎'],
  B: ['ÉCHAP'],
  X: ['F'],
  Y: ['R'],
  LBRB: ['Q', 'E'],
  CROIX: ['◀▶▲▼'],
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** La barre de légende : chaque entrée avec son (ses) bouton(s) et son
 *  libellé, puis qui a la main. `manette` : la manette est branchée, on
 *  parle ses boutons ; sinon les touches du clavier. */
export function legendeHTML(entrees: readonly EntreeLegende[], manette: boolean): string {
  const glyphes = manette ? GLYPHES_MANETTE : GLYPHES_CLAVIER
  const touches = entrees
    .map((e) => {
      const kbd = glyphes[e.b]
        .map(
          (g) =>
            `<kbd class="pe-b pe-b--${e.b}${manette && g.length === 1 ? ' pe-ronde' : ''}">${g}</kbd>`,
        )
        .join('')
      return `<span class="pe-touche${e.t ? '' : ' pe-muette'}">${kbd}<i>${esc(e.t || '—')}</i></span>`
    })
    .join('')
  return `${touches}<em class="pe-source">${manette ? '🎮 MANETTE DÉTECTÉE' : 'CLAVIER'}</em>`
}
