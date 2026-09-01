// D'OÙ VIENT CE PAQUET — la question qu'un rapport de performance doit
// pouvoir trancher tout seul.
//
// Le rapport cite déjà sa version (0.21.N) et sa dernière livraison. Mais
// ces deux-là se dérivent du JOURNAL : ils sont identiques sur toutes les
// branches tant qu'on n'a pas livré. Deux paquets qui ne se ressemblent en
// rien portent donc la même signature.
//
// Constaté le 01/09/2026, et c'est ce qui a coûté un A/B entier : trois
// rapports envoyés depuis un iPad après le déploiement d'une branche à
// l'essai, tous marqués « 0.21.401 · 01/09/2026 10:52 » — exactement comme
// le site en ligne. Impossible de dire lequel tournait sur quoi. Le
// commentaire du rapport disait pourtant déjà la règle : « deux rapports ne
// se comparent que s'ils disent d'où ils viennent ». Il manquait de quoi la
// tenir.
//
// Le COMMIT, lui, ne ment pas. Il est injecté à la compilation, comme le
// journal (voir bench/changelog.ts pour le même mécanisme). Le
// déploiement construit sur les machines de Vercel, où il n'y a pas de
// dépôt git : c'est le workflow qui passe la valeur. En local, git répond.

/** Le commit et la branche du paquet, injectés à la compilation. */
declare const __PROVENANCE__: { commit: string; branche: string }

// Le repli n'est pas décoratif : sans lui, tout outil qui exécute ce module
// hors de Vite (un test, un script, un éditeur) planterait sur une variable
// inconnue. « inconnu » est une réponse honnête — mieux vaut un rapport qui
// avoue son ignorance qu'un rapport qui laisse croire.
export const PROVENANCE: { commit: string; branche: string } =
  typeof __PROVENANCE__ === 'object' && __PROVENANCE__ !== null
    ? __PROVENANCE__
    : { commit: 'inconnu', branche: 'inconnue' }
