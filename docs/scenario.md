# Projet 21 — bible narrative (v3)

> v3 — 17/08/2026 : le personnage du Dr N. Véga et toute la narration par
> journal de bord (inventions des sessions précédentes, jamais validées)
> sont SUPPRIMÉS. Ce document sépare désormais strictement LE CANON (la
> ligne de conduite du concepteur) des PROPOSITIONS héritées, qui attendent
> un verdict. La voix narrative du jeu est À DÉFINIR par le concepteur.

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

# PROPOSITIONS héritées de la v1 — à valider ou à jeter

> Ces éléments viennent des sessions précédentes et n'ont PAS été validés
> par le concepteur. Ils ne contredisent pas le canon mais n'en font pas
> partie tant qu'un verdict n'est pas rendu.

- **Le twist du collecteur** : le sas de fin de tableau n'est pas une
  sortie mais un collecteur — chaque « réussite » du joueur est une
  récolte pour le laboratoire ; les bonbonnes sont la moisson du labo.
- **Un acte final d'évasion** : reprendre sa masse collectée, percer la
  coque, finir en bloc de glace dérivant vers la Terre.

# À DÉFINIR (décisions du concepteur en attente)

- **La voix narrative** : qui parle au joueur, et par quel canal ?
  (Le journal de bord signé « Dr N. Véga » est supprimé ; les textes de
  journaux encore présents dans les données des tableaux sont un héritage
  à purger/remplacer quand la nouvelle voix sera choisie.)
- Les textes système (fin de tableau, défaite) dans la nouvelle voix.
- Le nombre de runs avant la révélation du miroir spatial.
