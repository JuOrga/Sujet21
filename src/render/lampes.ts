// LE BANDEAU SE DESSINE EN TROIS TRANCHES.
//
// L'image d'un bandeau (lampe-bande.webp, 1024 × 256) était posée d'un seul
// tenant sur un quad à la longueur de la lampe : un bandeau long étirait ses
// embouts ronds en pointes et ses boulons en ovales — « c'est moche » (le
// concepteur, 16/11). Elle se découpe maintenant comme un cadre : un embout
// carré à chaque bout (le premier et le dernier quart de l'image), jamais
// étirés, et un milieu (la moitié centrale) qui prend toute la longueur
// restante. L'image est dessinée pour : tout ce qu'elle porte dans son
// milieu est uniforme le long de la barre (tools/images/blender/lampes.py).

/** La part de l'image que prend chaque embout (un carré : 256 px sur 1024). */
export const EMBOUT_U = 0.25

export interface TrancheBandeau {
  /** le long de la barre, dans son repère (0 : son milieu), unités monde */
  x0: number
  x1: number
  /** la bande d'image posée dessus */
  u0: number
  u1: number
}

/** Les tranches d'un bandeau de demi-longueur `demiLong`, pour un quad de
 *  demi-hauteur `r` (le quad déborde la lampe de `r` à chaque bout). Un
 *  embout fait la hauteur du quad, 2r ; une lampe trop courte pour en loger
 *  deux les serre l'un contre l'autre, sans milieu. */
export function tranchesBandeau(demiLong: number, r: number): TrancheBandeau[] {
  const hw = Math.max(demiLong, 0) + r
  const embout = Math.min(2 * r, hw)
  const t: TrancheBandeau[] = [{ x0: -hw, x1: -hw + embout, u0: 0, u1: EMBOUT_U }]
  if (hw - embout > 1e-6) t.push({ x0: -hw + embout, x1: hw - embout, u0: EMBOUT_U, u1: 1 - EMBOUT_U })
  t.push({ x0: hw - embout, x1: hw, u0: 1 - EMBOUT_U, u1: 1 })
  return t
}
