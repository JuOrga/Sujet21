# La carte de la station — données, dessin, éditeur

> Le plan à routes ramifiées du §9 du document fonctionnel, tel que le
> concepteur l'a dessiné (handoff « Carte de la station », septembre 2026,
> copié dans `docs/carte-station/`). Onze modules, douze coursives, quatre
> zones, des conditions d'accès selon l'état du sujet (eau · glace · vapeur).

## Où sont les choses

| Fichier | Rôle |
| --- | --- |
| `src/game/carteStation.json` | **La source de vérité.** Ce que l'éditeur exporte, ce que le jeu lit. Rien de la carte n'est écrit en dur ailleurs. |
| `src/game/carteStation.ts` | Le modèle : types, lecture (`parseCarte`), sérialisation à l'identique, vérification de fond (`verifieCarte`), et les questions pures — où passe une coursive (`traceLien`), quel module est atteignable, quelle couleur pour cette température. |
| `src/game/dessinCarte.ts` | Le dessin, en une chaîne SVG (`dessinCarteSVG`). Pur : il sert à l'éditeur aujourd'hui, et servira tel quel à l'écran de jeu. |
| `src/editor/carteOperations.ts` | Les gestes, purs : déplacer, redimensionner, lier, renommer, supprimer, l'historique. |
| `src/editor/editeurCarte.ts` | L'éditeur lui-même (DOM) : la barre, les listes, la scène, les formulaires, l'aperçu jeu. |
| `docs/carte-station/` | Le handoff du concepteur : le cahier, la maquette interactive (`.dc.html`, à ouvrir avec le runtime Claude Design — non inclus), les prompts d'assets. |

Les styles vivent dans `index.html` (blocs `#carte-editeur` / `.ce-*` pour
l'éditeur, `.cs-*` pour le dessin).

## Ouvrir l'éditeur

- En mode concepteur (`?dev`, ou sept tapes sur le numéro de version), le
  bouton **CARTE** de l'accueil.
- Ou directement : `?carte` dans l'URL.

## Les gestes

| Geste | Effet |
| --- | --- |
| clic sur un module / une coursive | le sélectionne ; le panneau de droite montre sa fiche |
| glisser un module | le déplace (centre aimanté à la grille, 8 px par défaut) |
| glisser un coin du module sélectionné | le redimensionne (le coin opposé ne bouge pas, 32 px minimum) |
| **Lier** (ou `L`, ou Maj + glisser) d'un module à un autre | trace une coursive du type choisi dans la barre |
| flèches (Maj : ×5) | déplace le module sélectionné d'un pas de grille |
| Suppr / Retour arrière | supprime la sélection (un module emporte ses coursives) |
| Ctrl+Z / Ctrl+Y | annule / rétablit — une étape par geste, pas par image |
| Échap | défait dans l'ordre : le geste en cours, l'outil, la sélection, puis l'écran |

Le panneau de droite édite tout le reste : identifiant (renommer suit
partout — coursives, décor, départ et objectif), nom, nature, zone,
silhouette, position, taille, température, description ; pour une
coursive, ses deux bouts, son type, son sens ; sans sélection, les règles
(départ, objectif, état initial), la scène, les zones et les **types de
coursive** (couleur, trait, coque, tirets, condition, badge).

Le panneau de gauche liste modules et coursives, et la **vérification** :
un identifiant en double, une coursive vers un module inconnu, un module
que nul ne peut atteindre, un objectif hors de portée, deux modules qui se
chevauchent. Cliquer un verdict sélectionne le fautif.

**Aperçu jeu** rejoue le comportement voulu in-game : le sujet part du
module de départ, seuls les modules au bout d'une coursive partant de sa
position sont accessibles, une coursive dont la condition n'est pas remplie
montre un cadenas et refuse l'accès, ENTRER avance, la coursive parcourue
s'efface à 35 %. On change l'état du sujet (eau · glace · vapeur) pour
vérifier que chaque route s'ouvre comme prévu.

## Faire évoluer la carte du jeu

1. Ouvrir l'éditeur, modifier — le document est retenu sur le poste
   (`localStorage`) d'une séance à l'autre.
2. **Exporter** : le navigateur télécharge `carteStation.json`.
3. Le déposer par-dessus `src/game/carteStation.json`, puis `pnpm test` :
   le fichier est relu par le test de `carteStation.spec.ts`, qui refuse une
   carte illisible ou avec une erreur de fond (objectif inatteignable…).
4. Commit, PR vers `dev`.

Le JSON s'exporte avec les mêmes clés dans le même ordre que le fichier du
dépôt : un export relu donne un diff vide, et un diff ne montre que ce qui a
changé. **Carte livrée** dans la barre ramène le document au fichier du
dépôt (annulable).

## Le modèle de données (`carteStation.json`)

- `scene` : la taille de la scène (1600 × 804), le repère de tout le reste.
- `zones[]` : `id`, `code` (« Z-02 »), `nom`, `couleur`.
- `types` : le libellé de chaque nature de module — `sas`, `jonction`,
  `combat`, `enigme`, `coffre`, `boss`.
- `modules[]` : `id`, `nom`, `type`, `zone`, `x`, `y` (**le centre**),
  `w`, `h`, `temp` (°C), `forme` (`octogone` | `rond` | `octogone-dome`),
  `niveaux` (**un module est un biome** : le nombre de salles qu'on y joue
  avant que la carte ne s'ouvre à nouveau ; 0 pour un lieu sans salle,
  hub ou nœud), `biome` (le code du biome dans la nomenclature atelier,
  la pioche ne tirera que des tableaux qui le portent), `orbe` (optionnel :
  l'orbe que le module recèle — une cache), `desc`.
- `liens[]` : `de`, `vers`, `type`. **Orientés** : le joueur avance de
  `de` vers `vers`. Une clé de `typesLiens`.
- `typesLiens` : par type, `couleur`, `epaisseur` (la ligne de route),
  `coque` (la largeur de la paroi), `tirets` (optionnel), `condition`
  (`null` = libre, sinon `orbe == solidification` — un id d'orbe, voir
  ci-dessous), `badge` (optionnel).
- `decor[]` : le non-jouable, ancré à un module — l'arc de coque
  (`coque-croissant`, deux courbes) et le télescope (`telescope-hubble`,
  position, rotation, tube). Les nervures et lumières de l'arc sont
  calculées sur ses courbes : l'arc peut changer de forme sans qu'on les
  refasse.
- `palette` : les couleurs du dessin.
- `regles` : `depart`, `objectif`, `couloirHub` (la règle en français),
  `temperatureCouleur` (des seuils, lus dans l'ordre : `<=0`, `<30`,
  `<60`, `sinon`).

**Les orbes d'essence de conscience.** Un cadenas ne lit pas l'état du
corps à l'instant : il lit un ACQUIS. Chaque orbe est une transformation ou
un état du cycle des mémoires (`src/game/cycle.ts`) — `fusion`,
`liquefaction`, `solidification`, `vaporisation`, `sublimation`,
`condensation`, `ionisation`, `deionisation`, et les états `solide`,
`liquide`, `gaz`, `plasma`. La liste `ORBES` de `carteStation.ts` est
dérivée du cycle : la carte ne la duplique pas. La vérification refuse une
condition qui cite un orbe inconnu. L'aperçu jeu coche les orbes acquis et
les cadenas suivent.

**Le trajet en niveaux.** `longueursTrajet` compte les salles du départ à
l'objectif, au plus court et au plus long ; la ligne de vérification de
l'éditeur l'affiche. La longueur d'une run n'est plus un réglage, c'est une
conséquence de la carte : sur la carte livrée, 9 niveaux.

**La règle du hub.** « Un lien partant du HUB sort à
y = clamp(cible.y, HUB.y − 110, HUB.y + 110) ». Le 110 est h/2 − 36 pour
un fût de 292 : `traceLien` l'applique à tout module plus haut que large,
à chaque bout. Un second hub se comportera comme le premier.

## La conception retenue (concepteur, 03/09/2026)

1. **Un module = un biome = un ensemble de niveaux.** Le nombre de salles
   par module se règle dans l'éditeur (`niveaux`) ; le nombre de modules
   aussi, en en ajoutant sur la carte. L'extension se fait en ajoutant des
   modules à la suite.
2. **Au bout des niveaux du module, la carte s'ouvre.** Le joueur choisit le
   module suivant parmi ceux au bout d'une coursive partant de sa position.
   Le module choisi s'agrandit à l'écran et présente les vignettes de ses
   salles, comme le choix actuel en trois vignettes : un seul écran, deux
   temps.
3. **Les tableaux portent un code de biome**, ajouté à la nomenclature
   atelier moment · mécanique · difficulté (101, 223…). La pioche ne tire que
   des tableaux du biome du module. Les tableaux existants sont à
   réétiqueter, et à compléter là où un biome est vide.
4. **Les cadenas sont des barrières durables.** Une coursive glace ne
   s'ouvre que si l'orbe de solidification est acquis. Les orbes s'achètent
   au **marchand du hub** contre de la mémoire (la monnaie durable ; le
   condensat, lui, est perdu à la fin de la run), et se trouvent aussi en
   run. Le marchand vend également d'autres améliorations durables. L'écran
   des mémoires dépense les orbes pour tisser les transformations.
5. **Les caches** (S1b, S3b) restent un bonus sans règle arrêtée — un orbe
   trouvable au fond du cul-de-sac est la piste naturelle.
6. **La longueur d'une run découle du trajet** et des niveaux par module.

## La descente pilotée par la carte (`src/game/descenteCarte.ts`)

- **L'état** : `carteRun = { module, niveau, visites }` — le module où l'on
  joue, les salles déjà franchies dedans, les modules traversés. Il s'écrit
  dans la sauvegarde de run et se relit à la reprise (une sauvegarde d'avant
  la carte repart du départ).
- **Au sas de lancement**, la carte s'ouvre dans la cérémonie : le premier
  module se choisit sur le plan. Au bout des salles d'un module, elle se
  rouvre. Un module fermé dit l'orbe qui manque (et secoue la scène), un
  module hors de portée dit qu'aucune coursive n'y mène. Le module élu
  s'agrandit (la scène zoome sur lui), puis ses salles arrivent en
  vignettes — le choix habituel de la voie, titré du nom du module et de la
  salle dans le module. Un nœud (module sans salle) rouvre la carte aussitôt.
- **La longueur d'une run** n'est plus le réglage du plan de voie : c'est
  `longueurRun()` — salles franchies + salles restantes du module + plus
  court chemin en niveaux jusqu'à l'objectif. Le plan de voie garde tout le
  reste (rampe, moments, postures, pioche) et reçoit cette longueur
  (`planEffectif()`). L'écran LA DESCENTE, lui, simule toujours avec sa
  propre longueur : c'est un banc, pas la run.
- **La fin de l'expédition** : le module objectif, épuisé.
- **Une cache n'est pas un piège.** D'un module d'où l'objectif est hors
  de portée (un cul-de-sac), la carte offre le **retour** vers le module
  d'où l'on vient — le dernier traversé qui y mène par une coursive, pas
  la cache qu'on quitte. Au retour, le module est déjà épuisé : ses salles
  ne se rejouent pas, la carte se rouvre aussitôt. La vérification de
  l'éditeur signale chaque module d'où l'objectif est hors de portée.
- **La pioche suit le biome** : un tableau qui porte un `biome` ne se
  propose que dans le module de ce biome ; un tableau sans biome est
  universel (la bibliothèque n'est pas encore réétiquetée) ; une salle
  générée prend le biome du module. Le champ `biome` d'un tableau se lit et
  s'écrit avec le tableau (levelIO), l'éditeur de tableaux ne l'expose pas
  encore (étape 4).
- **Les orbes, en attendant les orbes** (`orbesDuCycle`) : un orbe est tenu
  pour acquis quand la transformation qu'il nomme est tissée au cycle des
  mémoires, et un orbe d'état quand une transformation qui y mène l'est.
  L'étape 3 remplacera cette lecture par l'inventaire réel.
- **L'écran LA STATION** lit la carte : position, modules traversés,
  coursives ouvertes ou sous cadenas, fiche du module visé, légende tirée
  des types de coursive. Les anciens `station.ts` et `planStation.ts`
  (le plan linéaire à six modules) ne sont plus importés.
- **Les outils** (`__expedition`, files d'essai) lancent une run sans
  carte : elle entre d'office par la première coursive ouverte et joue la
  salle 1 comme avant.

## Ce qui reste à faire

Dans l'ordre, une PR vers `dev` par étape :

1. ~~Le JSON de la carte : niveaux par module, code de biome, condition lue
   sur les orbes. Éditeur mis à jour.~~ Fait.
2. ~~**La descente pilotée par la carte**~~ Fait — voir ci-dessous.
3. ~~**Les orbes**~~ Fait — voir ci-dessous.
4. ~~**Le champ biome dans la planche et l'éditeur de tableaux**~~ Fait —
   voir ci-dessous. L'étiquetage lui-même est un choix de conception par
   salle : il se fait dans la planche, les compteurs disent où il manque.
5. ~~**Retirer** `src/game/station.ts`, `planStation.ts` et
   `station.spec.ts`~~ Fait — retirés avec le codex refait, sur accord du
   concepteur.

## Étiqueter les tableaux par biome

- **Dans la planche** : un menu « biome » sous chaque carte (universel, ou
  un module de la carte de la station), enregistré dans la bibliothèque
  partagée comme le code. En tête, un filtre par biome avec le **compte de
  salles** par module : un compteur à zéro, en rouge, est un biome vide —
  le module n'aura que des salles générées et universelles. L'ordre de jeu
  (◀ ▶, glisser) ne se règle que sur la vue TOUTES : un rang n'a de sens
  que dans la liste entière.
- **Dans l'éditeur de tableaux** : la ligne « Biome » sous le code, même
  liste. Un tableau créé ou retouché sort étiqueté.
- **La liste des biomes** vient de `carteStation.json` (`biomesDeCarte`) :
  un module ajouté dans l'éditeur de carte apparaît dans les deux. Un
  tableau dont le biome n'est plus sur la carte garde son étiquette,
  marquée « plus sur la carte ».
- **Les tableaux livrés** (dans le code, `level.ts`) ne passent pas par
  la planche : pour en étiqueter un, l'ouvrir dans l'éditeur et
  l'enregistrer dans la bibliothèque — la copie de bibliothèque prime sur
  le livré du même code.

## Les orbes d'essence de conscience (`src/game/marchand.ts`, `records.ts`)

- **L'inventaire** vit dans les registres (`records.orbes()`), durable
  comme la mémoire. `acheteOrbe` (mémoire → orbe, atomique),
  `tisseAvecOrbe` (l'orbe quitte la poche, le lien se grave),
  `gagneOrbe` / `videCache` (une cache ne se pille qu'une fois par poste),
  `reinitialiseCycle` rend les orbes, plus la mémoire.
- **L'écran des mémoires** ne dépense plus de mémoire : une transformation
  se tisse avec SON orbe. La ligne dit « ORBE EN POCHE » ou « ORBE
  MANQUANT · 10 AU MARCHAND ». Le prix d'un orbe est le `cout` de la
  transformation dans `cycle.ts` : une seule table de valeurs.
- **Le marchand** (`#marchand`) : le Semblable du comptoir. Le voile
  s'ouvre au hub au contact de l'étal (la boîte qui englobe ses alcôves,
  élargie de 140 unités), ou depuis l'accueil en mode concepteur (bouton
  MARCHAND). Trois étals : les orbes (transformations non mystères), les
  **améliorations durables** (`AMELIORATIONS` : réserve élargie +0,5 L,
  second échantillon +1 vie, flair de cachette — trois pour commencer, à
  étoffer), les provisions du comptoir (les mêmes que les alcôves).
- **Les caches** : un module de la carte porte un champ `orbe` (éditeur :
  « Orbe recelé »). Quand le module est épuisé, l'orbe est pris — une fois
  par poste, jamais sous un outil de conception. Sur la carte livrée, S1b
  recèle la sublimation et S3b la condensation : deux valeurs par défaut, à
  changer dans l'éditeur.
- **Les cadenas** lisent `orbesAcquis()` : les orbes en poche, plus ce que
  le cycle tient (une transformation tissée vaut son orbe, un état atteint
  vaut le sien).
- Les vignettes bitmap par module (`docs/carte-station/assets-prompts.md`)
  si l'on quitte le tout-vectoriel — le champ `img` de la maquette n'est pas
  repris dans le JSON tant qu'elles n'existent pas.
