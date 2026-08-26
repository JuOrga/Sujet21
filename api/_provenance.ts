// La PROVENANCE d'une codification : qui a saisi le code d'un tableau, et
// quand. Seul le serveur connaît l'état d'avant — lui seul peut donc dire
// si la codification vient de changer, quel que soit l'écran (la planche,
// l'éditeur) qui envoie l'enregistrement. Sans dépendance : la règle se
// teste au banc (src/game/netLevels.spec.ts) comme elle s'exécute ici.

export interface EntreeAvant {
  auteur?: string
  majAt?: string
  codeAuteur?: string
  codeAt?: string
  level?: { code?: unknown }
}

/** Le couple (auteur, date) à inscrire sur l'entrée : rafraîchi quand le
 *  code CHANGE (ou à la création), repris tel quel sinon — retoucher le
 *  décor d'un tableau ne réattribue pas sa codification. */
export function provenanceCode(
  avant: EntreeAvant | undefined,
  codeApres: unknown,
  auteur: string,
  maintenant: string,
): { codeAuteur: string; codeAt: string } {
  const texte = (v: unknown): string => (typeof v === 'string' ? v : '')
  if (!avant || texte(codeApres) !== texte(avant.level?.code)) {
    return { codeAuteur: auteur, codeAt: maintenant }
  }
  return {
    // entrées d'avant la règle : le dernier enregistrement fait foi, c'est
    // la meilleure approximation disponible — jamais de mention vide
    codeAuteur: avant.codeAuteur || avant.auteur || auteur,
    codeAt: avant.codeAt || avant.majAt || maintenant,
  }
}
