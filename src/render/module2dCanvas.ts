// LE MODULE EN 2D, PEINT SUR UNE TOILE — la mise en page de render/module2d.ts
// habillée des pièces de tools/images/coque2d.py. La toile se recompose
// seulement quand la run avance (une salle franchie, un autre module) ; le
// moteur la pose ensuite comme une texture (renderer.ts, setModule2d).
//
// REFAIT LE 10/11. Le module n'avait d'identité que dans la serre : les
// quatre autres biomes portaient la même tôle grise aux vitrages verts, et
// leurs bords — des pièces peintes une à une, à des échelles différentes —
// se chevauchaient dès qu'une arête était courte (la poupe du fuseau : trois
// coins empilés, un collier par-dessus). Désormais :
//   · CHAQUE BIOME A SA TEINTE (THEMES) : la tôle et ses vitrages sont
//     reteintés une fois par biome, au chargement — la chaufferie braise, le
//     cryo givre, l'observatoire bleu nuit ;
//   · LE CADRE DE COQUE EST DESSINÉ, plus assemblé : un profilé qui suit
//     n'importe quelle silhouette, coins arrondis, nervures, hublots à la
//     lumière du biome — aucune couture, aucun chevauchement possible ;
//   · UNE CELLULE DIT CE QU'ELLE EST : l'icône de son nœud, celle de la
//     mini-carte de la cérémonie (game/voiesModule.ts, ICONES_NOEUD) ;
//   · LA COQUE EST ÉCLAIRÉE : l'ombre du cadre, un dégradé de volume, la
//     lueur de chaque salle praticable sur la tôle autour d'elle.

import { ICONES_NOEUD } from '../game/voiesModule'
import { CYL_BERCEAU, TUBE, type EtatCellule, type EtatTube, type FormeModule, type MiseEnPage } from './module2d'

/** Les pièces, à charger une fois. */
export const PIECES_MODULE2D = [
  'tempere-tole',
  'tempere-tole-2',
  'tempere-tole-machines',
  'tempere-bord-haut',
  'tempere-bord-bas',
  'tempere-bout-gauche',
  'tempere-bout-droit',
  'tempere-baie',
  'tempere-baie-2',
  'tempere-colonne',
  'tempere-trappe',
  'tempere-machinerie',
  'detail-panneau',
  'detail-reparation',
  'detail-vanne',
  'detail-grille',
  'detail-cuve',
  'detail-aerations',
  'cellule-neutre',
  'equipement-grand-solaire',
  'equipement-petit-solaire',
  'equipement-antenne',
  'equipement-mat',
  'equipement-radiateur',
  'equipement-reservoir',
  'tube',
  'tube-collier',
  'serre-tranche-haut-g',
  'serre-tranche-haut-m',
  'serre-tranche-haut-d',
  'serre-tranche-bande-g',
  'serre-tranche-bande-m',
  'serre-tranche-bande-d',
  'serre-tranche-bas-g',
  'serre-tranche-bas-m',
  'serre-tranche-bas-d',
  'serre-tranche-2-haut-g',
  'serre-tranche-2-haut-m',
  'serre-tranche-2-haut-d',
  'serre-tranche-2-bande-g',
  'serre-tranche-2-bande-m',
  'serre-tranche-2-bande-d',
  'serre-tranche-2-bas-g',
  'serre-tranche-2-bas-m',
  'serre-tranche-2-bas-d',
  'serre-zone-algues-haut-g',
  'serre-zone-algues-haut-m',
  'serre-zone-algues-haut-d',
  'serre-zone-algues-bande-g',
  'serre-zone-algues-bande-m',
  'serre-zone-algues-bande-d',
  'serre-zone-algues-bas-g',
  'serre-zone-algues-bas-m',
  'serre-zone-algues-bas-d',
  'serre-zone-champignons-haut-g',
  'serre-zone-champignons-haut-m',
  'serre-zone-champignons-haut-d',
  'serre-zone-champignons-bande-g',
  'serre-zone-champignons-bande-m',
  'serre-zone-champignons-bande-d',
  'serre-zone-champignons-bas-g',
  'serre-zone-champignons-bas-m',
  'serre-zone-champignons-bas-d',
  'serre-etagere-1',
  'serre-etagere-3',
  'serre-anneau-haut',
  'serre-anneau-bande',
  'serre-anneau-bas',
  'serre-dome-gauche',
  'serre-dome-droit',
  'serre-berceau',
  'serre-cellule-neutre',
] as const

export type Pieces = Map<string, HTMLImageElement>
/** une pièce telle qu'on la peint : l'image livrée, ou sa copie reteintée */
type Img = HTMLImageElement | HTMLCanvasElement
type C2D = CanvasRenderingContext2D

export function chargePiecesModule2d(): Promise<Pieces> {
  return Promise.all(
    PIECES_MODULE2D.map(
      (nom) =>
        new Promise<[string, HTMLImageElement]>((ok, ko) => {
          const img = new Image()
          img.onload = () => ok([nom, img])
          img.onerror = () => ko(new Error(`coque2d-${nom}.webp`))
          img.src = `/assets/coque2d-${nom}.webp`
        }),
    ),
  ).then((l) => new Map(l))
}

// LES THÈMES — un par biome de la carte (game/carteStation.json, biomes).
// Les pièces livrées sont celles de la serre : tôle sombre, vitrages verts.
// Plutôt qu'un jeu d'images par biome (cinq fois le poids), chaque pièce est
// RETEINTÉE à la volée : la tôle prend une dominante, et tout ce qui était
// vert — les vitrages, les cultures derrière, les coulures de mousse sur la
// tôle — prend la couleur du biome. La mousse devient rouille en chaufferie
// et givre au cryo sans qu'on l'ait dessinée.
export interface Theme {
  nom: string
  /** la dominante de la tôle : ce par quoi chaque canal est multiplié */
  tole: readonly [number, number, number]
  /** ce que devient le vert : sa teinte (degrés), sa saturation et sa clarté
   *  (multipliées) — null : la serre reste verte */
  vitrage: { teinte: number; sat: number; val: number } | null
  /** la lumière du biome, « r,g,b » : hublots du cadre, halos, veilleuses */
  lueur: string
}
/** la charte (docs/charte-visuelle.md, §3) : le vert n'appartient qu'à la
 *  serre, l'ambre à ce qui chauffe, le cyan est l'accent de tout le reste */
export const THEMES: Record<string, Theme> = {
  tempere: { nom: 'tempere', tole: [1, 1, 1], vitrage: null, lueur: '127,227,168' },
  chaud: { nom: 'chaud', tole: [1.2, 0.96, 0.8], vitrage: { teinte: 19, sat: 1.45, val: 1.5 }, lueur: '255,140,50' },
  cryo: { nom: 'cryo', tole: [0.84, 1.02, 1.22], vitrage: { teinte: 196, sat: 0.75, val: 1.3 }, lueur: '167,221,245' },
  antichambre: { nom: 'antichambre', tole: [0.98, 1, 1.08], vitrage: { teinte: 204, sat: 0.3, val: 1.25 }, lueur: '214,232,245' },
  observatoire: { nom: 'observatoire', tole: [0.88, 0.92, 1.25], vitrage: { teinte: 232, sat: 0.95, val: 1.3 }, lueur: '167,184,255' },
}
/** un module sans biome (un outil, la mini-carte d'attente) : l'acier et le
 *  cyan de la charte */
const THEME_NEUTRE: Theme = { nom: 'neutre', tole: [1, 1, 1.04], vitrage: { teinte: 200, sat: 0.85, val: 1.15 }, lueur: '99,183,230' }
export function themeDuBiome(biome: string): Theme {
  return THEMES[biome] ?? THEME_NEUTRE
}

/** RETEINTER les pixels d'une pièce (RGBA, sur place) — pur : testé sans
 *  toile. Le vert se reconnaît à ce qu'il DOMINE le rouge et le bleu ; plus
 *  il domine, plus il prend la teinte du biome (un fondu : un seuil net
 *  découpait les feuilles en aplats). */
export function teintePixels(px: Uint8ClampedArray | number[], th: Theme): void {
  const [tr, tg, tb] = th.tole
  const v = th.vitrage
  // la teinte pure du biome, en parts de rouge, vert, bleu
  const pur = (dec: number) => {
    const k = (((v?.teinte ?? 0) / 60 + dec) % 6 + 6) % 6
    return 1 - Math.max(0, Math.min(1, Math.min(k, 4 - k)))
  }
  const [hr, hg, hb] = [pur(5), pur(3), pur(1)]
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    let R = r * tr
    let G = g * tg
    let B = b * tb
    const vert = g - Math.max(r, b)
    if (v && vert > 4) {
      const w = Math.min(1, (vert - 4) / 22)
      const val = g * v.val
      const sat = Math.min(1, ((g - Math.min(r, b)) / g) * v.sat)
      R += (val * (1 - sat * (1 - hr)) - R) * w
      G += (val * (1 - sat * (1 - hg)) - G) * w
      B += (val * (1 - sat * (1 - hb)) - B) * w
    }
    px[i] = Math.min(255, R)
    px[i + 1] = Math.min(255, G)
    px[i + 2] = Math.min(255, B)
  }
}

// une pièce reteintée se garde : la run repasse par le même biome, et une
// toile se repeint à chaque salle
const TEINTES = new WeakMap<Pieces, Map<string, Img>>()
function pieceTeintee(p: Pieces, nom: string, th: Theme): Img {
  const im = p.get(nom)!
  if (!th.vitrage && th.tole.every((k) => k === 1)) return im
  let cache = TEINTES.get(p)
  if (!cache) TEINTES.set(p, (cache = new Map()))
  const cle = `${th.nom}|${nom}`
  const deja = cache.get(cle)
  if (deja) return deja
  const t = document.createElement('canvas')
  t.width = im.width
  t.height = im.height
  const g = t.getContext('2d', { willReadFrequently: true })
  let out: Img = im
  if (g) {
    g.drawImage(im, 0, 0)
    try {
      const d = g.getImageData(0, 0, t.width, t.height)
      teintePixels(d.data, th)
      g.putImageData(d, 0, 0)
      out = t
    } catch {
      // une toile que le navigateur refuse de relire : la pièce d'origine,
      // sans sa teinte, plutôt que rien
    }
  }
  cache.set(cle, out)
  return out
}

// LES PIÈCES MESURÉES, en pixels À LA MOITIÉ des sources (la première
// livraison) : une largeur de salle vaut 533 de ces pixels — l'échelle de la
// maquette validée le 01/10. Les fichiers sont livrés à LIVRE des sources
// (tools/images/coque2d.py).
const PX_PAR_SALLE = 533.3
// les pièces de la serre, livrées en pleine résolution : 1024 de leurs
// pixels par largeur de salle — deux bandes par étagère d'origine
const PX_SERRE = 1024
const LIVRE = 0.8
// LES COLLIERS D'AMARRAGE, pris dans les deux pièces de bout : où passe la
// ligne de coque (en pixels du fichier), et les lignes que le collier occupe
// (mesuré le 10/11 sur ce qui dépasse de la coque : 240 à 880 sur 1229)
const COLLIER = { gauche: 360, droite: 471, haut: 215, bas: 905, morsure: 70 }
// LES BANDES DE BORD, en pixels de leurs fichiers : la ligne de coque, ce que
// la bande occupe dedans (son seul relief — le rail vitré du bord haut, le
// tuyau et le treillis de la quille ; au-delà c'était l'ancienne tôle), et ce
// qui dépasse dehors (les tuyères, sous la quille)
const BANDE = { haut: { ligne: 307, dedans: 195, dehors: 7 }, bas: { ligne: 468, dedans: 150, dehors: 52 } }
/** en deçà (largeurs de salle, goussets déduits), une arête garde le profilé nu */
const BANDE_MIN = 0.55
/** le côté d'un gousset : il couvre le bout des bandes (0,23 salle au plus haut) */
const GOUSSET = 0.25
/** entre deux arêtes sans bande, il n'a que le profilé à couvrir */
const GOUSSET_NU = 0.13

// LE CADRE DE COQUE, en largeurs de salle : un profilé de 8,5 % de salle
const CADRE = 0.085
const RAYON_SAILLANT = 0.1
const RAYON_RENTRANT = 0.045
/** d'un hublot au suivant, le long du cadre */
const PAS_HUBLOT = 0.27

// LES ÉTATS, en couleurs : la lumière (« r,g,b »), celle de l'icône, et de
// combien la cellule s'assombrit
const ETATS: Record<EtatCellule, { lumiere: string; icone: string; nuit: number }> = {
  ambre: { lumiere: '255,160,60', icone: '#ffcf94', nuit: 0 },
  bleu: { lumiere: '99,183,230', icone: '#9bd6f5', nuit: 0.18 },
  joue: { lumiere: '150,170,188', icone: '#b3c2cf', nuit: 0.42 },
  ferme: { lumiere: '70,84,98', icone: '#56636f', nuit: 0.74 },
}
const OR_PRIME = '#ffd977'

type Pt = { x: number; y: number }

/** un tirage stable dans [0, 1[ */
const tire = (i: number, j: number) => ((((i * 73856093) ^ (j * 19349663)) >>> 0) % 1000) / 1000

/** LE CONTOUR ARRONDI d'un polygone à angles droits : de milieu d'arête en
 *  milieu d'arête, un arc à chaque sommet — le rayon ne dépasse jamais la
 *  moitié de la plus courte des deux arêtes qu'il raccorde. */
function traceContour(c: C2D, s: readonly Pt[], rayon: (i: number) => number): void {
  const n = s.length
  const mi = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const long = (a: Pt, b: Pt) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
  const d = mi(s[n - 1], s[0])
  c.beginPath()
  c.moveTo(d.x, d.y)
  for (let i = 0; i < n; i++) {
    const av = s[(i + n - 1) % n]
    const ap = s[(i + 1) % n]
    const m = mi(s[i], ap)
    c.arcTo(s[i].x, s[i].y, m.x, m.y, Math.min(rayon(i), 0.45 * long(av, s[i]), 0.45 * long(s[i], ap)))
  }
  c.closePath()
}

/** Une icône de nœud (repère 24 × 24), centrée en (x, y), haute de t. */
function peintIcone(c: C2D, nom: string, x: number, y: number, t: number, couleur: string, alpha = 1): void {
  const traits = ICONES_NOEUD[nom]
  if (!traits) return
  c.save()
  c.translate(x - t / 2, y - t / 2)
  c.scale(t / 24, t / 24)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.strokeStyle = couleur
  c.fillStyle = couleur
  // EN GRAND, LE TRAIT S'AFFINE : les icônes sont dessinées pour 22 px (la
  // mini-carte de la cérémonie) ; à la taille d'une salle, pendant la
  // transition, le même trait empâtait les branches du flocon en flèches
  const fin = t > 48 ? 0.7 : 1
  for (const tr of traits) {
    const ch = new Path2D(tr.d)
    c.globalAlpha = alpha * (tr.opacite ?? 1)
    if (tr.plein) c.fill(ch)
    if (tr.ep) {
      c.lineWidth = tr.ep * fin
      c.stroke(ch)
    }
  }
  c.restore()
}

/** UNE CELLULE de la mini-carte, centrée en (x, y), large de l : la pièce
 *  livrée (une petite salle vide, ou la capsule de la serre), assombrie selon
 *  son état, son liseré, et au milieu l'ÉCUSSON de son nœud. Les quatre
 *  images d'état précalculées portaient leurs lampes en aplats ovales et ne
 *  disaient rien du nœud : une seule pièce neutre, le reste se dessine.
 *  `k` : le grossissement de la toile (les flous se comptent en pixels). */
function peintCellule(
  c: C2D,
  im: Img,
  capsule: boolean,
  q: { x: number; y: number; l: number; etat: EtatCellule; icone: string; prime: boolean },
  k: number,
  lueur = true,
): void {
  const E = ETATS[q.etat]
  const l = q.l
  const h = capsule ? (l * im.height) / im.width : l / 1.5
  const x0 = q.x - l / 2
  const y0 = q.y - h / 2
  // le coin de la cellule : la capsule est un stade, la salle un rectangle
  const r = capsule ? h * 0.46 : l * 0.035
  const forme = (m: number) => {
    c.beginPath()
    c.roundRect(x0 - m, y0 - m, l + 2 * m, h + 2 * m, r + m)
  }
  // la lueur d'une salle praticable déborde sur la tôle
  if (lueur && (q.etat === 'ambre' || q.etat === 'bleu')) {
    c.save()
    forme(0)
    c.shadowColor = `rgba(${E.lumiere},${q.etat === 'ambre' ? 0.9 : 0.55})`
    c.shadowBlur = l * 0.16 * k
    c.fillStyle = `rgba(${E.lumiere},0.5)`
    c.fill()
    c.restore()
  }
  c.save()
  forme(0)
  c.clip()
  c.drawImage(im, x0, y0, l, h)
  // l'état : la nuit, puis un voile à sa couleur
  c.fillStyle = `rgba(2,5,10,${E.nuit})`
  c.fillRect(x0, y0, l, h)
  if (q.etat === 'ambre' || q.etat === 'bleu') {
    const g = c.createLinearGradient(0, y0, 0, y0 + h)
    g.addColorStop(0, `rgba(${E.lumiere},0.3)`)
    g.addColorStop(0.55, `rgba(${E.lumiere},0.08)`)
    g.addColorStop(1, `rgba(${E.lumiere},0.2)`)
    c.fillStyle = g
    c.fillRect(x0, y0, l, h)
  }
  c.restore()
  // le liseré
  forme(-l * 0.008)
  c.lineWidth = l * (q.etat === 'ambre' ? 0.026 : 0.016)
  c.strokeStyle = `rgba(${E.lumiere},${q.etat === 'ferme' ? 0.5 : 0.95})`
  c.stroke()
  // L'ÉCUSSON : un disque sombre, cerclé, l'icône du nœud dedans — sur la
  // pièce nue, l'icône se perdait dans les tuyaux peints
  // (la capsule de la serre est si plate que l'écusson en prend la hauteur)
  const rayon = h * (capsule ? 0.5 : 0.36)
  c.beginPath()
  c.arc(q.x, q.y, rayon, 0, Math.PI * 2)
  c.fillStyle = `rgba(4,9,16,${q.etat === 'ferme' ? 0.55 : 0.82})`
  c.fill()
  c.lineWidth = rayon * 0.09
  c.strokeStyle = `rgba(${E.lumiere},${q.etat === 'ferme' ? 0.35 : 0.8})`
  c.stroke()
  if (q.icone) peintIcone(c, q.icone, q.x, q.y, rayon * 1.3, E.icone, q.etat === 'ferme' ? 0.6 : 1)
  // une salle FERMÉE par les choix : barrée, d'un trait discret — la croix
  // rouge pleine largeur criait plus fort que les salles où l'on peut aller
  if (q.etat === 'ferme') {
    c.beginPath()
    c.moveTo(q.x - rayon * 0.72, q.y + rayon * 0.72)
    c.lineTo(q.x + rayon * 0.72, q.y - rayon * 0.72)
    c.lineWidth = rayon * 0.11
    c.lineCap = 'round'
    c.strokeStyle = 'rgba(190,84,76,0.7)'
    c.stroke()
  }
  // LA PRIME : un anneau d'or en pointillé autour de l'écusson, le signe de
  // la mini-carte de la cérémonie (mv-prime-anneau)
  if (q.prime && q.etat !== 'ferme') {
    c.save()
    c.beginPath()
    c.arc(q.x, q.y, rayon * 1.24, 0, Math.PI * 2)
    c.setLineDash([rayon * 0.26, rayon * 0.2])
    c.lineWidth = rayon * 0.1
    c.strokeStyle = OR_PRIME
    c.globalAlpha = q.etat === 'joue' ? 0.5 : 1
    c.stroke()
    c.restore()
  }
}

/** UNE CELLULE SEULE, sur sa propre toile — celle que la transition fait
 *  rétrécir (la salle quittée, « joue ») ou grossir (la salle où l'on entre,
 *  « ambre » : la porte qu'on vient de choisir). Peinte par le même geste que
 *  celles du module : à la fin du rétrécissement, elle tombe exactement sur
 *  sa jumelle de la toile. */
export function peintCelluleSeule(
  p: Pieces,
  forme: FormeModule,
  etat: EtatCellule,
  noeud: { icone: string; prime: boolean },
  largeur = 768,
): HTMLCanvasElement {
  const capsule = forme === 'cylindre'
  const im = p.get(capsule ? 'serre-cellule-neutre' : 'cellule-neutre')!
  const t = document.createElement('canvas')
  t.width = largeur
  t.height = Math.round(capsule ? (largeur * im.height) / im.width : largeur / 1.5)
  const c = t.getContext('2d')
  // sans sa lueur : coupée au bord de la toile, elle faisait un rectangle
  // roux derrière la capsule (vu dans le vrai moteur le 10/11)
  if (c) peintCellule(c, im, capsule, { x: t.width / 2, y: t.height / 2, l: t.width, etat, ...noeud }, 1, false)
  return t
}

/** Une fenêtre de la mise en page à peindre plus fin : son coin, sa taille
 *  (pixels de la toile de base) et son grossissement. */
export interface Fenetre {
  x: number
  y: number
  l: number
  h: number
  k: number
}

/** PEINDRE le module sur une toile neuve — entière, ou une fenêtre plus fine. */
export function peintModule2d(mp: MiseEnPage, p: Pieces, fen?: Fenetre): HTMLCanvasElement {
  const toile = document.createElement('canvas')
  toile.width = fen ? Math.round(fen.l * fen.k) : mp.largeur
  toile.height = fen ? Math.round(fen.h * fen.k) : mp.hauteur
  const c = toile.getContext('2d')!
  const K = fen ? fen.k : 1
  if (fen) c.setTransform(K, 0, 0, K, -fen.x * K, -fen.y * K)
  const D = mp.densite
  // f : les mesures (à la moitié des sources) ; fi : les fichiers (à LIVRE)
  const f = D / PX_PAR_SALLE
  const fi = (f * 0.5) / LIVRE
  // LA FENÊTRE ne peint que ce qu'elle montre : rejouer tout le module sous
  // une transformation coûtait autant que la toile entière, à chaque salle
  const marge = 0.6 * D
  const vu = fen
    ? { x0: fen.x - marge, y0: fen.y - marge, x1: fen.x + fen.l + marge, y1: fen.y + fen.h + marge }
    : { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity }
  const hors = (x0: number, y0: number, x1: number, y1: number) => x1 < vu.x0 || x0 > vu.x1 || y1 < vu.y0 || y0 > vu.y1
  const th = themeDuBiome(mp.biome)
  const brut = (n: string): Img => p.get(n)!
  /** une pièce de la coque, à la teinte du biome */
  const img = (n: string): Img => pieceTeintee(p, n, th)
  // 1. la tôle, dans la silhouette. Une variante par rangée, tirée au sort,
  // et chaque carreau retourné ou non : une rangée d'une seule variante
  // montrait le même motif ~8 fois d'affilée (analyse du 02/10). Le miroir
  // horizontal garde le raccord — le bord droit d'un carreau retourné est
  // le bord gauche de l'original —, mélanger les variantes dans une rangée
  // ferait des coutures
  const pave = (im: Img, x0: number, y0: number, x1: number, y1: number, graine: number) => {
    const tl = im.width * fi
    for (let i = 0, y = y0; y < y1; i++, y += tl) {
      if (hors(x0, y, x1, y + tl)) continue
      const dec = ((i * 211 + graine) % im.width) * fi
      for (let j = 0, x = x0 - dec; x < x1; j++, x += tl) {
        if (hors(x, y, x + tl, y + tl)) continue
        if (tire(i + graine, j) < 0.5) c.drawImage(im, x, y, tl + 0.5, tl + 0.5)
        else {
          c.save()
          c.translate(x + tl, y)
          c.scale(-1, 1)
          c.drawImage(im, -0.5, 0, tl + 0.5, tl + 0.5)
          c.restore()
        }
      }
    }
  }
  // LE CYLINDRE DE LA SERRE : le berceau dessous, les tranches vitrées sur
  // toute la longueur (en nombre entier, légèrement étirées : chaque capsule
  // reste entière), un anneau à chaque jonction, un dôme à chaque bout. Les
  // ancres viennent des pièces livrées (tools/images/coque2d.py, serre)
  const peintCylindre = () => {
    const k = mp.corps
    const H = k.maxY - k.minY
    const W = k.maxX - k.minX
    const berceau = img('serre-berceau')
    // ses brides (ligne 166 sur 819) mordent le bas du cylindre ; 625 lignes
    // de machines dessous
    const sb = (CYL_BERCEAU * H * 0.95) / 625
    const bx0 = k.minX + 0.12 * H
    const bx1 = k.maxX - 0.12 * H
    c.save()
    c.beginPath()
    c.rect(bx0, k.minY, bx1 - bx0, H * (1 + CYL_BERCEAU))
    c.clip()
    for (let x = bx0; x < bx1; x += berceau.width * sb)
      if (!hors(x, k.maxY - 0.03 * H - 166 * sb, x + berceau.width * sb, k.maxY + CYL_BERCEAU * H))
        c.drawImage(berceau, x, k.maxY - 0.03 * H - 166 * sb, berceau.width * sb + 0.5, berceau.height * sb)
    c.restore()
    // UNE COLONNE EMPILÉE : le haut, la bande répétée, le bas — à l'échelle
    // d'origine des pièces (PX_SERRE par salle), le nombre de bandes ajusté à
    // la hauteur du module. Étirée d'un bloc à ~3 salles, une tranche n'avait
    // que ~400 px par salle : floue dès qu'on zoomait (Steam Deck, 06/10)
    const empile = (h: number, haut: Img, bande: Img, bas: Img) => {
      const cible = mp.densite / PX_SERRE
      const nb = Math.max(0, Math.round((h / cible - haut.height - bas.height) / bande.height))
      return { nb, e: h / (haut.height + nb * bande.height + bas.height) }
    }
    const colonne = (x: number, y: number, l: number, e: number, nb: number, haut: Img, bande: Img, bas: Img) => {
      c.drawImage(haut, x, y, l, haut.height * e + 0.5)
      let yy = y + haut.height * e
      for (let j = 0; j < nb; j++, yy += bande.height * e) c.drawImage(bande, x, yy, l, bande.height * e + 0.5)
      c.drawImage(bas, x, yy, l, bas.height * e)
    }
    // chaque capsule en trois colonnes aussi : son bord gauche et son arc, le
    // cœur répété en largeur, son bord droit — d'un bloc, à pleine finesse,
    // les capsules devenaient étroites et hautes (06/10) ; elles gardent la
    // largeur de la tranche d'origine, deux tiers de la hauteur du cylindre
    const jeu = (nom: string) =>
      (['haut', 'bande', 'bas'] as const).map((l) => (['g', 'm', 'd'] as const).map((cote) => img(`${nom}-${l}-${cote}`)))
    const air = [jeu('serre-tranche'), jeu('serre-tranche-2')]
    const zones = { algues: jeu('serre-zone-algues'), champignons: jeu('serre-zone-champignons') }
    const etageres = [img('serre-etagere-1'), img('serre-etagere-3')]
    const [hg, hm, hd] = air[0][0]
    const { nb, e } = empile(H, hg, air[0][1][0], air[0][2][0])
    const nmAir = Math.max(1, Math.round(((2 / 3) * H / e - hg.width - hd.width) / hm.width))
    const n = Math.max(1, Math.round(W / ((hg.width + nmAir * hm.width + hd.width) * e)))
    const sw = W / n
    // CASSER LA GRILLE : une bande répétée telle quelle faisait un papier
    // peint, la même étagère en lignes et en colonnes (06/10). Chaque cœur est
    // retourné ou non (le miroir garde le raccord : son bord droit est le
    // bord gauche de l'original)
    const piece = (im: Img, x: number, y: number, l: number, h: number, miroir: boolean) => {
      if (!miroir) return c.drawImage(im, x, y, l, h)
      c.save()
      c.translate(x + l, y)
      c.scale(-1, 1)
      c.drawImage(im, 0, 0, l, h)
      c.restore()
    }
    // VARIER DANS LA LONGUEUR : une capsule par zone le long du cylindre —
    // le jardin d'air, les algues, le jardin d'air, la champignonnière…
    // (06/10, « des variations dans la longueur au lieu de répéter »)
    const ZONES = ['air', 'algues', 'air', 'champignons'] as const
    for (let i = 0; i < n; i++) {
      const x0 = k.minX + i * sw
      if (hors(x0, k.minY, x0 + sw, k.maxY)) continue
      const zone = ZONES[i % ZONES.length]
      const j3 = zone === 'air' ? air[(i >> 1) % 2] : zones[zone]
      const p = zone === 'air' ? { nb, e } : empile(H, j3[0][0], j3[1][0], j3[2][0])
      const [g, m, d] = j3[0]
      const nm = Math.max(1, Math.round((sw / p.e - g.width - d.width) / m.width))
      const fx = sw / ((g.width + nm * m.width + d.width) * p.e)
      let y = k.minY
      for (let r = 0; r < p.nb + 2; r++) {
        const ligne = r === 0 ? 0 : r === p.nb + 1 ? 2 : 1
        // au jardin d'air, chaque étagère tire la sienne : l'une des deux
        // tranches (elles partagent leurs rebords) ou une étagère de rechange
        const t = tire(i * 31 + r, 5)
        const rang = zone === 'air' && ligne === 1 ? air[t < 0.5 ? 0 : 1][1] : j3[ligne]
        const rechange = zone === 'air' && ligne === 1 && t >= 0.25 && t < 0.75 ? etageres[t < 0.5 ? 0 : 1] : null
        const h = rang[0].height * p.e
        let x = x0
        for (let jc = 0; jc < nm + 2; jc++) {
          const col = jc === 0 ? 0 : jc === nm + 1 ? 2 : 1
          const l = rang[col].width * p.e * fx
          if (!hors(x, y, x + l, y + h)) piece(rang[col], x, y, l + 0.5, h + 0.5, col === 1 && tire(i * 17 + jc, r) < 0.5)
          // l'étagère de rechange couvre le cœur d'un trait, par-dessus la
          // tranche, et s'y fond à ses deux bouts : d'une autre image, sans
          // vitrage, elle faisait une couture contre les bords (relecture
          // 06/10) — huit crans d'opacité sur un huitième du cœur
          if (col === 1 && rechange && jc === nm) {
            const lc = nm * l
            const xc = x + l - lc
            const tw = (rechange.width * h) / rechange.height
            const f = lc / 8
            const dec = tire(i, r) * tw
            for (let pas = 0; pas < 9; pas++) {
              // pas 0 : le milieu, plein ; 1–8 : les crans des deux bouts
              const [x0c, x1c, a] = pas === 0 ? [xc + f, xc + lc - f, 1] : [xc + ((pas - 1) * f) / 8, xc + (pas * f) / 8, pas / 9]
              if (hors(xc, y, xc + lc, y + h)) continue
              for (const [u0, u1] of pas === 0 ? [[x0c, x1c]] : [[x0c, x1c], [xc + lc - (x1c - xc), xc + lc - (x0c - xc)]]) {
                c.save()
                c.globalAlpha = a
                c.beginPath()
                c.rect(u0, y, u1 - u0, h + 0.5)
                c.clip()
                for (let xx = xc - dec; xx < xc + lc; xx += tw) if (xx + tw > u0 && xx < u1) c.drawImage(rechange, xx, y, tw + 0.5, h + 0.5)
                c.restore()
              }
            }
          }
          x += l
        }
        y += h
      }
    }
    // l'anneau : 98,6 % de la hauteur du cylindre, posé 0,65 % sous son haut
    const an = [img('serre-anneau-haut'), img('serre-anneau-bande'), img('serre-anneau-bas')] as const
    const ah = 0.986 * H
    const pa = empile(ah, ...an)
    const aw = an[0].width * pa.e
    for (let i = 1; i < n; i++) {
      const x = k.minX + i * sw
      if (!hors(x - aw / 2, k.minY, x + aw / 2, k.maxY)) colonne(x - aw / 2, k.minY + 0.0065 * H, aw, pa.e, pa.nb, ...an)
    }
    // les dômes : leur hauteur de cylindre est 1202 lignes sur 1229 ; la
    // bande plate tombe à x 786 (gauche) et 30 (droite) sur 819
    const sd = H / 1202
    const dg = img('serre-dome-gauche')
    const dd = img('serre-dome-droit')
    if (!hors(k.minX - 786 * sd, k.minY, k.minX + 33 * sd, k.maxY)) c.drawImage(dg, k.minX - 786 * sd, k.minY, dg.width * sd, dg.height * sd)
    if (!hors(k.maxX - 30 * sd, k.minY, k.maxX + 790 * sd, k.maxY)) c.drawImage(dd, k.maxX - 30 * sd, k.minY, dd.width * sd, dd.height * sd)
  }
  const capsules = mp.forme === 'cylindre'
  const S = mp.silhouette
  const contour = () =>
    traceContour(c, S, (i) => (S[i].piece.startsWith('coin') ? RAYON_SAILLANT : RAYON_RENTRANT) * D)
  if (capsules) peintCylindre()
  else {
    // LE HALO DU MODULE sur le ciel : quatre liserés de plus en plus larges à
    // la lumière du biome — la coque sombre se fondait dans la nuit, sans bord
    c.save()
    c.lineJoin = 'round'
    for (let i = 4; i >= 1; i--) {
      contour()
      c.lineWidth = i * 0.045 * D
      c.strokeStyle = `rgba(${th.lueur},0.035)`
      c.stroke()
    }
    c.restore()
    c.save()
    contour()
    c.clip()
    const toles = [img('tempere-tole'), img('tempere-tole-2')]
    const tl = toles[0].width * fi
    for (let i = 0, y = 0; y < mp.hauteur; i++, y += tl) {
      if (hors(0, y, mp.largeur, y + tl)) continue
      // une rangée par appel, sans découpe à sa hauteur : une découpe sur une
      // fraction de pixel ôtait le recouvrement d'un demi-pixel des carreaux,
      // et un liseré sombre pouvait courir entre deux rangées (relecture 05/10)
      pave(toles[tire(i, 7) < 0.5 ? 0 : 1], 0, y, mp.largeur, y + tl, i * 37)
    }
    // la salle des machines, sa propre tôle, séparée du reste par un joint
    for (const z of mp.machines) {
      if (hors(z.minX, z.minY, z.maxX, z.maxY)) continue
      c.save()
      c.beginPath()
      c.rect(z.minX, z.minY, z.maxX - z.minX, z.maxY - z.minY)
      c.clip()
      pave(img('tempere-tole-machines'), z.minX, z.minY, z.maxX, z.maxY, 101)
      c.restore()
      c.strokeStyle = 'rgba(0,0,0,0.7)'
      c.lineWidth = 0.012 * D
      c.strokeRect(z.minX, z.minY, z.maxX - z.minX, z.maxY - z.minY)
    }
    // les petits détails, posés sur la tôle
    for (const d of mp.details) {
      const im = img(`detail-${d.nom}`)
      const h = (d.l * im.height) / im.width
      if (hors(d.x - d.l / 2, d.y - h / 2, d.x + d.l / 2, d.y + h / 2)) continue
      c.drawImage(im, d.x - d.l / 2, d.y - h / 2, d.l, h)
    }
    // les éléments uniques ; leurs vitrages débordent d'un halo à la lumière
    // du biome sur la tôle
    for (const e of mp.elements) {
      const im = img(`tempere-${e.nom}`)
      const h = (e.l * im.height) / im.width
      const r = Math.max(e.l, h) * 0.6
      if (hors(e.x - r, e.y - r, e.x + r, e.y + r)) continue
      if (e.nom === 'baie' || e.nom === 'baie-2' || e.nom === 'colonne') {
        const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, r)
        g.addColorStop(0, `rgba(${th.lueur},0.13)`)
        g.addColorStop(1, `rgba(${th.lueur},0)`)
        c.fillStyle = g
        c.fillRect(e.x - r, e.y - r, 2 * r, 2 * r)
      }
      c.drawImage(im, e.x - e.l / 2, e.y - h / 2, e.l, h)
    }
    // LE VOLUME : la coque est éclairée d'en haut (la charte : « froide,
    // égale, venue du haut ») — elle s'assombrit vers la quille. Uniforme,
    // elle se lisait comme un papier peint, pas comme un objet
    const ys = S.map((q) => q.y)
    const y0 = Math.min(...ys)
    const y1 = Math.max(...ys)
    const vol = c.createLinearGradient(0, y0, 0, y1)
    vol.addColorStop(0, 'rgba(0,0,0,0)')
    vol.addColorStop(1, 'rgba(0,0,0,0.34)')
    c.fillStyle = vol
    c.fillRect(0, y0, mp.largeur, y1 - y0)
    // L'OMBRE DU CADRE sur la tôle : six traits de plus en plus étroits le
    // long du contour (un flou de toile sur 4 000 px coûterait une seconde)
    c.lineJoin = 'round'
    for (let i = 6; i >= 1; i--) {
      contour()
      c.lineWidth = 2 * (CADRE + i * 0.03) * D
      c.strokeStyle = 'rgba(0,0,0,0.07)'
      c.stroke()
    }
    c.restore()
  }
  // LA LUEUR DES SALLES PRATICABLES sur la coque : ambre pour celles qu'on
  // peut ouvrir maintenant, bleue pour la suite — d'un coup d'œil, la partie
  // du module encore devant soi est éclairée, le reste dans la nuit
  c.save()
  if (capsules) {
    c.beginPath()
    c.rect(mp.corps.minX, mp.corps.minY, mp.corps.maxX - mp.corps.minX, mp.corps.maxY - mp.corps.minY)
  } else contour()
  c.clip()
  c.globalCompositeOperation = 'lighter'
  for (const k of mp.cellules) {
    if (k.etat !== 'ambre' && k.etat !== 'bleu') continue
    const r = (k.etat === 'ambre' ? 0.62 : 0.5) * D
    if (hors(k.x - r, k.y - r, k.x + r, k.y + r)) continue
    const g = c.createRadialGradient(k.x, k.y, 0, k.x, k.y, r)
    g.addColorStop(0, `rgba(${ETATS[k.etat].lumiere},${k.etat === 'ambre' ? 0.2 : 0.11})`)
    g.addColorStop(1, `rgba(${ETATS[k.etat].lumiere},0)`)
    c.fillStyle = g
    c.fillRect(k.x - r, k.y - r, 2 * r, 2 * r)
  }
  c.restore()
  if (!capsules) peintCadre()
  // LES TUBES, sous les cellules. Un tube est une CONDUITE : un halo de sa
  // couleur s'il est praticable, le corps, une lueur au fil de son axe et un
  // collier à chaque bout. Le corps seul, mince, avec un filet plat, se
  // lisait comme un trait entre les cellules (aperçu du 05/10)
  const tube = brut('tube')
  const collier = brut('tube-collier')
  const ep = TUBE * D
  const tw = (tube.width * ep) / tube.height
  const ch = ep * 1.3
  const cw = (collier.width * ch) / collier.height
  // les raccords sous la salle jouée se peignent comme les tubes : la salle
  // les couvre en jeu, la transition les découvre (module2d.ts, raccords)
  // DU PLUS ÉTEINT AU PLUS VIF : plusieurs tubes partagent leur dernier
  // tronçon vers une même salle — peints dans l'ordre de la grille, un tube
  // éteint pouvait recouvrir le chemin joué ou la voie praticable
  const VIF: Record<EtatTube, number> = { eteint: 0, joue: 1, bleu: 2, ambre: 3 }
  const visibles = [...mp.tubes, ...mp.raccords]
    .filter((t) => {
      const long = Math.abs(t.bx - t.ax) + Math.abs(t.by - t.ay)
      return long >= 1 && !hors(Math.min(t.ax, t.bx) - ch, Math.min(t.ay, t.by) - ch, Math.max(t.ax, t.bx) + ch, Math.max(t.ay, t.by) + ch)
    })
    .sort((a, b) => VIF[a.etat] - VIF[b.etat])
  // l'emprise d'un tube, débordée de m de chaque côté et à chaque bout
  const emprise = (t: (typeof visibles)[number], m: number) =>
    c.rect(Math.min(t.ax, t.bx) - m, Math.min(t.ay, t.by) - m, Math.abs(t.bx - t.ax) + 2 * m, Math.abs(t.by - t.ay) + 2 * m)
  // l'ombre et le halo, D'UN SEUL TRACÉ pour tout le réseau : tube par tube,
  // ils s'empilaient en carrés plus sombres (ou plus vifs) à chaque coude
  c.beginPath()
  for (const t of visibles) emprise(t, ep * 0.8)
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.fill()
  const LUMIERE_TUBE: Record<EtatTube, string | null> = { ambre: ETATS.ambre.lumiere, bleu: ETATS.bleu.lumiere, joue: null, eteint: null }
  for (const [etat, force] of [['bleu', 0.5], ['ambre', 0.8]] as const) {
    const lot = visibles.filter((t) => t.etat === etat)
    if (!lot.length) continue
    c.save()
    c.beginPath()
    for (const t of lot) emprise(t, ep * 0.5)
    // le flou d'une ombre se compte en pixels de la toile, hors transformation
    c.shadowColor = `rgba(${LUMIERE_TUBE[etat]},${force})`
    c.shadowBlur = ep * 1.6 * K
    c.fillStyle = `rgba(${LUMIERE_TUBE[etat]},${force * 0.5})`
    c.fill()
    c.restore()
  }
  for (const t of visibles) {
    const long = Math.abs(t.bx - t.ax) + Math.abs(t.by - t.ay)
    c.save()
    c.translate(t.ax, t.ay)
    if (t.ax === t.bx) c.rotate(t.by > t.ay ? Math.PI / 2 : -Math.PI / 2)
    else if (t.bx < t.ax) c.rotate(Math.PI)
    const lumiere = LUMIERE_TUBE[t.etat]
    c.save()
    c.beginPath()
    c.rect(-ep / 2, -ep / 2, long + ep, ep)
    c.clip()
    for (let x = -ep / 2; x < long + ep; x += tw) c.drawImage(tube, x, -ep / 2, tw + 0.5, ep)
    // un tube éteint s'assombrit ; le chemin praticable porte une lueur
    const nuit = { ambre: 0, bleu: 0.15, joue: 0.25, eteint: 0.62 }[t.etat]
    c.fillStyle = `rgba(0,0,0,${nuit})`
    c.fillRect(-ep / 2, -ep / 2, long + ep, ep)
    // LE CHEMIN JOUÉ garde un fil pâle : assombri comme un tube éteint, on ne
    // retrouvait plus par où l'on était passé
    const fil = lumiere ? `${lumiere},0.6` : t.etat === 'joue' ? '196,214,228,0.4' : null
    if (fil) {
      const g = c.createLinearGradient(0, -ep / 2, 0, ep / 2)
      g.addColorStop(0, `rgba(${fil.replace(/,[\d.]+$/, ',0')})`)
      g.addColorStop(0.5, `rgba(${fil})`)
      g.addColorStop(1, `rgba(${fil.replace(/,[\d.]+$/, ',0')})`)
      c.fillStyle = g
      c.fillRect(-ep / 2, -ep * 0.2, long + ep, ep * 0.4)
    }
    c.restore()
    // les colliers, aux deux bouts : là où le tube se raccorde ou tourne
    const sombre = nuit * 0.6
    for (const [x, sens] of [[-ep / 2, 1], [long + ep / 2, -1]] as const) {
      c.save()
      c.translate(x, 0)
      c.scale(sens, 1)
      c.drawImage(collier, 0, -ch / 2, cw, ch)
      if (sombre > 0) {
        c.fillStyle = `rgba(0,0,0,${sombre})`
        c.fillRect(0, -ch / 2, cw, ch)
      }
      c.restore()
    }
    c.restore()
  }
  // LES CELLULES — dans la serre, des capsules de culture, à leurs
  // proportions (plus allongées que la case de la mini-carte)
  const pieceCellule = brut(capsules ? 'serre-cellule-neutre' : 'cellule-neutre')
  for (const k of mp.cellules) {
    const m = k.l * 0.3
    if (hors(k.x - k.l / 2 - m, k.y - k.h / 2 - m, k.x + k.l / 2 + m, k.y + k.h / 2 + m)) continue
    peintCellule(c, pieceCellule, capsules, k, K)
  }
  // LES ÉQUIPEMENTS, debout sur les bords hauts
  for (const e of mp.equipements) {
    if (hors(e.x, e.y - 0.6 * D, e.x, e.y)) continue
    const im = brut(`equipement-${e.nom}`)
    const k = fi * 1.07
    c.drawImage(im, e.x - (im.width * k) / 2, e.y - im.height * k + 0.02 * D, im.width * k, im.height * k)
  }
  return toile

  // LE CADRE DE COQUE. Les bords, coins et angles rentrants avaient été
  // peints un à un, à des échelles différentes (les coins à 0,55 – 0,7 fois
  // les bords), chacun avec l'ANCIENNE tôle dans sa moitié intérieure : des
  // tuyaux qui ne se raccordaient pas, des carrés de tôle claire aux angles,
  // et sur une arête courte trois pièces l'une sur l'autre (la poupe du
  // fuseau). Désormais, trois couches qui ne peuvent pas se chevaucher :
  //   1. un PROFILÉ dessiné, qui suit toute la silhouette, coins arrondis ;
  //   2. sur chaque arête assez longue, la BANDE peinte — le rail vitré du
  //      bord haut, la quille et ses tuyères du bord bas, la quille encore,
  //      tournée, sur les flancs —, découpée à son seul relief (plus de tôle
  //      d'emprunt) et arrêtée avant les sommets ;
  //   3. à chaque sommet, un GOUSSET boulonné qui couvre la jonction.
  function peintCadre(): void {
    const e = CADRE * D
    const n = S.length
    const long = (a: Pt, b: Pt) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    // une arête porte sa bande peinte si elle est assez longue pour la
    // montrer entre ses deux goussets
    const longue = S.map((v, i) => long(v, S[(i + 1) % n]) >= (BANDE_MIN + 2 * GOUSSET) * D)
    // le gousset de chaque sommet : son côté — grand s'il doit couvrir le bout
    // d'une bande, petit entre deux arêtes nues —, borné par ses deux arêtes
    const gousset = S.map((v, i) =>
      Math.min((longue[i] || longue[(i + n - 1) % n] ? GOUSSET : GOUSSET_NU) * D, 0.42 * long(S[(i + n - 1) % n], v), 0.42 * long(v, S[(i + 1) % n])),
    )
    c.save()
    contour()
    c.clip()
    c.lineJoin = 'round'
    // la coupe du profilé, de l'intérieur vers le dehors : chaque trait, plus
    // étroit que le précédent, laisse dépasser une bande du précédent
    const coupe: [number, string][] = [
      [1, '#33414f'], // la lèvre intérieure, claire
      [0.93, '#070b11'], // la gorge, dans l'ombre
      [0.78, '#1a2430'], // le rail
      [0.5, '#0c1219'], // sa rainure
      [0.45, '#202b38'], // le rail, côté dehors
      [0.13, '#52647a'], // la lèvre extérieure : l'arête qui prend la lumière
    ]
    for (const [part, teinte] of coupe) {
      contour()
      c.lineWidth = 2 * e * part
      c.strokeStyle = teinte
      c.stroke()
    }
    // le grain de l'acier : le profilé, lisse, jurait contre la tôle peinte
    const grain = c.createPattern(grainAcier(), 'repeat')
    if (grain) {
      contour()
      c.lineWidth = 2 * e
      c.strokeStyle = grain
      c.stroke()
    }
    c.restore()
    // les bandes peintes débordent de la silhouette (les tuyères de la
    // quille) : elles se peignent sans découpe
    const haut = img('tempere-bord-haut')
    const bas = img('tempere-bord-bas')
    for (let i = 0; i < n; i++) {
      const a = S[i]
      const b = S[(i + 1) % n]
      const L = long(a, b)
      const m = BANDE.haut.dedans * fi + e
      if (hors(Math.min(a.x, b.x) - m, Math.min(a.y, b.y) - m, Math.max(a.x, b.x) + m, Math.max(a.y, b.y) + m)) continue
      // À UN ANGLE RENTRANT, l'arête va jusqu'au sommet : son gousset est de
      // l'autre côté, dans le coin de tôle que les deux bandes encadrent. La
      // retenue de sa largeur ne vaut qu'aux angles saillants, où les deux
      // bandes se recouvriraient (arrêtée partout, la quille laissait un
      // tronçon de profilé nu avant chaque marche — banc du 10/11)
      const retenue = (j: number) => (S[j].piece.startsWith('coin') ? gousset[j] : 0)
      const g0 = retenue(i)
      const g1 = retenue((i + 1) % n)
      const sens = b.x > a.x ? 'haut' : b.x < a.x ? 'bas' : b.y < a.y ? 'gauche' : 'droite'
      if (longue[i]) {
        // LA BANDE PEINTE, dans le repère de SON image : x le long de l'arête,
        // y vers le bas de l'image. Le bord haut est peint le dehors en haut ;
        // la quille le dehors en bas, et se tourne d'un quart de tour pour
        // habiller un flanc (le dehors à gauche, ou à droite)
        const B = sens === 'haut' ? BANDE.haut : BANDE.bas
        const im = sens === 'haut' ? haut : bas
        // l'origine : le bout de l'arête d'où part l'axe x de l'image
        const [o, og, fg] = sens === 'haut' ? [a, g0, g1] : [b, g1, g0]
        c.save()
        c.translate(o.x, o.y)
        if (sens === 'gauche') c.rotate(Math.PI / 2)
        if (sens === 'droite') c.rotate(-Math.PI / 2)
        // les tuyères ne garnissent que la quille : sur un flanc, la bande
        // s'arrête à la ligne de coque
        const dehors = sens === 'haut' ? B.dehors : sens === 'bas' ? B.dehors : 0
        const y0 = sens === 'haut' ? -B.dehors * fi : -B.dedans * fi
        const hb = (B.dedans + dehors) * fi
        const sy = sens === 'haut' ? B.ligne - B.dehors : B.ligne - B.dedans
        c.beginPath()
        c.rect(og, y0 - 1, L - og - fg, hb + 2)
        c.clip()
        const lw = im.width * fi
        // la bande part d'un décalage tiré par arête : toutes calées sur leur
        // coin, deux arêtes voisines montraient le même motif au même endroit
        for (let x = og - tire(i + 3, 17) * lw; x < L - fg; x += lw)
          c.drawImage(im, 0, sy, im.width, B.dedans + dehors, x, y0, lw + 0.5, hb)
        c.restore()
        // l'ombre de la bande sur la tôle, vers l'intérieur
        c.save()
        c.translate(a.x, a.y)
        c.rotate(Math.atan2(b.y - a.y, b.x - a.x))
        const yb = B.dedans * fi
        const ob = c.createLinearGradient(0, yb, 0, yb + 0.14 * D)
        ob.addColorStop(0, 'rgba(0,0,0,0.5)')
        ob.addColorStop(1, 'rgba(0,0,0,0)')
        c.fillStyle = ob
        c.fillRect(g0, yb, L - g0 - g1, 0.14 * D)
        c.restore()
        continue
      }
      // UNE ARÊTE COURTE garde le profilé nu, garni de nervures et de hublots
      // à la lumière du biome. Le repère : x le long d'elle, y vers
      // l'INTÉRIEUR de la coque (la silhouette tourne en sens horaire à l'écran)
      c.save()
      contour()
      c.clip()
      c.translate(a.x, a.y)
      c.rotate(Math.atan2(b.y - a.y, b.x - a.x))
      // la lumière vient du haut : le dessus s'éclaire, la quille reste dans
      // l'ombre, les flancs entre les deux
      c.fillStyle = sens === 'haut' ? 'rgba(170,205,235,0.07)' : sens === 'bas' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.12)'
      c.fillRect(g0, 0, L - g0 - g1, e)
      const nb = Math.max(1, Math.round((L - g0 - g1) / (PAS_HUBLOT * D)))
      const pas = (L - g0 - g1) / nb
      for (let j = 0; j < nb; j++) {
        const x = g0 + j * pas
        if (j > 0) {
          // la nervure : un collier qui ceinture le profilé
          const ln = 0.02 * D
          c.fillStyle = '#0a0f15'
          c.fillRect(x - ln / 2 - 0.004 * D, 0, ln + 0.008 * D, e)
          const gn = c.createLinearGradient(x - ln / 2, 0, x + ln / 2, 0)
          gn.addColorStop(0, '#3c4b5c')
          gn.addColorStop(0.45, '#566a80')
          gn.addColorStop(1, '#232e3b')
          c.fillStyle = gn
          c.fillRect(x - ln / 2, 0, ln, e * 0.96)
        }
        // le hublot : une fente de verre à la lumière du biome, dans le rail
        const lh = Math.min(0.1 * D, pas * 0.5)
        const hh = 0.019 * D
        const xm = x + pas / 2
        const ym = 0.615 * e
        c.save()
        c.beginPath()
        c.roundRect(xm - lh / 2, ym - hh / 2, lh, hh, hh / 2)
        c.shadowColor = `rgba(${th.lueur},${sens === 'bas' ? 0.4 : 0.7})`
        c.shadowBlur = 0.025 * D * K
        c.fillStyle = `rgba(${th.lueur},${sens === 'bas' ? 0.5 : 0.85})`
        c.fill()
        c.restore()
      }
      c.restore()
    }
    // LES GOUSSETS : à chaque sommet, une plaque boulonnée couvre la
    // rencontre des deux arêtes ; aux angles saillants, un feu de position
    c.save()
    contour()
    c.clip()
    for (let i = 0; i < n; i++) {
      const v = S[i]
      const av = S[(i + n - 1) % n]
      const ap = S[(i + 1) % n]
      // vers l'intérieur de chacune des deux arêtes (horaire à l'écran : la
      // normale intérieure est la direction tournée d'un quart de tour)
      const dedans = (p0: Pt, p1: Pt): Pt => ({ x: -Math.sign(p1.y - p0.y), y: Math.sign(p1.x - p0.x) })
      const n1 = dedans(av, v)
      const n2 = dedans(v, ap)
      const t = gousset[i]
      const gx = n1.x + n2.x
      const gy = n1.y + n2.y
      const x0 = Math.min(v.x, v.x + gx * t)
      const yy0 = Math.min(v.y, v.y + gy * t)
      if (hors(x0, yy0, x0 + t, yy0 + t)) continue
      // L'OCTOGONE de la station (le plan de la carte, game/dessinCarte.ts :
      // coins coupés à 22 % / 28 %) : un carré plein faisait une caisse posée
      // sur l'angle
      const octo = (m: number) => {
        const u = t - 2 * m
        const P: [number, number][] = [[0.24, 0], [0.76, 0], [1, 0.24], [1, 0.76], [0.76, 1], [0.24, 1], [0, 0.76], [0, 0.24]]
        c.beginPath()
        P.forEach(([ux, uy], j) => (j ? c.lineTo(x0 + m + ux * u, yy0 + m + uy * u) : c.moveTo(x0 + m + ux * u, yy0 + m + uy * u)))
        c.closePath()
      }
      // sous l'octogone, le profilé continue : ses coins coupés laissent voir
      // l'acier, pas la tôle
      c.fillStyle = '#121a23'
      c.fillRect(x0, yy0, t, t)
      const g = c.createLinearGradient(0, yy0, 0, yy0 + t)
      g.addColorStop(0, '#2a3644')
      g.addColorStop(1, '#111820')
      octo(t * 0.03)
      c.fillStyle = g
      c.fill()
      if (grain) {
        c.fillStyle = grain
        c.fill()
      }
      c.lineWidth = Math.max(1, 0.007 * D)
      c.strokeStyle = '#05080c'
      c.stroke()
      // l'arête du dessus prend la lumière
      c.beginPath()
      c.moveTo(x0 + t * 0.26, yy0 + t * 0.045)
      c.lineTo(x0 + t * 0.74, yy0 + t * 0.045)
      c.lineWidth = Math.max(1, 0.005 * D)
      c.strokeStyle = 'rgba(150,185,215,0.45)'
      c.stroke()
      octo(t * 0.17)
      c.fillStyle = 'rgba(4,8,13,0.55)'
      c.fill()
      c.lineWidth = Math.max(1, 0.005 * D)
      c.strokeStyle = 'rgba(120,150,180,0.25)'
      c.stroke()
      for (const [ux, uy] of [[0.5, 0.1], [0.5, 0.9], [0.1, 0.5], [0.9, 0.5]]) {
        c.beginPath()
        c.arc(x0 + ux * t, yy0 + uy * t, Math.max(0.0045 * D, t * 0.026), 0, Math.PI * 2)
        c.fillStyle = '#05080c'
        c.fill()
      }
      const mx = x0 + t / 2
      const my = yy0 + t / 2
      if (S[i].piece.startsWith('coin')) {
        // le feu de position d'un angle saillant, sous son verre
        c.save()
        c.beginPath()
        c.arc(mx, my, t * 0.085, 0, Math.PI * 2)
        c.shadowColor = 'rgba(242,201,142,0.9)'
        c.shadowBlur = t * 0.2 * K
        c.fillStyle = '#f2c98e'
        c.fill()
        c.restore()
      } else {
        // un angle rentrant : une bouche d'aération, trois lames
        c.lineWidth = Math.max(1, t * 0.035)
        c.strokeStyle = 'rgba(120,150,180,0.4)'
        for (const dy of [-0.11, 0, 0.11]) {
          c.beginPath()
          c.moveTo(mx - t * 0.15, my + dy * t)
          c.lineTo(mx + t * 0.15, my + dy * t)
          c.stroke()
        }
      }
    }
    c.restore()
    // LES DEUX COLLIERS D'AMARRAGE — l'entrée à gauche, la sortie à droite —,
    // pris dans les pièces de bout : seulement ce qui dépasse de la coque, et
    // la bride qui la mord. Le reste de ces pièces (une colonne de l'ancienne
    // tôle) ne se peint plus
    const hc = (COLLIER.bas - COLLIER.haut) * fi
    for (const cote of ['gauche', 'droite'] as const) {
      const pt = mp.colliers[cote]
      const im = brut(cote === 'gauche' ? 'tempere-bout-gauche' : 'tempere-bout-droit')
      // sur un bord plus court que le collier (le nez du fuseau), il rétrécit
      const k = Math.min(1, (pt.h * 1.5) / hc)
      const morsure = COLLIER.morsure * fi * k
      const dehors = (cote === 'gauche' ? COLLIER.gauche : im.width - COLLIER.droite) * fi * k
      const x0 = cote === 'gauche' ? pt.x - dehors : pt.x - morsure
      if (hors(x0, pt.y - (hc * k) / 2, x0 + dehors + morsure, pt.y + (hc * k) / 2)) continue
      const sx = cote === 'gauche' ? 0 : COLLIER.droite - COLLIER.morsure
      const sw = (cote === 'gauche' ? COLLIER.gauche : im.width - COLLIER.droite) + COLLIER.morsure
      c.drawImage(im, sx, COLLIER.haut, sw, COLLIER.bas - COLLIER.haut, x0, pt.y - (hc * k) / 2, dehors + morsure, hc * k)
    }
  }
}

/** LE GRAIN DE L'ACIER : une tuile de bruit, tirée une fois — des piqûres
 *  claires et sombres, presque transparentes. */
let grain: HTMLCanvasElement | null = null
function grainAcier(): HTMLCanvasElement {
  if (grain) return grain
  const t = document.createElement('canvas')
  t.width = t.height = 96
  const g = t.getContext('2d')
  if (g)
    for (let y = 0; y < 96; y += 2)
      for (let x = 0; x < 96; x += 2) {
        const v = tire(x + 3, y + 11)
        g.fillStyle = v < 0.5 ? `rgba(0,0,0,${(0.5 - v) * 0.5})` : `rgba(190,215,240,${(v - 0.5) * 0.12})`
        // des rayures : une piqûre sur douze s'étire
        g.fillRect(x, y, tire(y, x + 7) < 0.08 ? 14 : 2, 2)
      }
  grain = t
  return t
}
