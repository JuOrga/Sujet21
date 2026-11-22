// LE CODE DE PARTIE — cinq caractères que l'hôte donne à son ami.
//
// Module PUR : des chaînes en entrée, des chaînes en sortie.

/** L'alphabet des codes : ni I ni O ni 0 ni 1 — rien qui se confonde quand
 *  on dicte le code au téléphone ou qu'on le lit sur un écran. (Le relais
 *  tient la même règle : relais/index.js, CODE.) */
export const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LONGUEUR_CODE = 5

/** Tire un code de partie. `hasard` rend un nombre dans [0, 1[. */
export function tireCode(hasard: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < LONGUEUR_CODE; i++) code += ALPHABET_CODE[Math.floor(hasard() * ALPHABET_CODE.length) % ALPHABET_CODE.length]
  return code
}

/** Ce qu'on a compris d'un code tapé : le code remis au propre, ou la
 *  raison du refus, en clair. Tolère les minuscules, les espaces et les
 *  tirets. Un 0, un 1, un I ou un O n'existent dans aucun code : c'est une
 *  faute de recopie, on le dit au lieu de chercher une partie qui n'existe
 *  pas. */
export function litCodePartie(tape: string): { ok: true; code: string } | { ok: false; raison: string } {
  const propre = tape.toUpperCase().replace(/[\s\-_.]/g, '')
  if (propre === '') return { ok: false, raison: 'Tapez le code que votre ami vous a donné.' }
  if (propre.length !== LONGUEUR_CODE) return { ok: false, raison: `Le code fait ${LONGUEUR_CODE} caractères : celui-ci en a ${propre.length}.` }
  for (const c of propre) {
    if (!ALPHABET_CODE.includes(c)) {
      return { ok: false, raison: `« ${c} » n’existe dans aucun code (ni I, ni O, ni 0, ni 1) : vérifiez-le auprès de votre ami.` }
    }
  }
  return { ok: true, code: propre }
}
