// LE MODULE EN 2D, PEINT SUR UNE TOILE — la mise en page de render/module2d.ts
// habillée des pièces de tools/images/coque2d.py. La toile se recompose
// seulement quand la run avance (une salle franchie, un autre module) ; le
// moteur la pose ensuite comme une texture (renderer.ts, setModule2d).

import { TUBE, type MiseEnPage } from './module2d'

/** Les pièces, à charger une fois. */
export const PIECES_MODULE2D = [
  'tempere-tole',
  'tempere-tole-2',
  'tempere-tole-machines',
  'tempere-bord-haut',
  'tempere-bord-bas',
  'tempere-bout-gauche',
  'tempere-bout-droit',
  'tempere-coin-haut-gauche',
  'tempere-coin-haut-droit',
  'tempere-coin-bas-gauche',
  'tempere-coin-bas-droit',
  'tempere-rentrant-haut',
  'tempere-rentrant-bas',
  'tempere-baie',
  'tempere-baie-2',
  'tempere-colonne',
  'tempere-trappe',
  'tempere-machinerie',
  'cellule-joue',
  'cellule-ambre',
  'cellule-bleu',
  'cellule-ferme',
  'cellule-neutre',
  'equipement-grand-solaire',
  'equipement-petit-solaire',
  'equipement-antenne',
  'equipement-mat',
  'equipement-radiateur',
  'equipement-reservoir',
  'tube',
] as const

export type Pieces = Map<string, HTMLImageElement>

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

// LES PIÈCES MESURÉES, en pixels À LA MOITIÉ des sources (la première
// livraison) : une largeur de salle vaut 533 de ces pixels — l'échelle de la
// maquette validée le 01/10 —, et chaque pièce dit où passe la ligne de
// coque. Les fichiers sont livrés à LIVRE des sources (tools/images/coque2d.py).
const PX_PAR_SALLE = 533.3
const LIVRE = 0.8
const LIGNE_HAUT = 192 // bord-haut : le haut du rebord
const LIGNE_BAS = 292.5 // bord-bas : le bas de la quille
const LIGNE_GAUCHE = 225 // bout-gauche : le bord extérieur du capot
const LIGNE_DROITE = 294.5 // bout-droit
const BANDE_BOUT = 150 // la bande du capot, sans collier, prise en haut de l'image
// la bande gardée des bords, depuis la silhouette, en largeurs de salle :
// le rebord et la rangée de vitrages qu'il porte (0,26 mesuré sur le bord
// haut peint), puis le fondu vers la tôle
const REBORD = 0.28
const FONDU_REBORD = 0.12
// les coins : où tombe le sommet de la silhouette, et leur échelle propre
// — le générateur ne les a pas peints à l'échelle des bords
const COINS: Record<string, { ax: number; ay: number; k: number }> = {
  'coin-haut-gauche': { ax: 100, ay: 123.5, k: 0.66 },
  'coin-haut-droit': { ax: 526.5, ay: 123.5, k: 0.66 },
  'coin-bas-gauche': { ax: 114.5, ay: 492.5, k: 0.55 },
  'coin-bas-droit': { ax: 530.5, ay: 495, k: 0.55 },
  'rentrant-haut': { ax: 325, ay: 259, k: 0.7 },
  'rentrant-bas': { ax: 326, ay: 370, k: 0.6 },
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
  if (fen) c.setTransform(fen.k, 0, 0, fen.k, -fen.x * fen.k, -fen.y * fen.k)
  // f : les mesures (à la moitié des sources) ; fi : les fichiers (à LIVRE)
  const f = mp.densite / PX_PAR_SALLE
  const fi = (f * 0.5) / LIVRE
  // LA FENÊTRE ne peint que ce qu'elle montre : rejouer tout le module sous
  // une transformation coûtait autant que la toile entière, à chaque salle
  const marge = 0.6 * mp.densite
  const vu = fen
    ? { x0: fen.x - marge, y0: fen.y - marge, x1: fen.x + fen.l + marge, y1: fen.y + fen.h + marge }
    : { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity }
  const hors = (x0: number, y0: number, x1: number, y1: number) => x1 < vu.x0 || x0 > vu.x1 || y1 < vu.y0 || y0 > vu.y1
  const img = (n: string) => p.get(n)!
  // 1. la tôle, dans la silhouette. Une variante par rangée, tirée au sort,
  // et chaque carreau retourné ou non : une rangée d'une seule variante
  // montrait le même motif ~8 fois d'affilée (analyse du 02/10). Le miroir
  // horizontal garde le raccord — le bord droit d'un carreau retourné est
  // le bord gauche de l'original —, mélanger les variantes dans une rangée
  // ferait des coutures
  const tire = (i: number, j: number) => (((i * 73856093) ^ (j * 19349663)) >>> 0) % 1000 / 1000
  const pave = (im: HTMLImageElement, x0: number, y0: number, x1: number, y1: number, graine: number) => {
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
  c.save()
  c.beginPath()
  mp.silhouette.forEach((s, i) => (i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y)))
  c.closePath()
  c.clip()
  const toles = [img('tempere-tole'), img('tempere-tole-2')]
  const tl = toles[0].width * fi
  for (let i = 0, y = 0; y < mp.hauteur; i++, y += tl) {
    if (hors(0, y, mp.largeur, y + tl)) continue
    c.save()
    c.beginPath()
    c.rect(0, y, mp.largeur, tl)
    c.clip()
    pave(toles[tire(i, 7) < 0.5 ? 0 : 1], 0, y, mp.largeur, y + tl, i * 37)
    c.restore()
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
    c.lineWidth = 0.012 * mp.densite
    c.strokeRect(z.minX, z.minY, z.maxX - z.minX, z.maxY - z.minY)
  }
  // 2. les éléments uniques ; les vitrages de la serre débordent d'un halo
  // vert sur la tôle : sans lui, la serre ne se reconnaissait qu'au rebord
  for (const e of mp.elements) {
    const im = img(`tempere-${e.nom}`)
    const h = (e.l * im.height) / im.width
    const r = Math.max(e.l, h) * 0.55
    if (hors(e.x - r, e.y - r, e.x + r, e.y + r)) continue
    if (e.nom === 'baie' || e.nom === 'baie-2' || e.nom === 'colonne') {
      const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, r)
      g.addColorStop(0, 'rgba(90,200,120,0.09)')
      g.addColorStop(1, 'rgba(90,200,120,0)')
      c.fillStyle = g
      c.fillRect(e.x - r, e.y - r, 2 * r, 2 * r)
    }
    c.drawImage(im, e.x - e.l / 2, e.y - h / 2, e.l, h)
  }
  c.restore()
  // 3. les tubes, sous les cellules
  const tube = img('tube')
  const ep = TUBE * mp.densite
  const tw = (tube.width * ep) / tube.height
  for (const t of mp.tubes) {
    const long = Math.abs(t.bx - t.ax) + Math.abs(t.by - t.ay)
    if (long < 1 || hors(Math.min(t.ax, t.bx) - ep, Math.min(t.ay, t.by) - ep, Math.max(t.ax, t.bx) + ep, Math.max(t.ay, t.by) + ep)) continue
    c.save()
    c.translate(t.ax, t.ay)
    if (t.ax === t.bx) c.rotate(t.by > t.ay ? Math.PI / 2 : -Math.PI / 2)
    else if (t.bx < t.ax) c.rotate(Math.PI)
    // un liseré d'ombre : les tubes éteints se perdaient dans la tôle
    c.fillStyle = 'rgba(0,0,0,0.5)'
    c.fillRect(-ep * 0.8, -ep * 0.8, long + ep * 1.6, ep * 1.6)
    c.beginPath()
    c.rect(-ep / 2, -ep / 2, long + ep, ep)
    c.clip()
    for (let x = -ep / 2; x < long + ep; x += tw) c.drawImage(tube, x, -ep / 2, tw + 0.5, ep)
    // un tube éteint s'assombrit ; le chemin praticable porte un filet de lumière
    const nuit = { ambre: 0, bleu: 0.15, joue: 0.3, eteint: 0.6 }[t.etat]
    c.fillStyle = `rgba(0,0,0,${nuit})`
    c.fillRect(-ep / 2, -ep / 2, long + ep, ep)
    if (t.etat === 'ambre' || t.etat === 'bleu') {
      c.fillStyle = t.etat === 'ambre' ? 'rgba(255,160,60,0.85)' : 'rgba(99,183,230,0.75)'
      c.fillRect(-ep / 2, -ep * 0.09, long + ep, ep * 0.18)
    }
    c.restore()
  }
  // 4. les cellules
  for (const k of mp.cellules) if (!hors(k.x - k.l / 2, k.y - k.h / 2, k.x + k.l / 2, k.y + k.h / 2)) c.drawImage(img(`cellule-${k.etat}`), k.x - k.l / 2, k.y - k.h / 2, k.l, k.h)
  // LES BORDS SUR UN CALQUE, FONDUS VERS L'INTÉRIEUR : bords, coins et
  // angles rentrants ont été peints avec l'ANCIENNE tôle dans leur moitié
  // intérieure — contre la nouvelle, une couture le long de toute la coque
  // et des carrés plats aux angles (analyse du 02/10). Seule la bande du
  // rebord, contre la silhouette, est gardée ; au-delà, elle s'efface
  const calque = document.createElement('canvas')
  calque.width = toile.width
  calque.height = toile.height
  const q = calque.getContext('2d')!
  if (fen) q.setTransform(fen.k, 0, 0, fen.k, -fen.x * fen.k, -fen.y * fen.k)
  // 5. les bords : chaque arête selon son sens (silhouette horaire)
  const n = mp.silhouette.length
  const bandeG = img('tempere-bout-gauche')
  const bandeD = img('tempere-bout-droit')
  for (let i = 0; i < n; i++) {
    const a = mp.silhouette[i]
    const b = mp.silhouette[(i + 1) % n]
    if (hors(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))) continue
    if (a.x === b.x) {
      const gauche = b.y < a.y
      const im = gauche ? bandeG : bandeD
      const ox = a.x - (gauche ? LIGNE_GAUCHE : LIGNE_DROITE) * f
      const bh = BANDE_BOUT * f
      for (let y = Math.min(a.y, b.y); y < Math.max(a.y, b.y); y += bh) {
        const reste = Math.min(bh, Math.max(a.y, b.y) - y)
        q.drawImage(im, 0, 0, im.width, (BANDE_BOUT * (LIVRE / 0.5) * reste) / bh, ox, y, im.width * fi, reste)
      }
    } else {
      const haut = b.x > a.x
      const im = img(haut ? 'tempere-bord-haut' : 'tempere-bord-bas')
      const oy = a.y - (haut ? LIGNE_HAUT : LIGNE_BAS) * f
      const lw = im.width * fi
      for (let x = Math.min(a.x, b.x); x < Math.max(a.x, b.x); x += lw) {
        const reste = Math.min(lw, Math.max(a.x, b.x) - x)
        q.drawImage(im, 0, 0, (im.width * reste) / lw, im.height, x, oy, reste, im.height * fi)
      }
    }
  }
  // 6. les colliers : l'entrée à gauche, la sortie à droite
  for (const [im, pt, ligne] of [
    [bandeG, mp.colliers.gauche, LIGNE_GAUCHE],
    [bandeD, mp.colliers.droite, LIGNE_DROITE],
  ] as const)
  {
    // sur un bord plus court que l'image (le nez du fuseau), seule sa part
    // centrale, celle du collier
    const hTout = im.height * fi
    const h = Math.min(hTout, pt.h)
    const sy = ((hTout - h) / 2 / hTout) * im.height
    q.drawImage(im, 0, sy, im.width, (h / hTout) * im.height, pt.x - ligne * f, pt.y - h / 2, im.width * fi, h)
  }
  // 7. les coins et les angles rentrants
  for (const s of mp.silhouette) {
    if (hors(s.x, s.y, s.x, s.y)) continue
    const k = COINS[s.piece]
    const im = img(`tempere-${s.piece}`)
    q.save()
    q.translate(s.x, s.y)
    if (s.miroir) q.scale(-1, 1)
    q.drawImage(im, -k.ax * f * k.k, -k.ay * f * k.k, im.width * fi * k.k, im.height * fi * k.k)
    q.restore()
  }
  // le masque : 1 au cœur de la coque, 0 contre la silhouette, un fondu entre
  const masque = document.createElement('canvas')
  masque.width = toile.width
  masque.height = toile.height
  const m = masque.getContext('2d')!
  if (fen) m.setTransform(fen.k, 0, 0, fen.k, -fen.x * fen.k, -fen.y * fen.k)
  const contour = () => {
    m.beginPath()
    mp.silhouette.forEach((s, i) => (i ? m.lineTo(s.x, s.y) : m.moveTo(s.x, s.y)))
    m.closePath()
  }
  contour()
  m.fillStyle = '#000'
  m.fill()
  m.globalCompositeOperation = 'destination-out'
  m.strokeStyle = '#000'
  const D = REBORD * mp.densite
  const F = FONDU_REBORD * mp.densite
  for (let k = 0; k < 4; k++) {
    m.globalAlpha = 0.5
    m.lineWidth = 2 * (D + (F * (4 - k)) / 4)
    contour()
    m.stroke()
  }
  m.globalAlpha = 1
  m.lineWidth = 2 * D
  contour()
  m.stroke()
  q.setTransform(1, 0, 0, 1, 0, 0)
  q.globalCompositeOperation = 'destination-out'
  q.drawImage(masque, 0, 0)
  c.save()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.drawImage(calque, 0, 0)
  c.restore()
  // rendre la mémoire tout de suite : deux toiles de plus, à chaque salle
  calque.width = calque.height = masque.width = masque.height = 0
  // 8. les équipements, debout sur les bords hauts
  for (const e of mp.equipements) {
    if (hors(e.x, e.y - 0.6 * mp.densite, e.x, e.y)) continue
    const im = img(`equipement-${e.nom}`)
    const k = fi * 1.07
    c.drawImage(im, e.x - (im.width * k) / 2, e.y - im.height * k + 0.02 * mp.densite, im.width * k, im.height * k)
  }
  return toile
}
