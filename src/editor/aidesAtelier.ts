// LES AIDES DE L'ATELIER : ce qu'il faut savoir d'un élément, dit au joueur
// quand il s'attarde dessus dans la barre (le concepteur, 24/11 : « pour
// chaque élément, au survol après 1 à 2 s, les choses importantes à
// savoir, comment ça fonctionne »).
//
// Le nom et la phrase de la barre disent CE QUE C'EST ; l'aide dit COMMENT
// LE POSER et CE QU'IL FAIT À CHAQUE ÉTAT. Les faits viennent du codex
// (game/codex.ts) et des réglages offerts (profilJoueur.ts) : une aide ne
// promet rien que le jeu ne fasse — le banc vérifie qu'elle cite bien les
// réglages de l'élément.
//
// Sans DOM : l'éditeur peint la bulle (editor.ts, peintAide).

export interface AideAtelier {
  /** Le geste : comment on le pose, en une phrase. */
  geste: string
  /** Ce qu'il faut savoir : trois points au plus, courts. */
  aSavoir: string[]
}

/** Au-delà, la bulle déborde la salle : la règle du banc. */
export const AIDE_POINTS_MAX = 3
export const AIDE_POINT_SIGNES_MAX = 150

export const AIDES_ATELIER: Readonly<Record<string, AideAtelier>> = {
  // ---- outils transverses ----
  select: {
    geste: 'Cliquez un élément pour le choisir, glissez-le pour le déplacer.',
    aSavoir: [
      'Ses réglages s’affichent dans le panneau de droite.',
      'Maj + clic en ajoute d’autres : le panneau propose alors d’aligner, d’égaliser et de répartir.',
      'Suppr efface, D duplique, Ctrl+Z annule.',
    ],
  },
  gomme: {
    geste: 'Glissez pour tracer une zone : tout ce qu’elle couvre disparaît.',
    aSavoir: [
      'Une paroi à cheval sur la zone est rognée, le reste survit.',
      'Une forme ou une paroi inclinée s’efface entière si son centre est dans la zone.',
      'La gomme reste en main : on gomme en série. Ctrl+Z annule.',
    ],
  },
  cut: {
    geste: 'Cliquez la paroi du dessus, puis celle du dessous.',
    aSavoir: [
      'Seule leur partie commune est rongée dans celle du dessous.',
      'Ne sert qu’à deux parois qui se chevauchent ; pour effacer librement, prenez la Gomme.',
      'Échap annule le premier clic.',
    ],
  },

  // ---- départ & sortie ----
  spawn: {
    geste: 'Cliquez : le départ s’y place. Il n’y en a qu’un.',
    aSavoir: [
      'Réglages : la taille du corps (petit, moyen, grand) et son élan au départ.',
      'Avec de l’élan, une flèche donne la direction ; une ligne pointillée montre où il mène.',
    ],
  },
  exit: {
    geste: 'Tracez un rectangle : le sas s’y place. Il n’y en a qu’un.',
    aSavoir: [
      'Atteindre le sas termine la salle.',
      'Le sas aspire ce qui l’approche : chaque centilitre livré compte au score.',
      'Pour publier, vous devez d’abord l’atteindre vous-même.',
    ],
  },

  // ---- parois ----
  'box:0': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Rien ne la traverse, quel que soit l’état.',
      'Réglage : la forme (rectangle, disque, capsule).',
      'L’aimant de grille et l’alignement aident à la coller aux voisines.',
    ],
  },
  'box:2': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Eau : repoussée de loin, elle rebondit presque sans perte d’élan.',
      'Glace : relancée comme par un flipper.',
      'Vapeur : déviée doucement, sans contact.',
    ],
  },
  'box:1': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Eau : aspirée à portée et freinée au contact — utile pour se poser.',
      'Glace : freinée, la paroi mouillée retient même le solide.',
      'Vapeur : une légère attirance, de loin.',
    ],
  },
  'box:7': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Seule l’eau la traverse, en suintant.',
      'La glace et la vapeur butent : pour passer, il faut redevenir eau.',
    ],
  },
  'box:5': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Seule la vapeur la traverse.',
      'L’eau et la glace butent comme sur un mur.',
    ],
  },
  'box:8': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Seule la glace, d’un bloc, écarte les lamelles et passe.',
      'L’eau et la vapeur butent : la vapeur doit contourner.',
    ],
  },
  'box:4': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Eau : gèle si elle s’attarde dans son aura.',
      'Glace : se soude à la plaque, immobile, jusqu’à ce qu’on la dégèle.',
      'Vapeur : se refroidit près d’elle et retombe en eau.',
    ],
  },
  'box:6': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Eau : baigner presque entière dans son aura la vaporise.',
      'Glace : son aura la fait fondre.',
      'Cette transformation est subie : elle ne rend pas les dashs.',
    ],
  },
  'box:9': {
    geste: 'Glissez pour tracer un rectangle.',
    aSavoir: [
      'Frôlé en vapeur, il recharge UNE impulsion de dash, puis s’éteint.',
      'Pour l’eau et la glace, ce n’est qu’un mur.',
    ],
  },
  'forme:1': {
    geste: 'Choisissez d’abord une paroi, puis tracez la boîte : le disque s’y inscrit.',
    aSavoir: [
      'Il prend la matière de la dernière paroi choisie (chaudière, hydrophobe…).',
      'Une boîte carrée donne un cercle.',
    ],
  },
  'forme:2': {
    geste: 'Choisissez d’abord une paroi, puis tracez la boîte.',
    aSavoir: [
      'Une pilule aux bouts ronds, couchée dans le sens le plus long.',
      'Elle prend la matière de la dernière paroi choisie.',
    ],
  },
  'forme:3': {
    geste: 'Choisissez d’abord une paroi, puis tracez la boîte : la rampe en est la moitié.',
    aSavoir: [
      'Le rectangle coupé en diagonale : une pente, un chanfrein.',
      'Elle prend la matière de la dernière paroi choisie.',
    ],
  },
  'forme:4': {
    geste: 'Choisissez d’abord une paroi, puis tracez la boîte.',
    aSavoir: [
      'Une conduite courbe aux bouts ronds, qui se tourne.',
      'Elle prend la matière de la dernière paroi choisie.',
    ],
  },

  // ---- zones d'effet ----
  'zone:eau': {
    geste: 'Glissez pour tracer la zone.',
    aSavoir: [
      'Le corps qui y entre redevient eau, et ne peut plus changer d’état tant qu’il y est.',
      'En sortant, il retrouve le choix.',
    ],
  },
  'zone:glace': {
    geste: 'Glissez pour tracer la zone.',
    aSavoir: [
      'Le corps qui y entre gèle, qu’on le veuille ou non.',
      'L’état n’est plus un choix — le trajet, si.',
    ],
  },
  'zone:vapeur': {
    geste: 'Glissez pour tracer la zone.',
    aSavoir: [
      'Le corps y monte en nuage d’office ; la sortie de zone le rend.',
      'Le passage idéal pour franchir un évent.',
    ],
  },
  puits: {
    geste: 'Cliquez pour le poser, glissez pour régler son cœur.',
    aSavoir: [
      'Il attire le corps : on peut y orbiter, DANS le cœur.',
      'À la lisière du cœur, le corps se déchire.',
      'Réglages : l’attraction, la taille du cœur, la portée.',
    ],
  },
  chasse: {
    geste: 'Glissez pour tracer le rectangle du courant.',
    aSavoir: [
      'Tout ce qui est dedans est poussé dans sa direction, sans être coupé.',
      'Réglages : la poussée, et quand elle fonctionne (toujours, ou commandée).',
      'Commandée : reliez-la à une pastille ou une coupelle.',
    ],
  },
  sponge: {
    geste: 'Glissez pour tracer l’éponge.',
    aSavoir: [
      'Elle boit le liquide qui s’attarde, cellule par cellule.',
      'Une cellule gorgée devient solide : le volume perdu l’est définitivement.',
    ],
  },
  'box:11': {
    geste: 'Glissez pour tracer l’ouverture.',
    aSavoir: [
      'Le corps passe dessus, mais s’il s’y attarde, le vide le prend.',
      'Un courant l’emporte alors et l’avale : la partie est perdue.',
    ],
  },

  // ---- mécanismes ----
  laser: {
    geste: 'Cliquez pour poser l’émetteur, glissez pour orienter le faisceau.',
    aSavoir: [
      'Le corps gelé renvoie le faisceau comme un miroir.',
      'Touchée par le faisceau, une pastille s’allume et commande.',
    ],
  },
  cible: {
    geste: 'Cliquez pour la poser.',
    aSavoir: [
      'Touchée par le laser, elle allume les portes et chasses qui lui sont reliées.',
      'Réglage : reste allumée, tant que le faisceau tient, ou change à chaque fois.',
    ],
  },
  coupelle: {
    geste: 'Cliquez pour la poser, glissez pour régler sa bouche.',
    aSavoir: [
      'Elle aspire le liquide et le boit jusqu’à son trait ; pleine, elle commande pour de bon.',
      'Rien ne se reprend ; la glace et la vapeur passent sans payer.',
      'Réglages : ce qu’elle boit, l’aspiration.',
    ],
  },
  porte: {
    geste: 'Glissez pour tracer la porte, puis reliez-la à ses commandes.',
    aSavoir: [
      'Choisissez-la, « Relier une commande », puis cliquez une pastille ou une coupelle.',
      'Réglages : fermée ou ouverte au repos, quand elle bascule, son mouvement.',
    ],
  },
  mire: {
    geste: 'Cliquez pour la poser, glissez pour régler sa taille.',
    aSavoir: [
      'Une cible à points pour les éclats de glace.',
      'Une touche vaut ses points selon la taille de l’éclat ; la mire reste.',
    ],
  },
  rail: {
    geste: 'Glissez pour tracer un tronçon ; repartez de son bout pour le prolonger.',
    aSavoir: [
      'Il guide l’arc du plasma.',
      'Double-clic sur la ligne : un point de plus ; sur un point : il s’en va.',
    ],
  },

  // ---- lumière ----
  lumiere: {
    geste: 'Cliquez pour poser la lampe.',
    aSavoir: [
      'Elle éclaire la salle et couche les ombres ; 4 lampes au plus, bandeaux compris.',
      'Haute, ombres courtes et douces ; basse, ombres longues.',
      'Sans lampe, la salle garde son éclairage par défaut.',
    ],
  },
  bande: {
    geste: 'Cliquez pour poser le bandeau.',
    aSavoir: [
      'Il éclaire sur toute sa longueur ; on ne voit pas sa source.',
      'Il compte dans les 4 lampes de la salle.',
    ],
  },

  // ---- décor ----
  label: {
    geste: 'Cliquez pour poser le texte, puis écrivez-le dans le panneau.',
    aSavoir: [
      '40 signes au plus, en majuscules.',
      'Sans effet sur le corps.',
    ],
  },
  'box:12': {
    geste: 'Glissez pour tracer la baie.',
    aSavoir: [
      'Un fond : elle se peint sous tout le reste, une paroi posée dessus la couvre.',
      'Sans effet : le corps passe dessus comme sur le sol.',
    ],
  },
  'decal:tuyaux': {
    geste: 'Glissez pour tracer le décor.',
    aSavoir: ['Sans effet sur le corps : le fluide passe devant.'],
  },
  'decal:serre-ble-nain': {
    geste: 'Glissez pour tracer le décor.',
    aSavoir: ['Sans effet sur le corps : le fluide passe devant.'],
  },
}

/** L'aide d'un outil, ou `null`. */
export function aideDe(outil: string): AideAtelier | null {
  return AIDES_ATELIER[outil] ?? null
}
