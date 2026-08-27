// Le CAHIER DES RÈGLES de la génération procédurale — la base de travail
// pour AMÉLIORER OU REFAIRE le générateur. Deux natures de règles :
//
//   · EN PLACE : ce que le générateur (generateur.ts, figures.ts, voie.ts)
//     fait réellement aujourd'hui, chiffres à l'appui — annotables depuis
//     l'écran « LE CAHIER DES RÈGLES » (une note par règle, partagée) ;
//   · PROPOSÉE : ce qu'un level designer attend d'un bon générateur et que
//     le nôtre ne fait pas encore — le carnet de commandes de la refonte.
//
// À quoi ça sert : les concepteurs annotent et AJOUTENT des règles en
// texte libre depuis le jeu (Steam Deck, tablette) ; les notes et ajouts
// vivent dans le magasin partagé (/api/regles) — l'implémentation vient
// les y relire. Le catalogue, lui, est FIGÉ dans le code : une règle en
// place qui change se réécrit ici, avec la modification qui la change.

export type EtatRegle = 'en-place' | 'proposee'

export interface RegleGen {
  /** identité stable — les notes s'y accrochent, ne jamais renommer */
  id: string
  famille: string
  titre: string
  texte: string
  etat: EtatRegle
}

export interface FamilleRegles {
  id: string
  nom: string
  /** ce que la famille couvre, en une ligne */
  propos: string
}

export const FAMILLES_REGLES: readonly FamilleRegles[] = [
  {
    id: 'contrat',
    nom: 'LE CONTRAT',
    propos: 'ce qu’une salle générée jure avant d’exister',
  },
  {
    id: 'structure',
    nom: 'LA STRUCTURE',
    propos: 'topologie, voies, repères — le squelette',
  },
  {
    id: 'rampe',
    nom: 'LA RAMPE',
    propos: 'difficulté, apprentissage, rythme de la descente',
  },
  {
    id: 'lisibilite',
    nom: 'LA LISIBILITÉ',
    propos: 'ce que le premier regard doit comprendre',
  },
  {
    id: 'habillage',
    nom: "L'HABILLAGE",
    propos: 'décor, dangers, lumière, cachettes',
  },
  {
    id: 'figures',
    nom: 'LES FIGURES',
    propos: 'les tableaux-glyphes, la leçon des faits main',
  },
] as const

export const CATALOGUE_REGLES: readonly RegleGen[] = [
  // ---- LE CONTRAT ---------------------------------------------------------
  {
    id: 'preuve-avant-livraison',
    famille: 'contrat',
    etat: 'en-place',
    titre: 'Une salle est prouvée, ou elle n’existe pas',
    texte:
      'La traversée spawn → sas se démontre par parcours en largeur avec la ' +
      'marge du corps (40 u) ; chaque porte asservie est prouvée OUVRABLE par ' +
      'le vrai traceur de faisceau, un corps synthétique (glace, vapeur, eau) ' +
      'posé là où le joueur se tiendra. Un tirage raté se re-tire (jusqu’à ' +
      '60 essais) — jamais livré cassé.',
  },
  {
    id: 'determinisme',
    famille: 'contrat',
    etat: 'en-place',
    titre: 'Même graine, même salle',
    texte:
      'Le générateur est déterministe : le code « G-… » est une identité ' +
      'rejouable au caractère près, qui se partage, se retape, se retouche à ' +
      'l’éditeur. Les options de génération voyagent DANS le code ' +
      '(suffixe « ~XXX ») : elles font partie de l’identité.',
  },
  {
    id: 'cahier-des-charges',
    famille: 'contrat',
    etat: 'en-place',
    titre: 'Le code décrit, la variante identifie',
    texte:
      'Le code MMD (moment · mécanique · difficulté) est un CAHIER DES ' +
      'CHARGES : il décrit une salle, il n’en identifie pas une. La ' +
      'variante (« -K7 ») fait l’identité. La mécanique choisit les ' +
      'familles de franchissements ; le contrat se joue à l’entrée du sas.',
  },
  {
    id: 'enigme-vivante',
    famille: 'contrat',
    etat: 'en-place',
    titre: 'Aucune pastille allumée sans le joueur',
    texte:
      'L’état de base se vérifie émetteur par émetteur : toute pastille ' +
      'allumée sans le joueur est une énigme morte (hors barrière NOR, ' +
      'allumée d’office par contrat). Un miroir ne sert que SA pastille ; ' +
      'une porte sans énigme prouvée est refusée.',
  },
  // ---- LA STRUCTURE -------------------------------------------------------
  {
    id: 'chaine-avant-geometrie',
    famille: 'structure',
    etat: 'en-place',
    titre: 'La chaîne d’intentions précède la géométrie',
    texte:
      'On tire d’abord la SUITE DES FRANCHISSEMENTS (évent, rideau, ' +
      'membrane, énigmes au laser), puis on habille chaque maillon en ' +
      'géométrie. La soupe aléatoire naît quand la géométrie précède ' +
      'l’intention.',
  },
  {
    id: 'topologie-a-boucles',
    famille: 'structure',
    etat: 'en-place',
    titre: 'Des boucles et des culs-de-sac, pas un couloir',
    texte:
      'Couloir 1×N, grille 2×2 ou 2×3, ou L au coin muré ; les rangées se ' +
      'relient par des planchers percés — d’où des BOUCLES (plusieurs ' +
      'voies mènent au sas) et des embranchements en cul-de-sac où nichent ' +
      'les cachettes.',
  },
  {
    id: 'sas-unique',
    famille: 'structure',
    etat: 'en-place',
    titre: 'L’entrée du sas est unique et porte le contrat',
    texte:
      'Quelle que soit la voie prise, on finit par l’entrée du sas — ' +
      'coin de grille, jamais d’ouverture verticale dans sa colonne — et ' +
      'elle porte la mécanique obligatoire du code. En mécanique double, la ' +
      'seconde famille verrouille TOUTES les entrées de l’avant-sas.',
  },
  {
    id: 'gabarit-mobile',
    famille: 'structure',
    etat: 'en-place',
    titre: 'Le même code ne donne pas toujours le même gabarit',
    texte:
      'Le nombre de compartiments bouge d’un cran (±1) environ un tirage ' +
      'sur cinq : deux salles « 101 » ne se ressemblent pas au premier ' +
      'regard.',
  },
  {
    id: 'orientation-tournee',
    famille: 'structure',
    etat: 'en-place',
    titre: 'Trois salles sur quatre se retournent',
    texte:
      'Transposition (la salle se dresse) et miroir emportent TOUT — parois, ' +
      'mécanismes, faisceaux, rails, preuves — et la validation se rejoue ' +
      'sur la géométrie définitive. Le même squelette ne se lit pas toujours ' +
      'dans le même sens. (Les figures n’y passent pas encore : les arcs ' +
      'ne savent pas se retourner.)',
  },
  {
    id: 'point-de-repere',
    famille: 'structure',
    etat: 'proposee',
    titre: 'Chaque salle porte un repère mémorisable',
    texte:
      'Une silhouette, un bandeau, une lampe teintée — UN repère qui la ' +
      'distingue de ses voisines, GARANTI par le générateur et non laissé au ' +
      'hasard du décor. Le joueur ne doit jamais se demander « suis-je déjà ' +
      'passé ici ? ».',
  },
  {
    id: 'boucle-qui-recompense',
    famille: 'structure',
    etat: 'proposee',
    titre: 'Une boucle se choisit, elle ne se subit pas',
    texte:
      'Deux voies équivalentes, c’est une voie de trop. La voie longue ' +
      'paie (cachette, butin, sûreté) et la voie courte coûte (franchissement ' +
      'plus dur, danger) : le choix de route devient une décision, pas un ' +
      'pile ou face.',
  },
  {
    id: 'cul-de-sac-plein',
    famille: 'structure',
    etat: 'proposee',
    titre: 'Un cul-de-sac vide est interdit',
    texte:
      'Qui s’écarte du chemin trouve toujours quelque chose : cachette, ' +
      'fiole, point de vue, écho de lore. Le détour se respecte — sinon le ' +
      'joueur apprend à ne plus explorer, et la topologie à boucles ne sert ' +
      'plus à rien.',
  },
  {
    id: 'varier-la-foulee',
    famille: 'structure',
    etat: 'proposee',
    titre: 'Deux salles consécutives ne se ressemblent jamais',
    texte:
      'Alterner serré / ouvert, horizontal / vertical, clair / sombre. Le ' +
      'générateur devrait regarder la salle PRÉCÉDENTE de la séquence au ' +
      'moment de tirer la suivante — aujourd’hui chaque salle s’ignore, ' +
      'et une descente peut enchaîner trois couloirs identiques.',
  },
  // ---- LA RAMPE -----------------------------------------------------------
  {
    id: 'difficulte-dose-tout',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'La difficulté dose tout, chiffres à l’appui',
    texte:
      'D dose le nombre de compartiments (3 jusqu’à D2, 4 jusqu’à D5, ' +
      '5 au-delà), le serrage des passages (−6 u par cran, plancher 190 u), ' +
      'la probabilité de danger par salle (0,15 + 0,07·D, plafond 0,75) et le ' +
      'nombre de franchissements contraints (1 + D/3).',
  },
  {
    id: 'indices-jusqu-a-d2',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'Les indices s’arrêtent à la difficulté 2',
    texte:
      'Les indices peints au sol (« MIROIR DE GLACE », « IONISER ICI ») ne se ' +
      'posent qu’à D ≤ 2, un par espèce d’énigme et par salle au ' +
      'plus : au-delà, le protocole est supposé connu — le petit mot tuto ' +
      'n’a pas à se répéter partout.',
  },
  {
    id: 'relais-des-d3',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'Dès D3, le miroir se relaie',
    texte:
      'Un miroir fixe en losange couche le fil du faisceau à travers la ' +
      'salle ; le corps gelé du joueur le redresse vers la pastille. Le ' +
      'trajet se lit en trois temps et la pastille finit LOIN de ' +
      'l’émetteur : la même énigme, un cran d’abstraction plus haut.',
  },
  {
    id: 'rampe-de-la-voie',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'Sur la voie, la rampe est linéaire et le moment par tiers',
    texte:
      'La difficulté monte de 0 au départ à diffMax au dernier rang, ' +
      'linéairement ; le moment (début / milieu / fin) se répartit par tiers ' +
      'de la longueur du plan. Longueur, plafond et « descente du jour » se ' +
      'règlent au banc.',
  },
  {
    id: 'enseigner-eprouver-tordre',
    famille: 'rampe',
    etat: 'proposee',
    titre: 'Enseigner, éprouver, tordre',
    texte:
      'Chaque mécanique se rencontre trois fois sur une descente : une salle ' +
      'SÛRE qui l’enseigne (l’échec ne coûte rien), une salle qui ' +
      'l’ÉPROUVE sous contrainte (serrage, danger), une salle qui la ' +
      'DÉTOURNE (elle sert autrement qu’à sa leçon). La rampe devrait ' +
      'ordonnancer ces trois temps, pas seulement doser des quantités.',
  },
  {
    id: 'une-nouveaute-a-la-fois',
    famille: 'rampe',
    etat: 'proposee',
    titre: 'Une nouveauté à la fois',
    texte:
      'Une salle n’introduit jamais deux choses neuves à la fois : ' +
      'nouvelle mécanique OU nouveau danger OU nouvelle topologie — jamais ' +
      'deux. Le neuf se présente toujours dans un contexte connu.',
  },
  {
    id: 'respiration',
    famille: 'rampe',
    etat: 'proposee',
    titre: 'La difficulté monte en dents de scie, pas en pente',
    texte:
      'Après une salle exigeante, une salle de RESPIRATION : courte, sûre, ' +
      'généreuse. La rampe linéaire actuelle de la voie devrait creuser ces ' +
      'vallées — la tension se mesure à ses relâchements.',
  },
  {
    id: 'sommet-avant-la-fin',
    famille: 'rampe',
    etat: 'proposee',
    titre: 'Le pic se joue à l’avant-dernier rang',
    texte:
      'La dernière salle est une victoire à prendre, pas un mur : le sommet ' +
      'de difficulté se place juste avant, et le joueur sort de la descente ' +
      'sur une réussite. Perdre au tout dernier rang est le plus sûr moyen ' +
      'de ne jamais revoir un joueur.',
  },
  {
    id: 'duree-cible',
    famille: 'rampe',
    etat: 'proposee',
    titre: 'Une salle vise une durée, pas une taille',
    texte:
      'Chaque salle générée vise une DURÉE (de ~45 s à D0 jusqu’à ' +
      '~3 min à D9, à calibrer) et le « par » la mesure ; un tirage hors ' +
      'gabarit se re-tire. La longueur d’une descente se raisonne en ' +
      'minutes de jeu, pas en nombre de salles.',
  },
  {
    id: 'combiner-pas-encombrer',
    famille: 'rampe',
    etat: 'proposee',
    titre: 'Combiner, jamais encombrer',
    texte:
      'La difficulté monte en COMBINANT des mécaniques connues (un miroir ' +
      'sous une barrière tenue, un rail à travers un rideau), jamais en ' +
      'ajoutant du fouillis. Au-delà de D5, les plafonds de lisibilité ' +
      'tiennent bon et la combinaison prend le relais des quantités.',
  },
  // ---- LA LISIBILITÉ ------------------------------------------------------
  {
    id: 'plafonds-de-lisibilite',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'Les plafonds : ce qu’une salle a le droit de contenir',
    texte:
      'Au plus deux miroirs simples, un double-miroir (ET), un rail, une ' +
      'barrière, trois lasers en tout. L’excédent RETOMBE dans sa ' +
      'famille — un glaceux redevient rideau, un vaporeux redevient évent, ' +
      'sinon membrane, sinon passage libre : le cahier des charges n’est ' +
      'jamais trahi.',
  },
  {
    id: 'et-exige-la-largeur',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'Le double miroir exige une salle large',
    texte:
      'Deux fils à plomb écartés dans la même salle demandent au moins ' +
      '820 u de largeur ; à défaut, le maillon redevient miroir simple. Une ' +
      'énigme à l’étroit n’est pas une énigme, c’est un ' +
      'embouteillage.',
  },
  {
    id: 'nor-verticale',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'La barrière tenue ne garde qu’une cloison verticale',
    texte:
      'Ailleurs, elle redevient évent. Sa colonne de faisceau reste dégagée ' +
      'du plafond au plancher de la salle : le décor ne coupera jamais la ' +
      'barrière à la place du joueur.',
  },
  {
    id: 'chemins-reserves',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'Le chemin, les faisceaux, le spawn, le sas : réservés',
    texte:
      'Ce sont des RÉSERVES : le décor et les cachettes n’y posent ' +
      'jamais rien. Seules les traverses du labyrinthe ont le droit de ' +
      'barrer le chemin nominal — c’est le serpentin, et il reste prouvé ' +
      'traversable.',
  },
  {
    id: 'lire-avant-agir',
    famille: 'lisibilite',
    etat: 'proposee',
    titre: 'Lire avant d’agir',
    texte:
      'Depuis l’entrée d’une salle, l’OBJECTIF (la porte, le ' +
      'sas) se voit ou se déduit ; tout danger se télégraphie avant de ' +
      'punir. Le premier regard répond à « où vais-je ? », le deuxième à ' +
      '« qu’est-ce qui m’en empêche ? » — jamais l’inverse.',
  },
  {
    id: 'silhouette-souveraine',
    famille: 'lisibilite',
    etat: 'proposee',
    titre: 'La silhouette est souveraine',
    texte:
      'Éteindre lumière et textures : la salle doit rester compréhensible en ' +
      'silhouette pure. La lumière sculpte et met en scène, elle ne porte ' +
      'jamais une information indispensable à la traversée.',
  },
  {
    id: 'entree-sanctuaire',
    famille: 'lisibilite',
    etat: 'proposee',
    titre: 'La zone d’arrivée est un sanctuaire',
    texte:
      'Aucun danger, aucune énigme à moins de ~300 u du spawn : le temps de ' +
      'lire la salle. Le générateur réserve déjà 230 u d’ESPACE autour ' +
      'du spawn — en faire une règle de CALME, pas seulement de place.',
  },
  {
    id: 'echec-eclairant',
    famille: 'lisibilite',
    etat: 'proposee',
    titre: 'Chaque échec éclaire',
    texte:
      'La cause d’une perte est visible À L’INSTANT de la perte, ' +
      'jamais hors-champ. Si un danger peut coûter depuis hors-champ, il se ' +
      'télégraphie (lueur, aura, son) avant de frapper. Un échec illisible ' +
      'est un bug de design, pas une difficulté.',
  },
  // ---- L'HABILLAGE --------------------------------------------------------
  {
    id: 'lore-place-les-dangers',
    famille: 'habillage',
    etat: 'en-place',
    titre: 'Le lore place les dangers',
    texte:
      'Le froid vient de l’ESPACE : un hublot fendu ne se pose que sur ' +
      'la coque (le tour du plateau). La chaudière est une machine du ' +
      'vaisseau : n’importe quel bord. Le monde reste crédible jusque ' +
      'dans ses pièges.',
  },
  {
    id: 'decor-par-rejet',
    famille: 'habillage',
    etat: 'en-place',
    titre: 'Le décor se pose par rejet',
    texte:
      'Jamais sur une réserve (marge 40 u), jamais collé à une autre pièce ' +
      '(60 u), jamais hors des bornes : un essai raté se retente, puis ' +
      's’abandonne. Le décor habille, il n’obstrue pas.',
  },
  {
    id: 'cachette-en-cul-de-sac',
    famille: 'habillage',
    etat: 'en-place',
    titre: 'La cachette préfère le cul-de-sac',
    texte:
      'Une cachette environ une salle sur deux (p = 0,55), posée 7 fois sur ' +
      '10 dans un cul-de-sac — la voie qui ne mène qu’à elle : ' +
      'l’exploration paie là où le chemin ne mène pas.',
  },
  {
    id: 'une-lampe-par-salle',
    famille: 'habillage',
    etat: 'en-place',
    titre: 'Une lampe par salle, l’ambiante suit le moment',
    texte:
      'Une lampe par salle (quatre au plus par plateau) ; la fin de run ' +
      's’assombrit (ambiante 0,46 au milieu, 0,40 en fin). Le mode ' +
      'contrasté éteint presque tout (0,10–0,16) et sculpte aux lampes ' +
      'basses, avec leur écran d’ombre posé exprès.',
  },
  // ---- LES FIGURES --------------------------------------------------------
  {
    id: 'figure-une-idee',
    famille: 'figures',
    etat: 'en-place',
    titre: 'Une figure est une seule idée lisible',
    texte:
      'Le tableau EST un glyphe qu’on lit d’un regard au plan ' +
      'large — pas un assemblage de salles : un dessin posé dans le champ. ' +
      'Neuf familles aujourd’hui : anneaux, spirale, cortège, rosace, ' +
      'nef, constellation, conduits, fusion, échangeur.',
  },
  {
    id: 'figure-immensite',
    famille: 'figures',
    etat: 'en-place',
    titre: 'L’immensité et le vide font partie du voyage',
    texte:
      'La cuve est vaste, la figure n’en occupe qu’une part ; ' +
      'traverser du vide n’est pas du temps perdu, c’est la mesure ' +
      'de l’échelle.',
  },
  {
    id: 'figure-sobriete',
    famille: 'figures',
    etat: 'en-place',
    titre: 'La sobriété : retirer compte plus qu’ajouter',
    texte:
      'Peu de pièces (≤ 22), parois d’anneaux minces, aucun fouillis. ' +
      'L’éclairage DE BASE couche les grandes ombres radiales — pas une ' +
      'lampe : c’est la lumière par défaut qui sculpte.',
  },
  {
    id: 'figure-coutures',
    famille: 'figures',
    etat: 'en-place',
    titre: 'Les coutures gardées',
    texte:
      'Les passages de la figure sont d’étroites coutures (~300 u), ' +
      'chacune gardée par une plaque-filtre d’état posée tangente ' +
      '(membrane, rideau, évent) — ou par une porte asservie prouvée quand ' +
      'la figure s’offre un mécanisme.',
  },
  {
    id: 'figure-symetrie-tordue',
    famille: 'figures',
    etat: 'en-place',
    titre: 'La symétrie, jamais parfaite',
    texte:
      'Coutures qui tournent, moitiés glissées, satellites posés au large ' +
      'pour la beauté seule : la symétrie tordue fait le vivant — la ' +
      'symétrie parfaite fait le mort.',
  },
] as const

/** Une règle par identité — les notes du magasin s'y raccrochent. */
export function regleParId(id: string): RegleGen | null {
  return CATALOGUE_REGLES.find((r) => r.id === id) ?? null
}

/** Les règles d'une famille, règles EN PLACE d'abord. */
export function reglesDeFamille(famille: string): RegleGen[] {
  const enPlace = CATALOGUE_REGLES.filter(
    (r) => r.famille === famille && r.etat === 'en-place',
  )
  const proposees = CATALOGUE_REGLES.filter(
    (r) => r.famille === famille && r.etat === 'proposee',
  )
  return [...enPlace, ...proposees]
}
