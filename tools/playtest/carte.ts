// LA CARTE DU BOT — une grille d'occupation tirée des données du tableau,
// et le champ de distance qui en découle. Rien de physique ici : c'est la
// GÉOMÉTRIE seule, celle qui répond à « existe-t-il seulement un chemin ? ».
//
// Deux clients, deux exigences opposées :
//   · l'AUDIT veut la vérité stricte — une grille fine, aucune marge, pour
//     ne jamais déclarer infranchissable un couloir qui passe tout juste ;
//   · le PILOTE veut de la marge — un corps d'eau n'est pas un point, et
//     raser les parois coûte de l'adhérence. Il navigue donc sur la même
//     grille DILATÉE d'une cellule ou deux, et retombe sur la grille stricte
//     si la dilatation a fermé le seul passage.

import {
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  dansBoite,
  type LevelDef,
  type ObstacleBox,
  type PorteDef,
  type SpongeDef,
} from '../../src/game/level'

export const LIBRE = 0
export const SOLIDE = 1
export const EPONGE = 2 // traversable, mais le passage se paie en volume

export interface Grille {
  pas: number
  nx: number
  ny: number
  minX: number
  minY: number
  cells: Uint8Array
}

/** Le coût d'un pas de grille, par nature de cellule. L'éponge coûte huit
 *  fois le vide : le chemin l'évite s'il existe un tour, et l'emprunte quand
 *  c'est le seul passage — exactement ce que fait le joueur. */
const COUT: number[] = [1, Infinity, 8]

export function indice(g: Grille, cx: number, cy: number): number {
  return cy * g.nx + cx
}

export function celluleDe(g: Grille, x: number, y: number): [number, number] {
  const cx = Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.minX) / g.pas)))
  const cy = Math.min(g.ny - 1, Math.max(0, Math.floor((y - g.minY) / g.pas)))
  return [cx, cy]
}

export function centreDe(g: Grille, cx: number, cy: number): [number, number] {
  return [g.minX + (cx + 0.5) * g.pas, g.minY + (cy + 0.5) * g.pas]
}

/** L'état du corps : chaque état a ses portes. */
export type Etat = 'eau' | 'glace' | 'vapeur'

// Qui passe où — la règle est celle de resolveObstacles, et rien d'autre :
// la GRILLE laisse passer la VAPEUR, la MEMBRANE gorgée d'eau laisse suinter
// l'EAU, le RIDEAU lamellaire s'écarte devant la GLACE. Tout le reste bute,
// pour les trois. Un tableau dont le sas n'est atteignable qu'EN GLACE n'est
// pas cassé : c'est sa leçon. Sans cette distinction, l'audit criait à
// l'erreur sur Le conduit, Le rideau et Le dépôt de givre.
function bloque(b: ObstacleBox, etat: Etat): boolean {
  if (b.material === MAT_GRILLE) return etat !== 'vapeur'
  if (b.material === MAT_MEMBRANE) return etat !== 'eau'
  if (b.material === MAT_RIDEAU) return etat !== 'glace'
  return true
}

// Rastérise une pièce. Un rectangle droit remplit exactement les cellules
// qu'il RECOUVRE (jamais celles qu'il frôle) ; une pièce tournée ou de forme
// libre se teste au centre de cellule et à ses quatre coins — cinq points
// suffisent à ne pas rater un mur plus mince qu'une cellule.
function poseBoite(g: Grille, b: ObstacleBox, valeur: number): void {
  const cx0 = Math.max(0, Math.floor((b.minX - g.minX) / g.pas))
  const cy0 = Math.max(0, Math.floor((b.minY - g.minY) / g.pas))
  const cx1 = Math.min(g.nx - 1, Math.floor((b.maxX - g.minX) / g.pas))
  const cy1 = Math.min(g.ny - 1, Math.floor((b.maxY - g.minY) / g.pas))
  const droite = !b.angle && !b.forme
  const demi = g.pas * 0.5
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (!droite) {
        const [x, y] = centreDe(g, cx, cy)
        const touche =
          dansBoite(b, x, y) ||
          dansBoite(b, x - demi, y - demi) ||
          dansBoite(b, x + demi, y - demi) ||
          dansBoite(b, x - demi, y + demi) ||
          dansBoite(b, x + demi, y + demi)
        if (!touche) continue
      }
      g.cells[indice(g, cx, cy)] = valeur
    }
  }
}

// Une éponge est une nappe de cellules ; celles qui sont DÉJÀ solides
// (une paroi posée par-dessus) le restent — on ne perce pas un mur en
// buvant l'éponge qui le double.
function poseEponge(g: Grille, sp: SpongeDef): void {
  const boite: ObstacleBox = {
    minX: sp.minX,
    minY: sp.minY,
    maxX: sp.minX + sp.cols * sp.cellSize,
    maxY: sp.minY + sp.rows * sp.cellSize,
    material: 0,
  }
  const cx0 = Math.max(0, Math.floor((boite.minX - g.minX) / g.pas))
  const cy0 = Math.max(0, Math.floor((boite.minY - g.minY) / g.pas))
  const cx1 = Math.min(g.nx - 1, Math.floor((boite.maxX - g.minX) / g.pas))
  const cy1 = Math.min(g.ny - 1, Math.floor((boite.maxY - g.minY) / g.pas))
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const k = indice(g, cx, cy)
      if (g.cells[k] === LIBRE) g.cells[k] = EPONGE
    }
  }
}

export interface OptionsGrille {
  pas?: number
  /** L'état dans lequel on traverse le tableau. Défaut : l'eau. */
  etat?: Etat
  /** Les portes asservies au laser comptent-elles comme des parois ? Le bot
   *  ne joue pas les faisceaux : l'audit regarde donc les DEUX cas. */
  portesFermees?: boolean
}

export function construitGrille(
  level: LevelDef,
  o: OptionsGrille = {},
): Grille {
  const pas = o.pas ?? 12
  const b = level.bounds
  const nx = Math.max(1, Math.ceil((b.maxX - b.minX) / pas))
  const ny = Math.max(1, Math.ceil((b.maxY - b.minY) / pas))
  const g: Grille = {
    pas,
    nx,
    ny,
    minX: b.minX,
    minY: b.minY,
    cells: new Uint8Array(nx * ny),
  }
  const etat = o.etat ?? 'eau'
  for (const boite of level.boxes) {
    if (bloque(boite, etat)) poseBoite(g, boite, SOLIDE)
  }
  if (o.portesFermees) {
    for (const p of level.portes ?? []) {
      poseBoite(g, { ...(p as PorteDef), material: 0 }, SOLIDE)
    }
  }
  for (const sp of level.sponges) poseEponge(g, sp)
  return g
}

/** Distance de chaque cellule à la paroi la plus proche, EN CELLULES —
 *  une transformée de distance obtenue par un Dijkstra multi-sources depuis
 *  toutes les cellules solides. Une paroi vaut 0, le grand large vaut
 *  beaucoup. C'est elle qui permet au chemin de tenir le MILIEU des couloirs
 *  au lieu d'en raser les bords : un corps d'eau n'est pas un point, et il
 *  se pulvérise contre une paroi prise à pleine vitesse. */
export function distanceAuxParois(g: Grille): Float64Array {
  const dist = new Float64Array(g.nx * g.ny).fill(Infinity)
  const file: number[] = []
  for (let k = 0; k < g.cells.length; k++) {
    if (g.cells[k] === SOLIDE) {
      dist[k] = 0
      file.push(k)
    }
  }
  // Les bornes du tableau sont des parois comme les autres : le corps y bute.
  for (let cx = 0; cx < g.nx; cx++) {
    for (const cy of [0, g.ny - 1]) {
      const k = indice(g, cx, cy)
      if (dist[k] > 0) {
        dist[k] = 0
        file.push(k)
      }
    }
  }
  for (let cy = 0; cy < g.ny; cy++) {
    for (const cx of [0, g.nx - 1]) {
      const k = indice(g, cx, cy)
      if (dist[k] > 0) {
        dist[k] = 0
        file.push(k)
      }
    }
  }
  // Deux balayages en damier (chanfrein 3-4 approché par 1 / √2) suffisent :
  // la précision d'un vrai Dijkstra n'apporterait rien à une heuristique de
  // confort, et coûterait un tas de plus par tableau.
  const RAC2 = Math.SQRT2
  const passe = (
    x0: number,
    x1: number,
    dx: number,
    y0: number,
    y1: number,
    dy: number,
  ): void => {
    for (let cy = y0; cy !== y1; cy += dy) {
      for (let cx = x0; cx !== x1; cx += dx) {
        const k = indice(g, cx, cy)
        let d = dist[k]
        for (let vy = -1; vy <= 1; vy++) {
          for (let vx = -1; vx <= 1; vx++) {
            if (vx === 0 && vy === 0) continue
            const nx2 = cx + vx
            const ny2 = cy + vy
            if (nx2 < 0 || ny2 < 0 || nx2 >= g.nx || ny2 >= g.ny) continue
            const nd =
              dist[indice(g, nx2, ny2)] + (vx !== 0 && vy !== 0 ? RAC2 : 1)
            if (nd < d) d = nd
          }
        }
        dist[k] = d
      }
    }
  }
  passe(0, g.nx, 1, 0, g.ny, 1)
  passe(g.nx - 1, -1, -1, g.ny - 1, -1, -1)
  passe(0, g.nx, 1, 0, g.ny, 1)
  return dist
}

export interface ChampFlux {
  grille: Grille
  /** Coût du plus court chemin de chaque cellule jusqu'au sas ; Infinity si
   *  le sas est inatteignable depuis elle. */
  dist: Float64Array
}

export interface Confort {
  /** Distance aux parois, en cellules, en deçà de laquelle on paie. */
  marge: number
  /** Prix d'une cellule collée à la paroi, en pas de grille. */
  poids: number
}

/** Dijkstra en 8-connexité depuis le rectangle du sas. Les diagonales coûtent
 *  √2 fois le pas droit — sans quoi les chemins prennent l'escalier et le
 *  gradient que suit le pilote pointe de travers.
 *
 *  Le CONFORT, s'il est donné, renchérit les cellules proches d'une paroi :
 *  le chemin s'écarte des murs quand il peut, et s'y colle quand il n'y a
 *  pas d'autre passage — il ne devient jamais infranchissable. */
export function champDepuisLeSas(
  g: Grille,
  level: LevelDef,
  confort?: Confort,
): ChampFlux {
  const dist = new Float64Array(g.nx * g.ny).fill(Infinity)
  // Un tas binaire suffit largement : quelques dizaines de milliers de
  // cellules, une fois par tableau.
  const tas: { k: number; d: number }[] = []
  const pousse = (k: number, d: number): void => {
    dist[k] = d
    tas.push({ k, d })
    let i = tas.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (tas[p].d <= tas[i].d) break
      ;[tas[p], tas[i]] = [tas[i], tas[p]]
      i = p
    }
  }
  const retire = (): { k: number; d: number } => {
    const tete = tas[0]
    const dernier = tas.pop() as { k: number; d: number }
    if (tas.length > 0) {
      tas[0] = dernier
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < tas.length && tas[l].d < tas[m].d) m = l
        if (r < tas.length && tas[r].d < tas[m].d) m = r
        if (m === i) break
        ;[tas[m], tas[i]] = [tas[i], tas[m]]
        i = m
      }
    }
    return tete
  }

  const e = level.exit
  const [ex0, ey0] = celluleDe(g, e.minX, e.minY)
  const [ex1, ey1] = celluleDe(g, e.maxX, e.maxY)
  for (let cy = ey0; cy <= ey1; cy++) {
    for (let cx = ex0; cx <= ex1; cx++) {
      const k = indice(g, cx, cy)
      if (g.cells[k] === SOLIDE) continue
      pousse(k, 0)
    }
  }

  const proximite = confort ? distanceAuxParois(g) : null

  const RAC2 = Math.SQRT2
  while (tas.length > 0) {
    const { k, d } = retire()
    if (d > dist[k]) continue // entrée périmée
    const cx = k % g.nx
    const cy = (k - cx) / g.nx
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const vx = cx + dx
        const vy = cy + dy
        if (vx < 0 || vy < 0 || vx >= g.nx || vy >= g.ny) continue
        const vk = indice(g, vx, vy)
        const cout = COUT[g.cells[vk]]
        if (!isFinite(cout)) continue
        // Une diagonale ne doit pas passer par le COIN de deux parois :
        // le corps, lui, n'y passe pas.
        if (dx !== 0 && dy !== 0) {
          if (
            g.cells[indice(g, cx + dx, cy)] === SOLIDE &&
            g.cells[indice(g, cx, cy + dy)] === SOLIDE
          )
            continue
        }
        let pas = cout * (dx !== 0 && dy !== 0 ? RAC2 : 1)
        if (proximite && confort) {
          const marge = Math.max(0, confort.marge - proximite[vk])
          pas += confort.poids * (marge / confort.marge) ** 2
        }
        if (d + pas < dist[vk]) pousse(vk, d + pas)
      }
    }
  }
  return { grille: g, dist }
}

/** La distance au sas depuis un point du monde ; Infinity si le point est
 *  dans une paroi ou coupé du sas. */
export function distanceAuSas(champ: ChampFlux, x: number, y: number): number {
  const [cx, cy] = celluleDe(champ.grille, x, y)
  return champ.dist[indice(champ.grille, cx, cy)]
}

/** La direction à prendre en (x, y) pour se rapprocher du sas : la PENTE LA
 *  PLUS RAIDE du champ, c'est-à-dire la cellule qui fait gagner le plus de
 *  distance PAR UNITÉ PARCOURUE. La nuance n'est pas cosmétique : prendre
 *  simplement la cellule de moindre distance dans une fenêtre carrée donne,
 *  sur un champ presque plat, la première rencontrée à valeur égale — donc
 *  un cap systématiquement en diagonale, décidé par l'ordre de balayage.
 *  Le bot partait droit dans le pilier au lieu de passer entre les deux.
 *
 *  Le rayon `porte` élargit le voisinage examiné : regarder plus loin qu'une
 *  cellule lisse le gradient et évite de zigzaguer. Rend null si rien
 *  n'améliore (dans une paroi, ou déjà au sas). */
export function directionVersLeSas(
  champ: ChampFlux,
  x: number,
  y: number,
  porte = 3,
): { x: number; y: number } | null {
  const g = champ.grille
  const [cx, cy] = celluleDe(g, x, y)
  const ici = champ.dist[indice(g, cx, cy)]
  let meilleurTaux = 0
  let meilleurePortee = 0
  let bx = -1
  let by = -1
  for (let dy = -porte; dy <= porte; dy++) {
    for (let dx = -porte; dx <= porte; dx++) {
      if (dx === 0 && dy === 0) continue
      const vx = cx + dx
      const vy = cy + dy
      if (vx < 0 || vy < 0 || vx >= g.nx || vy >= g.ny) continue
      const d = champ.dist[indice(g, vx, vy)]
      if (!isFinite(d)) continue
      // Depuis une cellule murée (distance infinie), tout voisin atteignable
      // est un progrès : on prend le plus proche du sas.
      const gain = isFinite(ici) ? ici - d : -d
      const portee = Math.hypot(dx, dy)
      const taux = gain / portee
      // À taux égal — le cas ordinaire d'un champ régulier —, on retient la
      // cellule LA PLUS LOINTAINE. Prendre la plus proche laisserait le
      // décalage sous-cellulaire (jusqu'à un demi-pas) dominer la direction
      // rendue : dans une salle nue, le cap penchait de 27° pour une cellule
      // voisine choisie à un demi-pas au-dessus du corps.
      if (
        taux > meilleurTaux + 1e-9 ||
        (taux > meilleurTaux - 1e-9 && portee > meilleurePortee)
      ) {
        meilleurTaux = Math.max(meilleurTaux, taux)
        meilleurePortee = portee
        bx = vx
        by = vy
      }
    }
  }
  if (bx < 0) return null
  const [wx, wy] = centreDe(g, bx, by)
  const dx = wx - x
  const dy = wy - y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return null
  return { x: dx / len, y: dy / len }
}


/** LA LARGEUR DU PASSAGE — la vraie mesure d'un goulot. On ne la lit pas le
 *  long du plus COURT chemin : celui-là rase toujours un angle, et rendait la
 *  même valeur pour tous les tableaux. On cherche le chemin le plus LARGE,
 *  c'est-à-dire celui qui maximise sa propre section la plus étroite — un
 *  Dijkstra max-min, où le coût d'un chemin est le minimum des dégagements
 *  qu'il traverse. La valeur rendue au départ répond exactement à : « quelle
 *  est la section du plus large tuyau qui mène au sas ? »
 *
 *  Rend un demi-dégagement en unités monde (0 : aucun passage). */
export function largeurDuPassage(
  g: Grille,
  proximite: Float64Array,
  level: LevelDef,
  departX: number,
  departY: number,
): number {
  const large = new Float64Array(g.nx * g.ny).fill(-1)
  const tas: { k: number; w: number }[] = []
  const pousse = (k: number, w: number): void => {
    large[k] = w
    tas.push({ k, w })
    let i = tas.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (tas[p].w >= tas[i].w) break
      ;[tas[p], tas[i]] = [tas[i], tas[p]]
      i = p
    }
  }
  const retire = (): { k: number; w: number } => {
    const tete = tas[0]
    const dernier = tas.pop() as { k: number; w: number }
    if (tas.length > 0) {
      tas[0] = dernier
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < tas.length && tas[l].w > tas[m].w) m = l
        if (r < tas.length && tas[r].w > tas[m].w) m = r
        if (m === i) break
        ;[tas[m], tas[i]] = [tas[i], tas[m]]
        i = m
      }
    }
    return tete
  }

  const e = level.exit
  const [ex0, ey0] = celluleDe(g, e.minX, e.minY)
  const [ex1, ey1] = celluleDe(g, e.maxX, e.maxY)
  for (let cy = ey0; cy <= ey1; cy++) {
    for (let cx = ex0; cx <= ex1; cx++) {
      const k = indice(g, cx, cy)
      if (g.cells[k] === SOLIDE) continue
      pousse(k, proximite[k])
    }
  }
  while (tas.length > 0) {
    const { k, w } = retire()
    if (w < large[k]) continue
    const cx = k % g.nx
    const cy = (k - cx) / g.nx
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const vx = cx + dx
        const vy = cy + dy
        if (vx < 0 || vy < 0 || vx >= g.nx || vy >= g.ny) continue
        const vk = indice(g, vx, vy)
        if (g.cells[vk] === SOLIDE) continue
        const nw = Math.min(w, proximite[vk])
        if (nw > large[vk]) pousse(vk, nw)
      }
    }
  }
  const [dx, dy] = celluleDe(g, departX, departY)
  const w = large[indice(g, dx, dy)]
  return w < 0 ? 0 : w * g.pas
}
