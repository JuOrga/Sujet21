// AU DOIGT, UNE PORTE SE VISE PUIS S'OUVRE. Sans survol, le premier toucher
// ouvrait tout de suite : la mini-carte à voies n'avait jamais le temps de
// dire ce que la porte fermait (revue du 25/09). Le premier toucher ARME la
// porte — l'aperçu s'allume, « TOUCHEZ ENCORE » —, le second l'ouvre.
// Souris, clavier et manette : inchangés.
//
// Hors de main.ts pour se tester sans navigateur : la porte n'est vue qu'à
// travers ce dont l'armement a besoin.

/** Ce que l'armement touche d'une porte (un HTMLButtonElement le fournit). */
export interface PorteArmable {
  classList: { contains(c: string): boolean; add(c: string): void; remove(c: string): void }
  addEventListener(type: 'pointerdown', f: (e: { pointerType: string }) => void): void
  dispatchEvent(e: Event): boolean
  querySelector(sel: string): { textContent: string | null } | null
  parentElement: { querySelectorAll(sel: string): Iterable<PorteArmable> } | null
}

export const ARMEE = 'mb-armee'
export const TEXTE_ENTRER = 'ENTRER ▸'
export const TEXTE_ARMEE = 'TOUCHEZ ENCORE ▸'

/** Branche l'armement sur une porte ; rend la garde du clic : true quand le
 *  clic doit OUVRIR, false quand il vient d'armer. `actif` faux (porte sans
 *  mini-carte à voies) : chaque clic ouvre, comme avant. */
export function armeAuToucher(porte: PorteArmable, actif: boolean): () => boolean {
  if (!actif) return () => true
  let doigt = false
  porte.addEventListener('pointerdown', (e) => (doigt = e.pointerType === 'touch'))
  return () => {
    // LE DOIGT NE VAUT QUE POUR SON CLIC : gardé, il faisait armer au lieu
    // d'ouvrir une validation au clavier ou à la manette qui suivait un
    // toucher sur la même porte (revue de la PR, 25/09)
    const auDoigt = doigt
    doigt = false
    if (!auDoigt || porte.classList.contains(ARMEE)) return true
    for (const autre of porte.parentElement?.querySelectorAll(`.${ARMEE}`) ?? []) desarme(autre)
    porte.classList.add(ARMEE)
    const entrer = porte.querySelector('.mb-porte-entrer')
    if (entrer) entrer.textContent = TEXTE_ARMEE
    // le doigt levé a déjà envoyé pointerleave : l'aperçu se rallume
    porte.dispatchEvent(new Event('pad-vise'))
    return false
  }
}

function desarme(p: PorteArmable): void {
  p.classList.remove(ARMEE)
  const e = p.querySelector('.mb-porte-entrer')
  if (e) e.textContent = TEXTE_ENTRER
  p.dispatchEvent(new Event('pad-quitte'))
}
