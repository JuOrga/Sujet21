// LE PROFIL D'UN JOUEUR — son nom et sa couleur.
//
// Rien de plus : pas de compte, pas de serveur. Le profil vit dans le
// navigateur de chacun, et s'échange au début de la partie par un message
// que le relais transmet tel quel. Tout ce qui ARRIVE de l'autre joueur est
// remis au propre ici avant d'être montré : ce module est pur, et testé.

/** Les couleurs offertes (rouge, vert, bleu, de 0 à 1). Les quatre premières
 *  sont celles des débuts du multi ; le bleu est celui du spécimen du jeu, et
 *  l'ambre s'en distingue aussi pour un œil daltonien (teinte ET clarté). */
export const PALETTE: readonly [number, number, number][] = [
  [0.39, 0.72, 0.9],
  [0.96, 0.66, 0.28],
  [0.25, 0.84, 0.61],
  [0.71, 0.55, 0.95],
  [0.95, 0.47, 0.64],
  [0.93, 0.38, 0.32],
]
export const NOMS_COULEURS: readonly string[] = ['bleu', 'ambre', 'vert', 'violet', 'rose', 'rouge']
/** Un pseudo tient en douze caractères : il s'affiche dans une jauge. */
export const PSEUDO_MAX = 12

export interface Profil {
  /** Vide : le joueur n'a pas dit son nom (on écrira « VOUS », « VOTRE AMI »). */
  pseudo: string
  /** Un rang de la PALETTE. */
  couleur: number
}

export const PROFIL_NEUTRE: Profil = { pseudo: '', couleur: 0 }

/** Un pseudo remis au propre : sans retours à la ligne ni caractères de
 *  commande, espaces resserrés, douze caractères au plus. */
export function nettoiePseudo(brut: unknown): string {
  if (typeof brut !== 'string') return ''
  // caractère par caractère (un émoji en est UN) : les caractères de
  // commande, les espaces invisibles et les marques de sens d'écriture
  // deviennent des espaces
  let filtre = ''
  for (const c of brut) {
    const k = c.codePointAt(0) ?? 0
    const invisible = k < 0x20 || (k >= 0x7f && k <= 0x9f) || (k >= 0x200b && k <= 0x200f) || (k >= 0x2028 && k <= 0x202f) || k === 0xfeff
    filtre += invisible ? ' ' : c
  }
  const propre = filtre.replace(/ +/g, ' ').trim()
  return [...propre].slice(0, PSEUDO_MAX).join('').trim()
}

/** Un profil lu d'où qu'il vienne (le navigateur, l'autre joueur) : tout ce
 *  qui n'est pas ce qu'on attend devient la valeur neutre. */
export function litProfil(brut: unknown): Profil {
  const b = (typeof brut === 'object' && brut !== null ? brut : {}) as { pseudo?: unknown; couleur?: unknown }
  const c = typeof b.couleur === 'number' && Number.isInteger(b.couleur) && b.couleur >= 0 && b.couleur < PALETTE.length ? b.couleur : 0
  return { pseudo: nettoiePseudo(b.pseudo), couleur: c }
}

/** La couleur de chaque joueur dans la partie : l'HÔTE garde la sienne ;
 *  l'invité aussi, sauf s'il a choisi la même — il prend alors la suivante.
 *  Les deux machines font ce calcul et tombent sur le même résultat. */
export function couleursDeLaPartie(hote: Profil, invite: Profil): [number, number] {
  const h = hote.couleur
  const i = invite.couleur === h ? (h + 1) % PALETTE.length : invite.couleur
  return [h, i]
}

const CLE = 'sujet21-multi-profil'

/** Le profil gardé dans ce navigateur (neutre s'il n'y en a pas, ou si le
 *  stockage est fermé : navigation privée, réglage du navigateur). */
export function chargeProfil(): Profil {
  try {
    const brut = localStorage.getItem(CLE)
    return brut ? litProfil(JSON.parse(brut)) : { ...PROFIL_NEUTRE }
  } catch {
    return { ...PROFIL_NEUTRE }
  }
}

export function gardeProfil(p: Profil): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(litProfil(p)))
  } catch {
    // sans gravité : le profil vaudra pour cette visite seulement
  }
}
