// LES SPRITES DU FX-CANVAS : les images du calque 2D, celui qui se dessine
// PAR-DESSUS le fluide (mécanismes, pastilles, méta). Le monde WebGL a son
// propre chargeur de textures ; celui-ci ne sert que la toile 2D.
//
// Le contrat tient en une ligne : `sprite(url)` rend l'image quand elle est
// prête, et null sinon — jamais d'attente, jamais d'exception. L'appelant
// dessine son tracé vectoriel tant qu'il reçoit null : une image absente
// (fichier pas encore livré, réseau coupé) ne fait donc rien disparaître.
//
// Un échec est DÉFINITIF : on ne relance pas la requête à chaque image, sans
// quoi un fichier manquant produirait soixante requêtes par seconde.

type Etat = { img: HTMLImageElement | null }

const cache = new Map<string, Etat>()

/** L'image prête à dessiner, ou null : à charger tant qu'elle manque, à
 *  jamais si le fichier n'existe pas. */
export function sprite(url: string): HTMLImageElement | null {
  const connu = cache.get(url)
  if (connu) return connu.img
  const etat: Etat = { img: null }
  cache.set(url, etat)
  // hors navigateur (tests, rendu serveur) : rien à charger, tout reste au
  // tracé vectoriel
  if (typeof Image === 'undefined') return null
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    // une image de taille nulle (fichier corrompu) ne vaut pas mieux qu'aucune
    if (img.naturalWidth > 0 && img.naturalHeight > 0) etat.img = img
  }
  img.onerror = () => {
    // l'échec reste consigné : le cache garde null, plus aucune requête
  }
  img.src = url
  return null
}

/** Les images DÉJÀ PRÊTES, par url — l'atelier s'en sert pour vérifier d'un
 *  coup d'œil qu'un fichier fraîchement déposé est bien arrivé. */
export function spritesCharges(): string[] {
  const out: string[] = []
  for (const [url, etat] of cache) if (etat.img) out.push(url)
  return out
}

/** Oublie une image déjà tentée — pour l'atelier : redéposer un fichier et le
 *  voir sans recharger la page. */
export function oublieSprite(url: string): void {
  cache.delete(url)
}
