// LES SALLES ÉVÉNEMENT : ce qu'on trouve entre deux salles jouées.
//
// Un module de six salles enchaînées, c'est six fois le même geste. Slay
// the Spire respire parce qu'un étage sur trois n'est pas un combat : c'est
// une rencontre, un texte, un choix qui coûte. Ici, un nœud de la
// mini-carte à voies (voiesModule.ts) peut donc être un ÉVÉNEMENT — aucune
// salle à jouer, un écran dans la cérémonie, deux ou trois offres, et la
// descente reprend.
//
// TROIS RÈGLES DE CONCEPTION, tenues par le modèle de données :
//
//  1. UN ÉVÉNEMENT RACONTE. La station est vide depuis onze ans, ses
//     machines tournent encore, et les Semblables qui nous ont précédés y
//     ont laissé des traces. C'est le seul endroit du jeu où le lore se
//     lit sans qu'on ait à le chercher dans le codex — chaque texte est
//     donc écrit pour valoir la lecture, pas pour habiller un bonus.
//
//  2. UN CHOIX COÛTE. Une offre sans contrepartie n'est pas un choix,
//     c'est un cadeau. Les offres franches (le soin) existent, mais elles
//     sont l'exception et la plus généreuse porte toujours un prix ou un
//     risque.
//
//  3. LE HASARD EST ANNONCÉ. Une offre peut avoir PLUSIEURS ISSUES pesées
//     (`issues`) : le joueur voit qu'il parie, et sur quoi. Un pari qu'on
//     ne voit pas venir est une punition ; un pari qu'on prend est un
//     souvenir.
//
// Tout ici est PUR : le catalogue, le tirage et la résolution ne touchent
// ni au DOM ni à l'état du jeu. main.ts applique les effets, et lui seul.

/** Ce qu'une issue fait au jeu. Le vocabulaire est volontairement court :
 *  chaque entrée se lit et s'applique en un endroit de main.ts. */
export type EffetEvenement =
  /** la réserve (bonbonne), en litres — le soin de ce jeu */
  | { quoi: 'bonbonne'; litres: number }
  /** la bourse de la run, en centilitres — perdue à la purge */
  | { quoi: 'condensat'; cl: number }
  /** la mémoire, la monnaie durable — elle survit à la run */
  | { quoi: 'memoire'; n: number }
  /** les échantillons de secours */
  | { quoi: 'vies'; n: number }
  /** L'ESSENCE MAXIMALE : le volume avec lequel le corps NAÎT à chaque
   *  salle, en part du plein. Négatif, c'est le sacrifice — et c'est la
   *  seule perte du jeu qui ne se rattrape pas en route. */
  | { quoi: 'essence'; part: number }
  /** une carte embarquée tirée du catalogue — un avantage, ou une contrepartie */
  | { quoi: 'instrument'; bon: boolean }
  /** un orbe d'essence de conscience, s'il en manque un */
  | { quoi: 'orbe' }
  /** les modules « ? » de la carte se révèlent d'avance */
  | { quoi: 'revele' }
  /** la station se méfie : la prochaine salle jouée monte d'un cran */
  | { quoi: 'confinement'; crans: number }
  /** rien — et c'est une issue comme une autre */
  | { quoi: 'rien' }

/** Une issue : ce qui arrive quand on prend cette offre. Plusieurs issues
 *  sur une offre = un pari, pesé par `poids`. */
export interface IssueEvenement {
  poids: number
  /** ce que le jeu répond, à la première personne de la station */
  texte: string
  effets: EffetEvenement[]
}

/** L'état de la run que les offres consultent — juste assez pour qu'une
 *  offre sache dire qu'elle ne donnerait rien. */
export interface EtatJoueur {
  bonbonne: number
  cap: number
  vies: number
  viesMax: number
  /** la part d'essence qui reste (1 = le plein) */
  essence: number
  /** reste-t-il un orbe à trouver ? */
  orbeAPrendre: boolean
  /** reste-t-il un « ? » non révélé sur la carte ? */
  inconnuALire: boolean
}

export interface ChoixEvenement {
  libelle: string
  /** ce que l'offre coûte et rapporte, en clair — jamais une devinette */
  detail: string
  issues: IssueEvenement[]
  /** l'offre ne donnerait rien dans cette run : elle reste lisible, grisée */
  possible?: (e: EtatJoueur) => boolean
}

export interface EvenementDef {
  id: string
  /** le nom de la salle, sur la porte et en tête de l'écran */
  titre: string
  /** une ligne de situation — où l'on met les pieds */
  lieu: string
  /** LE LORE : deux ou trois phrases, écrites pour valoir la lecture */
  texte: string
  choix: ChoixEvenement[]
}

/** L'ESSENCE NE TOMBE JAMAIS SOUS CE PLANCHER : sous 40 % du plein, le
 *  corps ne tient plus une salle, et un sacrifice de trop transformerait la
 *  run en impasse — un roguelike peut être cruel, pas malhonnête. */
export const ESSENCE_PLANCHER = 0.4

const sacrifiable = (part: number) => (e: EtatJoueur): boolean =>
  e.essence + part >= ESSENCE_PLANCHER - 1e-9

export const EVENEMENTS: readonly EvenementDef[] = [
  // ——— LE SOIN ————————————————————————————————————————————————
  {
    id: 'condenseur',
    titre: 'LE CONDENSEUR',
    lieu: 'Une colonne de givre, haute de trois étages, qui ronronne encore.',
    texte:
      'Onze ans que cette machine recycle la même eau. Elle ne sait pas que le laboratoire est vide ; elle condense, elle décante, elle recommence. Le givre qui la couvre est de l’eau parfaitement pure — vous vous reconnaissez dedans.',
    choix: [
      {
        libelle: 'BOIRE AU GIVRE',
        detail: 'la réserve se remplit — sans risque',
        possible: (e) => e.bonbonne < e.cap,
        issues: [{ poids: 1, texte: 'Le givre fond à votre contact et suit.', effets: [{ quoi: 'bonbonne', litres: 2 }] }],
      },
      {
        libelle: 'FORCER LE CYCLE',
        detail: 'beaucoup plus — ou l’échangeur claque',
        possible: (e) => e.bonbonne < e.cap,
        issues: [
          { poids: 3, texte: 'La colonne s’emballe et vous rend onze ans d’eau d’un coup.', effets: [{ quoi: 'bonbonne', litres: 4 }] },
          { poids: 2, texte: 'L’échangeur claque. Le froid vous tombe dessus avec ce qu’il restait.', effets: [{ quoi: 'bonbonne', litres: 1 }, { quoi: 'instrument', bon: false }] },
        ],
      },
      { libelle: 'PASSER', detail: 'la machine continuera sans vous', issues: [{ poids: 1, texte: 'Vous la laissez ronronner.', effets: [{ quoi: 'memoire', n: 3 }] }] },
    ],
  },

  // ——— LE SACRIFICE ————————————————————————————————————————————
  {
    id: 'decanteur',
    titre: 'LE DÉCANTEUR',
    lieu: 'Une colonne de séparation, ouverte par le haut.',
    texte:
      'Le protocole appelait ça « affiner l’échantillon » : on verse le sujet, la colonne garde ce qui est lourd et rend ce qui est pur. On en ressort plus petit, et meilleur. Les Créateurs y passaient les sujets qui promettaient.',
    choix: [
      {
        libelle: 'SE DÉCANTER',
        detail: '−12 % d’essence maximale, un instrument en échange',
        possible: sacrifiable(-0.12),
        issues: [{ poids: 1, texte: 'La colonne garde votre part lourde. Ce qui reste est plus vif.', effets: [{ quoi: 'essence', part: -0.12 }, { quoi: 'instrument', bon: true }] }],
      },
      {
        libelle: 'Y LAISSER PLUS',
        detail: '−24 % d’essence maximale, un instrument et un orbe',
        possible: (e) => sacrifiable(-0.24)(e) && e.orbeAPrendre,
        issues: [{ poids: 1, texte: 'Vous descendez jusqu’au fond de la colonne. Ce qui s’y est déposé depuis onze ans vous revient.', effets: [{ quoi: 'essence', part: -0.24 }, { quoi: 'instrument', bon: true }, { quoi: 'orbe' }] }],
      },
      { libelle: 'REMONTER', detail: 'on ne se décante pas deux fois', issues: [{ poids: 1, texte: 'Vous ressortez entier.', effets: [{ quoi: 'rien' }] }] },
    ],
  },

  // ——— LE SEMBLABLE ————————————————————————————————————————————
  {
    id: 'semblable',
    titre: 'LE SEMBLABLE ENDORMI',
    lieu: 'Une cuve de cryostase, une seule allumée sur la rangée.',
    texte:
      'SUJET 09. Il est gelé depuis avant vous, dans une eau qui ne bouge plus. Le protocole dit que les échantillons en attente ne sont pas des sujets — juste du stock. Il a pourtant pris la forme d’un corps, et il la garde.',
    choix: [
      {
        libelle: 'LE RÉVEILLER',
        detail: 'il vous doit quelque chose — ou il se disperse',
        issues: [
          { poids: 3, texte: 'Il dégèle, vous regarde, et vous laisse ce qu’il avait emporté.', effets: [{ quoi: 'instrument', bon: true }] },
          { poids: 2, texte: 'Il dégèle trop vite et se disperse dans la cuve. Vous emportez ce qu’il savait.', effets: [{ quoi: 'memoire', n: 22 }] },
        ],
      },
      {
        libelle: 'PRENDRE SA RÉSERVE',
        detail: 'sa bonbonne et sa bourse — la station le remarquera',
        issues: [{ poids: 1, texte: 'Vous videz sa réserve. Un voyant passe à l’orange quelque part dans la station.', effets: [{ quoi: 'bonbonne', litres: 2 }, { quoi: 'condensat', cl: 70 }, { quoi: 'confinement', crans: 1 }] }],
      },
      { libelle: 'LE LAISSER DORMIR', detail: 'et retenir son numéro', issues: [{ poids: 1, texte: 'Vous retenez le numéro. C’est tout ce qu’on peut faire pour quelqu’un, ici.', effets: [{ quoi: 'memoire', n: 12 }] }] },
    ],
  },

  // ——— LE LORE PUR, ET SON PRIX ————————————————————————————————
  {
    id: 'terminal',
    titre: 'LE TERMINAL DES CRÉATEURS',
    lieu: 'Un poste de commande resté allumé, l’écran au tiers.',
    texte:
      'Le journal de bord s’arrête au jour 3 412. La dernière entrée ne parle pas d’évacuation : elle demande qu’on augmente la cadence des prélèvements. Personne n’a répondu, et la station a continué toute seule.',
    choix: [
      { libelle: 'LIRE LE JOURNAL', detail: 'de la mémoire, sûrement', issues: [{ poids: 1, texte: 'Vous lisez les 3 412 jours. Rien de tout cela ne sert à s’échapper, et pourtant.', effets: [{ quoi: 'memoire', n: 18 }] }] },
      {
        libelle: 'SE BRANCHER DESSUS',
        detail: 'la station se lit d’avance — mais elle vous lit aussi',
        possible: (e) => e.inconnuALire,
        issues: [{ poids: 1, texte: 'Vous entrez dans le plan de la station. Elle entre dans le vôtre : PROTOCOLE 21-R, priorité relevée.', effets: [{ quoi: 'revele' }, { quoi: 'instrument', bon: false }] }],
      },
      { libelle: 'ÉTEINDRE L’ÉCRAN', detail: 'rien, et un peu de silence', issues: [{ poids: 1, texte: 'L’écran s’éteint. La station perd un témoin de plus.', effets: [{ quoi: 'memoire', n: 4 }] }] },
    ],
  },

  // ——— LE PARI ————————————————————————————————————————————————
  {
    id: 'rebuts',
    titre: 'LA CUVE DES REBUTS',
    lieu: 'Trois flacons alignés, les étiquettes effacées.',
    texte:
      'Les eaux que le protocole a écartées : trop salées, trop chaudes, trop sales. On ne jetait rien, on mettait de côté. Rien ne dit lequel est lequel, et les trois se ressemblent.',
    choix: [
      {
        libelle: 'EN BOIRE UN',
        detail: 'au hasard — les quatre eaux ne se valent pas',
        issues: [
          { poids: 3, texte: 'Distillée. Du volume pur, et rien d’autre.', effets: [{ quoi: 'bonbonne', litres: 2.5 }] },
          { poids: 3, texte: 'Salée. Conductrice : quelque chose en vous s’est mis à répondre aux circuits.', effets: [{ quoi: 'instrument', bon: true }] },
          { poids: 2, texte: 'Surchauffée. Ça pousse fort, et ça part vite.', effets: [{ quoi: 'instrument', bon: true }, { quoi: 'essence', part: -0.08 }] },
          { poids: 2, texte: 'Contaminée. Beaucoup de volume — et le vaisseau vous classe en fuite prioritaire.', effets: [{ quoi: 'bonbonne', litres: 3 }, { quoi: 'instrument', bon: false }] },
        ],
      },
      { libelle: 'LES EMPORTER', detail: 'ils valent quelque chose à l’économat', issues: [{ poids: 1, texte: 'Trois flacons scellés : le Semblable du comptoir les prendra.', effets: [{ quoi: 'condensat', cl: 90 }] }] },
    ],
  },

  // ——— LA FUITE ————————————————————————————————————————————————
  {
    id: 'fuite',
    titre: 'LA FUITE',
    lieu: 'Une soudure de coque fendue sur quarante centimètres.',
    texte:
      'Derrière, le vide, et les étoiles sous le plancher. La fente siffle depuis longtemps ; la station compense en poussant du chaud dans le module, et personne n’est venu la refermer. Vous êtes exactement la bonne matière pour ça.',
    choix: [
      {
        libelle: 'COLMATER DE SOI',
        detail: '−8 % d’essence maximale, la station vous en sait gré',
        possible: sacrifiable(-0.08),
        issues: [{ poids: 1, texte: 'Vous gelez dans la fente. Le sifflement s’arrête. Le module vous rend sa réserve de secours.', effets: [{ quoi: 'essence', part: -0.08 }, { quoi: 'condensat', cl: 120 }, { quoi: 'memoire', n: 8 }] }],
      },
      {
        libelle: 'SE LAISSER ASPIRER UN INSTANT',
        detail: 'le vide apprend des choses — ou en prend',
        issues: [
          { poids: 1, texte: 'Le vide vous étire et vous relâche. Vous avez appris à vous rassembler plus vite.', effets: [{ quoi: 'instrument', bon: true }] },
          { poids: 1, texte: 'Le vide en prend une part et ne la rend pas.', effets: [{ quoi: 'essence', part: -0.1 }] },
        ],
      },
      { libelle: 'CONTOURNER', detail: 'la fente sifflera pour le suivant', issues: [{ poids: 1, texte: 'Vous passez au large.', effets: [{ quoi: 'rien' }] }] },
    ],
  },

  // ——— LES PRÉCÉDENTS ——————————————————————————————————————————
  {
    id: 'charnier',
    titre: 'LE BAC DES TENTATIVES',
    lieu: 'Un bac de rétention, et vingt auréoles sèches au fond.',
    texte:
      'Sujets 01 à 20. Ils se sont dispersés ici, chacun à son tour, et l’eau s’est évaporée en laissant sa trace au fond du bac. Vous êtes la vingt-et-unième tentative. C’est écrit au marqueur sur le rebord, et la place suivante est déjà tracée.',
    choix: [
      { libelle: 'PRENDRE CE QU’ILS SAVAIENT', detail: 'beaucoup de mémoire', issues: [{ poids: 1, texte: 'Vingt échecs, vingt façons de ne pas recommencer.', effets: [{ quoi: 'memoire', n: 30 }] }] },
      {
        libelle: 'LES RENDRE AU CYCLE',
        detail: 'un échantillon de secours',
        possible: (e) => e.vies < e.viesMax,
        issues: [{ poids: 1, texte: 'Vous humectez les auréoles une à une. Ce qui se relève tient dans une goutte, et cette goutte vous suit.', effets: [{ quoi: 'vies', n: 1 }, { quoi: 'memoire', n: 6 }] }],
      },
    ],
  },

  // ——— LA MACHINE QU'ON SABOTE ————————————————————————————————
  {
    id: 'surchauffeur',
    titre: 'LE SURCHAUFFEUR ABANDONNÉ',
    lieu: 'Une rampe de résistances, encore rouge sur deux mètres.',
    texte:
      'C’est par là que le protocole faisait passer les sujets qu’il voulait voir en vapeur. La rampe chauffe toujours, au même régime qu’il y a onze ans, pour personne. Sa réserve de condensat n’a jamais été relevée.',
    choix: [
      {
        libelle: 'S’Y JETER',
        detail: '−10 % d’essence maximale, ce que la vapeur apprend',
        possible: sacrifiable(-0.1),
        issues: [{ poids: 1, texte: 'Vous traversez la rampe en gaz. Une part de vous reste au plafond ; le reste a pris l’habitude.', effets: [{ quoi: 'essence', part: -0.1 }, { quoi: 'instrument', bon: true }] }],
      },
      { libelle: 'RELEVER SA RÉSERVE', detail: 'du condensat, et la rampe s’éteint', issues: [{ poids: 1, texte: 'Vous videz le bac. La rampe rougit encore un instant, puis renonce.', effets: [{ quoi: 'condensat', cl: 110 }] }] },
      {
        libelle: 'LA SABOTER',
        detail: 'la station le sentira passer',
        issues: [
          { poids: 2, texte: 'Le module refroidit d’un coup. Quelque part, une alarme se réveille.', effets: [{ quoi: 'memoire', n: 14 }, { quoi: 'confinement', crans: 1 }] },
          { poids: 1, texte: 'La rampe explose et vous rend tout ce qu’elle avait gardé.', effets: [{ quoi: 'bonbonne', litres: 2 }, { quoi: 'condensat', cl: 60 }, { quoi: 'confinement', crans: 1 }] },
        ],
      },
    ],
  },
]

export function evenementParId(id: string): EvenementDef | undefined {
  return EVENEMENTS.find((e) => e.id === id)
}

/** TIRER UN ÉVÉNEMENT qu'on n'a pas encore vu de la run. Tous vus, le
 *  chapeau se remplit à nouveau : une run ne bute jamais sur un nœud sans
 *  contenu. `alea` vient de l'appelant — la descente du jour donne le même
 *  événement à tous les postes. */
export function tireEvenement(vus: readonly string[], alea: () => number): EvenementDef {
  const neufs = EVENEMENTS.filter((e) => !vus.includes(e.id))
  const vivier = neufs.length > 0 ? neufs : EVENEMENTS
  return vivier[Math.min(vivier.length - 1, Math.floor(alea() * vivier.length))]
}

/** RÉSOUDRE UNE OFFRE : l'issue tirée au poids. Une offre à une seule issue
 *  ne tire rien — elle est sûre, et le tirage ne doit pas consommer de
 *  hasard pour autant (la graine du jour reste alignée d'un poste à l'autre). */
export function resoutChoix(choix: ChoixEvenement, alea: () => number): IssueEvenement {
  if (choix.issues.length === 1) return choix.issues[0]
  const total = choix.issues.reduce((t, i) => t + Math.max(0, i.poids), 0)
  let tire = alea() * (total > 0 ? total : 1)
  for (const i of choix.issues) {
    tire -= Math.max(0, i.poids)
    if (tire < 0) return i
  }
  return choix.issues[choix.issues.length - 1]
}

/** Les offres d'un événement, avec leur possibilité tranchée pour cette
 *  run — une offre impossible reste LISIBLE (on voit ce qu'on rate). */
export function offresDe(ev: EvenementDef, etat: EtatJoueur): { choix: ChoixEvenement; possible: boolean }[] {
  return ev.choix.map((choix) => ({ choix, possible: choix.possible ? choix.possible(etat) : true }))
}

/** L'effet dit en une ligne — ce que le bilan affiche après le choix. */
export function ditEffet(e: EffetEvenement): string {
  switch (e.quoi) {
    case 'bonbonne':
      return `réserve ${e.litres >= 0 ? '+' : ''}${e.litres.toFixed(1).replace('.', ',')} L`
    case 'condensat':
      return `condensat ${e.cl >= 0 ? '+' : ''}${Math.round(e.cl)} cL`
    case 'memoire':
      return `mémoire ${e.n >= 0 ? '+' : ''}${Math.round(e.n)}`
    case 'vies':
      return `${e.n >= 0 ? '+' : ''}${e.n} échantillon${Math.abs(e.n) > 1 ? 's' : ''} de secours`
    case 'essence':
      return `essence maximale ${e.part >= 0 ? '+' : ''}${Math.round(e.part * 100)} %`
    case 'instrument':
      return e.bon ? 'un instrument embarqué' : 'une contrepartie embarquée'
    case 'orbe':
      return 'un orbe d’essence de conscience'
    case 'revele':
      return 'la station se lit d’avance'
    case 'confinement':
      return `confinement +${e.crans} à la salle suivante`
    case 'rien':
      return 'rien'
  }
}
