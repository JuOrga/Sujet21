// L'ARC DES DÉCOUVERTES — le récit se livre UN JALON PAR EXPÉDITION
// BOUCLÉE (décision du concepteur : une run perdue ou abandonnée ne
// raconte rien ; boucler la descente, si). La file est ORDONNÉE : chaque
// expédition bouclée sert la prochaine non-vue, les registres
// (records.decouvertes) tiennent le compte. Le CONTENU des jalons vit au
// codex (groupe « recit », fiches `recit-<id>`) : le toast, la date et la
// lecture passent par le mécanisme des fiches — ici, on ne garde que
// l'ordre du récit.
//
// Quand TOUT est raconté, la fin s'ouvre : le sceau du secteur 4 tombe
// (l'arc du télescope — voir la condition « decouvertes-min » du
// scénario).
//
// LES FINS suivent la même règle, dans leur propre file : chaque
// expédition bouclée révèle aussi la prochaine fin non-vue (fiches du
// groupe « fins », ids `fin-<nom>`), jusqu'à ce que toutes soient
// débloquées. Les fins alternatives que le concepteur prévoit (« evil »,
// « semi-evil »…) s'ajoutent en QUEUE de FINS, avec leur fiche au codex.

/** Les jalons, dans l'ordre où le récit se livre. Le dernier ouvre la
 * fin. Ne JAMAIS réordonner ni réattribuer un id : les registres des
 * joueurs s'en souviennent. */
export const DECOUVERTES: readonly string[] = [
  'livraison', // ce qui est arrivé : le portique a cédé sous le miroir
  'cahier-charges', // ce que vous êtes : un MIROIR, pas un sujet d'étude
  'note-vega', // la voix du Dr Véga — le labo continue de consigner
  'calibrations', // les « records » sont des mesures de planéité
  'endormis', // les capsules de la cuve : les essais d'avant
  'semblable', // le marchand en était un — il a cessé de dormir
  'alerte', // le secteur 4 n'est pas scellé contre l'accident
  'la-haut', // le télescope orbite sans œil
  'precurseurs', // les miroirs vivants déjà envoyés — aucun message
  'le-choix', // le sas s'ouvre : à vous de décider
]

/** La prochaine découverte à servir — null : tout est raconté. */
export function prochaineDecouverte(
  vues: readonly string[],
): string | null {
  return DECOUVERTES.find((id) => !vues.includes(id)) ?? null
}

/** Tout est-il raconté ? (la condition d'ouverture de la fin) */
export function recitAcheve(vues: readonly string[]): boolean {
  return DECOUVERTES.every((id) => vues.includes(id))
}

/** Les fins, dans l'ordre où elles se révèlent — les ids sont ceux des
 * fiches du codex. Ne JAMAIS réordonner ni réattribuer un id, et jamais
 * `fin-jouee` : c'est le marqueur de la cinématique de fin vue. */
export const FINS: readonly string[] = [
  'fin-miroir', // la fin de l'arc : devenir l'œil du télescope, ou rester
]

/** La prochaine fin à révéler — null : toutes le sont. */
export function prochaineFin(vues: readonly string[]): string | null {
  return FINS.find((id) => !vues.includes(id)) ?? null
}
