# Tension de surface

Roguelike ambiant et inertiel : vous êtes un volume d'eau qui s'échappe d'un
laboratoire orbital. En gravité nulle, la seule façon d'avancer est d'éjecter
une partie de soi-même — **se déplacer, c'est rétrécir**.

Le document de référence est [`docs/doc-fonctionnel.md`](docs/doc-fonctionnel.md) ;
le système de routes (la carte, les voies, les rencontres, leurs réglages
et les pistes) est dans [`docs/routes.md`](docs/routes.md).

## État — version 0.21.425, une run jouable de bout en bout

Le jeu tourne dans le navigateur, sur ordinateur, tablette et téléphone.
**425 livraisons consignées entre le 08/08/2026 et le 04/09/2026** — le journal
complet se lit dans l'écran NOTES DE VERSION, les données sont dans
[`src/bench/livraisons.ts`](src/bench/livraisons.ts).

Les jalons 1 et 2 du document fonctionnel sont derrière, et les jalons 3
(chaleur et états) et 4 (boucle roguelike) sont faits pour l'essentiel.

**Le corps et le geste.** Solveur de fluide PBF 2D (typed arrays, grille
spatiale, pas de temps fixe, noyaux compilés en WebAssembly) ; cohésion par
contrainte de densité ; propulsion par éjection à quantité de mouvement
exactement conservée ; fusion des masses, identification du corps par amas
connexe, dispersion sous le volume critique ; vortex de regroupement ; caméra
à zoom automatique et time warp qui ne touche jamais au pas physique.

**La matière.** Les quatre états — liquide, glace, vapeur et le plasma — avec
la carte thermique, la recondensation de la vapeur perdue, et le CYCLE des
mémoires : chaque transformation manuelle est un lien à tisser, on commence
avec juste de quoi redevenir liquide.

**Le vaisseau.** Des obstacles de chimie, pas de géométrie : parois
hydrophobes et hydrophiles, éponge à saturation, membranes, rideaux, grilles,
plaques chaudes et froides, surchauffeurs, évents — et des ouvertures sur le
dehors, vides ou vitrées, qui montrent les étoiles sous le plancher. Des chasses,
courants de poussée qui balaient le corps hors d'une salle. Des coupelles,
péages en volume qui aspirent le liquide dans leur outre jusqu'à leur trait,
puis ouvrent leur canal ([`docs/coupelle.md`](docs/coupelle.md)). Des faisceaux laser, des
pastilles mémoire et des portes qui forment une algèbre complète — le cabinet
logique en fait cinq salles de démonstration sans ajouter un seul mécanisme.
Les récepteurs à maintien et à bascule, le OU exclusif et les portes ouvertes
au repos en font de vraies fonctions logiques ([`docs/logique.md`](docs/logique.md)).
Des rails à champ qui convoient la vapeur et l'ionisent en plasma. Des puits
de gravité autour desquels le corps orbite, sa trajectoire prédite à l'écran,
et une ronde sans fin en glace entre trois puits ([`docs/puits.md`](docs/puits.md)) — d'où l'on
tire des éclats de glace sur des cibles à points, dans le mini-jeu des cibles.

**La boucle.** Le hub du laboratoire Méduse, le sas de lancement, la carte
de la station à routes ramifiées (un module est un biome de SIX salles ;
au bout d'elles la carte s'ouvre et la coursive suivante se choisit, sous
cadenas tant que l'orbe manque ; la longueur d'une run découle du trajet —
trente salles, vingt-sept par la voie courte, en cinq biomes : trois
actes, l'approche et le terminal ; la voie froide paie tôt, la chaude
tard, celle du milieu en salles ;
la grande carte ne montre que des biomes, le confinement supérieur qui
paie double, la nature et la température du module qui font la salle, le
survol qui dit ce qu'on trouvera dans un module et ce que sa porte ferme ;
dans chaque module une mini-carte à trois voies où chaque porte ouverte
ferme les autres, avec ses salles, ses haltes — économat, alcôve, bonbonne
oubliée, cache à orbe — et ses RENCONTRES, du lore, deux ou trois offres,
un pari assumé : le condenseur qui rend onze ans d'eau, le décanteur qui
prend une part de l'essence maximale, le Semblable endormi, la cuve des
rebuts ; tout cela réglé au banc), la
descente semi-procédurale (rampe de difficulté réglable, graine du jour
commune à tous les postes), le choix de la salle suivante en vignettes,
les orbes d'essence de conscience (achetés au marchand du hub contre de la
mémoire, trouvés en cache, dépensés à l'écran des mémoires pour tisser une
transformation), les améliorations durables du marchand,
l'économat à mi-descente qui troque contre du condensat, la mise en bonbonne
du surplus au sas, la purge de fin de run. Le codex se remplit de ce que le
sujet découvre en jouant, les trophées de ce qu'il réussit.

**Les écrans.** Cinématiques en planches illustrées (le montage compose, il ne
code pas), accueil, les SAUVEGARDES (trois emplacements, un document par
emplacement fait pour le Steam Cloud — `src/game/coffre.ts`), les FANTÔMES
(vos records rejoués dans la salle : la forme du corps, le jet, les dashs,
la ligne de course et l'écart en direct — `src/game/fantome.ts` — et le
REJEU depuis l'écran des records, la salle sans corps et la caméra qui suit,
et le fantôme PARTAGÉ du palmarès — `api/fantomes.ts`, `src/game/netFantomes.ts`),
notes de version, palmarès partagé, le codex (rail des
états, fiches en hexagones, fiche lue avec la vidéo de l'effet quand elle
existe — `public/assets/codex/LISEZ-MOI.md`), le tableau des avaries sur le
même dessin (rail des secteurs, cartes des stations, fiche avec l'illustration
éteinte tant que la station est en panne — `src/game/ecranAvaries.ts`,
`public/assets/avaries/LISEZ-MOI.md`), cycle.

**La fabrication.** L'écran LA DESCENTE, où le déroulement d'une run se
règle, se déroule à blanc et se met en statistiques ; un éditeur de tableaux
complet (~7 000 lignes) ; l'**éditeur de la carte** de la station — le plan
à routes ramifiées se glisse, se lie, se vérifie, se rejoue en aperçu et
s'exporte en `carteStation.json`, la source de vérité que le jeu lit
([`docs/carte-station.md`](docs/carte-station.md)) ; la
PLANCHE — toutes les salles de la bibliothèque partagée en vignettes dessinées
depuis leur géométrie, l'ordre y est la séquence de l'expédition —, l'atelier
RÉCIT & FINS — le récit et les fins que chaque expédition bouclée révèle, dans
l'ordre du concepteur, avec les seuils de la révélation et du dénouement
([`docs/scenario.md`](docs/scenario.md)) —, et un
générateur qui refuse tout tirage dont la traversée ne se démontre pas.
Bibliothèque, palmarès, présets, cinématiques, images, journal (récit et
fins), réglages du codex, plan de la descente, carte de la station, cartes
de l'atelier des récompenses, retouches de textes et séquences sont partagés
entre concepteurs — et joués par tout le monde — par une API sur Vercel
Blob ; le code porte la version livrée de chacun comme filet, l'écran qui le
règle a son bouton PUBLIER.

**Le rendu et le son.** Métaballes WebGL2 en deux passes, éclairage et ombres,
parallaxe, sprites, palette froide. Sons synthétisés en Web Audio (seule la
nappe de vapeur est un enregistrement), lits musicaux accrochés aux lieux et
aux événements plutôt qu'aux tableaux.

**Les commandes.** Souris, tactile (barre de commandes, pincement pour le
zoom) et manette — Steam Deck, Xbox, DualSense.

## Lancer

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

**Contrôles** : maintenir le pointeur pour éjecter vers ce point (le corps part
à l'opposé) · `,` / `.` time warp · `espace` pause · `R` recommencer.
Objectif : rejoindre le sas avec le plus de volume possible.

**Les outils du concepteur** sont derrière le mode concepteur : `?dev` dans
l'URL, ou sept tapes rapides sur le numéro de version (tactile compris).
Le bouton RÉGIE ouvre leur console : un rail — la carte, la descente, la
planche, le récit et les fins, le scénario et le montage, le codex, le
marchand, les avaries du module, les récompenses, les textes —, la vue
d'ensemble de ce qui est publié pour tout le monde, et le tir à blanc du
système de run (pour N expéditions bouclées : fragment, fin, révélation,
dénouement, cinématiques).
C'est la seule porte des outils sur l'accueil (les anciens boutons sont
partis) ; `?editeur` et `?carte` dans l'URL restent des raccourcis.
`?editeur` ouvre l'éditeur directement, `?carte` l'éditeur de la carte de la
station, `?tableau=N` démarre à la salle N,
`?spawn=x,y` place le corps. `?horsligne` coupe tout appel à l'API (la
posture du build Steam : le contenu livré fait foi — `src/game/reseau.ts`).

## Qualité

```bash
pnpm test        # 1058 tests dans 97 fichiers, ~30 s (mesuré le 10/09/2026)
pnpm type-check
pnpm build
```

Les tests couvrent la physique (conservation de la quantité de mouvement,
cohésion, fusion, dispersion, grille spatiale, amas, chaleur, glace, vapeur,
recondensation, WASM), les règles de jeu (bonbonnes, condensat, économat,
codex, trophées, cycle, récompenses, voie, générateur) et les écrans
(commandes, cinématiques, planche, éditeur, bibliothèque partagée).

## Le multi (prototype)

Un essai de partie à deux, chacun chez soi, derrière le mode concepteur :
bouton **MULTI** sur l'accueil (`?dev`). Tout vit dans [`src/multi/`](src/multi/).

- **Créer / rejoindre** : l'hôte reçoit un code de cinq caractères, l'ami le
  tape — ou ouvre le lien `?dev&multi=CODE`, qui mène droit dans la partie.
- **Le relais** : toute la partie passe par un petit serveur à nous,
  [`relais/`](relais/), qui tient les deux connexions et remet à l'un ce
  qu'envoie l'autre. Trois essais de liaison directe entre deux maisons
  avaient échoué — `relais/index.js` les raconte. Il vit dans le projet
  Vercel du jeu, comme un déploiement à part qui ne contient que lui (le
  jeton du dépôt ne peut pas créer de projet). Il se déploie par la
  gâchette `relais-go`, qui l'essaie aussitôt en ligne depuis le serveur de
  GitHub ; son adresse change à chaque déploiement, et le jeu la porte dans
  `src/multi/relais.ts`.
- **Qui simule** : la machine qui CRÉE la partie. L'autre envoie sa commande
  et affiche ce qu'il reçoit (rejouer les mêmes gestes sur deux machines ne
  donne pas le même film — `src/game/fantome.ts`). La partie continue quand
  la fenêtre de l'hôte passe en arrière-plan ; elle s'arrête s'il ferme
  l'onglet.
- **Le solveur du jeu n'est pas touché.** `src/multi/solveurMulti.ts` en est
  une copie qui tient plusieurs corps, chaque particule portant son
  propriétaire ; un test de parité la tient, à un joueur, sur les mêmes
  nombres que l'original, au bit près. Le rendu aussi est à part
  (`renduMulti.ts`) : deux couleurs, sans l'éclairage ni les décors du jeu.
- **Ce qui est là** : une grande salle vide, deux corps de couleurs
  différentes, le jet, se rassembler (le pointeur posé sur son corps, comme
  dans le jeu), ESSAYER SEUL pour piloter les deux corps sur une machine.
- **Les gestes entre joueurs** : un corps est FERMÉ par défaut — il ne se
  mélange à rien d'étranger, deux corps fermés se bousculent sans se mêler.
  S'OUVRIR se tient (espace, clic droit, ou le bouton à l'écran) : deux
  corps ouverts FUSIONNENT en gardant chacun leur matière, et se pilotent à
  deux ; l'un se referme, ils se SÉPARENT. Un corps ouvert BOIT ce qu'on
  lui tire (le don) ; fermé, le jet le bouscule. Seul un jet se donne : un
  morceau détaché reste à son corps. `solveurMulti.ts`, « les cloisons ».
  Deux corps fermés qui se percutent S'ÉCRASENT l'un contre l'autre,
  rebondissent et redeviennent ronds (« le rebond », « la peau tendue »).
- **Le mode HOCKEY** (à choisir au salon, avant de créer la partie) : un
  palet sur une PATINOIRE, aux proportions des vraies : coins arrondis,
  ligne rouge, lignes bleues, cercles de mise en jeu, et une cage par camp
  posée DANS le terrain — un trapèze ouvert vers le centre : on passe
  derrière, l'eau et le palet y butent, et l'on ne marque que par devant. Fermé, le corps amortit
  le palet et le renvoie ; OUVERT, il l'avale dès qu'il le touche — et se refermer le LANCE
  vers le pointeur, d'autant plus fort qu'on l'a tenu (trois secondes au
  plus, après quoi il s'échappe). Le jet le pousse aussi. Le premier à cinq
  buts gagne. La règle est dans `hockey.ts` ; le solveur n'en connaît que
  le contact du palet avec l'eau. Au hockey la matière tirée revient à son
  corps d'où qu'elle soit — on y pousse sans cesse.
  Un match dure trois minutes (le meilleur score gagne, et à égalité le
  prochain but). On engage sur les CERCLES : au centre pour commencer,
  puis, après un but, sur un cercle de la zone de celui qui vient de
  marquer — le palet sur son point, un joueur de chaque côté, et un
  décompte avant de jouer. Un corps FERMÉ qui
  percute le porteur lui ARRACHE le palet — s'il arrive assez vite, et
  c'est lui qui doit foncer.
- **Le mode SUMO** : un anneau, deux corps, on gagne la manche en poussant
  l'autre dehors (son cœur hors de l'anneau), trois manches gagnantes.
  L'anneau se resserre en trente secondes. On ne s'y ouvre pas. Il ne
  demande rien de neuf au solveur : le rebond, l'écrasement, le jet et le
  dash font le jeu.
- **Ajouter un mode à l'arène**, c'est écrire une RÈGLE (`regle.ts`) : où
  chacun commence, ce qu'on regarde après chaque pas, le score, l'état qui
  part dans la trame — `hockey.ts` et `sumo.ts` en sont deux — et lui
  dessiner son terrain dans `renduMulti.ts`.
- **Contre l'ordinateur** (`robot.ts`) : un adversaire pour jouer tout de
  suite ou s'entraîner, au hockey et au sumo. Il joue avec les commandes
  d'un joueur (pousser, s'ouvrir, dasher, viser), posées chez l'hôte comme
  celles d'une manette ; il réfléchit huit fois par seconde et vise avec un
  peu d'erreur.
- **À deux sur cet écran** : avec deux manettes, chacun la sienne ; avec une
  seule, elle est au second joueur et le premier garde souris et clavier.
  Aucune liaison, aucun relais.
- **Le profil** (`profil.ts`) : un nom (facultatif) et une couleur, choisis
  au salon et gardés dans le navigateur. Les deux joueurs se les échangent
  au début de la partie, par un message que le relais transmet tel quel ;
  ce qui arrive de l'autre est remis au propre avant d'être montré. S'ils
  ont choisi la même couleur, l'hôte la garde et l'invité prend la
  suivante.
- **La fin d'un match** : le résultat en grand, et REVANCHE — un clic de
  l'un ou de l'autre relance le match.
- **Le DASH** (Maj, le bouton à l'écran, B ou RB à la manette) : une brusque
  accélération dans le sens où une poussée enverrait le corps, rechargée
  en un peu plus de deux secondes. Il vaut dans les deux modes ; au hockey
  il sert à prendre le palet au porteur.
- **La GLACE** (F maintenu, le bouton à l'écran, X ou Y à la manette) : le
  premier état de la matière devenu un pouvoir. Le corps se prend en un
  bloc rigide tant qu'on tient — deux secondes au plus, puis trois de
  recharge. Un bloc ne pousse plus et ne s'ouvre plus : il file tout droit,
  et le dash part encore. Là où l'eau AMORTIT le palet, la glace le RENVOIE
  (lancé à 700 u/s sur un corps au repos, il repart à 35 de l'eau et à 428
  de la glace) et le FRAPPE (un bloc à 420 u/s l'envoie à 667, un corps
  d'eau à 531). Celui qui tient le palet ne gèle pas. Elle vaut au hockey
  et en mode libre ; pas au sumo, où elle reste à essayer. C'est le gel du
  jeu, réveillé dans la copie du solveur — voir l'en-tête de
  `solveurMulti.ts` et `glace.spec.ts`. L'ordinateur s'en sert pour frapper
  le palet vers la cage quand il est posé devant elle.
- **La manette** (`manetteMulti.ts`) : le stick gauche dit où l'on VA (le
  jet part à l'opposé, et le palet part du côté du stick), A ou RT pousse,
  LT ou LB ouvre tant qu'on tient, B ou RB dashe, X ou Y gèle, Start recommence. Un réticule montre la
  visée. La manette et la souris se passent la main : la dernière à avoir
  bougé commande. Select quitte la partie. AU SALON, la croix ou le stick
  passent d'un bouton à l'autre, A valide, B revient ; pour rejoindre, le
  code se compose à la croix (←→ la case, ↑↓ le caractère).
- **Les sons** (`sonsMulti.ts`) : le jet, s'ouvrir et se refermer, le choc
  de deux corps, et au hockey le palet sur la paroi, contre un corps,
  avalé, lancé (une note monte tant qu'on le tient), le but, la fin. Tout
  est synthétisé, sans fichier ; ce qu'on entend se déduit de ce qu'on
  affiche, d'une image à la suivante — rien de plus ne voyage. Le volume
  et la coupure du son sont ceux réglés dans le jeu.
- **Quand ça ne marche pas** : l'écran écrit sous le message d'erreur un
  « détail pour le dépannage » (le relais joint, les instances vues, les
  coupures). C'est lui qu'il faut photographier.
- **Les graphismes** (`renduMulti.ts`) : les corps portent l'habillage de
  l'eau du jeu, en surface « miroitant mercure » — relief, éclats, fresnel,
  étincelles, et un miroir d'un seul tenant où se reconnaissent, courbés,
  les lignes du terrain, ses cages, l'anneau du sumo, les rampes et les
  projecteurs du plafond. Chaque corps a son REGARD, tourné vers ce que le
  joueur vise : on lit où l'autre va tirer. La glace est taillée en
  facettes. C'est la recette du shader du jeu recopiée, pas son moteur :
  la teinte est celle du joueur, et le décor miré est celui du multi.
- **Ce qui manque** : les salles, la vapeur et le plasma (la glace est
  là).
- **Le débit** : une image pèse 10,9 Ko (1 800 particules à six octets),
  vingt par seconde — 212 Ko/s mesurés à travers le relais en ligne, soit
  1,7 Mbit/s en envoi chez l'hôte, que le relais reçoit puis renvoie. Si la
  ligne ne suit pas, l'hôte saute des images au lieu de prendre du retard.

## Ce qui n'est pas fait

- **Le boss.** La Pompe de reprise n'est qu'une esquisse écrite
  ([`docs/boss-pompe.md`](docs/boss-pompe.md)) : rien n'est implémenté.
- **L'étiquetage des tableaux par biome** : le champ existe (planche,
  éditeur de tableaux), mais aucune salle n'est encore étiquetée — toutes
  sont universelles, tout module les pioche
  ([`docs/carte-station.md`](docs/carte-station.md)).
- **Les cinq décisions ouvertes** du §14, à commencer par l'intensité de la
  cohésion — le curseur d'identité du jeu.
- **L'empaquetage Steam** : les visuels de boutique sont dessinés
  (`public/steam/`), le reste est à faire.
