// LE CURSEUR DANS LE VOLUME — le regroupement « là où l'on clique », à la
// manette.
//
// À la souris, on se rassemble là où l'on pose le pointeur sur le corps. Le
// stick, lui, n'a pas de point : il ne savait que rassembler au centre. Ce
// curseur lui en donne un — gâchette tenue, le stick gauche le PROMÈNE dans
// le corps, et A regroupe là où il se trouve.
//
// Il vit dans le REPÈRE DU CORPS (un écart au centre de masse, en unités du
// monde) : le corps dérive, le curseur dérive avec lui — on ne court pas
// après sa propre visée.

export interface CurseurVolume {
  /** Le mode est tenu (la gâchette est enfoncée). */
  actif: boolean
  /** Écart au centre du corps, en unités du monde (y vers le HAUT). */
  dx: number
  dy: number
}

export function nouveauCurseurVolume(): CurseurVolume {
  return { actif: false, dx: 0, dy: 0 }
}

/** Le curseur naît AU CENTRE à chaque prise : un point de départ que la
 *  main connaît, plutôt que le dernier endroit visité il y a une minute. */
export function prendCurseur(c: CurseurVolume): void {
  c.actif = true
  c.dx = 0
  c.dy = 0
}

/** Une image de promenade. `sx, sy` : le stick (y écran, vers le BAS),
 *  déjà pondéré par l'inclinaison ; `pas` : la course d'un stick à fond
 *  pendant cette image, en unités du monde ; `dansCorps` : cet écart au
 *  centre tombe-t-il sur le corps ?
 *
 *  Le curseur ne SORT pas du volume : un pas qui le mettrait dehors est
 *  refusé, mais il GLISSE le long du bord (on essaie chaque axe seul) —
 *  sans cela il se clouait au premier bord touché en diagonale. Et si
 *  c'est le corps qui s'est dérobé (il s'étire, il se déforme), le curseur
 *  est ramené vers le centre jusqu'à retrouver de la matière. */
export function avanceCurseur(
  c: CurseurVolume,
  sx: number,
  sy: number,
  pas: number,
  dansCorps: (dx: number, dy: number) => boolean,
): void {
  const mx = sx * pas
  const my = -sy * pas // l'écran descend, le monde monte
  if (mx !== 0 || my !== 0) {
    if (dansCorps(c.dx + mx, c.dy + my)) {
      c.dx += mx
      c.dy += my
    } else if (mx !== 0 && dansCorps(c.dx + mx, c.dy)) {
      c.dx += mx
    } else if (my !== 0 && dansCorps(c.dx, c.dy + my)) {
      c.dy += my
    }
  }
  // le corps s'est dérobé sous le curseur : retour vers le centre
  // (borné : au bout des essais — plus de corps du tout — il se pose au centre)
  for (let i = 0; !dansCorps(c.dx, c.dy); i++) {
    if (i >= 24 || Math.hypot(c.dx, c.dy) < 1e-3) {
      c.dx = 0
      c.dy = 0
      break
    }
    c.dx *= 0.8
    c.dy *= 0.8
  }
}
