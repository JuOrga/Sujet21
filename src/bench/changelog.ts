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
    date: '12/08/2026 11:30',
    title: 'Radiateur : le passage à l’état gazeux se fait à 50 %',
    notes: [
      'Réglage : la bascule automatique à l’état gazeux se déclenche dès 50 % du corps vaporisé (au lieu de 70), et se réarme sous 30 %. Le document des règles (docs/) est à jour.',
    ],
  },
  {
    date: '12/08/2026 11:05',
    title: 'Le radiateur fait vraiment passer à l’état gazeux — et ne repousse plus',
    notes: [
      'Vaporisé malgré soi par un radiateur, on PASSE désormais vraiment à l’état gazeux : dès 70 % du corps en vapeur, l’intention suit — dash, sélecteur, sons, comme si on avait pressé G. Le déclencheur se réarme seulement une fois le corps redescendu sous 50 % : revenir à l’eau dans l’aura ne lutte pas contre la machine.',
      'Et le radiateur ne REPOUSSE plus : le frémissement de l’eau qui chauffe était un bruit dont l’amplitude suivait la chaleur — un tel bruit dérive vers le froid, d’où la poussée fantôme. Le signe du bouillonnement alterne maintenant d’une particule à l’autre : la dérive collective s’annule, le frémissement reste.',
    ],
  },
  {
    date: '12/08/2026 10:20',
    title: 'Les records refondus : deux par salle, et un bilan clair à chaque sas',
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
    title: 'Les impulsions vapeur se comptent — x par écran, réglable par tableau',
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
    title: 'La gare du rail devient une poche, la vapeur sent les parois de loin',
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
    title: 'Le CONTINUER apparaît vraiment, et la collecte n’agonise plus jamais',
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
    title: 'Le son s’éveille tout seul, le dash se tait, et les alarmes respectent l’aspiration',
    notes: [
      'Plus de bouton « Activer le son » : l’audio s’éveille au PREMIER geste, quel qu’il soit — toucher, clic ou touche. Sur la fiche ne reste qu’un bouton MUTE (🔊 SON / 🔇 MUET), comme en jeu, atteignable à la manette.',
      'Le souffle d’aspiration qui accompagnait chaque impulsion de vapeur est retiré : le dash se voit à l’écran et se sent dans la manette (vibration), il n’a pas besoin de souffler.',
      'Les alertes « réserve basse » et « dernière impulsion » se taisent VRAIMENT pendant que le sas boit : la garde couvrait le gong final mais pas l’alerte de réserve — les deux passent sous la même garde (enCollecte). Vérifié par une aspiration réelle : zéro alerte pendant la collecte, et le bouton CONTINUER apparaît bien dès la moitié du volume avalée.',
    ],
  },
  {
    date: '11/08/2026 17:55',
    title: 'La bande de vie partout, la fiche mobile allégée, et le premier toucher réparé',
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
    title: 'Réparé : les boutons de la fiche avaient disparu en paysage téléphone',
    notes: [
      'Les règles compactes du paysage étaient placées AVANT les styles de base dans la feuille : elles perdaient la cascade, et le cadre coupait les boutons au lieu de les resserrer. Les blocs sont déplacés en fin de feuille — la compaction s’applique vraiment.',
      'Et la fiche du téléphone tourné assume d’être un MENU : le texte de présentation s’efface, tout tient à l’écran — son, Commencer, Salles laser, Éditeur, Commandes, Plein écran, et les registres à droite. Chaque colonne sait défiler dans son cadre si un écran plus petit l’exige.',
    ],
  },
  {
    date: '11/08/2026 16:20',
    title: 'L’interface de jeu compacte en paysage mobile, et la barre de bord expliquée',
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
    title: 'Mobile : le paysage demandé, la prise en main tactile en trois gestes',
    notes: [
      'Sur téléphone en PORTRAIT, un voile demande de tourner l’appareil — un téléphone stylisé pivote, « le protocole s’observe en paysage ». Le verrou de rotation a sa sortie de secours (« continuer en portrait »).',
      'En PAYSAGE, la fiche s’adapte : pleine largeur, deux colonnes, figure retirée, tout tient sans ascenseur visible.',
      'PRISE EN MAIN TACTILE au premier lancement : trois cartes animées — le doigt posé (l’éjection et son onde), les trois états (💧 ❄ 💨), la pince à deux doigts (zoom, caméra, ⌖). Un toucher passe à la suivante ; montrée une seule fois, l’essai reste figé pendant la lecture.',
    ],
  },
  {
    date: '11/08/2026 14:30',
    title: 'Gâchettes = zoom, fin de course muette quand le sas boit, nuage qui fait corps',
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
    title: 'La fiche d’accueil en grand, et le bouton d’essai mène aux salles laser',
    notes: [
      'L’ACCUEIL occupe désormais une bonne partie de l’écran : la fiche passe en deux colonnes (~1060 px) — le protocole à gauche (titre en grand, consigne, relevé, boutons), le dossier à droite (figure, registres, commandes). Sur écran étroit, tout s’empile comme avant.',
      'Le bouton d’essai de la fiche mène aux SALLES LASER : la trilogie 21-H → 21-J (miroir, prisme, plasma) se joue d’un clic, enchaînée sas après sas, hors expédition et hors registres — même si votre partie suit la séquence de la bibliothèque partagée. Le prototype 21-A bis reste accessible depuis le banc (dossier Tableaux).',
    ],
  },
  {
    date: '11/08/2026 12:50',
    title: 'La trilogie laser entre dans l’expédition : trois nouveaux tableaux',
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
    title: 'Deux corrections : les mécanismes tiennent leur plan, la glace ne goutte plus',
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
    title: 'L’éditeur montre les zones d’effet : auras, aspiration, illustrations, décals',
    notes: [
      'Chaque surface montre désormais la portée RÉELLE de son influence, en rectangle arrondi iso-distance : l’aura de gel de la plaque froide (avec, en pointillé long, sa portée à froid complet — elle grandit en cours de partie), l’aura du radiateur (avec, en pointillé court, sa portée réduite à froid), et les bandes d’influence hydrophile et hydrophobe.',
      'Le sas montre son rayon d’aspiration — le courant qui hale l’eau et la glace commence bien avant son rectangle.',
      'Les zones dessinent leur illustration (hublot, conduite, rampe) ajustée exactement comme dans le jeu, sous leur lisière ondulée ; les décals (tuyaux, vannes) sont peints à leur place. L’éditeur montre ce que le joueur verra.',
      'Au passage, un vrai bug : le chargement JSON ne relisait pas les décals — un tableau passé par l’éditeur perdait sa machinerie peinte. Corrigé, avec l’aller-retour testé.',
    ],
  },
  {
    date: '10/08/2026 23:10',
    title: 'Zones : l’illustration entière, la glace en givre blanc, les effets allégés',
    notes: [
      'La rampe de buses sortait coupée net : l’illustration n’était dessinée que dans le champ de la brume, et la lisière arrondie tronquait l’objet. Une rampe n’est pas un gaz — l’image se dessine maintenant entière dans son cadre, seule la brume suit la lisière.',
      'La zone GLACE ne se voyait plus : du cyan sur une cuve cyan. Sa brume givre maintenant en BLANC, nettement renforcée — les deux autres gardent leur teinte, le violet et le bleu contrastent déjà.',
      'Le panache, les gouttes et la brume s’allègent fortement sur l’illustration elle-même : les effets vivent AUTOUR de l’objet, ils ne le recouvrent plus — la conduite rompue redevient lisible sous sa vapeur.',
    ],
  },
  {
    date: '10/08/2026 22:50',
    title: 'Les zones perdent leur contour : une brume d’accident, pas une bulle',
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
    title: 'Les zones ont leurs vraies images, et l’eau passe enfin devant le décor',
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
    title: 'Le ralenti s’accentue, et une vraie texture habite le temps suspendu',
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
    title: 'Le seuil de dernière impulsion passe en litres, et le souffle d’éjection s’efface',
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
    title: 'Les zones ont une CAUSE : on dessine l’accident, le joueur en déduit la règle',
    notes: [
      'Une zone n’impose plus un état par décret : il s’est passé quelque chose ici. GLACE = HUBLOT FENDU — un grand hublot en arrière-plan, monture boulonnée, verre sur le vide étoilé, fêlures rayonnant depuis le point d’impact, givre en dentelle depuis la monture et souffle glacé qui s’échappe de la brèche.',
      'VAPEUR = CONDUITE ROMPUE : un collecteur court au sol de la salle, brides régulières, et sa brèche crache un panache qui monte et se tord sur toute la hauteur. EAU = CHAMBRE PRESSURISÉE : rampes de buses au plafond, gouttes qui perlent et descendent, voile de condensation dense en bas — ici rien ne bout ni ne gèle.',
      'Les étiquettes nomment la cause avant la règle : « HUBLOT FENDU · GLACE ». Dans l’éditeur, le champ propose la cause par défaut et accepte la vôtre — « sas de purge », « soute éventrée »…',
      'Le voile coloré des zones s’efface de moitié : maintenant que le décor porte l’identité, il n’a plus à crier.',
    ],
  },
  {
    date: '10/08/2026 15:40',
    title: 'La glace PIVOTE, le sas l’avale, et la fin de course remplace le seuil',
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
    title: 'Les zones d’état se voient, et les tableaux s’enregistrent en bibliothèque',
    notes: [
      'ZONES VISIBLES : une zone qui impose un état n’existait que dans l’éditeur — elle se subissait sans se voir. Elle est désormais peinte dans le jeu : voile teinté à sa couleur d’état, marge hachurée qui court le long de la frontière, liseré lumineux, halo court à l’extérieur pour la deviner avant de la franchir, et une étiquette encadrée qui annonce la règle du lieu. Le HUD affiche « VAPEUR — IMPOSÉE » et le sélecteur d’état se grise.',
      'BIBLIOTHÈQUE PARTAGÉE : fini l’échange de fichiers. Les tableaux s’ENREGISTRENT sur le serveur (/api/levels) et la liste est visible dans l’éditeur — on ouvre d’un clic, on enregistre, on enregistre sous un autre nom, on supprime.',
      'L’ORDRE DE LA LISTE EST LA SÉQUENCE : les flèches ↑ ↓ décident de ce qui se joue avant et après. Dès qu’un tableau est enregistré, la bibliothèque REMPLACE l’expédition livrée — la fiche d’essai annonce laquelle des deux séquences sera jouée. Vide ou hors ligne, on retombe sur les sept tableaux d’origine.',
      'L’export en fichier et le collage de JSON restent, relégués en secours.',
    ],
  },
  {
    date: '10/08/2026 11:30',
    title: 'Éditeur de tableaux : créer et modifier un niveau sans toucher au code',
    notes: [
      'Un ÉDITEUR complet, accessible depuis la fiche d’essai ou par l’adresse ?editeur. On trace les surfaces au glisser (paroi, hydrophile, hydrophobe, hublot froid, radiateur, grille, éponge), on place le départ, le sas et les étiquettes, on déplace et redimensionne à la poignée, avec grille aimantée réglable. Suppr efface, D duplique, Échap désélectionne, clic droit déplace la vue, molette zoome.',
      'ZONES D’ÉTAT (nouveau modèle) : on peut délimiter des régions qui IMPOSENT un état — eau, glace ou vapeur — et verrouillent le sélecteur tant qu’on y est, ou des zones libres. Le jeu les applique déjà : en entrant, l’état est converti et les boutons se grisent ; en sortant, le joueur retrouve le choix qu’il avait fait.',
      'CONTRÔLE AUTOMATIQUE du tableau, avec les mêmes garde-fous que les niveaux livrés : départ hors cuve ou né dans une surface, sas trop petit ou débordant, traversée trop courte, journal trop bref, grille sans moyen de la franchir, zone vapeur sans radiateur. Les erreurs bloquent l’essai, les avertissements passent.',
      'ÉCHANGE : export en fichier JSON, copie dans le presse-papier, import par fichier ou par collage. Le format est lisible et se relit sans casser — une pièce mal formée est écartée, le reste se charge. Brouillon conservé en local entre deux visites, et bouton ESSAYER pour jouer le tableau immédiatement avec toutes les mécaniques.',
    ],
  },
  {
    date: '09/08/2026 21:10',
    title: 'Les murs neutres ne collent plus : l’amorti redevient un effet de contact',
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
    title: 'Cinq textures de plus : froid, chaud, grille, seconde paroi, lointain',
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
