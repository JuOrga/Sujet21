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

/** Les modes. Les trois premiers RETIRENT des couches ; les `arretN`
 * gardent tout mais arrêtent le shader de composition à la fin d'un bloc. */
export type ModeSonde =
  | ''
  | 'plat'
  | 'nu'
  | 'zero'
  | 'arret1'
  | 'arret2'
  | 'arret3'
  | 'arret4'
  | 'arret5'
  | 'arret6'
  | 'boitesnu'
  | 'santex'
  | 'boites1'
  | 'boites2'
  | 'boites4'
  | 'boites8'
  | 'boites16'

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
  /** La marche du PROFIL : la composition s'arrête à la fin de ce bloc.
   * 0 = elle va jusqu'au bout, c'est-à-dire le jeu tel qu'il est. */
  arret: number
  /** Le nombre de boîtes que la COMPOSITION regarde (0 = toutes).
   *
   * Le profil a montré que tout le déficit tient dans le bloc des
   * obstacles. Reste à savoir de quoi il est fait : du NOMBRE de boîtes que
   * chaque pixel parcourt, ou du TRAVAIL que chacune lui demande. Les deux
   * appellent des correctifs sans rapport — dessiner les boîtes en
   * géométrie plutôt qu'en boucle, ou alléger ce que fait chaque boîte.
   * Une réponse linéaire au nombre désigne le premier ; une réponse plate,
   * le second.
   *
   * Le CUISEUR DE LUMIÈRE, lui, garde toutes les boîtes : sans quoi
   * l'éclairage changerait d'une marche à l'autre et on comparerait deux
   * images au lieu de deux coûts. */
  boites: number
  /** La boucle des obstacles tourne ENTIÈREMENT, mais son habillage est
   * retiré à la compilation : il ne reste que la distance et l'ombre
   * portée.
   *
   * C'est la question que ?sonde=boites1 a ouverte. Borner la boucle à UNE
   * boîte n'a rien changé — le coût ne vient donc pas du nombre de tours.
   * Reste l'autre mécanisme, celui qui a toujours expliqué pourquoi les
   * interrupteurs sont impuissants : le corps de boucle réserve ses
   * REGISTRES qu'il s'exécute ou non, l'occupation du GPU tombe, et la
   * latence des textures cesse d'être masquée. Un `if` ne rend pas un
   * registre ; un `#ifndef`, si. */
  boitesNu: boolean
  /** Aucun prélèvement de texture de MATÉRIAU : chaque matériau prend sa
   * branche procédurale, tout le reste est identique. Voir
   * masqueSansTextures dans render/variantes.ts pour ce qu'elle tranche. */
  sansTex: boolean
}

export const SONDE_ETEINTE: Sonde = {
  mode: '',
  plat: false,
  nu: false,
  zero: false,
  arret: 0,
  boites: 0,
  boitesNu: false,
  sansTex: false,
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
  const mode = new URLSearchParams(recherche).get('sonde') ?? ''
  // LE PROFIL : tout est gardé, la composition s'arrête à la fin d'un bloc.
  const marche = /^arret([1-6])$/.exec(mode)
  if (marche)
    return {
      ...SONDE_ETEINTE,
      mode: mode as ModeSonde,
      arret: Number(marche[1]),
    }
  // SANS TEXTURES : le décor procédural partout, zéro prélèvement.
  if (mode === 'santex') return { ...SONDE_ETEINTE, mode, sansTex: true }
  // L'HABILLAGE : la boucle tourne en entier, son gros corps est retiré.
  if (mode === 'boitesnu')
    return { ...SONDE_ETEINTE, mode, boitesNu: true }
  // LE COMPTE : tout est gardé, la composition ne regarde que N boîtes.
  const compte = /^boites(1|2|4|8|16)$/.exec(mode)
  if (compte)
    return {
      ...SONDE_ETEINTE,
      mode: mode as ModeSonde,
      boites: Number(compte[1]),
    }
  // LES COUCHES : chaque marche retire ce que la précédente retirait.
  if (mode !== 'plat' && mode !== 'nu' && mode !== 'zero') return SONDE_ETEINTE
  return {
    mode,
    plat: true, // les trois remplacent la composition par un aplat
    nu: mode === 'nu' || mode === 'zero',
    zero: mode === 'zero',
    arret: 0,
    boites: 0,
    boitesNu: false,
    sansTex: false,
  }
}
