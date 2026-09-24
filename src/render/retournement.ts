// LE RETOURNEMENT VERTICAL DES TEXTURES — qui s'en charge, selon le
// navigateur.
//
// La panne vécue (24/09/2026) : depuis le décodage hors du fil principal
// (createImageBitmap, 12/09), les textures s'envoyaient au GPU avec
// UNPACK_FLIP_Y en croyant le retournement « le même partout ». Chromium
// l'IGNORE pour un ImageBitmap (mesuré : une image 1×2 rouge en haut, bleue
// en bas, rend sa rangée v = 0 ROUGE — non retournée ; la même via <img>,
// BLEUE). Tout ce qui n'est pas symétrique s'affichait à l'envers : les
// décalques, les planches animées, les deux rangées de l'atlas des parois
// échangées, et l'atlas de la conduite d'ammoniac lu cadre pour cadre au
// mauvais endroit — une bouillie de pixels.
//
// Plutôt que de parier sur un navigateur, on SONDE une fois : le moteur
// essaie chaque façon de retourner un bitmap et garde la première qui rend
// l'image retournée ; aucune ne marche → l'<img>, que WebGL retourne partout.

/** Qui retourne l'image : WebGL (UNPACK_FLIP_Y sur le bitmap), le bitmap
 *  lui-même (imageOrientation: 'flipY'), ou personne — on repasse par l'<img>. */
export type Retournement = 'gl' | 'bitmap' | 'img'

/** `essai(mode)` téléverse une image témoin par la voie `mode` et dit si elle
 *  arrive retournée. Un essai qui échoue (rejet) compte pour un non. */
export async function sondeRetournement(
  essai: (mode: 'gl' | 'bitmap') => Promise<boolean>,
): Promise<Retournement> {
  for (const mode of ['gl', 'bitmap'] as const) {
    try {
      if (await essai(mode)) return mode
    } catch {
      // la voie n'existe pas ici (option inconnue, bitmap refusé) : suivante
    }
  }
  return 'img'
}
