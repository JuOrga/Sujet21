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
    etat: 'en-place',
    titre: 'Chaque salle porte un repère mémorisable',
    texte:
      'Un danger, une cachette, un bandeau ou une décalcomanie font ' +
      'repère ; la salle que le hasard laisse nue GAGNE le sien — une ' +
      'décalcomanie d’atelier dont l’espèce tourne avec la salle ' +
      '(tuyaux, vanne, écran, fiole), ou à défaut de place sa lampe se ' +
      'teinte. Le joueur ne se demande jamais « suis-je déjà passé ici ? ».',
  },
  {
    id: 'boucle-qui-recompense',
    famille: 'structure',
    etat: 'en-place',
    titre: 'Une boucle se choisit, elle ne se subit pas',
    texte:
      'Deux voies équivalentes, c’est une voie de trop. Quand les deux ' +
      'ouvertures d’une boucle sont toutes deux libres, l’une prend ' +
      'un filtre d’état : la voie qui l’évite s’allonge, celle qui ' +
      'la prend se paie — le choix de route devient une décision, pas un ' +
      'pile ou face.',
  },
  {
    id: 'cul-de-sac-plein',
    famille: 'structure',
    etat: 'en-place',
    titre: 'Un cul-de-sac vide est interdit',
    texte:
      'Qui s’écarte du chemin trouve TOUJOURS quelque chose : chaque ' +
      'cul-de-sac reçoit une cachette (quand les options le permettent) ou, ' +
      'à défaut, une fiole visible. Le détour se respecte — sinon le joueur ' +
      'apprend à ne plus explorer, et la topologie à boucles ne sert plus à ' +
      'rien.',
  },
  {
    id: 'varier-la-foulee',
    famille: 'structure',
    etat: 'en-place',
    titre: 'Deux salles consécutives ne se ressemblent jamais',
    texte:
      'Sur la voie, le rang commande la POSTURE de la salle générée : la ' +
      'mécanique qu’on vient de jouer s’évite au choix suivant, le ' +
      'labyrinthe et l’éclairage contrasté alternent un rang sur deux ' +
      '(milieu et fin de plan) — et tout voyage dans le code de la salle, ' +
      'l’identité tient.',
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
    titre: 'Sur la voie, la rampe est en dents de scie, le moment par tiers',
    texte:
      'L’enveloppe monte de 0 au départ jusqu’au SOMMET diffMax à ' +
      'l’avant-dernier rang ; un rang sur trois creuse une respiration ' +
      '(−1) ; le dernier rang redescend à 60 % du plafond. Le moment ' +
      '(début / milieu / fin) se répartit par tiers de la longueur. Le plan ' +
      'se règle dans LE CAHIER DES RÈGLES (paramètres du cycle).',
  },
  {
    id: 'enseigner-eprouver-tordre',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'Enseigner, éprouver, tordre',
    texte:
      'Le tiers DÉBUT enseigne : la leçon est PURE (les familles de ' +
      'maillons se resserrent sur la mécanique de la salle). Le tiers ' +
      'MILIEU éprouve : l’esprit labyrinthe tord la structure un rang ' +
      'sur deux. Le tiers FIN détourne : l’éclairage contrasté fait ' +
      'rejouer les mêmes mécaniques dans la pénombre sculptée.',
  },
  {
    id: 'une-nouveaute-a-la-fois',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'Une nouveauté à la fois',
    texte:
      'Les deux premiers rangs de la voie sont SANS danger : d’abord la ' +
      'mécanique, ensuite les pièges. Le neuf se présente toujours dans un ' +
      'contexte connu — jamais une mécanique inconnue ET un danger neuf ' +
      'dans la même salle.',
  },
  {
    id: 'respiration',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'La difficulté monte en dents de scie, pas en pente',
    texte:
      'Un rang sur trois de la voie creuse une VALLÉE d’un cran sous ' +
      'l’enveloppe : après l’exigence, le relâchement — la tension ' +
      'se mesure à ses respirations. (Gravé dans la courbe diffAuRang, ' +
      'testé rang par rang.)',
  },
  {
    id: 'sommet-avant-la-fin',
    famille: 'rampe',
    etat: 'en-place',
    titre: 'Le pic se joue à l’avant-dernier rang',
    texte:
      'Le sommet de difficulté (diffMax) tombe au rang L−1 ; la dernière ' +
      'salle redescend à 60 % du plafond — une victoire à prendre, pas un ' +
      'mur. Le joueur sort de la descente sur une réussite. Perdre au tout ' +
      'dernier rang est le plus sûr moyen de ne jamais revoir un joueur.',
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
    etat: 'en-place',
    titre: 'Combiner, jamais encombrer',
    texte:
      'Au-delà de la difficulté 5, les franchissements de renfort ' +
      'deviennent des ÉNIGMES de la même famille (miroir, double ET, rail, ' +
      'barrière) plutôt qu’un filtre d’état de plus : la difficulté ' +
      'monte en montages, pas en quantités — et les plafonds de lisibilité ' +
      'tiennent bon.',
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
    id: 'trajet-etire',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'Le trajet s’étire : jamais de pastille contre son émetteur',
    texte:
      'Chaque pose d’énigme s’ENGAGE sur une distance minimale ' +
      'émetteur → pastille (miroir 300 u, relais 380, rail 280, double ET ' +
      '260) et la validation la vérifie — un tirage qui niche sa pastille ' +
      'se re-tire. Le corps gelé se tient du côté opposé à l’émetteur, ' +
      'le rail court d’un flanc vers l’autre : le fil se LIT à ' +
      'travers la salle, il ne se résout pas sur place.',
  },
  {
    id: 'lire-avant-agir',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'Lire avant d’agir',
    texte:
      'Le sas porte son étiquette, chaque danger la sienne (CHAUDIÈRE, ' +
      'HUBLOT FENDU) avec son aura visible, et l’entrée est un sanctuaire ' +
      '— le temps du premier regard. Il répond à « où vais-je ? », le ' +
      'deuxième à « qu’est-ce qui m’en empêche ? » — jamais ' +
      'l’inverse.',
  },
  {
    id: 'silhouette-souveraine',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'La silhouette est souveraine',
    texte:
      'Aucune information de traversée n’est portée par la lumière : ' +
      'matières, portes et pastilles se lisent en silhouette pure. Même en ' +
      'éclairage contrasté, l’ambiante garde un plancher (0,12) — la ' +
      'lumière sculpte et met en scène, elle ne cache jamais le chemin.',
  },
  {
    id: 'entree-sanctuaire',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'La zone d’arrivée est un sanctuaire',
    texte:
      'Aucun danger à moins de 300 u du spawn — gravé dans la pose et ' +
      'balayé par les tests. Dans la salle de naissance, l’énigme est ' +
      'REPOUSSÉE du spawn autant que la salle le permet (le point ' +
      'd’ionisation part du flanc opposé, le miroir s’écarte). Le ' +
      'joueur a le temps de lire avant que la salle ne parle.',
  },
  {
    id: 'echec-eclairant',
    famille: 'lisibilite',
    etat: 'en-place',
    titre: 'Chaque échec éclaire',
    texte:
      'Tout danger posé porte son étiquette et son aura (bande de gel, ' +
      'halo de chauffe) : la cause d’une perte est visible à ' +
      'l’instant de la perte. Et le sanctuaire d’entrée garantit ' +
      'qu’aucun danger ne frappe pendant la lecture de la salle. Un ' +
      'échec illisible est un bug de design, pas une difficulté.',
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
      'Dix familles aujourd’hui : anneaux, spirale, cortège, rosace, ' +
      'nef, constellation — et les quatre distillées des tableaux de ' +
      'BOIZ : conduits, fusion, échangeur, voies.',
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
  {
    id: 'enigme-a-la-demande',
    famille: 'figures',
    etat: 'en-place',
    titre: 'L’auteur peut EXIGER un faisceau, dans les deux modes',
    texte:
      'Le réglage « Énigmes au laser » du panneau ne pilotait que le mode ' +
      'figure : dans un tableau à compartiments, l’auteur n’avait qu’à ' +
      'retirer des graines jusqu’à en voir un. Il porte maintenant sur les ' +
      'deux modes — « aucune » rabat les maillons à faisceau sur le filtre ' +
      'd’état de leur famille, « une » et « deux » promeuvent des ' +
      'connexions en énigmes. La promotion reste DANS la famille : le ' +
      'maillon remplacé d’abord (un rideau devient miroir ou double ET), ' +
      'la mécanique du cahier à défaut — une salle de glace ne se voit ' +
      'jamais coiffer d’une barrière NOR.',
  },
  {
    id: 'figure-dans-la-descente',
    famille: 'figures',
    etat: 'en-place',
    titre: 'Les figures se jouent DANS la descente, mêlées aux compartiments',
    texte:
      'Le mode figure ne vit plus dans le seul éditeur : à chaque rang, le ' +
      'choix mêle des salles à compartiments (le système historique) et ' +
      'des figures — une au début, deux dès que le milieu s’ouvre, jamais ' +
      'les trois. La carte s’annonce par sa FAMILLE, et le champ s’ouvre ' +
      'avec le plan : intime au début, vaste au milieu, immense à la fin.',
  },
  {
    id: 'figure-vivier-eligible',
    famille: 'figures',
    etat: 'en-place',
    titre: 'Une famille ne se propose que si la descente peut la jouer',
    texte:
      'Chaque famille déclare ce qu’elle EXIGE (les familles de BOIZ ' +
      'gravent leur matière dans la géométrie : rideau, plaque froide, ' +
      'surchauffeur) et le plus tôt qu’on ose la poser. Le vivier se ' +
      'filtre sur trois critères — les mémoires tissées, la mécanique de ' +
      'la carte, le moment du plan — et la famille se tire au hasard dans ' +
      'ce qui reste. Le masque tranche aussi l’espèce du mécanisme : pas ' +
      'de miroir de glace sans solidification, pas de barrière NOR sans ' +
      'vaporisation.',
  },
  {
    id: 'figure-enigme-des-le-premier-palier',
    famille: 'figures',
    etat: 'en-place',
    titre: 'L’énigme vient dès qu’une difficulté est demandée',
    texte:
      'Le dosage AUTO n’accordait un mécanisme qu’à partir de la ' +
      'difficulté 4 — or la rampe d’une descente ordinaire plafonne à 3 : ' +
      'pas un faisceau de toute une run. La règle suit désormais le plan : ' +
      'difficulté 0 enseigne (les plaques gardent seules), dès 1 une ' +
      'énigme se greffe sur la couture finale, dès 5 deux verrous s’y ' +
      'empilent. Fusion et échangeur font exception, et c’est leur leçon : ' +
      'leur puzzle est fait de MATIÈRE, pas de faisceau.',
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
