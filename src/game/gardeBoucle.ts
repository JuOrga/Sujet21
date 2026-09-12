// LA GARDE DE LA BOUCLE D'IMAGES. La boucle du jeu est une chaîne de
// requestAnimationFrame : chaque image réarme la suivante à sa fin. Une
// exception au milieu d'une image coupe la chaîne — et rien ne la renoue.
// Le symptôme vécu : l'image reste figée (le dernier rendu, le liquide en
// train d'être aspiré par le sas du hub) tandis que l'interface HTML, elle,
// continue de répondre — la carte s'ouvre, la salle se choisit, sa fiche
// s'affiche… sur une cuve qui ne bouge plus. Aucun message : l'écran de
// panne d'index.html ne veille que jusqu'à la PREMIÈRE image.
//
// La garde enveloppe le corps de l'image : l'exception est attrapée,
// SIGNALÉE (console, bannière, dernier incident gardé pour le rapport), et
// l'image suivante est réarmée quand même. Une panne passagère ne coûte
// qu'une image ; une panne qui se répète à chaque image n'est signalée
// qu'une fois — la bannière se lirait mal à soixante réécritures par
// seconde, et la console se noierait.

export interface PanneImage {
  message: string // « TypeError: Cannot read properties of undefined… »
  pile: string // la pile d'appels telle que le navigateur la donne
  occurrences: number // combien d'images d'affilée ont buté dessus
}

/** Enveloppe `corps` : ne lève jamais, signale chaque panne NOUVELLE (une
 *  répétition du même message ne fait que compter). Le compteur de la
 *  panne signalée se met à jour sur place : celui qui l'affiche peut le
 *  relire. `corps` renvoie `false` pour une image SAUTÉE (le plafond de
 *  cadence en écarte une sur deux à 120 Hz) : elle ne prouve rien et ne
 *  referme pas l'épisode — sinon une panne à chaque image se signalait à
 *  chaque image rendue, la console noyée, la bannière réécrite sans fin. */
export function creeGardeImage(
  corps: (now: number) => boolean | void,
  signale: (panne: PanneImage) => void,
): (now: number) => void {
  let derniere: PanneImage | null = null
  return (now: number): void => {
    try {
      const rendue = corps(now) !== false
      // une image RENDUE sans encombre referme l'épisode : la même erreur,
      // si elle revient plus tard, est un incident neuf, à signaler
      if (rendue) derniere = null
    } catch (e) {
      const message = decritErreur(e)
      if (derniere && derniere.message === message) {
        derniere.occurrences++
        return
      }
      derniere = {
        message,
        pile: e instanceof Error && e.stack ? e.stack : '',
        occurrences: 1,
      }
      // la signalisation elle-même ne doit jamais casser la boucle
      try {
        signale(derniere)
      } catch {
        // rien : la panne est déjà comptée
      }
    }
  }
}

/** Une ligne lisible pour n'importe quelle valeur levée (Error ou non). */
export function decritErreur(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return String(e)
}
