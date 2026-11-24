// LA CLÉ CONCEPTEUR : qui a le droit d'ÉCRIRE dans ce que tout le monde joue.
//
// Jusqu'ici, aucun endpoint ne demandait rien : la bibliothèque, la carte,
// le récit, les présets se réécrivaient — ou s'effaçaient — par un simple
// POST ou DELETE, depuis n'importe quel navigateur. Le mode concepteur
// (`?dev`, sept tapes) ne cachait que des BOUTONS : l'API derrière restait
// grande ouverte. Tant que le site vivait entre deux personnes qui se
// parlent, ça passait ; le jour où l'éditeur s'ouvre aux joueurs, c'est
// une porte d'entrée sur la run de tout le monde.
//
// La règle : LIRE reste libre (le jeu en a besoin pour jouer), ÉCRIRE
// exige une clé. Les clés vivent dans la variable d'environnement Vercel
// CLES_CONCEPTEUR, jamais dans le code :
//
//     CLES_CONCEPTEUR = "julian:<clé longue>, ami:<autre clé longue>"
//
// UNE CLÉ PAR PERSONNE, nommée : on en retire une sans toucher aux autres,
// et le serveur sait QUI écrit.
//
// Le serveur ne garde que l'empreinte de chaque clé et compare à temps
// constant : la durée de la réponse ne trahit pas à quel point une clé
// essayée était proche. Une clé de moins de 16 caractères est IGNORÉE —
// une clé courte se devine.
//
// Sans aucune clé valide configurée, les écritures sont REFUSÉES (503) :
// une variable oubliée ne doit pas rouvrir la porte en silence. Le message
// le dit, en clair, jusqu'à l'écran.
//
// Sans dépendance au transport : la règle se teste au banc
// (src/game/cleConcepteur.spec.ts) comme elle s'exécute ici.

import { createHash, timingSafeEqual } from 'node:crypto'

/** L'en-tête qui porte la clé — le client (src/game/reseau.ts) le pose. */
export const ENTETE_CLE = 'x-cle-concepteur'

/** En dessous, une clé est ignorée : elle se devinerait. */
export const CLE_LONGUEUR_MIN = 16

/** Les méthodes qui ne changent rien : jamais de clé demandée. */
const LECTURES = new Set(['GET', 'HEAD', 'OPTIONS'])

export type Verdict =
  | { ok: true; nom: string }
  | { ok: false; statut: 401 | 503; erreur: string }

// un Uint8Array plutôt qu'un Buffer : les types de Node et ceux du DOM ne
// s'accordent plus sur Buffer, et timingSafeEqual ne demande qu'une vue
function empreinte(cle: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(cle, 'utf8').digest())
}

/** Lit la variable CLES_CONCEPTEUR : des entrées `nom:clé` séparées par
 *  des virgules, des points-virgules ou des retours à la ligne. Une entrée
 *  sans nom s'appelle « concepteur ». Rend les empreintes, jamais les clés. */
export function lisCles(brut: string | undefined): { nom: string; empreinte: Uint8Array }[] {
  if (!brut) return []
  const cles: { nom: string; empreinte: Uint8Array }[] = []
  for (const morceau of brut.split(/[,;\n]/)) {
    const entree = morceau.trim()
    if (!entree) continue
    const deux = entree.indexOf(':')
    const nom = deux > 0 ? entree.slice(0, deux).trim() : 'concepteur'
    const cle = (deux > 0 ? entree.slice(deux + 1) : entree).trim()
    if (cle.length < CLE_LONGUEUR_MIN) continue
    cles.push({ nom: nom.slice(0, 40) || 'concepteur', empreinte: empreinte(cle) })
  }
  return cles
}

/** La clé reçue dans l'en-tête — un en-tête répété n'en garde que le premier. */
export function cleRecue(entete: string | string[] | undefined): string {
  const v = Array.isArray(entete) ? entete[0] : entete
  return typeof v === 'string' ? v.trim() : ''
}

/** Le verdict sur une CLÉ, quelle que soit la méthode : reconnue (et à
 *  qui), absente, refusée, ou serveur sans clé configurée. */
export function verdictCle(recue: string, brut: string | undefined): Verdict {
  const cles = lisCles(brut)
  if (cles.length === 0) {
    return {
      ok: false,
      statut: 503,
      erreur:
        'écritures verrouillées : aucune clé concepteur valide sur le serveur (variable CLES_CONCEPTEUR, 16 caractères au moins)',
    }
  }
  if (!recue) {
    return { ok: false, statut: 401, erreur: 'clé concepteur manquante — RÉGIE › CLÉ CONCEPTEUR pour la saisir' }
  }
  const e = empreinte(recue)
  // on parcourt TOUTES les clés, sans sortir au premier succès : le temps
  // de réponse ne dit pas laquelle a répondu
  let nom: string | null = null
  for (const c of cles) {
    if (timingSafeEqual(e, c.empreinte) && nom === null) nom = c.nom
  }
  if (nom === null) return { ok: false, statut: 401, erreur: 'clé concepteur refusée' }
  return { ok: true, nom }
}

/** Le verdict sur une REQUÊTE : une lecture passe toujours, une écriture
 *  passe par la clé. */
export function verdictConcepteur(
  methode: string | undefined,
  recue: string,
  brut: string | undefined,
): Verdict {
  if (LECTURES.has((methode ?? 'GET').toUpperCase())) return { ok: true, nom: '' }
  return verdictCle(recue, brut)
}

// Les domaines de `reglages` que les JOUEURS écrivent — des avis (les
// musiques, les salles), pas des réglages : leur POST reste ouvert. Les
// RETIRER (DELETE) efface l'avis de tout le monde : ça reste un geste de
// concepteur, sous clé.
export const DOMAINES_AVIS = ['ecoute', 'avis-salles']

/** Un joueur dépose-t-il un avis (POST sur un domaine d'avis) ? */
export function avisDeJoueur(methode: string | undefined, domaine: unknown): boolean {
  return (methode ?? '').toUpperCase() === 'POST' && typeof domaine === 'string' && DOMAINES_AVIS.includes(domaine)
}

interface RequeteMin {
  method?: string
  headers: Record<string, string | string[] | undefined>
}
interface ReponseMin {
  status(code: number): { json(corps: unknown): unknown }
}

/** Le garde à poser en tête d'un handler concepteur. Rend `true` si la
 *  requête peut continuer ; sinon la réponse est DÉJÀ partie (401/503). */
export function exigeConcepteur(
  req: RequeteMin,
  res: ReponseMin,
  brut: string | undefined = process.env.CLES_CONCEPTEUR,
): boolean {
  const v = verdictConcepteur(req.method, cleRecue(req.headers[ENTETE_CLE]), brut)
  if (v.ok) return true
  res.status(v.statut).json({ error: v.erreur })
  return false
}
