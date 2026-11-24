// LES CLÉS DE L'ATELIER DU JOUEUR, et leur place : LE COFFRE.
//
// Les salles du joueur et son jeton d'auteur vivaient dans le stockage du
// navigateur : un autre appareil ne les voyait pas, un navigateur vidé les
// perdait — et avec le jeton, la main sur les salles publiées. Ce sont des
// créations du JOUEUR, comme sa progression : elles vont dans le document
// de l'emplacement (coffre.ts), qui s'exporte et que le Steam Cloud
// synchronise. (Les brouillons du CONCEPTEUR, eux, restent au navigateur :
// le coffre l'écrit en tête, ce ne sont pas des sauvegardes de partie.)
//
// Conséquence voulue : les salles suivent l'EMPLACEMENT, comme tout le
// reste d'une partie — chaque emplacement a son atelier et son jeton.
//
// Les clés gardent leurs noms d'avant : la reprise depuis le navigateur
// est une simple copie, et chaque module reste lisible tel quel.

/** La salle ouverte dans l'atelier (relue d'abord depuis MES SALLES). */
export const CLE_ATELIER_SALLE = 'projet21.atelier.v1'
/** Pour la salle ouverte : sa création en ligne, sa version publiée, sa clé. */
export const CLE_ATELIER_META = 'projet21.atelier.meta.v1'
/** MES SALLES : toutes les salles de l'atelier. */
export const CLE_ATELIER_SALLES = 'projet21.atelier.salles.v1'
/** Le jeton d'auteur : la main sur ses salles publiées. */
export const CLE_JETON_AUTEUR = 'sujet21.jetonAuteur'
/** Les salles publiées depuis cet emplacement (« Mes créations »). */
export const CLE_MES_CREATIONS = 'sujet21.mesCreations'

export const CLES_ATELIER: readonly string[] = [
  CLE_ATELIER_SALLE,
  CLE_ATELIER_META,
  CLE_ATELIER_SALLES,
  CLE_JETON_AUTEUR,
  CLE_MES_CREATIONS,
]

interface StockageMin {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
  removeItem(cle: string): void
}

/** LA REPRISE, une fois : ce que le navigateur tient encore de l'atelier
 *  passe dans le coffre — seulement si le coffre n'a pas déjà la clé (on
 *  n'écrase jamais une salle de l'emplacement par une copie de poste) — et
 *  quitte le navigateur, pour qu'il n'en reste qu'un exemplaire. Rend les
 *  clés reprises. Un stockage refusé ne fait rien perdre : la clé reste où
 *  elle était. */
export function reprendAtelierDuNavigateur(coffre: StockageMin, navigateur: StockageMin | null): string[] {
  if (!navigateur) return []
  const reprises: string[] = []
  for (const cle of CLES_ATELIER) {
    try {
      const v = navigateur.getItem(cle)
      if (v === null) continue
      if (coffre.getItem(cle) === null) {
        coffre.setItem(cle, v)
        reprises.push(cle)
      }
      // déjà dans le coffre (ou tout juste copiée) : le double s'efface
      if (coffre.getItem(cle) !== null) navigateur.removeItem(cle)
    } catch {
      // stockage refusé : rien ne bouge
    }
  }
  return reprises
}
