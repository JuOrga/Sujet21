// LA CARTE DE LA STATION, PARTAGÉE. L'éditeur exportait un carteStation.json
// à déposer dans le dépôt : tant qu'il n'était pas commité et déployé, la
// carte jouée ne changeait pas. Désormais l'éditeur PUBLIE au magasin
// partagé (/api/reglages, domaine carte) et la carte publiée joue pour tout
// le monde ; la carte livrée avec le code reste le filet. Le brouillon de
// l'éditeur (stockage du poste) ne joue jamais : il a son aperçu.
//
// UNE CARTE PUBLIÉE NE PASSE QUE SI ELLE SE JOUE : lisible (parseCarte) et
// sans verdict « erreur » (verifieCarte) — une carte qu'un joueur ne peut
// pas traverser ne remplace pas la livrée. Les identifiants de modules ne
// se réattribuent jamais : les registres des joueurs (caches vidées, run en
// cours) s'en souviennent.

import { parseCarte, serialiseCarte, verifieCarte, type CarteStation } from './carteStation'

/** La carte publiée telle qu'elle arrive — null si elle n'est pas jouable. */
export function litCartePubliee(document: unknown): CarteStation | null {
  if (typeof document !== 'object' || document === null) return null
  const { carte } = parseCarte(document)
  if (!carte) return null
  if (verifieCarte(carte).some((v) => v.niveau === 'erreur')) return null
  return carte
}

/** Ce qui empêche de publier — vide : rien. */
export function refusPublication(c: CarteStation): string[] {
  return verifieCarte(c)
    .filter((v) => v.niveau === 'erreur')
    .map((v) => v.message)
}

export function memeCarte(a: CarteStation | null, b: CarteStation | null): boolean {
  if (a === null || b === null) return a === b
  return serialiseCarte(a) === serialiseCarte(b)
}

/** Le document à publier : la carte, dans l'ordre de clés de l'export. */
export function documentCarte(c: CarteStation): unknown {
  return JSON.parse(serialiseCarte(c)) as unknown
}
