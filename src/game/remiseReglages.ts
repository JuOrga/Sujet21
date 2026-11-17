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

// LA SECONDE REMISE (demande du concepteur, 17/11) : le relief passe FORT
// par défaut « pour tout le monde ». Le défaut seul ne joindrait que les
// appareils vierges — or la première remise a fait LÉGER de tous les autres,
// et le choix de chacun est écrit dès qu'il touche au bouton. Le relief seul
// est effacé, une fois, sous un témoin neuf.
export const CLE_REMISE_RELIEF_FORT = 'sujet21-reglages-remis-v2'
export const REGLAGES_REMIS_V2 = ['sujet21-relief'] as const // → FORT

/** Les remises, dans l'ordre : chacune passe une fois, sous son témoin. */
export const REMISES: readonly { temoin: string; cles: readonly string[] }[] = [
  { temoin: CLE_REMISE_REGLAGES, cles: REGLAGES_REMIS },
  { temoin: CLE_REMISE_RELIEF_FORT, cles: REGLAGES_REMIS_V2 },
]

/** Passe les remises qui ne l'ont pas encore été. Rend vrai quand au moins
 *  une vient d'avoir lieu. */
export function remetReglagesParDefaut(stockage: StockageReglages): boolean {
  let remis = false
  for (const r of REMISES) {
    try {
      if (stockage.getItem(r.temoin) !== null) continue
      // le témoin D'ABORD : si l'écriture est refusée (stockage plein ou
      // interdit), on n'efface rien — mieux vaut un réglage ancien qu'une
      // remise à zéro qui recommencerait à chaque lancement
      stockage.setItem(r.temoin, '1')
      for (const cle of r.cles) stockage.removeItem(cle)
      remis = true
    } catch {
      // stockage refusé : les remises suivantes le seraient aussi
      return remis
    }
  }
  return remis
}
