// ---- LES OBJETS DE LA CÉRÉMONIE --------------------------------------------
// Les sceaux de rang, les cuves (bonbonne, réserve, maîtrise), l'anneau et les
// scènes de fin sont rendus dans Blender. Ce module dit où ils sont et
// comment on les assemble ; la cérémonie (main.ts) ne connaît que lui.

import type { Rang } from './ceremonie'

export const SCEAUX_URL = '/assets/ceremonie-sceaux.webp' // 3 × 2 cases de 512² : S A B C D module
export const SCEAUX_COLONNES = 3
export const ORDRE_SCEAUX: readonly (Rang | 'module')[] = ['S', 'A', 'B', 'C', 'D', 'module']

/** Le sceau d'un rang (ou du module), placé par --ic-x / --ic-y. Décoratif :
 *  la lettre du rang s'écrit à côté, en texte. */
export function sceauHTML(s: Rang | 'module'): string {
  const c = ORDRE_SCEAUX.indexOf(s)
  return `<i class="ico-sceau" style="--ic-x:${c % SCEAUX_COLONNES};--ic-y:${Math.floor(c / SCEAUX_COLONNES)}" aria-hidden="true"></i>`
}

/** Un rectangle, en FRACTIONS de l'image : il suit l'image à n'importe quelle taille. */
export interface Fenetre { x: number; y: number; l: number; h: number }

/** Une cuve en deux images : le DOS (fond, parois arrière) et le VERRE (reflets,
 *  cerclages) encadrent le liquide, qui monte dans la `liquide` fenêtre. */
export interface ObjetCuve { dos: string; verre: string; largeur: number; hauteur: number; liquide: Fenetre }

// Les valeurs sont MESURÉES dans les rendus (13/11), pas devinées : la taille
// est celle des images livrées, et la fenêtre du liquide est la boîte de ce
// qui se voit d'un liquide plein, rendu à part (la « sonde » de
// tools/images/blender/ceremonie.py, assemble_cuves). Chaque pixel de la
// fenêtre où le liquide ne se voit pas y est vérifié sous un opaque du verre :
// le rectangle ne déborde nulle part. Re-rendre une cuve, c'est recopier ici
// ce que l'assemblage imprime.
export const OBJETS: Record<'bonbonne' | 'reserve' | 'maitrise', ObjetCuve> = {
  bonbonne: {
    dos: '/assets/ceremonie-bonbonne-dos.webp',
    verre: '/assets/ceremonie-bonbonne-verre.webp',
    largeur: 512,
    hauteur: 1024,
    liquide: { x: 0.3574, y: 0.4141, l: 0.2852, h: 0.4375 },
  },
  reserve: {
    dos: '/assets/ceremonie-reserve-dos.webp',
    verre: '/assets/ceremonie-reserve-verre.webp',
    largeur: 880,
    hauteur: 1024,
    liquide: { x: 0.1398, y: 0.2334, l: 0.7205, h: 0.6309 },
  },
  maitrise: {
    dos: '/assets/ceremonie-maitrise-dos.webp',
    verre: '/assets/ceremonie-maitrise-verre.webp',
    largeur: 512,
    hauteur: 1024,
    liquide: { x: 0.2988, y: 0.1455, l: 0.4023, h: 0.7344 },
  },
}

/** La cuve assemblée : dos, LIQUIDE, verre — dans cet ordre, pour que l'eau
 *  passe derrière les reflets. Le liquide est un simple bloc (id donné par
 *  l'appelant, qui l'anime) : si les images manquent, il reste visible. */
export function cuveHTML(o: keyof typeof OBJETS, idLiquide: string): string {
  const { dos, verre, largeur, hauteur, liquide: f } = OBJETS[o]
  const pct = (v: number): string => `${+(v * 100).toFixed(3)}%`
  return (
    `<div class="mb-cuve" style="aspect-ratio:${largeur}/${hauteur}">` +
    `<img class="mb-cuve-dos" src="${dos}" alt="" draggable="false">` +
    `<div class="mb-cuve-liquide" id="${idLiquide}" style="left:${pct(f.x)};top:${pct(f.y)};width:${pct(f.l)};height:${pct(f.h)}"></div>` +
    `<img class="mb-cuve-verre" src="${verre}" alt="" draggable="false">` +
    `</div>`
  )
}

export const ANNEAU_URL = '/assets/ceremonie-anneau.webp' // 2 × 1 cases de 512² : intact, brisé

/** Où poser une case de l'anneau (512², intact ou brisé) sur la colonne de
 *  maîtrise : une boîte par siège, du palier le plus BAS au plus haut, en
 *  fractions de l'image de la colonne (carrée en pixels). L'anneau est rendu
 *  dans la même vue que la colonne, autour de son tube : posé dans sa boîte
 *  par-dessus le verre, il recouvre exactement le siège vide. Mesuré dans la
 *  scène (ceremonie.py, cuves.json), pas au jugé. */
export const ANNEAUX_MAITRISE: readonly Fenetre[] = [
  { x: 0.06, y: 0.4667, l: 0.88, h: 0.44 },
  { x: 0.06, y: 0.2686, l: 0.88, h: 0.44 },
  { x: 0.06, y: 0.0706, l: 0.88, h: 0.44 },
]
export const SCENES_FIN = { bouclee: '/assets/fin-capsule.webp', perdue: '/assets/fin-fiole-brisee.webp' } as const
