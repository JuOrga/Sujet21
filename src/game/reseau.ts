// LA CLOISON RÉSEAU : le seul chemin du jeu vers l'API partagée.
//
// Avant elle, treize modules appelaient `fetch('/api/…')` en direct —
// records, bibliothèque, présets, images, cinématiques, journal, codex,
// réglages, fiches, règles, rapport de performance. Ça marche tant que le
// jeu vit sur Vercel avec son API à côté. Ça ne marche plus le jour où le
// jeu part dans une coquille (Steam) : là, ZÉRO appel doit sortir à
// l'exécution — le contenu livré, embarqué dans le code, fait foi ; les
// records iront aux classements Steam, les sauvegardes au Steam Cloud,
// les salles au Workshop. Sans cloison, ce jour-là demande de retoucher
// treize modules dans l'urgence. Avec, il demande UNE ligne.
//
// Le contrat est celui de fetch, exprès : chaque site d'appel change un
// mot (`fetch` → `appelle`) et rien d'autre — ni la lecture de la réponse,
// ni la gestion d'échec. Tous les appelants savent déjà échouer en
// silence (hors ligne, ils rendent null et gardent ce qu'ils ont) : le
// mode HORS LIGNE ne fait que rejeter avant de partir, et le jeu tombe
// sur ses filets comme s'il n'y avait pas de réseau.
//
// Quatre poignées, et c'est tout :
//   · horsLigne — aucun appel ne part (`?horsligne` dans l'URL, ou l'hôte
//     natif qui le déclare) ;
//   · base — le préfixe d'URL, vide sur Vercel (même origine), à poser si
//     une coquille sert le jeu d'ailleurs ;
//   · dos — le transport, `fetch` par défaut, injectable (tests, hôte) ;
//   · cle — la CLÉ CONCEPTEUR (cleConcepteur.ts) : posée, elle accompagne
//     chaque ÉCRITURE (tout sauf GET/HEAD) dans l'en-tête que le serveur
//     exige (api/_cle.ts). Une lecture ne la porte jamais : rien à prouver
//     pour lire, et une clé qui voyage moins fuit moins.

export interface DosReseau {
  fetch(entree: string, init?: RequestInit): Promise<Response>
}

export interface EtatReseau {
  /** Aucun appel ne part : tout retombe sur le contenu livré. */
  horsLigne: boolean
  /** Le préfixe d'URL devant `/api/…` — vide : la même origine. */
  base: string
  /** Le transport ; null : le fetch global. */
  dos: DosReseau | null
  /** La clé concepteur, portée par les écritures ; vide : aucune. */
  cle: string
  /** Ce qui est parti (diagnostic, tests) : le chemin de chaque appel. */
  appels: string[]
  /** Ce qui a été REFUSÉ hors ligne (diagnostic, tests). */
  refuses: string[]
}

function horsLigneDemande(): boolean {
  try {
    const hote = (globalThis as { sujet21Hote?: { horsLigne?: boolean } }).sujet21Hote
    if (hote?.horsLigne === true) return true
    if (typeof location !== 'undefined') {
      return new URLSearchParams(location.search).has('horsligne')
    }
  } catch {
    // pas de fenêtre (tests) : en ligne par défaut
  }
  return false
}

export const reseau: EtatReseau = {
  horsLigne: horsLigneDemande(),
  base: '',
  dos: null,
  cle: '',
  appels: [],
  refuses: [],
}

/** L'en-tête qui porte la clé — le même nom que côté serveur (api/_cle.ts). */
export const ENTETE_CLE = 'x-cle-concepteur'

/** L'appel tel qu'il part : la clé ajoutée aux écritures, rien d'autre
 *  touché — sans clé, `init` passe tel quel. */
function avecCle(init: RequestInit | undefined): RequestInit | undefined {
  const methode = (init?.method ?? 'GET').toUpperCase()
  if (!reseau.cle || methode === 'GET' || methode === 'HEAD') return init
  const entetes = new Headers(init?.headers)
  entetes.set(ENTETE_CLE, reseau.cle)
  return { ...init, headers: entetes }
}

/** Le plafond des journaux de diagnostic : on garde les derniers, pas tout. */
const JOURNAL_MAX = 200

function note(liste: string[], chemin: string): void {
  liste.push(chemin)
  if (liste.length > JOURNAL_MAX) liste.splice(0, liste.length - JOURNAL_MAX)
}

export class HorsLigneError extends Error {
  constructor(chemin: string) {
    super(`hors ligne : ${chemin}`)
    this.name = 'HorsLigneError'
  }
}

/** L'appel à l'API — le contrat de fetch. Hors ligne, il REJETTE avant de
 *  partir : l'appelant tombe dans son catch, comme sans réseau. */
export function appelle(chemin: string, init?: RequestInit): Promise<Response> {
  if (reseau.horsLigne) {
    note(reseau.refuses, chemin)
    return Promise.reject(new HorsLigneError(chemin))
  }
  note(reseau.appels, chemin)
  const url = reseau.base ? reseau.base + chemin : chemin
  const parti = avecCle(init)
  const dos = reseau.dos
  if (dos) return dos.fetch(url, parti)
  return fetch(url, parti)
}
