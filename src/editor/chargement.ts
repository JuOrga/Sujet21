// Charger un JSON dans l'éditeur alors qu'un tableau de la bibliothèque est
// ouvert : le contenu change, l'entrée ouverte reste — et ENREGISTRER
// publiait le JSON PAR-DESSUS elle, sans un mot. C'est le même piège que
// l'annulation qui a coûté « echangette » le 28/08 (cf. historique.ts) :
// un contenu sous l'identifiant d'un autre tableau.
//
// On juge par le NOM, pas par le code : le code se partage entre salles
// (il décrit, il n'identifie pas — cf. store()), le nom désigne le tableau.
// Même nom : c'est une restauration, le lien est gardé. Autre nom : on
// demande, et si l'on charge, c'est DÉTACHÉ — ENREGISTRER créera une
// entrée neuve au lieu d'écraser.

export type IssueChargement = 'garde' | 'demande'

const nomNet = (s: string | undefined): string => (s ?? '').trim().toLowerCase()

export function issueChargement(
  ouvert: { name?: string } | null,
  charge: { name?: string },
): IssueChargement {
  if (!ouvert) return 'garde' // brouillon détaché : rien à écraser
  return nomNet(ouvert.name) === nomNet(charge.name) ? 'garde' : 'demande'
}

export function questionChargement(ouvert: string, charge: string): string {
  return (
    `« ${ouvert} » est ouvert, et ce JSON contient « ${charge} ».\n\n` +
    `OK : le charger DÉTACHÉ — « ${ouvert} » n’est pas touché, et ENREGISTRER créera un nouveau tableau.\n` +
    `Annuler : ne rien charger.`
  )
}

/** Le tableau OUVERT auquel comparer : l'entrée de la liste, ou — si la
 *  bibliothèque n'est pas encore arrivée (démarrage, réseau coupé) — le
 *  brouillon lui-même, qui EST ce tableau-là. Sans ce repli, le garde-fou
 *  se taisait justement au démarrage, liste vide, lien bien là. */
export function tableauOuvert<T extends { name?: string }>(
  openId: string,
  bibliotheque: { id: string; level: T }[],
  brouillon: T,
): T | null {
  if (!openId) return null
  return bibliotheque.find((l) => l.id === openId)?.level ?? brouillon
}
