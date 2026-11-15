// LES BLOCS D'UNE SOURCE, accolades appariées — pour les gardes qui lisent
// le shader (et l'hôte) en texte. Une regex « A[\s\S]*B » ne vérifie qu'un
// ORDRE : une ligne sortie du bloc qu'elle croit garder la satisfait encore.
// Vu à la relecture finale du volume des parois : `solPropre = solCache(…)`
// sorti de sa garde `if (uRelief > 0.0 && solide)`, et le cache des hauteurs
// remplacé par `if (true)` — toute la suite restait verte. Ici, « dans le
// bloc » veut dire dans le bloc.

/** La source, commentaires `//` blanchis à longueur égale (les positions ne
 *  bougent pas) : une accolade dans un commentaire ne compte pas. Un `//`
 *  précédé de `:` (une adresse, `http://`) n'est pas un commentaire. */
function sansCommentaires(source: string): string {
  return source.replace(/(^|[^:])\/\/[^\n]*/g, (m: string, avant: string) => avant + ' '.repeat(m.length - avant.length))
}

/** L'accolade qui ferme celle ouverte en `ouvrante` (−1 si aucune). */
function fermante(texte: string, ouvrante: number): number {
  let prof = 0
  for (let i = ouvrante; i < texte.length; i++) {
    const c = texte[i]
    if (c === '{') prof++
    else if (c === '}' && --prof === 0) return i
  }
  return -1
}

/** Le bloc ouvert par la première occurrence de `entete` (à partir de
 *  `depuis`) : de l'en-tête à son accolade fermante comprise. L'en-tête doit
 *  finir sur `{` (espaces permis). Vide s'il manque ou ne ferme pas : la
 *  garde échoue alors sur ce qu'elle attend du bloc. */
export function blocApres(source: string, entete: string, depuis = 0): string {
  const a = source.indexOf(entete, depuis)
  if (a < 0) return ''
  const propre = sansCommentaires(source)
  const o = propre.indexOf('{', a + entete.length - 1)
  if (o < 0 || propre.slice(a + entete.length, o).trim() !== '') return ''
  const f = fermante(propre, o)
  return f < 0 ? '' : source.slice(a, f + 1)
}

/** Les EN-TÊTES de tous les blocs qui contiennent la position `i`, du plus
 *  proche au plus lointain : pour chaque accolade ouvrante non refermée
 *  avant `i`, le texte qui la précède depuis la dernière fin d'instruction
 *  (`;`, `{`, `}`). */
export function entetesAutour(source: string, i: number): string[] {
  const propre = sansCommentaires(source)
  const entetes: string[] = []
  let prof = 0
  for (let k = i - 1; k >= 0; k--) {
    const c = propre[k]
    if (c === '}') prof++
    else if (c === '{') {
      if (prof > 0) prof--
      else {
        let debut = k - 1
        while (debut >= 0 && !';{}'.includes(propre[debut])) debut--
        entetes.push(propre.slice(debut + 1, k).replace(/\s+/g, ' ').trim())
      }
    }
  }
  return entetes
}

/** Chaque occurrence de `motif` dans `source`, avec les en-têtes des blocs
 *  qui la contiennent (entetesAutour). */
export function occurrencesDans(source: string, motif: string): { position: number; entetes: string[] }[] {
  const r: { position: number; entetes: string[] }[] = []
  for (let i = source.indexOf(motif); i >= 0; i = source.indexOf(motif, i + motif.length))
    r.push({ position: i, entetes: entetesAutour(source, i) })
  return r
}
