// LA REMISE À ZÉRO DES RÉGLAGES GRAPHIQUES (demande du concepteur, 16/11).
// Le relief des parois est passé LÉGER par défaut, mais un défaut ne joint
// que l'appareil où le réglage n'a jamais été touché : quiconque avait cliqué
// OFF pendant la phase d'essai — ou coupé le liquide riche et les éclairages —
// serait resté sur l'ancien rendu sans le savoir. On efface donc ces quatre
// choix UNE fois, pour que tout le monde reparte des défauts de la maison.
//
// Une fois seulement : le témoin posé ici interdit le second passage, sans
// quoi le réglage qu'un joueur refait ensuite (SOBRE sur une machine qui
// rame) sauterait à chaque lancement. Pour une future remise à zéro, changer
// le numéro du témoin — ne jamais retirer celui-ci.

export const CLE_REMISE_REGLAGES = 'sujet21-reglages-remis-v1'

export const REGLAGES_REMIS = [
  'sujet21-relief', // → LÉGER
  'sujet21-eau', // → RICHE
  'sujet21-lumiere', // → ACTIF
  'sujet21-lumiere-eau', // → ACTIF
] as const

export interface StockageReglages {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
  removeItem(cle: string): void
}

/** Efface les quatre réglages si ce n'est pas déjà fait. Rend vrai quand la
 *  remise vient d'avoir lieu. */
export function remetReglagesParDefaut(stockage: StockageReglages): boolean {
  try {
    if (stockage.getItem(CLE_REMISE_REGLAGES) !== null) return false
    // le témoin D'ABORD : si l'écriture est refusée (stockage plein ou
    // interdit), on n'efface rien — mieux vaut un réglage ancien qu'une
    // remise à zéro qui recommencerait à chaque lancement
    stockage.setItem(CLE_REMISE_REGLAGES, '1')
    for (const cle of REGLAGES_REMIS) stockage.removeItem(cle)
    return true
  } catch {
    return false
  }
}
