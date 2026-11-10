// Les outils communs aux scènes : le pilote automatique et la caméra.

/** LE PILOTE AUTOMATIQUE. Le jeu n'a qu'un geste : éjecter vers un point,
 *  et partir à l'opposé. Pour aller quelque part, on compare la vitesse
 *  voulue (vers la balise, à l'allure donnée) à la vitesse du corps, et on
 *  éjecte à l'opposé de l'écart. Deux seuils (on pousse au-dessus de `haut`,
 *  on lâche sous `bas`) : sans cet écart entre les deux, le pilote
 *  pianoterait sur le bouton à chaque image — et chaque geste coûte du
 *  volume, exactement comme au joueur. */
export function pilote({ haut = 55, bas = 22 } = {}) {
  let pousse = false
  return function geste(e, balise, allure) {
    const dx = balise.x - e.x
    const dy = balise.y - e.y
    const d = Math.hypot(dx, dy) || 1
    const ex = (dx / d) * allure - e.vx
    const ey = (dy / d) * allure - e.vy
    const ecart = Math.hypot(ex, ey)
    if (pousse ? ecart < bas : ecart > haut) pousse = !pousse
    // le point visé : derrière le corps, à l'opposé de l'accélération voulue
    return { pousse, d, vise: { x: e.x - (ex / ecart) * 300, y: e.y - (ey / ecart) * 300 } }
  }
}

/** Une caméra qui suit le corps avec un peu d'avance sur sa vitesse, lissée
 *  — le cadre regarde où l'on va, pas d'où l'on vient. */
export function suiveur(depart, { avance = 0.4, raideur = 0.07 } = {}) {
  const c = { x: depart.x, y: depart.y }
  return function suit(e, decalage = { x: 0, y: 0 }) {
    c.x += (e.x + e.vx * avance + decalage.x - c.x) * raideur
    c.y += (e.y + e.vy * avance + decalage.y - c.y) * raideur
    return { x: c.x, y: c.y }
  }
}

/** Passage doux de a à b quand t va de 0 à 1. */
export const adouci = (a, b, t) => {
  const k = Math.max(0, Math.min(1, t))
  return a + (b - a) * k * k * (3 - 2 * k)
}
