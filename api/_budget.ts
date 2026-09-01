// LE BUDGET D'UN DOCUMENT PARTAGÉ : ce qui limite la bibliothèque, c'est son
// POIDS, pas son NOMBRE d'entrées.
//
// Elle plafonnait à 60 tableaux. Le chiffre ne protégeait rien de réel : un
// tableau pèse ce qu'il pèse — mesuré sur les 32 tableaux écrits du jeu,
// 1 469 octets en moyenne, 1 514 en médiane, 2 164 pour le plus lourd — et
// c'est le document ENTIER qui part sur le réseau à chaque lecture comme à
// chaque écriture. Soixante entrées tiennent donc dans ~90 Ko : la limite
// tombait mille fois avant le moindre danger, et elle tombait en plein
// travail.
//
// Le vrai danger est ailleurs : un document si lourd que chaque ouverture de
// la planche se voie, et que le forfait de transfert y passe (10 Go/mois,
// 2,6 Mo consommés à ce jour). On mesure donc ce qu'on veut vraiment tenir,
// les octets. À 1,5 Ko l'entrée, 2 Mo laissent de l'ordre de 1 300 tableaux.
//
// Le nombre d'opérations, lui, ne bouge pas d'un pouce : une écriture coûte
// 2 put + 1 list qu'il y ait dix entrées ou mille (cf. _magasin.ts).

/** Le budget par défaut d'un document partagé, en octets. */
export const BUDGET_OCTETS = 2 * 1024 * 1024

/** Le poids réel du document sérialisé, en octets UTF-8 — les accents
 *  comptent double, et la prose de ce dépôt en est pleine. */
export function poidsDocument(corps: unknown): number {
  return new TextEncoder().encode(JSON.stringify(corps)).length
}

/** Le refus à opposer, en clair et chiffré, ou `null` si ça tient. Le
 *  message part tel quel jusqu'à l'écran : « injoignable » et « trop
 *  lourd » ne se soignent pas de la même façon. */
export function refusDeBudget(
  corps: unknown,
  budget: number = BUDGET_OCTETS,
): string | null {
  const poids = poidsDocument(corps)
  if (poids <= budget) return null
  const ko = (o: number): string => `${Math.round(o / 1024)} Ko`
  return `bibliothèque au plafond de poids (${ko(poids)} pour ${ko(budget)}) — supprimez ou allégez un tableau`
}
