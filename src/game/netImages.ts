// Bibliothèque d'images partagée (/api/images) : catalogue, import,
// suppression. L'import RECOMPRIME côté client (WebP, plus grand côté
// borné) : le serveur ne reçoit jamais un original de 20 Mo.

export interface SharedImage {
  nom: string
  url: string
  poids: number
  auteur: string
  majAt: string
}

const ENDPOINT = '/api/images'
const COTE_MAX = 1600
const QUALITE = 0.85

function readList(data: unknown): SharedImage[] {
  if (typeof data !== 'object' || data === null) return []
  const raw = (data as { images?: unknown }).images
  if (!Array.isArray(raw)) return []
  const out: SharedImage[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    if (typeof o.nom !== 'string' || typeof o.url !== 'string') continue
    out.push({
      nom: o.nom,
      url: o.url,
      poids: typeof o.poids === 'number' ? o.poids : 0,
      auteur: typeof o.auteur === 'string' ? o.auteur : '',
      majAt: typeof o.majAt === 'string' ? o.majAt : '',
    })
  }
  return out
}

export async function fetchImages(): Promise<SharedImage[] | null> {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}

/** Recomprime un fichier image en WebP (côté ≤ 1600 px) et renvoie le
 *  base64 nu, prêt pour l'envoi. Échoue (null) sur un fichier illisible. */
async function recomprime(fichier: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(fichier)
    const k = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * k))
    const h = Math.max(1, Math.round(bitmap.height * k))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const dataUrl = canvas.toDataURL('image/webp', QUALITE)
    const virgule = dataUrl.indexOf(',')
    if (!dataUrl.startsWith('data:image/webp') || virgule < 0) return null
    return dataUrl.slice(virgule + 1)
  } catch {
    return null
  }
}

/** Importe un fichier dans la bibliothèque sous ce nom (remplace un
 *  homonyme). Renvoie le catalogue à jour, ou null si tout a échoué. */
export async function pushImage(
  nom: string,
  fichier: File,
  auteur: string,
): Promise<SharedImage[] | null> {
  const data = await recomprime(fichier)
  if (!data) return null
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, type: 'image/webp', data, auteur }),
    })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}

export async function deleteImage(nom: string): Promise<SharedImage[] | null> {
  try {
    const r = await fetch(`${ENDPOINT}?nom=${encodeURIComponent(nom)}`, { method: 'DELETE' })
    if (!r.ok) return null
    return readList(await r.json())
  } catch {
    return null
  }
}
