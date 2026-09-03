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
  `desc`.
- `liens[]` : `de`, `vers`, `type`. **Orientés** : le joueur avance de
  `de` vers `vers`. Une clé de `typesLiens`.
- `typesLiens` : par type, `couleur`, `epaisseur` (la ligne de route),
  `coque` (la largeur de la paroi), `tirets` (optionnel), `condition`
  (`null` = libre, sinon `etatJoueur == glace`), `badge` (optionnel).
- `decor[]` : le non-jouable, ancré à un module — l'arc de coque
  (`coque-croissant`, deux courbes) et le télescope (`telescope-hubble`,
  position, rotation, tube). Les nervures et lumières de l'arc sont
  calculées sur ses courbes : l'arc peut changer de forme sans qu'on les
  refasse.
- `palette` : les couleurs du dessin.
- `regles` : `depart`, `objectif`, `etatsJoueur`, `etatInitial`,
  `couloirHub` (la règle en français), `temperatureCouleur` (des seuils,
  lus dans l'ordre : `<=0`, `<30`, `<60`, `sinon`).

**La règle du hub.** « Un lien partant du HUB sort à
y = clamp(cible.y, HUB.y − 110, HUB.y + 110) ». Le 110 est h/2 − 36 pour
un fût de 292 : `traceLien` l'applique à tout module plus haut que large,
à chaque bout. Un second hub se comportera comme le premier.

## Ce qui reste à faire

- **Brancher la carte dans le jeu.** L'écran LA STATION lit encore le plan
  linéaire de `station.ts` (six modules sur une poutre, un module toutes
  les *n* salles). La carte ramifiée demande une décision de conception :
  comment une coursive choisie se traduit en salle suivante (le générateur
  pioche par moment · mécanique ; un module pourrait porter ce code), et ce
  que « entrer dans un module » coûte ou rapporte. `dessinCarteSVG` en mode
  `jeu` est prêt pour cet écran.
- Les vignettes bitmap par module (`docs/carte-station/assets-prompts.md`)
  si l'on quitte le tout-vectoriel — le champ `img` de la maquette n'est pas
  repris dans le JSON tant qu'elles n'existent pas.
