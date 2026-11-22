// LA RIVE D'UNE CARTE — le contour qui ondule comme un filet d'eau.
//
// « Effet sur les cartes de récompenses qui bouge : bonne idée mais très mal
// exécuté, ça fait buggé, pas fluide… quelque chose avec du liquide »
// (le concepteur, 22/11). Une première version mettait l'eau AU CŒUR de la
// carte, sous le texte ; ce n'était pas l'idée : « pas du volume d'eau dans
// le cœur de la carte, plutôt sur les bordures — les quatre traits qui
// délimitent une carte… que ce contour rappelle l'eau quand on a le focus,
// avec pourquoi pas un peu d'effet 3D » (le même, 22/11).
//
// Ici, rien que la physique, sans DOM ni horloge (mêmes entrées, mêmes
// sorties, comme le feu de ceremonieFx.ts) :
//   — le CONTOUR de la carte, coin coupé compris, échantillonné en nœuds,
//     chacun avec sa normale sortante ;
//   — la RIVE : un déplacement le long de cette normale, nœud par nœud,
//     qui suit l'équation d'onde à une dimension sur la boucle fermée — une
//     goutte posée sur un bord part dans les deux sens, fait le tour de la
//     carte, les deux fronts se croisent et s'éteignent ;
//   — la HOULE : une ondulation lente qui court le long du contour tant que
//     la carte a le focus, pour qu'un contour au repos reste de l'eau ;
//   — un RESSORT amorti, pour ce qui porte la carte (inclinaison,
//     flottaison, gonflement) et pour la présence de l'eau elle-même.
// Le dessin, l'écoute du pointeur et la boucle d'images sont dans ondeVue.ts.

/** L'amortissement par pas d'onde. La boucle fait SOUS_PAS pas par image
 *  (ondeVue.ts). Mesuré sur une goutte posée au milieu du bord haut : trop
 *  amortie, elle perdait 99 % de sa hauteur avant d'arriver en face — le
 *  tour de la carte, qui est tout l'effet, ne se voyait pas ; pas assez,
 *  elle traînait plus de deux secondes. À 0,985, ses deux fronts se
 *  croisent en bas encore visibles (0,6 px) et elle ne se voit plus après
 *  1,5 s (onde.spec.ts). */
export const AMORTI = 0.985

/** L'amortissement d'une carte QUITTÉE : sa rive se calme vite — l'œil est
 *  déjà sur la voisine. */
export const AMORTI_QUITTE = 0.965

/** Un nœud de rive tous les PAS_RIVE px de contour. À 4 px (et six pas
 *  d'onde par image pour garder la vitesse), le contour coûtait au banc,
 *  processeur bridé ×6, le double de l'ancien effet ; les vagues font
 *  toutes plus de 50 px de long, une maille de 8 px ne se voit pas. */
export const PAS_RIVE = 8

/** Les pas d'onde par pas d'image. L'onde avance d'environ 0,7 nœud par
 *  pas : à trois pas de 8 px, un front fait le tour d'une carte de
 *  360 × 390 px (≈ 1 500 px de contour) en une seconde et demie. */
export const SOUS_PAS = 3

/** La goutte d'entrée et le sillage du pointeur : leur demi-largeur, en px
 *  de contour (une goutte étroite faisait un pli anguleux, pas une vague). */
export const GOUTTE_PX = 48
export const SILLAGE_PX = 32

/** La rive se tait sous ce seuil (le plus grand déplacement, en px). */
export const SEUIL_CALME = 0.04

/** Le plus grand écart que la rive s'autorise, en px de part et d'autre du
 *  contour : au-delà, le filet ne lit plus comme le bord de la carte. */
export const ECART_MAX = 5

/** La part de lissage par pas (voir Rive.pas) : à 0,08, une vaguelette
 *  d'un nœud s'éteint en quelques pas, une vague de 40 nœuds n'y perd
 *  presque rien. */
export const VISCOSITE = 0.08

export interface Noeud {
  /** la position au repos, en px de carte */
  x: number
  y: number
  /** la normale sortante */
  nx: number
  ny: number
  /** l'abscisse le long du contour, en px, depuis le coin haut gauche */
  s: number
}

/**
 * LE CONTOUR d'une carte du tirage, `l` × `h` px, coin haut droit coupé de
 * `chanfrein` (le coin du verbe de l'accueil, index.html) : un nœud tous les
 * `pas` px environ, dans le sens des aiguilles d'une montre, depuis le coin
 * haut gauche. Les nœuds d'angle prennent la normale moyenne de leurs deux
 * côtés : la rive tourne le coin au lieu de s'y casser.
 */
export function contourCarte(l: number, h: number, chanfrein: number, pas = PAS_RIVE): Noeud[] {
  const c = Math.max(0, Math.min(chanfrein, l / 2, h / 2))
  const coins: [number, number][] = [
    [0, 0],
    [l - c, 0],
    [l, c],
    [l, h],
    [0, h],
  ]
  // un coin sans chanfrein se confond avec son voisin : on ne le garde qu'une fois
  const sommets = coins.filter((p, i) => {
    const q = coins[(i + coins.length - 1) % coins.length]
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6
  })
  const out: Noeud[] = []
  let s = 0
  for (let i = 0; i < sommets.length; i++) {
    const [ax, ay] = sommets[i]
    const [bx, by] = sommets[(i + 1) % sommets.length]
    const long = Math.hypot(bx - ax, by - ay)
    const n = Math.max(1, Math.round(long / pas))
    // le sens horaire (y vers le bas) : la normale sortante est (dy, −dx)
    const nx = (by - ay) / long
    const ny = -(bx - ax) / long
    for (let k = 0; k < n; k++) {
      const t = k / n
      out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx, ny, s: s + long * t })
    }
    s += long
  }
  // les angles : la normale moyenne de leurs deux côtés — lue sur les
  // normales d'ORIGINE : moyennées en place, l'angle déteignait sur le nœud
  // suivant, qui se croyait angle à son tour
  const brut = out.slice()
  for (let i = 0; i < out.length; i++) {
    const p = brut[i]
    const q = brut[(i + brut.length - 1) % brut.length]
    if (p.nx === q.nx && p.ny === q.ny) continue
    const mx = p.nx + q.nx
    const my = p.ny + q.ny
    const m = Math.hypot(mx, my) || 1
    out[i] = { ...p, nx: mx / m, ny: my / m }
  }
  return out
}

/** La longueur d'un contour (la dernière abscisse, plus le côté qui ferme). */
export function longueurContour(noeuds: readonly Noeud[]): number {
  const a = noeuds[noeuds.length - 1]
  const b = noeuds[0]
  return a.s + Math.hypot(b.x - a.x, b.y - a.y)
}

export class Rive {
  readonly n: number
  /** le déplacement à l'instant, et au pas d'avant (l'onde a deux temps) */
  private a: Float32Array
  private b: Float32Array
  /** le tampon de travail du lissage */
  private t: Float32Array

  constructor(n: number) {
    this.n = Math.max(3, Math.floor(n))
    this.a = new Float32Array(this.n)
    this.b = new Float32Array(this.n)
    this.t = new Float32Array(this.n)
  }

  ecart(i: number): number {
    return this.a[((i % this.n) + this.n) % this.n]
  }

  /** UNE GOUTTE sur la rive, centrée sur le nœud `i` (force > 0 : le filet
   *  bombe vers l'extérieur ; < 0 : il se creuse). Profil en cosinus : un
   *  bord franc ferait grésiller la rive au lieu de l'onduler. */
  goutte(i: number, rayon: number, force: number): void {
    const r = Math.max(1, rayon)
    for (let k = -Math.ceil(r); k <= Math.ceil(r); k++) {
      const d = Math.abs(k) / r
      if (d >= 1) continue
      const j = (((i + k) % this.n) + this.n) % this.n
      const v = force * 0.5 * (1 + Math.cos(Math.PI * d))
      this.a[j] += v
      this.b[j] += v * 0.5 // la goutte naît en mouvement
    }
  }

  /** LA CARTE PENCHE : l'eau du contour s'amasse vers le bord qui descend
   *  — chaque nœud reçoit la pente selon sa place sur la carte (`u`, `v` de
   *  −1 à 1) ; l'onde la fait refluer. */
  penche(noeuds: readonly Noeud[], l: number, h: number, px: number, py: number): void {
    for (let i = 0; i < this.n && i < noeuds.length; i++) {
      const u = (noeuds[i].x / l) * 2 - 1
      const v = (noeuds[i].y / h) * 2 - 1
      this.a[i] += px * u + py * v
    }
  }

  /** UN PAS d'onde sur la boucle fermée ; rend le plus grand écart, pour
   *  savoir quand la rive s'est tue. */
  pas(amorti = AMORTI): number {
    const { n, a, b } = this
    let crete = 0
    for (let i = 0; i < n; i++) {
      const g = a[i === 0 ? n - 1 : i - 1]
      const d = a[i === n - 1 ? 0 : i + 1]
      // c² = 0,5 : stable (le pas de temps reste sous la limite de Courant)
      let v = (2 * a[i] - b[i] + 0.5 * (g - 2 * a[i] + d)) * amorti
      if (v > ECART_MAX) v = ECART_MAX
      else if (v < -ECART_MAX) v = -ECART_MAX
      b[i] = v
      const m = v < 0 ? -v : v
      if (m > crete) crete = m
    }
    // LA VISCOSITÉ : un lissage léger, nœud par nœud. L'onde discrète
    // traîne derrière chaque front un chapelet de vaguelettes d'un nœud ou
    // deux — au banc, la rive se lisait comme un trait tremblé à la main,
    // pas comme de l'eau. Le lissage les éteint sans toucher aux longues
    // (dans un tampon à part : `a`, l'instant d'avant, sert au pas suivant)
    const t = this.t
    for (let i = 0; i < n; i++) {
      const g = b[i === 0 ? n - 1 : i - 1]
      const d = b[i === n - 1 ? 0 : i + 1]
      t[i] = b[i] + VISCOSITE * (g - 2 * b[i] + d)
    }
    b.set(t)
    this.a = b
    this.b = a
    return crete
  }

  /** La rive à plat, d'un coup (la carte élue, le tirage refermé). */
  aplanit(): void {
    this.a.fill(0)
    this.b.fill(0)
  }
}

/**
 * LA HOULE : l'ondulation lente d'un contour qui a le focus, en px, à
 * l'abscisse `s` d'un contour long de `longueur`, au temps `t` (s). Deux
 * trains de vagues qui courent en sens contraires, chacun d'un nombre
 * ENTIER de longueurs d'onde sur le tour — sinon la houle casserait au coin
 * haut gauche, là où la boucle se referme.
 */
export function houle(s: number, longueur: number, t: number): number {
  const L = Math.max(1, longueur)
  // des vagues LONGUES et lentes : à 170 px et 110 px, la houle faisait
  // des plis serrés, un fil qui tremble plutôt qu'une eau qui respire
  const k1 = (2 * Math.PI * Math.max(1, Math.round(L / 300))) / L
  const k2 = (2 * Math.PI * Math.max(1, Math.round(L / 190))) / L
  return 0.75 * Math.sin(k1 * s - 1.6 * t) + 0.35 * Math.sin(k2 * s + 2.3 * t + 1.3)
}

/** UN RESSORT amorti : une valeur qui rejoint sa cible avec de l'inertie.
 *  `raideur` règle la vitesse, `amorti` le rebond (sous 2·√raideur, la
 *  valeur dépasse un peu sa cible avant de se poser — le flottement). */
export class Ressort {
  valeur: number
  vitesse = 0
  cible: number

  constructor(
    initiale = 0,
    readonly raideur = 170,
    readonly amorti = 15,
  ) {
    this.valeur = initiale
    this.cible = initiale
  }

  /** Avance de `dt` secondes (semi-implicite : stable au pas d'une image,
   *  même à 30 images par seconde). */
  pas(dt: number): void {
    const f = (this.cible - this.valeur) * this.raideur - this.vitesse * this.amorti
    this.vitesse += f * dt
    this.valeur += this.vitesse * dt
  }

  /** Posé : à sa cible, et à l'arrêt. */
  pose(eps = 0.002): boolean {
    return Math.abs(this.cible - this.valeur) < eps && Math.abs(this.vitesse) < eps * 10
  }

  /** Sur sa cible, sans élan (un état qui ne doit plus bouger). */
  fige(): void {
    this.valeur = this.cible
    this.vitesse = 0
  }
}
