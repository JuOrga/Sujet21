// LE GESTE « RECOMMENCER » EN RUN (R, Select, le chip ↺ de la barre).
//
// R relance la salle gratuitement tant que le corps vit : c'est un droit,
// on recommence un mauvais départ sans rien payer. Mais une fois l'essai
// PERDU, la relance n'est plus gratuite : elle coûte un échantillon de
// secours, ou la run. La panne vécue (23/11) : la dernière impulsion
// donnée, le corps gelé dérivait pendant le sursis — et R, pressé avant
// que l'écran de défaite ne paraisse, rejouait la salle sans rien prendre.
// Le joueur rejouait à volonté sa dernière vie. Le bouton de relance,
// lui, concluait déjà (« EN RESTER LÀ — CONCLURE LA SALLE ») : seule la
// touche oubliait le corps figé et ne regardait que la dispersion.

/** Ce que l'essai en cours dit de lui-même à l'instant du geste. */
export interface EtatEssai {
  /** le corps s'est dispersé (le battement de l'agonie court peut-être) */
  disperse: boolean
  /** la dernière impulsion est donnée : le corps figé dérive, sursis */
  epuise: boolean
  /** le sas a bu assez : CONTINUER est offert — la salle est gagnée */
  continuerOffert: boolean
}

/**
 * Vrai quand le geste doit CONCLURE l'essai (écran de dispersion : un
 * secours se paie, ou la run est perdue) plutôt que rejouer la salle.
 * Exactement les cas où le bouton de relance s'affiche en run : le corps
 * dispersé, ou figé sans que le sas ait offert la sortie. Un corps figé
 * que le sas a bu ne perd rien — rejouer y reste un choix libre.
 */
export function recommencerConclut(e: EtatEssai): boolean {
  if (e.disperse) return true
  return e.epuise && !e.continuerOffert
}
