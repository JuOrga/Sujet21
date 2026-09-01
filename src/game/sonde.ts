// LA SONDE DE RENDU — un escalier pour savoir où part le temps.
//
// Le rapport de performance du 01/09 (iPad Pro M1, hub) est sans ambiguïté
// sur UN point : 3,8 ms de notre JS sur des images de 32 ms, et la
// dominante « horsCpu » sur 709 images sur 709. Tout le temps est hors de
// notre code. Il ne dit pas DANS QUOI.
//
// Et les interrupteurs du voile PARAMÈTRES ne peuvent pas le dire : ce sont
// tous des uniformes. Ils sautent des branches, mais ne retirent ni un
// prélèvement de texture, ni un registre, ni une ligne du programme lié.
// « Tout désactivé » et « le shader est innocent » donnent exactement le
// même résultat — c'est ce qui a fait tourner en rond deux mesures (29/08 :
// « couper l'éclairage n'y change rien » ; 01/09 : « peut-être 2 im/s »).
//
// D'où cet escalier. Chaque marche retire UNE couche, tout le reste
// identique — même tableau, même caméra, même résolution :
//
//   plat  la composition peint un aplat, rien d'autre ne change
//         → si la cadence ne bouge pas, le shader N'EST PAS le coût
//   nu    + le calque 2D des mécanismes et les pancartes DOM retirés
//         → les couches empilées par-dessus le canvas ?
//   zero  + plus aucun rendu du tout
//         → le plafond de l'appareil, tout le reste étant égal
//
// La marche qui fait bondir la cadence nomme le coupable.

/** Les modes, du plus complet au plus dépouillé. */
export type ModeSonde = '' | 'plat' | 'nu' | 'zero'

export interface Sonde {
  /** Le mode demandé ; '' quand personne ne sonde — le cas de tous les
   * joueurs, tout le temps. */
  mode: ModeSonde
  /** La composition peint un aplat. */
  plat: boolean
  /** En plus : le calque 2D et les pancartes quittent le compositeur. */
  nu: boolean
  /** En plus : plus aucun rendu. */
  zero: boolean
}

export const SONDE_ETEINTE: Sonde = {
  mode: '',
  plat: false,
  nu: false,
  zero: false,
}

/**
 * Lit la sonde dans la requête de l'adresse (`?sonde=plat`).
 *
 * TOUT CE QUI N'EST PAS UN MODE CONNU ÉTEINT LA SONDE. C'est la règle qui
 * compte : une faute de frappe, un paramètre traînant dans un lien partagé,
 * une valeur inventée — rien de tout cela ne doit livrer le jeu en aplat
 * bleu à quelqu'un qui n'a rien demandé. Le défaut n'est pas « le mode le
 * plus proche », c'est « aucune sonde ».
 */
export function litSonde(recherche: string): Sonde {
  const mode = new URLSearchParams(recherche).get('sonde')
  if (mode !== 'plat' && mode !== 'nu' && mode !== 'zero') return SONDE_ETEINTE
  return {
    mode,
    plat: true, // les trois marches remplacent la composition
    nu: mode === 'nu' || mode === 'zero',
    zero: mode === 'zero',
  }
}
