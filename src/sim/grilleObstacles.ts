// La grille des parois : chaque particule ne regarde que les parois de sa
// case, au lieu de toutes les parois de la salle.
//
// POURQUOI. Les deux boucles de décor du solveur (la poussée hors des
// parois, les bandes chimiques) testaient CHAQUE particule contre CHAQUE
// paroi, à chaque pas. Dans une salle générée de 10 à 20 parois, presque
// aucune de ces paires n'est proche (≈ 0 % mesuré le 07/11/2026) : le
// filtre `horsBoite` les rejetait toutes, mais ce rejet coûtait à lui seul
// 30 à 40 % du pas — 1,2 ms sur 3,5 ms dans « Le carrefour 5 ». C'est le
// piège du « tout contre tout » que la grille spatiale des particules
// (grid.ts) évite depuis le début ; les parois y échappaient encore.
//
// LE CONTRAT : une liste de candidats CONSERVATRICE et DANS L'ORDRE. Une
// paroi absente de la case d'un point est une paroi que `horsBoite(b, x, y,
// m)` rejetterait pour toute marge m ≤ la marge de construction ; les
// candidats gardent l'ordre des indices. Le solveur obtient donc
// exactement les mêmes trajectoires, au bit près (grilleObstacles.spec.ts).

/** Ce que la grille lit d'une paroi : la boîte, et l'angle qui la fait
 *  tourner — exactement ce que lit `horsBoite`. */
export interface BoiteBornee {
  minX: number
  minY: number
  maxX: number
  maxY: number
  angle?: number
}

// Rejet rapide d'une boîte : hors de portée « marge » ? Pour une boîte
// OBLIQUE ou une FORME (toujours inscrite dans sa boîte englobante), on
// rejette sur le cercle englobant — conservateur mais sûr. La grille des
// parois s'inscrit dans cette même enveloppe : les deux vivent ici ensemble.
export function horsBoite(
  b: BoiteBornee,
  x: number,
  y: number,
  marge: number,
): boolean {
  if (b.angle) {
    const r = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + marge
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    return Math.abs(x - cx) > r || Math.abs(y - cy) > r
  }
  return (
    x < b.minX - marge ||
    x > b.maxX + marge ||
    y < b.minY - marge ||
    y > b.maxY + marge
  )
}

/** Côté de case visé (unités monde). Une particule mesure 6,6 : à 48, une
 *  case porte une poignée de parois au plus, et une paroi de 1000 de long
 *  ne s'inscrit que dans une vingtaine de cases par rangée. */
const CASE_VISEE = 48
/** Plafond du nombre de cases : les tableaux FIGURE sont des champs
 *  immenses — au-delà, la case s'élargit plutôt que la mémoire n'enfle. */
const CASES_MAX = 1 << 16
/** Le jeu ajouté à la marge (unités monde). `horsBoite` calcule son
 *  enveloppe dans un autre ordre d'opérations (cx − (r + m) ici, (cx − r)
 *  − m là) : à un arrondi près, un point posé PILE sur le bord pourrait
 *  être retenu par l'un et pas par l'autre. Une unité de plus rend la liste
 *  franchement conservatrice — quelques candidats en trop, jamais un de
 *  moins. */
const JEU = 1

export class GrilleObstacles {
  minX = 0
  minY = 0
  cote = CASE_VISEE
  nx = 1
  ny = 1
  /** Début de la liste de chaque case dans `liste` (taille cases + 1). */
  debut = new Int32Array(2)
  /** Indices de parois, case par case, croissants dans chaque case. */
  liste = new Int32Array(0)

  // Ce sur quoi la grille a été construite : la recharger quand l'un change.
  private source: readonly BoiteBornee[] | null = null
  private longueur = -1
  private marge = -1

  /** La grille est-elle encore celle de ces parois, à cette marge ? La
   *  liste peut être remplacée (portes, setLevel) ou complétée sur place
   *  (les bancs d'essai poussent une paroi dans `sim.boxes`) : l'identité
   *  ET la longueur le disent. */
  aJour(boites: readonly BoiteBornee[], marge: number): boolean {
    return (
      this.source === boites &&
      this.longueur === boites.length &&
      this.marge === marge
    )
  }

  /** Inscrit chaque paroi dans toutes les cases que touche sa boîte
   *  élargie de `marge`. Une paroi tournée s'inscrit par le carré de son
   *  cercle circonscrit — la même enveloppe que `horsBoite`. */
  construit(
    boites: readonly BoiteBornee[],
    bornes: BoiteBornee,
    marge: number,
  ): void {
    const largeur = Math.max(1, bornes.maxX - bornes.minX)
    const hauteur = Math.max(1, bornes.maxY - bornes.minY)
    let cote = CASE_VISEE
    if ((largeur / cote) * (hauteur / cote) > CASES_MAX)
      cote = Math.sqrt((largeur * hauteur) / CASES_MAX)
    const nx = Math.max(1, Math.ceil(largeur / cote))
    const ny = Math.max(1, Math.ceil(hauteur / cote))
    this.minX = bornes.minX
    this.minY = bornes.minY
    this.cote = cote
    this.nx = nx
    this.ny = ny

    // Deux passes, comme le tri par comptage de grid.ts : compter, puis
    // ranger — pas de tableau de tableaux, et l'ordre des indices suit
    // l'ordre de la boucle, donc croissant dans chaque case.
    const m = marge + JEU
    const nCases = nx * ny
    const debut = new Int32Array(nCases + 1)
    for (let passe = 0; passe < 2; passe++) {
      const curseur = passe === 1 ? debut.slice(0, nCases) : null
      for (let bi = 0; bi < boites.length; bi++) {
        const b = boites[bi]
        let x0 = b.minX
        let x1 = b.maxX
        let y0 = b.minY
        let y1 = b.maxY
        if (b.angle) {
          const r = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2
          const cx = (b.minX + b.maxX) / 2
          const cy = (b.minY + b.maxY) / 2
          x0 = cx - r
          x1 = cx + r
          y0 = cy - r
          y1 = cy + r
        }
        const cx0 = this.colonne(x0 - m)
        const cx1 = this.colonne(x1 + m)
        const cy0 = this.rangee(y0 - m)
        const cy1 = this.rangee(y1 + m)
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const c = cy * nx + cx
            if (curseur) this.liste[curseur[c]++] = bi
            else debut[c + 1]++
          }
        }
      }
      if (passe === 0) {
        for (let c = 0; c < nCases; c++) debut[c + 1] += debut[c]
        this.liste = new Int32Array(debut[nCases])
      }
    }
    this.debut = debut
    this.source = boites
    this.longueur = boites.length
    this.marge = marge
  }

  /** La case d'un point. Hors des bornes, le point retombe sur la case du
   *  bord — et une paroi qui déborde des bornes s'inscrit, elle aussi, dans
   *  les cases du bord : la liste reste conservatrice des deux côtés. */
  caseDe(x: number, y: number): number {
    return this.rangee(y) * this.nx + this.colonne(x)
  }

  private colonne(x: number): number {
    const c = Math.floor((x - this.minX) / this.cote)
    return c < 0 ? 0 : c >= this.nx ? this.nx - 1 : c
  }

  private rangee(y: number): number {
    const c = Math.floor((y - this.minY) / this.cote)
    return c < 0 ? 0 : c >= this.ny ? this.ny - 1 : c
  }
}
