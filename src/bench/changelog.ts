// Journal des livraisons, affiché dans le banc de réglage (dossier
// « Livraisons »). Rempli automatiquement à chaque livraison — l'entrée la
// plus récente en premier. Les testeurs voient ainsi ce qui a changé sans
// quitter le jeu.

export interface Delivery {
  date: string // JJ/MM/AAAA HH:MM (heure de Paris)
  title: string
  notes: string[]
  // illustration optionnelle (capture, schéma) : chemin sous /assets/,
  // affichée dans l'écran LIVRAISONS au-dessus des notes
  figure?: string
}

export const DELIVERIES: Delivery[] = [
  {
    date: '20/08/2026 16:30',
    title:
      'Les luminaires, sobres : du métal, et la lumière qu’on voit est la vraie',
    notes: [
      'L’« éclipse » n’était qu’une image pour expliquer le principe — pas un design. L’anneau de lumière dessiné autour du capot est SUPPRIMÉ, sur le plafonnier comme sur la bande : vu du dessus, on regarde le dos de la lampe — du métal (capot brossé, moyeu, pattes de fixation), rien d’autre.',
      'La lumière qu’on voit autour de l’objet est désormais UNIQUEMENT l’éclairage réel : la flaque que la lampe pose au sol (carte de lumière + halo au pied, qui suivent déjà la forme — ronde ou allongée — et la couleur). Le bord du capot garde un liseré discret de lumière remontée du sol, pour que l’objet ne se lise pas comme un trou noir.',
      'Le halo au sol suit maintenant la TAILLE du luminaire : un grand capot baigne dans une flaque plus large que lui, jamais l’inverse.',
    ],
  },
  {
    date: '20/08/2026 15:30',
    title:
      'La bande lumineuse, la vraie : un élément à poser, qui éclaire sur toute sa longueur',
    notes: [
      'CORRECTIF de la livraison précédente, sur le retour du concepteur : le bandeau n’était pas une réglette qui brille — même principe que le plafonnier : on voit un RAIL DE MÉTAL (capot allongé, pattes de fixation tous les 150 unités), et la lumière ne s’échappe qu’en COURONNE tout autour. L’éclipse, allongée.',
      'Et surtout la bande ÉCLAIRE SUR TOUTE SA LONGUEUR : ce n’est plus une lampe ronde déguisée. Chaque point de la cuve voit le point de la bande le plus proche de lui — la retombée, les ombres portées du décor, l’ombre du corps et le biseau des arêtes se mesurent depuis LÀ. Une bande de 800 unités fait un couloir de lumière, pas un rond.',
      'NOUVEL OUTIL dans la palette de l’éditeur, sous la lampe : BANDE. Un clic la pose, la fiche règle longueur (80 à 1600), angle (crans de 15°), hauteur, portée, intensité, couleur, taille — et l’éditeur la dessine en segment à sa vraie longueur, angle lisible d’un coup d’œil. Elle compte dans les 4 lampes du tableau.',
      'Réponse à la question posée : OUI, l’intensité baisse avec la distance — de 100 % au contact à 45 % à la distance « portée », puis l’ambiance générale du tableau fait le plancher (réglable, 0 = noir total hors des lampes). C’est une retombée volontairement douce : les coins restent lisibles. Pour une lumière plus dramatique : baisser l’ambiance générale du tableau et resserrer la portée de chaque lampe.',
    ],
  },
  {
    date: '20/08/2026 14:00',
    title:
      'L’ombre réancrée au contact · la taille des luminaires · les bandeaux lumineux',
    notes: [
      'L’OMBRE, troisième passe, sur deux constats en capture : les gouttes éjectées n’avaient PLUS d’ombre du tout, et l’ombre du corps se décollait de sa silhouette — on lisait plusieurs ombres détachées. Cause : le test de largeur s’appliquait dès le contact, et les rayons qui rasent le bord du corps y échouaient. Il ne s’applique plus qu’AU LOIN : sous 40 unités l’ombre est acquise (le contact ancre les gouttes comme le corps au sol), l’exigence monte jusqu’à 130 unités — là où naissaient les pastilles. Les gouttes retrouvent une petite ombre de contact, le corps une ombre d’un seul tenant, les pastilles lointaines restent mortes.',
      'LA TAILLE DU LUMINAIRE se règle par lampe dans l’éditeur (curseur 0 à 3) : 0 la rend invisible — la lampe éclaire sans qu’on la voie —, 3 en fait une grosse pièce de plafond. Le réglage ne touche que l’objet, jamais l’éclairage.',
      'LES BANDEAUX LUMINEUX : nouvelle forme de luminaire, au choix dans la fiche de la lampe (Plafonnier / Bandeau). Une réglette émissive — elle, on la voit briller, c’est une réglette, pas un capot — avec ses rails de métal le long des bords et ses cellules discrètes façon tube fluorescent. LONGUEUR (80 à 1600 unités) et ANGLE (par crans de 15°) se règlent dans la fiche. L’éclairage reste celui de la lampe : le bandeau est le corps visible, pas une nouvelle source.',
    ],
  },
  {
    date: '20/08/2026 12:30',
    title:
      'Retouches signalées : l’ombre des gouttes (bis), le luminaire-éclipse, le hub compact dans l’éditeur',
    notes: [
      'L’OMBRE DES GOUTTELETTES, deuxième passe — la première ne suffisait pas. Le vrai discriminant est désormais un TEST DE LARGEUR : à chaque point où le rayon d’ombre rencontre de la matière, deux prélèvements perpendiculaires à ±45 unités vérifient qu’elle est LARGE. Le corps (plusieurs centaines d’unités) les remplit toujours ; une goutte (~26 unités) jamais — son ombre s’éteint, quelle que soit sa densité. Les traînées d’éjection ne sèment plus de pastilles noires sur les parois.',
      'LE LUMINAIRE devient une ÉCLIPSE, comme demandé : vu du dessus on regarde le DOS de la lampe — un capot de métal plein, pas une vitre lumineuse. La lumière ne s’échappe plus qu’en COURONNE autour du capot (blanche au ras du métal, couleur de lampe vers l’extérieur), découpée par les quatre pattes de fixation. Le capot garde son moyeu central et un brossage concentrique discret.',
      'LE HUB COMPACT (HUB2) apparaît dans la liste des tableaux livrés de l’éditeur, juste sous le hub actuel : il s’étudie et se copie comme les autres. Pour qu’une copie retravaillée devienne LE laboratoire joué, la publier sous le code HUB.',
      'Et ces NOTES DE VERSION rattrapent leur retard : les cinq livraisons depuis le 17/08 (ci-dessous) étaient bien en ligne mais n’avaient pas été consignées — d’où le doute légitime du concepteur. Le journal est de nouveau la source de vérité.',
    ],
  },
  {
    date: '20/08/2026 10:15',
    title: 'Les lampes ont un corps : le plafonnier de station',
    notes: [
      'Chaque lampe posée à l’éditeur dessine désormais SON LUMINAIRE à sa position — jusqu’ici la lumière tombait de nulle part. Il est dessiné PAR-DESSUS l’eau (il est au plafond : le fluide passe dessous, l’ombre du corps ne l’atteint pas) et n’éclaire RIEN de plus : tout l’éclairage vient toujours de la carte de lumière — c’est l’objet, pas la lampe.',
      'Sa taille suit la HAUTEUR de la lampe (plus haute = plus proche de la caméra) : 14 unités à la hauteur par défaut, 11 en rasante, 26 au plafond maximal. Sa teinte et sa brillance suivent la couleur et l’intensité réglées à l’éditeur.',
      'Seules les lampes DÉCLARÉES ont un corps : la lampe par défaut des tableaux sans lumière reste invisible — elle est l’éclairage ambiant de la cuve, pas un objet du décor. Les tableaux existants ne changent donc pas.',
    ],
  },
  {
    date: '20/08/2026 09:45',
    title:
      'Les gouttelettes ne sèment plus de pastilles d’ombre (première passe)',
    notes: [
      'Signalé sur mobile : les traînées de gouttelettes projetaient un chapelet de boules d’ombre sur les parois. Cause : l’ombre du volume marche du pixel vers chaque lampe en huit prélèvements du champ et prenait le MAX — une gouttelette qui interceptait UN prélèvement ombrait autant que le corps entier.',
      'Deux garde-fous posés : la densité (l’intérieur du corps sature le champ, une goutte isolée dépasse à peine le seuil) et la couverture (un prélèvement touché → ombre à moitié, deux et plus → pleine). Insuffisant en pratique — renforcé le jour même par le test de largeur (entrée du dessus).',
    ],
  },
  {
    date: '19/08/2026 20:30',
    title:
      'Plus un sifflement : voix de bruit blanc retirées, six bruitages refaits sombres',
    notes: [
      'Les sons qui faisaient mal avaient tous le même défaut, MESURABLE : leur énergie au-dessus de 3 kHz. goutte-rosee : 99 % (un tintement de verre pour une goutte d’eau) ; condensation : 76 % ; souffle-vapeur : 73 %. Les six pires fichiers sont remplacés par les enregistrements du concepteur — goutte-rosee, condensation, souffle-vapeur, eponge, gel, vortex-sas — tous à 0 % d’aigus, calés sous 200-800 Hz.',
      'Quatre voix de SYNTHÈSE sifflaient encore, fabriquées en direct dans le code (du bruit blanc filtré) : la bouffée qui doublait CHAQUE vaporisation (le fameux « pschhh » de transformation), celle de la condensation, les douze éclats cristallins du gel (2600-5100 Hz — la chose la plus aiguë du jeu), et le scintillement de la visée du dash (3400 Hz sur le geste le plus fréquent du jeu). Toutes retirées ; chaque geste garde sa voix grave et son fichier.',
      'Verdict, mesuré sur les douze bruitages embarqués : onze à 0,0 % d’énergie au-dessus de 3 kHz, un à 1,8 % (impact-glace — c’est un choc de glace, il a le droit). Les anciens masters sont archivés en -v1, la chaîne tools/audio/prepare.py reste reproductible d’une commande. docs/assets-audio.md consigne les quinze prompts de la palette, mesures comprises.',
    ],
  },
  {
    date: '19/08/2026 19:15',
    title:
      'La vapeur ne siffle plus : une nappe enregistrée à la place du bruit blanc',
    notes: [
      'Le son d’état de la vapeur n’était pas un fichier : du bruit blanc filtré en boucle, généré en direct — et un bruit blanc reste un sifflement, deux filtres et deux LFO y étaient déjà passés. Il est remplacé par la nappe enregistrée du concepteur (30 s, rien au-dessus de 800 Hz, elle respire d’elle-même), pilotée à la frame par la quantité de vapeur comme avant.',
      'Le rebouclage se fait à 0,12 s des bords du fichier : la couture tombe en pleine matière, pas sur les fondus — aucun « toc » toutes les 30 secondes. Si le fichier ne se charge pas (hors ligne), l’ancienne voix de synthèse reprend la main : une nappe sommaire vaut mieux qu’un silence.',
      'La FLORAISON remplace le jet : vaporisation.mp3 n’est plus un « pschhh » sous pression mais l’épanouissement chaud livré par le concepteur (4 s, 62 % de l’énergie sous 200 Hz). L’ancien master est archivé, plus référencé.',
    ],
  },
  {
    date: '18/08/2026 11:45',
    title:
      'L’acte 0 d’une traite : onze battements sur les sept planches paysage',
    notes: [
      'Les SEPT images 16:9 du concepteur sont intégrées (1600×900, WebP) : les quatre planches de l’ouverture — jusqu’ici portrait, rognées de moitié sur mobile où le jeu force le paysage — et les trois nouvelles du départ. Plus aucun SVG provisoire dans les cinématiques livrées.',
      'L’OUVERTURE devient l’acte 0 COMPLET : onze battements qui traversent les sept planches, de la cuve au seuil du sas. Quatre battements ajoutés après « Le confinement cède » : le module vide (fondu au noir, la musique bascule du tiède au glacial — le module s’est refroidi), la cuve crevée, le couloir qui aspire, et le seuil — « Rien ne se perd. Tout ce qui passe compte. »',
      'LE DÉPART reste à côté, en version courte : les quatre mêmes derniers battements. La logique roguelike : l’ouverture complète ne passe qu’au tout premier lancement, le départ se rejoue à chaque run — le joueur qui repart reconnaît le couloir sans se retaper la naissance.',
    ],
  },
  {
    date: '17/08/2026 16:15',
    title: 'L’ÉDITEUR aussi : plus un seul code à taper de mémoire',
    notes: [
      'Suite du correctif précédent, signalé par le concepteur : dans la fiche du tableau, CINÉ À L’ENTRÉE, CINÉ EN SORTIE et SÉQUENCE IN-MAP réclamaient un code au clavier, sans rien proposer. Ce sont désormais des MENUS DÉROULANTS alimentés par les vrais éléments : toutes les cinématiques connues (livrées, composées sur le poste, partagées en ligne) et toutes les séquences, par leur TITRE, code entre crochets. Idem sur le panneau d’une ZONE sélectionnée : ses champs Cinématique et Séquence sont des menus.',
      'Les listes se remplissent à CHAQUE ouverture de l’éditeur : composez une cinématique au montage, revenez au tableau, elle est déjà dans le menu. Et comme au montage, un code branché mais introuvable reste affiché « (introuvable) » plutôt que d’être effacé en silence — un tableau ne perd jamais son réglage parce que la bibliothèque partagée n’est pas encore arrivée, ou parce qu’un ami n’a pas encore publié sa cinématique.',
    ],
  },
  {
    date: '17/08/2026 15:30',
    title:
      'Le champ CINÉMATIQUE propose enfin les titres · l’ouverture s’étoffe · une deuxième livrée',
    notes: [
      'CORRECTIF signalé par le concepteur : dans le scénario (et dans l’action « jouer une cinématique » d’une séquence), le champ CINÉMATIQUE ne proposait rien — il fallait taper le code de mémoire. C’est désormais un MENU DÉROULANT qui liste toutes les cinématiques connues PAR LEUR TITRE (livrées, poste, partagées), avec leur code entre crochets. Un code branché mais introuvable (cinématique pas encore composée, ou partagée pas encore arrivée) reste affiché « (introuvable) » et n’est JAMAIS perdu : un tableau ne se dérègle pas parce que la liste est incomplète.',
      'L’OUVERTURE passe de quatre à SEPT planches. Trois battements ajoutés, sans une image de plus : la même planche resservie avec un autre cadrage et une autre réplique — c’est du montage. « Vingt tentatives. Vingt échecs. Puis vous. » sur la cuve qui monte ; « Ils ne vous regardent pas. Ils vous relèvent. » sur les Créateurs ; « Ils partent. Personne ne vient vous chercher. » sur l’alerte qui s’éloigne.',
      'UNE DEUXIÈME CINÉMATIQUE LIVRÉE : LE DÉPART (code DEPART) — le module vide, l’unique ouverture au bout du couloir, ce qui passe compte. Elle se branche au moment « lancement-run » du scénario (le sas du hub). Ses planches sont pour l’instant les esquisses géométriques provisoires : elles attendent leurs images.',
    ],
  },
  {
    date: '17/08/2026 14:30',
    title:
      'LES SÉQUENCES IN-MAP : la mise en scène agit sur le tableau lui-même',
    notes: [
      'Une cinématique montre des planches PAR-DESSUS le jeu ; une séquence agit DANS le jeu, sans l’interrompre. Nouvel onglet SÉQUENCES au montage : une liste d’étapes jouées dans l’ordre, chacune durant son temps. NEUF ACTIONS : attendre · teinter les lampes (couleur + intensité) · bruitage · ponctuation · changer la musique · OUVRIR UNE PORTE (la brèche) · afficher une carte · secouer l’écran · jouer une cinématique (la séquence attend sa fin). Le champ pertinent seul s’affiche : une couleur pour les lampes, un n° de porte pour la brèche, la liste des sons pour les bruitages.',
      'LA BRÈCHE réutilise la machinerie éprouvée des portes laser : une porte dont la cible est NÉGATIVE est désormais une porte SCÉNARISÉE — une paroi pleine, solide au solveur, qu’aucun faisceau n’ouvre et que seule une séquence peut crever. Vérifié en jeu : la paroi barre le passage, l’alerte vire au rouge, l’écran tremble, la porte disparaît du solveur et le fluide passe. Une brèche ouverte ne se referme jamais (c’est un événement, pas un interrupteur) ; un R remet le tableau à neuf, paroi comprise.',
      'DEUX DÉCLENCHEURS, dans l’éditeur : le champ SÉQUENCE du tableau (elle démarre à chaque essai) et le champ SÉQUENCE d’une zone (elle attend que le corps y entre, une fois par essai) — même grammaire que les cinématiques. La mise en scène avance au TEMPS DE JEU : une pause la suspend, elle ne triche pas avec le chrono. Et elle ne touche JAMAIS aux données du tableau : les lampes sont teintées sur une copie de rendu, l’original est intact. La séquence ALERTE est livrée comme gabarit (à DUPLIQUER).',
    ],
  },
  {
    date: '17/08/2026 13:00',
    title:
      'LE SCÉNARIO : les cinématiques hors tableau, sous conditions (le fil du roguelike)',
    notes: [
      'Le hub n’est pas un tableau — il n’a donc pas de fiche où poser une cinématique. Et une run n’est pas un tableau non plus. Nouvel onglet SCÉNARIO dans la table de montage (menu ET éditeur) : UN seul scénario, global au jeu, une LISTE DE RÈGLES qui se lit de haut en bas — la PREMIÈRE qui correspond gagne. Rangez le particulier au-dessus du général, comme un aiguillage.',
      'CINQ MOMENTS : au tout premier lancement, à l’arrivée au hub, au lancement de la run (le sas du hub — il n’était branché nulle part, c’est fait), quand la run est perdue, quand l’expédition est achevée. SIX CONDITIONS, toutes puisées dans ce que le jeu mémorise déjà : toujours · première partie · runs finies ≥ N · meilleure salle atteinte ≥ N · trophée débloqué · condensat ≥ N. Et la case décisive, UNE SEULE FOIS : la règle est retenue pour toujours — c’est elle qui empêche l’ouverture de se rejouer au deuxième run. Un bouton ↺ efface cette mémoire pour retester comme un joueur neuf.',
      'Exemple vérifié en sonde : « arrivée au hub / première partie → OUVERTURE (une fois) » puis « arrivée au hub / runs ≥ 3 → MIROIR (une fois) ». Première partie : l’ouverture. Runs 1 et 2 : rien. Run 3 : la révélation. Run 4 et au-delà : plus rien — jamais deux fois. Le scénario se partage comme les cinématiques (⇪ PARTAGER dans l’onglet) : il fait alors foi sur tous les postes, et le jeu le garde hors ligne.',
    ],
  },
  {
    date: '17/08/2026 12:00',
    title:
      'Le travail à deux : cinématiques PARTAGÉES et bibliothèque d’IMAGES importables',
    notes: [
      'La table de montage a maintenant trois rayons : les LIVRÉES (avec le jeu), le POSTE (votre navigateur), et les PARTAGÉES (◇) — la bibliothèque en ligne commune. Le bouton ⇪ PARTAGER publie la cinématique sélectionnée : elle devient visible ET jouable par son code sur tous les postes (les ancrages des tableaux la trouvent : livrées → poste → partagées). Re-partager le même code remplace la version pour tout le monde ; SUPPRIMER sur une partagée la retire de la bibliothèque. Une partagée se retouche en la DUPLIQUANT, puis en re-partageant.',
      'LA BIBLIOTHÈQUE D’IMAGES (bouton 🖼 Images de l’éditeur) : importez vos visuels directement — recompressés en WebP (≤ 1600 px) côté client avant l’envoi, hébergés en ligne, visibles de tous. Chaque vignette donne son LIEN (copié au presse-papier) et se retire d’un ✕. Dans le montage, le bouton ▣ à côté du champ IMAGE ouvre la bibliothèque en SÉLECTEUR : cliquer une vignette branche l’image sur la planche. Plus besoin de passer par le dépôt pour les planches d’une cinématique.',
      'Garde-fous : hors ligne, tout le partage échoue proprement (statut affiché, rien de perdu — le poste reste intact) ; les cinématiques partagées ne transportent que des RÉFÉRENCES d’images (jamais le pixel : le serveur les refuse) ; un pont CI de diagnostic (diag-cines) vérifie l’aller-retour complet des deux API depuis un poste qui, lui, voit le site.',
    ],
  },
  {
    date: '17/08/2026 11:00',
    title:
      'Les cinématiques s’ancrent aux tableaux : à l’entrée, en sortie, ou sur une zone',
    notes: [
      'Un tableau peut maintenant DÉCLARER ses cinématiques, par leur code de la table de montage. Trois ancrages : CINÉ À L’ENTRÉE (jouée à l’arrivée dans le tableau — pas au simple « recommencer », et MAINTENIR la saute toujours), CINÉ EN SORTIE (jouée à la conclusion, par-dessus le bilan qui l’attend derrière), et le DÉCLENCHEUR EN COURS DE TABLEAU : n’importe quelle zone peut porter un code — quand le corps y entre, la cinématique se joue, une fois par essai. Une zone « libre » avec un code est un pur déclencheur, invisible et sans effet d’état ; une zone d’état avec un code fait les deux.',
      'Tout se règle DANS L’ÉDITEUR : deux champs sur la fiche du tableau (Ciné à l’entrée / Ciné en sortie), un champ Cinématique sur chaque zone sélectionnée — et le bouton ▤ MONTAGE dans la barre de l’éditeur ouvre la table par-dessus, pour composer puis brancher sans quitter son tableau. Le bouton MONTAGE de la fiche d’accueil reste. Les trois ancrages voyagent avec le tableau (sérialisés, bornés à 24 signes, testés) ; un code inconnu est ignoré sans bruit.',
      'Pendant une lecture, la simulation est EN PAUSE : rien ne bouge, rien ne se perd — au retour, le tableau est exactement où on l’a laissé. Vérifié en sonde navigateur : entrée jouée à ESSAYER, saut par Échap, zone déclenchée à l’instant où le corps y pénètre, et pas de rejeu dans le même essai.',
    ],
  },
  {
    date: '17/08/2026 10:00',
    title:
      'Les assets du concepteur : les fioles des semblables, et l’ouverture en vraies planches',
    notes: [
      'LA CINÉMATIQUE D’OUVERTURE a ses vraies images : les quatre planches générées par le concepteur remplacent les esquisses SVG — la cuve dans le laboratoire endormi, les Créateurs vus DEPUIS la cuve (le point de vue de la substance), l’alerte rouge où ils s’enfuient, et la brèche étoilée d’où perlent les premières gouttes. La continuité du regard, de l’intérieur du verre, porte toute la séquence. À voir : MONTAGE → ▶ LIRE.',
      'L’asset du concepteur (une fiole de confinement cryogénique, deux états) est détouré et intégré : deux sortes de décals — FIOLE OCCUPÉE (la masse bleu-sarcelle en suspension) et FIOLE VIDE (verre embué, voyant rouge au socle). Dans le hub compact, les trois niches de l’alcôve nord en portent chacune une : deux occupées… et la VIDE au centre, juste sous « NE PAS RÉVEILLER ». La question s’impose d’elle-même.',
      'Techniquement : même pipeline que l’écran de contrôle (détourage géométrique, deux états recadrés au pixel près dans le même cadre — l’échange occupée→vide, le jour de la libération des semblables, ne bougera pas d’un cheveu), et les deux sortes voyagent avec les tableaux : l’éditeur peut en poser partout, la sérialisation les garde.',
    ],
  },
  {
    date: '17/08/2026 09:30',
    title:
      'LES CINÉMATIQUES : des planches illustrées entre les tableaux, et une table de montage',
    notes: [
      'La troisième famille d’écrans, entre le menu et le tableau jouable — le socle de l’OUVERTURE de la démo. Une cinématique est une DONNÉE, comme un tableau : une suite de PLANCHES (image plein écran, texte, durée), chacune animée par un vocabulaire fermé d’effets — zoom avant/arrière, panoramique (4 sens), tremblement, ALERTE (battement rouge) — avec fondu d’entrée (noir/blanc), et le son par planche : un bruitage, une ponctuation, une piste musicale imposée. Règles de confort câblées d’office : TOUCHER passe à la planche suivante, MAINTENIR saute toute la cinématique (une jauge l’annonce), Échap aussi — en roguelike, on ne subit jamais deux fois l’ouverture.',
      'LA TABLE DE MONTAGE (bouton MONTAGE de la fiche) : le concepteur a la main — planches réordonnables, tous les champs éditables avec vignette, lecture immédiate (▶ LIRE), NOUVELLE/DUPLIQUER/SUPPRIMER, EXPORTER/IMPORTER en JSON. Toute édition s’enregistre sur le poste à l’instant même. Une cinématique d’ESSAI est livrée en images provisoires (l’esquisse de l’ouverture : la cuve, les Créateurs, l’alerte, la brèche) — en lecture seule, à DUPLIQUER pour s’en servir de gabarit.',
      'Sous le capot, la file d’essai est devenue MIXTE : tableaux et cinématiques s’y enchaînent librement — l’ouverture jouable branchera exactement là (planches, puis la cuve, sans un raccord de code). Le format est borné et tolérant (durées 1..30 s, vocabulaire vérifié, une planche corrompue est écartée sans jeter le reste), et le tout est couvert par des tests.',
    ],
  },
  {
    date: '17/08/2026 05:00',
    title:
      'LE HUB COMPACT (chantier démo) : pictogrammes d’état, en parallèle de l’actuel',
    notes: [
      'Premier chantier de la démo Steam fest (bible v3.1). Un nouveau module d’accueil COMPACT (3500×1600, contre 8000×3600 pour l’actuel), parcellisé à l’ISS : la CUVE à l’ouest, le POSTE DE GESTION au centre, l’alcôve de CONSERVATION au nord (trois niches — les fioles des semblables y prendront place dès que l’asset sera généré), et le SAS DE LANCEMENT à l’est derrière une chicane courte. L’écran de contrôle veille au mur, trois lampes teintées (froide sur la cuve, neutre au poste, verte au sas), lumière générale à 42 %.',
      'LES PICTOGRAMMES D’ÉTAT, tels que spécifiés : un rectangle à la couleur du matériau, trois rangées de points EAU/GLACE/VAPEUR notées 0..3 (0 inefficace · 1 confine · 2 efficace · 3 l’outil idéal) — SANS UN MOT, volontairement énigmatique. Sept panneaux au-dessus de l’établi, aux notes tirées des VRAIES règles du jeu : éponge 3/1/1, plaque froide 3/1/2, chaudière 2/3/0, évent 1/1/0, membrane 0/1/1, rideau 1/0/1, surchauffeur 1/1/0. Le format voyage avec les tableaux (sérialisé, borné) : l’éditeur pourra en poser partout.',
      'EN PARALLÈLE, comme demandé : le hub actuel reste le hub joué — le compact se visite par le bouton HUB COMPACT de la fiche d’essai (un essai hors expédition, sans toucher aux registres). La bascule attendra la validation du module.',
    ],
  },
  {
    date: '17/08/2026 03:30',
    title:
      'RELIEF 2.5D des parois (expérimental) : les flancs se révèlent en se déplaçant',
    notes: [
      'La demande du concepteur : « si je déplace la caméra à gauche, j’apercevrai les faces droites des éléments ». C’est la perspective des jeux vus de dessus (Hotline Miami) : chaque paroi a une HAUTEUR, son sommet fuit le centre de la caméra, et sa face latérale apparaît du côté qui regarde le centre — celui qu’on aborde en se déplaçant. Implémenté dans le shader pour les murs, l’hydrophile et l’hydrophobe : le remplissage et les habillages suivent le SOMMET déplacé, le flanc (sombre, teinté matériau) se peint entre base et sommet, échantillonné à deux hauteurs pour que les parois minces ne laissent pas de trou.',
      'Trois ancrages garantis : la PHYSIQUE, les ombres portées et les auras restent à la BASE (l’empreinte réelle ne bouge pas d’une unité) ; l’effet S’ESTOMPE au dézoom (caméra lointaine = vue orthographique — le plan large reste une carte) ; et il est DÉBRANCHABLE. Réglage dans PARAMÈTRES → RELIEF DES PAROIS : off (défaut, le temps de la validation à la manette), léger, fort. Le coût shader n’existe que branché, et seulement sur les pixels proches des parois. À valider sur appareil réel : activez LÉGER et déplacez-vous le long d’un couloir.',
    ],
  },
  {
    date: '17/08/2026 02:40',
    title:
      'Les veilleuses assagies : le vaisseau respire, il ne clignote plus comme un sapin',
    notes: [
      'Le retour de test : « beaucoup trop de LED de couleur, ça fait sapin de Noël ». La recette des veilleuses de paroi mettait une lumière sur UN TIERS des cellules de 300 unités, dont 40 % en orange et rouge à plein gain — une centaine de LED bariolées sur le plan du hub, qui disputaient l’attention aux mécanismes.',
      'Passe de sobriété : une veilleuse sur SEPT cellules (moitié moins que d’avant), le turquoise discret domine largement (82 %), l’ambre est rare (14 %), le rouge exceptionnel (4 % — une alarme oubliée doit rester un ÉVÉNEMENT qu’on remarque), et le gain global baisse d’un tiers. Les poussières en dérive et la respiration des machines ne bougent pas : le vaisseau a toujours l’air alimenté — il a juste cessé de le crier. Vérifié sur le plan du hub : les portes, le sas et les pancartes redeviennent ce qui accroche l’œil.',
    ],
  },
  {
    date: '17/08/2026 02:00',
    title: 'LUMIÈRE GÉNÉRALE réglable à l’éditeur : le noir total existe enfin',
    notes: [
      'Le système de lampes éclairait — mais même sans aucune lampe, la pièce gardait 52 % de sa lumière : un plancher d’ambiance codé en dur dans le shader. Il devient un réglage DU TABLEAU : « Lumière générale (%) », dans la fiche de l’éditeur (à côté de la musique et des dashs). 52 % = le niveau historique (les tableaux existants ne bougent pas d’un photon) ; 0 % = noir total hors des lampes — elles deviennent la seule source, et une vraie mécanique de conception : couloir plongé dans le noir, salle éclairée par une unique lampe rouge, chemin de lumière à suivre.',
      'Le volume suit : l’eau, la glace et la vapeur voient leur plancher d’éclairage suivre la même ambiance (0,52 → 0,30, la calibration d’origine, proportionnelle en dessous). Le réglage voyage avec le tableau (sérialisé, relu, borné 0..1 — un fichier étranger ne peut rien injecter), la frappe s’applique en direct à l’essai. Vérifié en capture A/B à 52 % contre 6 % — la pénombre tombe, les lampes tiennent leur rond de lumière. 206 tests.',
    ],
  },
  {
    date: '17/08/2026 01:00',
    title:
      'Premier asset du hub : l’écran de contrôle prend le mur de l’observation',
    notes: [
      'Le concepteur a généré le premier asset de la série hub — l’écran de contrôle, DEUX ÉTATS au châssis identique (éteint / allumé) dans une seule image, exactement le langage visuel du jeu. L’image livrée sur fond opaque a été détourée par GÉOMÉTRIE : la photométrie ne pouvait rien (le fond et l’écran éteint ont la même luminosité moyenne, 33 contre 32) — graines sur le métal éclairé, fermeture de la silhouette, remplissage des trous enclavés (l’écran), boucle de tuyaux basse récupérée, et recadrage COMMUN aux deux états pour un calage au pixel le jour de l’allumage.',
      'L’écran ÉTEINT est monté en salle d’observation, sous sa pancarte HORS TENSION — vérifié en jeu, capture à l’appui. L’état ALLUMÉ est chargé et prêt : il attend le chantier méta-progression (tableau des runs). Le pipeline des décalques accepte désormais ecran-off / ecran-on ; les six prompts restants de la série (banc, casiers, berceau, porte de sas, hublot, armoire) sont entre les mains du concepteur.',
    ],
  },
  {
    date: '17/08/2026 00:00',
    title:
      'Pancartes : le paysage mobile les interdisait TOUTES (la colonne prise pour une barre)',
    notes: [
      'Les captures d’écran du testeur ont donné la cause en une image : sur téléphone et tablette en PAYSAGE, la barre tactile devient une COLONNE à gauche (et le sélecteur d’état une colonne à droite). Or la « bande basse interdite » — la zone où une pancarte s’efface pour ne pas passer sous les boutons — se calculait depuis le SOMMET de ces barres. Une colonne qui commence à 76 pixels du haut : la zone interdite couvrait 85 % de l’écran, et TOUTES les pancartes étaient effacées avant même l’attribution. Sur un poste avec les barres en bas (l’environnement de test d’hier), tout allait bien — d’où le dialogue de sourds.',
      'La règle devient géométrique : seule une vraie barre POSÉE EN BAS définit la bande interdite — large (plus large que haute, et au moins 35 % de l’écran) et dans la moitié basse. Les colonnes latérales ne comptent plus. Rejoué dans la géométrie exacte des captures (écran 999×449, DPR 2, tactile) : ZÉRO pancarte avant, SEPT après — salle d’entraînement, salle d’observation, banc hors service, sas de lancement, toutes à leur place, y compris près du bord bas.',
    ],
  },
  {
    date: '16/08/2026 23:00',
    title:
      'Les pancartes du plan large sont de retour : la carte annotée respire',
    notes: [
      'Le retour de test : « je ne vois plus les panneaux, et l’apparition progressive au zoom a un problème — dommage, très bonne idée ». Mesuré au hub : au plan large, DEUX plaques géantes masquaient la carte entière et 9 pancartes sur 14 étaient effacées. Cause : les pancartes gardaient leur taille de lecture (jamais sous ×1) pendant que la carte rétrécissait sous elles — plus on dézoomait, moins il restait de place, et l’attribution en supprimait presque tout.',
      'Deux corrections. UNE — au plan large, les pancartes RÉTRÉCISSENT avec la carte (plancher ×0,45) : la signalétique redevient une carte annotée — 12 pancartes sur 14 lisibles au plan du hub, et elles grossissent naturellement en zoomant. DEUX — l’attribution gagne une MÉMOIRE : une pancarte affichée garde sa place tant qu’elle tient (les titulaires passent avant les prétendants, et tolèrent un léger chevauchement — hystérésis), au lieu de la perdre parce qu’une voisine s’est approchée du centre du regard. L’apparition progressive au zoom redevient ce qu’elle devait être : des plaques qui entrent et sortent une fois, en fondu, sans va-et-vient.',
    ],
  },
  {
    date: '16/08/2026 22:15',
    title:
      'Le tir rapproché retrouve son caractère : les DÉFORMATIONS sont de retour',
    notes: [
      'Verdict du concepteur après essai : « je préfère avant, avec les déformations ». L’élection historique de la goutte est restaurée : la particule LA PLUS PROCHE DU DOIGT part vers le doigt — un tir posé sur la flaque élit une particule au cœur de la masse et la propulse à travers elle. Le volume est labouré, malaxé, la houle projette des éclats : c’est brutal, organique, et c’est le caractère voulu. L’élection « propre depuis la surface » de cet après-midi assagissait trop le geste ; elle est retirée.',
      'Ce retour n’est PAS un retour au problème d’origine. Ce qui rendait l’ancienne règle infernale n’était pas sa physique, c’était son invisibilité — on payait sans voir. Depuis : les gouttes libres se DESSINENT (traînées liquides), la vie compte le HALO (n’est perdu que ce qui s’en éloigne), et le rappel ramène les éclats restés à portée. Le labour se voit et se paie au juste prix, rien de plus. Les 188 tests passent sans retouche : les contrats (prêt au mur, sortie comptée à la sortie, semées jamais aspirées) visent loin du corps, où les deux élections coïncident.',
    ],
  },
  {
    date: '16/08/2026 21:30',
    title:
      'La goutte qui part se VOIT partir — elle était mathématiquement invisible',
    notes: [
      'La question du retour de test — « est-ce que tu utilises bien le préset par défaut ? » — a tout débloqué. La bibliothèque partagée a été rapatriée (nouvelle gâchette CI diag-presets), et la scène rejouée avec boizcohesioncontrole1, le préset appliqué chez tous les testeurs. Verdict : la comptabilité était JUSTE — les gouttes d’éjection sortent bel et bien, 6 à 7 par impulsion brève, projetées à l’autre bout de la cuve. Ce qui mentait, c’était l’IMAGE.',
      'La preuve est dans le shader : une goutte isolée culmine à 1,0 de champ, et l’amplitude est divisée par (1 + étirement) pour conserver l’encre des traînées. À pleine vitesse : 1,0 ÷ 2,2 = 0,45 — SOUS le seuil de dessin de 0,8. La goutte d’éjection n’était JAMAIS dessinée : ni goutte, ni traînée, rien. Le joueur payait un carburant que l’image ne montrait pas — « le volume se déforme, aucune goutte ne sort, et pourtant la vie baisse ». Depuis toujours.',
      'Correctif : les gouttes LIBRES gardent leur encre (compensation d’étirement douce, ×0,25) et brillent un peu plus que le corps (×1,6) — chaque goutte qui part se voit partir, en traînée liquide, vérifié capture à l’appui. Le corps, lui, est rendu exactement comme avant. Et le banc gagne la gâchette diag-presets : un commit sur diag-presets-go rapatrie la bibliothèque de présets partagée dans le dépôt — les prochains retours de test seront rejoués avec VOS réglages, plus jamais avec ceux d’usine.',
    ],
  },
  {
    date: '16/08/2026 20:30',
    title:
      'La jauge ne cille plus : vivante = dans le HALO, créditée dès le tir, avec hystérésis',
    notes: [
      'Le retour de test tenait toujours : la jauge (et son ambre d’alerte) CLIGNOTAIT — la goutte alternait entre « éjectée » (décomptée) et « à la surface » (recomptée), au rythme des relabels. Deux causes : le décompte au tir précédait le recompte d’un relabel (jusqu’à 5 pas d’écart), et l’ancrage « 3 voisines du corps » oscillait à la frontière, image après image.',
      'La définition devient stable à l’œil. VIVANTE = marquée du corps et dans son HALO (le rayon de capture, celui du rappel — tout ce qui y reste REVIENDRA, le compter vivant est la stricte vérité). Créditée à l’instant même du tir : la goutte part de la surface, donc du halo — la jauge ne cille pas d’une image. La sortie du halo se juge avec HYSTÉRÉSIS (15 % plus loin que l’entrée) : une goutte qui danse à la frontière ne fait pas clignoter la vie. Le ⟳ disparaît : le halo est dans le chiffre principal, à sa place.',
      'Deux règles de bonne fin découvertes en smoke : une goutte en prêt avalée (éponge, sas) quitte la vie sur-le-champ (le compte ne reste pas gonflé jusqu’au relabel suivant), et pendant que le SAS BOIT le halo s’éteint — le corps aspiré ne peut plus rien récupérer, et compter ses miettes empêchait la fin de run de conclure (le sursis se réarmait en boucle, constaté à la trace). Le test anti-clignotement échantillonne CHAQUE pas : le moindre creux d’une image ferait échouer la suite. 188 tests, smokes hub, fin et game over réel (deux passes).',
    ],
  },
  {
    date: '16/08/2026 19:30',
    title: 'LA RÈGLE DE LA VIE : n’est perdu que ce qui SORT du volume',
    notes: [
      'La règle demandée au banc, gravée telle quelle dans la comptabilité : une goutte d’éjection ne compte perdue qu’à l’instant où elle SORT du volume. Tirée mais renvoyée dans la flaque par un mur ? La vie ne bouge pas — la goutte est EN PRÊT : marquée du corps, délai de réabsorption en cours, mais toujours dans la masse. Elle redevient pilotable à l’échéance, et la jauge n’aura jamais cillé. La vie affichée = le corps + les prêts ; le seuil critique (dernière impulsion) juge la même somme.',
      'Être « dans le volume » a une définition précise : ANCRÉE dans la masse — au moins trois particules du corps à un rayon de lien. La connexité seule ne suffisait pas : elle est transitive, et un jet de gouttes qui se touchent aurait compté « vivant » jusqu’au bout du chapelet — la réserve ne se vidait plus en tir continu avec les présets mous. Toucher la masse, pas être enchaîné à elle.',
      'Le ⟳ du HUD se recentre : il ne montre plus que la matière SORTIE mais à portée, que le rappel ramène — les prêts, eux, sont dans le chiffre principal, là où est leur place. Trois tests du contrat : bloquée au mur = la vie ne bouge pas (ni pendant, ni après) ; sortie = perdue dès la sortie ; et le compte de particules du HUD suit la matière vivante. 188 tests au vert, smokes hub, fin de run et game over réel.',
    ],
  },
  {
    date: '16/08/2026 18:45',
    title:
      'L’éjection part TOUJOURS de la surface : fini le tir qui laboure son propre corps',
    notes: [
      'Le retour de test persistait — « une éjection sur trois ne sort pas du volume mais compte perdue » — et la mesure a fini par montrer pourquoi. L’ancienne règle élisait la particule LA PLUS PROCHE DU DOIGT : un doigt posé SUR la flaque (geste naturel au tactile) élisait une particule au CŒUR de la masse, tirée à pleine vitesse dans une direction quasi aléatoire. Elle labourait le corps de l’intérieur, la houle arrachait des voisines projetées au loin — ~5 particules par tir, pour une goutte qui ne SEMBLAIT jamais partir. Le rappel des égarées d’hier n’y pouvait rien : ces éclats volaient hors de portée.',
      'La règle est désormais géométrique et constante : la poussée se lit du CENTRE du corps vers le doigt, et c’est la particule du bord CÔTÉ VISÉE qui décolle. L’éjection sort proprement de la surface, où que le doigt se pose — sur la flaque, à son bord, à l’autre bout de l’écran : même geste, même coût, une goutte. Mesuré sur la scène du rapport (20 tirs posés sur la flaque) : 97 particules perdues avant, 26 après — dont les 20 départs légitimes. Le parasitage passe de ~4 par tir à ~0,3.',
      'Le test du contrat du « prêt » suit la nouvelle réalité : la goutte qui ne sort pas est celle qu’un MUR tout proche renvoie dans la flaque — renvoyée, comptée en retour (⟳), rendue à l’échéance. 187 tests au vert, les invariants de quantité de mouvement inchangés, et les quatre smokes (hub, fin, game over réel, éditeur tactile) avec.',
    ],
  },
  {
    date: '16/08/2026 18:00',
    title:
      'Le retour des égarées : la vie ne baisse plus pour une goutte encore là',
    notes: [
      'Le retour de test avait raison, et ma mesure d’hier était trop propre : en conditions réelles, UN SEUL TIR coûtait jusqu’à 7 particules. La goutte tirée s’écrase au mur (perdue, légitimement)… mais le REMOUS du tir détache des voisines qui gisent à deux doigts du corps — et la réabsorption passait par la seule connexité : une goutte à quinze unités du bord ne se reconnectait JAMAIS. La vie baissait pour de la matière encore là, sous vos yeux.',
      'Le remède : la matière DU CORPS porte désormais une marque — goutte d’éjection, gerbe de péage de vaporisation, fragment arraché par le remous. Son délai de réabsorption purgé, si elle traîne dans le rayon de capture du corps, elle est RAPPELÉE d’elle-même : elle converge, se pose, le corps la reprend. Trop loin ? Perdue là où elle gît — mais la marque reste : passez à portée et elle vous rejoint. Le rappel est antisymétrique (§3.3) : le corps encaisse l’opposé de ce qu’il donne, aucune propulsion gratuite. Pendant que le sas boit, le rappel s’efface devant lui.',
      'Trois exclusions qui font la règle : le souffle d’un dash n’a pas la marque (chassé = plus à vous, c’est son sens), sa rosée non plus, et les gouttes SEMÉES par le tableau s’attrapent toujours au contact — pas d’aimant à collectables. Le ⟳ du HUD suit la marque : il affiche exactement ce qui reviendra, ni plus ni moins. Deux tests de contrat en plus (le remous rend ses fragments ; les semées restent à leur place) — 187 au vert, et les invariants de quantité de mouvement avec.',
    ],
  },
  {
    date: '16/08/2026 17:00',
    title:
      'Sept présets LIVRÉS avec le banc — sept manières de sentir le même fluide',
    notes: [
      'Le banc s’ouvre désormais avec une bibliothèque de sept présets d’usine (marqués ⚙), chacun une INTENTION de jeu et pas un simple jeu de curseurs. ⚙ TEMPO NERVEUX — le ressenti du ×2 sans accélérer le temps : attentes divisées par deux, corps prompt, caméra vive, éjection à 1800 (le plafond mesuré au mur mince). ⚙ SIROP DE CUVE — l’eau épaisse et pensive, pour les casse-têtes. ⚙ CHAMPAGNE — tout pétille, transformations éclair, réabsorption qui pardonne. ⚙ PROTOCOLE D’AUSTÉRITÉ — chaque goutte compte double, pour finir un tableau à la goutte près. ⚙ BALLET ORBITAL — tout glisse et orbite, la lenteur par les forces, pas par l’horloge. ⚙ PALET DE MATCH — la glace reine, rebonds de flipper. ⚙ GEYSER — la vapeur voie royale, l’inverse de l’austérité.',
      'Ils cohabitent proprement avec les vôtres : enregistrer un préset sous le même titre REMPLACE le livré (votre version gagne la fusion), et un livré supprimé reste supprimé sur l’appareil — il ne renaît pas au lancement suivant. Chaque livré passe au tourment en test : clés vérifiées contre les paramètres réels (pas de curseur fantôme), puis une séance condensée — une seconde de tirs contre un mur, bascule vapeur, dash, retour — sans une seule valeur folle ni cuve vidée (185 tests).',
    ],
  },
  {
    date: '16/08/2026 16:10',
    title:
      'La goutte d’éjection : perdue seulement si elle SORT — et le HUD montre ce qui revient',
    notes: [
      'La question posée au banc : selon les présets, une goutte d’éjection qui ne sort pas du volume est-elle perdue ? Mesuré, goutte par goutte : le jeu tranche déjà, et bien. À pleine puissance (1400), la goutte visée dans la masse TRANSPERCE le corps et s’échappe — perdue, légitimement : elle est partie. Avec un préset mou (500), elle retombe dans la flaque, compte perdue pendant le délai de réabsorption (1,2 s)… puis le corps la REPREND à l’échéance. Bilan 90/90 : rien n’était perdu. Les deux mécaniques coexistent depuis le début — perdue si sortie, prêtée sinon.',
      'Le vrai défaut était la LISIBILITÉ : pendant le délai, la jauge baisse sans dire que ça va revenir — et en tir rapide, les baisses se chevauchent au point de se lire comme une perte sèche. Le HUD montre désormais la part EN RETOUR (⟳ +0,04 L, teinte eau, à côté du volume) : les gouttes retombées dans le rayon de capture du corps, que le délai rendra dans un instant. Un prêt affiché comme un prêt. Le souffle d’un dash n’y figure jamais : lui ne revient pas.',
      'Le curseur de cette mécanique reste au banc : reabsorbCooldown (1,2 s). L’allonger rend chaque tir maladroit plus cher ; le raccourcir rend le pilotage plus pardonnant. Deux tests du contrat gardent la règle : restée = rendue, partie = perdue (182 tests).',
    ],
  },
  {
    date: '16/08/2026 15:05',
    title:
      'La barre d’outils de l’éditeur était COUPÉE sur iPad — ESSAYER et ACCUEIL hors champ',
    notes: [
      'Mesuré, enfin : la barre du haut de l’éditeur réclame 1572 pixels de large. Sur un iPad elle n’en a que 1194 (834 en portrait) — sa partie droite passait tout simplement hors de l’écran, sans défilement ni indice. Les boutons perdus : ESSAYER et ↩ ACCUEIL en paysage ; en portrait s’y ajoutaient FICHIER / JSON, COPIER, EXPORTER, la grille et l’aimant. Elle s’ENROULE désormais sur plusieurs lignes : tout est là, tout de suite, sans rien à deviner.',
      'La palette de gauche, elle, mesure 1080 pixels dans une colonne de 620 : la moitié des outils (dont l’étiquette et les rails) vit sous la ligne de flottaison. Elle défilait déjà — mais RIEN ne le disait. Des ombres de défilement paraissent maintenant en haut ou en bas de la colonne, seulement quand il reste quelque chose à voir de ce côté.',
      'Au passage, la réponse à la question : le CLIC DROIT n’ouvre aucune barre d’outils. En jeu il arme le VORTEX (au doigt : le bouton 🌀 de la barre du bas) ; dans l’éditeur il déplace la vue (au doigt : deux doigts).',
    ],
  },
  {
    date: '16/08/2026 14:30',
    title:
      'Le dash de vapeur SOUFFLE sa charge — et ce souffle perle sur les parois',
    notes: [
      'On avance parce qu’on REJETTE : chaque dash de vapeur chasse désormais la queue du nuage vers l’arrière, en éventail. Cette part cesse de vous appartenir — elle file, touche une paroi, et y PERLE en gouttes qui restent au mur. À aller rechercher au prix d’un détour, ou à laisser derrière soi : la vapeur n’est plus un déplacement gratuit, c’est un carburant qu’on brûle et qui laisse une trace.',
      'Il a fallu deux garde-fous pour que ce soit vrai. UN — le souffle reste GAZ le temps du voyage : sans cela il se condensait en plein vol et le rappel de condensation le ramenait aussitôt au corps (c’était exactement le « tout est récupéré immédiatement »). Un compte à rebours de 4 secondes l’empêche de flotter indéfiniment : à bout de course, il perle sur place. DEUX — ni le rappel de condensation ni le rassemblement ne reprennent une goutte qui vient d’être soufflée.',
      'La MEMBRANE fait exception : elle est faite pour arrêter la vapeur, y perler la ferait franchir sous forme de goutte — l’outil de conception perdrait son sens. Le souffle rebondit et perlera ailleurs. Deux réglages au banc : la part du nuage chassée (16 % par défaut) et la vitesse du souffle. Un test du contrat vérifie le dépôt sur la paroi (180 tests au total).',
    ],
  },
  {
    date: '16/08/2026 13:20',
    title:
      'LE GAME OVER, pour de bon : la run se conclut quand la réserve est à sec',
    notes: [
      'La correction précédente était juste… et branchée au mauvais endroit. L’écran de fin guettait la DISPERSION du corps — un état qui n’arrive quasiment jamais en jouant (il faut tomber sous deux particules). La vraie perte, celle que tout le monde vit, c’est la RÉSERVE À SEC : la dernière impulsion donnée, le corps se fige et dérive. Et là, rien ne concluait : le palet dérivait indéfiniment. Voilà pourquoi le game over « ne fonctionnait toujours pas ».',
      'Désormais la run se conclut sur les DEUX pertes. Réserve à sec : un SURSIS de 6 secondes pendant lequel une paroi peut encore renvoyer le palet au sas — puis l’écran paraît. Corps défait : une seconde. Le sas qui AVALE suspend le sursis (la salle peut encore se conclure) et, s’il s’arrête, le compte repart entier — la simple proximité du sas ne suffit pas : un palet qui stationne dans le rayon d’aspiration sans être bu gelait la run pour de bon.',
      'Le bouton de fin de course dit enfin la vérité : en run c’est « EN RESTER LÀ — CONCLURE LA SALLE » (il ne rejoue plus la salle gratuitement — les échantillons de secours n’auraient aucun sens) ; au labo, dans un essai ou un tableau d’éditeur, il relance comme avant. Vérifié en JOUANT, sans forcer aucun drapeau : la réserve vidée par de vraies impulsions, la dernière donnée au pointeur, puis l’attente — l’écran vient seul et le RETOUR AU LABO fonctionne.',
    ],
  },
  {
    date: '16/08/2026 12:10',
    title:
      'Deux pancartes ne se chevauchent plus JAMAIS — et le hub double de taille',
    notes: [
      'Le design des pancartes plaisait, leur empilement au dézoom non : elles gardent une taille de LECTURE quel que soit le zoom (comme les noms sur un plan), et se marchaient donc dessus dès que la carte se resserrait. La place est désormais ATTRIBUÉE, à chaque image : les plaques de SECTEUR (les lieux) servies d’abord, puis les pancartes de détail, de la plus proche du regard à la plus lointaine ; ce qui ne rentre plus s’efface en fondu et revient dès qu’on zoome. Résultat garanti par la mesure : ZÉRO chevauchement, à tous les zooms — et le plan large se lit comme une carte, les lieux sans le bavardage. Les barres d’interface (sélecteur d’état, barre tactile, relevé du haut) sont également interdites de séjour : plus une pancarte à moitié cachée derrière un bouton.',
      'Chaque étiquette porte donc une PORTÉE, réglable dans l’éditeur pour vos propres tableaux : « secteur » nomme un lieu et survit au dézoom, sans mention elle commente un objet et cède la place.',
      'Et le module Méduse double de surface : 8000 × 3600 (contre 4800 × 2200). Chaque fonction a SA pièce, assez vaste pour se reconnaître de loin — la cuve d’entraînement, le hall carrefour, l’observation au nord, le placard au sud dont les cinq casiers s’étalent maintenant sur 2400 unités, la salle d’étalonnage, le conduit en chicanes, le sas. Le trajet reste serpentin : on traverse des lieux, on ne glisse pas dans un couloir.',
    ],
  },
  {
    date: '16/08/2026 05:35',
    title: 'Rogner au stylet : les poignées se laissent enfin attraper',
    notes: [
      'Deux façons de rogner une paroi, et toutes deux marchent désormais à l’iPad. L’OUTIL DÉCOUPE (vraie soustraction) ne demandait déjà aucune précision : on touche la paroi qui prend le dessus, puis celle qui s’efface — seule la zone commune est rongée. Les POIGNÉES, elles, étaient inattrapables : leur zone sensible faisait 9 pixels, taillée pour une souris. Elle s’élargit à 22 pixels dès qu’un doigt ou un stylet touche la carte (le dessin, lui, ne change pas : viser large sans alourdir l’écran), et la tolérance fine revient d’elle-même à la souris.',
    ],
  },
  {
    date: '16/08/2026 05:10',
    title:
      'La fin de run s’annonce toute seule, on peut abandonner — et l’éditeur se laisse faire à l’iPad',
    notes: [
      'LE GAME OVER MARCHE ENFIN. Il fonctionnait, mais il ne se MONTRAIT pas : la dispersion laissait l’écran muet et il fallait deviner qu’il fallait presser R pour voir le verdict. Désormais, une seconde après la perte du corps — le temps de le voir se défaire — l’écran paraît de lui-même : « ÉCHANTILLON DISPERSÉ » et le bouton REPRENDRE tant qu’il reste un échantillon de secours, « ÉCHANTILLON PERDU — FIN DE LA RUN » et le RETOUR AU LABO quand c’était le dernier.',
      'ABANDONNER UNE RUN : nouveau bouton sur la fiche d’essai (menu ≡ en jeu) — il arrête la run en cours et réveille au labo, exactement comme à l’arrivée dans le jeu. En DEUX temps (le second clic confirme) : une expédition ne se perd pas d’un clic de travers.',
      'L’ÉDITEUR AU STYLET (iPad). Trois corrections. UN — le pincement zoome la CARTE et non la page : les gestes propriétaires de Safari sont étouffés sur la scène (« user-scalable=no » ne suffit pas depuis iOS 10, l’interface partait à l’échelle avec le décor). DEUX — au doigt et au stylet, on SÉLECTIONNE d’abord, on déplace ensuite : le premier appui ne fait que désigner, la moindre dérive de la pointe ne déplace plus ce qu’on voulait seulement choisir (à la souris, le glisser direct reste inchangé). TROIS — une capture de pointeur non protégée pouvait emporter tout le geste : elle ne peut plus rien casser.',
      'ÉTIQUETTES SUR PLUSIEURS LIGNES : le champ Texte devient une vraie zone de saisie — ENTRÉE fait un saut de ligne, conservé de l’éditeur jusqu’au décor (et « SUR-TITRE|TITRE » dessine toujours une pancarte). Vérifié au banc : 18 contrôles sur la fin de run et l’abandon, 10 sur l’éditeur tactile, 179 tests unitaires.',
    ],
  },
  {
    date: '16/08/2026 04:15',
    title:
      'Pancartes de station, réveil neutre — et la fiche sans boutons pointillés',
    notes: [
      'Trois remarques du joueur. UN — les deux boutons pointillés de la fiche (parcours test, éditeur) faisaient tache : ils rejoignent la GRILLE D’OUTILS de la console, tuiles ÉDITEUR et PARCOURS TEST au même style que SALLES et RECORDS — des outils, pas des actions de jeu.',
      'DEUX — la signalétique du hub devient de vraies PANCARTES de station-labo : tôle sombre en dégradé, rail de fixation vissé pleine largeur, titre rétroéclairé par la teinte de la surface, et une bande de danger hachurée sous la seule pancarte du SAS DE LANCEMENT. Le placard s’étale sur toute la largeur de sa pièce, ses pancartes en quinconce sur TROIS hauteurs — plus rien ne se chevauche, même dézoomé ; la pancarte de secteur attend dans le hall, près de la porte.',
      'TROIS — l’échantillon naissait posé sur l’agrès hydrophile de la cuve : réveil NEUTRE désormais, les deux agrès (hydrophile, hydrophobe) reculent aux bords de la cuve — on les rejoint pour sentir les surfaces, ils ne vous collent plus au réveil. Les 13 contrôles du banc hub passent.',
    ],
  },
  {
    date: '16/08/2026 03:40',
    title: 'Le HUB s’édite : le laboratoire se remodèle depuis l’éditeur',
    notes: [
      'Le module Méduse quitte le code : dans l’éditeur, menu « Tableaux livrés » → « HUB — Le module Méduse » ouvre une copie du laboratoire, à remodeler comme n’importe quel tableau (murs, habillages, plaques de signalétique, éponges, cuve, tout). « Enregistrer comme… » la publie dans la bibliothèque partagée — et dès lors, c’est CETTE version que le jeu joue au réveil, au retour de game over et derrière la fiche d’essai.',
      'La salle spéciale (code HUB) n’entre jamais dans la séquence de l’expédition : elle vit dans la bibliothèque sans compter parmi les salles jouées, et la version codée reste le filet si elle disparaît. Vérifié au banc : les 13 contrôles du hub passent (réveil, sas, vies, game over, reprise).',
    ],
  },
  {
    date: '16/08/2026 03:00',
    title:
      'L’API au RÉGIME : le quota qui a bloqué le magasin ne sera plus jamais atteint',
    notes: [
      'Le tableau de bord de l’hébergeur a désigné le coupable exact : 2 100 « opérations avancées » sur les 2 000 mensuelles du plan gratuit — l’API en consommait UNE PAR LECTURE (bibliothèque, registres, présets), pour chaque joueur, à chaque chargement du jeu. Stockage et transfert, eux, étaient à 2 % des limites : c’est bien l’architecture qui gaspillait, pas le trafic.',
      'Refonte du magasin partagé : la lecture ne coûte plus AUCUNE opération — un pointeur à chemin fixe donne l’URL du document courant, deux téléchargements publics suffisent (du simple transfert de données, budgété 4 000 fois plus large), plus un cache mémoire de 15 secondes. Le décompte ne bouge plus qu’aux écritures — rares : 3 opérations par sauvegarde. Là où un mois de jeu brûlait tout le quota, il en consommera désormais quelques dizaines.',
    ],
  },
  {
    date: '16/08/2026 02:30',
    title: 'Bibliothèque injoignable : le magasin est BLOQUÉ par l’hébergeur',
    notes: [
      'Signalement du joueur : plus aucun tableau dans la séquence de l’éditeur ni dans SALLES. Enquête menée depuis la CI (trois livraisons d’instrumentation : détail des erreurs 500, état du magasin blob par blob) — verdict sans ambiguïté : le magasin de stockage Vercel Blob est BLOQUÉ par l’hébergeur (« Your store is blocked ») : chaque téléchargement répond 403. Les tableaux ne sont pas revenus car RIEN ne peut être lu ni re-semé tant que le blocage tient — c’est une action sur le tableau de bord Vercel (quota du plan gratuit dépassé, très probablement), pas une ligne de code.',
      'Le code en a profité pour se blinder trois fois (bibliothèque ET registres) : un échec de lecture LÈVE une erreur au lieu de passer pour « vide » (le mensonge qui aurait pu coûter la bibliothèque : une écriture repartie du faux vide aurait supprimé l’historique) ; chaque écriture conserve les 4 versions les plus récentes ; et la lecture REMONTE cet historique si la version la plus récente ne répond plus. DÉNOUEMENT après déblocage du magasin : la bibliothèque est réapparue INTACTE — 25 tableaux, le triptyque et ses dernières modifications compris. Rien n’a jamais été détruit : seul l’accès était coupé.',
    ],
  },
  {
    date: '16/08/2026 01:50',
    title:
      'Hub v2 : un ÉTAGE de laboratoire — et l’éditeur met le jeu en pause',
    notes: [
      'Le module Méduse passe de 3200×1500 à 4800×2200 et devient un VRAI étage de labo humain, labyrinthique : la CUVE D’ENTRAÎNEMENT (ouest) → porte centrale → le HALL qui dessert la SALLE D’OBSERVATION (nord) et le PLACARD D’ENTRETIEN (sud, sa propre pièce) → porte HAUTE → la SALLE D’ÉTALONNAGE (machines, banc sur le chemin) → porte BASSE → le CONDUIT DE VENTILATION en chicanes (par-dessus la première, par-dessous la seconde) → SAS DE LANCEMENT. Les portes alternées font le trajet serpentin — on traverse un lieu, on ne glisse pas dans un couloir.',
      'Et l’éditeur met désormais le jeu en PAUSE derrière lui : la physique ne tourne plus dans son dos (batterie et chauffe épargnées) — « Essayer » relance, quitter rend la fiche.',
    ],
  },
  {
    date: '16/08/2026 01:20',
    title:
      'Habillages RACCORDÉS aux boîtes + la signalétique du hub en PLAQUES',
    notes: [
      'Deux remarques du joueur. UN — les textures étaient mal raccordées : le motif était calé sur la grille du MONDE et chaque boîte le tranchait n’importe où. Il se cale désormais sur la BOÎTE : un nombre ENTIER de tuiles (légèrement étirées pour tomber JUSTE aux deux bords) sur les axes assez grands, motif CENTRÉ sur les axes étroits — les caissons finissent en caisson, les hublots en hublot.',
      'DEUX — les écritures du hub, refondues en PLAQUES DE SIGNALÉTIQUE : deux lignes (petit sur-titre mono qui situe — secteur, autorité, nom de la surface — et titre en capitales), fond sombre, liseré teinté, barrette d’accroche. Le placard y gagne un double sens : « HYDROPHILE / CE QUI AIME RETIENT » — le mot ET la poésie d’un coup. Format ouvert à tous les tableaux : un « | » dans le texte d’une étiquette de l’éditeur fait une plaque.',
    ],
  },
  {
    date: '16/08/2026 00:50',
    title: 'Étiquettes monde : taille de lecture garantie, même dézoomé',
    notes: [
      'Remarque du joueur : tout était écrit bien trop petit. Les étiquettes du décor rétrécissaient avec le zoom jusqu’à 60 % d’une base de 10 px — environ 6 px sur le hub dézoommé, illisible. Désormais elles ne descendent JAMAIS sous leur taille de base (portée à 12 px, opacité relevée) — comme les noms sur un plan : le zoom rapproche le décor, pas la lecture.',
    ],
  },
  {
    date: '16/08/2026 00:30',
    title:
      'Hub : étiquettes lisibles, habillages ENFIN fidèles, pastilles à leur place',
    notes: [
      'Autocritique sur capture, quatre corrections. UN — les énigmes du placard se chevauchaient en bouillie : raccourcies et ÉTAGÉES sur deux hauteurs (« CE QUI AIME RETIENT », « LE FROID FIGE, LE FIGÉ FILE »…), idem pour conduit/sas de lancement. DEUX — le banc d’étalonnage rejoint le TRAJET cuve → sas : un îlot blindé qu’on contourne, au lieu d’un recoin qu’on ignore.',
      'TROIS — les HABILLAGES de parois affichaient la tuile de l’AUTRE rangée depuis leur intégration (caissons ↔ aération, hublots ↔ conduites, écrans ↔ poutrelle…) : l’atlas est téléversé retourné (FLIP_Y) et le shader lisait les rangées à l’endroit. Corrigé d’une ligne — TOUS les tableaux montrent désormais l’habillage réellement choisi à l’éditeur.',
      'QUATRE — masquer une pastille du HUD ne faisait rien (le display:flex du style écrasait l’attribut hidden) : réglé — au labo, les pastilles vies et bonbonne disparaissent vraiment. Et le « −0,35 L/s » observé dans la cuve a été mesuré : simple tassement d’après-spawn, le volume est STABLE au repos (vérifié à 4,500 L constants en temps accéléré).',
    ],
  },
  {
    date: '15/08/2026 23:59',
    title:
      'LE HUB : le module Méduse — le jeu commence dans la cuve d’entraînement',
    notes: [
      'Le cœur du roguelike prend forme : le MODULE MÉDUSE, zone de départ. Un labo D’HUMAINS — « les Créateurs », dans la bouche du sujet — pas un espace à soi : on y est observé. Le jeu COMMENCE dans la CUVE D’ENTRAÎNEMENT (l’éveil s’y joue désormais), avec deux agrès pour sentir les surfaces ; le PLACARD D’ENTRETIEN présente chaque surface en énigme (« CE QUI VOUS AIME VOUS RETIENT », « LE FROID FIGE — LE FIGÉ FILE »…) ; la SALLE D’OBSERVATION (écran de contrôle : éteint) et le BANC D’ÉTALONNAGE (hors service) attendent leurs chantiers de méta-progression.',
      'À droite, le CONDUIT DE VENTILATION mène au SAS DE LANCEMENT : ce sas ne collecte rien — il LANCE la run (reprise de l’expédition sauvée s’il y en a une, salle 1 sinon). Au hub, rien ne se paie : pas de records, pas de chrono, pas d’échantillon consommé — la dispersion recompose, simplement. Le HUD y dit LABO.',
      'La boucle roguelike se referme : game over → réveil au hub ; expédition achevée → RETOUR AU LABO ; le sas relance. La fiche reste le méta-menu (records, paramètres, reprise directe et run secondaire y gardent leurs raccourcis) — et derrière elle, au chargement, c’est déjà la cuve du module qui dérive.',
    ],
  },
  {
    date: '15/08/2026 23:15',
    title:
      'Éditeur : les DIMENSIONS DE LA CUVE — les grandes cartes à portée de main',
    notes: [
      'Question du joueur : « comment faire les grandes maps ? » — réponse honnête : on ne pouvait pas depuis l’éditeur (le triptyque avait ses dimensions définies en code). C’est corrigé : une section DIMENSIONS DE LA CUVE (X min/max, Y min/max) dans le panneau Tableau. Le standard fait 2400 × 1500 ; élargissez X à ~4800 pour un diptyque, ~7200 pour un triptyque — dézoom total puis zoom salle par salle en jeu, budgets 96 boîtes / 16 zones.',
      'Garde-fous : écart minimal de 400 (pas de cuve dégénérée), affichage renormalisé à la sortie du champ, Ctrl+Z annule, le brouillon retient les dimensions comme le reste.',
    ],
  },
  {
    date: '15/08/2026 22:50',
    title: 'Une seule vie — les autres se farment : le CONDENSAT arrive',
    notes: [
      'Décision du joueur, façon Hadès : UNE vie, toujours — les échantillons de secours supplémentaires ne se gagnent plus en route (le +1 toutes les trois salles est retiré). Ils se FARMERONT au futur banc d’étalonnage du hub, en sacrifiant des runs.',
      'Et pour que farmer ait un sens dès maintenant : le CONDENSAT, la monnaie méta. Chaque centilitre livré au sas est conservé par le labo, toutes runs confondues — y compris la dernière salle, y compris les runs perdues ensuite. Le bilan de collecte l’affiche (« condensat +212 cL ») et la fiche montre le total. C’est lui qui paiera les améliorations permanentes du banc d’étalonnage.',
    ],
  },
  {
    date: '15/08/2026 22:30',
    title:
      'Cap roguelike, acte I : les ÉCHANTILLONS DE SECOURS (vies) + raccourcis préparés',
    notes: [
      'Le jeu prend son virage roguelike. Premier acte : les VIES, diégétiques — des ÉCHANTILLONS DE SECOURS que le labo tient en réserve. On part avec UN seul (pastille 💠 au HUD) ; une dispersion en consomme un et renvoie à la PREMIÈRE GOUTTE du tableau ; le dernier perdu, c’est la fin de la run — écran « ÉCHANTILLON PERDU », retour au labo (la fiche, en attendant le vrai HUB), sauvegarde d’expédition effacée. Une run secondaire perdue n’efface JAMAIS l’expédition principale.',
      'On en gagne au fil de l’aventure : une salle conclue sur trois condense un échantillon de secours (annoncé au bilan de collecte, plafonné à 3). Les vies voyagent avec la sauvegarde de reprise.',
      'Et la mécanique des RACCOURCIS est préparée : un tableau peut déclarer `raccourciVers` — son sas envoie alors directement à la salle codée, en sautant les intermédiaires (vers l’avant uniquement). Inutile avec la séquence actuelle, prêt pour les salles-raccourcis secrètes qui écourteront les débuts de run déjà maîtrisés.',
    ],
  },
  {
    date: '15/08/2026 21:45',
    title:
      'L’expédition se souvient : reprise à la salle en cours + RUN SECONDAIRE',
    notes: [
      'La progression de l’expédition PRINCIPALE (salle atteinte, réserve, chrono) s’écrit au début de chaque salle. On peut retourner au menu, FERMER le jeu, revenir : le bouton principal devient « REPRENDRE L’EXPÉDITION — SALLE X/N » et la reprend au début de sa salle — aucune fausse manœuvre ne peut repartir de la salle 1 par réflexe. Une expédition conclue (ou dispersée) libère la sauvegarde.',
      'Et quand une expédition attend, un nouveau bouton propose une RUN SECONDAIRE : le même parcours, salle 1, records comptés — mais la sauvegarde de l’expédition principale n’est JAMAIS touchée. Le HUD l’affiche (« 2ᵉ RUN · SALLE X/N »), et depuis la fiche, « REPRENDRE L’EXPÉDITION » ramène à la principale à tout moment. Parfait pour chasser un record de salle sans risquer sa progression.',
    ],
  },
  {
    date: '15/08/2026 21:15',
    title: 'Le FLUIDE SPÉCULAIRE : l’« eau » quitte le vocabulaire du jeu',
    notes: [
      'Décision de lore : l’échantillon n’est pas de l’eau — c’est un FLUIDE SPÉCULAIRE, destiné à un miroir télescopique. Tout le vocabulaire joueur suit, en deux registres : le registre MÉCANIQUE garde les mots sensoriels (LIQUIDE / GLACE / VAPEUR — le bouton d’état EAU devient LIQUIDE, « l’eau épouse » devient « le liquide épouse ») ; le registre LORE nomme la substance (le pitch de la fiche, la carte d’analyse de l’éveil).',
      'Renommés : pitch et figure de la fiche, cartes de l’éveil et anciennes cartes gestuelles, panneaux LÉGENDE et ÉTATS (accords au masculin compris), descriptions des PARAMÈTRES, outils et zones de l’éditeur (« Impose liquide »), trophée « Trois états », étiquette monde de la membrane, journaux du Dr Véga. Les identifiants internes et les sauvegardes ne bougent pas — rien à re-signer, rien à perdre.',
    ],
  },
  {
    date: '15/08/2026 20:45',
    title: 'Zoom à la molette : toutes les souris à la même vitesse',
    notes: [
      'Signalement d’un testeur : le zoom de l’éditeur se comportait mal avec sa molette. Cause : chaque événement de molette valait UN cran plein de zoom, quel que soit son delta — les souris « haute résolution » (rafales de petits crans) zoomaient d’un extrême à l’autre, et Firefox en mode « lignes » rendait le zoom du JEU quasi immobile (delta ±3 divisé par 100).',
      'La molette est désormais NORMALISÉE (pixels, lignes, pages) puis bornée, dans l’éditeur ET dans le jeu : un cran standard = un pas de zoom, les rafales convergent vers la même vitesse, et les boutons − / + de l’éditeur restent là si une molette fait défaut.',
      'Au passage, la question mémoire : ~700 Mo dans le gestionnaire des tâches, c’est l’empreinte NAVIGATEUR (processus GPU, compositeur, tampons d’affichage) — le jeu lui-même tient dans ~10-20 Mo de tas JS, stable après relances répétées (mesuré). Rien d’anormal pour un onglet WebGL.',
    ],
  },
  {
    date: '15/08/2026 20:15',
    title:
      'Records qui s’évaporaient + « Enregistrer sous » qui écrasait l’original',
    notes: [
      'Record visible sur l’accueil mais absent de l’écran RECORDS : trouvé. Le serveur mettait le palmarès à jour à chaque collecte… mais ne l’ÉCRIVAIT que si le vieux record simple (volume d’abord) était battu. L’accueil affichait la réponse du moment ; l’écran RECORDS relisait un document jamais sauvé — la collecte s’évaporait. Le palmarès est maintenant PERSISTÉ dès qu’il change, record simple battu ou non. (Le record perdu se réinscrira à la prochaine collecte de la salle.)',
      'Et oui, le soupçon était fondé : « Enregistrer sous » forgeait l’identifiant depuis le NOM du tableau — en gardant le nom proposé, la copie prenait l’identifiant de l’original et l’ÉCRASAIT. Le serveur forge désormais un identifiant UNIQUE (suffixé si le nom est déjà pris) et l’éditeur adopte l’identifiant renvoyé : l’original est intangible, la copie vit sa vie.',
    ],
  },
  {
    date: '15/08/2026 19:45',
    title:
      'Éditeur : le brouillon rattrape la bibliothèque — fini le vieux triptyque',
    notes: [
      'Le bug signalé : l’éditeur s’ouvrait sur un VIEUX brouillon local du tableau (sans les derniers éléments), alors qu’un clic dans la séquence chargeait bien la dernière version. Cause : le brouillon vit sur l’appareil, la bibliothèque sur le serveur — et rien ne les confrontait (typique après une édition depuis un autre appareil).',
      'Désormais l’éditeur retient À QUELLE entrée son brouillon est lié et ce qu’elle contenait à la dernière synchro. À chaque ouverture, trois cas : brouillon identique → rien ; brouillon SANS travail local et bibliothèque plus récente → il se met à jour TOUT SEUL (le cas du bug) ; brouillon avec du travail non enregistré → rien n’est écrasé, un avertissement propose de cliquer la séquence (charger la dernière version) ou d’ENREGISTRER (publier la vôtre).',
      'Les vieux brouillons d’avant ce lien sont retrouvés par le CODE du tableau — au premier clic dans la séquence, le lien se noue et tout se synchronise ensuite tout seul.',
    ],
  },
  {
    date: '15/08/2026 19:15',
    title: 'L’éveil se rejoue pour tout le monde (clé passée en v2)',
    notes: [
      'L’éveil est maintenant complet — cryostase, bouton CONTINUER, dizaine d’impulsions, ralenti et fondus. La clé versionnée passe en v2 : TOUS les joueurs le (re)vivront une fois à la prochaine plongée, y compris ceux qui avaient vu les premières moutures. Rien d’autre ne bouge : records, trophées et réglages intacts.',
    ],
  },
  {
    date: '15/08/2026 19:00',
    title:
      'Éveil : le monde décélère, la carte fond à l’écran — fini l’apparition brutale',
    notes: [
      'Les cartes de l’éveil APPARAISSAIENT d’un coup, plein écran, en pleine action — brutal. Désormais elles S’ANNONCENT : le monde DÉCÉLÈRE en douceur (~½ seconde, même levier que le slow-mo de visée vapeur — physique, chrono, refroidissement, tout ralentit ensemble, et ça s’ENTEND : le mixage plonge sous le passe-bas du temps suspendu), puis la carte fond à l’écran, ses éléments montant en scène légèrement étagés.',
      'À la fermeture, l’inverse : la carte s’efface en fondu et le monde se RÉVEILLE progressivement (~1 seconde) au lieu de repartir d’un claquement de doigts. Le ralenti est l’annonce : l’œil comprend qu’il se passe quelque chose avant même que la carte ne paraisse. L’invite « redevenez liquide » arrive elle aussi en fondu.',
    ],
  },
  {
    date: '15/08/2026 18:30',
    title: 'Éveil : la carte du volume attend une dizaine d’impulsions',
    notes: [
      'La carte « VOUS ÊTES CE QUI RESTE » arrivait après deux impulsions — trop tôt pour avoir vraiment senti le volume qui part. Elle attend désormais une DIZAINE d’impulsions complètes : on joue, on essaie, on se trompe… et la carte vient nommer ce qu’on a réellement vécu.',
    ],
  },
  {
    date: '15/08/2026 18:15',
    title: 'Éveil : « sous forme de glace », et un vrai bouton CONTINUER',
    notes: [
      'La carte de cryostase dit désormais « VOUS ÊTES SOUS FORME DE GLACE » — la glace est un état du sujet, pas son identité (formulation du joueur).',
      'Les cartes de l’éveil ne se ferment plus d’un toucher n’importe où : chacune porte un VRAI bouton (CONTINUER, puis PLONGER). Plus aucune carte sautée par un clic malheureux — le voile écrante toujours tout le reste, et le bouton A de la manette tourne toujours les pages.',
    ],
  },
  {
    date: '15/08/2026 17:55',
    title: 'Le jeu a une version : NOTES DE VERSION remplace LIVRAISONS',
    notes: [
      'Le jeu est désormais VERSIONNÉ : 0.21.N — « 21 » pour le sujet, N avance tout seul à chaque livraison consignée dans ce journal (une seule source de vérité, aucun numéro à penser à bumper). La version courante s’affiche EN PETIT sous le titre de la fiche, discrète mais toujours là.',
      'Le bouton LIVRAISONS devient NOTES DE VERSION. L’écran affiche la version courante dans son en-tête, et chaque entrée du journal porte le numéro qu’elle a inauguré (v0.21.169, v0.21.168…). L’export Markdown téléchargeable reprend le tout, versions comprises.',
    ],
  },
  {
    date: '15/08/2026 17:30',
    title:
      'L’ÉVEIL : la prise en main devient une scène — et deux boutons PROTOCOLE',
    notes: [
      'Fini les cinq cartes de gestes (mises de côté dans le code, au cas où) : la prise en main est désormais SCÉNARISÉE. Au chargement, l’échantillon attend en CRYOSTASE — le premier contact visuel avec le sujet 21 est un bloc de glace qui dérive. À la plongée, le plan large se joue, puis une carte pose l’état : « VOUS ÊTES LA GLACE » — nul moyen de se diriger, mais rien ne se perd, l’élan vous porte… et « la glace garde d’autres talents » : on tease, on ne déballe pas.',
      'La carte fermée, une INVITE lumineuse plane au-dessus du corps et suit sa dérive : « TOUCHEZ 💧 — REDEVENEZ LIQUIDE » (F ou 💧 au clavier), pendant que le bouton 💧 de la barre PULSE. Pas de « cliquez pour continuer » : le DÉGEL est la réponse. Puis deux impulsions données — on sent le volume qui part — et une dernière carte nomme ce qu’on vient de vivre : « VOUS ÊTES CE QUI RESTE ». Trois temps, zéro liste de commandes.',
      'PARAMÈTRES gagne une section PROTOCOLE : REFAIRE LA PRISE EN MAIN rejoue l’éveil sur le tableau en cours (rien d’autre ne bouge) ; RÉINITIALISER L’OPÉRATEUR efface nom + registres locaux et redemande une signature vierge — DEUX clics pour confirmer (le bouton s’arme en rouge), trophées et réglages conservés. À la manette, A tourne les cartes de l’éveil.',
    ],
  },
  {
    date: '15/08/2026 16:40',
    title:
      'Les joueurs d’avant le voile signent aussi — une fois, sans rien perdre',
    notes: [
      'Le voile de signature ne se montrait qu’aux NOUVEAUX venus : un nom déjà enregistré le court-circuitait. Or les joueurs existants n’ont jamais fait le geste — leur audio restait muet au lancement. Le voile se montre désormais UNE fois à eux aussi, avec leur nom PRÉ-REMPLI : un seul clic confirme (ou corrige) le nom, éveille le son, et c’est réglé.',
      'Rien n’est effacé : records, trophées et réglages restent intacts — seule une clé versionnée (sujet21-signature-v1) marque « ce joueur a signé ». Une future refonte du voile pourra le remontrer en changeant simplement la version de la clé.',
    ],
  },
  {
    date: '15/08/2026 16:15',
    title:
      'La prise en main gèle TOUTES les commandes — clavier, manette, tactile',
    notes: [
      'Pendant les cartes de prise en main, le voile bloquait les clics — mais le CLAVIER passait (F gelait le corps, R relançait, espace mettait en pause…), la MANETTE aussi, et un second doigt pouvait toucher la cuve. Toutes les commandes de jeu sont désormais GELÉES tant que les cartes sont à l’écran : clavier, pointeurs/tactile (gelés à la source, dans les gestionnaires), et manette — dont le bouton A avance maintenant les cartes, comme un clic.',
      'Le gel se lève à la dernière carte, d’un seul geste — rien à réarmer.',
    ],
  },
  {
    date: '15/08/2026 15:50',
    title: 'Le voile de signature : le nom et le son, au premier lancement',
    notes: [
      'Idée du joueur, livrée : au tout premier lancement, un voile plein écran demande le nom d’opérateur — « SIGNEZ LE PROTOCOLE », façon borne d’arcade. Le clic de signature est aussi le GESTE que le navigateur exige pour éveiller l’audio : le nom et le son se règlent d’un seul geste, avant même de toucher la fiche.',
      'Pas de clic inopiné possible : le voile couvre tout et ne se ferme QUE par la signature (pas de fermeture au fond — c’est un portail, pas un popup). Dès qu’un nom existe, il ne se montre plus jamais ; le champ de la fiche reste le moyen d’en changer.',
    ],
  },
  {
    date: '15/08/2026 15:20',
    title:
      'La fiche condense le palmarès — sans bouton REGISTRES ni défilement',
    notes: [
      'Le bouton REGISTRES disparaît (le voile reste en coulisse : la saisie du nom sur mobile s’en sert). Le panneau de droite devient le CONDENSÉ de l’écran RECORDS : rang 1 de chaque podium (★ note, 💧 volume, ⏱ chrono) par salle — seules les salles qui ONT un palmarès s’affichent, bornées à neuf : la fiche tient SANS DÉFILEMENT (les anciennes lignes vides « — — — » sur 24 salles forçaient à défiler). Le détail complet vit derrière le bouton RECORDS. Les vieux records d’avant le palmarès ne s’affichent plus, comme demandé.',
      'Et la page ne SAUTE plus vers le bas au chargement : le navigateur restaurait le défilement de la visite précédente une demi-seconde après l’affichage — le titre devenait inaccessible. La fiche s’ouvre désormais toujours en haut.',
    ],
  },
  {
    date: '15/08/2026 14:45',
    title: 'SUJET 21 — et la fiche a enfin une console digne du labo',
    notes: [
      'Le jeu s’appelle SUJET 21 : titre, écusson et exports renommés (les données locales des joueurs ne bougent pas).',
      'La rangée d’outils de la fiche était restée en boutons BRUTS du navigateur — blancs, débordants, avec deux boutons RECORDS en doublon. Elle devient une CONSOLE : huit chips uniformes (glyphe tinté échantillon + libellé), grille qui s’adapte seule du grand écran au téléphone (une rangée large, ou 2-3 colonnes), cibles tactiles généreuses en tactile, survol lumineux, focus visible. L’ancien doublon devient REGISTRES (il ouvre les registres sur mobile, où la colonne de droite se replie).',
      'La MANETTE atteint désormais RECORDS et LIVRAISONS depuis la fiche (ils manquaient à la navigation au stick). Et le panneau REGISTRES DU LABO bascule sur le NOUVEAU système de records : colonne ★ NOTE en tête (le rang 1 du palmarès partagé), volume et chrono tirés des podiums — l’ancien record simple ne sert plus que de secours pour les salles jouées avant le palmarès.',
    ],
  },
  {
    date: '15/08/2026 14:10',
    title: 'Cadence de simulation 120/60 Hz : le levier contre la chauffe',
    notes: [
      'Les derniers rapports ont montré le VRAI mur : le coût d’UN pas de physique TRIPLE au fil d’une session sur téléphone (1,5 ms à froid → 13 ms après 30 minutes) — c’est le throttling thermique, et aucun réglage de cadencement n’y peut rien. La seule sortie : calculer moins par seconde, donc chauffer moins.',
      'Nouveau réglage CADENCE DE SIMULATION (expérimental) : 120 Hz — la physique de référence, deux pas par image (défaut) ; 60 Hz — UN pas par image : CPU et chauffe divisés par deux, immédiatement et durablement. Le comportement de l’eau diffère légèrement (pas deux fois plus grands) : c’est un réglage assumé, à juger en jouant — vérifié stable au banc (corps cohésif, pas de fuite à travers les parois).',
      'Mémorisé (sujet21-simhz), fenêtre de mesure vidée au changement, consigné dans le rapport (config.simHz). Sur le Pixel, la combinaison à essayer pour les longues sessions : simulation 60 · résolution faible · rattrapage fluidité.',
    ],
  },
  {
    date: '15/08/2026 13:45',
    title:
      'Verdict moteur : le JavaScript redevient le défaut — et le rattrapage devient un réglage',
    notes: [
      'A/B propre sur le Pixel (fenêtres vidées, mêmes conditions, à 4 minutes d’écart) : physique moyenne 5,6 ms en JavaScript contre 8,1 ms en WASM (+44 %), images lentes 36 % contre 44 %. Le JIT mobile bat nos noyaux compilés sur ces boucles : le JAVASCRIPT redevient le moteur PAR DÉFAUT, le WASM reste en option — c’est un instrument de mesure, pas un dogme. Les mesures ont tranché, dans le sens inverse de l’intuition : c’est exactement à ça qu’elles servent.',
      'Les deux rapports du matin confirment l’autre coupable : 81 à 92 % des images lentes sont des RAFALES DE RATTRAPAGE (3 pas de simulation au lieu de 2, ~14-15 ms de physique, après chaque accroc système). L’anti-domino revient donc — en RÉGLAGE cette fois : RATTRAPAGE APRÈS UN ACCROC, « temps réel » (défaut, historique) ou « fluidité » (l’accroc ne se paie qu’une fois, quelques millisecondes de temps simulé abandonnées). Le premier essai de l’anti-domino avait été jugé au ressenti dans de mauvaises conditions (résolution dynamique au palier 5) — cette fois, le joueur juge proprement, et le rapport consigne le mode (config.rattrapage).',
    ],
  },
  {
    date: '15/08/2026 02:50',
    title:
      'Les notes de livraison ont leur écran — et un compteur de FPS permanent',
    notes: [
      'Le journal des livraisons quitte le banc de réglage : nouveau bouton 📜 LIVRAISONS sur la fiche d’essai — les 160 entrées du chantier, lisibles, avec un bouton TÉLÉCHARGER qui exporte tout en Markdown (hors ligne compris). Les entrées peuvent désormais porter une illustration (capture, schéma) : les prochaines livraisons visuelles en profiteront.',
      'Le banc y gagne un DOM plus léger. Réponse à la question « le banc consomme-t-il ? » : fermé, son coût est faible mais réel — ses moniteurs se rafraîchissent ~5 fois par seconde en continu ; l’essentiel de son poids était ce journal, désormais sorti.',
      'COMPTEUR D’IMAGES PAR SECONDE au voile PARAMÈTRES : AFFICHÉ, la cadence mesurée reste en permanence dans le coin bas-gauche de l’écran, discrète (mise à jour 4 fois par seconde) — surveiller sans ouvrir de rapport. Mémorisé par appareil.',
    ],
  },
  {
    date: '15/08/2026 02:20',
    title: 'Huit trophées du protocole — prêts pour Steam',
    notes: [
      'Le système de succès interne, conçu pour se brancher 1:1 sur Steamworks le jour d’une sortie Steam (mêmes identifiants, même événement de déblocage — il ne manquera que l’appel à l’API). Là où les records récompensent l’optimisation, les trophées récompensent l’EXPLORATION des mécaniques.',
      'Les huit : SANS UNE GOUTTE (≥ 95 % du volume livré), PALET PARFAIT (30 s gelé d’affilée), TROIS ÉTATS (eau, glace, vapeur en 15 s), LA LIGNE DE CRÊTE (rang 1 en NOTE au palmarès), MIROIR VIVANT (réfléchir un laser avec son corps gelé), RECONDENSÉ (cinq gouttes de rosée perlées), L’INTÉGRALE (l’expédition en une session), OPÉRATEUR DE NUIT (21 collectes cumulées — le clin d’œil au Projet).',
      'Le TOAST de déblocage glisse depuis le bord (avec sa ponctuation sonore), la page TROPHÉES ouvre le voile RECORDS (cartes verrouillées estompées, date de déblocage), tout persiste en local. Détection légère (échantillonnage 4 Hz), le traçage laser expose désormais ses rebonds sur la glace, et le solveur compte la rosée perlée. Quatre tests sur le contrat du module (179 au total).',
    ],
  },
  {
    date: '15/08/2026 01:55',
    title:
      'L’écran RECORDS : trois podiums par salle, et la NOTE qui fait rejouer',
    notes: [
      'Nouveau bouton 🏆 RECORDS sur la fiche d’essai : le palmarès partagé de tous les opérateurs, salle par salle — trois podiums côte à côte : NOTE, VOLUME, CHRONO (top 5, médailles ①②③).',
      'La NOTE est le nouveau record combiné : centilitres sauvés × 60 / (60 + secondes). Arriver GROS compte d’abord, arriver VITE amplifie — foncer en se vidant donne une petite note, tout garder en traînant aussi : c’est la ligne de crête entre les deux qui fait les grandes notes. Calculée serveur et client, même formule.',
      'Votre ligne est SURLIGNÉE, et sous chaque podium où vous figurez, l’aiguillon : « à 12 cL du rang 2 » — l’écart exact au rang au-dessus, la raison de relancer. Une salle sans collecte s’affiche « le palmarès est à prendre ».',
      'Le serveur conserve désormais un TOP 10 par salle et par catégorie (une entrée par opérateur — le palmarès respire au lieu d’être monopolisé), alimenté à CHAQUE collecte, pas seulement aux records battus.',
    ],
  },
  {
    date: '15/08/2026 01:25',
    title: 'Les habillages de parois passent aux ASSETS du joueur — 8 textures',
    notes: [
      'Les huit habillages générés par le joueur (caissons, conduites, poutrelle, blindage, aération, hublots condamnés, écrans morts, câblage) remplacent les motifs procéduraux — qui restent le secours si l’image ne charge pas. Physique de paroi neutre inchangée, motifs répétés dans le repère local (ils pivotent avec les obliques).',
      'Un seul ATLAS 4096×2048 (8 tuiles de 1024) : le shader de composition utilisait déjà 15 des 16 unités de texture garanties par WebGL2 — l’atlas n’en prend qu’une pour les huit. La texture de la PLAQUE FROIDE est aussi remplacée par la version du joueur (panneau cryogénique à ailettes givrées).',
      'Le sélecteur « Habillage (décor) » de l’éditeur propose les 9 choix (Standard + 8).',
    ],
  },
  {
    date: '15/08/2026 00:45',
    title:
      'Grandes cartes, habillages de parois, SALLE X/N — et plus aucun popup',
    notes: [
      'GRANDES CARTES : les budgets de rendu passent de 40 à 96 boîtes et de 12 à 16 zones — de quoi composer une carte de 3-4 tableaux d’un seul tenant. Le dézoom manuel (pincement/molette) couvrait déjà très largement de telles étendues : dézoom total sur l’ensemble, zoom sur chaque salle. Le court-circuit par boîte du shader fait que chaque pixel ne paie que les boîtes qui le concernent, pas les 96.',
      'HABILLAGES DE PAROIS — quatre décors neutres, physique strictement inchangée (c’est une paroi) : CAISSONS (panneaux empilés, joints sombres), CONDUITES (faisceau de tubes couchés, brides), POUTRELLE (croisillons rivetés), BLINDAGE (plaque lourde, chevrons d’avertissement au bord). Sélecteur « Habillage (décor) » dans l’éditeur sur toute paroi ; les motifs pivotent avec les boîtes obliques.',
      'L’indicateur de progression devient explicite et PERMANENT : la puce du bord haut affiche « SALLE 3/24 » en continu pendant le jeu.',
      'PLUS AUCUN POPUP : le carton de journal signé Dr N. Véga (à fermer à chaque tableau) et les bandeaux CONSIGNE DU PROTOCOLE du tutoriel sont supprimés — retour joueur, pas ergonomiques. Les textes de journal restent dans les tableaux (champ de l’éditeur). La prise en main gestuelle du tout premier lancement est conservée : elle ne se montre qu’une fois.',
    ],
  },
  {
    date: '15/08/2026 00:35',
    title:
      'Tous les tableaux livrés entrent dans la bibliothèque — modifiables',
    notes: [
      'Demande du joueur : voir dans l’éditeur (et son ordre des tableaux) le premier tableau conservé, puis TOUS les tableaux construits — modifiables — puis le reste des essais du labo. La bibliothèque partagée reçoit donc une copie ÉDITABLE de chaque tableau livré : l’école (21-S1 à S3), l’expédition complète dans l’ordre choisi (21-A → 21-G), et le tableau 1 bis.',
      'Mécanique : un semis par workflow GitHub (ops/seed-levels.mjs + gâchette seed-levels-go, sur le modèle de perf-sync — l’API n’est joignable que de là). Ré-exécutable sans danger : un code déjà présent dans la bibliothèque n’est JAMAIS resemé — la version du joueur prime, toujours.',
      'Ordre final posé par le semis : le premier tableau du joueur reste premier, les livrés s’insèrent ensuite, les autres essais du labo ferment la marche. Tout se réordonne ensuite librement dans l’éditeur — et grâce au dédoublonnage par code de la séquence, chaque copie modifiée REMPLACE l’original livré dans l’expédition.',
    ],
  },
  {
    date: '15/08/2026 00:27',
    title: 'La bibliothèque s’enchaîne à l’expédition — elle ne l’ampute plus',
    notes: [
      'Constat du joueur : avec un tableau dans la bibliothèque partagée, l’expédition se réduisait à… ce seul tableau. La bibliothèque REMPLAÇAIT la séquence livrée au lieu de s’y enchaîner — les 13 tableaux construits disparaissaient de la partie.',
      'Nouvelle séquence : les tableaux de la bibliothèque d’abord (dans l’ordre fixé par l’éditeur), puis TOUS les tableaux livrés, dans l’ordre choisi de l’expédition. Et si un tableau de bibliothèque porte le CODE d’un tableau livré (une variante de 21-A), il prend sa place : pas de doublon, la version de l’éditeur prime.',
      'La fiche d’essai annonce le total réel (« X tableaux de la bibliothèque, puis l’expédition livrée — N salles en tout »), le compteur de salles du HUD et le bilan d’expédition suivent, et le voile SALLES dit désormais que l’expédition s’enchaîne à la suite. Séquence memoïsée : le HUD l’interroge à chaque image.',
    ],
  },
  {
    date: '15/08/2026 00:05',
    title: 'Accélérer le temps ne casse plus la cadence',
    notes: [
      'Retour joueur : « en accélérant le temps il y a des chutes drastiques de fps ». Mécanique en cause : ×4 demande 4 fois plus de pas de physique par image (8 au lieu de 2 à 60 im/s) — et le budget s’ÉTENDAIT avec l’accélération (le choix historique : « ×4 achète des pas contre des images »). Sur téléphone, ~28 ms de physique par image : la cadence s’effondrait, littéralement comme annoncé.',
      'Nouvelle borne, prioritaire : la physique ne dépasse jamais ~70 % de la période du verrou de fréquence, accélérée ou pas. Machine rapide : ×4 tient dans la borne, plein régime inchangé. Machine juste : l’accélération PLAFONNE d’elle-même — le temps avance aussi vite que la machine le permet sans casser la fluidité, au lieu d’afficher ×4 dans un diaporama. Le plancher de 5 ms garantit toujours le pas minimal.',
    ],
  },
  {
    date: '14/08/2026 23:49',
    title: 'Éditeur : le cercle d’aspiration du sas suit la valeur du banc',
    notes: [
      'Le pointillé vert autour du sas (la portée d’aspiration) était dessiné avec la valeur PAR DÉFAUT, figée — changer « portée d’aspiration » au banc de réglage ne bougeait pas le cercle de l’éditeur, alors que le jeu, lui, suivait. Signalé par le joueur, corrigé.',
      'L’éditeur lit désormais les paramètres VIFS du banc pour toutes les portées dessinées : aspiration du sas, bandes d’aura (plaque froide, chaudière, hydrophile/hydrophobe) et épaisseur des rails magnétiques — ce que l’éditeur montre est ce que la cuve fera, avec les réglages du moment.',
    ],
  },
  {
    date: '14/08/2026 23:36',
    title:
      'Résolution de rendu au choix : élevée, moyenne, faible — ou dynamique',
    notes: [
      'Intuition joueur, validée par les chiffres : le Pixel pousse ~4,2 millions de pixels par image quand le Steam Deck en pousse ~1 — et le shader de composition coûte PAR PIXEL. À réglages égaux, le téléphone paie 4 fois plus de carte graphique : c’est l’écart entre les deux machines.',
      'La section RÉSOLUTION DYNAMIQUE devient RÉSOLUTION DE RENDU, quatre choix : ÉLEVÉE (native, défaut — rien ne change), MOYENNE (échelle ×0,75 : la carte graphique calcule 56 % des pixels), FAIBLE (×0,5 : 25 % des pixels), DYNAMIQUE (l’adaptatif historique, qui s’ajuste seul à la cadence). Moyenne et faible sont CONSTANTES : l’allègement sans le yo-yo qui avait fait rejeter l’adaptatif sur PC.',
      'Seule la cuve est mise à l’échelle : l’interface, les textes et les jauges HTML restent à la netteté native de l’écran. La physique n’est jamais dégradée. Choix mémorisé (sujet21-res, migration de l’ancien interrupteur), fenêtre de mesure vidée au changement, et le rapport consigne le choix (config.resolution).',
      'Sur le Pixel, MOYENNE est le premier réglage à essayer : ~2× moins de pixels que le natif, une différence visuelle discrète sur un écran aussi dense — et le GPU respire d’autant.',
    ],
  },
  {
    date: '14/08/2026 23:16',
    title:
      'Anti-domino débranché, verrou 45 (Steam Deck), rapports A/B propres',
    notes: [
      'L’ANTI-DOMINO EST DÉBRANCHÉ, sur retour joueur. Les rapports confirment qu’il faisait ce qu’il promettait — les images lentes ne sont plus dominées par la physique (97 % « hors CPU » désormais) — mais sur un téléphone où les accrocs système sont NOMBREUX, abandonner du temps simulé à chaque accroc se ressent plus que la deuxième image lente évitée. Le rattrapage historique reprend ; la capacité reste dans la boucle, testée, si on y revient.',
      'VERROU 45 ajouté aux fréquences : le Steam Deck cadencé à 45 Hz (réglage SteamOS) y trouve un verrou qui épouse exactement la grille de son écran — et le jeu y tourne bien. Sur un téléphone à écran 60 Hz, 45 ne divise pas 60 : la cadence alternerait 17/25 ms, un tressautement mécanique — préférer 60 (ou 30) sur mobile.',
      'RAPPORTS A/B PROPRES : la fenêtre de mesure se VIDE à chaque changement de réglage (moteur, graphismes, verrou, résolution). Constaté sur les deux rapports « un par moteur » : envoyés à 37 s d’écart, leurs fenêtres de 2 minutes se recouvraient — le rapport « javascript » contenait surtout des images jouées en WASM. Désormais un rapport = une configuration, sans contamination.',
      'Premier indice moteur (à confirmer sur fenêtres propres) : léger avantage WASM sur le Pixel — 27,7 % d’images >20 ms contre 35,0 %, et 1,7 % >50 ms contre 4,4 %.',
    ],
  },
  {
    date: '14/08/2026 23:00',
    title: 'Moteur physique WASM — avec retour arrière instantané',
    notes: [
      'Le cœur du solveur tourne désormais en noyaux compilés (WebAssembly) : grille spatiale, collecte de voisins, itérations de densité et viscosité XSPH — les chemins chauds du pas. Portage LIGNE À LIGNE (mêmes formules, même ordre d’opérations, arithmétique f64 sur tableaux f32 comme le JS) : le test de parité fait tourner les deux moteurs côte à côte 120 pas — mêmes trajectoires, gel et dégel compris. Glace, gaz, matériaux et obstacles restent en JavaScript, sur les mêmes tableaux.',
      'RETOUR ARRIÈRE demandé et livré : section MOTEUR PHYSIQUE au voile PARAMÈTRES — WASM (défaut) ou JAVASCRIPT, bascule À CHAUD même en pleine partie (le pas suivant change de moteur). Si le module ne charge pas, le jeu reste en JS sans bruit. Choix mémorisé, et le rapport de performance consigne le moteur actif (config.moteur) : les comparaisons se font sur des chiffres.',
      'Au banc (Node, 900 particules) les deux moteurs sont au coude à coude — le JIT de bureau est déjà quasi natif sur ces boucles. Le verdict qui compte est celui du TÉLÉPHONE : les JIT mobiles sont moins constants (paliers, désoptimisations, GC) là où le WASM garde un rythme fixe. Deux rapports du Pixel, un par moteur, trancheront — c’est exactement ce que l’interrupteur permet.',
      'Chaîne de compilation : AssemblyScript (pnpm asbuild → public/noyaux.wasm, 10,5 Ko, committé — le déploiement n’a pas besoin du compilateur). 175 tests, dont 3 de parité JS/WASM.',
    ],
  },
  {
    date: '14/08/2026 22:41',
    title: 'Anti-domino : un accroc système ne se paie plus qu’une fois',
    notes: [
      'Les deux rapports v3 du Pixel ont tranché. L’écran tournait à 60 Hz (pic net à 17 ms sur 5 118 rappels) : la grille adaptative est innocentée. Et la bande 20-33 ms a livré son coupable : 966 images, POSTE DOMINANT = LA PHYSIQUE dans 57 % des cas (12 ms au lieu de 6,7 en moyenne).',
      'Le mécanisme, un effet domino : une image accroche 25 ms (compositeur, système — hors de notre contrôle) → la boucle RATTRAPAIT le temps perdu en exécutant 3 pas de simulation au lieu de 2 (~13 ms de physique) → cette image-là ratait AUSSI le rendez-vous des 16,7 ms. Chaque accroc se payait deux ou trois fois.',
      'Correctif : le plafond de pas par image est désormais le RÉGIME DE CROISIÈRE de la cadence réelle (fps lissé, borné par le verrou de fréquence) — après un accroc, on abandonne ~8 ms de temps simulé (invisible) au lieu de fabriquer une deuxième image lente. Le time warp garde tous ses pas (plafond ×6 à ×6), et une machine durablement sous la cadence garde son vrai régime : pas de ralenti permanent.',
      'Le test de contrôle attendu sur le Pixel : la bande 20-33 ms doit fondre de moitié environ (la part « physique » disparaît, la part « hors CPU » — les accrocs eux-mêmes — reste). Quatre tests neufs sur le contrat de la boucle.',
    ],
  },
  {
    date: '14/08/2026 21:40',
    title:
      'Rapport v3 : qui casse le « 60 constant » — bandes, cadence, Hz réel de l’écran',
    notes: [
      'Verdict du test A/B graphismes : décor ET liquide en sobre, les à-coups n’ont pas bougé (12,5 % → 11,3 % → 15,7 % d’images lentes sur les trois rapports du Pixel) — le shader est INNOCENTÉ, les graphismes riches peuvent rester. Mais le joueur a raison : même téléphone froid, ~12 % d’images au-dessus de 20 ms, ce n’est pas un 60 constant — et les 10 pires images (trous système) ne disent rien de cette masse-là.',
      'Le rapport v3 fait parler la masse : BANDES de lenteur (20-33, 33-50, 50+ ms) avec, par bande, les moyennes des postes et le POSTE DOMINANT image par image (physique, rendu, autre JS, hors CPU) — on saura enfin si les images à 22 ms sont de la physique qui déborde ou des trous.',
      'HYPOTHÈSE À VÉRIFIER : l’écran du Pixel 8 Pro est adaptatif (LTPO, 60/90/120 Hz selon l’activité). Un verrou à 60 sur une grille d’écran à 90 Hz fabrique MÉCANIQUEMENT des images de 22 ms — sans que rien ne rame. Le rapport mesure désormais le Hz RÉEL du panneau (cadence brute des rappels rAF, rendus ou sautés) et l’histogramme des durées d’images rendues : une quantification s’y lirait en pics nets à 17/22/25 ms.',
      'Au passage : un dt négatif (horloges rAF/performance.now qui divergent au premier rappel) n’entre plus dans la fenêtre.',
    ],
  },
  {
    date: '14/08/2026 21:17',
    title:
      'Graphismes du LIQUIDE riche/sobre — et l’eau ne se paie plus que là où elle est',
    notes: [
      'Retour joueur : le doute porte sur le rendu du LIQUIDE lui-même, pas sur le décor — et le réglage décor ne semblait pas changer grand-chose. Le liquide a donc son propre interrupteur, séparé.',
      'Nouveau réglage GRAPHISMES DU LIQUIDE au voile PARAMÈTRES : RICHE (défaut, inchangé) ou SOBRE — le shader débranche tout l’éclairage de l’eau : relief (4 prélèvements de champ par pixel), reflet spéculaire, miroir vivant (éclat dur, fresnel, étincelles), scintillement. La silhouette, les couleurs de vitesse et les états (givre, vapeur) restent exactement les mêmes : l’eau devient plate, pas différente.',
      'Optimisation pour TOUS les modes au passage : l’habillage de l’eau (relief, miroir, teintes d’état) se calculait sur TOUT l’écran, même les pixels sans eau — il est désormais derrière un test « y a-t-il de l’eau ici ? », et le bruit de fumée ne se calcule que là où il y a de la vapeur. Le liquide couvre une fraction de l’écran : le reste ne le paie plus.',
      'Le rapport de performance consigne les deux modes (config.graphismes pour le décor, config.liquide pour l’eau) : quatre combinaisons possibles, chaque rapport dit la sienne — le test A/B peut isoler le décor, le liquide, ou les deux.',
    ],
  },
  {
    date: '14/08/2026 21:03',
    title:
      'Graphismes RICHES / SOBRES : l’instrument qui chiffre le coût du décor',
    notes: [
      'Hypothèse en cours d’examen : les graphismes (liquide + décor) seraient le vrai goulot — les pires images des rapports du Pixel montrent un CPU minuscule dans une frame longue, signature d’une carte graphique saturée. Pour trancher, il fallait pouvoir ÉTEINDRE le décor sans rien changer d’autre.',
      'Nouveau réglage GRAPHISMES DU DÉCOR au voile PARAMÈTRES : RICHES (défaut, inchangé) ou SOBRES — le shader de composition débranche tout le bruit procédural décoratif : vie du vaisseau (veilleuses, poussières, respiration), caustiques, nébulosité du vide, illustrations de zones, textures de brume (auras hydro/froid/chaud, cire, gouttes de membrane, scintillement du givre), étincelles du miroir, seconde octave des volutes de vapeur.',
      'La LISIBILITÉ ne bouge pas : mêmes formes, mêmes lisières de zones, et chaque aura garde exactement sa portée et son intensité moyenne — elle perd sa texture, pas son sens. La première octave de la fumée reste : elle façonne le nuage, c’est de la mécanique.',
      'Le rapport de performance consigne le mode (config.graphismes) : deux rapports du même tableau, un par mode, et l’écart CHIFFRE le coût réel du décor sur la machine du joueur — c’est le test A/B demandé par l’analyse. Réglage mémorisé (sujet21-decor), et un secours immédiat pour les machines modestes si l’hypothèse se confirme.',
    ],
  },
  {
    date: '14/08/2026 19:05',
    title:
      'Le rapport ignore les suspensions — et le 3e rapport du Pixel confirme',
    notes: [
      'Le collecteur n’enregistre plus les « images » de plus d’1,5 s : onglet endormi, écran éteint, appli en arrière-plan — le navigateur avait suspendu le rappel, ce n’était pas une image (constaté : un dt de 172 secondes dans un rapport réel, qui polluait durée, percentiles et pires images).',
      'Bilan des trois rapports du Pixel 8 Pro, même tableau : images lentes (>20 ms) 31 % → 26,6 % → 11,8 % ; p75 40 → 40 → 60 im/s ; physique moyenne divisée par deux par la phase palet (8,9 → 4,1 ms) ; et la qualité adaptative, qui s’écrasait au palier plancher, se tient désormais au palier 1. Le reste de la traîne est fait de rafales système (throttling), devenues rares.',
    ],
  },
  {
    date: '14/08/2026 18:10',
    title:
      'La phase palet ne chauffe plus : un corps gelé coûte 2,6× moins que l’eau',
    notes: [
      'Optimisation mobile ciblée, guidée par les rapports du Pixel (« ça rame après plusieurs niveaux » = throttling thermique — moins calculer, c’est moins chauffer). Deux découvertes au profileur :',
      'UN CORPS SANS LIQUIDE payait tout le solveur pour rien : les 3 itérations de densité, la collecte de voisins et le XSPH tournaient sur un palet rigide qui n’a ni pression ni viscosité. En PHASE PALET, ces passes se sautent — trajectoires strictement identiques (les corrections ne s’appliquaient déjà jamais au gel).',
      'L’ÉTIQUETAGE DES AMAS de glace (quel bloc est d’un seul tenant) se refaisait à CHAQUE pas — c’était devenu LE poste dominant (~1,6 ms). Il est en cache : rafraîchi sur événement (gel, dégel, retrait de particule) et toutes les 6 pas par sécurité — le temps de constater la fusion de deux blocs qui se touchent. Un tableau d’étiquettes dédié évite tout conflit avec la détection du corps.',
      'Mesuré à 900 particules : icePass 0,94 → 0,17 ms/pas (÷5,4), pas complet en phase glace ~2,0 → 0,76 ms (÷2,6). Les tableaux de glace — ceux du tryptique — sont ceux qui chauffaient : ils respirent d’autant.',
    ],
  },
  {
    date: '14/08/2026 17:20',
    title: 'Rapport de performance v2 : le temps manquant a désormais un nom',
    notes: [
      'Le premier rapport réel (Pixel 8 Pro) a montré des images de 100 ms où le CPU mesuré n’en expliquait que 13 — le collecteur v2 comble le trou : temps CPU TOTAL de la frame, d’où deux nouveaux postes par image : « autreJsMs » (notre code hors physique/rendu — laser, étiquettes, panneau 2D, HUD) et « horsCpuMs » (le temps où notre code ne tourne PAS : file GPU pleine, compositeur, gel système). GPU ou CPU caché : le rapport tranche.',
      'La durée d’image n’est plus plafonnée à 100 ms (on voyait « 100 », c’était « au moins 100 ») ; le rapport embarque la COMPOSITION du tableau joué (boîtes, lasers, cibles, zones, rails, cellules d’éponge, étiquettes) et l’état de pause — un tableau d’éditeur chargé se lit dans les chiffres.',
      'Diagnostic du premier rapport, en attendant la v2 : médiane à 60 mais 30 % des images au-dessus de 20 ms — et résolution dynamique DÉSACTIVÉE sur un rendu ~1,7 Mpx : sur téléphone, l’ACTIVER est le premier geste (réglage par appareil).',
    ],
  },
  {
    date: '14/08/2026 13:30',
    title: 'Le rapport de performance : la vraie machine, analysée à distance',
    notes: [
      'Le jeu mesure désormais CHAQUE image rendue (fenêtre glissante de ~2 minutes, coût négligeable) : cadence en percentiles (médiane, p95, p99, pire), temps de physique et de rendu, à-coups classés avec leur contexte (pas simulés, particules, palier de qualité), fiche de l’appareil (écran, densité, cœurs, mémoire) et configuration active.',
      'Troisième section du voile PARAMÈTRES : un aperçu EN DIRECT (médiane et plancher p5), COPIER (le rapport JSON dans le presse-papier) et ENVOYER AU LABO — le rapport part sur l’API (les 20 derniers sont conservés) et l’analyse se fait à distance, sur les chiffres réels d’un Steam Deck ou d’un téléphone plutôt qu’au banc du développeur.',
      'Des chiffres de machine, rien de personnel. Et pour la question posée : NON, le réseau ne joue pas sur les performances en jeu — physique et rendu sont 100 % locaux ; le réseau ne sert qu’au chargement, à la bibliothèque et aux records de fin de tableau.',
    ],
  },
  {
    date: '14/08/2026 12:40',
    title: 'Zones forcées : l’eau au mur compte — la bande morte est comblée',
    notes: [
      'Dans une zone forcée bordée d’une paroi, le corps écrasé contre le mur ne déclenchait pas la transformation : la mécanique comptait les particules dans la LISIÈRE ONDULÉE (inscrite à ~0,955 du rectangle, coins adoucis) — l’eau plaquée au bord tombait dans la bande morte, invisible, et les 95 % restaient inatteignables.',
      'La MÉCANIQUE couvre désormais TOUT le rectangle déclaré à l’éditeur, murs et coins compris ; la lisière ondulée reste le DESSIN de la frontière. L’écart est dans le sens qui pardonne : rien de visuellement « dedans » n’est jamais exclu.',
      'Test de régression : un point au ras du mur et dans les coins compte comme dedans, et rien ne déborde du rectangle déclaré.',
    ],
  },
  {
    date: '14/08/2026 12:10',
    title: 'Le verrou de fréquence tient sa cadence exacte sur tout écran',
    notes: [
      'Le limiteur calait sur des sous-multiples de l’écran : sa marge fixe faisait qu’un verrou à 60 sur un écran 144 Hz rendait 48 im/s réelles, et les crans hauts s’arrondissaient au petit bonheur. Cadencement refait à DETTE CONSERVÉE : l’horloge avance d’une période exacte par image rendue — la cadence moyenne colle au verrou choisi, quel que soit le taux de l’écran (dette bornée à une période : revenir sur l’onglet ne déclenche pas de rafale).',
      'À savoir : au-delà du verrou, c’est la MACHINE qui décide — en résolution native (le nouveau défaut), une carte moyenne plafonne d’elle-même (~100 im/s sur un grand écran). Le compteur du banc (Mesures) fait foi ; réactiver la résolution dynamique ou baisser le verrou rend la marge.',
    ],
  },
  {
    date: '14/08/2026 11:45',
    title: 'Résolution dynamique : désactivée par défaut',
    notes: [
      'La résolution NATIVE constante devient le défaut, partout : aucune surprise visuelle, à la machine d’encaisser. L’adaptatif reste disponible au voile PARAMÈTRES pour qui en veut (mobile qui chauffe, machine modeste) — le choix reste mémorisé par appareil.',
    ],
  },
  {
    date: '14/08/2026 11:20',
    title: 'La résolution dynamique devient un choix',
    notes: [
      'Sur un PC à la limite du 60, la qualité adaptative recalée hier sacrifiait la résolution pour tenir la cadence — et la baisse de finesse se voyait plus que les images perdues. Le voile PARAMÈTRES gagne son deuxième réglage : RÉSOLUTION DYNAMIQUE, activée ou désactivée.',
      'ACTIVÉE (défaut, recommandé sur mobile) : la résolution baisse quand la machine ne tient pas la cadence et remonte dès qu’elle respire — le comportement d’hier. DÉSACTIVÉE : rendu en résolution NATIVE, constante — à la machine d’encaisser, aucune surprise visuelle.',
      'Application immédiate (retour à la pleine résolution dès le clic), choix mémorisé sur l’appareil. La physique n’est jamais dégradée, dans les deux cas.',
    ],
  },
  {
    date: '14/08/2026 10:45',
    title:
      'La carte dans la main : pincement ancré, élan, et le temps lisible partout',
    notes: [
      'Le PINCEMENT est enfin de la manipulation directe : le point du monde sous les doigts RESTE sous les doigts (zoom ancré au centre du pincement, immédiat), et la molette zoome vers le curseur. Avant, tout zoomait vers le centre de l’écran — la carte fuyait sous le geste.',
      'L’ÉLAN du geste : les doigts quittent l’écran en mouvement, la carte continue et s’amortit en douceur (~0,4 s) — le glisser des cartes qu’on a dans la main. Le clic droit maintenu en profite aussi.',
      'Le zoom AUTOMATIQUE ne pompe plus au rythme des éclats : le cadrage suit un rayon de corps LISSÉ (3/s) — une gerbe de vaporisation ne fait plus sursauter la caméra, elle la fait respirer.',
      'La barre du bas se lit enfin sur 7 pouces : glyphes 16 → 20 px (24 au doigt — téléphone, Steam Deck), fonds plus opaques, chips LÉGENDE/ÉTATS/BANC 9 → 11 px (12 au doigt). Sur mobile, les chips passent de 8,5 à 10,5 px.',
      'Le TEMPS en un seul bloc : ‹ ×N › — la vitesse courante s’affiche EN PERMANENCE entre ses deux boutons, en ambre dès qu’on quitte ×1 (le HUD aussi). Et le bloc revient sur MOBILE : les crans de temps n’étaient « pas au doigt » — ils le sont désormais.',
    ],
  },
  {
    date: '14/08/2026 09:05',
    title:
      'Les obliques, citoyennes de plein droit : découpe et poignées de coins',
    notes: [
      'Une paroi oblique se REDIMENSIONNE désormais à la poignée : ses 4 coins portent des prises PIVOTÉES avec elle — saisir un coin cloue le coin opposé au monde, et la boîte s’étire dans SON repère (l’angle ne bouge pas). Le contour de sélection suit enfin la vraie silhouette : fini le rectangle droit menteur autour d’une boîte penchée.',
      'La DÉCOUPE ronge maintenant les obliques — à ANGLES ÉGAUX : tout se passe dans le repère de la perdante (où tout est droit), puis chaque morceau repart dans le monde avec son angle, posé exactement sur la paroi d’origine. Deux rampes à 45° se rongent comme deux parois droites. Angles différents : refus motivé (les morceaux ne seraient plus des rectangles) — alignez les angles d’abord.',
      'Géométrie testée : entaille exacte (témoins dedans/dehors), refus à angles différents, écart de 180° accepté (même empreinte), chemin droit inchangé — 4 tests neufs.',
    ],
  },
  {
    date: '13/08/2026 22:55',
    title: 'L’oblique à la poignée : les boîtes se tournent au glisser',
    notes: [
      'Les surfaces obliques existaient de bout en bout (collision, rendu, laser, tests) mais restaient invisibles : aucun tableau livré n’en use, et l’éditeur les cachait derrière un champ numérique. Une boîte sélectionnée porte désormais une POIGNÉE DE ROTATION — un bras au bord haut, dans le repère de la boîte : elle tourne avec elle.',
      'Glisser tourne autour du centre, AIMANTÉ AUX 15° (Alt : au degré près) ; l’angle s’affiche au bout du bras et revenir à 0° remet la boîte droite (la clé disparaît du fichier). Le champ « Angle (°) » du panneau reste là pour la précision.',
      'Rampes qui dévient, couloirs en biais, lèvres hydrophobes inclinées façon flipper (le bumper de glace s’y prête) : l’oblique est enfin un outil de premier geste.',
    ],
  },
  {
    date: '13/08/2026 22:20',
    title: 'Le voile PARAMÈTRES — et le verrou de fréquence anti yo-yo',
    notes: [
      'Nouveau bouton ⚙ PARAMÈTRES sur la fiche (navigable à la manette comme le reste) : les réglages du JOUEUR, là où le banc règle la physique.',
      'Premier réglage : le VERROU DE FRÉQUENCE — 30 · 50 · 60 · 90 · 120 · 240. La boucle saute les images d’avance : la cuve se cale sur la cadence choisie et n’essaie jamais d’aller plus vite. Sur un écran rapide, verrouiller à 60 échange le « parfois 90, parfois 55 » contre un 60 régulier — c’est la stabilité qui se sent, pas la pointe.',
      'La qualité adaptative vise la cadence verrouillée (bornée à 60, le rendu est taillé pour) : verrouillé à 30, elle ne bradera pas la finesse pour courir après un 60 qu’on ne demande plus. La physique n’est jamais dégradée.',
      'Le choix est mémorisé sur l’appareil (60 par défaut).',
    ],
  },
  {
    date: '13/08/2026 21:50',
    title:
      'Cap sur le 60 fps constant : la mémoire re-rangée, la qualité exigeante',
    notes: [
      'Les à-coups « en cas de séparation » sont diagnostiqués au profileur : après une gerbe ou une éclaboussure, des particules voisines dans l’ESPACE se retrouvent éparpillées dans les TABLEAUX mémoire — chaque accès de paire devient un défaut de cache et toutes les passes ralentissent d’un coup (jusqu’à ×9 sur un pas, mesuré). Le solveur re-range désormais ses particules dans l’ordre des cellules 4 fois par seconde : physique inchangée, localité restaurée — pas médian −20 %, régime dispersé −23 %.',
      'La collecte de voisins s’arrête net une fois sa liste pleine : dans un empilement dense (gouttes qui retombent en tas), elle testait encore la distance de centaines de particules sans plus rien retenir.',
      'La qualité adaptative visait « au-dessus de 42 fps » — elle était satisfaite de 50. Elle vise maintenant 60 CONSTANT : sous 55 fps, la résolution descend en 1,2 s ; elle ne remonte qu’après 5 s de marge franche (l’asymétrie évite le clignotement). La physique n’est jamais dégradée, comme avant.',
      'À retester sur Pixel 8 Pro : le jeu devrait tenir 60 en acceptant, dans les moments chargés, un rendu un cran moins fin — c’est le compromis demandé.',
    ],
  },
  {
    date: '13/08/2026 19:05',
    title: 'Le voile SALLES connaît enfin la bibliothèque du labo',
    notes: [
      'Les salles de l’éditeur (la bibliothèque partagée, dans l’ordre fixé là-bas) manquaient au voile SALLES : la liste était construite une fois au démarrage, avec les seuls tableaux livrés. Elle se reconstruit désormais à chaque changement de bibliothèque — chargement au démarrage, sauvegarde, réordonnancement ou suppression depuis l’éditeur.',
      'Deux intercalaires la structurent : « BIBLIOTHÈQUE DU LABO — la séquence jouée, dans l’ordre de l’éditeur » en tête, puis « EXPÉDITION LIVRÉE — hors séquence, à l’essai » ; bibliothèque vide, le voile reste tel qu’avant.',
    ],
  },
  {
    date: '13/08/2026 18:35',
    title:
      'Récepteurs laser TOR et NOR : le verrou qui ouvre, le maintien qui scelle',
    notes: [
      'Deux familles de récepteurs, chacune à transition UNIQUE — une fois basculé, plus jamais de retour. TOR (l’existant, désormais nommé) : un seul passage du faisceau allume la pastille pour de bon, la porte asservie s’ouvre et le reste.',
      'NOR (nouveau) : la porte n’est ouverte que TANT QUE le faisceau tient la cible — et à la PREMIÈRE coupure, la pastille grille : la porte se referme et se scelle définitivement. Traverser se joue faisceau maintenu (miroir de glace posé, prisme du corps, arc sur rail…) ; lâcher le rayon au mauvais moment condamne le passage.',
      'Une persistance courte (0,12 s) absorbe le tremblement d’une image — le miroir qui frémit ne scelle pas la porte par accident.',
      'Lecture en jeu : la pastille NOR porte un anneau pointillé AMBRÉ (« faisceau à maintenir ») ; grillée, elle vire au brûlé avec sa fêlure — l’état se lit d’un coup d’œil, avant et après.',
      'Éditeur : le panneau de la cible propose le choix TOR / NOR (avec la règle écrite en toutes lettres), l’anneau ambré s’affiche dans l’aperçu, et le mode voyage dans les fichiers de tableaux — les tableaux existants ne changent pas d’un octet (TOR implicite).',
      'La mémoire des récepteurs est une machine à états pure et testée (laser.ts) : verrou TOR, maintien NOR, scellage à la coupure, persistance, cohabitation des deux familles — 5 tests neufs, aller-retour de sérialisation compris.',
    ],
  },
  {
    date: '13/08/2026 18:05',
    title:
      'La glace et la vapeur sentent enfin la chimie — et la frame respire',
    notes: [
      'CORRECTIF DE CONFORMITÉ (tableau des règles) : le PALET de glace rebondit vraiment sur l’hydrophobe — restitution propre (le bumper rend PLUS qu’il ne reçoit) et pichenette plancher : même en dérive lente, il repart d’un coup sec. Sur l’hydrophile, le mouillage le retient : translation et rotation s’essoufflent. La réponse était écrite par particule : la moyenne de l’amas la diluait, puis l’impulsion rigide l’écrasait — un vrai bloc se comportait comme sur un mur neutre (seule une particule isolée sentait la chimie, et c’est ce que testait la suite). La chimie vit désormais dans la passe rigide elle-même, à l’échelle du bloc.',
      'La VAPEUR sent les bandes pour de bon : poids remonté (12 % → 35 % de l’effet plein, réglable au banc avec la portée) — l’hydrophile attire le nuage de loin comme une gravité légère, l’hydrophobe le repousse comme un champ. Trois nouveaux curseurs (Matériaux) : bumper glace, pichenette glace, freinage glace — plus poids et portée vapeur.',
      'L’éditeur était à jour (palette, couleurs, bandes d’influence) : le bug était dans la simulation, donc partout — il est corrigé partout, ses parties d’essai comprises. La légende du jeu et le panneau des états disent maintenant les vraies règles pour les trois états.',
      'OPTIMISATION (chasse aux chutes d’images) : le pic périodique de la frame — l’étiquetage des amas — coûtait 3× trop cher : il cherchait toujours au rayon vapeur (×3, ~60 cellules par particule) même sans vapeur ; le rayon suit désormais la vapeur réellement présente (même connexité, 9 cellules au régime courant). Les passes d’aura (froid, chaudière, chimie, grille) ne balaient plus TOUTES les boîtes par particule mais des listes par famille, précalculées au chargement.',
      'Le GPU aussi : le shader du décor payait les 40 boîtes du tableau À CHAQUE PIXEL (textures, bruit, mélanges) ; au-delà de toute influence visuelle (ombre, arête, aura), la boîte est désormais court-circuitée — chaque pixel ne paie plus que les 1-2 boîtes qui le concernent. Et plus une seule allocation par pas dans la grille spatiale ni l’étiquetage : le ramasse-miettes n’a plus de rafales à faire pendant la partie.',
      'Mesuré au profileur (900 particules, tableau chargé) : ~13 % de pas physique en moins dans les trois états, et le pic d’étiquetage divisé par 3 — les à-coups en accéléré (×4-6, jusqu’à 24 pas par image) s’adoucissent d’autant.',
    ],
  },
  {
    date: '13/08/2026 17:15',
    title:
      'La règle d’or v4 : péage de vaporisation, dashs par transformation, SURCHAUFFEUR',
    notes: [
      'La VAPORISATION se paie : 20 % du volume actif part en gouttes à CHAQUE bascule en vapeur — touche G, chaudière à 95 %, zone forcée, toute cause confondue. La gerbe part en étoile à grande vitesse : c’est la même matière que la propulsion, récupérable (et elle perlera en rosée au froid). Réglable au banc (« péage de vaporisation »).',
      'Les dashs ne se comptent plus PAR ÉCRAN mais PAR TRANSFORMATION : chaque bascule en vapeur rend ses 3 dashs (réglable au banc et par tableau dans l’éditeur), même si le volume a fondu — se retransformer sans compter mène au game over, c’est le jeu.',
      'Nouveau bloc : le SURCHAUFFEUR — un mur pour l’eau et la glace ; frôlé en VAPEUR, son serpentin cyan rend UN dash, une seule fois par appareil, puis s’éteint (le manomètre, c’est la lumière). Dans l’éditeur, la légende et le panneau des états.',
      'Le radiateur devient la CHAUDIÈRE, partout — et elle ne recharge plus les dashs (c’était le rôle provisoire du frôlement) : elle transforme, le surchauffeur recharge. Chaque chaudière règle désormais la PORTÉE DE SA PROPRE AURA (champ « Aura » de l’éditeur) : gros bloc à petite aura, petit bloc qui chauffe loin — le halo dessiné suit exactement la mécanique.',
      'Les deux documents de référence (« La règle d’or », « Transformations d’état » v4) sont archivés dans docs/ — la suite du chantier (récompenses de fin de niveau, douche de décontamination, glissade, bonus de surfaces) suivra ce cap.',
    ],
  },
  {
    date: '13/08/2026 13:50',
    title:
      'Le time warp fonctionne à nouveau — l’accélération se paie en images, pas en mensonge',
    notes: [
      'Accélérer le temps (›, RB, la croix) ne faisait plus rien de visible sur les tableaux devenus lourds : la boucle physique plafonnait à 6 pas par image et son budget CPU fixe (12 ms) jetait le surplus — le HUD affichait ×4, la cuve restait à ×1. Les commandes, elles, marchaient : c’est la simulation qui n’encaissait pas.',
      'Deux correctifs : le plafond de pas passe à 24 (le vrai frein anti-spirale reste le budget CPU), et le budget s’ÉTEND proportionnellement au warp — mettre ×4, c’est acheter des pas de simulation contre des images par seconde. Sur machine étranglée, ×4 donne désormais ×3,4 réels (avant : ×1) ; sur machine saine, le ×2/×4/×6 est exact. Le ralenti (‹, LB) reste précis dès que la machine tient le ×1.',
    ],
  },
  {
    date: '13/08/2026 13:05',
    title: 'Annuler / Rétablir dans l’éditeur (Ctrl+Z / Ctrl+Y)',
    notes: [
      'L’éditeur gagne un vrai historique : Ctrl+Z annule, Ctrl+Y (ou Ctrl+Maj+Z) rétablit — et deux boutons ↶ ↷ dans la barre pour la souris et le tactile. Tout y passe : pose, déplacement, redimensionnement, suppression, duplication, découpe, alignements, propriétés, champs de la fiche (à la sortie du champ), ouverture d’un tableau livré, tableau vierge.',
      'Cent étapes retenues ; toute action nouvelle après un retour en arrière coupe la branche du futur, comme partout ailleurs. Dans un champ texte, le Ctrl+Z natif du champ garde la main.',
    ],
  },
  {
    date: '13/08/2026 12:00',
    title: 'L’impulsion sans direction rassemble le corps',
    notes: [
      'Nouveau geste anti-dispersion : une impulsion SANS direction — stick de la manette au neutre, ou doigt/pointeur posé SUR le volume lui-même — ne part plus au petit bonheur : elle se retourne vers l’intérieur et RASSEMBLE le corps autour de son centre. Chaque particule est rappelée, la vitesse qui fuit le centre est amortie, et les gouttes libres du voisinage immédiat (fragments détachés, hors délai de réabsorption) reviennent au bercail : le volume se REFORME.',
      'C’est GRATUIT : rien ne part, rien ne se paie — et ce maintien-là ne consomme pas la dernière impulsion de la fin de course. La dérive d’ensemble est conservée exactement (le rappel est interne) : se rassembler ne freine pas la trajectoire. L’onde à l’écran part du centre (un battement, pas une salve), le « ploc » d’éjection se tait.',
      'Deux curseurs au banc (Propulsion) : « rappel (rassembler) » et « amorti (rassembler) ». Les panneaux de commandes (souris, manette, tactile) documentent le geste.',
    ],
  },
  {
    date: '12/08/2026 23:55',
    title:
      'La zone forcée répond partout — et le sas ne disparaît plus des grands tableaux',
    notes: [
      'Le rayon d’action d’une zone était une ellipse inscrite : sur une zone haute et étroite (l’école des zones), il fallait passer PILE devant le hublot pour se faire geler. La lisière épouse désormais tout le rectangle défini dans l’éditeur (coins à peine adoucis, toujours ondulée) : devant le hublot ou à côté, tant qu’on est dans la zone, la règle s’applique. Le dessin suit la même formule — ce qu’on voit reste ce qu’on subit.',
      'Le décor ne dessinait que 24 boîtes par tableau : dans un tableau chargé, le SAS (ajouté en dernier) et les derniers blocs posés devenaient des murs invisibles — la physique les voyait, pas l’œil. Budget porté à 40 boîtes et 12 zones, le sas garde sa place quoi qu’il arrive, et le panneau CONTRÔLE de l’éditeur refuse désormais un tableau qui déborde (« murs invisibles ») au lieu de le laisser casser en silence.',
    ],
  },
  {
    date: '12/08/2026 15:10',
    title:
      'La transformation à 95 % : l’échauffement devient un pur effet visuel',
    notes: [
      'Nouvelle règle : à l’approche d’un élément, PLUS AUCUNE particule du corps ne se vaporise seule — l’eau chauffe, frémit et fume (effet visuel), c’est tout. La TRANSFORMATION se décide au niveau du corps : quand 95 % de la SURFACE ACTIVE (le corps principal — les gouttes éjectées ne comptent pas) baigne dans la zone d’effet, tout bascule d’un coup.',
      'La règle vaut pour les BLOCS (la chaudière : présence à 95 % dans l’aura → état gazeux, réarmement en ressortant) ET pour les ZONES FORCÉES (déclenchement à 95 % du corps dedans, tenue jusqu’à 85 % — fini le déclenchement au simple passage du centre). L’état persiste toujours à la sortie.',
      'Les gouttes égarées, elles, continuent de s’évaporer aux abords des chaudières : le décor vit, seul le CORPS est protégé du morcellement.',
    ],
  },
  {
    date: '12/08/2026 14:20',
    title: 'La grille devient L’ÉVENT',
    notes: [
      'Renommage complet : la paroi qui ne laisse passer que la vapeur s’appelle désormais L’ÉVENT — la bouche par laquelle le vaisseau respire (une vraie grille laisserait passer l’eau…). Rien ne change dans la mécanique : étiquettes des tableaux, légende, panneau des états, onboarding, banc, éditeur et le nom du tableau 21-L (« À travers l’évent ») parlent tous le nouveau mot. Le trio des portes d’état est complet : la MEMBRANE (eau), le RIDEAU LAMELLAIRE (glace), L’ÉVENT (vapeur).',
    ],
  },
  {
    date: '12/08/2026 13:55',
    title: 'Membrane et rideau lamellaire dans la barre d’outils de l’éditeur',
    notes: [
      'Les deux parois à porte d’état se posaient seulement en changeant le matériau d’une boîte existante — elles ont maintenant leurs BOUTONS dans la barre d’outils (avec infobulle : qui passe, qui bute).',
    ],
  },
  {
    date: '12/08/2026 13:35',
    title: 'Le dash a du punch',
    notes: [
      'Le dash vapeur frappe plus fort et porte plus loin : vitesse 620 → 820 u/s, portée de pleine puissance 300 → 380 u. Le FREIN reste sec (flottement inchangé) : le nuage fuse, puis s’arrête vite — c’est cet arrêt franc qui fait le bon ressenti, il ne bouge pas.',
    ],
  },
  {
    date: '12/08/2026 11:30',
    title: 'Radiateur : le passage à l’état gazeux se fait à 50 %',
    notes: [
      'Réglage : la bascule automatique à l’état gazeux se déclenche dès 50 % du corps vaporisé (au lieu de 70), et se réarme sous 30 %. Le document des règles (docs/) est à jour.',
    ],
  },
  {
    date: '12/08/2026 11:05',
    title:
      'Le radiateur fait vraiment passer à l’état gazeux — et ne repousse plus',
    notes: [
      'Vaporisé malgré soi par un radiateur, on PASSE désormais vraiment à l’état gazeux : dès 70 % du corps en vapeur, l’intention suit — dash, sélecteur, sons, comme si on avait pressé G. Le déclencheur se réarme seulement une fois le corps redescendu sous 50 % : revenir à l’eau dans l’aura ne lutte pas contre la machine.',
      'Et le radiateur ne REPOUSSE plus : le frémissement de l’eau qui chauffe était un bruit dont l’amplitude suivait la chaleur — un tel bruit dérive vers le froid, d’où la poussée fantôme. Le signe du bouillonnement alterne maintenant d’une particule à l’autre : la dérive collective s’annule, le frémissement reste.',
    ],
  },
  {
    date: '12/08/2026 10:20',
    title:
      'Les records refondus : deux par salle, et un bilan clair à chaque sas',
    notes: [
      'Chaque salle tient désormais DEUX records indépendants : 💧 le VOLUME (le plus de litres en bonbonne) et ⏱ le CHRONO (la collecte la plus rapide, quel que soit le volume). Vos anciens registres migrent tout seuls.',
      'À CHAQUE fin de tableau, le bilan s’affiche en clair : vos deux mesures, face aux records — et « NOUVEAU RECORD ✦ » qui bat quand l’un tombe (la fanfare sonne pour l’un comme pour l’autre). En essai libre, les records de la salle s’affichent en lecture seule.',
      'L’écran REGISTRES parle enfin : colonnes titrées (SALLE · 💧 VOLUME · ⏱ CHRONO), le détenteur signe chaque record (en vert quand c’est vous), la meilleure EXPÉDITION trône en tête (salles · litres · durée en minutes), et les litres portent la virgule française.',
      'Le record de VOLUME confronte toujours le tableau d’honneur partagé entre opérateurs ; les CHRONOS sont les vôtres, en local.',
    ],
  },
  {
    date: '12/08/2026 03:25',
    title: 'Le bouton SALLES : charger n’importe quel tableau depuis la fiche',
    notes: [
      'Un bouton ▦ SALLES sur la fiche ouvre un voile listant TOUS les tableaux — l’école, l’expédition, les salles laser et le 21-A bis (17 salles) : un toucher charge la salle à l’essai, hors expédition, sans toucher aux registres.',
      'Et la fin d’essai parle enfin juste : « ESSAI 21-K CONCLU » au lieu du texte du prototype, et « SALLE SUIVANTE » quand une file continue.',
    ],
  },
  {
    date: '12/08/2026 03:05',
    title:
      'Les impulsions vapeur se comptent — x par écran, réglable par tableau',
    notes: [
      'Règle confirmée : en VAPEUR, le dash ne se paie plus en volume — il se COMPTE. Chaque écran offre x impulsions (réglage « impulsions / écran » au banc, et champ « Dashs vapeur / écran » propre à chaque tableau dans l’éditeur). Le LIQUIDE, lui, continue de payer ses éjections en quantité réelle.',
      'Le viseur du dash annonce le solde (« DASH 80 % · 2 impulsions »), le radiateur frôlé OFFRE l’impulsion suivante sans toucher au budget, et à sec, le viseur le dit : « À SEC — condensez, ou frôlez un radiateur ». L’état vapeur, lui, s’évapore toujours en continu.',
    ],
  },
  {
    date: '12/08/2026 02:40',
    title: 'Parois obliques, chevauchement au clic, et guides façon Canva',
    notes: [
      'Les PAROIS PEUVENT PENCHER : un champ « Angle » sur chaque boîte de l’éditeur, et la rotation traverse tout — collision (une rampe dévie vraiment), auras, grilles, laser (le faisceau meurt sur la diagonale), rendu (remplissage, arête, aura pivotent). L’angle voyage dans le JSON des tableaux.',
      'La DÉCOUPE devient un arbitrage : cliquez la paroi qui PREND LE DESSUS, puis celle qui s’efface — seule la zone où elles se chevauchent est rongée du perdant, le vainqueur reste entier. Échap annule, le vainqueur se surligne en or.',
      'L’atelier d’alignement gagne MÊME LARGEUR et MÊME HAUTEUR (la première sélection donne la mesure, les autres l’adoptent autour de leur centre) — et pendant tout déplacement, des GUIDES POINTILLÉS magnétiques apparaissent : bords et centres s’aimantent sur ceux des autres parois et du sas, façon Canva.',
    ],
  },
  {
    date: '12/08/2026 01:55',
    title:
      'La gare du rail devient une poche, la vapeur sent les parois de loin',
    notes: [
      'Condenser au bout d’un rail pouvait ENCORE gicler : le champ massait le nuage sur un point, plus dense que l’eau au repos — la condensation explosait sous la pression. Le terminus est désormais une POCHE : freinage partout, mais l’attraction s’arrête à un rayon mort — le nuage se gare à densité naturelle, la condensation est douce (test à l’appui : convoyé, condensé, aucune giclée).',
      'Les parois chimiques travaillent la vapeur DE LOIN : force encore réduite, mais portée ×2,5 — le nuage s’infléchit bien avant l’hydrophile ou l’hydrophobe, sans jamais être happé ni claqué.',
      'Et le radiateur n’exige plus le bain : FRÔLER le bord de son halo suffit à recharger un dash.',
    ],
  },
  {
    date: '12/08/2026 01:30',
    title: 'La surface-miroir, le temps aux épaules, les états sous le pouce',
    notes: [
      'La surface du liquide REFLÈTE enfin comme le veut le lore : éclat spéculaire dur (le reflet net d’une source), voile de fresnel froid aux incidences rasantes — le poli d’un métal liquide — et un semis d’étincelles qui glisse avec la courbure. L’échantillon a toujours été un miroir ; maintenant ça se voit à l’état liquide aussi.',
      'MANETTE, nouveau plan de commandes : LB RALENTIT le temps, RB l’ACCÉLÈRE (la croix ↔ aussi) ; les trois transformations passent sur les boutons restants — X glace, Y vapeur, B retour à l’eau — et A reste la main qui agit. L’onglet Commandes est à jour.',
      'L’onboarding s’étoffe d’une CINQUIÈME carte : « LE TEMPS VOUS OBÉIT » — viser en vapeur ralentit déjà le monde, virgule/point (PC) ou LB/RB (manette) règlent le tempo, Espace met en pause.',
    ],
  },
  {
    date: '12/08/2026 01:00',
    title: 'Le rail livre en gare, et brille tant qu’il porte',
    notes: [
      'Au TERMINUS du rail, le champ ne pousse plus : il FREINE et masse le nuage sur le point d’arrivée. Le nuage arrivait comme un boulet — condenser à l’arrivée faisait « exploser » le corps. La livraison est douce, la condensation aussi.',
      'Et le rail S’EMBRASE tant que son champ est ENGAGÉ : halo violet, ligne vive, tirets qui défilent dans le sens du convoyage — même quand le rayon ne touche plus la vapeur. Il ne s’éteint que quand l’attirance se relâche vraiment : nuage livré, condensé ou dispersé.',
    ],
  },
  {
    date: '12/08/2026 00:40',
    title: 'Membrane, rideau lamellaire — et le tableau des règles fait loi',
    notes: [
      'Deux parois nouvelles : la MEMBRANE gorgée d’eau (seule l’EAU suinte au travers ; glace et vapeur butent, la lumière est absorbée) et le RIDEAU LAMELLAIRE (seule la GLACE, dense et d’un seul tenant, écarte les lamelles). Avec la grille, chaque état a désormais SA porte.',
      'Le tableau des règles fourni fait loi, et la simulation s’y est rangée : l’ÉPONGE bloque désormais la glace ET la vapeur (fini le passage essoré) ; la GLACE sent la chimie des parois — bumper sur l’hydrophobe, freinée sur l’hydrophile ; la VAPEUR est légèrement attirée par l’hydrophile et repoussée par l’hydrophobe ; et un bain dans l’aura d’un RADIATEUR recharge un dash — la prochaine impulsion est OFFERTE (le viseur l’affiche).',
      'Partout où les surfaces se racontent : légende, panneau des états, éditeur (palette et propriétés), et l’école 21-S2 gagne un MUR AUX TROIS PORTES — membrane en bas, passage au centre, rideau en haut.',
      'Sept tests neufs ou réécrits couvrent chaque règle (portes d’état, éponge-feutre, bumper, freinage, dash offert).',
    ],
  },
  {
    date: '11/08/2026 21:15',
    title: 'Un clic de stick recadre la caméra',
    notes: [
      'À la manette, enfoncer un stick (L3 ou R3) remet la caméra en suivi AUTOMATIQUE — cap et zoom : l’équivalent du bouton ⌖. On explore au stick droit, on clique, on retrouve son corps.',
    ],
  },
  {
    date: '11/08/2026 21:00',
    title: 'Le journal de bord attend qu’on l’ait lu',
    notes: [
      'Le carton d’ouverture (le journal du Dr Véga) s’effaçait tout seul au bout de 6,5 secondes — trop vite pour lire. Il RESTE désormais affiché, et une croix ✕ le ferme quand on a fini. Lire ne se chronomètre pas.',
    ],
  },
  {
    date: '11/08/2026 20:40',
    title: 'L’école des surfaces en tête de file, et l’onboarding partout',
    notes: [
      'Trois TABLEAUX-ÉCOLE ouvrent la file du bouton SALLES : 21-S1 « les parois » (absorber, repousser, retenir), 21-S2 « les climats » (froid, chaud, grille, éponge) et 21-S3 « les zones » (hublot fendu qui glace, conduite rompue qui vaporise, zone libre qui rend le choix). Pas d’énigme : on traverse, on comprend, on sort — les étiquettes font la leçon.',
      'La file d’essai fait désormais NEUF salles : l’école, puis la trilogie des optiques (miroir, prisme, plasma), puis la trilogie des compositions (double verrou, grille, traversée). L’éditeur les propose toutes dans « Tableaux livrés », l’école en tête.',
      'Et la prise en main se montre PARTOUT : au doigt les cartes tactiles, à la souris de nouvelles cartes clavier/souris (clic maintenu, F et G pour les états, molette et clic droit pour la caméra, Espace/R/Échap — et le rappel manette). Chaque mode a sa propre mémoire : on peut découvrir le jeu au bureau puis sur téléphone, chaque main a sa leçon.',
    ],
  },
  {
    date: '11/08/2026 20:05',
    title: 'Trois nouveaux tableaux : la seconde trilogie compose les optiques',
    notes: [
      '21-K « LES DEUX VERROUS » : deux faisceaux, deux récepteurs, deux portes en série — se figer sur le berceau pour renvoyer le premier, se répandre sur l’étagère pour plier le second. Les cibles à verrou prennent tout leur sens : un seul corps, deux états, dans l’ordre qu’on veut.',
      '21-L « À TRAVERS LA GRILLE » : une grille barre toute la hauteur de la cuve — l’eau s’arrête net, seule la VAPEUR passe. Se vaporiser dans le faisceau au pied du rail (la colonne chaude aide), et le rail ENGAGÉ porte le nuage de l’autre côté, même quand le faisceau l’a perdu. Le dépôt froid recondense à l’arrivée.',
      '21-M « LA TRAVERSÉE DES ÉTATS » : la finale-gant — trois chambres, trois verrous, un état par porte : miroir, prisme, arc. Le récepteur du prisme est scellé en façade de sa porte : le faisceau plié vient mourir dessus.',
      'Chaque énigme est PROUVÉE par le traceur optique (les tests balayent les positions du corps : fenêtres de résolution confortables, et à vide rien ne s’allume). L’expédition passe à 13 tableaux, le bouton SALLES LASER enchaîne les six, et l’éditeur les propose tous dans « Tableaux livrés ».',
    ],
  },
  {
    date: '11/08/2026 19:35',
    title: 'Le rail porte son nuage jusqu’à l’arrivée, même rayon éteint',
    notes: [
      'Le champ d’un rail ne vivait que tant que l’ARC y circulait : dès que la vapeur quittait le trajet du rayon, le plasma s’éteignait — et le nuage restait en rade au milieu de la ligne. Désormais le rail s’ENGAGE : une fois allumé par un arc, son champ tient tant qu’un nuage voyage dans sa bande, et ne se relâche qu’une fois la bande vide — nuage arrivé au bout, recondensé ou dispersé.',
      'Ce qui est pris est porté : il suffit d’un passage du rayon dans la vapeur pour confier tout le nuage au rail jusqu’à son terminus.',
    ],
  },
  {
    date: '11/08/2026 19:10',
    title:
      'Le CONTINUER apparaît vraiment, et la collecte n’agonise plus jamais',
    notes: [
      'Le bouton CONTINUER exigeait la MOITIÉ du volume de départ en bonbonne — inatteignable en vraie partie, puisque chaque impulsion éjecte de l’eau en route. Il s’offre désormais dès UN DIXIÈME du volume bu : « un peu d’aspiration », comme convenu, et c’est le joueur qui décide.',
      'Et la vraie source des alarmes est tarie : 1,2 s après la fin de l’aspiration, le jeu voyait un corps quasi vide et déclarait « dernière impulsion donnée — l’échantillon dérive »… sur un corps COLLECTÉ. Dès qu’un peu d’aspiration a eu lieu, la fin de course funeste (alertes, gel, bouton Recommencer) cède la place au CONTINUER — une seule invite à l’écran.',
      'Vérifié par une collecte réelle en trois temps : à 15 % bu le bouton est là sans aucune bannière ; corps entièrement bu (3 particules restantes, 5 s d’attente) toujours aucune alarme ; le clic conclut l’essai. L’aspiration TOTALE, elle, conclut toujours toute seule.',
    ],
  },
  {
    date: '11/08/2026 18:45',
    title: 'La colonne de boutons colle enfin au bord gauche du téléphone',
    notes: [
      'En paysage téléphone, la colonne de boutons flottait à 268px du bord : une règle PC (qui réserve la place du panneau de banc en bas à gauche) s’appliquait aussi au téléphone, car un téléphone couché dépasse ses 701px de large. Elle ne vise plus que les écrans au pointeur fin ou assez hauts — au doigt, la colonne s’ancre au bord gauche (zone d’encoche respectée).',
    ],
  },
  {
    date: '11/08/2026 18:20',
    title:
      'Le son s’éveille tout seul, le dash se tait, et les alarmes respectent l’aspiration',
    notes: [
      'Plus de bouton « Activer le son » : l’audio s’éveille au PREMIER geste, quel qu’il soit — toucher, clic ou touche. Sur la fiche ne reste qu’un bouton MUTE (🔊 SON / 🔇 MUET), comme en jeu, atteignable à la manette.',
      'Le souffle d’aspiration qui accompagnait chaque impulsion de vapeur est retiré : le dash se voit à l’écran et se sent dans la manette (vibration), il n’a pas besoin de souffler.',
      'Les alertes « réserve basse » et « dernière impulsion » se taisent VRAIMENT pendant que le sas boit : la garde couvrait le gong final mais pas l’alerte de réserve — les deux passent sous la même garde (enCollecte). Vérifié par une aspiration réelle : zéro alerte pendant la collecte, et le bouton CONTINUER apparaît bien dès la moitié du volume avalée.',
    ],
  },
  {
    date: '11/08/2026 17:55',
    title:
      'La bande de vie partout, la fiche mobile allégée, et le premier toucher réparé',
    notes: [
      'LA BANDE DE VIE, sur toutes les plateformes : une ligne fine en haut — le volume et sa jauge quasi PLEINE LARGEUR (on voit fondre ce qu’on dépense, PC compris), et trois pastilles-icônes à droite (▦ tableau, ⛽ bonbonnes, ❄ coque) : un toucher dit leur nom.',
      'Au doigt, les boutons du bas passent en COLONNE À GAUCHE (le pouce gauche les tient, le droit vise), les états restent à droite, et les crans de temps se retirent (ils vivent au banc).',
      'La fiche mobile s’allège : les REGISTRES passent derrière un bouton ◧ RECORDS (un voile les montre, avec le champ du nom) — Commandes, Records et Plein écran tiennent tous au-dessus de la ligne de flottaison. À l’arrivée sur la fiche, le SON et le PLEIN ÉCRAN battent trois fois pour attirer l’œil.',
      'Et un vieux fantôme est exorcisé : le PREMIER toucher se perdait souvent — masquer le bouton du son au réveil de l’audio re-composait la fiche entre le relâcher du doigt et le clic, qui ratait sa cible. Le bouton se retire désormais après coup : tout répond du premier coup.',
    ],
  },
  {
    date: '11/08/2026 17:10',
    title: 'La victoire se décide : le bouton CONTINUER, et le son au pad',
    notes: [
      'Des gouttes égarées traînent presque toujours quelque part : exiger l’aspiration TOTALE bloquait la victoire. Désormais, dès que le sas a bu la MOITIÉ du volume de départ, un bouton CONTINUER — vert, pulsant, au-dessus de la barre — s’offre au joueur : conclure l’essai avec ce qui est en bonbonne, ou aller cueillir les dernières gouttes. L’aspiration complète conclut toujours toute seule. Le bouton répond aussi au A de la manette.',
      'La navigation manette de la fiche suit maintenant l’ORDRE VISUEL : la croix descend comme l’œil lit — « Activer le son » en premier, puis Commencer, et le reste. (Rappel navigateur : le tout premier déblocage du son exige un vrai toucher ou clic — au Deck, un appui d’écran ou de trackpad suffit, une seule fois.)',
    ],
  },
  {
    date: '11/08/2026 16:45',
    title:
      'Réparé : les boutons de la fiche avaient disparu en paysage téléphone',
    notes: [
      'Les règles compactes du paysage étaient placées AVANT les styles de base dans la feuille : elles perdaient la cascade, et le cadre coupait les boutons au lieu de les resserrer. Les blocs sont déplacés en fin de feuille — la compaction s’applique vraiment.',
      'Et la fiche du téléphone tourné assume d’être un MENU : le texte de présentation s’efface, tout tient à l’écran — son, Commencer, Salles laser, Éditeur, Commandes, Plein écran, et les registres à droite. Chaque colonne sait défiler dans son cadre si un écran plus petit l’exige.',
    ],
  },
  {
    date: '11/08/2026 16:20',
    title:
      'L’interface de jeu compacte en paysage mobile, et la barre de bord expliquée',
    notes: [
      'En PAYSAGE téléphone, l’interface de jeu passait en habits de bureau : gros panneaux, grosses cartes d’état, boutons géants. Toute la mise en page compacte du portrait s’applique désormais aussi au tactile en paysage — HUD en bande fine tout en haut, états 💧 ❄ 💨 en colonne d’icônes sous le pouce droit, barre tactile resserrée. L’écran appartient à la cuve.',
      'L’ONBOARDING gagne une quatrième carte : LA BARRE DE BORD — ⏸ pause, ↺ recommencer, ⌖ recadrer, ≡ le menu, et les états à droite — les chips s’allument tour à tour, dix secondes et tout est dit.',
    ],
  },
  {
    date: '11/08/2026 15:50',
    title: 'La fiche en une page, le panneau COMMANDES, le plein écran',
    notes: [
      'Les COMMANDES quittent la fiche : un bouton « ⌘ COMMANDES » ouvre un panneau à trois onglets — PC, MANETTE, TACTILE — qui s’ouvre sur le bon selon votre façon de jouer. La fiche respire, et en PAYSAGE MOBILE elle tient désormais en UNE page : boutons resserrés, registres qui défilent dans leur cadre, rien ne déborde.',
      'Bouton « ⛶ PLEIN ÉCRAN » sur la fiche, PC comme mobile (masqué là où le navigateur ne le permet pas, iOS notamment).',
      'Les TABLEAUX LIVRÉS s’ouvrent dans l’ÉDITEUR : un sélecteur en tête de la colonne de droite charge une copie de n’importe quel tableau de l’expédition — dont les salles laser 21-H/I/J — pour l’étudier ou en repartir. « Enregistrer comme… » pour publier votre variante.',
      'Le bouton ☰ (Start) de la manette met en PAUSE et affiche la fiche ; re-☰ reprend l’essai. Et « Ouvrir le son » devient « 🔊 ACTIVER LE SON » — plein, lumineux, impossible à rater.',
    ],
  },
  {
    date: '11/08/2026 15:05',
    title:
      'Mobile : le paysage demandé, la prise en main tactile en trois gestes',
    notes: [
      'Sur téléphone en PORTRAIT, un voile demande de tourner l’appareil — un téléphone stylisé pivote, « le protocole s’observe en paysage ». Le verrou de rotation a sa sortie de secours (« continuer en portrait »).',
      'En PAYSAGE, la fiche s’adapte : pleine largeur, deux colonnes, figure retirée, tout tient sans ascenseur visible.',
      'PRISE EN MAIN TACTILE au premier lancement : trois cartes animées — le doigt posé (l’éjection et son onde), les trois états (💧 ❄ 💨), la pince à deux doigts (zoom, caméra, ⌖). Un toucher passe à la suivante ; montrée une seule fois, l’essai reste figé pendant la lecture.',
    ],
  },
  {
    date: '11/08/2026 14:30',
    title:
      'Gâchettes = zoom, fin de course muette quand le sas boit, nuage qui fait corps',
    notes: [
      'MANETTE : les grosses gâchettes zooment — RT rapproche, LT recule, la pression dose la vitesse. AGIR passe sur A seul (éjecter, viser-relâcher le dash). Et la fiche gagne un panneau « COMMANDES MANETTE », bouton par bouton.',
      'Quand le SAS BOIT, la fin de course se tait : plus d’alerte, plus de sting de dernière impulsion, plus de gel — le volume fond parce qu’il est COLLECTÉ, pas parce qu’il se perd. Et la victoire attend désormais que TOUT soit aspiré : gouttes détachées, palets de glace et volutes comptent — pas seulement le corps principal.',
      'Le NUAGE FAIT CORPS sur les rails : les retardataires hors de la bande du champ sont rappelés vers le cœur convoyé — les virages ne déchirent plus la vapeur, et quand un seul morceau est capturé, il emmène le reste au lieu de s’en détacher.',
      'Et la MANETTE NAVIGUE DANS LA FICHE : croix (ou stick) haut/bas pour passer d’un bouton à l’autre — le visé porte un liseré — et A pour valider. Sur Steam Deck, le va-et-vient manette ↔ souris est déjà à la volée : configurez le trackpad droit en « Souris » dans la disposition Manette de jeu, le jeu bascule tout seul.',
    ],
  },
  {
    date: '11/08/2026 13:55',
    title: 'Vapeur qui respire, fiche qui fige, et le Deck sans ascenseur',
    notes: [
      'Le bruit de VAPEUR est refait en procédural : fini le sifflement de haute pression — une nappe sombre qui ROULE, dont le filtre ondule et le niveau respire sur deux cadences lentes désynchronisées. Le nuage vit, il ne siffle pas. (Provisoire assumé : un vrai son pourra le remplacer.)',
      'La FICHE FIGE L’ESSAI : revenir au menu (≡ ou Échap) met la partie en pause — la cuve n’avance plus dans le dos du joueur. Reprendre ou Recommencer relance le temps. Et les commandes de jeu (toucher, F, G, R, espace…) se taisent tant que la fiche est ouverte.',
      'Nouveau bouton RECOMMENCER LE TABLEAU sur la fiche, visible dès qu’un essai a commencé.',
      'Steam Deck : plus d’ascenseur sur la fiche — les barres de défilement sont masquées, la mise en page se resserre sous 840 px de haut et le panneau COMMANDES démarre replié. La fiche tient pile dans l’écran.',
    ],
  },
  {
    date: '11/08/2026 13:20',
    title:
      'La fiche d’accueil en grand, et le bouton d’essai mène aux salles laser',
    notes: [
      'L’ACCUEIL occupe désormais une bonne partie de l’écran : la fiche passe en deux colonnes (~1060 px) — le protocole à gauche (titre en grand, consigne, relevé, boutons), le dossier à droite (figure, registres, commandes). Sur écran étroit, tout s’empile comme avant.',
      'Le bouton d’essai de la fiche mène aux SALLES LASER : la trilogie 21-H → 21-J (miroir, prisme, plasma) se joue d’un clic, enchaînée sas après sas, hors expédition et hors registres — même si votre partie suit la séquence de la bibliothèque partagée. Le prototype 21-A bis reste accessible depuis le banc (dossier Tableaux).',
    ],
  },
  {
    date: '11/08/2026 12:50',
    title:
      'La trilogie laser entre dans l’expédition : trois nouveaux tableaux',
    notes: [
      'Les CIBLES sont À VERROU : un passage du faisceau suffit, l’activation est acquise et la porte reste ouverte (jusqu’au Recommencer). Plus besoin de tenir le rayon — on allume, puis on voyage.',
      'La RÉFRACTION est lissée comme le miroir : le milieu liquide devient une isoligne de densité au lieu d’un contact au grain près. Le dioptre ne clignote plus sur le clapot, et une gouttelette isolée ne dévie plus le rayon.',
      'TROIS NOUVEAUX TABLEAUX, insérés avant la dérive finale — la trilogie qui révèle la fonction de l’échantillon. 21-H « La salle des miroirs » : se figer dans le faisceau sur le berceau froid, le corps devient miroir, le reflet monte au récepteur. 21-I « Le prisme » : se coller à l’étagère hydrophile, le corps liquide plie le rayon vers un récepteur hors de toute ligne droite. 21-J « La voie de plasma » : se vaporiser dans le faisceau au pied du rail — l’arc franchit le mur par le passage haut, allume le récepteur, et le champ convoie le nuage avec lui.',
      'Chaque énigme est vérifiée par le calcul : rien ne s’allume à vide, et une position raisonnable du corps (gelé, liquide, vapeur) résout chacune — avec de la marge.',
    ],
  },
  {
    date: '11/08/2026 12:15',
    title: 'Pack Steam réparé : les vraies tailles, les bonnes adresses',
    notes: [
      'Les images du pack partaient en 404 et, pire, les fichiers commis étaient capturés TROP LARGES (le conteneur pleine page au lieu du visuel seul — 2000 px de large pour la jaquette). Régénérés aux formats exacts : 600×900, 920×430, 1920×620, logo 640×360 vraiment transparent, icône 256.',
      'Les adresses des images passent en absolu (/steam/…) : la page marche désormais qu’on l’ouvre avec ou sans barre oblique finale.',
    ],
  },
  {
    date: '11/08/2026 11:50',
    title: 'Manette : le stick montre le CAP, la flèche le dessine',
    notes: [
      'Le stick gauche dit désormais où l’on veut ALLER — plus besoin de penser « éjection » : en eau, elle part automatiquement à l’opposé (c’est elle qui pousse), en vapeur le dash file dans la direction du stick. Une même logique : le stick, c’est le cap.',
      'Le réticule cède la place à une FLÈCHE DE CAP lissée : elle naît dès qu’on effleure le stick, glisse vers le nouveau cap sans à-coup, s’allonge avec l’inclinaison, et s’efface en douceur. En visée de dash, la ligne du dash (avec son coût) prend le relais.',
      'Souris et manette ne se marchent plus dessus : BOUGER la souris reprend la main immédiatement — la flèche disparaît sans attendre, et une action manette en cours se relâche proprement.',
      'Le stick droit est INVERSÉ : pousser à droite regarde à droite (c’était le sens du glisser-déplacer, à rebours de l’attente).',
    ],
  },
  {
    date: '11/08/2026 11:15',
    title: 'Le pack d’illustrations Steam, servi par le jeu',
    notes: [
      'Sur sujet21.vercel.app/steam/ : jaquette 600×900, bandeau 920×430, bannière héros 1920×620, logo transparent et icône — les formats exacts qu’attend Steam pour habiller l’entrée « jeu non Steam » du Steam Deck. Dessinés dans l’identité du jeu : le corps d’eau, le faisceau qui se plie, le rail magnétique, la cible.',
      'La page explique la pose en mode Bureau (clic droit → illustration personnalisée). Steam n’autorise aucune application à installer les jaquettes à votre place — c’est l’unique étape manuelle, une seule fois.',
    ],
  },
  {
    date: '11/08/2026 05:55',
    title: 'L’éponge boit en silence',
    notes: [
      'Le bruit de succion de l’éponge est SUPPRIMÉ — il agaçait plus qu’il n’informait. Le feutre qui se remplit et la jauge de volume disent déjà tout ce qu’il y a à savoir.',
    ],
  },
  {
    date: '11/08/2026 05:40',
    title: 'La manette entre dans la cuve (Steam Deck, Xbox, DualSense)',
    notes: [
      'Branchez une manette, elle a la main : le STICK GAUCHE place un réticule en orbite autour du corps (la direction, c’est le stick ; l’inclinaison, c’est la puissance — pleine inclinaison = plein dash), et la GÂCHETTE DROITE (ou A) est le doigt posé : maintenir éjecte en eau ; en vapeur, maintenir vise dans le temps ralenti, relâcher dashe.',
      'LB : glace · RB : vapeur · X : retour à l’eau. Stick droit : caméra. Croix : zoom (haut/bas) et ralenti/accéléré (gauche/droite). Start : pause · Select : recommencer. Dans les menus, A valide le bouton principal. La manette VIBRE sur le dash et la dernière impulsion.',
      'Le tactile garde toujours la priorité : un doigt posé, et la manette s’efface. Le réticule ne s’affiche que quand la manette parle.',
      'Deux limites honnêtes : le nom d’opérateur se tape une fois au clavier ou au tactile (puis reste en mémoire), et le premier son demande un vrai toucher — les navigateurs n’éveillent pas l’audio sur un bouton de manette.',
    ],
  },
  {
    date: '11/08/2026 04:55',
    title: 'Éditeur : sélection multiple, alignement, et l’outil Découpe',
    notes: [
      'SÉLECTION MULTIPLE : Maj + clic ajoute (ou retire) un élément — parois, éponges, zones, mécanismes, rails, étiquettes, tout se mélange. Glissez l’un des élus : le groupe entier se déplace, aimanté à la grille. Suppr balaye tout d’un coup. Échap vide la sélection.',
      'ALIGNEMENT : dès deux éléments sélectionnés, le panneau devient l’atelier — aligner à gauche, à droite, en haut, en bas, ou centrer sur un axe. Fini les blocs qui se chevauchent d’un demi-carreau.',
      'DÉCOUPE (Surfaces) : la zone tracée est RONGÉE des parois qui la chevauchent — chaque paroi touchée est remplacée par ses restes, quatre morceaux au plus, les éclats balayés. Pour tailler les recouvrements de la map 1 sans tout reposer : on découpe l’excédent, on ne reconstruit pas.',
    ],
  },
  {
    date: '11/08/2026 04:20',
    title: 'Le champ convoie la vapeur : le nuage voyage sur le rail',
    notes: [
      'Deuxième retour d’essai : l’arc suivait bien le rail, mais le nuage restait planté. Corrigé — le plasma est soumis au champ, TOUT le plasma : tant qu’un arc circule sur un rail, la vapeur prise dans la bande est ENTRAÎNÉE le long de la ligne, dans le sens des chevrons, avec un recentrage doux qui fait prendre les virages. Le nuage voyage sur la ligne de champ tant que le faisceau l’ionise.',
      'La bande de convoyage est plus large que la capture : le nuage entier embarque, pas seulement son cœur posé sur la ligne. L’eau et la glace, non ionisables, ne sentent rien.',
      'Au banc (« Laser ») : curseur « convoyage » — à 0, on retrouve l’arc seul guidé, nuage immobile.',
      'Et dans l’éditeur : boutons + / − dans la barre, pour zoomer quand la roulette fait des siennes (pavé tactile, mobile). Mêmes bornes que la roulette, centré sur la vue.',
    ],
  },
  {
    date: '11/08/2026 03:50',
    title: 'Les rails ont un SENS : capture n’importe où le long de la ligne',
    notes: [
      'Premier essai en vrai : le nuage était posé au MILIEU du rail, et rien ne se passait — la capture n’acceptait que les extrémités. Corrigé : l’arc ionisé s’accroche N’IMPORTE OÙ le long de la ligne de champ.',
      'Du coup, le rail a un SENS : capturé en chemin, l’arc circule dans le sens du tracé (du premier point vers le dernier) jusqu’au bout, puis repart tout droit. Des CHEVRONS le montrent, en jeu comme dans l’éditeur — et la bande de capture translucide dit la portée du champ tout du long.',
      'Dans l’éditeur : bouton « Inverser le sens » au panneau du rail sélectionné ; prolonger un rail par son début ne retourne plus la ligne (le sens est préservé, on prolonge en amont).',
    ],
  },
  {
    date: '11/08/2026 03:20',
    title: 'Laser palier 3 : la vapeur ionise — l’arc de plasma suit les rails',
    notes: [
      'Le PLASMA est là, et il se PROVOQUE — ce n’est pas un quatrième état. Un faisceau qui traverse le nuage de vapeur du joueur s’IONISE : l’arc, blanc-violet, crépite plus vite que la lumière ordinaire.',
      'Et le plasma est extrêmement soumis aux champs magnétiques : l’arc ionisé qui passe près d’une extrémité de RAIL MAGNÉTIQUE est capturé, suit la ligne de champ jusqu’à l’autre bout — virages à 90°, serpentins — puis repart tout droit, désionisé. Le faisceau ordinaire ignore superbement les rails : il faut être vapeur dans la lumière, au bon endroit. Une cible inatteignable en ligne droite devient le prix d’un beau placement de nuage.',
      'L’arc guidé reste de la lumière : cibles, parois pleines et portes fermées l’arrêtent en chemin.',
      'Dans l’ÉDITEUR : l’outil « Rail magnétique » (MÉCANISMES) trace la ligne de champ tronçon par tronçon — reposez sur une extrémité pour prolonger, Échap pour finir. Sélection, déplacement, duplication, suppression comme le reste. Les anneaux de capture se voient aux extrémités ; le contrôle signale un rail sans émetteur ou hors de la cuve.',
      'Au banc (« Laser ») : curseur « capture de rail » — le rayon d’indulgence autour des extrémités.',
    ],
  },
  {
    date: '11/08/2026 02:40',
    title: 'Le faisceau ne boit plus : traverser la lumière est gratuit',
    notes: [
      'La chauffe du laser est SUPPRIMÉE : l’eau qui traverse le faisceau — ou que le faisceau traverse — ne s’évapore plus. La lumière plie le corps (réfraction), le corps plie la lumière (miroir, prisme), mais personne ne paie le passage.',
      'Servir de prisme ou promener un rayon piégé sous sa surface devient un outil sans contrepartie : la dépense du joueur reste où elle a toujours été — l’éjection, le dash, les éponges, les radiateurs.',
      'Disparus du banc, du solveur et des paramètres : le couloir de chauffe et son débit d’évaporation.',
    ],
  },
  {
    date: '11/08/2026 02:15',
    title: 'Laser palier 2 : le corps liquide est un prisme vivant',
    notes: [
      'L’EAU RÉFRACTE. Quand le faisceau traverse le corps liquide, il se plie à chaque surface (Snell-Descartes, indice 1,33 — l’eau réelle) : entrer le rapproche de la normale, sortir l’en écarte. Le corps devient un instrument d’optique que l’on sculpte en jouant — s’étaler, se regrouper, s’étirer change la façon dont la lumière le traverse.',
      'La RÉFLEXION TOTALE INTERNE est là aussi : un rayon qui tente de sortir trop à plat (au-delà de ~49° de la normale) reste PRISONNIER de l’eau et ricoche sous sa surface — on peut piéger la lumière dans son propre corps et la promener avec soi.',
      'Traverser n’est pas gratuit : le couloir de chauffe évapore l’eau sur le trajet (vers la rosée, comme toujours). Servir de prisme, c’est fondre un peu.',
      'La surface liquide utilise le même lissage de normale que le miroir de glace (une surface de particules est encore plus agitée liquide que gelée) ; le tronçon immergé du faisceau se voit — halo élargi et rosé, la lumière diffuse dans le corps.',
      'Au banc (« Laser ») : curseur d’indice de réfraction — à 1, l’eau redevient transparente ; plus haut, le prisme plie et piège davantage. La glace reste prioritaire : gelé, on est un miroir, pas un prisme.',
    ],
  },
  {
    date: '11/08/2026 01:45',
    title: 'Le miroir de glace est poli : le reflet ne tremble plus',
    notes: [
      'La surface d’un corps gelé est granuleuse (c’est un empilement de particules), et le faisceau réfléchi partait dans tous les sens à chaque bosse. Les deux rayons sont maintenant séparés : le CONTACT reste détecté au grain près, mais la NORMALE du miroir se moyenne sur une zone large (~4 espacements de particules, pondérée par la proximité) — la facette frappée est plane, le reflet est stable et suit l’orientation générale du bloc.',
      'Le lissage se règle au banc (« Laser », nouveau dossier) avec la largeur du couloir de chauffe et le débit d’évaporation. La prise du sas sur la glace y gagne aussi son curseur (« Sas »).',
    ],
  },
  {
    date: '11/08/2026 01:10',
    title:
      'Deux corrections : les mécanismes tiennent leur plan, la glace ne goutte plus',
    notes: [
      'Sur mobile, faisceaux, émetteurs, cibles et portes dérivaient vers le coin bas-droit et bougeaient avec le zoom, comme décollés du décor : le canevas de superposition n’avait pas de taille CSS explicite, et un canvas sans taille garde sa taille intrinsèque (bitmap × densité d’écran) — invisible sur un écran de densité 1, flagrant à densité 2 ou 3. Corrigé : tout est ancré au plan du monde.',
      'Le « ploc » d’éjection continuait de goutter quand on maintenait le doigt en GLACE — un palet n’éjecte rien, il n’a pas à goutter. Le son se tait en glace.',
    ],
  },
  {
    date: '11/08/2026 00:45',
    title: 'Le laser entre en scène : le corps gelé est un miroir',
    notes: [
      'Premier palier des mécanismes laser. Un ÉMETTEUR trace son faisceau en continu : absorbé par les parois pleines, il PASSE les grilles (de la lumière entre des mailles), et se RÉFLÉCHIT sur la glace — le corps gelé est un miroir, l’angle du reflet suit l’orientation du bloc, que l’on règle en jouant (la rotation des palets sert enfin à ça).',
      'L’eau paie de rester dans la lumière : le faisceau l’évapore lentement — vers la réserve de rosée, récupérable aux plaques froides. La vapeur, elle, traverse sans se soucier (le plasma, c’est pour plus tard).',
      'Une CIBLE touchée s’allume, et les PORTES qui lui sont asservies s’ouvrent — des barrières d’énergie rouges qui bloquent tout, eau, glace, vapeur et lumière, tant que leur cible est éteinte. Une persistance courte évite le clignotement quand le miroir tremble.',
      'L’éditeur a ses trois outils (MÉCANISMES) : l’émetteur se pose et s’oriente d’un seul glisser, la cible se pose d’un clic, la porte se trace comme une paroi et s’asservit à la cible la plus proche (modifiable). L’aperçu du faisceau est tracé par le MÊME code que le jeu — sans miroir, faute de corps : il montre le trajet à vide.',
      'Le contrôle veille : porte asservie à une cible fantôme = erreur ; émetteur sans cible ou cible sans émetteur = avertissement.',
    ],
  },
  {
    date: '11/08/2026 00:05',
    title: 'L’éponge gorgée ne bloque plus que le liquide',
    notes: [
      'Une cellule d’éponge saturée devient solide — mais elle bloquait TOUT, glace et vapeur comprises, alors que la légende promettait le contraire. Une éponge détrempée est molle : le palet de glace passe au travers du feutre, la vapeur passe entre les fibres. Seule l’eau bute toujours dessus.',
      'La vapeur qui traverse paie toujours son péage sur les cellules encore sèches ; les cellules pleines ne peuvent plus rien boire.',
    ],
  },
  {
    date: '10/08/2026 23:40',
    title:
      'L’éditeur montre les zones d’effet : auras, aspiration, illustrations, décals',
    notes: [
      'Chaque surface montre désormais la portée RÉELLE de son influence, en rectangle arrondi iso-distance : l’aura de gel de la plaque froide (avec, en pointillé long, sa portée à froid complet — elle grandit en cours de partie), l’aura du radiateur (avec, en pointillé court, sa portée réduite à froid), et les bandes d’influence hydrophile et hydrophobe.',
      'Le sas montre son rayon d’aspiration — le courant qui hale l’eau et la glace commence bien avant son rectangle.',
      'Les zones dessinent leur illustration (hublot, conduite, rampe) ajustée exactement comme dans le jeu, sous leur lisière ondulée ; les décals (tuyaux, vannes) sont peints à leur place. L’éditeur montre ce que le joueur verra.',
      'Au passage, un vrai bug : le chargement JSON ne relisait pas les décals — un tableau passé par l’éditeur perdait sa machinerie peinte. Corrigé, avec l’aller-retour testé.',
    ],
  },
  {
    date: '10/08/2026 23:10',
    title:
      'Zones : l’illustration entière, la glace en givre blanc, les effets allégés',
    notes: [
      'La rampe de buses sortait coupée net : l’illustration n’était dessinée que dans le champ de la brume, et la lisière arrondie tronquait l’objet. Une rampe n’est pas un gaz — l’image se dessine maintenant entière dans son cadre, seule la brume suit la lisière.',
      'La zone GLACE ne se voyait plus : du cyan sur une cuve cyan. Sa brume givre maintenant en BLANC, nettement renforcée — les deux autres gardent leur teinte, le violet et le bleu contrastent déjà.',
      'Le panache, les gouttes et la brume s’allègent fortement sur l’illustration elle-même : les effets vivent AUTOUR de l’objet, ils ne le recouvrent plus — la conduite rompue redevient lisible sous sa vapeur.',
    ],
  },
  {
    date: '10/08/2026 22:50',
    title:
      'Les zones perdent leur contour : une brume d’accident, pas une bulle',
    notes: [
      'Le liseré lumineux qui suivait la lisière faisait bulle de savon posée sur le décor. Il disparaît : à la place, une BRUME teintée — dense au foyer, elle se dissout en lambeaux irréguliers vers la lisière, déchirée par le bruit au lieu d’être dessinée. Une atmosphère qui s’échappe de l’accident, pas un marquage.',
      'Les lambeaux meurent SUR la lisière mécanique, jamais au-delà : la forme du rayon d’action n’a pas bougé, seul son habit a changé. Et la brume s’allège sur l’illustration elle-même — le hublot, la conduite et les buses restent lisibles sous leur nappe.',
    ],
  },
  {
    date: '10/08/2026 22:30',
    title: 'L’éjection maintenue goutte, au lieu de sonner une fois',
    notes: [
      'Maintenir l’éjection ne jouait la goutte qu’à l’amorce du geste — trois secondes d’éjection, un seul « ploc ». Elle goutte maintenant tant qu’on maintient : une toutes les 0,12 à 0,22 s, à cadence irrégulière (l’eau n’est pas un métronome), toujours en tirant au sort une des trois prises et un écart de hauteur de ±7 %.',
    ],
  },
  {
    date: '10/08/2026 22:10',
    title: 'Le rayon d’action des zones : un halo qui émane de l’accident',
    notes: [
      'Fini le rectangle administratif, ses chevrons et son marquage au sol : le régime ÉMANE maintenant de l’accident dessiné au centre. Sa limite est une lisière arrondie et IRRÉGULIÈRE — une ellipse inscrite dans le rectangle de l’éditeur, ondulée par trois harmoniques dont les phases dépendent de la zone : deux hublots fendus n’ont pas la même silhouette.',
      'Ce n’est pas qu’un visuel : la MÉCANIQUE suit exactement la même forme. La formule est unique, calculée d’un seul côté et partagée avec le shader — ce qu’on voit est ce qu’on subit, au pixel près. Les coins du rectangle ne forcent plus rien.',
      'Le voile intérieur devient un souffle : dense au foyer (près de la cause), fondu vers la lisière, animé d’une lente respiration. Le liseré ondule et sa lueur varie le long du bord — vivant, pas administratif.',
      'Dans l’éditeur, le rectangle reste l’outil de travail (poignées, redimensionnement), mais la lisière réelle est dessinée pleine à l’intérieur : on voit exactement où le régime s’applique.',
    ],
  },
  {
    date: '10/08/2026 21:45',
    title:
      'Les zones ont leurs vraies images, et l’eau passe enfin devant le décor',
    notes: [
      'Trois illustrations remplacent la géométrie schématique des zones : le hublot fendu (verre étoilé sur le vide, givre en dentelle), la conduite rompue (collecteur éventré, fumée à la brèche) et la rampe de buses (jets de brume, gouttes qui perlent). Chacune s’ajuste dans sa zone, refroidie pour se fondre dans la cuve.',
      'Le décor procédural ne disparaît pas : ses parties ANIMÉES continuent par-dessus l’image — souffle glacé du hublot, panache qui monte de la brèche, gouttes qui tombent des buses, voile de condensation. L’image porte la matière, l’animation porte la vie. Sans image chargée, l’ancien dessin revient tel quel.',
      'Et un bug de profondeur : les décalques (vannes, tuyaux) étaient peints PAR-DESSUS l’échantillon — une vanne flottait devant l’eau. Décals et images de zones s’effacent maintenant sous le fluide : le corps passe devant le décor, comme il se doit.',
      'La conduite était livrée sur un damier de fausse transparence incrusté dans les pixels : détourée par chromakey (fond neutre et clair → transparent), la fumée violette de la brèche est préservée.',
    ],
  },
  {
    date: '10/08/2026 21:15',
    title: 'Le temps suspendu monte encore d’un cran',
    notes: [
      'Pendant la visée du dash, le monde descend à 30 % de son niveau derrière un passe-bas à 240 Hz ; la texture du temps suspendu monte à 150 % de son niveau nominal, le cœur bat plus fort, le plongeon d’entrée et la remontée de sortie aussi. Le contraste entre le monde étouffé et la voix nette fait tout l’effet.',
    ],
  },
  {
    date: '10/08/2026 20:55',
    title:
      'Le ralenti s’accentue, et une vraie texture habite le temps suspendu',
    notes: [
      'Le premier réglage était trop timide : les basses de la musique passaient sous le filtre et masquaient tout. Le monde plonge maintenant plus bas (passe-bas à 290 Hz au lieu de 430) ET baisse de moitié en niveau — l’effet « sous l’eau » ne se devine plus, il s’impose.',
      'Le plongeon d’entrée et la remontée de sortie sont nettement plus francs, et le cœur au ralenti bat deux fois plus fort.',
      'Une texture générée (drone sombre autour de 141 Hz, 62 Ko) habite désormais la visée : branchée HORS du filtre, elle est la seule voix à rester nette pendant que tout le reste s’étouffe. Chargée à la demande au premier dash, bouclée sans couture par le croisement de lectures.',
    ],
  },
  {
    date: '10/08/2026 20:35',
    title: 'Le ralenti s’entend : le monde plonge sous l’eau pendant la visée',
    notes: [
      'Viser en vapeur étouffe TOUT le mixage — musique et bruitages compris — derrière un passe-bas qui se referme (19 500 → 430 Hz), comme une oreille qui passe sous l’eau. À l’entrée, un plongeon de hauteur ; au relâchement, le filtre rouvre d’un coup sec, l’air revient, et le souffle du dash part.',
      'Deux voix habitent le temps suspendu, branchées HORS du filtre pour rester nettes quand tout s’étouffe : un battement grave qui pulse comme un cœur au ralenti, et un scintillement d’air très discret.',
      'Aucun fichier : tout est synthétisé, gratuit au chargement, et suit la coupure et le volume existants. C’est aussi la seule façon d’étouffer la musique en même temps — un sample par-dessus n’aurait pas ce pouvoir.',
    ],
  },
  {
    date: '10/08/2026 20:10',
    title: 'Le dash s’affine : temps au ralenti, puissance à la distance',
    notes: [
      'Viser ne fige plus le temps : il le ralentit fortement (16× plus lent, réglable au banc). Le monde continue d’avancer pendant qu’on vise — une menace qui approche reste une menace, juste une menace au ralenti.',
      'La distance du doigt règle la puissance du dash : pleine à 300 unités du corps (réglable), dégressive en deçà — viser près donne un petit bond précis, et viser à deux kilomètres ne donne rien de plus que la portée de pleine puissance.',
      'L’étiquette de visée annonce les deux termes du marché : « DASH 64 % · −1,50 L » — la poussée qu’on obtiendra, le prix qu’on paiera. Le coût, lui, ne dépend pas de la distance : un tiers du volume courant, petit bond ou grand saut.',
    ],
  },
  {
    date: '10/08/2026 19:50',
    title: 'La vapeur dashe (façon Ori), et le sas hale la glace',
    notes: [
      'Le pilotage continu de la vapeur est remplacé par le dash : viser fige LE TEMPS ENTIER (physique, refroidissement, chrono) et trace la trajectoire depuis le corps, avec le coût annoncé sur l’étiquette ; relâcher lance tout le nuage d’un trait. Pas de recul, pas d’éjection, pas de frein — juste une impulsion, comme le dash d’Ori.',
      'Chaque dash évapore UN TIERS DU VOLUME COURANT, prélevé sur la traîne. Un tiers du courant, pas du volume de base : le deuxième dash coûte moins cher en litres et propulse exactement pareil — un tableau reste toujours soluble, il coûte juste de plus en plus cher. Les pertes rejoignent la réserve de rosée : elles perleront aux plaques froides, récupérables par une bonne trajectoire.',
      'La vapeur traverse toujours les grilles, et maintenant l’éponge la laisse passer en l’essorant : un petit péage en volume, encaissé par les cellules de l’éponge — cette matière-là est perdue pour de bon, elle ne perle pas en rosée.',
      'Le sas ne se contente plus d’avaler la glace qui lui tombe dessus : son courant a prise sur elle (moitié moins que sur l’eau — un bloc a de l’inertie) et la hale vers la bouche, sans giration : un palet n’orbite pas. Réglable au banc (« prise sur la glace »).',
      'Viser en vapeur est silencieux — le temps est figé ; le souffle part au moment du dash.',
    ],
  },
  {
    date: '10/08/2026 19:15',
    title:
      'Le seuil de dernière impulsion passe en litres, et le souffle d’éjection s’efface',
    notes: [
      'Le seuil était une FRACTION du volume de départ (5 %). Sur un tableau à petite réserve, 5 % tombait très haut en litres : l’alerte pouvait se déclencher dès 1,15 L, alors qu’il restait de quoi manœuvrer. Il est désormais un volume ABSOLU — 300 ml — quel que soit le volume de départ. On garde donc la main jusqu’à 0,30 L, puis la prochaine impulsion est la dernière ; l’alerte « réserve basse » prévient à 0,60 L.',
      'Le souffle continu qui accompagnait l’éjection d’eau est retiré : l’eau se signale par la goutte qui « ploc » à chaque impulsion, plus par un sifflement. La vapeur, elle, garde sa respiration.',
    ],
  },
  {
    date: '10/08/2026 18:40',
    title: 'L’éjection sonne enfin comme de l’eau',
    notes: [
      'Le bruit d’éjection livré était un sifflement d’air : 97,9 % de son énergie au-dessus de 1 kHz, 0,9 % en dessous. De la haute pression, pas du liquide. Il est remplacé par une goutte qui tombe dans l’eau — l’impact mouillé, puis la résonance de bulle qui glisse vers l’aigu.',
      'Trois prises, de hauteurs différentes (562, 604 et 674 Hz), tirées au sort à chaque impulsion, avec un écart de hauteur de ±7 %. Le geste revient plusieurs fois par seconde : deux fois le même « bloop » à la même note, et l’oreille entend une machine au lieu d’entendre de l’eau.',
      'Chaque prise est coupée juste après l’extinction de la bulle (0,42 à 0,75 s) — assez court pour ne pas se recouvrir d’une impulsion à la suivante. Les trois pèsent 21 Ko à elles toutes.',
    ],
  },
  {
    date: '10/08/2026 18:05',
    title: 'Plus de mort : l’échantillon dérive, et c’est vous qui décidez',
    notes: [
      'Le freinage de fin de course est retiré. Le vide ne freine rien : une fois la dernière impulsion donnée, le corps se fige et garde sa trajectoire — indéfiniment s’il le faut. Un rebond tardif peut encore le mener au sas, et cette possibilité vaut mieux qu’un chronomètre.',
      'L’écran de dispersion disparaît, celui de fin de course aussi. Rien ne recouvre plus la cuve : un bouton « RECOMMENCER LE TABLEAU » se range au-dessus du sélecteur d’états et attend. On peut l’ignorer et regarder la dérive finir.',
      'La dernière impulsion arrivait trop tôt : le seuil passe de 12 % à 5 % du volume initial (0,54 L → 0,22 L sur une cuve de 4,5 L), et l’alerte qui la précède de 20 % à 12 %. Il reste donc de quoi manœuvrer bien plus longtemps avant que le protocole ne s’en mêle.',
      'La fiche d’accueil propose d’ouvrir le son avant de plonger : le navigateur n’autorise le son qu’après un geste, et jusqu’ici ce geste était le clic sur COMMENCER — le thème d’accueil n’avait jamais l’occasion de se faire entendre.',
    ],
  },
  {
    date: '10/08/2026 17:20',
    title: 'La bande-son se branche : la cuve chante, les zones répondent',
    notes: [
      'Rien n’est accroché à un tableau précis — ils vont tous bouger. La musique suit ce qui ne bouge pas : l’accueil a son thème ; en cuve, deux lits se croisent au fil du refroidissement de la coque (tiède au départ, glacial à l’arrivée) ; chaque type de zone a son ambiance (hublot fendu, conduite rompue, chambre pressurisée) et efface le lit derrière elle le temps du passage.',
      'Les événements ponctuent : bouffée d’éjection à chaque impulsion, gel et vaporisation aux changements d’état, gouttes au dégel, choc de glace dont la force et la hauteur suivent la vitesse d’impact, gorgée d’éponge, vortex du sas, fanfare de collecte — et une autre, distincte, réservée aux records. La réserve à sec annonce la dernière impulsion ; la fin de course a sa propre pièce.',
      'Les 26 Mo livrés ne partaient pas en ligne tels quels : les masters sont sortis du dossier public et taillés par un script (tools/audio/prepare.py) en boucles de 30 à 40 s et en ponctuations de 6 à 11 s, mono, normalisées. Total embarqué : 1,8 Mo, et rien n’est téléchargé tant que le son est coupé — ni avant d’en avoir besoin.',
      'Le raccord de boucle est fait à la lecture : deux lectures se croisent en puissance constante, le décodeur MP3 peut bien ajouter ses millisecondes de silence, elles tombent dans le fondu.',
      'Dans l’éditeur, un tableau peut imposer son lit (champ « Musique ») ; par défaut il suit la cuve.',
    ],
  },
  {
    date: '10/08/2026 16:35',
    title: 'Neuf bruitages rejoignent la soute, derrière les musiques',
    notes: [
      'Après les dix musiques, voici les bruits de la matière : condensation, gel, vaporisation, goutte de rosée, impact sur la glace, souffle de vapeur, éponge, éjection et vortex du sas. Neuf sons courts, un par phénomène que la simulation sait déjà produire.',
      'Le poids est sans commune mesure avec celui des musiques : 640 Ko pour les neuf réunis, contre 25 Mo pour la bande-son. Ils tiennent dans un battement de cil du chargement, et pourront donc être préchargés sans précaution particulière.',
      'Comme les musiques, aucun ne se déclenche encore : le jeu continue de fabriquer ses sons à la volée. Reste à relier chaque fichier à l’événement qui lui correspond dans le solveur — et à décider ce qui se passe quand deux gouttes gèlent en même temps.',
    ],
  },
  {
    date: '10/08/2026 16:45',
    title: 'La bande-son entre en soute : dix pistes embarquées avec le jeu',
    notes: [
      'Dix musiques rejoignent le vaisseau : un thème d’accueil, trois ambiances de zone (hublot, chambre, conduite), deux cuves (tiède, glaciale), une fin de course et trois stings (collecte, record, dernière impulsion). Une demi-heure de matière en tout.',
      'Les originaux livrés pesaient 295 Mo de WAV — de quoi faire attendre le joueur cinq minutes sur l’écran d’accueil. Ils sont encodés en MP3 (~130 kb/s) : 25 Mo au total, et l’accueil descend de 53 Mo à 3,6 Mo. Les WAV restent au sec en local, hors du dépôt, comme les sources des visuels.',
      'Les pistes sont en ligne et servies par le CDN, mais aucune ne se déclenche encore : le jeu continue de fabriquer ses sons à la volée. Reste à décider quand chaque morceau entre, et comment il s’efface quand on change de zone.',
    ],
  },
  {
    date: '10/08/2026 16:30',
    title:
      'Les zones ont une CAUSE : on dessine l’accident, le joueur en déduit la règle',
    notes: [
      'Une zone n’impose plus un état par décret : il s’est passé quelque chose ici. GLACE = HUBLOT FENDU — un grand hublot en arrière-plan, monture boulonnée, verre sur le vide étoilé, fêlures rayonnant depuis le point d’impact, givre en dentelle depuis la monture et souffle glacé qui s’échappe de la brèche.',
      'VAPEUR = CONDUITE ROMPUE : un collecteur court au sol de la salle, brides régulières, et sa brèche crache un panache qui monte et se tord sur toute la hauteur. EAU = CHAMBRE PRESSURISÉE : rampes de buses au plafond, gouttes qui perlent et descendent, voile de condensation dense en bas — ici rien ne bout ni ne gèle.',
      'Les étiquettes nomment la cause avant la règle : « HUBLOT FENDU · GLACE ». Dans l’éditeur, le champ propose la cause par défaut et accepte la vôtre — « sas de purge », « soute éventrée »…',
      'Le voile coloré des zones s’efface de moitié : maintenant que le décor porte l’identité, il n’a plus à crier.',
    ],
  },
  {
    date: '10/08/2026 15:40',
    title:
      'La glace PIVOTE, le sas l’avale, et la fin de course remplace le seuil',
    notes: [
      'ROTATION DES BLOCS : un palet ne restait bloqué dans son axe parce que le choc s’appliquait au centre de masse. L’impulsion s’applique désormais au POINT DE CONTACT, avec le moment d’inertie du bloc : un choc excentré transfère une part de l’élan en rotation, et le palet repart en tournant, dévié. C’est la formule d’impulsion d’un corps rigide, pas un effet cosmétique.',
      'LE SAS AVALE LA GLACE : il n’avait aucune prise sur elle, ni pour l’aspirer ni pour la boire. Il l’aspire maintenant (avec moins de prise qu’un liquide : un bloc a de l’inertie) et l’avale. Entrer SOLIDE rapporte une PRIME DE COLLECTE de 25 %, annoncée au bilan.',
      'FIN DE COURSE : plus aucun minimum à ramener. On peut descendre très bas et finir un tableau sur un souffle. Sous le seuil, le HUD prévient que la dernière impulsion approche, puis qu’elle est là ; une fois donnée, le corps se fige en gardant son élan, perd doucement sa vitesse, et l’essai se conclut là où il s’arrête — « FIN DE COURSE », plus « DISPERSION ». Seule la perte totale de cohésion reste une dispersion.',
      'Depuis l’éditeur, le bouton de sortie s’appelle enfin ce qu’il fait : « ↩ Accueil ».',
    ],
  },
  {
    date: '10/08/2026 14:25',
    title: 'Correctif : les boutons du bas ne se chevauchent plus',
    notes: [
      'L’ajout du bouton « ↩ ÉDITEUR » faisait passer la barre sur deux lignes, et le sélecteur d’état, calé à une hauteur devinée, se retrouvait dessous. Le sélecteur se positionne désormais sur la hauteur RÉELLE de la barre, mesurée en direct : quel que soit le nombre de boutons, ils ne se croisent plus.',
      'Deuxième chevauchement, celui-là préexistant : sur écran étroit (tablette en paysage, fenêtre réduite), la barre passait sous le panneau de bord. Hors mobile, elle se centre maintenant dans l’espace RESTANT à droite du panneau, et s’élargit assez pour tenir sur une seule ligne au bureau.',
      'Vérifié à quatre largeurs — 1400, 1024, 820 et 412 px — bouton par bouton.',
    ],
  },
  {
    date: '10/08/2026 13:55',
    title: 'Aller-retour éditeur ⇄ essai',
    notes: [
      'Pendant l’essai d’un tableau édité, un bouton « ↩ ÉDITEUR » apparaît dans la barre du bas : un geste pour revenir corriger, à tout moment. Il ne s’affiche que dans ce contexte.',
      'Les fins d’essai parlent le bon langage : franchir le sas propose « RETOUR À L’ÉDITEUR », et une dispersion propose de rejouer l’essai en rappelant que l’éditeur est à un bouton.',
      'Au retour, l’éditeur retrouve le document EXACTEMENT tel qu’il était — il ne se fait plus écraser par le tableau qu’on vient d’essayer.',
    ],
  },
  {
    date: '10/08/2026 13:20',
    title:
      'Les zones d’état se voient, et les tableaux s’enregistrent en bibliothèque',
    notes: [
      'ZONES VISIBLES : une zone qui impose un état n’existait que dans l’éditeur — elle se subissait sans se voir. Elle est désormais peinte dans le jeu : voile teinté à sa couleur d’état, marge hachurée qui court le long de la frontière, liseré lumineux, halo court à l’extérieur pour la deviner avant de la franchir, et une étiquette encadrée qui annonce la règle du lieu. Le HUD affiche « VAPEUR — IMPOSÉE » et le sélecteur d’état se grise.',
      'BIBLIOTHÈQUE PARTAGÉE : fini l’échange de fichiers. Les tableaux s’ENREGISTRENT sur le serveur (/api/levels) et la liste est visible dans l’éditeur — on ouvre d’un clic, on enregistre, on enregistre sous un autre nom, on supprime.',
      'L’ORDRE DE LA LISTE EST LA SÉQUENCE : les flèches ↑ ↓ décident de ce qui se joue avant et après. Dès qu’un tableau est enregistré, la bibliothèque REMPLACE l’expédition livrée — la fiche d’essai annonce laquelle des deux séquences sera jouée. Vide ou hors ligne, on retombe sur les sept tableaux d’origine.',
      'L’export en fichier et le collage de JSON restent, relégués en secours.',
    ],
  },
  {
    date: '10/08/2026 11:30',
    title:
      'Éditeur de tableaux : créer et modifier un niveau sans toucher au code',
    notes: [
      'Un ÉDITEUR complet, accessible depuis la fiche d’essai ou par l’adresse ?editeur. On trace les surfaces au glisser (paroi, hydrophile, hydrophobe, hublot froid, radiateur, grille, éponge), on place le départ, le sas et les étiquettes, on déplace et redimensionne à la poignée, avec grille aimantée réglable. Suppr efface, D duplique, Échap désélectionne, clic droit déplace la vue, molette zoome.',
      'ZONES D’ÉTAT (nouveau modèle) : on peut délimiter des régions qui IMPOSENT un état — eau, glace ou vapeur — et verrouillent le sélecteur tant qu’on y est, ou des zones libres. Le jeu les applique déjà : en entrant, l’état est converti et les boutons se grisent ; en sortant, le joueur retrouve le choix qu’il avait fait.',
      'CONTRÔLE AUTOMATIQUE du tableau, avec les mêmes garde-fous que les niveaux livrés : départ hors cuve ou né dans une surface, sas trop petit ou débordant, traversée trop courte, journal trop bref, grille sans moyen de la franchir, zone vapeur sans radiateur. Les erreurs bloquent l’essai, les avertissements passent.',
      'ÉCHANGE : export en fichier JSON, copie dans le presse-papier, import par fichier ou par collage. Le format est lisible et se relit sans casser — une pièce mal formée est écartée, le reste se charge. Brouillon conservé en local entre deux visites, et bouton ESSAYER pour jouer le tableau immédiatement avec toutes les mécaniques.',
    ],
  },
  {
    date: '09/08/2026 21:10',
    title:
      'Les murs neutres ne collent plus : l’amorti redevient un effet de contact',
    notes: [
      'Défaut signalé sur la galerie noyée : les parois semblaient ATTIRER et retenir le corps. L’amorti d’éclaboussure (qui fait épouser la paroi au lieu de jaillir) partageait la portée de la chimie — passée de 16 à 80 u pour rendre les auras visibles. Chaque mur neutre traînait donc un champ collant de 80 unités, et le tableau bis en est plein. L’amorti a désormais SA portée (14 u, deux espacements de particule), réglable au banc.',
      'Second défaut au même endroit : l’amorti n’était pas normalisé par le pas de temps, donc il se cumulait à chaque sous-pas — 120 fois par seconde. Il est maintenant exponentiel en dt : identique quel que soit le nombre de sous-pas.',
      'Deux tests de non-régression ajoutés : une goutte qui S’ÉLOIGNE d’un mur garde sa vitesse, et l’amorti au contact ne dépend plus de la finesse du pas.',
    ],
  },
  {
    date: '09/08/2026 20:40',
    title: 'Correctif : les veilleuses ne font plus de pavés',
    notes: [
      'Les lumières se découpaient AU CARRÉ : chaque veilleuse n’est calculée que dans sa propre cellule, et sa décroissance exponentielle valait encore ~10 % au bord — donc elle s’y faisait trancher net. Les halos ont désormais un SUPPORT COMPACT : ils atteignent zéro avant la frontière, et redeviennent ronds. Même correction pour l’éclat du panneau qui bégaie.',
      'Deuxième source de pavés : le bruit de valeur, à très basse fréquence, laisse voir son réseau carré (interpolation bilinéaire sur grille entière). La respiration des parois et le mélange des deux textures de mur passent à un champ de sinus, lisse et sans réseau.',
    ],
  },
  {
    date: '09/08/2026 20:15',
    title: 'Machinerie sur les parois, et une planche au dossier d’essai',
    notes: [
      'DÉCALQUES DE DÉCOR : des tuyaux et des vannes plaqués sur les parois de la galerie noyée, à l’écart des routes — refroidis et fondus dans la cuve pour rester en arrière-plan derrière les surfaces qui, elles, ont un sens de jeu. Nouveau champ « decals » du level design : position, taille, miroir et opacité, aucune physique.',
      'PLANCHE DU DOSSIER : le carton de journal peut désormais porter une illustration. La galerie noyée a la sienne — la galerie inondée, vue de l’intérieur.',
      'Correctif au passage : lancer le prototype depuis la fiche jouait le plan large et le carton EN DOUBLE, en décalé (l’ordre des opérations était inversé).',
    ],
  },
  {
    date: '09/08/2026 19:45',
    title: 'Le vaisseau a l’air alimenté : veilleuses, dérive, respiration',
    notes: [
      'VEILLEUSES DE PAROI : des diodes semées dans le décor, chacune avec sa place, sa période et sa couleur — turquoise (nominal), ambre (en veille), et de rares rouges (une alarme que personne n’est venu couper). Les deux tiers clignotent lentement, le reste reste fixe.',
      'PANNEAU QUI BÉGAIE : de loin en loin, une lumière stroboscope quelques dixièmes de seconde puis se tait pendant dix à vingt secondes. On ne sait jamais quand elle repartira.',
      'DÉRIVE ET RESPIRATION : les poussières dérivent sur deux profondeurs (les lentes au loin, les rapides près de l’œil — le volume de la cuve se sent), et une houle lumineuse très lente parcourt les parois : le vaisseau inspire.',
      'Tout est procédural, calé sur le hash de la cellule : zéro asset supplémentaire et un coût GPU négligeable — les fps récupérés sur tablette ne sont pas repris d’une main.',
    ],
  },
  {
    date: '09/08/2026 19:20',
    title:
      'Cinq textures de plus : froid, chaud, grille, seconde paroi, lointain',
    notes: [
      'PLAQUE FROIDE : vrai givre cristallin, teinté franchement bleu (l’image brute tirait vers le gris béton) — le scintillement procédural reste par-dessus, le gel a l’air vivant. RADIATEUR : panneau à ailettes réchauffé, les rayures animées deviennent la chaleur qui court dessus. GRILLE : panneau perforé dont les trous servent eux-mêmes de masque — le fond se voit à travers.',
      'SECONDE PAROI : les murs neutres alternent entre deux textures selon un bruit très basse fréquence — un long mur ne répète plus le même motif d’un bout à l’autre du tableau.',
      'LOINTAIN ORBITAL : une station à la dérive dans le vide, en parallaxe lente derrière les étoiles, répétée en MIROIR pour que la couture ne se lise pas dans le noir.',
    ],
  },
  {
    date: '09/08/2026 18:45',
    title: 'Le fond de cuve prend chair : panneaux, conduites, liserés',
    notes: [
      'Premier asset de la fournée d’habillage : le fond de la cuve n’est plus un aplat — panneaux boulonnés, conduites, grilles d’aération et liserés lumineux turquoise, échantillonnés avec une légère parallaxe (la paroi est DERRIÈRE l’eau, la profondeur se sent au déplacement de la caméra).',
      'La trame de mesure s’estompe de moitié sur le fond texturé (il porte ses propres lignes), caustiques et poussières continuent de jouer par-dessus. Comme tout l’habillage : chargé en arrière-plan, le procédural assure l’intérim.',
    ],
  },
  {
    date: '09/08/2026 18:15',
    title: 'Anti-lag : la spirale de rattrapage est cassée (iPad à 17 fps)',
    notes: [
      'Le coupable : quand une image dépasse le budget, la boucle physique à pas fixe rattrapait en imposant PLUS de pas à l’image suivante — qui coûtait donc plus cher, prenait plus de retard… et la machine s’installait à 15-20 fps alors qu’elle en vaut 60. Les pas physiques ont maintenant un BUDGET CPU par image (~60 % du temps d’image, 5-12 ms) : sous forte charge, le jeu passe en léger ralenti le temps que la machine respire, puis revient — il ne saccade plus.',
      'Un palier de rendu « secours » s’ajoute pour les écrans très denses qui chauffent (iPad) : résolution abaissée d’un cran de plus, la physique jamais dégradée.',
      'Diagnostic à bord : le dossier Mesures du banc affiche désormais « physique (ms) » et « rendu (ms) » — si ça rame, un coup d’œil dit qui, du CPU ou du GPU, mange le budget.',
    ],
  },
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
    title:
      'La vie se lit, les records se partagent — et la galerie noyée en essai',
    notes: [
      'VIE LISIBLE : la jauge passe à l’ambre à l’approche du seuil et pulse en rouge dessous, avec un bandeau « COHÉSION CRITIQUE — dispersion dans X s » qui égrène le délai de grâce. Le débit de perte s’affiche en direct (−0,42 L/s · coût vapeur / éjection / surfaces), la rosée récupérable aux plaques froides aussi. La coque gagne une barre de refroidissement à côté du chiffre. Et quand le sas sort de l’écran, une FLÈCHE D’OBJECTIF le pointe depuis le bord, distance à l’appui.',
      'RECORDS PARTAGÉS : le tableau d’honneur vit maintenant sur le serveur (/api/records) — les registres de la fiche montrent le meilleur de TOUS les opérateurs, nom à l’appui, même règle de départage qu’en local. Et le protocole n’admet plus d’anonyme : le NOM D’OPÉRATEUR est obligatoire pour plonger — le champ se signale si on l’oublie.',
      'LA GALERIE NOYÉE (21-A bis, PROTOTYPE) : réfection du secteur A en tableau « eau seule » — porte massive, contreforts, cascade de dalles en quinconce, étagère hydrophile pour viser, lèvre hydrophobe sur la goulotte du sas. Accessible depuis la fiche (bouton dédié), hors expédition et hors registres : s’il convainc, il remplacera 21-A. Bonus de profondeur : tous les blocs portent désormais une ombre douce — fini les rectangles flottants.',
    ],
  },
  {
    date: '09/08/2026 16:05',
    title:
      'Tutoriel diégétique : le protocole du Dr Véga guide la première plongée',
    notes: [
      'Au tableau 21-A, des CONSIGNES DU PROTOCOLE apparaissent une à une, au bon moment : éjecter pour se déplacer, surveiller la jauge de volume, changer d’état (F / G), puis deux consignes contextuelles — l’éponge quand on s’en approche, le sas quand il est en vue.',
      'Chaque consigne se valide par le GESTE, pas par un clic « OK » : maintenir l’éjection la valide, presser F ou G la valide, s’approcher de l’éponge ou du sas déclenche la suivante. Aucune fenêtre modale, aucun arrêt du jeu.',
      'Le tutoriel ne se montre qu’une fois : dès que les états sont maîtrisés, il se marque comme vu (localStorage) et ne reviendra plus — les habitués ne le verront jamais réapparaître.',
    ],
  },
  {
    date: '09/08/2026 15:10',
    title:
      'L’expédition passe à 7 tableaux — et la vapeur perdue se recondense',
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
    notes: [
      'Chaque mise à jour est en ligne sur sujet21.vercel.app une à deux minutes après livraison.',
    ],
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
    notes: [
      'Matériaux (hydrophile, hydrophobe), éponge à saturation, sas de sortie et bonbonnes.',
    ],
  },
]

// La version du jeu, dérivée du journal : 0.21.N — « 21 » pour le sujet,
// N avance TOUT SEUL à chaque livraison consignée ici (pas de numéro à
// penser à bumper). Une seule source de vérité : la fiche, l'écran
// NOTES DE VERSION et l'export Markdown l'affichent tous depuis ici.
export const VERSION = `0.21.${DELIVERIES.length}`

/** La version qu'avait le jeu à une entrée du journal (0 = la plus
 * récente) : chaque livraison a incrémenté le petit numéro de un. */
export const versionDe = (index: number): string =>
  `0.21.${DELIVERIES.length - index}`
