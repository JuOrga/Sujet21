// Journal des livraisons, affiché dans le banc de réglage (dossier
// « Livraisons »). Rempli automatiquement à chaque livraison — l'entrée la
// plus récente en premier. Les testeurs voient ainsi ce qui a changé sans
// quitter le jeu.

export interface Delivery {
  date: string // JJ/MM/AAAA HH:MM (heure de Paris)
  title: string
  notes: string[]
}

export const DELIVERIES: Delivery[] = [
  {
    date: '09/08/2026 17:50',
    title: 'Le bourdon de fond se tait',
    notes: [
      'Le bourdon continu de la station est retiré : le fond est silencieux. Seuls les gestes sonnent — souffle d’éjection, respiration de la vapeur, aspiration du sas, transitions d’état, impacts de glace.',
    ],
  },
  {
    date: '09/08/2026 17:30',
    title: 'Le 21-A bis se trouve aussi au banc',
    notes: [
      'Le prototype « La galerie noyée » est désormais listé dans le dossier Tableaux du banc de réglage, en plus du bouton de la fiche d’essai (sous « Commencer l’essai ») — il se lançait mal à trouver.',
    ],
  },
  {
    date: '09/08/2026 17:00',
    title: 'La vie se lit, les records se partagent — et la galerie noyée en essai',
    notes: [
      'VIE LISIBLE : la jauge passe à l’ambre à l’approche du seuil et pulse en rouge dessous, avec un bandeau « COHÉSION CRITIQUE — dispersion dans X s » qui égrène le délai de grâce. Le débit de perte s’affiche en direct (−0,42 L/s · coût vapeur / éjection / surfaces), la rosée récupérable aux plaques froides aussi. La coque gagne une barre de refroidissement à côté du chiffre. Et quand le sas sort de l’écran, une FLÈCHE D’OBJECTIF le pointe depuis le bord, distance à l’appui.',
      'RECORDS PARTAGÉS : le tableau d’honneur vit maintenant sur le serveur (/api/records) — les registres de la fiche montrent le meilleur de TOUS les opérateurs, nom à l’appui, même règle de départage qu’en local. Et le protocole n’admet plus d’anonyme : le NOM D’OPÉRATEUR est obligatoire pour plonger — le champ se signale si on l’oublie.',
      'LA GALERIE NOYÉE (21-A bis, PROTOTYPE) : réfection du secteur A en tableau « eau seule » — porte massive, contreforts, cascade de dalles en quinconce, étagère hydrophile pour viser, lèvre hydrophobe sur la goulotte du sas. Accessible depuis la fiche (bouton dédié), hors expédition et hors registres : s’il convainc, il remplacera 21-A. Bonus de profondeur : tous les blocs portent désormais une ombre douce — fini les rectangles flottants.',
    ],
  },
  {
    date: '09/08/2026 16:05',
    title: 'Tutoriel diégétique : le protocole du Dr Véga guide la première plongée',
    notes: [
      'Au tableau 21-A, des CONSIGNES DU PROTOCOLE apparaissent une à une, au bon moment : éjecter pour se déplacer, surveiller la jauge de volume, changer d’état (F / G), puis deux consignes contextuelles — l’éponge quand on s’en approche, le sas quand il est en vue.',
      'Chaque consigne se valide par le GESTE, pas par un clic « OK » : maintenir l’éjection la valide, presser F ou G la valide, s’approcher de l’éponge ou du sas déclenche la suivante. Aucune fenêtre modale, aucun arrêt du jeu.',
      'Le tutoriel ne se montre qu’une fois : dès que les états sont maîtrisés, il se marque comme vu (localStorage) et ne reviendra plus — les habitués ne le verront jamais réapparaître.',
    ],
  },
  {
    date: '09/08/2026 15:10',
    title: 'L’expédition passe à 7 tableaux — et la vapeur perdue se recondense',
    notes: [
      'Recondensation (§7.3) : la vapeur perdue (pilotage, coût d’état, péage de grille, brûlure de radiateur) n’est plus toute définitive — elle PERLE EN ROSÉE juste au-delà de l’aura des plaques froides, récupérable au prix d’un détour. Rendement 50 % à vaisseau tiède, 75 % à vaisseau glacial : le rattrapage devient plus généreux quand le jeu devient plus dur. Curseurs « recondensation /s » et « rendement » (Gaz).',
      'Trois tableaux neufs, qui COMBINENT les mécaniques : 21-E « La serre » (étagères hydrophiles pour viser, radiateur pour s’arracher, mur d’éponge), 21-F « Le dépôt de givre » (deux grilles qui essorent, des plaques froides qui rendent la rosée — passer, puis revenir boire ses pertes), 21-G « La dérive » (presque pas de murs : plots hydrophobes en bandes de billard, mouillages froids pour geler-glisser — la maîtrise pure, en final).',
      'Ordre de l’expédition : A, B, C, E, F, D, G — les enseignements d’abord, les combinaisons ensuite, la cuve thermique en avant-dernier, la dérive en conclusion. Refroidissement recalé sur la nouvelle durée (~10 min).',
    ],
  },
  {
    date: '09/08/2026 14:10',
    title: 'Auras diffuses, façon radiateur — et la chimie porte à 80 u',
    notes: [
      'Exit les anneaux fins : les surfaces chimiques dégagent une brume diffuse et animée sur toute leur bande d’influence, sur le modèle de la chaleur du radiateur — turquoise qui aspire (hydrophile), violette qui repousse (hydrophobe).',
      'La portée physique suit : 48 → 80 u, l’échelle des auras thermiques. La répulsion se négocie de loin — le corps se déforme visiblement en traversant le champ — et l’îlot hydrophile aspire pour de bon.',
      'Deuxième passe : atténuation linéaire et couleurs denses — la brume emplit TOUT le champ au lieu de s’écraser contre le mur, lisible à n’importe quel zoom.',
    ],
  },
  {
    date: '09/08/2026 13:45',
    title: 'Les auras se voient : un anneau à la limite exacte de la portée',
    notes: [
      'Le simple dégradé se perdait au ras du mur, surtout sur mobile. Chaque surface à rayon d’action trace maintenant un ANNEAU fin à la limite exacte de sa portée — largeur constante à l’écran, lisible à tout zoom — en plus d’un dégradé intérieur renforcé.',
      'Hydrophile (turquoise), hydrophobe (violet), plaque froide (bleu glacé), radiateur (orange). Bonus de lecture : l’anneau des radiateurs se RÉTRACTE et celui des plaques froides s’ÉTEND à mesure que le vaisseau refroidit — la pression temporelle se voit aux frontières.',
    ],
  },
  {
    date: '09/08/2026 13:15',
    title: 'Le bourdon se tient mieux sur mobile',
    notes: [
      'Le son suit la visibilité de la page : en arrière-plan (autre app, autre onglet, écran verrouillé), tout se suspend — fini le bourdon qui continue dans la poche. Au retour, il reprend, et ça remet d’aplomb un contexte cassé par un appel ou une notification.',
      'Le bourdon de la station montait de 55 Hz — infranchissable pour un haut-parleur de téléphone, qui grésillait au lieu de bourdonner. Au doigt, il monte d’une octave (110 Hz), un peu plus doux : même respiration, sans vibration de coque.',
    ],
  },
  {
    date: '09/08/2026 12:50',
    title: 'Chaque surface montre son aura — et l’hydrophobe mord enfin',
    notes: [
      'Les surfaces chimiques affichent leur bande d’influence, comme le froid et le chaud : brume turquoise autour de l’hydrophile (aspiration), brume violette autour de l’hydrophobe (répulsion). Ce qu’on voit est exactement la portée physique.',
      'La portée de la chimie passe de 16 à 48 u : à 16 u, la bande ne mordait qu’au ras du mur — l’hydrophobe ne déviait presque rien. La déviation se sent maintenant, et l’îlot hydrophile aspire de plus loin. Curseur « portée bande » (Matériaux) élargi jusqu’à 150 u.',
    ],
  },
  {
    date: '09/08/2026 12:10',
    title: 'La température se sent, la vapeur devient opale',
    notes: [
      'Le liquide ressent la température AVANT de changer d’état : l’eau qui givre s’engourdit (pâteuse, dure à propulser — sauf gel volontaire F, qui garde son élan), l’eau qui chauffe frémit (bouillonnement doux, de plus en plus vif vers l’ébullition). Curseurs « engourdissement » (Glace) et « frémissement » (Chaleur).',
      'La vapeur change de robe : fini la fumée noire — vapeur d’opale, cœur turquoise voilé, liseré nacré, plis lilas. Elle se lit mieux sur le décor sombre, et sa couleur parle d’eau, pas d’incendie.',
    ],
  },
  {
    date: '09/08/2026 11:30',
    title: 'Le protocole mord : surfaces durcies, la vapeur se paie',
    notes: [
      'Nouveau curseur « mordant global » (dossier Matériaux, défaut ×1,35) : il multiplie l’effet de TOUTES les surfaces — adhésion et arrachage hydrophiles, répulsion hydrophobe, engluement et absorption de l’éponge, gel d’aura, évaporation au radiateur. Il s’applique par-dessus les réglages individuels, donc aussi aux présets existants (boizessai2 compris).',
      'Fin du tout-vapeur : être en gaz s’évapore EN CONTINU, même immobile (« coût d’état », 2 part./s par défaut) — la vapeur est un compte à rebours, pas un mode de croisière. Et les mailles des grilles essorent le nuage au passage (« péage de grille ») : franchissable, plus jamais gratuit.',
      'Correction au passage : le rappel de condensation passe en asservissement de vitesse (comme le vortex) — la pluie converge et se pose au lieu de risquer l’effondrement d’un nuage compact.',
      'Légende et panneau États mis à jour. Tout est réglable aux dossiers Matériaux et Gaz.',
    ],
  },
  {
    date: '09/08/2026 10:45',
    title: 'boizessai2 : le préset boizessai1, ajusté aux nouvelles auras',
    notes: [
      'Le préset « boizessai1 » gardait les anciennes portées thermiques. À la première visite après cette livraison, une copie « boizessai2 » est créée automatiquement dans la bibliothèque partagée : mêmes réglages, auras ajustées (chaleur 130, froid 85, ébullition 1,2 s).',
      'Si boizessai1 était le préset de lancement, boizessai2 le remplace. L’original reste intact dans la bibliothèque.',
    ],
  },
  {
    date: '09/08/2026 10:20',
    title: 'Équilibrage thermique : des auras qui se sentent',
    notes: [
      'Les auras étaient trop courtes pour un corps de ~110 u de rayon : elles n’en mordaient qu’une tranche — le radiateur semblait n’agir que sur la glace. Aura de chaleur 44 → 130 u, aura de froid 40 → 85 u, ébullition 1,5 → 1,2 s : l’eau qui s’approche d’un radiateur fume pour de bon, le froid se respecte de plus loin.',
      'Plages élargies au banc (froid jusqu’à 250 u, chaleur jusqu’à 300 u). Attention : un préset enregistré avec les anciennes valeurs les réappliquera — le charger, ajuster, réenregistrer.',
    ],
  },
  {
    date: '09/08/2026 03:10',
    title: 'L’expédition : la boucle se referme, le vaisseau refroidit',
    notes: [
      'Une partie est désormais une EXPÉDITION : les quatre tableaux en séquence, une seule fois. Le dernier sas conclut — bilan « EXPÉDITION ACHEVÉE » (tableaux, réserve, temps). La dispersion conclut aussi : bilan de l’échantillon perdu, et le suivant repart du tableau 1, réserve vidée.',
      'Le vaisseau refroidit pendant l’expédition (§5) : les auras froides s’étendent, le gel prend plus vite, le dégel traîne, les radiateurs faiblissent, la vapeur volontaire se fait chère. Pas de chronomètre — la pression se lit dans la physique, la teinte de la lumière, et la température de COQUE au HUD (+21° → −60°).',
      'Les registres retiennent la MEILLEURE EXPÉDITION (distance, puis réserve, puis temps, avec le nom) — affichée en tête du bloc registres de la fiche.',
      'Réglable au banc : dossier « Refroidissement (expédition) » — durée, poussée du froid, déclin des radiateurs.',
    ],
  },
  {
    date: '09/08/2026 02:40',
    title: 'Mobile : bande d’instruments, sélecteur discret, fiche allégée',
    notes: [
      'Le HUD devient une bande fine sur toute la largeur du haut : volume + jauge + état à gauche, tableau + bonbonnes à droite. Le trait rouge de la jauge marque le seuil de dispersion.',
      'Le sélecteur EAU / GLACE / VAPEUR passe en icônes seules, resserrées — l’état actif se lit au halo. Moitié moins de place.',
      'La fiche d’accueil va à l’essentiel au doigt : plus d’illustration, commandes repliées sous « ▸ COMMANDES » (dépliées sur grand écran), contenu centré.',
    ],
  },
  {
    date: '09/08/2026 02:15',
    title: 'Mobile : le bas de l’écran respire',
    notes: [
      'Le HUD monte en haut à gauche, en version compacte (volume, jauge, seuil, état) : le bas appartient aux commandes.',
      'La barre du bas tient en deux rangées nettes : chips LÉGENDE / ÉTATS / BANC, puis les glyphes (pause, time warp, recadrer, recommencer, fiche). Le bouton son se replie au banc (dossier Son).',
      'La barre laisse passer les gestes de visée entre les boutons, et le carton du journal s’affiche sous le HUD.',
    ],
  },
  {
    date: '09/08/2026 01:55',
    title: 'Règles de transformation : changer d’état ne tue plus',
    notes: [
      'Redevenir eau depuis la vapeur pouvait conclure en dispersion : le lien d’amas élargi du gaz tombait d’un coup à la condensation, et le nuage encore étalé comptait comme éclaté. Trois règles corrigent ça.',
      '1 — Mémoire de lien : après la condensation, le nuage compte encore comme UN corps pendant quelques secondes (le lien s’éteint doucement).',
      '2 — La condensation regroupe : les gouttelettes qui redeviennent eau sont rappelées vers le corps — le nuage retombe en pluie sur lui-même.',
      '3 — Délai de grâce : la dispersion se constate (2 s continues sous le seuil critique), elle ne se décrète plus à l’instant — un corps qui condense ou dégèle a le temps de se reformer.',
      'Tout est réglable au banc (dossiers Gaz et Corps). Et les records portent un nom : champ « VOTRE NOM » dans les registres de la fiche, estampillé façon borne d’arcade.',
    ],
  },
  {
    date: '09/08/2026 01:25',
    title: 'Lecture du jeu : panneau « États », chips, banc sur bouton',
    notes: [
      'Nouveau panneau « LES TROIS ÉTATS — qui bloque quoi » (touche E) : pour chaque état, ce qui le bloque, ce qui n’a plus prise, ce qui le transforme — les mots-matériaux dans la couleur de la légende. À savoir : le sas n’avale pas la glace.',
      'Les panneaux de lecture passent en chips étiquetées en tête de barre : LÉGENDE, ÉTATS, BANC — mises en évidence, sans rivaliser avec le sélecteur d’état. Un seul panneau ouvert à la fois.',
      'Le banc de réglage n’occupe plus le coin haut-droit en permanence : le bouton BANC le montre et le masque.',
      'La fiche d’accueil est à jour : commandes regroupées (caméra libre, états, panneaux), desktop et tactile. Les touches ne volent plus la frappe dans les champs du banc.',
    ],
  },
  {
    date: '09/08/2026 00:55',
    title: 'Caméra libre : glisser à deux doigts, clic droit maintenu',
    notes: [
      'On peut enfin regarder ailleurs : deux doigts posés glissent la caméra (le pincement zoome en même temps) ; au clavier-souris, clic droit MAINTENU — on « attrape » le monde.',
      'La caméra tient la position choisie au lieu de suivre le corps ; le bouton ⌖ recadre (zoom et suivi automatiques). Un clic droit bref reste le vortex du bac à sable.',
      'Commandes de la fiche mises à jour (desktop et tactile).',
    ],
  },
  {
    date: '09/08/2026 00:20',
    title: 'Tableau 4 : la cuve thermique — le radiateur',
    notes: [
      'Nouveau matériau : le radiateur. Son aura vaporise l’eau qu’on le veuille ou non (la vapeur gagnée traverse grilles et éponges), dégèle la glace soudée, et la vapeur qui s’attarde s’évapore — définitivement perdue. Danger ou ressource, selon ce qu’on vient y chercher.',
      'Tableau 21-D « La cuve thermique » : un radiateur en haut, une cryobaie en bas, et une barrière à trois réponses — fente étroite (liquide), mur d’éponge (payer en volume, ou traverser en vapeur), couloir bas tapissé d’éponge (la glace y glisse, l’éponge n’a pas prise sur elle).',
      'Équilibrage au banc : dossier « Chaleur (tableau 4) » — aura, temps de vaporisation, dégel forcé, évaporation par seconde.',
      'Rendu : rayures incandescentes qui défilent, aura de chaleur qui tremble — la température se lit avant le contact, comme pour le froid.',
    ],
  },
  {
    date: '08/08/2026 22:54',
    title: 'Sélecteur d’état : les transformations en évidence',
    notes: [
      'Les transformations quittent la barre d’outils : un sélecteur dédié EAU / GLACE / VAPEUR — gros boutons étiquetés, raccourcis F et G affichés, halo coloré sur l’état choisi.',
      'Au doigt : en colonne à droite de l’écran, sous le pouce. Au clavier : F et G fonctionnent toujours.',
    ],
  },
  {
    date: '08/08/2026 22:43',
    title: 'Effets sonores',
    notes: [
      'Le jeu sonne : souffle d’éjection, respiration de la fumée, tourbillon du sas qui monte à l’approche et glouglous d’avalement, craquements de gel et gouttes de dégel, impacts sourds des blocs de glace, tampons sonores (collecte, dispersion), vortex — et le bourdon discret de la station.',
      'Tout est synthétisé en direct (Web Audio) : aucun fichier téléchargé. Le navigateur n’autorise le son qu’après un premier clic ou toucher.',
      'Bouton 🔊 dans la barre tactile et dossier « Son » au banc (actif + volume). Réglage local, hors présets — chacun le sien.',
    ],
  },
  {
    date: '08/08/2026 22:31',
    title: 'Le scénario commence : le journal du Dr Véga',
    notes: [
      'Le jeu se raconte : à bord du complexe orbital Méduse, le protocole « Tension de surface » étudie un échantillon d’eau qui… se déplace. Toute la narration passe par le journal de bord du Dr N. Véga.',
      'À chaque ouverture de tableau, un carton affiche l’entrée du journal (pendant le plan large) : 21-A, 21-B, 21-C — le malaise du laboratoire monte d’essai en essai.',
      'Les textes du jeu parlent la même langue : « ÉCHANTILLON COLLECTÉ » (le sas est un collecteur — chaque réussite nourrit la réserve du labo), « perte de l’échantillon » à la dispersion.',
      'La bible narrative complète (trois actes, jusqu’à l’évasion réelle) est dans docs/scenario.md du dépôt.',
    ],
  },
  {
    date: '08/08/2026 22:00',
    title: 'La vapeur devient fumée noire + bouton de reprise mobile',
    notes: [
      'La vapeur refaite façon « fumée noire » : cœur d’encre, volutes internes qui roulent, bords déchiquetés qui bouillonnent (bruit animé), liseré gris qui accroche la lumière — et une vraie turbulence physique : le nuage se tord en tourbillons (curseur « turbulence » dans Gaz).',
      'Après une DISPERSION, un bouton « RECOMMENCER L’ESSAI » apparaît dans le bandeau — indispensable au doigt, où la touche R n’existe pas.',
    ],
  },
  {
    date: '08/08/2026 21:49',
    title: 'Tableau 3 : le conduit — se déplacer en gaz',
    notes: [
      'Troisième état : la vapeur (touche G / 💨). Le pointeur PILOTE le nuage en continu — pas d’éjection, pas de recul — mais il s’évapore en avançant (la traîne se perd, réglable). Re-presser condense.',
      'La vapeur traverse les grilles (nouveau matériau, infranchissable au liquide et à la glace), ignore la chimie des parois et l’éponge, et le froid la condense de force — les plaques froides redeviennent des portes.',
      'Nouveau tableau « Le conduit » : deux grilles pleine hauteur, un goulet, des portes condensantes avant le sas. Trois états, trois façons de se déplacer : éjecter (liquide), glisser (glace), piloter (vapeur).',
      'Rendu : nuage pâle, diffus et translucide. Réglages dans « Gaz » : vaporisation, condensation, poussée, vitesse, évaporation, expansion, flottement.',
    ],
  },
  {
    date: '08/08/2026 21:35',
    title: 'Zoom d’ouverture',
    notes: [
      'Chaque tableau s’ouvre sur un plan large (~1 s) : le niveau entier se lit — parcours, sas — puis la caméra plonge en travelling adouci vers le corps.',
      'Au premier lancement aussi. Le moindre geste (visée, molette) coupe court et rend la main immédiatement.',
      'Accessoirement, ça montre que le zoom existe (molette / pincement).',
    ],
  },
  {
    date: '08/08/2026 20:28',
    title: 'La glace devient une capacité : F pour se changer en bloc',
    notes: [
      'Touche F (❄ sur mobile) : le corps entier se change en glace en ~0,5 s — et le bloc GARDE SON ÉLAN. Un palet rigide : il ignore la chimie des parois (hydrophobe compris), rebondit au lieu d’éclabousser, traverse les zones dangereuses. Re-presser dégèle (~2,5 s) — l’eau revient dans le mouvement où la glace se trouvait.',
      'La manœuvre : s’élancer par éjection, geler, traverser en palet, dégeler pour reprendre la main. S’arrêter net : geler au contact d’une plaque froide — la glace s’y soude (l’ancrage exige le contact, pas seulement l’aura).',
      'Le gel par plaques (tableau 2) suit la même physique : gelée en mouvement sans toucher la plaque, l’eau continue en bloc au lieu de se figer sur place.',
      'Réglages dans « Glace & froid » : gel volontaire, dégel, rebond de la glace, aura et gel des plaques.',
    ],
  },
  {
    date: '08/08/2026 20:13',
    title: 'Saut de tableau depuis le banc',
    notes: [
      'Nouveau dossier « Tableaux » : un bouton par niveau (nº 1 — Le sas, nº 2 — La chambre froide) pour relancer directement le tableau à tester, sans rejouer les précédents.',
      'Équivaut à ?tableau=N dans l’adresse, mais sans recharger la page.',
    ],
  },
  {
    date: '08/08/2026 19:57',
    title: 'Tableau 2 : la chambre froide — l’eau gèle',
    notes: [
      'Nouveau tableau après le sas du premier : des plaques froides gèlent l’eau qui s’attarde dans leur aura (visible en brume glacée). Gelée, l’eau est ancrée — elle ne bouge plus, ne s’éjecte plus, et fait obstacle au liquide. À l’écart du froid, elle dégèle et revient au corps, sans élan.',
      'S’ancrer volontairement devient une manœuvre : geler un flanc pour s’arrêter net, puis payer le dégel en temps. Le corps givre progressivement (le flanc blêmit avant la prise).',
      'Réglages dans « Froid » : aura, temps de gel, temps de dégel. Le HUD affiche « gel partiel » ou « GELÉ ».',
      'Les tableaux s’enchaînent : sas du 1 → tableau 2 → retour au 1. « ?tableau=2 » dans l’adresse pour démarrer directement au second.',
      'Le vortex (clic droit) devient un outil de test : coupé par défaut — il annulait le coût de la perte d’eau. Interrupteur « actif » dans son dossier au banc.',
    ],
  },
  {
    date: '08/08/2026 19:31',
    title: 'La spirale de fin se joue en entier',
    notes: [
      'La victoire n’arrive plus quand le centre du corps franchit le sas : elle attend que le sas ait quasi tout bu (≤ 2 % du volume). On regarde l’eau spiraler jusqu’au bout.',
      'Gorgée finale : tout près de la bouche, la giration s’efface et le courant plonge — les dernières gouttes plaquées contre la paroi sont bues au lieu de tourner en rond.',
      'Sas désactivé au banc (rayon ou courant à 0) : l’ancienne règle revient — entrer dans la boîte suffit.',
    ],
  },
  {
    date: '08/08/2026 19:25',
    title: 'Habillage : les images générées sont intégrées',
    notes: [
      'Nuit orbitale texturée (deux couches d’étoiles en parallaxe), coque du vaisseau en vraie tôle riveté-tuyautée autour de la cuve, tube lumineux côté intérieur.',
      'Matériaux habillés : métal brossé (murs), surface mouillée (hydrophile), cire perlée de gouttes (hydrophobe), mousse poreuse sèche/gorgée (éponge, continue entre cellules).',
      'Le sas a son iris mécanique : lamelles qui tournent lentement, anneau vert qui respire, détouré à même le shader.',
      'Fiche d’essai : écusson de mission et planche « FIG. 1 » scientifique.',
      'Poids maîtrisé : 22 Mo d’images sources compressées en 1,2 Mo de WebP. Le décor procédural reste en secours tant que les images chargent.',
    ],
  },
  {
    date: '08/08/2026 18:16',
    title: 'Préset par défaut au lancement',
    notes: [
      'Nouveau bouton « Par défaut au lancement ★ » dans Présets : le préset sélectionné est appliqué automatiquement à l’ouverture du jeu, pour tous les testeurs (marqué ★ dans la liste).',
      'Cliquer à nouveau sur le préset déjà par défaut retire ce statut (retour aux réglages d’usine). Supprimer le préset par défaut le retire aussi.',
      'Hors connexion, le dernier défaut connu s’applique quand même (cache local) ; la bibliothèque partagée corrige dès qu’elle répond.',
    ],
  },
  {
    date: '08/08/2026 17:50',
    title: 'Projet 21 : le titre, et le sas boit jusqu’au bout',
    notes: [
      'Le jeu s’appelle désormais « Projet 21 » (onglet, fiche d’essai) — « tension de surface » reste le nom du protocole.',
      'Le sas avale vraiment : les particules qui atteignent l’œil sont retirées et mises en bonbonne. Dans l’emprise du sas, la dispersion est suspendue — être bu n’est pas se disperser. Plus de « DISPERSION » alors qu’on allait gagner.',
      'La victoire conclut aussi quand le corps a été bu sous le seuil critique (les dernières gouttes plaquées à la paroi ne font plus attendre).',
      'Bug corrigé au passage : le tampon « SAS ATTEINT » était effacé dans la frame même où il apparaissait — le bilan de sortie ne s’affichait jamais.',
    ],
  },
  {
    date: '08/08/2026 17:30',
    title: 'Le sas aspire, la cuve flotte dans la nuit orbitale',
    notes: [
      'Le sas est devenu une bouche d’aspiration : à portée, un courant en entonnoir engouffre l’eau dans le trou (réglages rayon / courant / rotation dans le nouveau dossier « Sas »). Rendu assorti : gorge sombre, œil noir, anneau qui respire, stries de courant.',
      'Décor d’ambiance : la cuve d’essai flotte dans le vide — étoiles en parallaxe, nébulosité froide, coque métallique striée ; à l’intérieur, caustiques discrètes et poussières en dérive.',
      'Matériaux texturés : métal brossé (murs), reflet mouillé qui glisse (hydrophile), grain cireux perlé (hydrophobe).',
    ],
  },
  {
    date: '08/08/2026 17:15',
    title: 'Performances, 2e passe : physique ×4',
    notes: [
      'Le pas physique passe de 9,9 ms à 2,4 ms (900 particules) : données de paires réutilisées entre les passes du solveur, exponentiation entière, collecte de voisins sans allocation.',
      'Un PC moyen devrait maintenant tenir 60 fps sans baisser la qualité de rendu.',
    ],
  },
  {
    date: '08/08/2026 17:08',
    title: 'Performances smartphone et petits PC',
    notes: [
      'Solveur 2× plus rapide : les voisinages sont construits une fois par pas physique (au lieu de 4) et parcourus en boucles plates.',
      'Qualité de rendu adaptative : la résolution baisse automatiquement si la machine ne suit pas (5 niveaux, visible dans Mesures). La physique n’est jamais dégradée.',
      'Sous forte charge, le jeu ralentit en douceur au lieu de partir en spirale de rattrapage.',
    ],
  },
  {
    date: '08/08/2026 16:55',
    title: 'Banc redessiné + présets partagés entre testeurs',
    notes: [
      'Refonte du banc : sections d’instrument, curseurs à barre de progression, colonnes équilibrées, boutons et champs assortis à la fiche d’essai.',
      'Les présets sont maintenant partagés : « Enregistrer » publie dans une bibliothèque commune — chaque testeur voit les présets des autres (fusion avec les locaux, le plus récent gagne).',
      'Sans connexion, le banc retombe en mode local sans rien perdre.',
    ],
  },
  {
    date: '08/08/2026 16:40',
    title: 'Habillage complet : fiche d’essai, instruments, identité',
    notes: [
      'Écran d’accueil « fiche d’expérience » avec relevé vivant de l’échantillon — l’essai dérive derrière la fiche (échap ou ≡ pour y revenir).',
      'HUD refait en instruments de bord : jauge de volume avec seuil de dispersion marqué, tableau/bonbonnes, vitesse, état.',
      'Identité typographique (Michroma + IBM Plex Mono, auto-hébergées), palette unifiée, banc de réglage assorti, favicon.',
      'Tampons de protocole pour SAS ATTEINT (vert) et DISPERSION (rouge), transitions douces, reduced-motion respecté.',
    ],
  },
  {
    date: '08/08/2026 16:28',
    title: 'Le creux de propulsion se voit',
    notes: [
      'L’entraînement ne pousse plus le liquide dans le sens du jet (il annulait le recul au même endroit) : il fait converger l’eau vers le point d’émission, en entonnoir.',
      'Résultat : la surface se pince visiblement là où l’eau est éjectée — la déformation de propulsion n’est plus masquée.',
    ],
  },
  {
    date: '08/08/2026 16:20',
    title: 'Recul fluide : le corps se déforme en accélérant',
    notes: [
      'Le recul de l’éjection n’est plus réparti uniformément (effet « solide ») : il est pondéré vers le point d’éjection et se propage par pression.',
      'Curseur « recul localisé » dans Propulsion : 0 = bloc rigide (ancien comportement), 1 = déformation maximale. Défaut 0,6.',
    ],
  },
  {
    date: '08/08/2026 16:07',
    title: 'Eau lissée : fini les billes',
    notes: [
      'Surface du corps lissée : splats élargis, seuil réajusté, relief limité à la zone de surface (l’intérieur ne grène plus).',
      'Les gouttes libres sont rendues plus fines que le corps : des gouttelettes, pas des boules.',
      'Captures d’écran du canvas désormais possibles (retours visuels des testeurs).',
    ],
  },
  {
    date: '08/08/2026 15:55',
    title: 'Éjection : creusement et jet liquide',
    notes: [
      'L’éjection entraîne le liquide voisin du point de départ : le corps se creuse en entonnoir (curseur « entraînement » dans Propulsion).',
      'Les gouttes rapides s’étirent dans le sens du mouvement : le jet devient un filament liquide au lieu d’un chapelet de boules.',
    ],
  },
  {
    date: '08/08/2026 15:47',
    title: 'Rendu de l’eau, ondes d’éjection, impacts amortis',
    notes: [
      'Une onde traverse le volume d’eau à chaque salve d’éjection (surface qui ondule + lueur).',
      'Relief de l’eau : éclairage et reflet spéculaire par gradient du champ, scintillement interne.',
      'Les impacts sur les murs neutres éclatent moins : l’eau s’étale et épouse les formes (curseur « amorti impact » dans Matériaux).',
      'Nouvel espace « Livraisons » : l’historique de ce qui est livré, rempli automatiquement.',
    ],
  },
  {
    date: '08/08/2026 15:32',
    title: 'Commandes compatibles smartphone',
    notes: [
      'Barre tactile : pause, time warp, vortex (armer 🌀 puis toucher), zoom auto, recommencer.',
      'Pincement à deux doigts = zoom. Banc replié au démarrage sur mobile et défilable.',
    ],
  },
  {
    date: '08/08/2026 15:24',
    title: 'Auto-déploiement',
    notes: ['Chaque mise à jour est en ligne sur sujet21.vercel.app une à deux minutes après livraison.'],
  },
  {
    date: '08/08/2026 15:09',
    title: 'Zoom manuel, vortex, aide du banc, présets',
    notes: [
      'Molette : zoom manuel ; bouton « Zoom auto » pour reprendre le suivi.',
      'Clic droit : vortex de regroupement — l’eau spirale vers le point cliqué puis est déposée sans élan.',
      'Chaque réglage du banc affiche son explication au survol.',
      'Présets nommés (titre + description) : créer, modifier, charger, supprimer, export/import JSON.',
    ],
  },
  {
    date: '08/08/2026 11:00',
    title: 'Jalon 2 — premier tableau',
    notes: ['Matériaux (hydrophile, hydrophobe), éponge à saturation, sas de sortie et bonbonnes.'],
  },
]
