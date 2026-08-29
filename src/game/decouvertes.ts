// L'ARC DES DÉCOUVERTES — le récit se livre UN JALON PAR RETOUR de run
// (bouclée, dispersée ou abandonnée : le sujet apprend de tout). La file
// est ORDONNÉE : chaque retour au module sert la prochaine non-vue, les
// registres (records.decouvertes) tiennent le compte. Le CONTENU des
// jalons vit au codex (groupe « recit », fiches `recit-<id>`) : le toast,
// la date et la lecture passent par le mécanisme des fiches — ici, on ne
// garde que l'ordre du récit.
//
// Quand TOUT est raconté, la fin s'ouvre : le sceau du secteur 4 tombe
// (l'arc du télescope — voir la condition « decouvertes-min » du
// scénario).

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
