// LE MODULE EN 2D, PEINT SUR UNE TOILE — la mise en page de render/module2d.ts
// habillée des pièces de tools/images/coque2d.py. La toile se recompose
// seulement quand la run avance (une salle franchie, un autre module) ; le
// moteur la pose ensuite comme une texture (renderer.ts, setModule2d).

import type { MiseEnPage } from './module2d'

/** Les pièces, à charger une fois. */
export const PIECES_MODULE2D = [
  'tempere-tole',
  'tempere-tole-2',
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

// LES PIÈCES MESURÉES (pixels des fichiers livrés, à moitié des sources) :
// une largeur de salle vaut 533 px de pièce — l'échelle de la maquette
// validée le 01/10 —, et chaque pièce dit où passe la ligne de coque.
const PX_PAR_SALLE = 533.3
const LIGNE_HAUT = 192 // bord-haut : le haut du rebord
const LIGNE_BAS = 292.5 // bord-bas : le bas de la quille
const LIGNE_GAUCHE = 225 // bout-gauche : le bord extérieur du capot
const LIGNE_DROITE = 294.5 // bout-droit
const BANDE_BOUT = 150 // la bande du capot, sans collier, prise en haut de l'image
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

/** PEINDRE le module sur une toile neuve. */
export function peintModule2d(mp: MiseEnPage, p: Pieces): HTMLCanvasElement {
  const toile = document.createElement('canvas')
  toile.width = mp.largeur
  toile.height = mp.hauteur
  const c = toile.getContext('2d')!
  const f = mp.densite / PX_PAR_SALLE
  const img = (n: string) => p.get(n)!
  // 1. la tôle, dans la silhouette : les deux variantes par rangées décalées
  c.save()
  c.beginPath()
  mp.silhouette.forEach((s, i) => (i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y)))
  c.closePath()
  c.clip()
  const toles = [img('tempere-tole'), img('tempere-tole-2')]
  const tl = toles[0].width * f
  for (let i = 0, y = 0; y < mp.hauteur; i++, y += tl) {
    const dec = ((i * 211) % toles[0].width) * f
    for (let x = -dec; x < mp.largeur; x += tl) c.drawImage(toles[i % 2], x, y, tl + 0.5, tl + 0.5)
  }
  // 2. les éléments uniques
  for (const e of mp.elements) {
    const im = img(`tempere-${e.nom}`)
    const h = (e.l * im.height) / im.width
    c.drawImage(im, e.x - e.l / 2, e.y - h / 2, e.l, h)
  }
  c.restore()
  // 3. les tubes, sous les cellules
  const tube = img('tube')
  const ep = 0.05 * mp.densite
  const tw = (tube.width * ep) / tube.height
  for (const t of mp.tubes) {
    const long = Math.abs(t.bx - t.ax) + Math.abs(t.by - t.ay)
    if (long < 1) continue
    c.save()
    c.translate(t.ax, t.ay)
    if (t.ax === t.bx) c.rotate(t.by > t.ay ? Math.PI / 2 : -Math.PI / 2)
    else if (t.bx < t.ax) c.rotate(Math.PI)
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
  for (const k of mp.cellules) c.drawImage(img(`cellule-${k.etat}`), k.x - k.l / 2, k.y - k.h / 2, k.l, k.h)
  // 5. les bords : chaque arête selon son sens (silhouette horaire)
  const n = mp.silhouette.length
  const bandeG = img('tempere-bout-gauche')
  const bandeD = img('tempere-bout-droit')
  for (let i = 0; i < n; i++) {
    const a = mp.silhouette[i]
    const b = mp.silhouette[(i + 1) % n]
    if (a.x === b.x) {
      const gauche = b.y < a.y
      const im = gauche ? bandeG : bandeD
      const ox = a.x - (gauche ? LIGNE_GAUCHE : LIGNE_DROITE) * f
      const bh = BANDE_BOUT * f
      for (let y = Math.min(a.y, b.y); y < Math.max(a.y, b.y); y += bh) {
        const reste = Math.min(bh, Math.max(a.y, b.y) - y)
        c.drawImage(im, 0, 0, im.width, (BANDE_BOUT * reste) / bh, ox, y, im.width * f, reste)
      }
    } else {
      const haut = b.x > a.x
      const im = img(haut ? 'tempere-bord-haut' : 'tempere-bord-bas')
      const oy = a.y - (haut ? LIGNE_HAUT : LIGNE_BAS) * f
      const lw = im.width * f
      for (let x = Math.min(a.x, b.x); x < Math.max(a.x, b.x); x += lw) {
        const reste = Math.min(lw, Math.max(a.x, b.x) - x)
        c.drawImage(im, 0, 0, (im.width * reste) / lw, im.height, x, oy, reste, im.height * f)
      }
    }
  }
  // 6. les colliers : l'entrée à gauche, la sortie à droite
  for (const [im, pt, ligne] of [
    [bandeG, mp.colliers.gauche, LIGNE_GAUCHE],
    [bandeD, mp.colliers.droite, LIGNE_DROITE],
  ] as const)
    c.drawImage(im, pt.x - ligne * f, pt.y - (im.height * f) / 2, im.width * f, im.height * f)
  // 7. les coins et les angles rentrants
  for (const s of mp.silhouette) {
    const k = COINS[s.piece]
    const im = img(`tempere-${s.piece}`)
    const kf = f * k.k
    c.save()
    c.translate(s.x, s.y)
    if (s.miroir) c.scale(-1, 1)
    c.drawImage(im, -k.ax * kf, -k.ay * kf, im.width * kf, im.height * kf)
    c.restore()
  }
  // 8. les équipements, debout sur les bords hauts
  for (const e of mp.equipements) {
    const im = img(`equipement-${e.nom}`)
    const k = f * 1.07
    c.drawImage(im, e.x - (im.width * k) / 2, e.y - im.height * k + 0.02 * mp.densite, im.width * k, im.height * k)
  }
  return toile
}
