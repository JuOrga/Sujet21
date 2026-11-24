// LE DÉFILEMENT D'UNE LIGNE QUI DÉBORDE — la barre d'outils de l'atelier.
// À part de l'éditeur, sans dépendance : le banc le charge seul dans une
// page et le pilote à la vraie souris (le jeu entier ne s'ouvre pas en
// navigateur sans écran).

/** LE DÉFILEMENT DE LA LIGNE D'OUTILS, pour toutes les mains : les
 *  flèches ‹ › (la souris sans molette horizontale, la manette) qui
 *  s'éteignent au bout de la ligne, et le GLISSER à la souris — attraper
 *  la ligne et la tirer, comme au doigt ; passé 6 px, le geste défile et
 *  le clic qui suivrait est avalé (on ne choisit pas un outil en tirant). */
export function defileLigne(dock: HTMLElement, ligne: HTMLElement): void {
  const fleches = Array.from(dock.querySelectorAll<HTMLButtonElement>('[data-fleche]'))
  const majFleches = (): void => {
    const max = ligne.scrollWidth - ligne.clientWidth
    for (const f of fleches) {
      const sens = Number(f.dataset.fleche)
      f.disabled = max <= 1 || (sens < 0 ? ligne.scrollLeft <= 1 : ligne.scrollLeft >= max - 1)
    }
  }
  for (const f of fleches) {
    f.addEventListener('click', () => {
      ligne.scrollBy({ left: Number(f.dataset.fleche) * ligne.clientWidth * 0.8, behavior: 'smooth' })
    })
  }
  // la molette verticale fait défiler la ligne de côté
  ligne.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || ligne.scrollWidth <= ligne.clientWidth) return
      ligne.scrollLeft += e.deltaY
      e.preventDefault()
    },
    { passive: false },
  )
  ligne.addEventListener('scroll', majFleches, { passive: true })
  requestAnimationFrame(majFleches)
  let prise: { x: number; gauche: number; tire: boolean } | null = null
  ligne.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    prise = { x: e.clientX, gauche: ligne.scrollLeft, tire: false }
  })
  ligne.addEventListener('pointermove', (e) => {
    if (!prise) return
    const dx = e.clientX - prise.x
    if (!prise.tire && Math.abs(dx) < 6) return
    prise.tire = true
    ligne.scrollLeft = prise.gauche - dx
  })
  const lache = (): void => {
    // le clic qui suit un glisser ne choisit pas d'outil
    if (prise?.tire) ligne.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true })
    prise = null
  }
  ligne.addEventListener('pointerup', lache)
  ligne.addEventListener('pointerleave', () => {
    prise = null
  })
}
