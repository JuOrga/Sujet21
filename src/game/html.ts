// L'ÉCHAPPEMENT HTML de la maison, en un seul endroit.
//
// Le jeu peint ses écrans en `innerHTML` avec des gabarits. Tant que le
// texte interpolé vient du code, c'est sans conséquence ; dès qu'il vient
// du MAGASIN PARTAGÉ (le nom d'un tableau, l'auteur d'une cinématique, le
// texte d'une carte de récompense publiée), un `<img onerror=…>` glissé
// dans le champ s'exécute chez chaque visiteur, sur l'origine du site —
// avec la main sur toutes les écritures et sur la sauvegarde locale.
// Relevé le 07/09 : six sites l'oubliaient. Ce module est là pour qu'il
// n'y ait plus qu'une fonction à importer, et un test qui les recense.
//
// Texte ET attributs : le guillemet aussi, sinon un code de biome qui en
// porte un casse un `value="…"`.

export function htmlSafe(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
