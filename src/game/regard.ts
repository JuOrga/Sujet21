// LE REGARD DU SUJET — la mécanique de l'œil (docs/sujet-vivant.md, § A1,
// B1 et l'avis du 12/09 sur l'œil qui suit le curseur).
//
// Ce qui trahissait une interface : la POURSUITE LISSE. Le noyau glissait
// en continu vers le curseur — un réticule. Un vrai œil SAUTE (une
// saccade), se pose, puis saute à nouveau ; la poursuite lisse est réservée
// à ce qui bouge devant soi. Ici : la cible ne se recale que si elle a
// bougé assez, ou après une pose tirée au sort — et alors vite.
//
// Pur : rien du DOM, rien de la simulation. main.ts fournit les cibles.

export type Saccade = {
  x: number // le point posé (monde)
  y: number
  t0: number // l'instant de la pose
  duree: number // la durée de la pose avant le prochain saut
}

/** Une saccade : le regard se recale sur (tx, ty) si la cible a bougé de
 *  plus de `seuil`, ou si la pose a duré. Rend true quand il a sauté. */
export function saccade(
  s: Saccade,
  tx: number,
  ty: number,
  now: number,
  rand: () => number = Math.random,
  seuil = 60,
): boolean {
  const loin = Math.hypot(tx - s.x, ty - s.y) > seuil
  const posee = now - s.t0 >= s.duree
  if (!loin && !posee) return false
  s.x = tx
  s.y = ty
  s.t0 = now
  // 0,4 à 1,5 s : le temps d'une fixation, jamais le même
  s.duree = 0.4 + rand() * 1.1
  return true
}

/** La direction où le corps VA : sa vitesse quand il bouge ; à l'arrêt,
 *  l'opposé du point d'éjection (il part à l'opposé du jet). Unitaire ;
 *  null si rien ne se dessine. */
export function directionDeMarche(
  vx: number,
  vy: number,
  cx: number,
  cy: number,
  aimX: number,
  aimY: number,
  vitesseMin = 40,
): { dx: number; dy: number } | null {
  const v = Math.hypot(vx, vy)
  if (v >= vitesseMin) return { dx: vx / v, dy: vy / v }
  const ax = cx - aimX
  const ay = cy - aimY
  const a = Math.hypot(ax, ay)
  if (a < 1e-3) return null
  return { dx: ax / a, dy: ay / a }
}

/** Le danger DEVANT : parmi des points (chaudières, plaques froides,
 *  éponges), le plus proche qui tombe dans le cône de marche (demi-angle
 *  ~35°) à moins de `portee`. C'est lui que le regard fixe — pas le
 *  curseur : il a peur, et il y va quand même. */
export function dangerDevant(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  points: ReadonlyArray<{ x: number; y: number }>,
  portee: number,
  cosMin = 0.82,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null
  let bestD = Infinity
  for (const p of points) {
    const px = p.x - cx
    const py = p.y - cy
    const d = Math.hypot(px, py)
    if (d < 1e-3 || d > portee || d >= bestD) continue
    if ((px * dx + py * dy) / d < cosMin) continue
    best = p
    bestD = d
  }
  return best
}
