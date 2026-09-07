// LA CLÉ CONCEPTEUR des scripts : tout ce qui ÉCRIT vers /api/* la joint
// (api/_garde.ts la vérifie). Elle vient de l'environnement — le secret
// GitHub CLE_CONCEPTEUR pour les gâchettes, la variable du shell à la
// main — et jamais d'un fichier du dépôt, qui est public.

const VARIABLE = 'CLE_CONCEPTEUR'

/** Les en-têtes d'une écriture JSON, clé comprise. Sans clé, on s'arrête
 *  AVANT le premier appel : mieux vaut un message net qu'une série de 401. */
export function enTetesEcriture() {
  const cle = process.env[VARIABLE]
  if (!cle) {
    throw new Error(
      `${VARIABLE} absente : ce script écrit vers l’API et ne peut rien sans la clé concepteur (secret GitHub pour une gâchette, variable du shell à la main)`,
    )
  }
  return { 'Content-Type': 'application/json', 'X-Cle-Concepteur': cle }
}
