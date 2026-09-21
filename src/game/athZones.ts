// OÙ UNE PANCARTE DU MONDE PEUT SE POSER.
//
// L'interface était deux bandes pleine largeur ; main.ts interdisait donc
// aux pancartes 46 px en haut et ~150 px en bas, sur TOUTE la largeur —
// près d'un cinquième de l'écran, pour une interface qui n'en couvrait
// qu'une fraction. L'ATH tient maintenant dans des coins : seuls les
// rectangles réellement occupés sont interdits.

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Les rectangles occupés, gonflés d'une marge de respiration. Un poste
 *  absent (null) ou sans surface (masqué) n'interdit rien. */
export function zonesInterdites(postes: (Rect | null)[], marge: number): Rect[] {
  const zones: Rect[] = []
  for (const p of postes) {
    if (!p || p.right - p.left <= 0 || p.bottom - p.top <= 0) continue
    zones.push({
      left: p.left - marge,
      top: p.top - marge,
      right: p.right + marge,
      bottom: p.bottom + marge,
    })
  }
  return zones
}

/** La pancarte centrée en (sx, sy), de demi-côtés (hw, hh), évite-t-elle
 *  toutes les zones ? Un contact de bord n'est pas un recouvrement. */
export function pancarteLibre(
  sx: number,
  sy: number,
  hw: number,
  hh: number,
  zones: Rect[],
): boolean {
  for (const z of zones) {
    if (sx + hw > z.left && sx - hw < z.right && sy + hh > z.top && sy - hh < z.bottom)
      return false
  }
  return true
}
