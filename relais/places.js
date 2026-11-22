// LES RÈGLES DU RELAIS QUI PROTÈGENT LES JOUEURS — sans dépendance, pour se
// tester avec le reste du jeu (src/multi/relaisPlaces.spec.ts) : le serveur
// (index.js) les applique.
//
// Pourquoi elles existent. Le multi est ouvert à tous depuis le 22/11, et le
// concepteur a demandé : « pas de problème de sécurité ? ». Le relais n'a
// aucun secret à garder (il ne voit passer que des positions de particules),
// mais deux défauts n'étaient admissibles qu'entre amis :
//
//  1. UNE PLACE SE PRENAIT AVEC LE SEUL CODE. Celui qui revient après une
//     coupure (la durée maximale d'une fonction) devait pouvoir reprendre sa
//     place ; la règle était donc « le dernier arrivé la prend ». Un inconnu
//     qui connaît — ou devine — un code de cinq caractères chassait ainsi un
//     joueur, hôte compris, en pleine partie. Désormais chacun présente un
//     JETON tiré au hasard par son navigateur, le même à chaque reconnexion :
//     une place tenue, ou quittée il y a moins de GRACE_MS, ne se donne qu'au
//     même jeton. Passé ce délai, elle est libre (un ami peut remplacer
//     celui qui est parti pour de bon).
//
//  2. RIEN NE BORNAIT LE DÉBIT D'UNE CONNEXION. Un programme qui ment sur son
//     origine pouvait faire passer par le relais tout ce qu'il voulait — et
//     le relais vit dans le projet Vercel du jeu : ce qu'il consomme, le jeu
//     le paie sur les mêmes quotas. Chaque connexion a maintenant un plafond
//     par seconde ; au-delà, ses messages sont jetés, et s'il persiste, elle
//     est coupée. Et une même adresse ne tient qu'un nombre borné de
//     connexions à la fois.

/** Le temps (ms) pendant lequel une place quittée reste à son jeton : celui
 *  qui revient après une coupure le fait en moins d'une seconde. */
export const GRACE_MS = 20_000

/** Un jeton : 32 chiffres hexadécimaux (16 octets tirés au hasard). Vide :
 *  un client d'avant les jetons — il garde l'ancienne règle, tant que la
 *  place n'est pas tenue par un jeton. */
export const JETON = /^([0-9a-f]{32})?$/

/** Le débit d'une connexion, en octets par seconde. Mesuré le 19/11 : une
 *  partie fait passer 212 Ko/s de l'hôte à l'invité ; au pire — 4 096
 *  particules, vingt images par seconde, calculé sur le format des trames —
 *  ~490 Ko/s. */
export const DEBIT_MAX = 768 * 1024
/** Les secondes de suite au-delà du plafond avant la coupure. */
export const PATIENCE_DEBIT = 5

/** Les connexions qu'une même adresse peut tenir à la fois (deux joueurs
 *  sur le même réseau, chacun avec une reconnexion en vol, et de la marge). */
export const CONNEXIONS_PAR_ADRESSE = 8

/** Un salon neuf : deux places vides, sans jeton. */
export function salonNeuf() {
  return { hote: null, invite: null, jetons: { hote: '', invite: '' }, quitte: { hote: 0, invite: 0 } }
}

/** Celui qui présente `jeton` peut-il prendre la place `role` du salon, à
 *  l'instant `maintenant` (ms) ? */
export function admet(salon, role, jeton, maintenant) {
  const tenu = salon.jetons[role]
  if (!tenu || tenu === jeton) return true
  const occupee = salon[role] !== null
  const recente = !occupee && maintenant - salon.quitte[role] < GRACE_MS
  return !(occupee || recente)
}

/** La place est prise par ce jeton. */
export function occupe(salon, role, connexion, jeton) {
  salon[role] = connexion
  salon.jetons[role] = jeton
}

/** La place est quittée à l'instant `maintenant` : son jeton la garde
 *  encore GRACE_MS. */
export function quitte(salon, role, maintenant) {
  salon[role] = null
  salon.quitte[role] = maintenant
}

/** Le compteur de débit d'une connexion. `compte` rend « passe », « jette »
 *  (au-delà du plafond de la seconde) ou « coupe » (au-delà, PATIENCE_DEBIT
 *  secondes de suite). */
export function debit(max = DEBIT_MAX, patience = PATIENCE_DEBIT) {
  let debutSeconde = -Infinity
  let octets = 0
  let excesDeSuite = 0
  let excesCetteSeconde = false
  return {
    compte(taille, maintenant) {
      if (maintenant - debutSeconde >= 1000) {
        // une seconde se ferme : était-elle au-delà ?
        excesDeSuite = excesCetteSeconde ? excesDeSuite + 1 : 0
        excesCetteSeconde = false
        debutSeconde = maintenant
        octets = 0
      }
      octets += taille
      if (octets <= max) return 'passe'
      excesCetteSeconde = true
      return excesDeSuite + 1 >= patience ? 'coupe' : 'jette'
    },
  }
}

/** L'adresse d'où vient une connexion (derrière Vercel, le premier maillon
 *  de x-forwarded-for). */
export function adresseDe(entetes, repli = '') {
  const transmis = entetes['x-forwarded-for']
  const premiere = (Array.isArray(transmis) ? transmis[0] : transmis ?? '').split(',')[0].trim()
  return premiere || repli
}
