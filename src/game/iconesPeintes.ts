// ---- LES ICÔNES PEINTES : LE CYCLE DES ÉTATS ET LES TROPHÉES ----------------
// Le cycle, le codex, les trophées et la carte de la station montraient des
// EMOJI : ❄ 💧 💨 🏔 changent de dessin d'une machine à l'autre, et une machine
// sans police emoji n'affiche qu'un carré vide. Deux planches rendues dans
// Blender les remplacent (docs/assets-ia.md §23a, §23b). Ce module est le
// CONTRAT entre l'atelier qui les fabrique et l'interface qui les découpe :
// l'ordre des cases, la grille, l'adresse — sur le modèle de `metaAssets.ts`
// (--ic-x / --ic-y) et de `iconesStation.ts` (canvas).
//
// LE REPLI. Une planche peut manquer (pas encore livrée, réseau coupé) : le
// jeu ne doit alors RIEN perdre. Au canvas, `dessine…` rend false et
// l'appelant garde son dessin. En HTML, une image de fond absente ne se voit
// pas — elle ne dit pas qu'elle manque. La pastille porte donc l'emoji
// d'avant, en texte, et la feuille ne montre la planche (et ne cache l'emoji)
// que lorsque la racine porte la classe `planche-…` : `guettePlanche` la pose
// à l'arrivée d'une image réelle. Sans elle, l'écran est celui d'hier.

import { ETATS_CYCLE, type EtatCycle } from './cycle'

/** Les cases de la planche du cycle, dans l'ORDRE du fichier (4 × 3, lecture
 *  ligne par ligne) : les quatre états, puis les huit transformations. Les
 *  noms sont ceux du jeu (`EtatCycle`, `TRANSFOS_CYCLE[].id`). */
export const ICONES_CYCLE = [
  'solide', 'liquide', 'gaz', 'plasma',
  'fusion', 'liquefaction', 'solidification', 'vaporisation',
  'sublimation', 'condensation', 'ionisation', 'deionisation',
] as const
export type IconeCycle = (typeof ICONES_CYCLE)[number]

export const ICONES_CYCLE_URL = '/assets/cycle-icones.webp' // 1024 × 768, cases de 256²
export const ICONES_CYCLE_COLONNES = 4
export const ICONES_CYCLE_RANGEES = 3
const CYCLE_CASE = 256
/** La classe que la racine du document prend quand la planche est arrivée. */
export const CLASSE_PLANCHE_CYCLE = 'planche-cycle'

/** L'ordre des trophées sur leur planche (4 × 2). Écrit EN TOUTES LETTRES, sans
 *  dériver de `TROPHEES` : la planche est un fichier, la liste peut bouger —
 *  un trophée inséré au milieu ne doit pas changer le dessin des suivants. Le
 *  test vérifie qu'aujourd'hui les deux coïncident. */
export const ORDRE_TROPHEES: readonly string[] = [
  'sans-une-goutte', 'palet-parfait', 'trois-etats', 'ligne-de-crete',
  'miroir-vivant', 'recondense', 'integrale', 'operateur-de-nuit',
]
export const ICONES_TROPHEES_URL = '/assets/trophees-icones.webp' // 1024 × 512, cases de 256²
export const ICONES_TROPHEES_COLONNES = 4
export const ICONES_TROPHEES_RANGEES = 2
export const CLASSE_PLANCHE_TROPHEES = 'planche-trophees'

/** La case d'une icône du cycle (état ou transformation), ou null. */
export function caseCycle(id: string): number | null {
  const c = (ICONES_CYCLE as readonly string[]).indexOf(id)
  return c < 0 ? null : c
}

/** La case d'un trophée, ou null (trophée ajouté après la planche). */
export function caseTrophee(id: string): number | null {
  const c = ORDRE_TROPHEES.indexOf(id)
  return c < 0 ? null : c
}

function echappe(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** La pastille : la case par --ic-x / --ic-y, l'emoji de repli dedans. Sans
 *  repli, elle est vide — et la feuille la retire tant que la planche manque
 *  (une transformation, qui n'avait pas d'icône, n'en montre alors aucune).
 *  Décorative : le texte voisin porte le sens. */
function pastille(classe: string, c: number, colonnes: number, secours: string): string {
  const col = c % colonnes
  const rang = Math.floor(c / colonnes)
  const repli = secours ? `<span class="ico-repli">${echappe(secours)}</span>` : ''
  return `<i class="${classe}" style="--ic-x:${col};--ic-y:${rang}" aria-hidden="true">${repli}</i>`
}

/** Une icône du cycle POUR L'INTERFACE, `secours` montré tant que la planche
 *  n'est pas arrivée. */
export function iconeCycleHTML(id: IconeCycle, secours = ''): string {
  return pastille('ico-cycle', ICONES_CYCLE.indexOf(id), ICONES_CYCLE_COLONNES, secours)
}

/** Un état, avec l'emoji que `ETATS_CYCLE` lui a toujours donné en repli. */
export function iconeEtatHTML(etat: EtatCycle): string {
  return iconeCycleHTML(etat, ETATS_CYCLE[etat].icone)
}

/** Un trophée : sa case, ou son emoji s'il n'en a pas — jamais un carré vide. */
export function iconeTropheeHTML(id: string, secours: string): string {
  const c = caseTrophee(id)
  if (c === null) return `<i>${echappe(secours)}</i>`
  return pastille('ico-trophee', c, ICONES_TROPHEES_COLONNES, secours)
}

// ---- LES GLYPHES D'ÉTAT DANS LES DONNÉES ----------------------------------------
// La carte de la station écrit ses badges dans sa donnée (« ❄ GLACE »), et le
// nom d'une coursive en découle. On ne touche pas la donnée — le concepteur
// la tape ainsi, l'éditeur la montre ainsi : on SÉPARE le glyphe au rendu.

const GLYPHES_ETAT: ReadonlyMap<string, EtatCycle> = new Map([
  ['❄', 'solide'],
  ['💧', 'liquide'],
  ['💨', 'gaz'],
])
/** un glyphe d'état, suivi ou non de son sélecteur de variante (texte, emoji) */
const GLYPHE = /(❄|💧|💨)[︎️]?/gu

/** Le glyphe d'état EN TÊTE d'un texte, et ce qui suit ; null s'il n'y en a pas. */
export function glypheEtat(texte: string): { etat: EtatCycle; glyphe: string; reste: string } | null {
  const m = /^((❄|💧|💨)[︎️]?)\s*/u.exec(texte)
  if (!m) return null
  return { etat: GLYPHES_ETAT.get(m[2])!, glyphe: m[1], reste: texte.slice(m[0].length) }
}

/** Chaque glyphe d'état d'un HTML DÉJÀ ÉCHAPPÉ devient son icône peinte. */
export function etatsEnIcones(html: string): string {
  return html.replace(GLYPHE, (_, g: string) => iconeEtatHTML(GLYPHES_ETAT.get(g)!))
}

// ---- EN SVG (la carte de la station) ---------------------------------------------
// Une image de fond CSS ne vit pas dans un SVG : un <svg> imbriqué sert de
// fenêtre (son viewBox tombe sur la case, son débordement est coupé), la
// planche entière posée dedans. Le repli est un <text> à la même place ; la
// feuille montre l'un ou l'autre selon la classe de la racine.

/** L'icône du cycle en SVG, carrée de `cote`, coin haut-gauche en (x, y). */
export function iconeCycleSVG(id: IconeCycle, x: number, y: number, cote: number, secours: string): string {
  const c = ICONES_CYCLE.indexOf(id)
  const vx = (c % ICONES_CYCLE_COLONNES) * CYCLE_CASE
  const vy = Math.floor(c / ICONES_CYCLE_COLONNES) * CYCLE_CASE
  return (
    `<svg class="ico-cycle-svg" x="${x}" y="${y}" width="${cote}" height="${cote}" viewBox="${vx} ${vy} ${CYCLE_CASE} ${CYCLE_CASE}" aria-hidden="true">` +
    `<image href="${ICONES_CYCLE_URL}" width="${CYCLE_CASE * ICONES_CYCLE_COLONNES}" height="${CYCLE_CASE * ICONES_CYCLE_RANGEES}"/></svg>` +
    `<text class="ico-cycle-repli" x="${x + cote / 2}" y="${y + cote / 2}">${echappe(secours)}</text>`
  )
}

// ---- AU CANVAS -------------------------------------------------------------------

function dessineCase(
  ctx: CanvasRenderingContext2D,
  planche: HTMLImageElement | null,
  c: number | null,
  colonnes: number,
  rangees: number,
  x: number,
  y: number,
  cote: number,
): boolean {
  if (!planche || c === null || !planche.complete || planche.naturalWidth === 0) return false
  const sw = planche.naturalWidth / colonnes
  const sh = planche.naturalHeight / rangees
  ctx.drawImage(planche, (c % colonnes) * sw, Math.floor(c / colonnes) * sh, sw, sh, x, y, cote, cote)
  return true
}

/** Au canvas : la case d'une icône du cycle si la planche est prête ; sinon
 *  false, et l'appelant garde son dessin d'attente. */
export function dessineIconeCycle(
  ctx: CanvasRenderingContext2D,
  planche: HTMLImageElement | null,
  id: IconeCycle,
  x: number,
  y: number,
  cote: number,
): boolean {
  return dessineCase(ctx, planche, caseCycle(id), ICONES_CYCLE_COLONNES, ICONES_CYCLE_RANGEES, x, y, cote)
}

/** Au canvas : la case d'un trophée, aux mêmes conditions. */
export function dessineIconeTrophee(
  ctx: CanvasRenderingContext2D,
  planche: HTMLImageElement | null,
  id: string,
  x: number,
  y: number,
  cote: number,
): boolean {
  return dessineCase(ctx, planche, caseTrophee(id), ICONES_TROPHEES_COLONNES, ICONES_TROPHEES_RANGEES, x, y, cote)
}

// ---- LE GUET DES PLANCHES ----------------------------------------------------------

/** Ce que le guet a besoin d'une image : de quoi la demander et l'entendre. */
interface ImageGuettee {
  // `never` : une HTMLImageElement passe (ses gestionnaires reçoivent un
  // Event), une fausse image de test aussi
  onload: ((ev: never) => unknown) | null
  onerror: ((ev: never) => unknown) | null
  src: string
  readonly naturalWidth: number
  readonly naturalHeight: number
}

/** Demande la planche ; à son arrivée — une image réelle, pas un fichier
 *  vide —, pose `classe` sur la racine. Un échec ne pose rien : l'emoji
 *  reste, et l'on ne redemande pas (un fichier manquant ne se met pas à
 *  exister en cours de partie). */
export function guettePlanche(
  url: string,
  classe: string,
  racine: { classList: { add(c: string): void } },
  fabrique: () => ImageGuettee = () => new Image(),
): void {
  const img = fabrique()
  img.onload = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) racine.classList.add(classe)
  }
  img.onerror = () => {}
  img.src = url
}

/** Les deux planches, guettées une fois au démarrage. Hors navigateur (tests),
 *  rien à guetter : tout reste en emoji. */
export function guettePlanchesPeintes(racine: { classList: { add(c: string): void } }): void {
  if (typeof Image === 'undefined') return
  guettePlanche(ICONES_CYCLE_URL, CLASSE_PLANCHE_CYCLE, racine)
  guettePlanche(ICONES_TROPHEES_URL, CLASSE_PLANCHE_TROPHEES, racine)
}
