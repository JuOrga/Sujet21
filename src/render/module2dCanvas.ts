// LE MODULE EN 2D, PEINT SUR UNE TOILE — la mise en page de render/module2d.ts
// habillée des pièces de tools/images/coque2d.py. La toile se recompose
// seulement quand la run avance (une salle franchie, un autre module) ; le
// moteur la pose ensuite comme une texture (renderer.ts, setModule2d).

import { CYL_BERCEAU, TUBE, type MiseEnPage } from './module2d'

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
  'detail-panneau',
  'detail-reparation',
  'detail-vanne',
  'detail-grille',
  'detail-cuve',
  'detail-aerations',
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
  'serre-anneau-haut',
  'serre-anneau-bande',
  'serre-anneau-bas',
  'serre-dome-gauche',
  'serre-dome-droit',
  'serre-berceau',
  'serre-cellule-joue',
  'serre-cellule-ambre',
  'serre-cellule-bleu',
  'serre-cellule-ferme',
  'serre-cellule-neutre',
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
// les pièces de la serre, livrées en pleine résolution : 1024 de leurs
// pixels par largeur de salle — deux bandes par étagère d'origine
const PX_SERRE = 1024
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
    const empile = (h: number, haut: HTMLImageElement, bande: HTMLImageElement, bas: HTMLImageElement) => {
      const cible = mp.densite / PX_SERRE
      const nb = Math.max(0, Math.round((h / cible - haut.height - bas.height) / bande.height))
      return { nb, e: h / (haut.height + nb * bande.height + bas.height) }
    }
    const colonne = (x: number, y: number, l: number, e: number, nb: number, haut: HTMLImageElement, bande: HTMLImageElement, bas: HTMLImageElement) => {
      c.drawImage(haut, x, y, l, haut.height * e + 0.5)
      let yy = y + haut.height * e
      for (let j = 0; j < nb; j++, yy += bande.height * e) c.drawImage(bande, x, yy, l, bande.height * e + 0.5)
      c.drawImage(bas, x, yy, l, bas.height * e)
    }
    // chaque capsule en trois colonnes aussi : son bord gauche et son arc, le
    // cœur répété en largeur, son bord droit — d'un bloc, à pleine finesse,
    // les capsules devenaient étroites et hautes (06/10) ; elles gardent la
    // largeur de la tranche d'origine, deux tiers de la hauteur du cylindre
    const tr = ['serre-tranche', 'serre-tranche-2'].map((n) =>
      (['haut', 'bande', 'bas'] as const).map((l) => (['g', 'm', 'd'] as const).map((k) => img(`${n}-${l}-${k}`))),
    )
    const [hg, hm, hd] = tr[0][0]
    const { nb, e } = empile(H, hg, tr[0][1][0], tr[0][2][0])
    const nm = Math.max(1, Math.round(((2 / 3) * H / e - hg.width - hd.width) / hm.width))
    const n = Math.max(1, Math.round(W / ((hg.width + nm * hm.width + hd.width) * e)))
    const sw = W / n
    // l'étirement en largeur qui fait tomber les capsules juste
    const fx = sw / ((hg.width + nm * hm.width + hd.width) * e)
    // CASSER LA GRILLE : une bande répétée telle quelle faisait un papier
    // peint, la même étagère en lignes et en colonnes (06/10). Chaque ligne
    // d'étagères tire sa tranche (les deux partagent leurs rebords, la
    // jonction tombe sur le bac), chaque cœur est retourné ou non (le miroir
    // garde le raccord : son bord droit est le bord gauche de l'original)
    const piece = (im: HTMLImageElement, x: number, y: number, l: number, h: number, miroir: boolean) => {
      if (!miroir) return c.drawImage(im, x, y, l, h)
      c.save()
      c.translate(x + l, y)
      c.scale(-1, 1)
      c.drawImage(im, 0, 0, l, h)
      c.restore()
    }
    for (let i = 0; i < n; i++) {
      const x0 = k.minX + i * sw
      if (hors(x0, k.minY, x0 + sw, k.maxY)) continue
      let y = k.minY
      for (let r = 0; r < nb + 2; r++) {
        const ligne = r === 0 ? 0 : r === nb + 1 ? 2 : 1
        const v = ligne === 1 ? (tire(i * 31 + r, 5) < 0.5 ? 0 : 1) : i % 2
        const rang = tr[v][ligne]
        const h = rang[0].height * e
        let x = x0
        for (let j = 0; j < nm + 2; j++) {
          const col = j === 0 ? 0 : j === nm + 1 ? 2 : 1
          const l = rang[col].width * e * fx
          if (!hors(x, y, x + l, y + h)) piece(rang[col], x, y, l + 0.5, h + 0.5, col === 1 && tire(i * 17 + j, r) < 0.5)
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
  if (mp.forme === 'cylindre') peintCylindre()
  else {
    c.save()
    c.beginPath()
    mp.silhouette.forEach((s, i) => (i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y)))
    c.closePath()
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
      c.lineWidth = 0.012 * mp.densite
      c.strokeRect(z.minX, z.minY, z.maxX - z.minX, z.maxY - z.minY)
    }
    // les petits détails, posés sur la tôle
    for (const d of mp.details) {
      const im = img(`detail-${d.nom}`)
      const h = (d.l * im.height) / im.width
      if (hors(d.x - d.l / 2, d.y - h / 2, d.x + d.l / 2, d.y + h / 2)) continue
      c.drawImage(im, d.x - d.l / 2, d.y - h / 2, d.l, h)
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
  }
  // 3. les tubes, sous les cellules. Un tube est une CONDUITE : un halo de
  // sa couleur s'il est praticable, le corps, une lueur au fil de son axe
  // et un collier à chaque bout. Le corps seul, mince, avec un filet plat,
  // se lisait comme un trait entre les cellules (aperçu du 05/10)
  const tube = img('tube')
  const collier = img('tube-collier')
  const ep = TUBE * mp.densite
  const tw = (tube.width * ep) / tube.height
  const ch = ep * 1.3
  const cw = (collier.width * ch) / collier.height
  const visibles = mp.tubes.filter((t) => {
    const long = Math.abs(t.bx - t.ax) + Math.abs(t.by - t.ay)
    return long >= 1 && !hors(Math.min(t.ax, t.bx) - ch, Math.min(t.ay, t.by) - ch, Math.max(t.ax, t.bx) + ch, Math.max(t.ay, t.by) + ch)
  })
  // l'emprise d'un tube, débordée de m de chaque côté et à chaque bout
  const emprise = (t: (typeof visibles)[number], m: number) =>
    c.rect(Math.min(t.ax, t.bx) - m, Math.min(t.ay, t.by) - m, Math.abs(t.bx - t.ax) + 2 * m, Math.abs(t.by - t.ay) + 2 * m)
  // l'ombre et le halo, D'UN SEUL TRACÉ pour tout le réseau : tube par tube,
  // ils s'empilaient en carrés plus sombres (ou plus vifs) à chaque coude
  c.beginPath()
  for (const t of visibles) emprise(t, ep * 0.8)
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.fill()
  for (const [etat, lumiere, force] of [['bleu', '99,183,230', 0.5], ['ambre', '255,160,60', 0.75]] as const) {
    const lot = visibles.filter((t) => t.etat === etat)
    if (!lot.length) continue
    c.save()
    c.beginPath()
    for (const t of lot) emprise(t, ep * 0.5)
    // le flou d'une ombre se compte en pixels de la toile, hors transformation
    c.shadowColor = `rgba(${lumiere},${force})`
    c.shadowBlur = ep * 1.6 * (fen ? fen.k : 1)
    c.fillStyle = `rgba(${lumiere},${force * 0.5})`
    c.fill()
    c.restore()
  }
  for (const t of visibles) {
    const long = Math.abs(t.bx - t.ax) + Math.abs(t.by - t.ay)
    c.save()
    c.translate(t.ax, t.ay)
    if (t.ax === t.bx) c.rotate(t.by > t.ay ? Math.PI / 2 : -Math.PI / 2)
    else if (t.bx < t.ax) c.rotate(Math.PI)
    const lumiere = t.etat === 'ambre' ? '255,160,60' : t.etat === 'bleu' ? '99,183,230' : null
    c.save()
    c.beginPath()
    c.rect(-ep / 2, -ep / 2, long + ep, ep)
    c.clip()
    for (let x = -ep / 2; x < long + ep; x += tw) c.drawImage(tube, x, -ep / 2, tw + 0.5, ep)
    // un tube éteint s'assombrit ; le chemin praticable porte une lueur
    const nuit = { ambre: 0, bleu: 0.15, joue: 0.3, eteint: 0.6 }[t.etat]
    c.fillStyle = `rgba(0,0,0,${nuit})`
    c.fillRect(-ep / 2, -ep / 2, long + ep, ep)
    if (lumiere) {
      const g = c.createLinearGradient(0, -ep / 2, 0, ep / 2)
      g.addColorStop(0, `rgba(${lumiere},0)`)
      g.addColorStop(0.5, `rgba(${lumiere},0.55)`)
      g.addColorStop(1, `rgba(${lumiere},0)`)
      c.fillStyle = g
      c.fillRect(-ep / 2, -ep * 0.18, long + ep, ep * 0.36)
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
  // 4. les cellules
  // dans la serre, des capsules de culture, à leurs proportions (plus
  // allongées que la case de la mini-carte)
  const capsules = mp.forme === 'cylindre'
  for (const k of mp.cellules) {
    if (hors(k.x - k.l / 2, k.y - k.h / 2, k.x + k.l / 2, k.y + k.h / 2)) continue
    const im = img(`${capsules ? 'serre-cellule' : 'cellule'}-${k.etat}`)
    const h = capsules ? (k.l * im.height) / im.width : k.h
    c.drawImage(im, k.x - k.l / 2, k.y - h / 2, k.l, h)
  }
  // le cylindre n'a ni bords ni coins : ses tranches portent leurs rebords
  if (mp.forme !== 'cylindre') {
    // LES BORDS SUR UN CALQUE, FONDUS VERS L'INTÉRIEUR : bords, coins et
    // angles rentrants ont été peints avec l'ANCIENNE tôle dans leur moitié
    // intérieure — contre la nouvelle, une couture le long de toute la coque
    // et des carrés plats aux angles (analyse du 02/10). Seule la bande du
    // rebord, contre la silhouette, est gardée ; au-delà, elle s'efface
    const calque = document.createElement('canvas')
    calque.width = toile.width
    calque.height = toile.height
    // Safari refuse une toile au-delà de sa mémoire de toiles : sans calque,
    // les bords se peignent droit sur la toile, sans fondu, plutôt que rien
    const qc = calque.getContext('2d')
    const q = qc ?? c
    if (qc && fen) q.setTransform(fen.k, 0, 0, fen.k, -fen.x * fen.k, -fen.y * fen.k)
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
    const m = qc ? masque.getContext('2d') : null
    if (m) {
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
    }
    if (qc) {
      c.save()
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.drawImage(calque, 0, 0)
      c.restore()
    }
    // rendre la mémoire tout de suite : deux toiles de plus, à chaque salle
    calque.width = calque.height = masque.width = masque.height = 0
  }
  // 8. les équipements, debout sur les bords hauts
  for (const e of mp.equipements) {
    if (hors(e.x, e.y - 0.6 * mp.densite, e.x, e.y)) continue
    const im = img(`equipement-${e.nom}`)
    const k = fi * 1.07
    c.drawImage(im, e.x - (im.width * k) / 2, e.y - im.height * k + 0.02 * mp.densite, im.width * k, im.height * k)
  }
  return toile
}
