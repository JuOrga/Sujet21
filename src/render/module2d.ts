// LE MODULE EN 2D DE FACE — la coque du module autour de la salle, la
// mini-carte posée dedans (le croquis du concepteur, 01/10).
//
// Pourquoi de face : le décor bâti en perspective, puis peint en
// perspective (deux essais abandonnés, 01/10), mêlait deux projections — la salle vue de face dans un décor qui fuyait — et figeait la
// mini-carte dans une image. Ici tout est dans le plan de la salle : le
// module est une grande coque, la salle jouée y est ENCASTRÉE à taille réelle,
// à sa place dans la grille, et les autres salles de la mini-carte sont de
// petites cellules autour d'elle :
//   · les RANGS avancent de gauche à droite, les VOIES sont les lignes (la
//     voie 0 en haut) — sur la ligne du haut, on voit le bord supérieur du
//     module au-dessus de la salle ; sur celle du bas, sa quille dessous ;
//   · une cellule dit son état : jouée (grise), joignable maintenant (ambre),
//     joignable plus loin (bleue), fermée par les choix (éteinte, croix) ;
//   · des tubes les relient comme les liens de la mini-carte, allumés sur le
//     chemin encore praticable.
// La silhouette n'est pas un rectangle : un pont surélevé au milieu, une
// salle des machines sous la fin du module (la forme « étagée »).
//
// Ce fichier est la MISE EN PAGE, pure et testée (module2d.spec.ts) : tout y
// est en pixels d'une toile, que render/module2dCanvas.ts peint avec les
// pièces de tools/images/coque2d.py, et que le moteur pose dans le monde.

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Ce que la mini-carte dit du module, réduit à ce que la coque montre. */
export interface VueModule2d {
  rangs: number
  voies: number
  /** la salle où l'on joue */
  rang: number
  voie: number
  /** les voies joignables au rang suivant, depuis (r, v) */
  suivants: (r: number, v: number) => readonly number[]
  /** la voie jouée à chaque rang déjà franchi (rangs 0 … rang − 1) */
  joues: readonly number[]
}

export type EtatCellule = 'joue' | 'ambre' | 'bleu' | 'ferme'
export type EtatTube = 'joue' | 'ambre' | 'bleu' | 'eteint'

/** Un sommet de la silhouette, et la pièce qui l'habille. */
export interface Sommet {
  x: number
  y: number
  /** coin saillant (coin-*) ou angle rentrant (rentrant-*, miroir : retourné) */
  piece: string
  miroir: boolean
}

export interface MiseEnPage {
  largeur: number
  hauteur: number
  /** pixels de toile par largeur de salle */
  densite: number
  /** la toile, dans le monde (y vers le HAUT) */
  monde: Rect
  /** la silhouette, dans le sens horaire À L'ÉCRAN (y vers le bas) */
  silhouette: Sommet[]
  /** le trou de la salle jouée, en pixels de toile */
  salle: Rect
  cellules: { x: number; y: number; l: number; h: number; etat: EtatCellule }[]
  tubes: { ax: number; ay: number; bx: number; by: number; etat: EtatTube }[]
  /** les zones peintes en tôle de salle des machines, en pixels de toile */
  machines: Rect[]
  /** les éléments uniques posés sur la tôle : centre, largeur */
  elements: { nom: string; x: number; y: number; l: number }[]
  /** les petits détails semés sur la tôle : centre, largeur */
  details: { nom: string; x: number; y: number; l: number }[]
  /** les équipements extérieurs posés sur un bord haut : pied, largeur relative */
  equipements: { nom: string; x: number; y: number }[]
  /** les deux colliers : l'entrée (bord gauche) et la sortie (bord droit) */
  colliers: { gauche: { x: number; y: number; h: number }; droite: { x: number; y: number; h: number } }
}

// LA GRILLE, en largeurs de salle (la maquette v2 du 01/10)
export const PAS_RANG = 1.35 // d'un rang à l'autre
export const PAS_VOIE = 1.3 // d'une voie à l'autre, en HAUTEURS de salle
export const CELLULE_L = 0.3 // une cellule : 30 % de la largeur de la salle jouée
export const TUBE = 0.05 // l'épaisseur d'un tube
// la coque autour de la grille
const MARGE_X = 0.15
const MARGE_Y = 0.35 // en hauteurs de salle
// la hauteur de salle de référence, pour le pas des voies (une salle 3:2)
const HR_REF = 0.66
/** Le pas des voies, en largeurs de salle : fixe, sauf pour une salle si
 *  haute qu'elle toucherait les cellules des voies voisines. */
export function pasVoie(hr: number): number {
  return Math.max(PAS_VOIE * HR_REF, hr / 2 + CELLULE_L / 3 + 0.08)
}
// autour de la coque : les équipements dessus, les tuyères et colliers
const BORD_HAUT = 0.75
const BORD_BAS = 0.3
const BORD_COTES = 0.45

/** La densité de la toile : 360 px par largeur de salle — le zoom de jeu
 *  montre la salle à ~320 px —, ramenée pour que la toile tienne dans une
 *  texture de 4 000 px de côté. */
export const DENSITE = 360
export const TOILE_MAX = 4000

/** LA MINI-CARTE, en états : ce qu'on peut encore joindre depuis la salle
 *  jouée, de proche en proche, et le chemin déjà joué. */
export function etats(vue: VueModule2d): {
  cellule: (r: number, v: number) => EtatCellule | 'ici'
  tube: (r: number, v: number, w: number) => EtatTube
} {
  const joignable = new Set<string>([`${vue.rang}:${vue.voie}`])
  for (let r = vue.rang; r < vue.rangs - 1; r++)
    for (let v = 0; v < vue.voies; v++)
      if (joignable.has(`${r}:${v}`)) for (const w of vue.suivants(r, v)) joignable.add(`${r + 1}:${w}`)
  const chemin = [...vue.joues.slice(0, vue.rang), vue.voie]
  const joue = (r: number, v: number) => r <= vue.rang && chemin[r] === v
  return {
    cellule: (r, v) => {
      if (r === vue.rang && v === vue.voie) return 'ici'
      if (joue(r, v)) return 'joue'
      if (r > vue.rang && joignable.has(`${r}:${v}`)) return r === vue.rang + 1 ? 'ambre' : 'bleu'
      return 'ferme'
    },
    tube: (r, v, w) => {
      if (joue(r, v) && joue(r + 1, w)) return 'joue'
      if (r >= vue.rang && joignable.has(`${r}:${v}`) && joignable.has(`${r + 1}:${w}`))
        return r === vue.rang ? 'ambre' : 'bleu'
      return 'eteint'
    },
  }
}

// LES FORMES — une par type de module, FIXE : ses marches sont accrochées
// aux RANGS de la mini-carte, jamais à la salle jouée. Trois silhouettes
// (maquette du 02/10) : étagée (un pont surélevé, une salle des machines),
// fuseau (un nez à l'entrée, une poupe à moteurs), dorsale (une tour, deux
// nacelles).
export type FormeModule = 'etagee' | 'fuseau' | 'dorsale'
const FORMES_PAR_BIOME: Record<string, FormeModule> = { tempere: 'etagee', chaud: 'fuseau', cryo: 'dorsale' }
export function formeDuBiome(biome: string): FormeModule {
  return FORMES_PAR_BIOME[biome] ?? 'etagee'
}

/** Le contour d'une forme, sens horaire à l'écran, en largeurs de salle. */
function silhouette(
  forme: FormeModule,
  g: { xL: number; xR: number; yT: number; yB: number; rang: (r: number) => number; rangs: number },
): [number, number][] {
  const { xL, xR, yT, yB } = g
  // la frontière entre le rang r − 1 et le rang r
  const b = (r: number) => g.rang(r) - PAS_RANG / 2
  const yM = (yT + yB) / 2
  const n = g.rangs
  // un module trop court pour ses marches : la coque simple
  if (n < 3) return [[xL, yT], [xR, yT], [xR, yB], [xL, yB]]
  if (forme === 'fuseau') {
    const nez = 0.75
    const poupe = 0.6
    return [
      [xL - nez, yM - 0.4], [xL, yM - 0.4], [xL, yT], [xR, yT], [xR, yT + 0.27], [xR + poupe, yT + 0.27],
      [xR + poupe, yM - 0.3], [xR + poupe + 0.5, yM - 0.3], [xR + poupe + 0.5, yM + 0.3], [xR + poupe, yM + 0.3],
      [xR + poupe, yB - 0.27], [xR, yB - 0.27], [xR, yB], [xL, yB], [xL, yM + 0.4], [xL - nez, yM + 0.4],
    ]
  }
  if (forme === 'dorsale') {
    const t = g.rang(Math.floor(n / 2))
    const p1 = g.rang(1)
    const p2 = g.rang(Math.max(2, n - 2))
    return [
      [xL, yT], [t - 0.55, yT], [t - 0.55, yT - 0.9], [t + 0.55, yT - 0.9], [t + 0.55, yT], [xR, yT],
      [xR, yB], [p2 + 0.5, yB], [p2 + 0.5, yB + 0.55], [p2 - 0.5, yB + 0.55], [p2 - 0.5, yB],
      [p1 + 0.5, yB], [p1 + 0.5, yB + 0.55], [p1 - 0.5, yB + 0.55], [p1 - 0.5, yB], [xL, yB],
    ]
  }
  // étagée : le pont du rang 1 à l'avant-dernier, la salle des machines sous
  // la seconde moitié
  const d0 = b(1)
  const d1 = b(Math.max(2, n - 1))
  const e0 = b(Math.max(2, Math.floor(n / 2)))
  const e1 = g.rang(n - 1)
  const dh = 0.7
  const eh = 0.6
  return [
    [xL, yT], [d0, yT], [d0, yT - dh], [d1, yT - dh], [d1, yT], [xR, yT],
    [xR, yB], [e1, yB], [e1, yB + eh], [e0, yB + eh], [e0, yB], [xL, yB],
  ]
}

/** L'élément qui signe la forme, en largeurs de salle (centre, largeur). */
function elementDeForme(forme: FormeModule, c: [number, number][]): { nom: string; x: number; y: number; l: number } | null {
  if (c.length === 4) return null
  if (forme === 'etagee') {
    // le pont : entre le 2e et le 5e sommet
    const [x0, y0] = c[2]
    const [x1] = c[3]
    const l = Math.min(2.4, (x1 - x0) * 0.8)
    return { nom: 'baie', x: (x0 + x1) / 2, y: y0 + 0.22 + l / 2.52 / 2 + 0.05, l }
  }
  if (forme === 'dorsale') {
    const [x0, y0] = c[2]
    const [x1] = c[3]
    return { nom: 'trappe', x: (x0 + x1) / 2, y: y0 + 0.5, l: 0.5 }
  }
  if (c.length < 16) return null
  // la poupe : entre la coque et la tuyère
  return { nom: 'machinerie', x: c[4][0] + 0.3, y: (c[5][1] + c[10][1]) / 2, l: 0.5 }
}

/** LA SALLE DES MACHINES de chaque forme, en largeurs de salle : la marche
 *  sous la poupe (étagée), les deux nacelles (dorsale), la tuyère (fuseau).
 *  Peinte de la même tôle que le reste, la forme ne se lisait qu'à la
 *  silhouette, jamais dedans (analyse du 02/10). */
function zonesMachines(forme: FormeModule, c: [number, number][]): [number, number, number, number][] {
  if (c.length === 4) return []
  if (forme === 'etagee') return [[c[10][0], c[10][1], c[8][0], c[8][1]]]
  if (forme === 'dorsale')
    return [
      [c[9][0], c[6][1], c[7][0], c[8][1]],
      [c[13][0], c[10][1], c[11][0], c[12][1]],
    ]
  if (c.length < 16) return []
  return [[c[6][0], c[6][1], c[7][0], c[8][1]]]
}

/** La colonne de culture : hauteur / largeur de sa pièce livrée. */
export const RATIO_COLONNE = 3.26

/** CHAQUE ANGLE PREND SA PIÈCE selon le sens du contour (horaire à l'écran) :
 *  un virage à droite est un coin saillant, à gauche un angle rentrant —
 *  les deux angles rentrants livrés, et leurs miroirs. */
function habille(c: [number, number][]): Sommet[] {
  const dir = (a: [number, number], b: [number, number]) => (b[0] > a[0] ? 'E' : b[0] < a[0] ? 'O' : b[1] > a[1] ? 'S' : 'N')
  const pieces: Record<string, [string, boolean]> = {
    NE: ['coin-haut-gauche', false],
    ES: ['coin-haut-droit', false],
    SO: ['coin-bas-droit', false],
    ON: ['coin-bas-gauche', false],
    EN: ['rentrant-haut', false],
    SE: ['rentrant-haut', true],
    NO: ['rentrant-bas', false],
    OS: ['rentrant-bas', true],
  }
  return c.map((q, i) => {
    const [piece, miroir] = pieces[dir(c[(i + c.length - 1) % c.length], q) + dir(q, c[(i + 1) % c.length])]
    return { x: q[0], y: q[1], piece, miroir }
  })
}

const DETAILS = ['panneau', 'reparation', 'vanne', 'grille', 'cuve', 'aerations']
/** un détail : sa largeur, en largeurs de salle — à peu près un panneau de tôle */
export const DETAIL_L = 0.2
/** au-delà de la bande du rebord (module2dCanvas, REBORD 0,28), que le moteur
 *  fond vers la tôle : un détail dessous y serait à moitié caché */
const MARGE_DETAIL_BORD = 0.3

/** un tirage stable dans [0, 1[ : le même module sème toujours pareil */
const tirage = (i: number, j: number) => ((((i * 73856093) ^ (j * 19349663)) >>> 0) % 1000) / 1000

function dansPolygone(x: number, y: number, p: { x: number; y: number }[]): boolean {
  let dedans = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) dedans = !dedans
  return dedans
}

/** SEMER LES DÉTAILS sur la tôle, en pixels de toile : une grille décalée,
 *  un tirage par case, et rien qui touche la salle, une cellule, un tube, un
 *  élément ou le rebord. Une tôle nue se répétait encore à l'œil ; quelques
 *  détails épars cassent la répétition. */
function semeDetails(
  densite: number,
  bornes: { x0: number; y0: number; x1: number; y1: number },
  silhouette: { x: number; y: number }[],
  obstacles: Rect[],
  tubes: MiseEnPage['tubes'],
): MiseEnPage['details'] {
  const out: MiseEnPage['details'] = []
  const pas = 0.45 * densite
  // la vanne, la plus haute, fait 1,5 fois sa largeur
  const demi = 0.16 * densite
  const bord = demi + MARGE_DETAIL_BORD * densite
  for (let i = 0, y = bornes.y0; y < bornes.y1; i++, y += pas)
    for (let j = 0, x = bornes.x0 + (i % 2) * pas * 0.5; x < bornes.x1; j++, x += pas) {
      if (tirage(i, j) > 0.45) continue
      const cx = x + (tirage(j, i + 17) - 0.5) * pas * 0.5
      const cy = y + (tirage(i + 31, j) - 0.5) * pas * 0.5
      if (![[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([a, b]) => dansPolygone(cx + a * bord, cy + b * bord, silhouette))) continue
      // contre un obstacle, la demi-largeur seule : il est peint par-dessus
      const d = (DETAIL_L / 2) * densite
      if (obstacles.some((o) => cx + d > o.minX && cx - d < o.maxX && cy + d > o.minY && cy - d < o.maxY)) continue
      // un tube peut passer DESSUS (il est peint après, cerné d'ombre) ; mais
      // pas sur son axe, où le détail lui ferait une bosse
      if (tubes.some((t) => (t.ay === t.by ? Math.abs(cy - t.ay) < demi * 0.5 && cx > Math.min(t.ax, t.bx) && cx < Math.max(t.ax, t.bx) : Math.abs(cx - t.ax) < demi * 0.5 && cy > Math.min(t.ay, t.by) && cy < Math.max(t.ay, t.by))))
        continue
      out.push({ nom: DETAILS[Math.floor(tirage(i + 7, j + 3) * DETAILS.length)], x: cx, y: cy, l: DETAIL_L * densite })
    }
  return out
}

const EQUIPEMENTS = ['mat', 'grand-solaire', 'reservoir', 'antenne', 'radiateur', 'petit-solaire']

/** METTRE EN PAGE le module autour de la salle (coque comprise). */
export function miseEnPage(salle: Rect, vue: VueModule2d, forme: FormeModule = 'etagee'): MiseEnPage {
  const R = salle.maxX - salle.minX
  const hr = (salle.maxY - salle.minY) / R
  const px = PAS_RANG
  // LE PAS DES VOIES NE SUIT PLUS LA SALLE : réglé sur sa hauteur, il
  // étirait ou écrasait tout le module d'une salle à l'autre — la forme
  // semblait tirée au hasard (aperçu du 02/10). Une hauteur de référence ;
  // une salle plus haute écarte seulement les voies juste assez
  const py = pasVoie(hr)
  // tout en largeurs de salle, l'origine au centre de la salle, y vers le bas
  const cel = (r: number, v: number) => [(r - vue.rang) * px, (v - vue.voie) * py] as const
  const xL = cel(0, 0)[0] - px / 2 - MARGE_X
  const xR = cel(vue.rangs - 1, 0)[0] + px / 2 + MARGE_X
  // la coque couvre la grille, et la salle jouée quelle que soit sa hauteur
  const yT = Math.min(cel(0, 0)[1] - py / 2 - MARGE_Y * HR_REF, -hr / 2 - 0.12)
  const yB = Math.max(cel(0, vue.voies - 1)[1] + py / 2 + MARGE_Y * HR_REF, hr / 2 + 0.12)
  const contour = silhouette(forme, { xL, xR, yT, yB, rang: (r: number) => cel(r, 0)[0], rangs: vue.rangs })
  // la toile : la silhouette et ses abords
  const xs = contour.map((q) => q[0])
  const ys = contour.map((q) => q[1])
  const bx0 = Math.min(...xs) - BORD_COTES
  const bx1 = Math.max(...xs) + BORD_COTES
  const by0 = Math.min(...ys) - BORD_HAUT
  const by1 = Math.max(...ys) + BORD_BAS
  const densite = Math.min(DENSITE, TOILE_MAX / (bx1 - bx0), TOILE_MAX / (by1 - by0))
  const X = (u: number) => (u - bx0) * densite
  const Y = (v: number) => (v - by0) * densite
  const cx = (salle.minX + salle.maxX) / 2
  const cy = (salle.minY + salle.maxY) / 2
  const e = etats(vue)
  const cellules: MiseEnPage['cellules'] = []
  const tubes: MiseEnPage['tubes'] = []
  for (let r = 0; r < vue.rangs; r++)
    for (let v = 0; v < vue.voies; v++) {
      const [u, w] = cel(r, v)
      const etat = e.cellule(r, v)
      if (etat !== 'ici')
        cellules.push({ x: X(u), y: Y(w), l: CELLULE_L * densite, h: (CELLULE_L / 1.5) * densite, etat })
      if (r === vue.rangs - 1) continue
      // le tube vers chaque suivant : à l'horizontale jusqu'à mi-chemin, à
      // la verticale jusqu'à sa voie, à l'horizontale jusqu'à lui
      for (const s2 of vue.suivants(r, v)) {
        const [u2, w2] = cel(r + 1, s2)
        const um = (u + u2) / 2
        const et = e.tube(r, v, s2)
        // à la salle jouée, le tube s'arrête à son bord : elle est à taille
        // réelle, pas une cellule
        const ua = etat === 'ici' ? 0.5 : u
        const ub = e.cellule(r + 1, s2) === 'ici' ? -0.5 : u2
        tubes.push({ ax: X(ua), ay: Y(w), bx: X(um), by: Y(w), etat: et })
        if (s2 !== v) tubes.push({ ax: X(um), ay: Y(w), bx: X(um), by: Y(w2), etat: et })
        tubes.push({ ax: X(um), ay: Y(w2), bx: X(ub), by: Y(w2), etat: et })
      }
    }
  // les éléments uniques : dans les vides ENTRE deux voies, sous un rang —
  // aucun tube n'y passe (ils courent sur les voies et à mi-chemin des
  // rangs) ; la machinerie aux deux bouts du module ; la grande baie sur le pont
  const elements: MiseEnPage['elements'] = []
  for (let r = 0; r < vue.rangs; r++)
    for (let v = 0; v + 1 < vue.voies; v++) {
      // pas contre la salle jouée : elle est à taille réelle, pas une cellule,
      // et un élément posé au pas des cellules la touchait (ou s'y cachait)
      if (r === vue.rang && (v === vue.voie - 1 || v === vue.voie)) continue
      const [u, w] = cel(r, v + 0.5)
      const k = (r * 2 + v) % 5
      const bout = r === 0 || r === vue.rangs - 1
      // deux baies en alternance et une colonne de culture : les trois
      // mêmes baies côte à côte se lisaient comme un copier-coller
      const nom =
        bout && k % 2 === 1 ? 'machinerie' : k === 0 ? (r % 2 ? 'baie-2' : 'baie') : k === 2 ? 'colonne' : k === 3 ? 'trappe' : null
      if (!nom) continue
      // la colonne, verticale, tient entre deux voies sans toucher leurs cellules
      const l = { baie: 0.95, 'baie-2': 0.9, colonne: (0.6 * py) / RATIO_COLONNE, trappe: 0.5, machinerie: 0.8 }[nom]
      elements.push({ nom, x: X(u), y: Y(w), l: l * densite })
    }
  // l'élément de la forme : la grande baie sur le pont, la trappe en haut de
  // la tour, la machinerie dans la poupe
  const signe = elementDeForme(forme, contour)
  if (signe) elements.push({ nom: signe.nom, x: X(signe.x), y: Y(signe.y), l: signe.l * densite })
  // les détails, à l'écart de tout ce qui porte du sens
  const silPx = contour.map(([u, w]) => ({ x: X(u), y: Y(w) }))
  const pres = (x0: number, y0: number, x1: number, y1: number, m: number): Rect => ({ minX: x0 - m, minY: y0 - m, maxX: x1 + m, maxY: y1 + m })
  const obstacles: Rect[] = [
    pres(X(-0.5), Y(-hr / 2), X(0.5), Y(hr / 2), 0.1 * densite),
    ...cellules.map((k) => pres(k.x - k.l / 2, k.y - k.h / 2, k.x + k.l / 2, k.y + k.h / 2, 0.03 * densite)),
    ...elements.map((e) => {
      const d = Math.max(e.l, e.nom === 'colonne' ? e.l * RATIO_COLONNE : e.l) / 2
      return pres(e.x - d, e.y - d, e.x + d, e.y + d, 0.05 * densite)
    }),
  ]
  const details = semeDetails(densite, { x0: X(xL), y0: Y(Math.min(...ys)), x1: X(Math.max(...xs)), y1: Y(Math.max(...ys)) }, silPx, obstacles, tubes)
  // les équipements, le long de chaque bord haut
  const equipements: MiseEnPage['equipements'] = []
  let n = 0
  for (let i = 0; i < contour.length; i++) {
    const [ax, ay] = contour[i]
    const [bx] = contour[(i + 1) % contour.length]
    if (bx <= ax || contour[(i + 1) % contour.length][1] !== ay || bx - ax < 0.9) continue
    const nb = Math.max(1, Math.floor((bx - ax - 0.6) / 1.3))
    for (let j = 0; j < nb; j++) equipements.push({ nom: EQUIPEMENTS[n++ % EQUIPEMENTS.length], x: X(ax + ((j + 0.5) * (bx - ax)) / nb), y: Y(ay) })
  }
  // les colliers : au milieu du bord le plus à gauche, et du plus à droite
  const verticaux = contour.map((q, i) => [q, contour[(i + 1) % contour.length]] as const).filter(([u, w]) => u[0] === w[0])
  const gauche = verticaux.reduce((m, c) => (c[0][0] < m[0][0] ? c : m))
  const droite = verticaux.reduce((m, c) => (c[0][0] > m[0][0] ? c : m))
  const largeur = Math.ceil((bx1 - bx0) * densite)
  const hauteur = Math.ceil((by1 - by0) * densite)
  return {
    largeur,
    hauteur,
    densite,
    monde: { minX: cx + bx0 * R, maxX: cx + bx0 * R + (largeur / densite) * R, maxY: cy - by0 * R, minY: cy - by0 * R - (hauteur / densite) * R },
    silhouette: habille(contour).map((q) => ({ ...q, x: X(q.x), y: Y(q.y) })),
    salle: { minX: X(-0.5), maxX: X(0.5), minY: Y(-hr / 2), maxY: Y(hr / 2) },
    cellules,
    tubes,
    machines: zonesMachines(forme, contour).map(([x0, y0, x1, y1]) => ({ minX: X(x0), minY: Y(y0), maxX: X(x1), maxY: Y(y1) })),
    elements,
    details,
    equipements,
    colliers: {
      gauche: { x: X(gauche[0][0]), y: Y((gauche[0][1] + gauche[1][1]) / 2), h: Math.abs(gauche[1][1] - gauche[0][1]) * densite },
      droite: { x: X(droite[0][0]), y: Y((droite[0][1] + droite[1][1]) / 2), h: Math.abs(droite[1][1] - droite[0][1]) * densite },
    },
  }
}

/** Une mini-carte d'attente, hors d'une run : six rangs, trois voies, chaque
 *  salle ouvrant sur ses voisines. */
export function vueGenerique(): VueModule2d {
  return { rangs: 6, voies: 3, rang: 1, voie: 1, joues: [1], suivants: (_r, v) => [v - 1, v, v + 1].filter((w) => w >= 0 && w < 3) }
}

/** Le centre d'une salle de la mini-carte, DANS LE MONDE, la salle jouée
 *  (coque comprise) posée à sa place — le jumeau de miseEnPage. */
export function centreCellule(salle: Rect, vue: VueModule2d, r: number, v: number): { x: number; y: number } {
  const R = salle.maxX - salle.minX
  const hr = (salle.maxY - salle.minY) / R
  return {
    x: (salle.minX + salle.maxX) / 2 + (r - vue.rang) * PAS_RANG * R,
    // la voie 0 en HAUT : y monde décroît quand la voie croît
    y: (salle.minY + salle.maxY) / 2 - (v - vue.voie) * pasVoie(hr) * R,
  }
}

// LA TRANSITION ENTRE DEUX SALLES (le croquis du concepteur) : la salle
// quittée rétrécit jusqu'à sa cellule, la vue glisse vers la droite, la
// cellule choisie grossit jusqu'à la taille de la salle, puis la salle
// apparaît — le plan d'ouverture habituel prend la suite.
export const TRANSITION = { retrecit: 0.55, glisse: 0.7, grossit: 0.8, revele: 0.35 }
export const DUREE_TRANSITION = TRANSITION.retrecit + TRANSITION.glisse + TRANSITION.grossit + TRANSITION.revele
// le module vu pendant la glissade : la salle y tient 20 % du plan large
// (à 30 %, le module ne se voyait presque pas autour des deux cellules)
const ZOOM_MODULE = 0.2

export interface ParamsTransition {
  /** la cellule de la salle quittée, dans le monde */
  de: { x: number; y: number }
  /** la nouvelle salle, coque comprise */
  salle: Rect
  /** le zoom du plan large sur la nouvelle salle (celui du plan d'ouverture) */
  zoomSalle: number
}

export interface EtatTransition {
  camera: { x: number; y: number; zoom: number }
  /** la cellule qui couvre la nouvelle salle : où, et à quel point elle la cache */
  couvre: Rect
  opacite: number
}

const doux = (t: number) => {
  const u = Math.min(1, Math.max(0, t))
  return u * u * (3 - 2 * u)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixLog = (a: number, b: number, t: number) => Math.exp(mix(Math.log(a), Math.log(b), t))

/** L'état de la transition à l'instant t (secondes depuis son début). */
export function etatTransition(t: number, p: ParamsTransition): EtatTransition {
  const { retrecit, glisse, grossit, revele } = TRANSITION
  const R = p.salle.maxX - p.salle.minX
  const a = { x: (p.salle.minX + p.salle.maxX) / 2, y: (p.salle.minY + p.salle.maxY) / 2 }
  // la cellule quittée remplit d'abord l'écran comme une salle
  const zDepart = p.zoomSalle / CELLULE_L
  const zModule = p.zoomSalle * ZOOM_MODULE
  const cl = CELLULE_L * R
  const cellule = { minX: a.x - cl / 2, maxX: a.x + cl / 2, minY: a.y - cl / 3, maxY: a.y + cl / 3 }
  const t1 = retrecit
  const t2 = t1 + glisse
  const t3 = t2 + grossit
  let camera: EtatTransition['camera']
  let couvre = cellule
  let opacite = 1
  if (t < t1) camera = { ...p.de, zoom: mixLog(zDepart, zModule, doux(t / retrecit)) }
  else if (t < t2) {
    const e = doux((t - t1) / glisse)
    camera = { x: mix(p.de.x, a.x, e), y: mix(p.de.y, a.y, e), zoom: zModule }
  } else if (t < t3) {
    const e = doux((t - t2) / grossit)
    camera = { ...a, zoom: mixLog(zModule, p.zoomSalle, e) }
    couvre = {
      minX: mix(cellule.minX, p.salle.minX, e),
      maxX: mix(cellule.maxX, p.salle.maxX, e),
      minY: mix(cellule.minY, p.salle.minY, e),
      maxY: mix(cellule.maxY, p.salle.maxY, e),
    }
  } else {
    camera = { ...a, zoom: p.zoomSalle }
    couvre = p.salle
    opacite = 1 - doux((t - t3) / revele)
  }
  return { camera, couvre, opacite }
}

/** Où se trouve une salle chargée : son module, son rang dans le module. */
export interface PositionSalle {
  module: string
  niveau: number
}

/** LA TRANSITION NE JOUE que vers la salle SUIVANTE du même module : pas à un
 *  nouvel essai (même rang), ni à l'entrée d'un module, ni après une halte
 *  (deux rangs d'un coup). Les deux positions sont celles des salles AU
 *  CHARGEMENT — le jeu compte la salle franchie dès le sas, avant la
 *  cérémonie : une position relevée pendant la cérémonie avait déjà avancé,
 *  et la transition ne jouait jamais (aperçu du 02/10). */
export function transitionPermise(avant: PositionSalle | null, apres: PositionSalle): boolean {
  return avant !== null && avant.module === apres.module && apres.niveau === avant.niveau + 1
}

// LA TOILE PROCHE : autour de la salle, une seconde toile plus fine — la
// toile entière, à 360 px par largeur de salle, était floue dès qu'on
// zoomait près de la salle (aperçu du 02/10). 850 px : la finesse des
// pièces livrées (80 % des sources) ; 0,9 salle de marge tout autour.
export const DENSITE_PROCHE = 850
export const MARGE_PROCHE = 0.9

/** La fenêtre de la toile proche : ce qu'elle couvre (pixels de la toile
 *  de base), son grossissement, et où elle tombe dans le monde. */
export function fenetreProche(mp: MiseEnPage): { x: number; y: number; l: number; h: number; k: number; monde: Rect } {
  const m = MARGE_PROCHE * mp.densite
  const x0 = Math.max(0, mp.salle.minX - m)
  const y0 = Math.max(0, mp.salle.minY - m)
  const x1 = Math.min(mp.largeur, mp.salle.maxX + m)
  const y1 = Math.min(mp.hauteur, mp.salle.maxY + m)
  const l = x1 - x0
  const h = y1 - y0
  // jamais plus de TOILE_MAX de côté : une salle très allongée se contente de moins
  const k = Math.min(DENSITE_PROCHE / mp.densite, TOILE_MAX / l, TOILE_MAX / h)
  const ux = (mp.monde.maxX - mp.monde.minX) / mp.largeur
  const uy = (mp.monde.maxY - mp.monde.minY) / mp.hauteur
  return {
    x: x0,
    y: y0,
    l,
    h,
    k,
    monde: { minX: mp.monde.minX + x0 * ux, maxX: mp.monde.minX + x1 * ux, maxY: mp.monde.maxY - y0 * uy, minY: mp.monde.maxY - y1 * uy },
  }
}
