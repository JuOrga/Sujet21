// LA GRILLE DE REPÉRAGE DES BOÎTES — ce que chaque pixel a besoin de
// regarder, et rien d'autre.
//
// POURQUOI. Le rapport de performance du 14/09/2026 (iPad Pro M1, salle
// démineur, résolution faible) : 14 images par seconde, 56 ms par image
// HORS processeur, contre 22 ms sur une salle ordinaire à la même
// résolution. La différence, c'est le tableau : 112 boîtes, le plafond du
// budget. Le shader de composition parcourait TOUTES les boîtes pour CHAQUE
// pixel, trois fois (la salle des coques, la couverture, puis le corps de
// chaque boîte) : 1,26 mégapixel × 112 boîtes × 3, dont l'immense majorité
// pour des boîtes à l'autre bout du tableau. Le coût est proportionnel aux
// pixels multipliés par les boîtes, et démineur maximise le second facteur.
//
// CE QUE FAIT LA GRILLE. Le tableau est découpé en cases (128 au plus), et
// pour chaque case on dresse D'AVANCE la liste des boîtes qui peuvent
// teinter un pixel de cette case. Un pixel ne regarde plus que les boîtes
// de sa case — typiquement 2 à 6 au lieu de 112. Le résultat est le même au
// pixel près, à une condition : LA MARGE. Une boîte teinte au-delà de son
// contour (ombre portée jusqu'à 56 u, aura selon le matériau, biseau, le
// décalage du relief) ; chaque boîte entre donc dans la liste de toutes les
// cases que son rectangle GONFLÉ de la marge touche. La marge se calcule
// depuis les mêmes valeurs que le shader (margeInfluence), et un test
// (grilleBoites.spec.ts) lit la source du shader pour vérifier qu'aucune
// portée fixe n'y dépasse ce que la grille prévoit.
//
// LES BOÎTES « PARTOUT ». Le sas, le vide et la baie ne sont pas des
// solides : le shader ne leur applique aucun court-circuit de distance (le
// sas aspire de loin, les ouvertures montrent le dehors). Elles vont dans
// toutes les cases — elles sont rares, et ça garantit l'exactitude sans
// avoir à raisonner sur leur portée.
//
// LA FORME. Une case = un ivec4 = seize octets : l'octet 0 est le NOMBRE
// d'entrées (255 : « toutes les boîtes », le repli quand la case déborde),
// les quinze suivants sont des indices de boîtes, dans l'ordre du tableau —
// l'ordre compte : la dernière boîte est dessus, et la couverture s'écrase
// sur un « strictement plus petit ». Le shader lit les octets par décalage.
// Pas de texture : le shader de composition occupe déjà les seize unités
// garanties par WebGL2, et les uniformes sont la place qui reste.

/** La marge de portée FIXE du shader (unités monde) : l'ombre portée (56 u)
 *  et la portée du rideau lamellaire et du miroir (60 u). Toute autre
 *  portée fixe du shader doit rester sous cette valeur — le test le garde. */
export const PORTEE_FIXE = 60
/** Les portées qui s'écrivent « N / uZoom » dans le shader (liseré 2,5,
 *  ligne de paroi 3, fondu de la salle 6) : la plus grande, en pixels. */
export const PORTEE_PAR_ZOOM = 6

export const GRILLE_CASES = 128
export const GRILLE_K = 15 // entrées par case, après l'octet du compte
export const GRILLE_TOUT = 255 // la case a débordé : toutes les boîtes

export interface BoiteGrille {
  minX: number
  minY: number
  maxX: number
  maxY: number
  /** rotation en degrés autour du centre (absente : boîte droite) */
  angle?: number
  /** dans toutes les cases, quelle que soit la distance (sas, vide, baie) */
  partout?: boolean
}

export interface Grille {
  nx: number
  ny: number
  minX: number
  minY: number
  /** l'inverse de la taille d'une case, par axe */
  invX: number
  invY: number
  /** nombre de cases qui ont débordé (leur liste dit « toutes ») */
  debordements: number
  /** la plus longue liste, hors débordements */
  maxEntrees: number
}

/**
 * La marge d'influence d'une boîte, en unités monde, pour l'image qui vient :
 * au-delà, le shader ne la laisse plus teinter le pixel. Les mêmes termes
 * que son court-circuit (reachMax + edgeW + |relDisp|) et que ses fondus de
 * salle (6 / uZoom), pris au pire.
 */
export function margeInfluence(p: {
  hydroBand: number
  coldBand: number
  heatBand: number
  auraMax: number
  zoom: number
  relief: number
  viewportW: number
  viewportH: number
}): number {
  const zoom = Math.max(p.zoom, 1e-4)
  const portee = Math.max(
    PORTEE_FIXE,
    p.hydroBand,
    p.coldBand,
    p.heatBand * Math.max(p.auraMax, 0),
  )
  // relDisp = (world − centre) × relief × clamp(zoom × 1,2, 0, 1) : au plus
  // la demi-diagonale de l'écran, en unités monde
  const demiDiag = 0.5 * Math.hypot(p.viewportW, p.viewportH) / zoom
  const reliefMax =
    p.relief > 0 ? p.relief * Math.min(1, Math.max(0, zoom * 1.2)) * demiDiag : 0
  return portee + PORTEE_PAR_ZOOM / zoom + reliefMax
}

/** Le rectangle englobant, dans le monde, d'une boîte éventuellement pivotée. */
export function englobant(b: BoiteGrille): [number, number, number, number] {
  const a = b.angle ?? 0
  if (Math.abs(a) < 1e-6) return [b.minX, b.minY, b.maxX, b.maxY]
  const cx = (b.minX + b.maxX) * 0.5
  const cy = (b.minY + b.maxY) * 0.5
  const hx = (b.maxX - b.minX) * 0.5
  const hy = (b.maxY - b.minY) * 0.5
  const r = (a * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const ex = hx * c + hy * s
  const ey = hx * s + hy * c
  return [cx - ex, cy - ey, cx + ex, cy + ey]
}

/**
 * Construit la grille pour les `count` premières boîtes et l'écrit dans
 * `sortie` (GRILLE_CASES × 4 entiers, un ivec4 par case, ligne par ligne).
 * Renvoie sa géométrie — ce que le shader reçoit en uniformes.
 */
export function construitGrille(
  boites: readonly BoiteGrille[],
  count: number,
  marge: number,
  sortie: Int32Array,
): Grille {
  const n = Math.min(count, boites.length)
  // un cran de jeu : le shader calcule la case en float32, ici en double —
  // au bord exact d'une case, les deux peuvent différer d'un pixel, et la
  // marge a déjà de la réserve (60 u pour une ombre de 56)
  marge += 1
  // l'emprise : l'union des rectangles gonflés
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const rects: [number, number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const e = englobant(boites[i])
    rects.push(e)
    if (boites[i].partout) continue
    if (e[0] < minX) minX = e[0]
    if (e[1] < minY) minY = e[1]
    if (e[2] > maxX) maxX = e[2]
    if (e[3] > maxY) maxY = e[3]
  }
  if (!(minX < maxX && minY < maxY)) {
    // rien à repérer (ou que des boîtes « partout ») : une seule case, qui
    // dit « toutes » — le shader fait comme avant
    sortie.fill(0)
    sortie[0] = GRILLE_TOUT
    return { nx: 1, ny: 1, minX: 0, minY: 0, invX: 0, invY: 0, debordements: 0, maxEntrees: 0 }
  }
  minX -= marge
  minY -= marge
  maxX += marge
  maxY += marge
  const w = maxX - minX
  const h = maxY - minY
  // des cases à peu près carrées, GRILLE_CASES au plus
  let s = Math.sqrt((w * h) / GRILLE_CASES)
  let nx = Math.max(1, Math.ceil(w / s))
  let ny = Math.max(1, Math.ceil(h / s))
  while (nx * ny > GRILLE_CASES) {
    s *= 1.05
    nx = Math.max(1, Math.ceil(w / s))
    ny = Math.max(1, Math.ceil(h / s))
  }
  const invX = nx / w
  const invY = ny / h

  // les listes, dans l'ordre du tableau (i croissant) : on remplit case par
  // case en parcourant les boîtes une fois
  const comptes = new Uint8Array(nx * ny)
  const listes = new Uint8Array(nx * ny * GRILLE_K)
  const pose = (cel: number, i: number) => {
    const c = comptes[cel]
    if (c >= GRILLE_K) {
      comptes[cel] = GRILLE_TOUT
      return
    }
    if (c === GRILLE_TOUT) return
    listes[cel * GRILLE_K + c] = i
    comptes[cel] = c + 1
  }
  for (let i = 0; i < n; i++) {
    const b = boites[i]
    let cx0 = 0
    let cy0 = 0
    let cx1 = nx - 1
    let cy1 = ny - 1
    if (!b.partout) {
      const e = rects[i]
      cx0 = Math.max(0, Math.floor((e[0] - marge - minX) * invX))
      cy0 = Math.max(0, Math.floor((e[1] - marge - minY) * invY))
      cx1 = Math.min(nx - 1, Math.floor((e[2] + marge - minX) * invX))
      cy1 = Math.min(ny - 1, Math.floor((e[3] + marge - minY) * invY))
    }
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) pose(cy * nx + cx, i)
  }

  // l'empaquetage : octet 0 le compte, puis les indices — quatre octets par
  // entier, le premier dans les bits de poids faible
  sortie.fill(0)
  let debordements = 0
  let maxEntrees = 0
  for (let cel = 0; cel < nx * ny; cel++) {
    const c = comptes[cel]
    const o = cel * 4
    if (c === GRILLE_TOUT) {
      debordements++
      sortie[o] = GRILLE_TOUT
      continue
    }
    if (c > maxEntrees) maxEntrees = c
    let mot = c
    for (let k = 0; k < c; k++) {
      const octet = 1 + k
      const idx = listes[cel * GRILLE_K + k]
      if (octet < 4) mot |= idx << (octet * 8)
      else sortie[o + (octet >> 2)] |= idx << ((octet & 3) * 8)
    }
    sortie[o] = mot
  }
  return { nx, ny, minX, minY, invX, invY, debordements, maxEntrees }
}

/** Relit une case empaquetée : la liste d'indices, ou null pour « toutes ». */
export function litCase(sortie: Int32Array, cel: number): number[] | null {
  const o = cel * 4
  const c = sortie[o] & 255
  if (c === GRILLE_TOUT) return null
  const out: number[] = []
  for (let k = 0; k < c; k++) {
    const octet = 1 + k
    out.push((sortie[o + (octet >> 2)] >> ((octet & 3) * 8)) & 255)
  }
  return out
}

/** La case d'un point, comme le shader la calcule (bornée à la grille). */
export function caseDe(g: Grille, x: number, y: number): number {
  const cx = Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.minX) * g.invX)))
  const cy = Math.min(g.ny - 1, Math.max(0, Math.floor((y - g.minY) * g.invY)))
  return cy * g.nx + cx
}
