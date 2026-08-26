// Les formes d'obstacle (2026) : la géométrie cesse d'être un rectangle.
// Chaque forme vit DANS la boîte englobante de son ObstacleBox (minX..maxX ×
// minY..maxY, avant rotation) : tout le code de picking grossier, de budget,
// de sérialisation et de rejet rapide continue de raisonner en boîtes.
// La physique, le laser et le shader ne consomment qu'un champ de distance
// signée : dist < 0 dedans, (nx, ny) = gradient normalisé sortant — le même
// contrat que le rectangle historique (obstacles.ts).

export const FORME_RECT = 0
export const FORME_DISQUE = 1 // ellipse inscrite dans la boîte (cercle si carrée)
export const FORME_CAPSULE = 2 // pilule : segment sur le grand axe, bouts ronds
export const FORME_COIN = 3 // triangle rectangle : la moitié de la boîte (p0 = coin 0..3)
export const FORME_ARC = 4 // arc d'anneau centré (p0 = épaisseur 0..1, p1 = demi-ouverture °)

export const FORME_NAMES: Record<number, string> = {
  [FORME_RECT]: 'Rectangle',
  [FORME_DISQUE]: 'Disque',
  [FORME_CAPSULE]: 'Capsule',
  [FORME_COIN]: 'Coin',
  [FORME_ARC]: 'Arc',
}

// Défauts des paramètres de forme — partagés par l'éditeur et la lecture.
export const ARC_EPAISSEUR_DEFAUT = 0.35
export const ARC_OUVERTURE_DEFAUT = 90 // demi-ouverture en degrés : 90 = demi-anneau

// Les BOUTS de l'arc (p2) : la forme des deux extrémités.
export const ARC_BOUT_ROND = 0 // calotte demi-ronde (l'historique)
export const ARC_BOUT_DROIT = 1 // coupe franche à 90° de la courbe (radiale)
export const ARC_BOUT_POINTE = 2 // griffe : l'anneau s'effile en pointe
export const ARC_BOUT_NOMS = ['Arrondis', 'Droits (90°)', 'En pointe']

export interface FormeBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  angle?: number // degrés, rotation autour du centre (comme ObstacleBox)
  forme?: number // absent/0 : rectangle — le chemin rapide partout
  p0?: number // COIN : orientation 0..3 · ARC : épaisseur relative 0..1
  p1?: number // ARC : demi-ouverture en degrés
  p2?: number // ARC : bouts (0 arrondis, 1 droits, 2 en pointe)
}

export interface FormeContact {
  dist: number // signée : négative dedans
  nx: number // gradient normalisé sortant (vers le point interrogé)
  ny: number
}

// ---- Le rectangle historique (déplacé d'obstacles.ts, comportement intact) --

function rectContactAxe(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
  out: FormeContact,
): void {
  const inside = x > b.minX && x < b.maxX && y > b.minY && y < b.maxY
  if (!inside) {
    const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x
    const cy = y < b.minY ? b.minY : y > b.maxY ? b.maxY : y
    const dx = x - cx
    const dy = y - cy
    const d = Math.hypot(dx, dy)
    out.dist = d
    if (d > 1e-9) {
      out.nx = dx / d
      out.ny = dy / d
    } else {
      out.nx = 0
      out.ny = 1
    }
    return
  }
  const pLeft = x - b.minX
  const pRight = b.maxX - x
  const pBottom = y - b.minY
  const pTop = b.maxY - y
  let pen = pLeft
  let nx = -1
  let ny = 0
  if (pRight < pen) {
    pen = pRight
    nx = 1
    ny = 0
  }
  if (pBottom < pen) {
    pen = pBottom
    nx = 0
    ny = -1
  }
  if (pTop < pen) {
    pen = pTop
    nx = 0
    ny = 1
  }
  out.dist = -pen
  out.nx = nx
  out.ny = ny
}

// ---- Les nouvelles formes (repère local, boîte déjà dépivotée) -------------

// Ellipse inscrite : SDF approché classique (exact pour le cercle) — le
// gradient reste exact, seule la distance est légèrement compressée sur les
// ellipses très allongées, ce qui suffit à une bande de contact.
function disqueContactAxe(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
  out: FormeContact,
): void {
  const rx = Math.max(1e-6, (b.maxX - b.minX) / 2)
  const ry = Math.max(1e-6, (b.maxY - b.minY) / 2)
  const px = x - (b.minX + b.maxX) / 2
  const py = y - (b.minY + b.maxY) / 2
  const k0 = Math.hypot(px / rx, py / ry)
  if (k0 < 1e-6) {
    out.dist = -Math.min(rx, ry)
    out.nx = 0
    out.ny = 1
    return
  }
  const gx = px / (rx * rx)
  const gy = py / (ry * ry)
  const k1 = Math.hypot(gx, gy)
  out.dist = (k0 * (k0 - 1)) / k1
  out.nx = gx / k1
  out.ny = gy / k1
}

// Capsule inscrite : segment sur le grand axe, rayon = la demi-épaisseur.
function capsuleContactAxe(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
  out: FormeContact,
): void {
  const hx = (b.maxX - b.minX) / 2
  const hy = (b.maxY - b.minY) / 2
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  let dx: number
  let dy: number
  let r: number
  if (hx >= hy) {
    r = hy
    const a = hx - r
    const qx = Math.min(a, Math.max(-a, x - cx))
    dx = x - cx - qx
    dy = y - cy
  } else {
    r = hx
    const a = hy - r
    const qy = Math.min(a, Math.max(-a, y - cy))
    dx = x - cx
    dy = y - cy - qy
  }
  const d = Math.hypot(dx, dy)
  out.dist = d - r
  if (d > 1e-9) {
    out.nx = dx / d
    out.ny = dy / d
  } else {
    out.nx = 0
    out.ny = 1
  }
}

// Les trois sommets du coin : p0 désigne le coin qui porte l'angle droit
// (0 bas-gauche, 1 bas-droit, 2 haut-droit, 3 haut-gauche), les deux autres
// sommets sont ses voisins — le triangle est la moitié de la boîte, coupée
// sur la diagonale. Sens trigonométrique garanti (les tests de côté comptent).
export function coinSommets(b: {
  minX: number
  minY: number
  maxX: number
  maxY: number
  p0?: number
}): [number, number, number, number, number, number] {
  const o = ((Math.round(b.p0 ?? 0) % 4) + 4) % 4
  switch (o) {
    case 1:
      return [b.maxX, b.minY, b.maxX, b.maxY, b.minX, b.minY]
    case 2:
      return [b.maxX, b.maxY, b.minX, b.maxY, b.maxX, b.minY]
    case 3:
      return [b.minX, b.maxY, b.minX, b.minY, b.maxX, b.maxY]
    default:
      return [b.minX, b.minY, b.maxX, b.minY, b.minX, b.maxY]
  }
}

function coinContactAxe(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number; p0?: number },
  out: FormeContact,
): void {
  const [ax, ay, bx, by, cx, cy] = coinSommets(b)
  // dedans : à gauche des trois arêtes (sommets en sens trigonométrique)
  const inside =
    (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0 &&
    (cx - bx) * (y - by) - (cy - by) * (x - bx) >= 0 &&
    (ax - cx) * (y - cy) - (ay - cy) * (x - cx) >= 0
  // point le plus proche sur les trois arêtes
  let best = Infinity
  let qx = ax
  let qy = ay
  const arete = (x0: number, y0: number, x1: number, y1: number): void => {
    const ex = x1 - x0
    const ey = y1 - y0
    const t = Math.min(
      1,
      Math.max(0, ((x - x0) * ex + (y - y0) * ey) / (ex * ex + ey * ey || 1)),
    )
    const px = x0 + t * ex
    const py = y0 + t * ey
    const d2 = (x - px) * (x - px) + (y - py) * (y - py)
    if (d2 < best) {
      best = d2
      qx = px
      qy = py
    }
  }
  arete(ax, ay, bx, by)
  arete(bx, by, cx, cy)
  arete(cx, cy, ax, ay)
  const d = Math.sqrt(best)
  out.dist = inside ? -d : d
  if (d > 1e-9) {
    const s = inside ? -1 : 1
    out.nx = (s * (x - qx)) / d
    out.ny = (s * (y - qy)) / d
  } else {
    out.nx = 0
    out.ny = 1
  }
}

/** L'étendue angulaire de l'EFFILAGE d'un bout en pointe : la griffe se
 *  resserre sur ce dernier segment d'angle avant de mourir à ±ouverture. */
export function arcTaper(rm: number, ht: number, ouverture: number): number {
  return Math.min(ouverture * 0.7, Math.max(0.12, (2.2 * ht) / rm))
}

/** L'arc en géométrie UNITAIRE (rayon extérieur 1) + les ÉCHELLES qui le
 *  font remplir la boîte : la boîte est la boîte englobante EXACTE de
 *  l'arc — étiré en ellipse s'il le faut, comme le disque. Fini la moitié
 *  de boîte vide au-dessus d'un demi-anneau (signalé : les coins de la
 *  boîte collent désormais à l'arc, petit ou grand).
 *
 *  Les BOUTS comptent dans ce calcul : la calotte ronde déborde le plan de
 *  coupe, la coupe franche s'arrête net, la griffe meurt sur le rayon
 *  médian — trois silhouettes, trois boîtes. Changer de bout resserre donc
 *  la boîte sur ce qu'on voit, sans marge morte (signalé). */
export function arcRayons(b: {
  minX: number
  minY: number
  maxX: number
  maxY: number
  p0?: number
  p1?: number
  p2?: number
}): {
  rm: number
  ht: number
  ouverture: number
  taper: number
  bout: number
  cu: number
  sx: number
  sy: number
} {
  const t = Math.min(1, Math.max(0.08, b.p0 ?? ARC_EPAISSEUR_DEFAUT))
  const ouverture =
    (Math.min(180, Math.max(15, b.p1 ?? ARC_OUVERTURE_DEFAUT)) * Math.PI) / 180
  const bout = Math.min(2, Math.max(0, Math.round(b.p2 ?? ARC_BOUT_ROND)))
  const rm = 1 - t / 2
  const ht = t / 2
  const ri = Math.max(0, rm - ht) // le rayon intérieur (l'extérieur vaut 1)
  const taper = arcTaper(rm, ht, ouverture)
  // la boîte englobante de l'arc unitaire : [xmin..1] × [-ymax..ymax] — le
  // bord DROIT est toujours le rayon extérieur (l'arc passe par θ = 0)
  // un anneau COMPLET n'a pas de bouts : quelle que soit la finition, sa
  // boîte est celle de l'anneau (le champ signé fait le même choix)
  const coupe = ouverture < Math.PI - 1e-4
  let xmin: number
  let ymax: number
  if (bout === ARC_BOUT_DROIT && coupe) {
    // secteur d'anneau : les extrêmes sont sur la coupe (ou sur l'anneau
    // lui-même quand il franchit un quart de tour)
    const c = Math.cos(ouverture)
    xmin = c < 0 ? c : ri * c
    ymax = ouverture >= Math.PI / 2 ? 1 : Math.sin(ouverture)
  } else if (bout === ARC_BOUT_POINTE && coupe) {
    // griffe à tranchants droits : le corps va jusqu'à φ, la pointe est un
    // SOMMET — des bords droits n'ont d'extrêmes qu'aux sommets
    const phi = ouverture - taper
    const c = Math.cos(phi)
    xmin = Math.min(c < 0 ? c : ri * c, rm * Math.cos(ouverture))
    ymax = Math.max(
      phi >= Math.PI / 2 ? 1 : Math.sin(phi),
      rm * Math.sin(ouverture),
    )
  } else {
    xmin = rm * Math.cos(ouverture) - ht // la calotte déborde toujours
    ymax = ouverture < Math.PI / 2 ? rm * Math.sin(ouverture) + ht : 1
  }
  return {
    rm,
    ht,
    ouverture,
    taper,
    bout,
    cu: (xmin + 1) / 2, // centre x de cette boîte unitaire
    sx: Math.max(1e-6, (b.maxX - b.minX) / (1 - xmin)),
    sy: Math.max(1e-6, (b.maxY - b.minY) / (2 * ymax)),
  }
}

// Arc d'anneau : bande radiale sur ±ouverture autour de +x (la rotation de
// la boîte oriente l'arc), et des BOUTS au choix (p2) — calotte ronde,
// coupe franche à 90° de la courbe, ou griffe en pointe. Évalué en espace
// UNITAIRE puis remis à l'échelle de la boîte — même approche (et même
// approximation de distance) que l'ellipse : le gradient est exact, la
// distance légèrement compressée sur les arcs très étirés. La boîte reste
// celle des bouts RONDS quel que soit p2 : changer de bout ne déplace ni ne
// remet à l'échelle l'arc — les bouts droits et pointus vivent un cheveu en
// retrait des coins.
function arcContactAxe(
  x: number,
  y: number,
  b: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    p0?: number
    p1?: number
    p2?: number
  },
  out: FormeContact,
): void {
  const { rm, ht, ouverture, taper, bout, cu, sx, sy } = arcRayons(b)
  const qx = (x - (b.minX + b.maxX) / 2) / sx + cu
  const qy = (y - (b.minY + b.maxY) / 2) / sy
  const L = Math.hypot(qx, qy)
  const th = Math.atan2(qy, qx)
  // pli de symétrie : on travaille sur |angle|, le signe déplie la normale
  const a = Math.abs(th)
  const sg = th >= 0 ? 1 : -1
  const ri = Math.max(0, rm - ht)
  const ro = rm + ht
  let dU: number
  let nx: number
  let ny: number
  const radiale = (): void => {
    const dr = L - rm
    dU = Math.abs(dr) - ht
    if (L > 1e-9) {
      const sgn = dr >= 0 ? 1 : -1
      nx = (sgn * qx) / L
      ny = (sgn * qy) / L
    } else {
      nx = 0
      ny = 1
    }
  }
  nx = 0
  ny = 1
  dU = 0
  // un anneau COMPLET (ouverture pleine) n'a pas de bouts : les couper
  // laisserait une fente d'épaisseur nulle — un cheveu clair en travers
  const coupe = ouverture < Math.PI - 1e-4
  if (bout === ARC_BOUT_DROIT && coupe) {
    if (a <= ouverture) {
      radiale()
      // la coupe : distance signée au plan radial de l'extrémité (≤ 0 ici) —
      // l'intersection avec la bande donne la coupe franche à 90°
      const scut = L * Math.sin(a - ouverture)
      if (scut > dU) {
        dU = scut
        nx = -Math.sin(ouverture)
        ny = Math.cos(ouverture) * sg
      }
    } else {
      // au-delà de la coupe : le plus proche est le SEGMENT de coupe (ri→ro)
      const ca = Math.cos(ouverture)
      const sa = Math.sin(ouverture)
      const t = Math.min(ro, Math.max(ri, qx * ca + Math.abs(qy) * sa))
      const dx = qx - t * ca
      const dy = Math.abs(qy) - t * sa
      const d = Math.hypot(dx, dy)
      dU = d
      if (d > 1e-9) {
        nx = dx / d
        ny = (dy / d) * sg
      }
    }
  } else if (bout === ARC_BOUT_POINTE && coupe) {
    // La GRIFFE : le corps de l'anneau court jusqu'à φ, puis DEUX TRANCHANTS
    // DROITS se rejoignent en une pointe posée sur le rayon médian. Des
    // bords droits, c'est une boîte englobante exacte (les extrêmes sont aux
    // sommets) — et la distance se lit sur les quatre morceaux de bord d'un
    // seul tenant : aucune couture, donc aucun trait clair en travers.
    const phi = ouverture - taper
    const cf = Math.cos(phi)
    const sf = Math.sin(phi)
    const px = ro * cf // le bout de l'arc extérieur
    const py = ro * sf
    const ix = ri * cf // celui de l'arc intérieur
    const iy = ri * sf
    const tx = rm * Math.cos(ouverture) // la pointe
    const ty = rm * Math.sin(ouverture)
    const ax = qx
    const ay = Math.abs(qy)
    let bd2 = Infinity
    let bx = 0
    let by = 0
    const cand = (cx2: number, cy2: number): void => {
      const d2 = (ax - cx2) * (ax - cx2) + (ay - cy2) * (ay - cy2)
      if (d2 < bd2) {
        bd2 = d2
        bx = cx2
        by = cy2
      }
    }
    const seg = (x0: number, y0: number, x1: number, y1: number): void => {
      const ex = x1 - x0
      const ey = y1 - y0
      const t = Math.min(
        1,
        Math.max(0, ((ax - x0) * ex + (ay - y0) * ey) / (ex * ex + ey * ey || 1)),
      )
      cand(x0 + t * ex, y0 + t * ey)
    }
    if (a <= phi) {
      // sous le corps de l'anneau : les deux arcs se projettent radialement
      const ux = L > 1e-9 ? ax / L : 1
      const uy = L > 1e-9 ? ay / L : 0
      cand(ro * ux, ro * uy)
      cand(ri * ux, ri * uy)
    } else {
      cand(px, py)
      cand(ix, iy)
    }
    seg(px, py, tx, ty)
    seg(tx, ty, ix, iy)
    const c1 = (tx - px) * (ay - py) - (ty - py) * (ax - px)
    const c2 = (ix - tx) * (ay - ty) - (iy - ty) * (ax - tx)
    const c3 = (px - ix) * (ay - iy) - (py - iy) * (ax - ix)
    const griffe = !(
      (c1 < 0 || c2 < 0 || c3 < 0) &&
      (c1 > 0 || c2 > 0 || c3 > 0)
    )
    const dedans = (a <= phi && L >= ri && L <= ro) || griffe
    const d = Math.sqrt(bd2)
    dU = dedans ? -d : d
    if (d > 1e-9) {
      const s = dedans ? -1 : 1
      nx = (s * (ax - bx)) / d
      ny = (s * (ay - by) * sg) / d
    }
  } else if (a <= ouverture) {
    radiale()
  } else {
    // bouts RONDS (l'historique) : la calotte au bout du rayon médian
    const ca = th >= 0 ? ouverture : -ouverture
    const dx = qx - rm * Math.cos(ca)
    const dy = qy - rm * Math.sin(ca)
    const d = Math.hypot(dx, dy)
    dU = d - ht
    if (d > 1e-9) {
      nx = dx / d
      ny = dy / d
    }
  }
  // retour au monde : gradient transformé par l'inverse des échelles
  const gx = nx / sx
  const gy = ny / sy
  const gl = Math.hypot(gx, gy) || 1e-9
  out.dist = dU / gl
  out.nx = gx / gl
  out.ny = gy / gl
}

// ---- Le dispatch : dépivoter, résoudre en local, repivoter la normale ------

function formeContactAxe(
  x: number,
  y: number,
  b: FormeBox,
  out: FormeContact,
): void {
  switch (b.forme ?? FORME_RECT) {
    case FORME_DISQUE:
      disqueContactAxe(x, y, b, out)
      return
    case FORME_CAPSULE:
      capsuleContactAxe(x, y, b, out)
      return
    case FORME_COIN:
      coinContactAxe(x, y, b, out)
      return
    case FORME_ARC:
      arcContactAxe(x, y, b, out)
      return
    default:
      rectContactAxe(x, y, b, out)
  }
}

/** Contact signé contre n'importe quelle forme, rotation comprise — le même
 *  contrat que le boxContact historique. */
export function formeContact(
  x: number,
  y: number,
  b: FormeBox,
  out: FormeContact,
): void {
  if (b.angle) {
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    const rad = (b.angle * Math.PI) / 180
    const ca = Math.cos(rad)
    const sa = Math.sin(rad)
    const rx = x - cx
    const ry = y - cy
    formeContactAxe(cx + rx * ca + ry * sa, cy - rx * sa + ry * ca, b, out)
    const nx = out.nx * ca - out.ny * sa
    const ny = out.nx * sa + out.ny * ca
    out.nx = nx
    out.ny = ny
    return
  }
  formeContactAxe(x, y, b, out)
}

const scratch: FormeContact = { dist: 0, nx: 0, ny: 1 }

/** Le point (x, y) est-il dans la forme ? Rectangle : le chemin rapide
 *  historique (bornes strictes) ; autres formes : le signe du SDF. */
export function dansForme(b: FormeBox, x: number, y: number): boolean {
  if (!(b.forme ?? FORME_RECT)) {
    if (!b.angle) return x > b.minX && x < b.maxX && y > b.minY && y < b.maxY
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    const rad = (b.angle * Math.PI) / 180
    const ca = Math.cos(rad)
    const sa = Math.sin(rad)
    const rx = x - cx
    const ry = y - cy
    const lx = cx + rx * ca + ry * sa
    const ly = cy - rx * sa + ry * ca
    return lx > b.minX && lx < b.maxX && ly > b.minY && ly < b.maxY
  }
  formeContact(x, y, b, scratch)
  return scratch.dist < 0
}

// ---- Le contour, pour l'éditeur (précédent : zoneOutline) ------------------

/** Le contour de la forme en coordonnées MONDE (rotation comprise) : ce que
 *  l'éditeur trace en lineTo est ce que le shader évalue en SDF. */
export function formeOutline(
  b: FormeBox,
  steps = 48,
): { x: number; y: number }[] {
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const pts: { x: number; y: number }[] = []
  const f = b.forme ?? FORME_RECT
  if (f === FORME_DISQUE) {
    const rx = (b.maxX - b.minX) / 2
    const ry = (b.maxY - b.minY) / 2
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2
      pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
    }
  } else if (f === FORME_CAPSULE) {
    const hx = (b.maxX - b.minX) / 2
    const hy = (b.maxY - b.minY) / 2
    const horiz = hx >= hy
    const r = horiz ? hy : hx
    const a = (horiz ? hx : hy) - r
    const n = Math.max(6, Math.floor(steps / 2))
    // deux demi-cercles reliés : centres à ±a sur le grand axe
    for (let i = 0; i <= n; i++) {
      const t = -Math.PI / 2 + (i / n) * Math.PI
      const px = a + r * Math.cos(t)
      const py = r * Math.sin(t)
      pts.push(horiz ? { x: cx + px, y: cy + py } : { x: cx - py, y: cy + px })
    }
    for (let i = 0; i <= n; i++) {
      const t = Math.PI / 2 + (i / n) * Math.PI
      const px = -a + r * Math.cos(t)
      const py = r * Math.sin(t)
      pts.push(horiz ? { x: cx + px, y: cy + py } : { x: cx - py, y: cy + px })
    }
  } else if (f === FORME_COIN) {
    const [ax, ay, bx, by, cx2, cy2] = coinSommets(b)
    pts.push({ x: ax, y: ay }, { x: bx, y: by }, { x: cx2, y: cy2 })
  } else if (f === FORME_ARC) {
    const { rm, ht, ouverture, taper, bout, cu, sx, sy } = arcRayons(b)
    const monde = (ux: number, uy: number): { x: number; y: number } => ({
      x: cx + (ux - cu) * sx,
      y: cy + uy * sy,
    })
    const n = Math.max(8, Math.floor(steps / 2))
    const ro = rm + ht
    const ri = Math.max(0, rm - ht)
    // l'étendue angulaire des lisières : en pointe, elles s'arrêtent où les
    // tranchants commencent — le bout lui-même est un sommet unique
    const fin = bout === ARC_BOUT_POINTE ? ouverture - taper : ouverture
    for (let i = 0; i <= n; i++) {
      const t = -fin + (i / n) * 2 * fin
      pts.push(monde(ro * Math.cos(t), ro * Math.sin(t)))
    }
    const capN = 6
    const cap = (phi: number, depart: number): void => {
      const ex = rm * Math.cos(phi)
      const ey = rm * Math.sin(phi)
      for (let i = 1; i < capN; i++) {
        const t = depart + (i / capN) * Math.PI
        pts.push(monde(ex + ht * Math.cos(t), ey + ht * Math.sin(t)))
      }
    }
    // BOUTS : ronds — la calotte ; droits — rien (la fermeture du polygone
    // trace la coupe radiale) ; en pointe — le sommet de la griffe
    if (bout === ARC_BOUT_ROND) cap(ouverture, ouverture)
    else if (bout === ARC_BOUT_POINTE)
      pts.push(monde(rm * Math.cos(ouverture), rm * Math.sin(ouverture)))
    for (let i = n; i >= 0; i--) {
      const t = -fin + (i / n) * 2 * fin
      pts.push(monde(ri * Math.cos(t), ri * Math.sin(t)))
    }
    if (bout === ARC_BOUT_ROND) cap(-ouverture, -ouverture + Math.PI)
    else if (bout === ARC_BOUT_POINTE)
      pts.push(monde(rm * Math.cos(-ouverture), rm * Math.sin(-ouverture)))
  } else {
    pts.push(
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    )
  }
  if (b.angle) {
    const rad = (b.angle * Math.PI) / 180
    const ca = Math.cos(rad)
    const sa = Math.sin(rad)
    for (const p of pts) {
      const rx = p.x - cx
      const ry = p.y - cy
      p.x = cx + rx * ca - ry * sa
      p.y = cy + rx * sa + ry * ca
    }
  }
  return pts
}
