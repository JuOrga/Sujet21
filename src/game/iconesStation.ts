// ---- LES ICÔNES DE LA STATION ----------------------------------------------
// Les écrans de récompense et les cartes d'instruments montraient des EMOJI,
// qui changent de tracé d'une machine à l'autre (Windows, Steam Deck et Mac ne
// dessinent pas la même clef). Deux planches rendues dans Blender les
// remplacent ; ce module est le CONTRAT entre l'atelier qui les fabrique et
// l'interface qui les découpe : l'ordre des cases, leur grille, leur adresse.
// Même principe que `metaAssets.ts` (--ic-x / --ic-y), un autre fichier pour
// ne pas mêler deux planches de grilles différentes.

import type { InstrumentDef } from './instruments'

/** Les icônes de la cérémonie, dans l'ORDRE de la planche (7 × 4, lecture
 *  ligne par ligne). Les sept clés de `Gain['cle']` (recolte.ts) y figurent :
 *  c'est ce qui permet de dessiner un gain sans emoji. */
export const ICONES_CEREMONIE = [
  'condensat', 'memoire', 'tirage', 'orbe', 'livre', 'reserve', 'maitrise',
  'instruments', 'chrono', 'note', 'secours', 'profondeur', 'repos', 'don', 'rencontre',
  'cache', 'economat', 'carte', 'danger', 'couperet', 'palet', 'rafales',
  'orbites', 'cibles', 'minijeu', 'contrepartie',
] as const
export type IconeCeremonie = (typeof ICONES_CEREMONIE)[number]

export const ICONES_CEREMONIE_URL = '/assets/ceremonie-icones.webp' // 7 × 4 cases de 512²
export const ICONES_CEREMONIE_COLONNES = 7
export const ICONES_CEREMONIE_RANGEES = 4

/** Échappe le texte qui finit dans un attribut ou un nœud : un nom d'instrument
 *  « perso » vient d'un champ que le concepteur tape. */
function echappe(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** L'icône de cérémonie, placée par --ic-x / --ic-y. Sans `titre` elle est
 *  décorative (le texte voisin porte le sens) : on la cache aux lecteurs
 *  d'écran. */
export function iconeCeremonieHTML(id: IconeCeremonie, titre?: string): string {
  const c = ICONES_CEREMONIE.indexOf(id)
  const col = c % ICONES_CEREMONIE_COLONNES
  const rang = Math.floor(c / ICONES_CEREMONIE_COLONNES)
  const nom = titre ? ` title="${echappe(titre)}" role="img" aria-label="${echappe(titre)}"` : ' aria-hidden="true"'
  return `<i class="ico-ceremonie" style="--ic-x:${col};--ic-y:${rang}"${nom}></i>`
}

export const ICONES_INSTRUMENTS_URL = '/assets/instruments-icones.webp' // 8 × 4 cases de 256²
export const ICONES_INSTRUMENTS_COLONNES = 8
export const ICONES_INSTRUMENTS_RANGEES = 4

/** L'ordre des cases : INSTRUMENTS puis CONTREPARTIES, tel que le catalogue les
 *  range au 13/11. Écrit EN TOUTES LETTRES, sans dériver du catalogue : une
 *  case ne doit pas changer de dessin parce qu'un instrument s'insère au
 *  milieu — la planche est un fichier, le catalogue bouge. */
export const ORDRE_INSTRUMENTS: readonly string[] = [
  'echantillon-secours', 'gaine-isolante', 'buse-calibree', 'aimant-rosee',
  'chambre-froide', 'peau-tendue', 'vanne-de-secours', 'plastron',
  'detendeur', 'patins-de-givre', 'lentille-de-visee', 'gueule-ouverte',
  'filtre-a-condensat', 'ballast', 'bascule-rapide', 'chambre-etanche',
  'tamis-fin', 'semelles-polies', 'eclateur', 'croc-du-sas',
  'sur-regime', 'ration-de-survie', 'oeilleres', 'carnet-du-semblable',
  // les sept contreparties
  'fuite-lente', 'residu-collant', 'gaine-fendue', 'buse-encrassee',
  'bonbonne-percee', 'fuite-prioritaire', 'vapeur-eventee',
]

/** La case d'un instrument, ou null s'il n'en a pas (carte « perso », ou
 *  instrument ajouté plus tard : on retombe alors sur son emoji). */
export function caseInstrument(id: string): number | null {
  const c = ORDRE_INSTRUMENTS.indexOf(id)
  return c < 0 ? null : c
}

/** L'icône d'un instrument POUR L'INTERFACE. Sans case, c'est l'emoji (ou, à
 *  défaut, le nom) qui revient : jamais un carré vide. */
export function iconeInstrumentHTML(d: Pick<InstrumentDef, 'id' | 'icone' | 'nom'>): string {
  const c = caseInstrument(d.id)
  if (c === null) return `<i title="${echappe(d.nom)}">${echappe(d.icone || d.nom)}</i>`
  const col = c % ICONES_INSTRUMENTS_COLONNES
  const rang = Math.floor(c / ICONES_INSTRUMENTS_COLONNES)
  return `<i class="ico-instrument" style="--ic-x:${col};--ic-y:${rang}" title="${echappe(d.nom)}" aria-hidden="true"></i>`
}

/** Au canvas : la case `c` d'une planche de `colonnes` × `rangees`, si la
 *  planche est prête et la case existe ; sinon false, et l'appelant garde
 *  son dessin d'attente. */
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

/** Au canvas : dessine la case si la planche est prête et l'instrument a la
 *  sienne ; sinon renvoie false, et l'appelant garde son dessin d'attente. */
export function dessineIconeInstrument(
  ctx: CanvasRenderingContext2D,
  planche: HTMLImageElement | null,
  id: string,
  x: number,
  y: number,
  cote: number,
): boolean {
  return dessineCase(ctx, planche, caseInstrument(id), ICONES_INSTRUMENTS_COLONNES, ICONES_INSTRUMENTS_RANGEES, x, y, cote)
}

/** Au canvas : une icône de la cérémonie (une monnaie du méta sur le plot de
 *  l'Économat, par exemple), aux mêmes conditions — false tant que la
 *  planche n'est pas prête. */
export function dessineIconeCeremonie(
  ctx: CanvasRenderingContext2D,
  planche: HTMLImageElement | null,
  id: IconeCeremonie,
  x: number,
  y: number,
  cote: number,
): boolean {
  const c = ICONES_CEREMONIE.indexOf(id)
  return dessineCase(ctx, planche, c < 0 ? null : c, ICONES_CEREMONIE_COLONNES, ICONES_CEREMONIE_RANGEES, x, y, cote)
}
