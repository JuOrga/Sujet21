// LE CODE D'INVITATION — ce que deux navigateurs doivent s'échanger pour
// se joindre, mis dans une ligne qu'on copie et qu'on colle.
//
// Deux navigateurs ne se trouvent pas tout seuls : chacun doit donner à
// l'autre sa « description » (ses adresses possibles, ses clés). D'habitude
// un petit serveur fait le facteur. Ici il n'y en a pas, et c'est voulu :
//  - le plan Hobby compte douze fonctions et elles sont toutes prises
//    (api/reglages.ts le note) ;
//  - chaque partie coûterait des opérations Blob, sur un forfait de 2 000
//    par mois que le magasin partagé consomme déjà (api/_magasin.ts).
// Le facteur, c'est donc le joueur : il crée la partie, reçoit un code,
// l'envoie à son ami par le moyen qu'il veut ; l'ami le colle, reçoit un
// code de réponse, le renvoie. Deux copier-coller, zéro serveur, zéro coût.
//
// Le code n'est que la description compressée (deflate) puis écrite en
// base64 « url » — des lettres, des chiffres, - et _ : il survit à une
// messagerie, à un courriel, à une double sélection.

/** Le préfixe dit ce qu'est le code : coller la RÉPONSE là où l'on attend
 *  l'INVITATION est l'erreur la plus probable, autant la nommer. */
export const PREFIXE_INVITATION = 'S21A'
export const PREFIXE_REPONSE = 'S21B'

export type GenreCode = 'invitation' | 'reponse'

async function traverse(octets: Uint8Array, flux: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  // une copie dans un tampon à soi : Blob refuse la vue d'un tampon partagé
  const propre = new Uint8Array(octets.byteLength)
  propre.set(octets)
  const sortie = new Blob([propre.buffer]).stream().pipeThrough(flux)
  return new Uint8Array(await new Response(sortie).arrayBuffer())
}

function versBase64Url(octets: Uint8Array): string {
  let binaire = ''
  for (let i = 0; i < octets.length; i++) binaire += String.fromCharCode(octets[i])
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function depuisBase64Url(texte: string): Uint8Array {
  const b64 = texte.replace(/-/g, '+').replace(/_/g, '/')
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
  return octets
}

/** Fait le code à partir de la description (le SDP du navigateur). */
export async function faitCode(genre: GenreCode, description: string): Promise<string> {
  const compresse = await traverse(new TextEncoder().encode(description), new CompressionStream('deflate-raw'))
  return `${genre === 'invitation' ? PREFIXE_INVITATION : PREFIXE_REPONSE}.${versBase64Url(compresse)}`
}

/** Ce qu'on a compris d'un code collé : la description, ou la RAISON du
 *  refus, en clair — elle part telle quelle à l'écran. */
export type LectureCode = { ok: true; description: string } | { ok: false; raison: string }

/** Lit un code collé. Tolère ce qu'une messagerie ajoute autour : espaces,
 *  retours à la ligne, guillemets. */
export async function litCode(attendu: GenreCode, colle: string): Promise<LectureCode> {
  const texte = colle.replace(/[\s"'«»`]/g, '')
  if (texte === '') return { ok: false, raison: 'Le champ est vide : collez le code reçu.' }
  const point = texte.indexOf('.')
  const prefixe = point < 0 ? '' : texte.slice(0, point)
  const voulu = attendu === 'invitation' ? PREFIXE_INVITATION : PREFIXE_REPONSE
  if (prefixe !== voulu) {
    const autre = attendu === 'invitation' ? PREFIXE_REPONSE : PREFIXE_INVITATION
    if (prefixe === autre) {
      return {
        ok: false,
        raison:
          attendu === 'invitation'
            ? 'C’est un code de RÉPONSE. Ici il faut le code d’INVITATION, celui de la personne qui a créé la partie.'
            : 'C’est un code d’INVITATION. Ici il faut le code de RÉPONSE, celui que votre ami a reçu en rejoignant.',
      }
    }
    return { ok: false, raison: 'Ce n’est pas un code de partie : il doit commencer par ' + voulu + '.' }
  }
  try {
    const octets = await traverse(depuisBase64Url(texte.slice(point + 1)), new DecompressionStream('deflate-raw'))
    const description = new TextDecoder().decode(octets)
    // une description de navigateur commence toujours par sa ligne de version
    if (!description.startsWith('v=0')) return { ok: false, raison: 'Le code est abîmé : recopiez-le en entier.' }
    return { ok: true, description }
  } catch {
    return { ok: false, raison: 'Le code est incomplet ou abîmé : recopiez-le en entier.' }
  }
}
