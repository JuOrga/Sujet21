# Projet 21 — bible narrative (v3.1)

> v3.1 — 17/08/2026 : verdicts du concepteur rendus sur les héritages de la
> v1 — le twist narratif du « collecteur » est ÉCARTÉ (la mécanique des
> bonbonnes reste, sans récit de moisson) ; l'acte final d'évasion est
> ÉCARTÉ (la masse se récupère simplement au début de chaque tableau).
> Tout ce document est désormais du CANON VALIDÉ, hors section « À définir ».
> Le Dr N. Véga et sa narration restent supprimés (v3).

# LE CANON (ligne de conduite du concepteur)

## Le pitch (l'origine)

Il était une fois, dans un module nommé **Méduse**, accroché à une station
spatiale laboratoire, un chercheur astronaute en quête de grandes
découvertes qui **crée la vie par accident**. Une petite substance,
confinée, étudiée. Cette substance, c'est le joueur : **Sujet 21**.

Ses premières pensées : *Qui êtes-vous ? Où êtes-vous ?* Pas le temps de
philosopher — lumières rouges, alertes, le module se vide des êtres qui
semblaient l'observer.

## L'ouverture jouable (le premier quart d'heure — cœur de la démo)

1. **La cuve.** Le joueur naît dans la cuve du module Méduse.
   Cartes de l'éveil : « Qui êtes-vous ? Où êtes-vous ? »
2. **L'alerte.** Lumières rouges, sirènes, le module se vide.
3. **La brèche** — *premier instant de gameplay* : le confinement cède,
   on sort de la cuve. Les commandes s'apprennent ici.
4. **L'exploration du module.** On y trouve la confirmation : ces êtres
   sont nos **Créateurs** — et d'autres **semblables** à nous sont
   enfermés dans des **fioles** étranges (assets sans interaction pour
   l'instant, directement dans la salle du hub).
5. **La seule sortie : commencer le jeu.** Le sas de lancement est
   l'unique issue — le premier run démarre.

## La fonction vraie (révélation après plusieurs runs)

Sujet 21 a été créé pour **servir de miroir spatial** : telle est sa vraie
fonction. Sa **conscience n'est qu'un accident** — et en début de jeu, il
n'est officiellement qu'une **expérience ratée**. La révélation éclate en
plot d'inter-run, jamais dans l'ouverture.

## Les semblables et la douche (méta-progression, post-démo)

- Les **fioles** du hub contiennent des semblables — même substance,
  **dépourvus de conscience**.
- Une fois le pouvoir de **glace** acquis, le joueur peut **libérer ses
  semblables**. Ils servent à **muter**.
- Après plusieurs runs et des **prises de conscience successives** (chacune
  ajoute du gameplay), la **douche** se débloque : avec des semblables
  libérés, le joueur y **ajoute des substances à son essence** et obtient
  des **pouvoirs par mutation**. (Référence ISS : l'hygiène en apesanteur —
  cabine fermée, gouttelettes captives.)

## La carte : une station, pas des niveaux

La carte globale s'inspire de la **structure de l'ISS**. Il faut
absolument en reprendre **l'architecture et la parcellisation** — la
fragmentation d'un grand espace en petits espaces de travail :

- chaque tableau EST un module ou une parcelle de module ;
- les modules s'enchaînent par des nœuds/jonctions ;
- l'architecture se lit au plan large : on doit reconnaître « la station »
  comme on reconnaît l'ISS sur une infographie ;
- la parcellisation donne le rythme roguelike : petites chambres de
  travail, portes, alternance serré/ouvert.

## Le hub, refondu : petit, dense, énigmatique

Le hub actuel est **trop grand**. Cible : un module **compact**, avec des
**assets/informations purement graphiques** — aucun impact sur le joueur.
En jeu, ce sont des **indications pour les humains** : comment EUX gèrent
les différents états de la substance.

### Les pictogrammes d'état (spécification)

Panneau type : un **rectangle de la couleur du matériau** (le code couleur
du jeu), et dessous **trois rangées de points** — une par état (EAU,
GLACE, VAPEUR), notées de 0 à 3 :

| points | lecture GESTIONNAIRE (humains) | lecture SUBSTANCE (joueur) |
|---|---|---|
| 0 | totalement inefficace | traverse / ignore |
| 1 | ça confine | une paroi |
| 2 | c'est efficace | dangereux |
| 3 | l'outil idéal pour gérer l'état | peut être mortel |

Exemple — l'**éponge** (rectangle ambre) : EAU ●●●, GLACE ●, VAPEUR ●.

Règles :
- n'y figurent QUE les moyens que les humains utilisent pour **gérer les
  états** — pas les hublots ni le décor ;
- même code couleur que la légende du jeu, pas de texte explicatif ;
- **volontairement énigmatique** : le joueur ne comprend pas forcément au
  premier passage.

## Stratégie : la démo Steam fest

Tout se hiérarchise par UN critère : **qu'est-ce qui rend la démo
inoubliable en 20 minutes ?**

Dans la démo (par ordre de chantier) :
1. **L'ouverture jouable** (le hameçon) ;
2. **Le hub compact** avec fioles (assets) et pictogrammes d'état ;
3. **La carte ISS** : re-parcellisation des tableaux existants ;
4. **Un run court et dense** (3-5 modules).

Hors démo (fondations posées) : révélation complète, libération des
semblables, douche/mutations.

## Verdicts rendus sur les héritages v1

- **Bonbonnes** : la MÉCANIQUE est conservée (réserve collectée au fil des
  tableaux) — mais SANS le récit de « moisson du laboratoire » : le sas de
  fin de tableau n'est pas un twist narratif, c'est la fin du tableau.
- **Pas d'acte final d'évasion** : la masse collectée se récupère
  simplement **au début de chaque tableau** — c'est une mécanique de
  boucle, pas une fin de jeu.

# À DÉFINIR (décisions du concepteur en attente)

- **La voix narrative** : qui parle au joueur, et par quel canal ?
  (Le journal de bord signé « Dr N. Véga » est supprimé ; les textes de
  journaux encore présents dans les données des tableaux sont un héritage
  à purger/remplacer quand la nouvelle voix sera choisie.)
- Les textes système (fin de tableau, défaite) dans la nouvelle voix.
- ~~Le nombre de runs avant la révélation du miroir spatial.~~ Tranché :
  le récit se livre **un fragment par expédition bouclée** (dix fragments,
  `src/game/decouvertes.ts`) ; une run perdue ou abandonnée ne raconte
  rien. La révélation vient donc à la dixième expédition bouclée.
- **Les fins** : chaque expédition bouclée révèle aussi **la prochaine fin**,
  dans l'ordre, comme une fiche du codex (groupe `fins`, rayon LES FINS du
  journal). La première est « Le miroir » (la cinématique MIROIR du
  secteur 4).
- **Le journal est en données** (`src/game/journal.ts`) : le récit, les
  fins, et les deux seuils — la **révélation** après N fragments (le sceau
  du secteur 4 tombe), le **dénouement** après N fins (l'alcôve du
  secteur 4 joue la cinématique ; avant, elle dit combien de fins
  manquent). Le concepteur tient tout cela dans l'atelier **RÉCIT & FINS**
  (accueil, mode concepteur, ou depuis le rayon du journal au codex) :
  ordre par glisser ou ▲ ▼, titre, icône, texte, ajout, retrait, seuils ;
  un brouillon par poste, PUBLIER pour tous (`/api/journal`, Vercel Blob),
  ESSAYER SUR CE POSTE pour jouer un brouillon sans publier, RETIRER LE
  PUBLIÉ pour revenir au livré. Le journal livré avec le code est le
  filet : il joue tant que rien n'est publié, et hors-ligne. Un identifiant
  ne se réattribue jamais (les registres des joueurs s'en souviennent) ;
  `fin-jouee` est réservé. Les fins alternatives prévues (« evil »,
  « semi-evil »…) s'écrivent donc dans l'atelier, sans toucher au code. La
  mémoire, la rareté et la vidéo de chaque entrée se règlent dans le codex.
  Le scénario dispose de deux conditions, `revelation` et `denouement`, qui
  lisent ces seuils : aucun N à tenir en double dans une règle.
- **Le plan de la descente est partagé** (`src/game/planPartage.ts`,
  `/api/reglages?domaine=plan-voie`) : l'écran LA DESCENTE règle le
  brouillon du poste, PUBLIER le fait jouer pour tout le monde, REVENIR AU
  PUBLIÉ, RECHARGER, RETIRER LE PUBLIÉ (le livré reprend). Un joueur joue
  toujours le publié, sinon le livré — un brouillon sur son poste ne compte
  pas ; un concepteur joue son brouillon s'il en a un, et l'écran lui dit
  lequel joue. Le magasin `/api/reglages` est générique par domaine.
- **La même règle pour tout ce qui restait par poste** :
  - la **carte de la station** (`src/game/cartePartage.ts`, domaine `carte`) :
    l'éditeur PUBLIE (refusé si la carte a une erreur), ouvre la publiée,
    la retire ; la carte publiée joue pour tout le monde, la livrée est le
    filet, le brouillon de l'éditeur ne joue jamais (il a son aperçu) ;
  - les **cartes de l'atelier des récompenses** (domaine `recompenses`) :
    publier pour tous, reprendre les publiées, retirer ; tant que rien
    n'est publié, le brouillon joue (rien ne change hors-ligne) ;
  - les **retouches de textes** (domaine `textes`, toutes langues) : même
    trio de gestes dans l'écran TEXTES ;
  - les **séquences** du montage (domaine `sequences`) : publier celles du
    poste, reprendre une publiée (même code) pour la retoucher, retirer ;
    le poste prime par code.
  Partout, l'écran dit ce que les joueurs jouent et ce que ce poste joue.
