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

// Valeurs PROVISOIRES : 512×1024 et une fenêtre de liquide au jugé. Seul le
// lot Blender les remplace, par les mesures de ses rendus — deviner la
// fenêtre ici ferait déborder l'eau du verre.
const PROVISOIRE = { largeur: 512, hauteur: 1024, liquide: { x: 0.3, y: 0.2, l: 0.4, h: 0.65 } }
export const OBJETS: Record<'bonbonne' | 'reserve' | 'maitrise', ObjetCuve> = {
  bonbonne: { dos: '/assets/ceremonie-bonbonne-dos.webp', verre: '/assets/ceremonie-bonbonne-verre.webp', ...PROVISOIRE },
  reserve: { dos: '/assets/ceremonie-reserve-dos.webp', verre: '/assets/ceremonie-reserve-verre.webp', ...PROVISOIRE },
  maitrise: { dos: '/assets/ceremonie-maitrise-dos.webp', verre: '/assets/ceremonie-maitrise-verre.webp', ...PROVISOIRE },
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
export const SCENES_FIN = { bouclee: '/assets/fin-capsule.webp', perdue: '/assets/fin-fiole-brisee.webp' } as const
