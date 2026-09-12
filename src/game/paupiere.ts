// LA PAUPIÈRE DU SUJET — le clignement, le sommeil et l'agonie de l'œil
// (docs/sujet-vivant.md, B3, C4, E3). Pur : le temps entre, les facteurs
// sortent ; main.ts les applique aux curseurs de l'œil avant le rendu.
//
// Le clignement est le presque-rien noté sur l'œil abyssal (« c'est ce qui
// le rend vivant ») gardé sans l'iris : la lueur s'éteint un dixième de
// seconde, à intervalle irrégulier — plus souvent sous la peur.

/** Le prochain intervalle entre deux clignements (s) : ~5 à 9 s au calme,
 *  ~1,5 à 3 s sous la peur, mêlés par le stress. */
export function intervalleClignement(stress: number, rand: () => number = Math.random): number {
  const s = Math.min(1, Math.max(0, stress))
  const calme = 5 + rand() * 4
  const peur = 1.5 + rand() * 1.5
  return calme * (1 - s) + peur * s
}

/** La fermeture 0..1 d'un clignement commencé il y a `dt` secondes : une
 *  bosse en sinus sur `duree` (fermé à mi-course), 0 avant et après. */
export function clignement(dt: number, duree = 0.1): number {
  if (dt < 0 || dt >= duree) return 0
  return Math.sin((Math.PI * dt) / duree)
}

export type Agonie = {
  cherche: boolean // le regard balaie encore vers ses fragments
  int: number // la présence du regard, 0..1
  taille: number // le facteur de taille de la lueur (elle se resserre en un point)
  cligne: number // la fermeture, 0..1 — le dernier clignement, lent, sans réveil
  finie: boolean
}

/** La durée de la scène (s) : l'écran froid du laboratoire attend sa fin. */
export const AGONIE_DUREE = 1.6

/** L'agonie, `t` secondes après la dispersion : il CHERCHE ses fragments
 *  (0 à 0,8 s), la lueur se resserre en un point (0,4 à 1,4 s), un dernier
 *  clignement lent la ferme (1,0 à 1,5 s) — et alors seulement, plus rien. */
export function agonie(t: number): Agonie {
  const lisse = (a: number, b: number, x: number): number => {
    const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)
  }
  const cligne = lisse(1.0, 1.5, t)
  return {
    cherche: t < 0.8,
    int: (1 - lisse(1.2, 1.6, t)) * (1 - cligne),
    taille: 1 - 0.85 * lisse(0.4, 1.4, t),
    cligne,
    finie: t >= AGONIE_DUREE,
  }
}
