// LES PLANCHES DE VUES — l'animation des décalques, sans une ligne de shader.
//
// Le jeu est un fluide où tout bouge sauf le décor ; un décalque fixe posé
// sur une eau vivante se lit comme un autocollant. La forme la moins chère
// après le shader, c'est la planche : UNE image, les vues côte à côte dans
// une bande horizontale, et le moteur y puise la vue du moment. L'éclat de
// mémoire (metaAssets.vuesEclat) fait déjà ainsi ; ici c'est la même idée
// pour les pièces WebGL : `<fichier>-anime.webp` posé à côté de
// `<fichier>.webp`, et la pièce s'anime — absent, elle reste fixe.
//
// PAS DE MANIFESTE, PAS DE NOMBRE DANS LE NOM. Le nombre de vues se déduit
// du rapport entre la bande et l'image fixe : une bande de 4096×512 à côté
// d'une fixe de 1024×1024 fait 8 vues de 512×512. Une bande dont le rapport
// ne tombe pas sur un entier est refusée (1 vue : l'image fixe) — un
// fichier mal fabriqué ne fait pas défiler des demi-vues.
//
// LA LISTE DES PLANCHES LIVRÉES vient du glob de Vite, comme le catalogue
// des images (assetsLivres.ts) : le moteur ne demande que ce qui existe.
// Sans ça, quatorze sortes de décalques feraient quatorze requêtes en 404
// à chaque démarrage, pour tous les joueurs.

/** La cadence d'une planche : douze vues par seconde — celle du dessin
 *  animé « sur deux », assez pour une vanne qui tourne ou une vapeur qui
 *  sort, et une bande de 8 vues ne pèse rien de plus qu'une image. */
export const IPS_PLANCHE = 12

/** La largeur maximale d'une bande : 4096 est le plancher de
 *  MAX_TEXTURE_SIZE sur les téléphones encore en service. Au-delà, la
 *  texture ne se charge pas — la pièce disparaîtrait au lieu de s'animer. */
export const LARGEUR_PLANCHE_MAX = 4096

/** Le nombre de vues d'une bande, déduit de son rapport et de celui de
 *  l'image fixe. 1 quand rien ne colle : la bande est ignorée. */
export function vuesPlanche(
  largeurPlanche: number,
  hauteurPlanche: number,
  largeurFixe: number,
  hauteurFixe: number,
): number {
  if (!(hauteurPlanche > 0) || !(largeurFixe > 0) || !(hauteurFixe > 0)) return 1
  const rapport = largeurPlanche / hauteurPlanche / (largeurFixe / hauteurFixe)
  const n = Math.round(rapport)
  // à 0,05 près, en absolu : une vue redimensionnée en pixels entiers ne
  // tombe pas toujours juste (10 vues de 409×614 donnent 9,99), mais une
  // bande de 5,9 vues est un fichier mal taillé — et une tolérance en
  // proportion de n laissait passer celle-là
  if (n < 2 || Math.abs(rapport - n) > 0.05) return 1
  return n
}

/** La vue du moment : le temps découpé à la cadence, modulo les vues, avec
 *  un décalage — deux pièces identiques posées côte à côte ne doivent pas
 *  tourner à l'unisson, c'est ce qui trahit la répétition. */
export function vueCourante(timeSec: number, vues: number, decalage = 0, ips = IPS_PLANCHE): number {
  if (vues <= 1) return 0
  const k = Math.floor(timeSec * ips) + decalage
  return ((k % vues) + vues) % vues
}

/** Le décalage d'une pièce depuis sa position : stable d'une image à
 *  l'autre (la pièce ne bouge pas), différent d'une pièce à l'autre. */
export function decalageDe(x: number, y: number): number {
  return Math.abs(Math.floor(x * 0.37 + y * 0.53))
}

// Les clés du glob suffisent : Vite les résout à la compilation, sans
// importer une seule image (elles sont servies depuis public/).
const PLANCHES = import.meta.glob('../../public/assets/*-anime.webp')

/** Les noms de fichiers (sans `-anime.webp`) des planches livrées. */
export function planchesLivrees(): Set<string> {
  const out = new Set<string>()
  for (const cle of Object.keys(PLANCHES)) {
    const m = /\/([^/]+)-anime\.webp$/.exec(cle)
    if (m) out.add(m[1])
  }
  return out
}
