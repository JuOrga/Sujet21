// L'OUÏE DU SUJET : chaque état est une oreille (docs/sujet-vivant.md, I2).
// Le corps est le point d'écoute — l'eau entend étouffé, la glace entend
// sourd (et craque de l'intérieur), la vapeur entend clair et large : on est
// de l'air. Changer d'état, c'est changer d'oreilles ; le joueur SENT l'état
// sans lire la légende. Pure : les fractions d'état entrent, le réglage du
// filtre maître sort — audio.ts l'applique.

export type Ouie = {
  coupure: number // Hz : le passe-bas de l'oreille
  aigus: number // dB : le plateau d'aigus (la vapeur ouvre l'oreille)
  niveau: number // 0..1 : la glace assourdit un peu tout
}

/** L'eau, nue : à peine voilée — le réglage historique était grand ouvert,
 *  et les lits musicaux n'ont rien au-dessus de 3 kHz : 7 500 Hz ne
 *  touche que l'air des bruitages. */
export const OUIE_EAU: Ouie = { coupure: 7500, aigus: 0, niveau: 1 }
const OUIE_GLACE: Ouie = { coupure: 1500, aigus: 0, niveau: 0.82 }
const OUIE_VAPEUR: Ouie = { coupure: 19500, aigus: 2.5, niveau: 1 }

/** `glace` et `vapeur` : fractions du corps (0..1) dans chaque état. Le
 *  reste est de l'eau. Une transformation partielle mêle les oreilles au
 *  prorata — jamais un saut. */
export function ouieDe(glace: number, vapeur: number): Ouie {
  const g = Math.min(1, Math.max(0, glace))
  const v = Math.min(1, Math.max(0, vapeur))
  const e = Math.max(0, 1 - g - v)
  // la coupure se mêle en log : l'oreille entend les octaves, pas les hertz
  const logC =
    e * Math.log(OUIE_EAU.coupure) +
    g * Math.log(OUIE_GLACE.coupure) +
    v * Math.log(OUIE_VAPEUR.coupure)
  return {
    coupure: Math.exp(logC),
    aigus: e * OUIE_EAU.aigus + g * OUIE_GLACE.aigus + v * OUIE_VAPEUR.aigus,
    niveau: e * OUIE_EAU.niveau + g * OUIE_GLACE.niveau + v * OUIE_VAPEUR.niveau,
  }
}

/** Le panoramique d'une source : à gauche ou à droite DU CORPS, borné —
 *  jamais tout à fait dans une oreille (portée : la demi-largeur d'une
 *  cuve). */
export function panDepuis(corpsX: number, sourceX: number, portee = 700): number {
  const p = (sourceX - corpsX) / Math.max(1, portee)
  return Math.max(-1, Math.min(1, p)) * 0.85
}
