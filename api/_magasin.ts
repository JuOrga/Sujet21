// Magasin de documents JSON partagés (Vercel Blob) — au RÉGIME d'opérations.
//
// Le plan Hobby compte 2 000 « advanced operations » (list/put/copy) par
// mois : appeler list() à chaque lecture a suffi à bloquer le magasin un
// mois entier. Désormais :
//
//   LECTURE (chemin chaud) : zéro opération SDK. Un POINTEUR à chemin fixe
//   (`<prefix>pointeur.json`, cache CDN 60 s) donne l'URL du document
//   courant ; deux fetch HTTP publics suffisent — du simple transfert de
//   données (10 Go/mois, on en consommait 2,6 Mo). Un cache mémoire de
//   15 s par instance absorbe les rafales.
//
//   ÉCRITURE (rare) : 2 put (document à suffixe aléatoire + pointeur) et
//   1 list de ménage — l'historique garde les 4 documents les plus récents,
//   une écriture destructrice reste rattrapable.
//
//   REPLI : si le pointeur manque ou ment (blob supprimé, magasin neuf),
//   un list() retrouve l'historique et on le remonte du plus récent au plus
//   ancien. Un échec de lecture n'est JAMAIS un document vide : seul un
//   préfixe sans aucun blob est vide — tout le reste lève, l'appelant
//   répond 500 et n'écrase rien.

import { del, list, put } from '@vercel/blob'

const TTL_CACHE_MS = 15_000

const caches = new Map<string, { corps: unknown; t: number }>()
const urlsPointeur = new Map<string, string>()

function nomPointeur(prefix: string): string {
  return `${prefix}pointeur.json`
}

async function litViaPointeur(
  urlPointeur: string,
  valide: (data: unknown) => boolean,
): Promise<unknown | undefined> {
  try {
    const rp = await fetch(urlPointeur, { cache: 'no-store' })
    if (!rp.ok) return undefined
    const p = (await rp.json()) as { url?: string }
    if (!p || typeof p.url !== 'string') return undefined
    const rd = await fetch(p.url, { cache: 'no-store' })
    if (!rd.ok) return undefined
    const data = (await rd.json()) as unknown
    return valide(data) ? data : undefined
  } catch {
    return undefined
  }
}

// Lit le document courant du préfixe. `null` = magasin réellement vide.
// `frais: true` (chemin d'écriture) ignore cache et pointeur : une lecture
// list() authentique, fraîche à la seconde — les écritures sont rares.
export async function litDocument(
  prefix: string,
  valide: (data: unknown) => boolean,
  opts?: { frais?: boolean },
): Promise<unknown> {
  if (!opts?.frais) {
    const c = caches.get(prefix)
    if (c && Date.now() - c.t < TTL_CACHE_MS) return c.corps

    const ptr = urlsPointeur.get(prefix)
    if (ptr) {
      const corps = await litViaPointeur(ptr, valide)
      if (corps !== undefined) {
        caches.set(prefix, { corps, t: Date.now() })
        return corps
      }
    }
  }

  const { blobs } = await list({ prefix })
  const pointeur = blobs.find((b) => b.pathname === nomPointeur(prefix))
  if (pointeur) urlsPointeur.set(prefix, pointeur.url)
  const docs = blobs
    .filter((b) => b.pathname !== nomPointeur(prefix))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  if (docs.length === 0) {
    caches.set(prefix, { corps: null, t: Date.now() })
    return null
  }
  let derniere = 'aucun blob lisible'
  for (const b of docs) {
    try {
      const r = await fetch(b.url, { cache: 'no-store' })
      if (!r.ok) {
        derniere = `lecture : HTTP ${r.status} (${b.pathname})`
        continue
      }
      const data = (await r.json()) as unknown
      if (!valide(data)) {
        derniere = `document illisible (${b.pathname})`
        continue
      }
      caches.set(prefix, { corps: data, t: Date.now() })
      return data
    } catch (e) {
      derniere = String(e)
    }
  }
  throw new Error(derniere)
}

export async function ecritDocument(prefix: string, corps: unknown): Promise<void> {
  const doc = await put(`${prefix}v.json`, JSON.stringify(corps), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  })
  // le pointeur est une OPTIMISATION : s'il échoue, le repli list() suffit
  await put(nomPointeur(prefix), JSON.stringify({ url: doc.url }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  })
    .then((p) => urlsPointeur.set(prefix, p.url))
    .catch(() => {})
  caches.set(prefix, { corps, t: Date.now() })
  // ménage : les 4 documents les plus récents restent (le pointeur, cache
  // CDN 60 s, peut viser une version tout juste dépassée — elle vit encore)
  const { blobs } = await list({ prefix })
  const perimes = blobs
    .filter((b) => b.pathname !== nomPointeur(prefix))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(4)
  if (perimes.length > 0) await del(perimes.map((b) => b.url)).catch(() => {})
}
