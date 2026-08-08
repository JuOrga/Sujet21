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
