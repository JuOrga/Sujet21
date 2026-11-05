// LE PRÉ-RENDU DE CHROME — le jeu n'a pas à démarrer dans une page que
// personne ne regarde.
//
// La panne vécue (05/11/2026) : taper « su » dans la barre d'adresse de
// Chrome figeait le navigateur plusieurs minutes ; chez un ami, écran bleu
// de Windows. Chrome devine le site visé dès les premières lettres et le
// PRÉ-REND en coulisse — la page s'exécute en entier, invisible, avant
// qu'on ait validé. Le jeu y démarrait donc pour de bon : une quinzaine
// d'appels à /api, le noyau WASM, les textures, et surtout la compilation
// des shaders, celle qui prend « plusieurs minutes » sur certains pilotes.
// Chaque lettre de plus pouvait relancer un pré-rendu, donc une
// compilation de plus, en parallèle. Reproduit le 05/11 : Chromium sans
// outils de développement, une page qui demande le pré-rendu de « / », et
// le serveur voit passer /noyaux.wasm avec « Sec-Purpose: prefetch;
// prerender » — sans qu'aucune page ne soit affichée.
//
// Le correctif est celui que Chrome documente : tant que
// document.prerendering est vrai, on attend « prerenderingchange », qui
// tombe à l'instant où la page devient l'onglet affiché. Le pré-rendu ne
// fait plus que télécharger (index.html annonce le module du jeu en
// modulepreload) — rien ne s'exécute, rien ne se compile.

/** Ce qu'il faut du document : de quoi savoir s'il est pré-rendu, et attendre qu'il ne le soit plus. */
export interface DocumentPreRendu {
  /** Absent hors de Chrome : alors la page n'est jamais pré-rendue. */
  readonly prerendering?: boolean
  addEventListener(type: string, ecouteur: () => void, options?: { once?: boolean }): void
}

/** Se résout dès que la page est vraiment affichée — tout de suite si elle l'est déjà. */
export function apresActivation(doc: DocumentPreRendu): Promise<void> {
  if (!doc.prerendering) return Promise.resolve()
  return new Promise((resoudre) => {
    doc.addEventListener('prerenderingchange', () => resoudre(), { once: true })
  })
}
