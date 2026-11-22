// L'ONDE D'UNE CARTE — la nappe d'eau qui tremble sous le pointeur.
//
// « Effet sur les cartes de récompenses qui bouge : bonne idée mais très mal
// exécuté, ça fait buggé, pas fluide, pas beau… quelque chose avec du
// liquide, que la carte ondule comme un volume d'eau » (le concepteur,
// 22/11). La carte s'inclinait d'un coup à chaque pointermove et se remettait
// à plat d'un seul : il lui fallait un CORPS qui a de l'inertie.
//
// Ici, rien que la physique, sans DOM ni horloge (mêmes entrées, mêmes
// sorties, comme le feu de ceremonieFx.ts) :
//   — une NAPPE : un champ de hauteurs sur une grille grossière (une maille
//     de quelques pixels), qui suit l'équation d'onde discrète à deux
//     tampons, amortie — le doigt y laisse un sillage, une goutte y pose un
//     anneau qui file, rebondit sur les bords de la carte et s'éteint ;
//   — son OMBRAGE : la pente de la nappe éclaire ou assombrit chaque maille,
//     au bleu du spécimen, dans une encre PLAFONNÉE — la nappe passe sous le
//     texte de la carte, elle ne doit jamais le noyer ;
//   — un RESSORT amorti, pour ce qui porte la carte (inclinaison, flottaison,
//     gonflement) : il rejoint sa cible sans sauter, la dépasse un peu et se
//     pose, comme un objet qui flotte.
// La toile, l'écoute du pointeur et la boucle d'images sont dans ondeVue.ts.

/** L'amortissement par pas d'onde. La boucle fait SOUS_PAS pas d'onde par
 *  image (ondeVue.ts) : à 60 images par seconde, une goutte franche
 *  tremble encore à une demi-seconde et se tait avant deux (onde.spec.ts). */
export const AMORTI = 0.975

/** L'amortissement d'une carte QUITTÉE : elle se calme en deux fois moins
 *  de temps que celle qu'on regarde — l'œil est déjà sur la voisine, et
 *  deux nappes qui tremblent ensemble coûtent deux fois. */
export const AMORTI_QUITTE = 0.95

/** Les pas d'onde par pas d'image : l'onde discrète avance d'environ une
 *  maille par pas ; à trois, la vague traverse une carte de 330 px en une
 *  demi-seconde au lieu de s'y traîner. */
export const SOUS_PAS = 3

/** La nappe se tait sous ce seuil (la plus haute crête, en unités de
 *  hauteur) : on cesse alors de la simuler et de la peindre. */
export const SEUIL_CALME = 0.004

/** L'encre la plus forte que la nappe pose sur la carte (alpha, 0-1). Le
 *  texte de la carte passe AU-DESSUS : à ce plafond, le bleu le plus clair
 *  reste sombre sous l'encre du texte (onde.spec.ts, « lisible »). */
export const ENCRE_MAX = 0.3

/** SOUS UNE LIGNE DE TEXTE, l'éclat ne garde que cette part de son encre.
 *  À plein plafond, le reflet le plus pâle passant sous une légende des
 *  leviers (l'encre --dim) la laissait à 2,3:1 le temps d'une crête ; à
 *  20 %, elle garde 4,8:1 (onde.spec.ts) — et l'eau reste vive dans les
 *  marges et autour de l'icône. L'ombre, elle, n'est pas retenue : elle
 *  assombrit le fond, le texte clair n'en ressort que mieux. */
export const SOUS_TEXTE = 0.2

export class Nappe {
  readonly w: number
  readonly h: number
  /** la hauteur à l'instant, et celle du pas d'avant (l'onde a deux temps) */
  private a: Float32Array
  private b: Float32Array
  /** maille par maille, la part d'éclat permise (1 : toute ; SOUS_TEXTE
   *  sous une ligne de texte) — posé par ondeVue.ts d'après la carte */
  masque: Float32Array | null = null

  constructor(w: number, h: number) {
    this.w = Math.max(3, Math.floor(w))
    this.h = Math.max(3, Math.floor(h))
    this.a = new Float32Array(this.w * this.h)
    this.b = new Float32Array(this.w * this.h)
  }

  hauteur(x: number, y: number): number {
    const xi = Math.max(0, Math.min(this.w - 1, Math.round(x)))
    const yi = Math.max(0, Math.min(this.h - 1, Math.round(y)))
    return this.a[yi * this.w + xi]
  }

  /** UNE GOUTTE (force > 0 : une bosse ; < 0 : un creux, le doigt qui
   *  appuie), en coordonnées de maille. Le profil est en cosinus : un
   *  bord franc ferait naître un damier de hautes fréquences, la nappe
   *  « grésillait » au lieu d'onduler. */
  goutte(x: number, y: number, rayon: number, force: number): void {
    const r = Math.max(1, rayon)
    const x0 = Math.max(1, Math.floor(x - r))
    const x1 = Math.min(this.w - 2, Math.ceil(x + r))
    const y0 = Math.max(1, Math.floor(y - r))
    const y1 = Math.min(this.h - 2, Math.ceil(y + r))
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const d = Math.hypot(i - x, j - y) / r
        if (d >= 1) continue
        const v = force * 0.5 * (1 + Math.cos(Math.PI * d))
        this.a[j * this.w + i] += v
        this.b[j * this.w + i] += v * 0.5 // la goutte naît en mouvement
      }
    }
  }

  /** LA NAPPE PENCHE : la carte qui s'incline (ou se redresse) chasse l'eau
   *  vers un bord — un plan ajouté d'un coup, que l'onde fait refluer. */
  penche(px: number, py: number): void {
    const cx = (this.w - 1) / 2
    const cy = (this.h - 1) / 2
    for (let j = 1; j < this.h - 1; j++) {
      for (let i = 1; i < this.w - 1; i++) {
        this.a[j * this.w + i] += px * (i - cx) / cx + py * (j - cy) / cy
      }
    }
  }

  /** UN PAS d'onde. Les bords réfléchissent (la carte est une cuve : la
   *  vague revient vers le doigt au lieu de fuir) ; la crête la plus haute
   *  est rendue, pour savoir quand la nappe s'est tue. */
  pas(amorti = AMORTI): number {
    const { w, h } = this
    const a = this.a
    const b = this.b
    let crete = 0
    for (let j = 1; j < h - 1; j++) {
      const l = j * w
      for (let i = 1; i < w - 1; i++) {
        const k = l + i
        const n = ((a[k - 1] + a[k + 1] + a[k - w] + a[k + w]) * 0.5 - b[k]) * amorti
        b[k] = n
        const m = n < 0 ? -n : n
        if (m > crete) crete = m
      }
    }
    // les bords recopient leur voisin : un bord réfléchissant (Neumann)
    for (let i = 0; i < w; i++) {
      b[i] = b[i + w]
      b[(h - 1) * w + i] = b[(h - 2) * w + i]
    }
    for (let j = 0; j < h; j++) {
      b[j * w] = b[j * w + 1]
      b[j * w + w - 1] = b[j * w + w - 2]
    }
    this.a = b
    this.b = a
    return crete
  }

  /** La nappe à plat, d'un coup (la carte élue, le tirage refermé). */
  aplanit(): void {
    this.a.fill(0)
    this.b.fill(0)
  }

  /** L'OMBRAGE, maille par maille, dans `rgba` (w × h × 4, non
   *  prémultiplié, le format d'ImageData). Une lumière vient du haut à
   *  gauche, comme l'éclairage du jeu : la pente qui lui fait face prend le
   *  bleu du spécimen, et sa pointe un reflet pâle ; la pente opposée
   *  s'assombrit. L'encre ne dépasse jamais `ENCRE_MAX`. */
  ombre(rgba: Uint8ClampedArray, gain = 16): void {
    const { w, h } = this
    const a = this.a
    for (let j = 0; j < h; j++) {
      const jh = j > 0 ? j - 1 : j
      const jb = j < h - 1 ? j + 1 : j
      for (let i = 0; i < w; i++) {
        const ig = i > 0 ? i - 1 : i
        const id = i < w - 1 ? i + 1 : i
        // la pente : ce qui monte vers la droite et vers le bas
        const gx = a[j * w + id] - a[j * w + ig]
        const gy = a[jb * w + i] - a[jh * w + i]
        // la lumière vient d'en haut à gauche : une pente qui descend vers
        // elle (gx, gy < 0) la regarde
        const l = -(gx * 0.62 + gy * 0.78) * gain
        const o = (j * w + i) * 4
        if (l > 0) {
          // l'éclat : le bleu du spécimen, et sa pointe qui pâlit. La
          // lumière SATURE en douceur (l / (1 + l)) : écrêtée net, une goutte
          // fraîche faisait un aplat à bords en escalier, le temps de deux
          // images (vu au banc, 22/11). Une division, pas une exponentielle :
          // c'est l'opération de chaque maille, à chaque image
          const t = l / (1 + l)
          const reflet = t * t
          rgba[o] = 99 + (217 - 99) * reflet
          rgba[o + 1] = 183 + (236 - 183) * reflet
          rgba[o + 2] = 230 + (247 - 230) * reflet
          rgba[o + 3] = 255 * ENCRE_MAX * t * (this.masque ? this.masque[j * w + i] : 1)
        } else {
          // le creux : l'eau profonde, vers le noir de la coque
          const t = -l / (1 - l)
          rgba[o] = 2
          rgba[o + 1] = 8
          rgba[o + 2] = 16
          rgba[o + 3] = 255 * ENCRE_MAX * 0.9 * t
        }
      }
    }
  }
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
