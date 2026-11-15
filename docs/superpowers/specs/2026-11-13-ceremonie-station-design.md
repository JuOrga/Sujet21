# La cérémonie « station » — conception

13/11/2026. Branche `claude/ceremonie-station`, empilée sur l'aperçu des
quatre chantiers du jour (#514–#517 : la PR ne se fusionne qu'après eux).

## L'intention

Le concepteur trouve les écrans de récompense (la cérémonie `#mb-veil` :
bilan de salle, versement, palier, tirage, fin de module, haltes) et les fins
de partie « pas mal, mais trop bureautique » : malgré les éclats et les petits
effets, « tout est rectangulaire, carré… ça ne fait pas encore assez jeu
vidéo ». Le contexte à ne jamais perdre : **on est dans une station
spatiale** — un laboratoire en orbite où l'on étudie le Sujet 21, un fluide
qu'on livre en bonbonne.

L'inventaire factuel (captures reconstituées, numéros de ligne) est
`docs/superpowers/specs/2026-11-13-ceremonie-inventaire.md` (son banc de captures : `tools/banc-ceremonie/`) ;
ses constats tiennent ici en sept défauts, que le concepteur demande de
**tous** corriger :

1. tout est un rectangle arrondi (r 8–14), des pilules, des ronds — aucun
   coin coupé, biseau, cadre asymétrique ;
2. le bilan se lit comme un tableau de bord (icône + barre de 6 px + chiffre
   + légende grise, en petites capitales espacées) ;
3. on explique au lieu de faire ressentir : chaque tuile de gain répète un
   paragraphe sur l'usage de la monnaie, à chaque salle ;
4. tout s'empile : la jauge et son tampon restent au-dessus des cartes du
   tirage ; le bilan reste au-dessus du versement (qui déborde à 720 px) ;
5. les icônes sont des émojis ;
6. deux sons seulement pour toute la cérémonie ;
7. la fin de descente et la défaite sont les écrans les plus pauvres.

## Les décisions du concepteur

- Corriger les sept points, dans la direction montrée le 13/11 (maquette
  `docs/superpowers/specs/ceremonie/direction-maquette.html`) :
  vocabulaire « station », un seul moment à l'écran, chorégraphie du bilan,
  versement en geste, objets et icônes rendus, sons par geste, fins de
  partie mises en scène.
- **Tout asset nouveau est fait dans Blender, et « stylé ».** Aucune image
  générée, aucune réutilisation des images générées existantes
  (`meta-icones`, `badge`, `fiole-*`, `iris`, `cine/*`… — l'inventaire les
  proposait, c'est écarté). Les assets dessinés dans l'atelier Blender du
  dépôt (`tools/images/blender/`) sont réutilisables.
- Travail orchestré en parallèle par plusieurs agents.
- **Les icônes Blender remplacent les émojis PARTOUT dans le jeu**, pas
  seulement dans la cérémonie (réponse du concepteur, 13/11 : « oui tout ») —
  instruments (`d.icone`, lu dans une quinzaine de fichiers : HUD, toasts,
  journal, codex, marchand, avaries, atelier `.crt`, éditeur, régie, phrases
  en texte brut, `fillText` au canvas de `module2dCanvas.ts` et `main.ts`),
  et condensat / mémoire (aujourd'hui `meta-icones`, image générée, dans le
  HUD et chez le marchand) : une monnaie, un seul dessin. Les contreparties
  (`CONTREPARTIES`) ont aussi la leur.

## Les objectifs

- **Que chaque étape ait UN héros.** Un objet ou un chiffre qu'on regarde ;
  le reste se tait ou s'en va.
- **Le langage de la station** : coins coupés, biseaux, poutres rivetées,
  bandes de danger, cartouches biseautées, sceaux octogonaux, manomètres,
  cuves — les formes des modules (octogones du plan de station) et de
  l'atelier Blender (montants en I, hublots, réglettes).
- **Des chiffres et des objets, pas des phrases.** L'explication d'une
  monnaie ou d'un instrument passe dans l'infobulle (`title`) et le codex.
- **Le rythme avant la durée.** La cérémonie suit CHAQUE salle : elle ne doit
  pas s'allonger. Chorégraphie du bilan ≤ la durée actuelle (4,9 s), et tout
  se passe d'un geste — A / Entrée / Espace / clic — à chaque étape
  (aujourd'hui le bilan ne se passe qu'au pointeur, M:17355).

## Non-objectifs

- Toucher aux règles : gains, prix, paliers, tirages, choix de voie — la
  logique (`ceremonie.ts`, `recompenses.ts`, `instruments.ts`,
  `descenteCarte.ts`…) reste ce qu'elle est. On change la mise en scène.
- Refaire l'écran « choisissez la salle suivante » (épuré le 13/11, #517)
  au-delà de l'habiller du nouveau vocabulaire.
- Refaire la carte de la station (plan SVG) — même règle : l'habiller.

## Les anti-objectifs (ce qui ferait échouer même si ça marche)

- Une cérémonie plus longue ou plus lente à passer.
- Un écran qui déborde à 1280×720 ou 1280×800, ou illisible sur Deck.
- Des images qui jurent avec le fond de cuve et les surfaces faits le 13/11
  (autre lumière, autre acier, autre grain).
- De la couleur chaude hors de ce qui luit (charte : palette froide, l'ambre
  et l'or réservés aux veilleuses, aux primes et aux paliers).
- Casser la navigation à la manette (`pad-vise`), au clavier, au doigt
  (`porteArmee.ts`), ou « moins d'animations » (`prefers-reduced-motion` et
  le réglage du jeu : chaque animation a son repli, `ceremonie.spec.ts:162`).

## Les contraintes

- Règles du dépôt (CLAUDE.md) : tout en français, commentaires qui disent
  POURQUOI, commits « symptôme / cause / correctif / vérification », aucun
  chiffre non mesuré, aucun nom de modèle ni ligne d'attribution ; avant de
  pousser : `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest
  run`, `./node_modules/.bin/vite build` (jamais `npm exec pnpm`).
- **Un seul Blender** (MCP, `mcp__blender__*`) : un seul agent l'utilise.
  Méthode : `docs/assets-ia.md` (§35 le module 2D, §17 les livraisons, §18
  et §24 les surfaces et l'atlas du 13/11) et les scripts de
  `tools/images/blender/` (`surfaces.py`, `habillages.py` : rendus par
  `bpy.app.timers` via `lance()`, `exec` du script dans le même appel MCP,
  Cycles OptiX, chemins `\\wsl.localhost\Ubuntu\…`). Python avec pillow :
  `/home/julian/projets/tiktok/.venv/bin/python -I`. Livraison par
  `tools/images/prepare.py` (familles, mesures, poids).
- Le jeu ne démarre pas sans tête (WebGL2) : la vérification visuelle se fait
  par le banc de la cérémonie (`tools/banc-ceremonie/banc-ceremonie.cjs`, qui
  pose le DOM de chaque étape sur la vraie feuille de style construite) puis
  par le concepteur sur l'aperçu `previsu-go`.
- Le code de la cérémonie est dans `src/main.ts` (≈ M:14400–17400) et sa
  feuille inline dans `index.html` (≈ H:7830–9400) — deux gros fichiers que
  plusieurs agents toucheraient : le découpage du travail évite qu'ils s'y
  croisent (voir « Le découpage »).

## Le comment, tel que décidé

### Le vocabulaire (fondation, sert à tout)

Des primitives CSS dans la feuille de `#mb-veil`, en variables : taille du
chanfrein, cadres `clip-path` à coins coupés (le chanfrein symétrique des
modules, et une variante asymétrique « cartouche » : deux coins coupés en
diagonale), **poutre** de titre (profil effilé, rivets, deux bandes de
danger), **cartouche** de gain (chanfrein + liseré de couleur à gauche +
alvéole hexagonale pour l'icône), **sceau** octogonal, **manomètre** (arc SVG
gradué), bouton **levier** (biseauté, plus de pilule). Les gris-bleus codés
en dur deviennent des variables. Les polices restent (Michroma, IBM Plex
Mono) ; les étiquettes à 7–9 px montent ou disparaissent.

### Les étapes

1. **Bilan « SALLE FRANCHIE »** — héros : la bonbonne. Poutre de titre ; au
   centre la bonbonne rendue (verre + liquide qui monte entre deux calques),
   cerclée d'un manomètre « % livré » ; à gauche le sceau du rang qui tombe ;
   à droite le volume en très grand. Puis les cartouches de gains claquent une
   à une (icône rendue, gros chiffre, nom). Chrono et note : une ligne courte
   sous le volume, ou le tampon RECORD s'il y a record — plus de barres de
   6 px. Plus aucun paragraphe.
2. **Versement** — le bilan s'en va (il ne reste au plus qu'un bandeau d'une
   ligne). Deux cuves rendues : RÉSERVE (bocal) et MAÎTRISE (colonne cerclée
   d'anneaux de palier) ; l'orbe du surplus au centre, qu'on envoie d'un
   côté ; elle s'y déverse. Tient à 720 px.
3. **Palier** — héros : la colonne de maîtrise. Le liquide monte ; un anneau
   franchi s'allume et se brise (rendu), la bande PALIER n traverse l'écran.
4. **Tirage** — la colonne s'en va. Trois cartouches d'instrument, coins
   coupés, icône rendue (plus d'émoji), nom, une ligne ; le détail en
   infobulle. Le retournement montre un vrai dos (à vérifier : l'inventaire a
   vu la face en miroir, `.mb-pli::before`).
5. **Fin de module** — héros : le sceau du module ; les salles en rangée de
   petits sceaux de rang ; les gains en cartouches ; bouton levier.
6. **Haltes, rencontres, cache, mini-jeu** — l'objet rendu en héros (alcôve,
   bonbonne oubliée, signal, coffre…), les offres en cartouches ; un choix
   déclenche un éclat et un flash comme les autres choix. Le titre du repos
   dit REPOS (aujourd'hui il dit le type du module, « ÉNIGME »).
7. **Fin de descente bouclée** et **défaite** — de vraies scènes : une image
   rendue de la station (la bonbonne scellée qui part en capsule ; ou
   l'échantillon perdu, une fiole brisée dans le noir), le relevé de la
   descente en sceaux et chiffres (salles, litres, meilleur rang), puis le
   bouton. Elles quittent `#overlay` brut pour le vocabulaire du voile.

### Les assets Blender (transparents, mêmes lumière et acier que l'atelier)

- **Planche d'icônes de cérémonie** : condensat, mémoire, tirage, orbe,
  réserve, maîtrise, chrono, note, secours (vie), profondeur, repos, don,
  rencontre, cache, mini-jeu, économat.
- **Planche d'icônes d'instruments** : une par instrument du catalogue
  (`src/game/instruments.ts`, ~32 entrées) — elles remplacent les émojis
  partout où l'instrument s'affiche.
- **Les sceaux de rang** : cinq médaillons octogonaux (S A B C D, teinte du
  rang), plus le sceau de module.
- **Les objets héros** : la bonbonne (calque arrière et verre avant, pour que
  le liquide CSS passe entre eux), la cuve de réserve et la colonne de
  maîtrise (même principe), l'anneau de palier (et sa version brisée).
- **Les deux scènes de fin** : 16:9, la capsule qui part ; la fiole brisée.

### Les sons (synthèse Web Audio, comme le reste de `audio.ts`)

Une voix par geste : compteur qui roule (tic qui s'accélère), sceau/tampon
(choc sourd métallique), cartouche qui claque, déversement (écoulement
filtré), palier franchi (montée + anneau qui casse), tirage élu, porte /
levier. Volumes réglés sur les stings existants, coupés avec le son du jeu.
Choix de l'orchestrateur : synthèse plutôt que fichiers — Blender ne fait
pas de son, et `audio.ts` est déjà presque tout synthétisé.

## Le découpage (orchestration)

Une branche d'intégration `claude/ceremonie-station`. Chaque agent travaille
dans son arbre, sur une branche issue d'elle ; l'orchestrateur fusionne,
vérifie, et tient la cohérence.

- **Vague 1, en parallèle**
  - *Blender* (seul à tenir Blender) : l'atelier des pictogrammes et des
    objets, puis les planches dans l'ordre où le code les attend :
    icônes de cérémonie → sceaux → bonbonne et cuves → icônes d'instruments
    → scènes de fin. Livre par `prepare.py` (famille à créer si besoin).
  - *Fondation + cœur* : le vocabulaire CSS, puis étapes 1 à 4 (bilan,
    versement, palier, tirage) et le saut au bouton. Les images attendues
    sont référencées sous leur nom final ; tant qu'elles manquent, un
    emplacement neutre (silhouette CSS) tient leur place.
  - *Sons* : les voix dans `audio.ts` et un petit module d'appel ;
    l'accrochage aux étapes se fait par les agents des étapes, sur une API
    convenue (`sonCeremonie('compteur' | 'sceau' | …)`).
- **Vague 2, après la fusion de la vague 1** (le vocabulaire existe)
  - *Module et haltes* (étapes 5 et 6).
  - *Fins de partie* (étape 7).
- **Fin** : banc de la cérémonie rejoué sur chaque étape (1280×720, 1280×800,
  et « moins d'animations ») ; une PR vers `dev` ; un aperçu sur
  `previsu-go`.

## Les choix de l'orchestrateur (après la relecture du constructeur)

- **Couleurs** : les teintes de rang existantes du jeu restent (S or, A menthe,
  B bleu, C gris-bleu, D rouge — déjà dans `ceremonie.ts`) ; les bandes de
  danger en ocre terni (le `mat_rayures` des habillages). Les sceaux de rang
  sont rendus UNE fois, en acier neutre, et teintés par le CSS : la planche
  reste sous le plafond de chauds de `prepare.py`.
- **Fins de partie** : la cinématique existante (`joueMoment('expedition-
  achevee')`, `run-perdue`) joue toujours ; la scène nouvelle vient APRÈS,
  comme écran de bilan, à la place du `#overlay` brut. Concernés : la
  descente bouclée, la défaite définitive et « échantillon dispersé —
  reprise ». Les fins d'essai, d'éditeur et de mini-jeu en test restent sur
  `#overlay`. Pas de « meilleur rang » de la descente (il faudrait un état de
  plus dans la sauvegarde) : seulement des chiffres qui existent déjà.
- **Haltes** : le héros d'une halte est son icône Blender rendue en grand
  (cases à 512 px) ; chaque mini-jeu a la sienne (5) ; les puces d'issue et
  les offres de halte sont couvertes par la planche de cérémonie — la garde
  « aucun émoji dans la cérémonie » doit pouvoir passer.
- **Format des icônes** : des planches WebP transparentes, lues en `<img>` /
  `background` en HTML et en `drawImage` au canvas ; dans les phrases en texte
  brut, l'émoji disparaît au profit du nom (ou d'une balise si la phrase
  devient HTML).
- **Un lot de plus** (vague 3) : *icônes partout* — après la cérémonie, le
  remplacement dans le reste du jeu, hors de la zone M:14400–17400.

## Ce qui reste au constructeur

- Les tailles, les durées exactes, l'ordre fin de la chorégraphie (sous la
  contrainte de durée), les teintes précises dans la palette.
- Le format des planches (taille des cases, une planche ou plusieurs) et leur
  famille dans `prepare.py`.
- Le détail des sons (enveloppes, fréquences).
- Les tests : chaque correctif de comportement (saut au bouton, titre REPOS,
  dos de carte) vient avec le test qui tombe sans lui ; les gardes de mise en
  page (pas d'empilement, pas de paragraphe dans une cartouche, aucun émoji
  dans la cérémonie) s'écrivent dans `ceremonie.spec.ts`.
